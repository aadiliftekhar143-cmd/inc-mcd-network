package com.coceptual.wardsadasya

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.webkit.MimeTypeMap
import android.widget.MediaController
import android.widget.Toast
import android.widget.VideoView
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

private val Navy = Color(0xFF0F1B33)
private val NavySoft = Color(0xFF1C2B4A)
private val Blue = Color(0xFF1B4FA8)
private val Orange = Color(0xFFC2560A)
private val OrangeBg = Color(0xFFFDF1E8)
private val OrangeText = Color(0xFF8A3D07)
private val Green = Color(0xFF1B7A3A)
private val GreenBg = Color(0xFFE3F1E7)
private val GreenText = Color(0xFF1B5E33)
private val Ground = Color(0xFFF4F6F9)
private val Line = Color(0xFFE3E6EB)
private val Muted = Color(0xFF5B6270)
private val Ink = Color(0xFF14171C)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Notify.createChannel(this)
        ReminderWorker.schedule(this)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Blue, secondary = Orange, background = Ground, surface = Color.White)) {
                WardApp()
            }
        }
    }
}

private sealed class Screen {
    object Login : Screen()
    object Home : Screen()
    data class Task(val task: JSONObject) : Screen()
    object Messages : Screen()
}

@Composable
private fun WardApp() {
    val ctx = LocalContext.current
    var screen by remember { mutableStateOf<Screen>(if (Store.token(ctx) == null) Screen.Login else Screen.Home) }
    var homeKey by remember { mutableIntStateOf(0) }

    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    val logout = { Store.clear(ctx); screen = Screen.Login }

    Surface(Modifier.fillMaxSize(), color = Ground) {
        when (val s = screen) {
            is Screen.Login -> LoginScreen(onDone = { screen = Screen.Home })
            is Screen.Home -> HomeScreen(
                refreshKey = homeKey,
                onTask = { screen = Screen.Task(it) },
                onMessages = { screen = Screen.Messages },
                onLogout = logout,
            )
            is Screen.Task -> TaskScreen(s.task, onBack = { homeKey++; screen = Screen.Home }, onLogout = logout)
            is Screen.Messages -> MessagesScreen(onBack = { homeKey++; screen = Screen.Home })
        }
    }
}

