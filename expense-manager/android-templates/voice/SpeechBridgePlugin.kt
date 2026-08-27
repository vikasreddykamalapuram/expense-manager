package io.github.vikasreddykamalapuram.moneyiq

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.ModelDownloadListener
import android.speech.RecognitionListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * On-device speech recognition for the Android shell.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Web Speech API is unusable here. Chromium binds
 * `SpeechRecognition.available()` / `.install()` — the only way to *prove* a
 * request will be served locally — in ChromeContentBrowserClient, which
 * android_webview does not compile. But WebView still ships
 * AwSpeechRecognitionManagerDelegate, so the legacy **cloud** path is live.
 *
 * A naive WebView implementation would therefore appear to work perfectly while
 * silently streaming microphone audio to a server, contradicting MoneyIQ's Play
 * Data Safety declaration. Nothing would fail: not CI, not manual testing.
 *
 * `createOnDeviceSpeechRecognizer` cannot reach the network, so it is the only
 * acceptable engine. Everything below fails closed: if we cannot prove that
 * recognition stays on the device, we report unavailable and the UI offers no
 * microphone.
 *
 * API LEVELS
 * ----------
 * `createOnDeviceSpeechRecognizer` is API 31, but `checkRecognitionSupport` and
 * `triggerModelDownload` — needed to prove a local model is actually installed —
 * are API 33. Without them we would be guessing, so 33 is the floor.
 */
@CapacitorPlugin(
    name = "SpeechBridge",
    permissions = [
        Permission(alias = SpeechBridgePlugin.MIC, strings = [Manifest.permission.RECORD_AUDIO]),
    ],
)
class SpeechBridgePlugin : Plugin() {

    companion object {
        const val MIC = "microphone"

        /** These strings mirror VoiceUnsupportedReason in speechEngine.ts. */
        private const val REASON_NO_LOCAL_API = "no-local-api"
        private const val REASON_NO_LOCAL_MODEL = "no-local-model"
    }

    private var recognizer: SpeechRecognizer? = null
    private var cancelled = false

    private fun supported(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(context)

    /** Android reports language tags as `en_IN` or `en-IN` inconsistently. */
    private fun normalize(tag: String) = tag.replace('_', '-').lowercase()

    private fun matches(list: List<String>?, lang: String): Boolean {
        if (list == null) return false
        val want = normalize(lang)
        val base = want.substringBefore('-')
        // Exact region match preferred, then the same base language, so a device
        // carrying only `en-US` still serves an `en-IN` request instead of
        // pretending voice is unavailable.
        return list.any { normalize(it) == want } ||
            list.any { normalize(it).substringBefore('-') == base }
    }

    private fun recognizerIntent(lang: String) =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            // Redundant next to an on-device recognizer, but harmless, and it
            // keeps the intent honest if it is ever reused elsewhere.
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

    private fun unsupported(call: PluginCall, reason: String) {
        val ret = JSObject()
        ret.put("status", "unsupported")
        ret.put("reason", reason)
        call.resolve(ret)
    }

    /**
     * Passive capability probe. Never touches the microphone, so it is safe to
     * run on mount to decide whether to render a mic button at all.
     */
    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val lang = call.getString("lang") ?: "en-IN"
        if (!supported()) {
            unsupported(call, REASON_NO_LOCAL_API)
            return
        }
        activity.runOnUiThread {
            val probe = try {
                SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
            } catch (e: Exception) {
                unsupported(call, REASON_NO_LOCAL_API)
                return@runOnUiThread
            }
            try {
                probe.checkRecognitionSupport(
                    recognizerIntent(lang),
                    context.mainExecutor,
                    object : RecognitionSupportCallback {
                        override fun onSupportResult(support: RecognitionSupport) {
                            val ret = JSObject()
                            when {
                                matches(support.installedOnDeviceLanguages, lang) ->
                                    ret.put("status", "ready")
                                matches(support.pendingOnDeviceLanguages, lang) ->
                                    ret.put("status", "downloading")
                                matches(support.supportedOnDeviceLanguages, lang) ->
                                    ret.put("status", "needs-download")
                                else -> {
                                    ret.put("status", "unsupported")
                                    ret.put("reason", REASON_NO_LOCAL_MODEL)
                                }
                            }
                            destroy(probe)
                            call.resolve(ret)
                        }

                        override fun onError(error: Int) {
                            destroy(probe)
                            // A probe that errors tells us nothing reassuring.
                            unsupported(call, REASON_NO_LOCAL_MODEL)
                        }
                    },
                )
            } catch (e: Exception) {
                destroy(probe)
                unsupported(call, REASON_NO_LOCAL_MODEL)
            }
        }
    }

