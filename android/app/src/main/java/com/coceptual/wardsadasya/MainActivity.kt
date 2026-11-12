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
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.SystemUpdate
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

const val APP_NAME = "INC MCD NETWORK"

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
private val Gold = Color(0xFFF59E0B)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Notify.createChannel(this)
        ReminderWorker.schedule(this)
        Push.register(this)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Blue, secondary = Orange, background = Ground, surface = Color.White)) {
                WardApp()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        ReminderWorker.checkNow(this)
    }
}

private sealed class Screen {
    object Login : Screen()
    object Home : Screen()
    data class Task(val task: JSONObject, val shares: List<JSONObject>) : Screen()
    object Messages : Screen()
    data class Notifications(val data: JSONObject) : Screen()
    object Progress : Screen()
}

private fun depth(s: Screen) = when (s) {
    is Screen.Login -> 0
    is Screen.Home -> 1
    else -> 2
}

@Composable
private fun WardApp() {
    val ctx = LocalContext.current
    var screen by remember { mutableStateOf<Screen>(if (Store.token(ctx) == null) Screen.Login else Screen.Home) }
    var homeKey by remember { mutableIntStateOf(0) }
    // Home data is kept here, so going back to Home shows it instantly while it refreshes in the background.
    var homeData by remember { mutableStateOf<JSONObject?>(null) }

    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            ReminderWorker.checkNow(ctx)
        }
    }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    val logout = {
        Push.unregister(ctx)
        Store.clear(ctx)
        homeData = null
        screen = Screen.Login
    }
    val goHome = { homeKey++; screen = Screen.Home }

    Surface(Modifier.fillMaxSize(), color = Ground) {
        AnimatedContent(
            targetState = screen,
            transitionSpec = {
                if (depth(targetState) >= depth(initialState)) {
                    (slideInHorizontally(tween(280)) { it / 4 } + fadeIn(tween(280))) togetherWith fadeOut(tween(160))
                } else {
                    fadeIn(tween(220)) togetherWith (slideOutHorizontally(tween(260)) { it / 4 } + fadeOut(tween(220)))
                }
            },
            contentKey = { it::class },
            label = "screen",
        ) { s ->
            when (s) {
                is Screen.Login -> LoginScreen(onDone = {
                    screen = Screen.Home
                    ReminderWorker.checkNow(ctx)
                    Push.register(ctx)
                })
                is Screen.Home -> HomeScreen(
                    cached = homeData,
                    onData = { homeData = it },
                    refreshKey = homeKey,
                    onTask = { t, shares -> screen = Screen.Task(t, shares) },
                    onMessages = { screen = Screen.Messages },
                    onNotifications = { screen = Screen.Notifications(it) },
                    onProgress = { screen = Screen.Progress },
                    onLogout = logout,
                )
                is Screen.Task -> TaskScreen(s.task, s.shares, onBack = goHome, onLogout = logout)
                is Screen.Messages -> MessagesScreen(onBack = goHome)
                is Screen.Notifications -> NotificationsScreen(
                    data = s.data,
                    onBack = goHome,
                    onMessages = { screen = Screen.Messages },
                )
                is Screen.Progress -> ProgressScreen(data = homeData, onBack = goHome)
            }
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

private fun fmtNum(n: Int): String = NumberFormat.getIntegerInstance(Locale("en", "IN")).format(n)

private fun JSONObject.str(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

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
            Text(APP_NAME, color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
            Text("दिल्ली प्रदेश कांग्रेस कमेटी", color = Color(0xFFC9D2E3), fontSize = 14.sp, fontWeight = FontWeight.Medium)
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
                    val district = (m.optString("district").takeIf { it.isNotBlank() && it != "null" }
                        ?: m.optString("zone").takeIf { it.isNotBlank() && it != "null" })
                    if (district != null) ProfileField("ज़िला (District)", district)
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
private fun HomeScreen(
    cached: JSONObject?,
    onData: (JSONObject) -> Unit,
    refreshKey: Int,
    onTask: (JSONObject, List<JSONObject>) -> Unit,
    onMessages: () -> Unit,
    onNotifications: (JSONObject) -> Unit,
    onProgress: () -> Unit,
    onLogout: () -> Unit,
) {
    val ctx = LocalContext.current
    var date by remember { mutableStateOf(cached?.str("date")) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(false) }

    LaunchedEffect(date, refreshKey, reload) {
        error = null
        loading = true
        try {
            val p = JSONObject(); date?.let { p.put("date", it) }
            onData(Api.call(ctx, "home", p))
        } catch (e: ApiError) {
            if (e.code == "unauthorized") onLogout() else error = "डेटा लोड नहीं हुआ।"
        } catch (e: Exception) {
            error = "इंटरनेट चेक करें।"
        }
        loading = false
    }

    val d = cached
    if (d == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (error != null) Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(error!!, color = OrangeText)
                TextButton(onClick = { reload++ }) { Text("फिर कोशिश करें") }
            } else CircularProgressIndicator()
        }
        return
    }

    val update = d.optJSONObject("app_update")
    val serverVersionCode = update?.optInt("version_code", 1) ?: 1
    val isMandatory = update?.optBoolean("mandatory", false) ?: false
    val downloadUrl = update?.optString("download_url").orEmpty().ifBlank { "https://github.com/amandangi26/ward-sadasya/releases/latest" }
    val updateNotes = update?.optString("notes").orEmpty().ifBlank { "नया वर्शन उपलब्ध है।" }
    val versionName = update?.optString("version_name").orEmpty().ifBlank { "" }
    val isUpdateAvailable = serverVersionCode > BuildConfig.VERSION_CODE
    var showUpdateDialog by remember { mutableStateOf(true) }

    if (isUpdateAvailable && showUpdateDialog) {
        AlertDialog(
            onDismissRequest = { if (!isMandatory) showUpdateDialog = false },
            title = { Text("🚀 नया अपडेट उपलब्ध है!", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (versionName.isNotBlank()) {
                        Text("वर्शन $versionName (Build $serverVersionCode)", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Blue)
                    }
                    Text(updateNotes, fontSize = 14.sp, color = Ink, lineHeight = 20.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "पुराना ऐप हटाने (uninstall) की ज़रूरत नहीं है। 'अभी अपडेट करें' पर दबाकर डाउनलोड करें और सीधे इंस्टॉल करें।",
                        fontSize = 12.sp, color = Muted, lineHeight = 17.sp,
                    )
                }
            },
            confirmButton = {
                Button(onClick = { openLink(ctx, downloadUrl) }, colors = ButtonDefaults.buttonColors(containerColor = Blue)) {
                    Text("अभी अपडेट करें", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = if (!isMandatory) {
                { TextButton(onClick = { showUpdateDialog = false }) { Text("बाद में", color = Muted) } }
            } else null,
        )
    }

    val member = d.getJSONObject("member")
    val stats = d.optJSONObject("stats") ?: JSONObject()
    val allTasks = remember(d) { d.optJSONArray("tasks")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList() }
    val uploadTasks = remember(allTasks) { allTasks.filter { it.optString("kind") == "upload" } }
    val shareTasks = remember(allTasks) { allTasks.filter { it.optString("kind") == "share" } }
    val doneCount = uploadTasks.count { it.optBoolean("done") }
    val today = d.optString("today")
    val selected = d.optString("date")
    val days = remember(d) { d.optJSONArray("days")?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: emptyList() }
    val announcements = d.optJSONArray("announcements") ?: JSONArray()
    val leaderMsg = d.optJSONObject("leader")
    val hasUnread = isUpdateAvailable || (leaderMsg != null && !leaderMsg.optBoolean("seen")) || announcements.length() > 0

    Scaffold(
        containerColor = Ground,
        bottomBar = {
            BottomBar(
                selected = "home",
                unread = hasUnread,
                onHome = { reload++ },
                onMessages = onMessages,
                onNotifications = { onNotifications(d) },
                onProgress = onProgress,
            )
        },
    ) { inner ->
        Column(Modifier.fillMaxSize().padding(inner)) {
            // Header
            Column(Modifier.fillMaxWidth().background(Navy).padding(start = 20.dp, end = 8.dp, top = 16.dp, bottom = 16.dp)) {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text("नमस्ते, ${member.optString("name")} जी", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        val district = member.str("district") ?: member.str("zone")
                        Text(
                            "वार्ड ${member.optInt("ward_no")}" + (district?.let { " · ज़िला $it" } ?: ""),
                            color = Color(0xFFC9D2E3), fontSize = 14.sp,
                        )
                    }
                    IconButton(onClick = { reload++ }) { Icon(Icons.Filled.Refresh, "रीफ्रेश", tint = Color.White) }
                    IconButton(onClick = onLogout) { Icon(Icons.Filled.Logout, "नंबर बदलें", tint = Color.White) }
                }
                // Points strip
                Row(
                    Modifier.padding(top = 12.dp, end = 12.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(NavySoft)
                        .clickable { onProgress() }.padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.Star, null, tint = Gold, modifier = Modifier.size(22.dp))
                    Text(
                        " ${fmtNum(stats.optInt("points"))} अंक",
                        color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f),
                    )
                    Text(
                        "${stats.optInt("tasks_done")} काम · ${stats.optInt("videos")} वीडियो",
                        color = Color(0xFFC9D2E3), fontSize = 13.sp,
                    )
                }
                if (uploadTasks.isNotEmpty()) {
                    Column(Modifier.padding(top = 10.dp, end = 12.dp).fillMaxWidth()) {
                        Row {
                            Text("आज के काम", color = Color(0xFFC9D2E3), fontSize = 13.sp, modifier = Modifier.weight(1f))
                            Text("${uploadTasks.size} में से $doneCount पूरा", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                        LinearProgressIndicator(
                            progress = { doneCount.toFloat() / uploadTasks.size },
                            modifier = Modifier.padding(top = 6.dp).fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                            color = Gold, trackColor = Color(0xFF33415F),
                        )
                    }
                }
            }
            AnimatedVisibility(visible = loading) {
                LinearProgressIndicator(Modifier.fillMaxWidth().height(2.dp), color = Gold, trackColor = Color.Transparent)
            }

            LazyColumn(
                state = rememberLazyListState(),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (isUpdateAvailable) item(key = "update") {
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0xFFEFF6FF))
                            .border(1.dp, Color(0xFFBFDBFE), RoundedCornerShape(12.dp)).padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("⚡ नया अपडेट उपलब्ध है${if (versionName.isNotBlank()) " (v$versionName)" else ""}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Blue)
                            Text("बेहतर परफॉर्मेंस व नए फीचर्स के लिए अपडेट करें", fontSize = 12.sp, color = Muted)
                        }
                        Button(
                            onClick = { openLink(ctx, downloadUrl) },
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Blue),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.height(36.dp),
                        ) { Text("अपडेट करें", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                    }
                }

                if (days.isNotEmpty()) item(key = "days") {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(days, key = { it }) { day ->
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

                leaderMsg?.let { msg ->
                    item(key = "leader") {
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
                }

                item(key = "title") {
                    Text("आज के काम", fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                }
                if (uploadTasks.isEmpty() && shareTasks.isEmpty()) item(key = "empty") {
                    Text("इस दिन के लिए अभी कोई काम नहीं है।", color = Muted, fontSize = 14.sp)
                }
                items(uploadTasks, key = { "t" + it.optLong("id") }) { t -> TaskCard(t) { onTask(t, shareTasks) } }

                if (shareTasks.isNotEmpty()) item(key = "share-title") {
                    Text("सोशल मीडिया पर शेयर करें", fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                }
                items(shareTasks, key = { "s" + it.optLong("id") }) { t -> ShareCard(t) }

                d.optJSONObject("social")?.let { social ->
                    item(key = "social") { LeaderSocialRow(social) }
                }
                item(key = "footer") { AppFooter(helpline = d.str("helpline")) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BottomBar(
    selected: String,
    unread: Boolean,
    onHome: () -> Unit,
    onMessages: () -> Unit,
    onNotifications: () -> Unit,
    onProgress: () -> Unit,
) {
    NavigationBar(containerColor = Color.White, tonalElevation = 6.dp) {
        val colors = NavigationBarItemDefaults.colors(
            selectedIconColor = Blue, selectedTextColor = Blue, indicatorColor = Color(0xFFE3ECFA),
            unselectedIconColor = Muted, unselectedTextColor = Muted,
        )
        NavigationBarItem(selected = selected == "home", onClick = onHome, colors = colors,
            icon = { Icon(Icons.Filled.Home, null) }, label = { Text("होम", fontSize = 12.sp) })
        NavigationBarItem(selected = selected == "messages", onClick = onMessages, colors = colors,
            icon = { Icon(Icons.Filled.PlayCircle, null) }, label = { Text("संदेश", fontSize = 12.sp) })
        NavigationBarItem(selected = selected == "notifications", onClick = onNotifications, colors = colors,
            icon = {
                BadgedBox(badge = { if (unread) Badge(containerColor = Color(0xFFEF4444)) }) {
                    Icon(Icons.Filled.Notifications, null)
                }
            },
            label = { Text("सूचनाएं", fontSize = 12.sp) })
        NavigationBarItem(selected = selected == "progress", onClick = onProgress, colors = colors,
            icon = { Icon(Icons.Filled.EmojiEvents, null) }, label = { Text("मेरे अंक", fontSize = 12.sp) })
    }
}

@Composable
private fun AppFooter(helpline: String?) {
    val ctx = LocalContext.current
    Column(
        Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        HorizontalDivider(color = Line, modifier = Modifier.padding(bottom = 8.dp))
        Image(
            painterResource(R.drawable.logo), contentDescription = null,
            modifier = Modifier.size(32.dp).clip(CircleShape).background(Color.White), contentScale = ContentScale.Fit,
        )
        Text(APP_NAME, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text("दिल्ली प्रदेश कांग्रेस कमेटी", fontSize = 12.sp, color = Muted)
        helpline?.let { h ->
            Text("हेल्पलाइन: $h", fontSize = 12.sp, color = Blue, modifier = Modifier.clickable { openLink(ctx, "tel:$h") }.padding(4.dp))
        }
        Text("वर्शन ${BuildConfig.VERSION_NAME}", fontSize = 11.sp, color = Color(0xFF8A919E))
    }
}

@Composable
private fun LeaderSocialRow(social: JSONObject) {
    val ctx = LocalContext.current
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
            .border(1.dp, Line, RoundedCornerShape(14.dp)).padding(14.dp),
    ) {
        Text("देवेन्द्र यादव जी को फॉलो करें", fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(Triple("Facebook", "facebook", FbBlue), Triple("X", "x", Ink), Triple("Instagram", "instagram", IgPink)).forEach { (label, key, color) ->
                val url = social.str(key)
                if (url != null) {
                    Button(
                        onClick = { Social.open(ctx, key, url) },
                        colors = ButtonDefaults.buttonColors(containerColor = color),
                        contentPadding = PaddingValues(horizontal = 6.dp),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f).height(42.dp),
                    ) { Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold) }
                }
            }
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
                if (!done) Text("  · +100 अंक", fontSize = 12.sp, color = OrangeText, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

private data class ShareBtn(val label: String, val platform: String, val url: String, val action: String, val color: Color)

private val FbBlue = Color(0xFF1877F2)
private val IgPink = Color(0xFFC13584)
private val WaGreen = Color(0xFF128C7E)

/** Retweet / like / share buttons for one share card. Each first tap per platform earns 10 points. */
@Composable
private fun SharePanel(t: JSONObject) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val taskId = t.optLong("id")
    var shared by remember(taskId) {
        mutableStateOf(t.optJSONArray("shared")?.let { a -> (0 until a.length()).map { a.getString(it) }.toSet() } ?: emptySet())
    }
    val x = t.str("link_x")
    val fb = t.str("link_facebook")
    val ig = t.str("link_instagram")
    val wa = t.str("link_whatsapp")

    val buttons = buildList {
        if (x != null) {
            if (Social.tweetId(x) != null) {
                add(ShareBtn("रीट्वीट", "x", x, "retweet", Ink))
                add(ShareBtn("लाइक", "x", x, "like", Color(0xFF3B4250)))
            } else add(ShareBtn("X पर देखें", "x", x, "open", Ink))
        }
        if (fb != null) add(ShareBtn("Facebook", "facebook", fb, "open", FbBlue))
        if (ig != null) add(ShareBtn("Instagram", "instagram", ig, "open", IgPink))
        if (wa != null) add(ShareBtn("WhatsApp", "whatsapp", wa, "share", WaGreen))
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        buttons.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { b ->
                    val isDone = b.platform in shared
                    Button(
                        onClick = {
                            Social.open(ctx, b.platform, b.url, b.action)
                            scope.launch {
                                try {
                                    val r = Api.call(ctx, "share", JSONObject().put("task_id", taskId).put("platform", b.platform).put("share_action", b.action))
                                    if (r.optInt("earned") > 0) Toast.makeText(ctx, "+${r.optInt("earned")} अंक मिले", Toast.LENGTH_SHORT).show()
                                    shared = shared + b.platform
                                } catch (e: Exception) {
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = b.color),
                        contentPadding = PaddingValues(horizontal = 4.dp),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f).height(44.dp),
                    ) {
                        if (isDone) Icon(Icons.Filled.Check, null, modifier = Modifier.size(16.dp))
                        Text((if (isDone) " " else "") + b.label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                    }
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun ShareCard(t: JSONObject) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
            .border(1.dp, Line, RoundedCornerShape(14.dp)).padding(14.dp).animateContentSize(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(34.dp).clip(CircleShape).background(Color(0xFFFEF3C7)), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Campaign, null, tint = Color(0xFFD97706), modifier = Modifier.size(18.dp))
            }
            Column(Modifier.padding(start = 10.dp).weight(1f)) {
                Text(t.optString("title"), fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(t.str("description") ?: "देखें, लाइक करें और अपने अकाउंट से शेयर करें · हर शेयर पर +10 अंक", fontSize = 12.sp, color = Muted)
            }
        }
        Spacer(Modifier.height(6.dp))
        SharePanel(t)
    }
}

// ---------------------------------------------------------------- Task + uploads

@Composable
private fun TaskScreen(initial: JSONObject, shareTasks: List<JSONObject>, onBack: () -> Unit, onLogout: () -> Unit) {
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
    var showSuccessDialog by remember { mutableStateOf(false) }
    var earned by remember { mutableIntStateOf(0) }
    var totalPoints by remember { mutableIntStateOf(-1) }
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
                val detail = e.body.optString("detail", "")
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

        // Tick / Submit
        Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (videos == 0) {
                Text("कम से कम 1 वीडियो अपलोड होने के बाद ही जमा कर सकते हैं", fontSize = 13.sp, color = OrangeText)
                Spacer(Modifier.height(8.dp))
            }
            Button(
                onClick = {
                    submitting = true
                    scope.launch {
                        try {
                            val r = Api.call(ctx, "complete", JSONObject().put("task_id", taskId))
                            earned = r.optInt("earned")
                            totalPoints = r.optJSONObject("stats")?.optInt("points", -1) ?: -1
                            done = true
                            showSuccessDialog = true
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
                if (submitting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp), strokeWidth = 2.5.dp)
                    Spacer(Modifier.width(10.dp))
                    Text("जमा हो रहा है…", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                } else {
                    Icon(Icons.Filled.Check, null)
                    Text(if (done) "  अपडेट सुरक्षित करें" else "  टिक करें और जमा करें", fontSize = 17.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    if (showSuccessDialog) {
        AlertDialog(
            onDismissRequest = {
                showSuccessDialog = false
                onBack()
            },
            icon = {
                Box(
                    modifier = Modifier.size(60.dp).clip(CircleShape).background(Color(0xFFE8F5E9)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Filled.CheckCircle,
                        contentDescription = null,
                        tint = Green,
                        modifier = Modifier.size(40.dp)
                    )
                }
            },
            title = {
                Text(
                    text = "काम सफलतापूर्वक जमा हुआ! 🎉",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth().heightIn(max = 460.dp).verticalScroll(rememberScrollState()),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "आपका काम और वीडियो सफलतापूर्वक रिकॉर्ड कर लिया गया है। धन्यवाद!",
                        fontSize = 14.sp,
                        color = Muted,
                        textAlign = TextAlign.Center
                    )
                    if (earned > 0 || totalPoints >= 0) {
                        Row(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color(0xFFFEF3C7)).padding(10.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Filled.Star, null, tint = Gold, modifier = Modifier.size(20.dp))
                            Text(
                                (if (earned > 0) " +$earned अंक मिले" else " अंक") + (if (totalPoints >= 0) " · कुल ${fmtNum(totalPoints)}" else ""),
                                fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFF92400E),
                            )
                        }
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Ground)
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("📹 $videos वीडियो दर्ज", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                        if (photos > 0) {
                            Text("•", color = Muted)
                            Text("📷 $photos फोटो दर्ज", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                        }
                    }
                    if (shareTasks.isNotEmpty()) {
                        HorizontalDivider(color = Line)
                        Text("अब यह कंटेंट शेयर करें (हर शेयर +10 अंक)", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.fillMaxWidth())
                        shareTasks.take(3).forEach { st ->
                            Text(st.optString("title"), fontSize = 13.sp, color = Muted, modifier = Modifier.fillMaxWidth(), maxLines = 2)
                            SharePanel(st)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showSuccessDialog = false
                        onBack()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Green),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text("ठीक है (होम पेज पर जाएं)", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
            },
            shape = RoundedCornerShape(18.dp),
            containerColor = Color.White
        )
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

// ---------------------------------------------------------------- Notifications

@Composable
private fun NotificationsScreen(
    data: JSONObject,
    onBack: () -> Unit,
    onMessages: () -> Unit,
) {
    val ctx = LocalContext.current
    val update = data.optJSONObject("app_update")
    val serverVersionCode = update?.optInt("version_code", 1) ?: 1
    val isUpdateAvailable = serverVersionCode > BuildConfig.VERSION_CODE
    val versionName = update?.optString("version_name").orEmpty().ifBlank { "" }
    val updateNotes = update?.optString("notes").orEmpty().ifBlank { "नया वर्शन उपलब्ध है।" }
    val downloadUrl = update?.optString("download_url").orEmpty().ifBlank { "https://ward-sadasya.vercel.app/download.html" }

    val announcements = data.optJSONArray("announcements") ?: JSONArray()
    val leader = data.optJSONObject("leader")
    val tasks = data.optJSONArray("tasks") ?: JSONArray()
    val pendingUploads = (0 until tasks.length())
        .map { tasks.getJSONObject(it) }
        .filter { it.optString("kind") == "upload" && !it.optBoolean("done") }

    Column(Modifier.fillMaxSize().background(Ground)) {
        // Top App Bar
        Row(
            Modifier.fillMaxWidth().background(Navy).padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "वापस", tint = Color.White)
            }
            Text("महत्वपूर्ण सूचनाएं", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }

        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // 1. App Update Card (if available)
            if (isUpdateAvailable) {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFEFF6FF))
                        .border(1.5.dp, Blue, RoundedCornerShape(14.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(40.dp).clip(CircleShape).background(Color(0xFFDBEAFE)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Filled.SystemUpdate, null, tint = Blue, modifier = Modifier.size(22.dp))
                        }
                        Column(Modifier.padding(start = 12.dp).weight(1f)) {
                            Text("🚀 नया ऐप अपडेट उपलब्ध है!", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Blue)
                            if (versionName.isNotBlank()) {
                                Text("वर्शन v$versionName (Build $serverVersionCode)", fontSize = 12.sp, color = Muted)
                            }
                        }
                    }
                    Text(updateNotes, fontSize = 13.sp, color = Ink, lineHeight = 19.sp)
                    Button(
                        onClick = { openLink(ctx, downloadUrl) },
                        colors = ButtonDefaults.buttonColors(containerColor = Blue),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                    ) {
                        Text("📲 अभी नया वर्शन डाउनलोड करें", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }
            }

            // 2. Leader Message Notification (if available)
            if (leader != null) {
                val seen = leader.optBoolean("seen")
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
                        .border(1.dp, if (!seen) Color(0xFFF1C9A8) else Line, RoundedCornerShape(14.dp))
                        .clickable { onMessages() }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier.size(42.dp).clip(RoundedCornerShape(10.dp)).background(Orange),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.PlayArrow, null, tint = Color.White)
                    }
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("देवेन्द्र यादव जी का संदेश", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            if (!seen) {
                                Spacer(Modifier.width(6.dp))
                                Box(
                                    Modifier.clip(RoundedCornerShape(4.dp)).background(OrangeBg).padding(horizontal = 6.dp, vertical = 2.dp),
                                ) {
                                    Text("नया", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = OrangeText)
                                }
                            }
                        }
                        Text(leader.optString("title"), fontSize = 13.sp, color = Muted, maxLines = 1)
                    }
                }
            }

            // 3. Announcements
            if (announcements.length() > 0) {
                Text("पार्टी घोषणाएं", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Muted, modifier = Modifier.padding(top = 4.dp))
                for (i in 0 until announcements.length()) {
                    val a = announcements.getJSONObject(i)
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
                            .border(1.dp, Line, RoundedCornerShape(14.dp)).padding(14.dp),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Box(
                            Modifier.size(38.dp).clip(CircleShape).background(Color(0xFFFEF3C7)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Filled.Campaign, null, tint = Color(0xFFD97706), modifier = Modifier.size(20.dp))
                        }
                        Column(Modifier.padding(start = 12.dp).weight(1f)) {
                            Text(a.optString("body"), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink, lineHeight = 20.sp)
                            val createdAt = a.optString("created_at")
                            if (createdAt.isNotBlank()) {
                                Text(
                                    createdAt.take(10),
                                    fontSize = 11.sp,
                                    color = Muted,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                        }
                    }
                }
            }

            // 4. Pending Tasks Reminder
            if (pendingUploads.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
                        .border(1.dp, Color(0xFFFED7AA), RoundedCornerShape(14.dp))
                        .clickable { onBack() }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier.size(38.dp).clip(CircleShape).background(OrangeBg),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.Info, null, tint = Orange, modifier = Modifier.size(20.dp))
                    }
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Text("आज के काम बाकी हैं", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = OrangeText)
                        Text("आपके ${pendingUploads.size} काम बाकी हैं। आज रात 11:59 तक वीडियो अपलोड करें।", fontSize = 12.sp, color = Muted)
                    }
                }
            }

            // If completely empty
            if (!isUpdateAvailable && leader == null && announcements.length() == 0 && pendingUploads.isEmpty()) {
                Box(
                    Modifier.fillMaxWidth().padding(top = 60.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.Notifications, null, tint = Color(0xFFCBD5E1), modifier = Modifier.size(56.dp))
                        Spacer(Modifier.height(8.dp))
                        Text("अभी कोई नई सूचना नहीं है।", color = Muted, fontSize = 15.sp)
                    }
                }
            }
        }
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

// ---------------------------------------------------------------- Points

@Composable
private fun ProgressScreen(data: JSONObject?, onBack: () -> Unit) {
    BackHandler { onBack() }
    val stats = data?.optJSONObject("stats") ?: JSONObject()
    val rule = data?.optJSONObject("points_rule") ?: JSONObject()
    val perTask = rule.optInt("task", 100)
    val perVideo = rule.optInt("video", 50)
    val perPhoto = rule.optInt("photo", 20)
    val perShare = rule.optInt("share", 10)
    val tasks = stats.optInt("tasks_done")
    val videos = stats.optInt("videos")
    val photos = stats.optInt("photos")
    val shares = stats.optInt("shares")

    Column(Modifier.fillMaxSize().background(Ground)) {
        Row(
            Modifier.fillMaxWidth().background(Navy).padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "वापस", tint = Color.White) }
            Text("मेरे अंक", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Navy).padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(Icons.Filled.EmojiEvents, null, tint = Gold, modifier = Modifier.size(40.dp))
                Text(fmtNum(stats.optInt("points")), color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Bold)
                Text("कुल अंक", color = Color(0xFFC9D2E3), fontSize = 14.sp)
            }
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
                    .border(1.dp, Line, RoundedCornerShape(14.dp)).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("अंक कैसे बने", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                PointsRow("पूरे किए काम", tasks, perTask)
                PointsRow("अपलोड किए वीडियो", videos, perVideo)
                PointsRow("अपलोड की फोटो", photos, perPhoto)
                PointsRow("सोशल मीडिया शेयर", shares, perShare)
            }
            Text(
                "हर काम पूरा करने पर $perTask अंक, हर वीडियो पर $perVideo, हर फोटो पर $perPhoto और हर शेयर पर $perShare अंक मिलते हैं।",
                fontSize = 13.sp, color = Muted, lineHeight = 19.sp,
            )
            AppFooter(helpline = data?.str("helpline"))
        }
    }
}

@Composable
private fun PointsRow(label: String, count: Int, each: Int) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, fontSize = 14.sp, color = Ink, modifier = Modifier.weight(1f))
        Text("$count × $each", fontSize = 13.sp, color = Muted)
        Text(fmtNum(count * each), fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.widthIn(min = 64.dp), textAlign = TextAlign.End)
    }
}
