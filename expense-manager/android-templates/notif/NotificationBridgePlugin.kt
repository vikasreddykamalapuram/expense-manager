package io.github.vikasreddykamalapuram.moneyiq

import android.content.Intent
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Bridge exposing the on-device notification listener to the JS layer.
 *
 * Usage from JS:
 *   const NotificationBridge = registerPlugin('NotificationBridge');
 *   const { enabled } = await NotificationBridge.isEnabled();
 *   await NotificationBridge.openSettings();            // grant screen
 *   const { notifications } = await NotificationBridge.getPending();
 *   const status = await NotificationBridge.getStatus(); // diagnostics
 */
@CapacitorPlugin(name = "NotificationBridge")
class NotificationBridgePlugin : Plugin() {

    /** Is notification access currently granted to this app? */
    @PluginMethod
    fun isEnabled(call: PluginCall) {
        val flat = Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners"
        ).orEmpty()
        val enabled = flat.contains(context.packageName)
        val ret = JSObject()
        ret.put("enabled", enabled)
        call.resolve(ret)
    }

    /** Open the system "Notification access" settings so the user can grant it. */
    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    /** Drain buffered financial notifications captured since the last call. */
    @PluginMethod
    fun getPending(call: PluginCall) {
        val ret = JSObject()
        ret.put("notifications", MoneyIqNotificationListener.drain(context))
        call.resolve(ret)
    }

    /**
     * Diagnostics so the Settings screen can show whether detection is actually
     * alive, instead of silently doing nothing when the listener is unbound.
     */
    @PluginMethod
    fun getStatus(call: PluginCall) {
        val flat = Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners"
        ).orEmpty()
        val status = MoneyIqNotificationListener.status(context)
        val ret = JSObject()
        ret.put("granted", flat.contains(context.packageName))
        ret.put("connected", status.optBoolean("connected", false))
        ret.put("buffered", status.optInt("buffered", 0))
        ret.put("capturedTotal", status.optLong("capturedTotal", 0L))
        ret.put("lastCapturedAt", status.optLong("lastCapturedAt", 0L))
        call.resolve(ret)
    }
}