private fun openLink(ctx: Context, url: String) {
    try {
        val action = if (url.startsWith("tel:")) Intent.ACTION_DIAL else Intent.ACTION_VIEW
        ctx.startActivity(Intent(action, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (e: Exception) {
        Toast.makeText(ctx, "लिंक नहीं खुल सका", Toast.LENGTH_SHORT).show()
    }
}

private fun whatsappLink(text: String) = "https://wa.me/?text=" + URLEncoder.encode(text, "UTF-8")

private fun dayLabel(date: String): Pair<String, String> {
    val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    val p = date.split("-")
    return if (p.size == 3) Pair(p[2].trimStart('0'), months[p[1].toInt() - 1]) else Pair(date, "")
}

// ---------------------------------------------------------------- Login

@Composable
private fun LoginScreen(onDone: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var mobile by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var helpline by remember { mutableStateOf<String?>(null) }
    var foundMember by remember { mutableStateOf<JSONObject?>(null) }
    var token by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().background(Color.White)) {
        Column(
            Modifier.fillMaxWidth().background(Navy).padding(start = 28.dp, end = 28.dp, top = 56.dp, bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Image(
                painterResource(R.drawable.logo), contentDescription = "कांग्रेस पार्टी चिह्न",
                modifier = Modifier.size(72.dp).clip(CircleShape).background(Color.White), contentScale = ContentScale.Fit,
            )
            Text("वार्ड सदस्य", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
            Text("दिल्ली प्रदेश कांग्रेस कमेटी", color = Color(0xFFC9D2E3), fontSize = 15.sp)
        }

        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (foundMember == null) {
                Text("अपना मोबाइल नंबर दर्ज करें", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text(
                    "अपना 10 अंकों का मोबाइल नंबर डालें। यदि आपका विवरण रिकॉर्ड में उपलब्ध है, तो वह नीचे दिखाई देगा।",
                    color = Muted, fontSize = 14.sp, lineHeight = 20.sp,
                )

                OutlinedTextField(
                    value = mobile,
                    onValueChange = { v ->
                        mobile = v.filter { it.isDigit() }.take(10)
                        error = null
                        foundMember = null
                    },
                    prefix = { Text("+91  ", fontWeight = FontWeight.SemiBold) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    textStyle = LocalTextStyle.current.copy(fontSize = 20.sp, fontWeight = FontWeight.Bold),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )

                Button(
                    onClick = {
                        busy = true
                        error = null
                        scope.launch {
                            try {
                                val r = Api.call(ctx, "login", JSONObject().put("mobile", mobile))
                                token = r.getString("token")
                                foundMember = r.getJSONObject("member")
                            } catch (e: ApiError) {
                                error = if (e.code == "not_registered") "यह नंबर सूची में नहीं मिला।" else "मोबाइल नंबर सही नहीं है।"
                                helpline = e.body.optString("helpline").ifBlank { null }
                            } catch (e: Exception) {
                                error = "इंटरनेट चेक करें और फिर कोशिश करें।"
                            }
                            busy = false
                        }
                    },
                    enabled = mobile.length == 10 && !busy,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Blue),
                ) {
                    Text(if (busy) "जांच हो रही है…" else "विवरण देखें", fontSize = 17.sp, fontWeight = FontWeight.Bold)
                }

                error?.let {
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(OrangeBg).padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(it, color = OrangeText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "यदि आपका नंबर एडमिन द्वारा अभी तक नहीं जोड़ा गया है, तो कृपया सहायता के लिए कॉल करें:",
                            color = OrangeText, fontSize = 13.sp,
                        )
                        helpline?.let { h ->
                            OutlinedButton(
                                onClick = { openLink(ctx, "tel:$h") },
                                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = OrangeText),
                                border = BorderStroke(1.dp, Orange),
                            ) {
                                Text("📞  हेल्पलाइन पर कॉल करें: $h", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                        }
                    }
                }
            } else {
                val m = foundMember!!
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFFF0FDF4))
                        .border(1.5.dp, Green, RoundedCornerShape(16.dp)).padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(36.dp).clip(CircleShape).background(GreenBg),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Filled.Check, null, tint = Green)
                        }
                        Text(
                            "  सदस्य विवरण मिल गया",
                            color = GreenText, fontSize = 16.sp, fontWeight = FontWeight.Bold,
                        )
                    }

                    HorizontalDivider(color = Color(0xFFBBF7D0))

                    ProfileField("नाम", m.optString("name"))
                    val wardName = m.optString("ward_name").takeIf { it.isNotBlank() && it != "null" }
                    ProfileField("वार्ड", "वार्ड ${m.optInt("ward_no")}" + (wardName?.let { " ($it)" } ?: ""))
                    val zone = m.optString("zone").takeIf { it.isNotBlank() && it != "null" }
                    if (zone != null) ProfileField("ज़ोन", zone)
                    val ac = m.optString("assembly").takeIf { it.isNotBlank() && it != "null" }
                    if (ac != null) ProfileField("विधानसभा", ac)
                    ProfileField("मोबाइल", "+91 $mobile")
                }

                Button(
                    onClick = {
                        token?.let {
                            Store.setToken(ctx, it)
                            onDone()
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Green),
                ) {
                    Text("आगे बढ़ें  ➔", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }

                TextButton(
                    onClick = {
                        foundMember = null
                        token = null
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("दूसरा नंबर डालें", color = Muted, fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
private fun ProfileField(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = Muted, fontSize = 14.sp)
        Text(value, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

// ---------------------------------------------------------------- Home

@Composable
private fun HomeScreen(refreshKey: Int, onTask: (JSONObject) -> Unit, onMessages: () -> Unit, onLogout: () -> Unit) {
    val ctx = LocalContext.current
    var date by remember { mutableStateOf<String?>(null) }
    var data by remember { mutableStateOf<JSONObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(date, refreshKey, reload) {
        error = null
        try {
            val p = JSONObject(); date?.let { p.put("date", it) }
            data = Api.call(ctx, "home", p)
        } catch (e: ApiError) {
            if (e.code == "unauthorized") onLogout() else error = "डेटा लोड नहीं हुआ।"
        } catch (e: Exception) {
            error = "इंटरनेट चेक करें।"
        }
    }

    val d = data
    if (d == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (error != null) Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(error!!, color = OrangeText)
                TextButton(onClick = { reload++ }) { Text("फिर कोशिश करें") }
            } else CircularProgressIndicator()
        }
        return
    }

    val member = d.getJSONObject("member")
    val tasks = d.optJSONArray("tasks") ?: JSONArray()
    val uploadTasks = (0 until tasks.length()).map { tasks.getJSONObject(it) }.filter { it.optString("kind") == "upload" }
    val shareTasks = (0 until tasks.length()).map { tasks.getJSONObject(it) }.filter { it.optString("kind") == "share" }
    val doneCount = uploadTasks.count { it.optBoolean("done") }
    val today = d.optString("today")
    val selected = d.optString("date")
    val days = d.optJSONArray("days") ?: JSONArray()

    Column(Modifier.fillMaxSize()) {
        // Header
        Column(Modifier.fillMaxWidth().background(Navy).padding(20.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text("नमस्ते, ${member.optString("name")} जी", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    val zone = member.optString("zone").takeIf { it.isNotBlank() && it != "null" }
                    Text(
                        "वार्ड ${member.optInt("ward_no")}" + (zone?.let { " · $it" } ?: ""),
                        color = Color(0xFFC9D2E3), fontSize = 14.sp,
                    )
                }
                IconButton(onClick = { reload++ }) { Icon(Icons.Filled.Refresh, "रीफ्रेश", tint = Color.White) }
                IconButton(onClick = onLogout) { Icon(Icons.Filled.Logout, "नंबर बदलें", tint = Color.White) }
            }
            if (uploadTasks.isNotEmpty()) {
                Column(
                    Modifier.padding(top = 14.dp).fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(NavySoft).padding(12.dp),
                ) {
                    Row {
                        Text("आज के काम", color = Color(0xFFC9D2E3), fontSize = 14.sp, modifier = Modifier.weight(1f))
                        Text("${uploadTasks.size} में से $doneCount पूरा", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                    LinearProgressIndicator(
                        progress = { doneCount.toFloat() / uploadTasks.size },
                        modifier = Modifier.padding(top = 8.dp).fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                        color = Color(0xFFF59E0B), trackColor = Color(0xFF33415F),
                    )
                }
            }
        }

        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Day strip
            if (days.length() > 0) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items((0 until days.length()).map { days.getString(it) }) { day ->
                        val (num, mon) = dayLabel(day)
                        val isSel = day == selected
                        val future = day > today
                        Column(
                            Modifier.size(width = 48.dp, height = 58.dp).clip(RoundedCornerShape(10.dp))
                                .background(if (isSel) Blue else Color.White)
                                .border(1.dp, if (isSel) Blue else Line, RoundedCornerShape(10.dp))
                                .clickable(enabled = !future) { date = day },
                            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                        ) {
                            val c = if (isSel) Color.White else if (future) Color(0xFFB0B5BE) else Ink
                            Text(mon, fontSize = 11.sp, color = c)
                            Text(num, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = c)
                        }
                    }
                }
            }

            // Leader message
            d.optJSONObject("leader")?.let { msg ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
                        .border(1.dp, Color(0xFFF1C9A8), RoundedCornerShape(14.dp)).clickable { onMessages() }.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Orange), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.PlayArrow, null, tint = Color.White)
                    }
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Text("देवेन्द्र यादव जी का संदेश", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text(msg.optString("title"), fontSize = 13.sp, color = Muted, maxLines = 1)
                    }
                }
            }

            Text("आज के काम", fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
            if (uploadTasks.isEmpty() && shareTasks.isEmpty()) {
                Text("इस दिन के लिए अभी कोई काम नहीं है।", color = Muted, fontSize = 14.sp)
            }
            uploadTasks.forEach { t -> TaskCard(t) { onTask(t) } }
            shareTasks.forEach { t -> ShareCard(t) }

            // Leader social handles
            val social = d.optJSONObject("social")
            if (social != null) {
                Row(Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("देवेन्द्र यादव जी", fontSize = 13.sp, color = Muted, modifier = Modifier.weight(1f))
                    listOf("Facebook" to "facebook", "X" to "x", "Instagram" to "instagram").forEach { (label, key) ->
                        val url = social.optString(key)
                        if (url.isNotBlank() && url != "null") {
                            OutlinedButton(
                                onClick = { openLink(ctx, url) },
                                contentPadding = PaddingValues(horizontal = 12.dp),
                                modifier = Modifier.padding(start = 6.dp).height(40.dp),
                            ) { Text(label, fontSize = 12.sp, color = Ink) }
                        }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun TaskCard(t: JSONObject, onClick: () -> Unit) {
    val done = t.optBoolean("done")
    val videos = t.optInt("videos")
    val slots = t.optInt("video_slots", 1)
    val (label, bg, fg) = when {
        done -> Triple("पूरा", GreenBg, GreenText)
        videos > 0 -> Triple("$slots में से $videos वीडियो", Color(0xFFE3ECFA), Color(0xFF123A7E))
        else -> Triple("बाकी", OrangeBg, OrangeText)
    }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
            .border(1.dp, Line, RoundedCornerShape(14.dp)).clickable { onClick() }.padding(14.dp),
    ) {
        Box(
            Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(if (done) Green else Color.White)
                .border(2.dp, if (done) Green else Color(0xFFCDD2DA), RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) { if (done) Icon(Icons.Filled.Check, null, tint = Color.White, modifier = Modifier.size(18.dp)) }
        Column(Modifier.padding(start = 12.dp).weight(1f)) {
            Text(t.optString("title"), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = fg,
                    modifier = Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 8.dp, vertical = 3.dp),
                )
                Text("  $slots वीडियो", fontSize = 12.sp, color = Muted)
            }
        }
    }
}

@Composable
private fun ShareCard(t: JSONObject) {
    val ctx = LocalContext.current
    val links = listOf(
        Triple("X पर देखें", t.optString("link_x"), true),
        Triple("Instagram", t.optString("link_instagram"), false),
        Triple("Facebook", t.optString("link_facebook"), false),
        Triple("WhatsApp", t.optString("link_whatsapp"), false),
    ).filter { it.second.isNotBlank() && it.second != "null" }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
            .border(1.dp, Line, RoundedCornerShape(14.dp)).padding(14.dp),
    ) {
        Text(t.optString("title"), fontSize = 14.sp, fontWeight = FontWeight.Bold)
        val desc = t.optString("description")
        Text(if (desc.isNotBlank() && desc != "null") desc else "देखें और अपने अकाउंट से रीशेयर करें", fontSize = 12.sp, color = Muted)
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            links.forEach { (label, url, dark) ->
                val target = if (label == "WhatsApp") whatsappLink(url) else url
                if (dark) {
                    Button(onClick = { openLink(ctx, target) }, colors = ButtonDefaults.buttonColors(containerColor = Ink),
                        modifier = Modifier.weight(1f).height(44.dp), contentPadding = PaddingValues(4.dp)) { Text(label, fontSize = 13.sp) }
                } else {
                    OutlinedButton(onClick = { openLink(ctx, target) }, modifier = Modifier.weight(1f).height(44.dp),
                        contentPadding = PaddingValues(4.dp)) { Text(label, fontSize = 13.sp, color = Ink) }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Task + uploads

@Composable
private fun TaskScreen(initial: JSONObject, onBack: () -> Unit, onLogout: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val taskId = initial.getLong("id")
    val slots = initial.optInt("video_slots", 1)
    var videos by remember { mutableIntStateOf(initial.optInt("videos")) }
    var photos by remember { mutableIntStateOf(initial.optInt("photos")) }
    var done by remember { mutableStateOf(initial.optBoolean("done")) }
    var progress by remember { mutableStateOf<Float?>(null) }
    var uploadingKind by remember { mutableStateOf<String?>(null) }
    var submitting by remember { mutableStateOf(false) }
    val busy = uploadingKind != null

    // Keep screen awake while uploading so Android OS does not suspend network
    DisposableEffect(busy) {
        val window = (ctx as? Activity)?.window
        if (busy) {
            window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        onDispose {
            window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    BackHandler {
        if (busy) Toast.makeText(ctx, "अपलोड पूरा होने दें", Toast.LENGTH_SHORT).show() else onBack()
    }

    fun upload(uri: Uri, kind: String) {
        val mime = ctx.contentResolver.getType(uri) ?: if (kind == "video") "video/mp4" else "image/jpeg"
        val size = Api.fileSize(ctx, uri)
        val maxBytes = 50L * 1024 * 1024 // 50 MB limit for Supabase Storage
        if (size > maxBytes) {
            val mb = (size / (1024 * 1024)).toInt()
            Toast.makeText(ctx, "फाइल $mb MB की है। कृपया 50 MB से छोटी फाइल चुनें।", Toast.LENGTH_LONG).show()
            return
        }
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: if (kind == "video") "mp4" else "jpg"
        uploadingKind = kind; progress = 0f
        scope.launch {
            try {
                val u = Api.call(ctx, "upload_url", JSONObject().put("task_id", taskId).put("kind", kind).put("ext", ext).put("size", size))
                var lastErr: Exception? = null
                var ok = false
                for (attempt in 1..3) {
                    try {
                        Api.upload(ctx, u.getString("signed_url"), uri, mime) { p -> progress = p }
                        ok = true; break
                    } catch (e: Exception) { lastErr = e; progress = 0f }
                }
                if (!ok) throw lastErr ?: Exception("upload")
                val r = Api.call(ctx, "attach", JSONObject().put("task_id", taskId).put("kind", kind).put("path", u.getString("path")).put("size", size))
                r.optJSONObject("task")?.let { videos = it.optInt("videos"); photos = it.optInt("photos") }
            } catch (e: ApiError) {
                val detail = e.data.optString("detail", "")
                when {
                    e.code == "unauthorized" -> onLogout()
                    e.code == "limit_reached" -> Toast.makeText(ctx, "इस काम के सभी वीडियो जुड़ चुके हैं", Toast.LENGTH_LONG).show()
                    e.code == "file_too_large" || detail.contains("EntityTooLarge", ignoreCase = true) || detail.contains("Payload too large", ignoreCase = true) -> {
                        Toast.makeText(ctx, "फाइल साइज 50 MB से बड़ा है। छोटा वीडियो चुनें।", Toast.LENGTH_LONG).show()
                    }
                    e.code.startsWith("upload_failed_") -> {
                        val status = e.code.removePrefix("upload_failed_")
                        Toast.makeText(ctx, "अपलोड असफल (कोड $status)। कृपया दोबारा कोशिश करें।", Toast.LENGTH_LONG).show()
                    }
                    else -> Toast.makeText(ctx, "अपलोड नहीं हुआ (${e.code})", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Toast.makeText(ctx, "इंटरनेट चेक करें और फिर कोशिश करें (${e.message ?: "error"})", Toast.LENGTH_LONG).show()
            }
            uploadingKind = null; progress = null
        }
    }

    val pickVideo = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let { upload(it, "video") } }
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let { upload(it, "photo") } }

    Column(Modifier.fillMaxSize().background(Color.White)) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { if (!busy) onBack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "वापस") }
            Text("काम", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
        HorizontalDivider(color = Line)
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(initial.optString("title"), fontSize = 19.sp, fontWeight = FontWeight.Bold)
            val desc = initial.optString("description")
            if (desc.isNotBlank() && desc != "null") Text(desc, fontSize = 14.sp, color = Color(0xFF3B4250))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Chip("आज रात 11:59 तक", OrangeBg, OrangeText)
                Chip("$slots वीडियो", Ground, Color(0xFF3B4250))
            }

            Text("अटैचमेंट", fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))

            // Videos
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Ground).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row { Text("वीडियो", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)); Text("$videos / $slots", fontWeight = FontWeight.Bold) }
                for (i in 0 until slots) {
                    when {
                        i < videos -> SlotRow("वीडियो ${i + 1}", "अपलोड पूरा", GreenText, filled = true) {}
                        i == videos && uploadingKind == "video" -> UploadingRow("वीडियो ${i + 1}", progress ?: 0f)
                        else -> SlotRow("वीडियो ${i + 1}", "गैलरी से वीडियो चुनें", Blue, filled = false, enabled = !busy && i == videos) {
                            pickVideo.launch("video/*")
                        }
                    }
                }
            }

            // Photos
            if (initial.optBoolean("allow_photos", true)) {
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Ground).padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("फोटो", fontWeight = FontWeight.Bold)
                            Text(if (photos > 0) "$photos फोटो जुड़ी" else "ज़रूरत हो तो इलाके की समस्या की फोटो जोड़ें", fontSize = 12.sp, color = Muted)
                        }
                        OutlinedButton(onClick = { pickPhoto.launch("image/*") }, enabled = !busy, modifier = Modifier.height(44.dp)) {
                            Icon(Icons.Filled.PhotoCamera, null, modifier = Modifier.size(18.dp)); Text("  फोटो जोड़ें", color = Ink)
                        }
                    }
                    if (uploadingKind == "photo") UploadingRow("फोटो", progress ?: 0f)
                }
            }
        }

        // Tick
        Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (videos == 0) {
                Text("कम से कम 1 वीडियो अपलोड होने के बाद ही टिक कर सकते हैं", fontSize = 13.sp, color = OrangeText)
                Spacer(Modifier.height(8.dp))
            }
            Button(
                onClick = {
                    submitting = true
                    scope.launch {
                        try {
                            Api.call(ctx, "complete", JSONObject().put("task_id", taskId))
                            done = true
                            Toast.makeText(ctx, "जमा हो गया", Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            Toast.makeText(ctx, "जमा नहीं हुआ, फिर कोशिश करें", Toast.LENGTH_LONG).show()
                        }
                        submitting = false
                    }
                },
                enabled = videos > 0 && !busy && !submitting,
                colors = ButtonDefaults.buttonColors(containerColor = if (done) Green else Blue),
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(12.dp),
            ) {
                Icon(Icons.Filled.Check, null)
                Text(if (done) "  जमा हो गया (अपडेट करें)" else "  टिक करें और जमा करें", fontSize = 17.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun Chip(text: String, bg: Color, fg: Color) {
    Text(text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = fg,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 10.dp, vertical = 4.dp))
}

@Composable
private fun SlotRow(title: String, sub: String, subColor: Color, filled: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color.White)
            .then(if (!filled) Modifier.border(BorderStroke(1.5.dp, if (enabled) Color(0xFF8AABDD) else Line), RoundedCornerShape(10.dp)) else Modifier)
            .clickable(enabled = enabled && !filled) { onClick() }.padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)).background(if (filled) Color(0xFF1E2433) else Color(0xFFE8EEF8)),
            contentAlignment = Alignment.Center,
        ) { Icon(if (filled) Icons.Filled.PlayArrow else Icons.Filled.Add, null, tint = if (filled) Color.White else Blue) }
        Column(Modifier.padding(start = 10.dp)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = if (enabled || filled) Ink else Color(0xFFB0B5BE))
            Text(sub, fontSize = 12.sp, color = if (enabled || filled) subColor else Color(0xFFB0B5BE))
        }
    }
}

