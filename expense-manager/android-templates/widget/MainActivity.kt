package io.github.vikasreddykamalapuram.moneyiq

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(WidgetBridgePlugin::class.java)
        registerPlugin(NotificationBridgePlugin::class.java)
        registerPlugin(SpeechBridgePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
