package io.github.vikasreddykamalapuram.moneyiq

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.widget.RemoteViews

/**
 * Minimal home-screen widget for MoneyIQ.
 *
 * Shows this month's total spend (read from SharedPreferences that the JS
 * side keeps in sync via the WidgetBridge Capacitor plugin — for now we
 * fall back to a placeholder if the value isn't set yet) and an
 * "Add expense" button that fires the expenseiq://add?type=expense deep link.
 */
class ExpenseWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    companion object {
        const val PREFS = "expenseiq_widget"
        const val KEY_MONTH_SPEND = "monthSpend"
        const val KEY_CURRENCY = "currency"

        fun updateWidget(
            context: Context,
            manager: AppWidgetManager,
            widgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_expense)

            val prefs: SharedPreferences =
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val spend = prefs.getString(KEY_MONTH_SPEND, null)
            val currency = prefs.getString(KEY_CURRENCY, "₹") ?: "₹"

            views.setTextViewText(
                R.id.widget_month_spend,
                if (spend != null) "$currency$spend" else "—"
            )

            // Tap the "Add expense" button → deep-link into the app.
            val addIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("expenseiq://add?type=expense")
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val addPending = PendingIntent.getActivity(
                context,
                widgetId,
                addIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            views.setOnClickPendingIntent(R.id.widget_add_button, addPending)

            // Tap anywhere else → open the dashboard.
            val openIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("expenseiq:///")
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openPending = PendingIntent.getActivity(
                context,
                widgetId + 1000,
                openIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            views.setOnClickPendingIntent(R.id.widget_root, openPending)

            manager.updateAppWidget(widgetId, views)
        }

        /** Called from the JS side (via a small bridge) whenever the month spend changes. */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, ExpenseWidgetProvider::class.java)
            )
            for (id in ids) updateWidget(context, manager, id)
        }
    }
}
