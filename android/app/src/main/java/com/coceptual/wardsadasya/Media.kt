package com.coceptual.wardsadasya

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

internal val ROLE_HI = mapOf(
    "president" to "माननीय अध्यक्ष, DPCC",
    "gs" to "महासचिव",
    "dp" to "ज़िला अध्यक्ष",
    "observer" to "विधानसभा ऑब्ज़र्वर",
    "member" to "वार्ड सदस्य",
)

/** Records a voice note (m4a). Shows record / stop / play / remove. */
@Composable
internal fun VoiceNote(file: File?, onChange: (File?) -> Unit) {
    val ctx = LocalContext.current
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var seconds by remember { mutableIntStateOf(0) }
    var current by remember { mutableStateOf<File?>(null) }

    fun start() {
        val f = File(ctx.cacheDir, "voice-${System.currentTimeMillis()}.m4a")
        try {
            @Suppress("DEPRECATION")
            val r = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(ctx) else MediaRecorder()
            r.setAudioSource(MediaRecorder.AudioSource.MIC)
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            r.setAudioEncodingBitRate(64_000)
            r.setAudioSamplingRate(44_100)
            r.setOutputFile(f.absolutePath)
            r.prepare(); r.start()
            recorder = r; current = f; seconds = 0
        } catch (e: Exception) {
            Toast.makeText(ctx, "रिकॉर्डिंग शुरू नहीं हो सकी", Toast.LENGTH_SHORT).show()
        }
    }
    fun stop() {
        try { recorder?.stop() } catch (_: Exception) { current = null }
        recorder?.release(); recorder = null
        onChange(current)
    }
    val askMic = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) start() else Toast.makeText(ctx, "वॉइस नोट के लिए माइक की अनुमति दें", Toast.LENGTH_LONG).show()
    }
    LaunchedEffect(recorder) {
        while (recorder != null) { delay(1000); seconds++; if (seconds >= 300) stop() }
    }
    DisposableEffect(Unit) { onDispose { try { recorder?.stop() } catch (_: Exception) {}; recorder?.release() } }

    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0xFFF2F4F8))
            .border(1.dp, Color(0xFFE3E7EF), RoundedCornerShape(12.dp)).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            recorder != null -> {
                Box(Modifier.size(10.dp).clip(CircleShape).background(Color(0xFFE5402F)))
                Text("  रिकॉर्ड हो रहा है  ${seconds / 60}:${"%02d".format(seconds % 60)}", fontSize = 14.sp, modifier = Modifier.weight(1f))
                Button(onClick = { stop() }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE5402F)), shape = RoundedCornerShape(10.dp)) {
                    Icon(Icons.Filled.Stop, null, modifier = Modifier.size(18.dp)); Text(" रोकें")
                }
            }
            file != null -> {
                AudioPlayer(file.absolutePath, Modifier.weight(1f))
                TextButton(onClick = { onChange(null) }) { Text("हटाएं", color = Color(0xFF9B1C1C)) }
            }
            else -> {
                Icon(Icons.Filled.Mic, null, tint = Color(0xFF6B7590))
                Text("  वॉइस नोट (ज़रूरी नहीं)", fontSize = 14.sp, color = Color(0xFF6B7590), modifier = Modifier.weight(1f))
                OutlinedButton(onClick = {
                    if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) start()
                    else askMic.launch(Manifest.permission.RECORD_AUDIO)
                }, shape = RoundedCornerShape(10.dp)) { Icon(Icons.Filled.Mic, null, modifier = Modifier.size(18.dp)); Text(" रिकॉर्ड करें") }
            }
        }
    }
}

/** Play / pause for a voice note (local file path or https URL). */
@Composable
internal fun AudioPlayer(source: String, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    var player by remember(source) { mutableStateOf<MediaPlayer?>(null) }
    var playing by remember(source) { mutableStateOf(false) }
    DisposableEffect(source) { onDispose { player?.release(); player = null } }
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(38.dp).clip(CircleShape).background(Color(0xFF0E1B3D)).clickable {
                try {
                    val p = player ?: MediaPlayer().also {
                        it.setDataSource(ctx, Uri.parse(if (source.startsWith("http")) source else "file://$source"))
                        it.setOnCompletionListener { playing = false }
                        it.prepare()
                        player = it
                    }
                    if (playing) { p.pause(); playing = false } else { p.start(); playing = true }
                } catch (e: Exception) {
                    Toast.makeText(ctx, "वॉइस नोट नहीं चल सका", Toast.LENGTH_SHORT).show()
                }
            },
            contentAlignment = Alignment.Center,
        ) { Icon(if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, "चलाएं", tint = Color.White, modifier = Modifier.size(20.dp)) }
        Text("  वॉइस नोट", fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF141C33))
    }
}

