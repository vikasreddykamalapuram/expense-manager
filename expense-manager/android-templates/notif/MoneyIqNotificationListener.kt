package io.github.vikasreddykamalapuram.moneyiq

import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * On-device notification listener for transaction auto-detection.
 *
 * Privacy-first: it only buffers notifications that *look financial* (carry a
 * currency amount alongside a transaction keyword), keeps at most [MAX] of them
 * in the app's own private SharedPreferences, and never uploads anything. The JS
 * layer drains the buffer via NotificationBridge.getPending(), parses each item,
 * and shows it in the review queue — nothing is saved until the user confirms.
 *
 * The buffer is deliberately **persisted, not in-memory**. This service runs in
 * the app's process, and Android kills backgrounded app processes routinely
 * (aggressively so on several OEM skins). A static buffer is wiped on process
 * death and the service is later rebound into a fresh process, so alerts that
 * arrive while the app is not running — i.e. nearly all of them — would be lost
 * before the user ever opened the app to drain them.
 *
 * Requires the user to explicitly grant "notification access" in system
 * settings; without that grant Android never binds this service.
 */
class MoneyIqNotificationListener : NotificationListenerService() {

    override fun onListenerConnected() {
        super.onListenerConnected()
        prefs(this).edit().putBoolean(KEY_CONNECTED, true).apply()
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        prefs(this).edit().putBoolean(KEY_CONNECTED, false).apply()
        // Android drops the binding after an app update (and on some OEM ROMs
        // when reclaiming memory). Ask the platform to bind us again.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                NotificationListenerService.requestRebind(
                    ComponentName(this, MoneyIqNotificationListener::class.java)
                )
            } catch (_: Exception) {
                // Best effort — the user can always re-toggle access manually.
            }
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        try {
            // Never capture our own notifications (reminder/review nudges) or we
            // would feed detected transactions back into the detector.
            if (sbn.packageName == packageName) return
            // Ongoing notifications (music, downloads, navigation) carry no
            // per-transaction detail.
            if (sbn.isOngoing) return

            val extras = sbn.notification?.extras ?: return
            val title = extras.getCharSequence("android.title")?.toString().orEmpty()
            val text = extras.getCharSequence("android.text")?.toString().orEmpty()
            val bigText = extras.getCharSequence("android.bigText")?.toString().orEmpty()
            val body = if (bigText.isNotBlank()) bigText else text
            val combined = listOf(title, body).filter { it.isNotBlank() }.joinToString(" — ")
            if (combined.isBlank() || !looksFinancial(combined)) return

            val obj = JSONObject()
            obj.put("package", sbn.packageName ?: "")
            obj.put("title", title)
            obj.put("text", body)
            obj.put("postTime", sbn.postTime)
            add(this, obj)
        } catch (_: Exception) {
            // Never let a parsing hiccup crash the listener.
        }
    }

    private fun looksFinancial(s: String): Boolean {
        val lower = s.lowercase()
        // An amount is the signal the JS parser actually needs — it discards any
        // candidate without one. Requiring it here stops chat messages that merely
        // say "paid" from evicting real bank alerts out of the capped buffer.
        return AMOUNT.containsMatchIn(lower) && KEYWORDS.containsMatchIn(lower)
    }

    companion object {
        private const val MAX = 50
        private const val PREFS = "moneyiq_notif_capture"
        private const val KEY_BUFFER = "buffer"
        private const val KEY_TOTAL = "captured_total"
        private const val KEY_LAST_AT = "last_captured_at"
        private const val KEY_CONNECTED = "listener_connected"

        private val AMOUNT = Regex("(?:inr|rs\\.?|₹)\\s?[0-9]")
        private val KEYWORDS = Regex(
            "debited|credited|spent|paid|received|txn|transaction|purchase|withdrawn|refund|deducted"
        )

        private fun prefs(ctx: Context) =
            ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        private fun readBuffer(ctx: Context): JSONArray =
            try {
                JSONArray(prefs(ctx).getString(KEY_BUFFER, "[]") ?: "[]")
            } catch (_: Exception) {
                JSONArray()
            }

        /** Buffer a captured notification. Persisted, so it survives process death. */
        @Synchronized
        fun add(ctx: Context, o: JSONObject) {
            val existing = readBuffer(ctx)

            // Banks update the same notification repeatedly; skip exact repeats
            // that are already waiting to be drained.
            for (i in 0 until existing.length()) {
                val prev = existing.optJSONObject(i) ?: continue
                if (prev.optString("title") == o.optString("title") &&
                    prev.optString("text") == o.optString("text") &&
                    prev.optString("package") == o.optString("package")
                ) {
                    return
                }
            }

            // Keep only the newest MAX entries once the incoming one is appended.
            val trimmed = JSONArray()
            val start = maxOf(0, existing.length() + 1 - MAX)
            for (i in start until existing.length()) {
                existing.optJSONObject(i)?.let { trimmed.put(it) }
            }
            trimmed.put(o)

            val p = prefs(ctx)
            p.edit()
                .putString(KEY_BUFFER, trimmed.toString())
                .putLong(KEY_TOTAL, p.getLong(KEY_TOTAL, 0L) + 1L)
                .putLong(KEY_LAST_AT, System.currentTimeMillis())
                .apply()
        }

        /** Return everything captured so far and clear the buffer. */
        @Synchronized
        fun drain(ctx: Context): JSONArray {
            val arr = readBuffer(ctx)
            prefs(ctx).edit().putString(KEY_BUFFER, "[]").apply()
            return arr
        }

        /** Diagnostics for the Settings screen so the user can tell it is alive. */
        @Synchronized
        fun status(ctx: Context): JSONObject {
            val p = prefs(ctx)
            return JSONObject().apply {
                put("connected", p.getBoolean(KEY_CONNECTED, false))
                put("buffered", readBuffer(ctx).length())
                put("capturedTotal", p.getLong(KEY_TOTAL, 0L))
                put("lastCapturedAt", p.getLong(KEY_LAST_AT, 0L))
            }
        }
    }
}