@Composable
private fun UploadingRow(title: String, p: Float) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color.White).padding(10.dp)) {
        Text("$title अपलोड हो रहा है… ${(p * 100).toInt()}%", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        LinearProgressIndicator(progress = { p }, modifier = Modifier.padding(top = 6.dp).fillMaxWidth())
        Text("स्क्रीन और ऐप खुला रखें (अपलोड जारी है)", fontSize = 11.sp, color = Muted, modifier = Modifier.padding(top = 4.dp))
    }
}

// ---------------------------------------------------------------- Leader messages

@Composable
private fun MessagesScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var list by remember { mutableStateOf<List<JSONObject>?>(null) }
    var current by remember { mutableStateOf<JSONObject?>(null) }
    var seen by remember { mutableStateOf(setOf<Long>()) }

    BackHandler { onBack() }
    LaunchedEffect(Unit) {
        try {
            val r = Api.call(ctx, "messages").optJSONArray("messages") ?: JSONArray()
            val l = (0 until r.length()).map { r.getJSONObject(it) }
            list = l; current = l.firstOrNull()
            seen = l.filter { it.optBoolean("seen") }.map { it.getLong("id") }.toSet()
        } catch (e: Exception) { list = emptyList() }
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().background(Color.White).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "वापस") }
            Text("अध्यक्ष जी का संदेश", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
        current?.let { m ->
            key(m.getLong("id")) {
                AndroidView(
                    factory = { c ->
                        VideoView(c).apply {
                            val mc = MediaController(c); mc.setAnchorView(this); setMediaController(mc)
                            setVideoURI(Uri.parse(m.optString("url")))
                            setOnPreparedListener { start() }
                            setOnErrorListener { _, _, _ ->
                                Toast.makeText(c, "वीडियो लोड नहीं हो सका", Toast.LENGTH_SHORT).show()
                                true
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black),
                    onRelease = { it.stopPlayback() },
                )
            }
            LaunchedEffect(m.getLong("id")) {
                val id = m.getLong("id")
                if (id !in seen) {
                    try { Api.call(ctx, "message_seen", JSONObject().put("id", id)); seen = seen + id } catch (e: Exception) {}
                }
            }
            Column(Modifier.fillMaxWidth().background(Color.White).padding(16.dp)) {
                Text(m.optString("title"), fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Text("माननीय DPCC अध्यक्ष देवेन्द्र यादव जी का सभी वार्ड सदस्यों के लिए संदेश।", fontSize = 14.sp, color = Color(0xFF3B4250), modifier = Modifier.padding(top = 6.dp))
            }
        }
        val l = list
        when {
            l == null -> Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            l.isEmpty() -> Text("अभी कोई संदेश नहीं है।", color = Muted, modifier = Modifier.padding(20.dp))
            l.size > 1 -> {
                Text("पिछले संदेश", fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 20.dp, top = 16.dp, bottom = 8.dp))
                Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    l.drop(1).forEach { m ->
                        val isAudio = m.optString("kind") == "audio"
                        val wasSeen = m.getLong("id") in seen
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color.White)
                                .border(1.dp, Line, RoundedCornerShape(12.dp))
                                .clickable { current = m; scope.launch { list = listOf(m) + l.filter { it !== m } } }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)).background(if (isAudio) Blue else Orange), contentAlignment = Alignment.Center) {
                                Icon(Icons.Filled.PlayArrow, null, tint = Color.White)
                            }
                            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                                Text(m.optString("title"), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Text(if (isAudio) "ऑडियो" else "वीडियो", fontSize = 12.sp, color = Muted)
                            }
                            Text(
                                if (wasSeen) (if (isAudio) "सुना" else "देखा") else "बाकी",
                                fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = if (wasSeen) GreenText else OrangeText,
                            )
                        }
                    }
                }
            }
        }
    }
}