/** Uploads a local file through a signed URL from the given API; returns the storage path. */
internal suspend fun uploadFile(ctx: Context, leader: Boolean, file: File, kind: String, mime: String, purpose: String? = null): String {
    val params = JSONObject().put("kind", kind).put("ext", file.extension.ifBlank { "bin" }).put("size", file.length())
    purpose?.let { params.put("purpose", it) }
    val u = if (leader) Api.leader(ctx, "upload_url", params) else Api.call(ctx, "own_upload_url", params)
    Api.upload(ctx, u.getString("signed_url"), Uri.fromFile(file), mime) {}
    return u.getString("path")
}

/** Uploads a picked photo or video (content Uri). */
internal suspend fun uploadUri(ctx: Context, leader: Boolean, uri: Uri, kind: String): String {
    val mime = ctx.contentResolver.getType(uri) ?: if (kind == "video") "video/mp4" else "image/jpeg"
    val ext = android.webkit.MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: if (kind == "video") "mp4" else "jpg"
    val size = Api.fileSize(ctx, uri)
    val params = JSONObject().put("kind", kind).put("ext", ext).put("size", size)
    val u = if (leader) Api.leader(ctx, "upload_url", params) else Api.call(ctx, "own_upload_url", params)
    Api.upload(ctx, u.getString("signed_url"), uri, mime) {}
    return u.getString("path")
}

/** Best location the phone already has (GPS or network). Null if not allowed or unknown. */
@SuppressLint("MissingPermission")
internal fun lastLocation(ctx: Context): Location? {
    val ok = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (!ok) return null
    val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
        .mapNotNull { p -> try { lm.getLastKnownLocation(p) } catch (_: Exception) { null } }
        .maxByOrNull { it.time }
}

/** Asks the phone for a fresh fix in the background so the next lastLocation() is current. */
@SuppressLint("MissingPermission")
internal fun warmLocation(ctx: Context) {
    try {
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        for (p in listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)) {
            if (lm.isProviderEnabled(p)) {
                @Suppress("DEPRECATION")
                lm.requestSingleUpdate(p, { }, android.os.Looper.getMainLooper())
            }
        }
    } catch (_: Exception) {}
}

/** One person a leader can call. */
internal data class Callee(val mobile: String, val name: String, val role: String)

/**
 * Opens the phone's dialer, then asks for the result in one tap when the leader comes back.
 * Phones don't let apps know whether a call was answered.
 */
@Composable
internal fun rememberCaller(onLogged: () -> Unit = {}): (Callee) -> Unit {
    val ctx = LocalContext.current
    var pending by remember { mutableStateOf<Callee?>(null) }
    var asking by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val lifecycle = androidx.compose.ui.platform.LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val obs = androidx.lifecycle.LifecycleEventObserver { _, e ->
            if (e == androidx.lifecycle.Lifecycle.Event.ON_RESUME && pending != null) asking = true
        }
        lifecycle.addObserver(obs)
        onDispose { lifecycle.removeObserver(obs) }
    }
    val c = pending
    if (asking && c != null) {
        AlertDialog(
            onDismissRequest = { asking = false; pending = null },
            title = { Text("${c.name} से बात हुई?", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("बात हो गई", "फ़ोन नहीं उठाया", "फ़ोन बंद / नेटवर्क नहीं", "गलत नंबर").forEach { outcome ->
                        OutlinedButton(
                            onClick = {
                                asking = false; pending = null
                                scope.launch {
                                    try {
                                        Api.leader(ctx, "call_log", JSONObject().put("to_mobile", c.mobile).put("to_name", c.name).put("to_role", c.role).put("outcome", outcome))
                                        onLogged()
                                    } catch (_: Exception) {}
                                }
                            },
                            modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
                        ) { Text(outcome) }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { asking = false; pending = null }) { Text("छोड़ें") } },
        )
    }
    return { callee ->
        pending = callee
        try {
            ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${callee.mobile}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            pending = null
            Toast.makeText(ctx, "डायलर नहीं खुल सका", Toast.LENGTH_SHORT).show()
        }
    }
}
