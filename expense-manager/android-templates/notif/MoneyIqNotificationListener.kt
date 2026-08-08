package io.github.vikasreddykamalapuram.moneyiq

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * On-device notification listener for transaction auto-detection.
 *
 * Privacy-first: it only buffers notifications that *look financial* (contain a
 * debit/credit keyword or a currency amount), keeps them in a small in-memory
 * ring buffer, and never persists or uploads anything. The JS layer drains the
 * buffer via NotificationBridge.getPending(), parses each item, and shows it in
 * the review queue — nothing is saved until the user confirms.
 *
 * Requires the user to explicitly grant "notification access" in system
 * settings; without that grant Android never binds this service.
 */
class MoneyIqNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        try {
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
            add(obj)
        } catch (_: Exception) {
            // Never let a parsing hiccup crash the listener.
        }
    }

    private fun looksFinancial(s: String): Boolean {
        val lower = s.lowercase()
        val hasKeyword = KEYWORDS.containsMatchIn(lower)
        val hasAmount = AMOUNT.containsMatchIn(lower)
        return hasKeyword || hasAmount
    }

    companion object {
        private const val MAX = 50
        private val AMOUNT = Regex("(?:inr|rs\\.?|₹)\\s?[0-9]")
        private val KEYWORDS = Regex(
            "debited|credited|spent|paid|received|txn|transaction|purchase|withdrawn|refund|deducted"
        )
        private val items = ArrayDeque<JSONObject>()

        @Synchronized
        fun add(o: JSONObject) {
            items.addLast(o)
            while (items.size > MAX) items.removeFirst()
        }

        /** Return everything captured so far and clear the buffer. */
        @Synchronized
        fun drain(): JSONArray {
            val arr = JSONArray()
            for (o in items) arr.put(o)
            items.clear()
            return arr
        }
    }
}