    /** Ask the system to fetch the local model. Best-effort by design. */
    @PluginMethod
    fun install(call: PluginCall) {
        val lang = call.getString("lang") ?: "en-IN"
        if (!supported()) {
            call.resolve(JSObject().put("started", false))
            return
        }
        activity.runOnUiThread {
            try {
                val dl = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    dl.triggerModelDownload(
                        recognizerIntent(lang),
                        context.mainExecutor,
                        object : ModelDownloadListener {
                            override fun onProgress(completedPercent: Int) {}
                            override fun onSuccess() = destroy(dl)
                            override fun onScheduled() = destroy(dl)
                            override fun onError(error: Int) = destroy(dl)
                        },
                    )
                } else {
                    @Suppress("DEPRECATION")
                    dl.triggerModelDownload(recognizerIntent(lang))
                }
                call.resolve(JSObject().put("started", true))
            } catch (e: Exception) {
                call.resolve(JSObject().put("started", false))
            }
        }
    }

    @PluginMethod
    fun start(call: PluginCall) {
        if (getPermissionState(MIC) != PermissionState.GRANTED) {
            requestPermissionForAlias(MIC, call, "micPermissionCallback")
            return
        }
        beginListening(call)
    }

    @PermissionCallback
    private fun micPermissionCallback(call: PluginCall) {
        if (getPermissionState(MIC) == PermissionState.GRANTED) {
            beginListening(call)
        } else {
            emitError("not-allowed", "Microphone permission was denied.")
            emit("voiceEnd", JSObject())
            call.resolve(JSObject().put("started", false))
        }
    }

    private fun emit(event: String, data: JSObject) = notifyListeners(event, data)

    private fun emitError(code: String, message: String) {
        emit("voiceError", JSObject().put("code", code).put("message", message))
    }

    /**
     * Maps SpeechRecognizer error ints onto the Web Speech error strings the TS
     * layer already understands, so both engines share one error path.
     */
    private fun errorCode(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
        SpeechRecognizer.ERROR_AUDIO -> "audio-capture"
        SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "language-not-supported"
        SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED -> "language-not-supported"
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
        SpeechRecognizer.ERROR_CLIENT -> "aborted"
        else -> "unknown"
    }

    private fun beginListening(call: PluginCall) {
        val lang = call.getString("lang") ?: "en-IN"
        if (!supported()) {
            emitError("language-not-supported", "On-device recognition is unavailable on this device.")
            emit("voiceEnd", JSObject())
            call.resolve(JSObject().put("started", false))
            return
        }
        activity.runOnUiThread {
            releaseRecognizer()
            cancelled = false
            val rec = try {
                SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
            } catch (e: Exception) {
                emitError("unknown", "Could not start the on-device recogniser.")
                emit("voiceEnd", JSObject())
                call.resolve(JSObject().put("started", false))
                return@runOnUiThread
            }
            recognizer = rec
            rec.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { emit("voiceStart", JSObject()) }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}

                override fun onPartialResults(partialResults: Bundle?) {
                    if (cancelled) return
                    val text = partialResults
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                        .orEmpty()
                    if (text.isNotEmpty()) emit("voicePartial", JSObject().put("text", text))
                }

                override fun onResults(results: Bundle?) {
                    if (cancelled) { emit("voiceEnd", JSObject()); return }
                    val text = results
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                        .orEmpty()
                    if (text.isBlank()) emitError("no-speech", "I did not catch that.")
                    else emit("voiceResult", JSObject().put("text", text))
                    emit("voiceEnd", JSObject())
                }

                override fun onError(error: Int) {
                    if (cancelled) { emit("voiceEnd", JSObject()); return }
                    emitError(errorCode(error), "Recognition failed (code $error).")
                    emit("voiceEnd", JSObject())
                }

                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            try {
                rec.startListening(recognizerIntent(lang))
                call.resolve(JSObject().put("started", true))
            } catch (e: Exception) {
                emitError("unknown", "Could not start listening.")
                emit("voiceEnd", JSObject())
                call.resolve(JSObject().put("started", false))
            }
        }
    }

    /** Stop listening but keep whatever was recognised. */
    @PluginMethod
    fun stop(call: PluginCall) {
        activity.runOnUiThread {
            try { recognizer?.stopListening() } catch (e: Exception) { /* already stopped */ }
            call.resolve()
        }
    }

    /** Stop listening and discard the result. */
    @PluginMethod
    fun cancel(call: PluginCall) {
        activity.runOnUiThread {
            cancelled = true
            try { recognizer?.cancel() } catch (e: Exception) { /* already stopped */ }
            releaseRecognizer()
            call.resolve()
        }
    }

    private fun destroy(rec: SpeechRecognizer) {
        try { rec.destroy() } catch (e: Exception) { /* ignore */ }
    }

    private fun releaseRecognizer() {
        recognizer?.let { destroy(it) }
        recognizer = null
    }

    override fun handleOnDestroy() {
        activity.runOnUiThread { releaseRecognizer() }
    }
}
