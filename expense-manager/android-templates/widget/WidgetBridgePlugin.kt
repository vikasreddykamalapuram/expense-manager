package io.github.vikasreddykamalapuram.moneyiq

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Tiny bridge that lets the JS layer push the current month's spend total
 * into the SharedPreferences that ExpenseWidgetProvider reads. Triggers a
 * widget refresh so the home-screen tile updates immediately.
 *
 * Usage from JS:
 *   import { registerPlugin } from '@capacitor/core';
 *   const WidgetBridge = registerPlugin('WidgetBridge');
 *   await WidgetBridge.setMonthSpend({ amount: '12,340', currency: '₹' });
 */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    @PluginMethod
    fun setMonthSpend(call: PluginCall) {
        val amount = call.getString("amount") ?: ""
        val currency = call.getString("currency") ?: "₹"

        val prefs = context.getSharedPreferences(
            ExpenseWidgetProvider.PREFS,
            android.content.Context.MODE_PRIVATE
        )
        prefs.edit()
            .putString(ExpenseWidgetProvider.KEY_MONTH_SPEND, amount)
            .putString(ExpenseWidgetProvider.KEY_CURRENCY, currency)
            .apply()

        ExpenseWidgetProvider.refreshAll(context)

        val ret = JSObject()
        ret.put("ok", true)
        call.resolve(ret)
    }
}
