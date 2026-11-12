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
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale

const val APP_NAME = "INC MCD NETWORK"

private val Navy = Color(0xFF0E1B3D)
private val NavySoft = Color(0xFF172A59)
private val Blue = Color(0xFF2463D1)
private val Orange = Color(0xFFF2852B)
private val OrangeBg = Color(0xFFFFF1E4)
private val OrangeText = Color(0xFF9A4A0B)
private val Green = Color(0xFF12884A)
private val GreenBg = Color(0xFFE6F5EC)
private val GreenText = Color(0xFF14613A)
private val Ground = Color(0xFFF2F4F8)
private val Line = Color(0xFFE3E7EF)
private val Muted = Color(0xFF6B7590)
private val Ink = Color(0xFF141C33)
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
    is Screen.Home, is Screen.Messages, is Screen.Notifications, is Screen.Progress -> 1
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
    val nav = Nav(
        home = goHome,
        messages = { screen = Screen.Messages },
        notifications = { homeData?.let { screen = Screen.Notifications(it) } },
        progress = { screen = Screen.Progress },
        unread = homeData?.let { hasUnread(it) } ?: false,
    )

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
                    nav = nav,
                    onTask = { t, shares -> screen = Screen.Task(t, shares) },
                    onLogout = logout,
                )
                is Screen.Task -> TaskScreen(s.task, s.shares, onBack = goHome, onLogout = logout)
                is Screen.Messages -> MessagesScreen(nav = nav, helpline = homeData?.str("helpline"))
                is Screen.Notifications -> NotificationsScreen(data = homeData ?: s.data, nav = nav)
                is Screen.Progress -> ProgressScreen(data = homeData, onData = { homeData = it }, nav = nav)
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


// ---------------------------------------------------------------- Shared bits

private val HI_MONTHS = listOf("जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर")
private val HI_WEEKDAYS = listOf("रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि")

private fun parseYmd(s: String): Calendar? {
    val p = s.take(10).split("-")
    if (p.size != 3) return null
    return try {
        Calendar.getInstance().apply { clear(); set(p[0].toInt(), p[1].toInt() - 1, p[2].toInt()) }
    } catch (e: Exception) { null }
}

private fun ymd(c: Calendar) =
    String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))

/** "2026-11-12" or an ISO timestamp -> "12 नवंबर 2026". */
private fun hiDate(s: String?): String {
    val c = s?.let { parseYmd(it) } ?: return ""
    return "${c.get(Calendar.DAY_OF_MONTH)} ${HI_MONTHS[c.get(Calendar.MONTH)]} ${c.get(Calendar.YEAR)}"
}

/** Continuous run of dates for the strip: back to the first task day (max 30 days), forward 6 days. */
private fun stripDays(today: String, taskDays: List<String>): List<String> {
    val t = parseYmd(today) ?: return taskDays
    var back = 6
    taskDays.minOrNull()?.takeIf { it < today }?.let { first ->
        parseYmd(first)?.let { f ->
            val diff = ((t.timeInMillis - f.timeInMillis) / 86_400_000L).toInt()
            back = maxOf(back, minOf(diff, 30))
        }
    }
    return (-back..6).map { i -> ymd((t.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, i) }) }
}

/** True when something in Notifications is new for this member. */
private fun hasUnread(d: JSONObject): Boolean {
    val update = d.optJSONObject("app_update")
    val updateAvailable = (update?.optInt("version_code", 1) ?: 1) > BuildConfig.VERSION_CODE
    val leader = d.optJSONObject("leader")
    val announcements = d.optJSONArray("announcements")?.length() ?: 0
    return updateAvailable || (leader != null && !leader.optBoolean("seen")) || announcements > 0
}

/** Bottom tabs. Shown on Home, Messages, Notifications and Points. */
private class Nav(
    val home: () -> Unit,
    val messages: () -> Unit,
    val notifications: () -> Unit,
    val progress: () -> Unit,
    val unread: Boolean,
)

/** Navy page header with a back arrow, used on every screen except Home. */
@Composable
private fun PageTop(title: String, onBack: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Navy).padding(start = 10.dp, end = 16.dp, top = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x1FFFFFFF)).clickable { onBack() },
            contentAlignment = Alignment.Center,
        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "वापस", tint = Color.White, modifier = Modifier.size(20.dp)) }
        Text(title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 12.dp))
    }
}

@Composable
private fun SectionTitle(text: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Row(modifier.fillMaxWidth().padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = Ink, modifier = Modifier.weight(1f))
        action?.invoke()
    }
}

/** Small photo of Devender Yadav ji cut from the home banner, with a play button. */
@Composable
private fun LeaderThumb(size: Int, playSize: Int = 34) {
    Box(Modifier.size(size.dp).clip(RoundedCornerShape(14.dp)).background(Navy), contentAlignment = Alignment.Center) {
        Image(
            painterResource(R.drawable.home_banner), contentDescription = null,
            modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = BiasAlignment(0.62f, -0.55f),
        )
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color(0x990E1B3D)))))
        Box(Modifier.size(playSize.dp).clip(CircleShape).background(Orange), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.PlayArrow, null, tint = Color.White, modifier = Modifier.size((playSize * 0.6f).dp))
        }
    }
}

@Composable
private fun CardBox(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White).border(1.dp, Line, RoundedCornerShape(20.dp)),
        content = content,
    )
}

@Composable
private fun IconTile(icon: ImageVector, bg: Color, fg: Color, size: Int = 42) {
    Box(Modifier.size(size.dp).clip(RoundedCornerShape(13.dp)).background(bg), contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = fg, modifier = Modifier.size((size * 0.5f).dp))
    }
}

// ---------------------------------------------------------------- Home

@Composable
private fun HomeScreen(
    cached: JSONObject?,
    onData: (JSONObject) -> Unit,
    refreshKey: Int,
    nav: Nav,
    onTask: (JSONObject, List<JSONObject>) -> Unit,
    onLogout: () -> Unit,
) {
    val ctx = LocalContext.current
    var date by remember { mutableStateOf(cached?.str("date")) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(false) }
    var lastBack by remember { mutableLongStateOf(0L) }

    // Home is the root screen: the first back press warns, a second one within 2 seconds closes the app.
    BackHandler {
        val now = System.currentTimeMillis()
        if (now - lastBack < 2000) (ctx as? Activity)?.finish()
        else {
            lastBack = now
            Toast.makeText(ctx, "ऐप बंद करने के लिए फिर से वापस दबाएं", Toast.LENGTH_SHORT).show()
        }
    }

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
            } else CircularProgressIndicator(color = Orange)
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
            title = { Text("नया अपडेट उपलब्ध है", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
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
                Button(onClick = { openLink(ctx, downloadUrl) }, colors = ButtonDefaults.buttonColors(containerColor = Navy)) {
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
    val rule = d.optJSONObject("points_rule") ?: JSONObject()
    val allTasks = remember(d) { d.optJSONArray("tasks")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList() }
    val uploadTasks = remember(allTasks) { allTasks.filter { it.optString("kind") == "upload" } }
    val shareTasks = remember(allTasks) { allTasks.filter { it.optString("kind") == "share" } }
    val doneCount = uploadTasks.count { it.optBoolean("done") }
    val today = d.optString("today")
    val selected = d.optString("date")
    val taskDays = remember(d) { d.optJSONArray("days")?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: emptyList() }
    val days = remember(today, taskDays) { stripDays(today, taskDays) }
    val leaderMsg = d.optJSONObject("leader")
    val district = member.str("district") ?: member.str("zone")

    Scaffold(
        containerColor = Ground,
        bottomBar = { BottomBar(selected = "home", nav = nav.copyWithHome { reload++ }) },
    ) { inner ->
        LazyColumn(
            state = rememberLazyListState(),
            modifier = Modifier.fillMaxSize().padding(inner),
            contentPadding = PaddingValues(bottom = 8.dp),
        ) {
            // Banner with greeting, and the points card overlapping its bottom edge
            item(key = "hero") {
                Box(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth()) {
                        Box(Modifier.fillMaxWidth().background(Navy)) {
                            Image(
                                painterResource(R.drawable.home_banner), contentDescription = "देवेन्द्र यादव जी",
                                modifier = Modifier.fillMaxWidth(), contentScale = ContentScale.FillWidth,
                            )
                            Box(
                                Modifier.matchParentSize().background(
                                    Brush.verticalGradient(0f to Color.Transparent, 0.62f to Color.Transparent, 1f to Navy),
                                ),
                            )
                            Row(
                                Modifier.fillMaxWidth().padding(start = 18.dp, end = 12.dp, top = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    Modifier.size(width = 18.dp, height = 12.dp).clip(RoundedCornerShape(2.dp))
                                        .background(Brush.verticalGradient(0f to Orange, 0.33f to Orange, 0.33f to Color.White, 0.66f to Color.White, 0.66f to Green, 1f to Green)),
                                )
                                Text(APP_NAME, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp,
                                    modifier = Modifier.padding(start = 8.dp).weight(1f))
                                GlassButton(Icons.Filled.Refresh, "रीफ्रेश") { reload++ }
                                Spacer(Modifier.width(8.dp))
                                GlassButton(Icons.AutoMirrored.Filled.Logout, "नंबर बदलें", onLogout)
                            }
                            Column(Modifier.align(Alignment.TopStart).fillMaxWidth(0.52f).padding(start = 18.dp, top = 58.dp)) {
                                Text("नमस्ते,", color = Color(0xFFAFC0E3), fontSize = 13.sp)
                                Text("${member.optString("name")} जी", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 29.sp)
                                Row(
                                    Modifier.padding(top = 6.dp).clip(RoundedCornerShape(50)).background(Color(0x1FFFFFFF))
                                        .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(50)).padding(horizontal = 9.dp, vertical = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icon(Icons.Filled.LocationOn, null, tint = Color(0xFFE2E9F8), modifier = Modifier.size(13.dp))
                                    Text(
                                        " वार्ड ${member.optInt("ward_no")}" + (district?.let { " · $it" } ?: ""),
                                        color = Color(0xFFE2E9F8), fontSize = 12.sp, maxLines = 1,
                                    )
                                }
                            }
                            if (loading) LinearProgressIndicator(
                                Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(2.dp),
                                color = Orange, trackColor = Color.Transparent,
                            )
                        }
                        Spacer(Modifier.height(36.dp))
                    }
                    Row(
                        Modifier.align(Alignment.BottomCenter).padding(horizontal = 14.dp).fillMaxWidth()
                            .shadow(10.dp, RoundedCornerShape(18.dp), spotColor = Color(0x330E1B3D))
                            .clip(RoundedCornerShape(18.dp)).background(Color.White)
                            .clickable { nav.progress() }.padding(vertical = 12.dp),
                    ) {
                        StatCell(fmtNum(stats.optInt("points")), "कुल अंक", Orange, Modifier.weight(1f))
                        Box(Modifier.width(1.dp).height(40.dp).background(Line).align(Alignment.CenterVertically))
                        StatCell(fmtNum(stats.optInt("tasks_done")), "टास्क पूरे", Ink, Modifier.weight(1f))
                        Box(Modifier.width(1.dp).height(40.dp).background(Line).align(Alignment.CenterVertically))
                        StatCell(fmtNum(stats.optInt("videos")), "वीडियो", Ink, Modifier.weight(1f))
                    }
                }
            }

            if (isUpdateAvailable) item(key = "update") {
                Row(
                    Modifier.padding(start = 16.dp, end = 16.dp, top = 18.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFEFF4FF)).border(1.dp, Color(0xFFC9D8F5), RoundedCornerShape(14.dp)).padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("नया अपडेट उपलब्ध है${if (versionName.isNotBlank()) " (v$versionName)" else ""}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Navy)
                        Text("बेहतर परफॉर्मेंस व नए फीचर्स के लिए अपडेट करें", fontSize = 12.sp, color = Muted)
                    }
                    Button(
                        onClick = { openLink(ctx, downloadUrl) },
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Navy),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.height(36.dp),
                    ) { Text("अपडेट करें", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                }
            }

            // Date strip
            item(key = "days") {
                Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 22.dp)) {
                    SectionTitle("टास्क कैलेंडर") {
                        if (selected != today) Text("आज", color = Blue, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                            modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { date = today }.padding(horizontal = 6.dp, vertical = 2.dp))
                    }
                    val startIdx = days.indexOf(selected).coerceAtLeast(0)
                    val rowState = rememberLazyListState(initialFirstVisibleItemIndex = (startIdx - 2).coerceAtLeast(0))
                    LazyRow(state = rowState, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        items(days, key = { it }) { day ->
                            DateChip(day, isToday = day == today, isSelected = day == selected, isFuture = day > today, hasTasks = day in taskDays) {
                                date = day
                            }
                        }
                    }
                    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Lock, null, tint = Muted, modifier = Modifier.size(13.dp))
                        Text("  आने वाली तारीखें उसी दिन खुलेंगी।", fontSize = 12.5.sp, color = Muted)
                    }
                }
            }

            // President's message
            leaderMsg?.let { msg ->
                item(key = "leader") {
                    Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 26.dp)) {
                        SectionTitle("अध्यक्ष जी का संदेश")
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White)
                                .border(1.dp, Line, RoundedCornerShape(20.dp)).clickable { nav.messages() }.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LeaderThumb(92)
                            Column(Modifier.padding(start = 14.dp).weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("माननीय DPCC अध्यक्ष", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = OrangeText,
                                        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(OrangeBg).padding(horizontal = 7.dp, vertical = 1.dp))
                                    if (!msg.optBoolean("seen")) Text("  नया", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFE5402F))
                                }
                                Text(msg.optString("title"), fontSize = 15.5.sp, fontWeight = FontWeight.Bold, color = Ink, lineHeight = 21.sp,
                                    maxLines = 3, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 5.dp))
                                Text("${hiDate(msg.str("published_at"))} · देखने के लिए टैप करें", fontSize = 12.5.sp, color = Muted,
                                    modifier = Modifier.padding(top = 3.dp))
                            }
                        }
                    }
                }
            }

            // Tasks for the selected day
            item(key = "tasks") {
                Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 26.dp)) {
                    SectionTitle(if (selected == today || selected.isBlank()) "आज के टास्क" else "${hiDate(selected).substringBeforeLast(' ')} के टास्क")
                    CardBox {
                        if (uploadTasks.isEmpty()) {
                            Text("इस दिन के लिए अभी कोई टास्क नहीं है।", color = Muted, fontSize = 14.sp, textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 26.dp, horizontal = 16.dp))
                        } else {
                            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 12.dp)) {
                                Row {
                                    Text("$doneCount / ${uploadTasks.size} टास्क पूरे", fontSize = 13.sp, color = Muted, modifier = Modifier.weight(1f))
                                    Text("${(doneCount * 100) / uploadTasks.size}%", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.Bold)
                                }
                                LinearProgressIndicator(
                                    progress = { doneCount.toFloat() / uploadTasks.size },
                                    modifier = Modifier.padding(top = 8.dp).fillMaxWidth().height(7.dp).clip(RoundedCornerShape(9.dp)),
                                    color = Orange, trackColor = Color(0xFFEDF0F5),
                                )
                            }
                            uploadTasks.forEach { t ->
                                HorizontalDivider(color = Color(0xFFF0F2F6))
                                TaskRow(t, perVideo = rule.optInt("video", 200)) { onTask(t, shareTasks) }
                            }
                        }
                    }
                }
            }

            // Leader's posts for the day, from links the admin added to share cards
            item(key = "social") {
                Column(Modifier.padding(top = 26.dp)) {
                    SectionTitle("देवेन्द्र यादव जी के पोस्ट", Modifier.padding(horizontal = 16.dp))
                    SocialPosts(shareTasks, d.optJSONObject("social"), perShare = rule.optInt("share", 100)) { reload++ }
                }
            }

            item(key = "footer") { AppFooter(helpline = d.str("helpline")) }
        }
    }
}

private fun Nav.copyWithHome(home: () -> Unit) = Nav(home, messages, notifications, progress, unread)

@Composable
private fun GlassButton(icon: ImageVector, label: String, onClick: () -> Unit) {
    Box(
        Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x660E1B3D))
            .border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(12.dp)).clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) { Icon(icon, label, tint = Color.White, modifier = Modifier.size(19.dp)) }
}

@Composable
private fun StatCell(value: String, label: String, color: Color, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = color)
        Text(label, fontSize = 12.sp, color = Muted)
    }
}

@Composable
private fun DateChip(day: String, isToday: Boolean, isSelected: Boolean, isFuture: Boolean, hasTasks: Boolean, onClick: () -> Unit) {
    val c = parseYmd(day)
    val weekday = c?.let { HI_WEEKDAYS[it.get(Calendar.DAY_OF_WEEK) - 1] } ?: ""
    val num = c?.get(Calendar.DAY_OF_MONTH)?.toString() ?: day
    val shape = RoundedCornerShape(16.dp)
    val bg = when { isSelected -> Navy; isFuture -> Color(0xFFEEF0F4); else -> Color.White }
    val borderColor = when { isSelected -> Navy; isToday -> Orange; else -> Line }
    val fg = when { isSelected -> Color.White; isFuture -> Color(0xFFA7AFC0); else -> Ink }
    Column(
        Modifier.size(width = 54.dp, height = 74.dp).clip(shape).background(bg)
            .border(if (isToday && !isSelected) 2.dp else 1.dp, borderColor, shape)
            .clickable(enabled = !isFuture) { onClick() },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
    ) {
        Text(weekday, fontSize = 11.5.sp, color = if (isSelected) Color(0xFFAFC0E3) else if (isFuture) Color(0xFFB3BACA) else Muted)
        Text(num, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = fg)
        Box(Modifier.height(14.dp), contentAlignment = Alignment.Center) {
            when {
                isToday -> Text("आज", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = if (isSelected) Color(0xFFFFB877) else Orange)
                isFuture -> Icon(Icons.Filled.Lock, "बंद", tint = Color(0xFFA7AFC0), modifier = Modifier.size(11.dp))
                hasTasks -> Box(Modifier.size(5.dp).clip(CircleShape).background(if (isSelected) Color(0xFFFFB877) else Orange))
                else -> {}
            }
        }
    }
}

@Composable
private fun TaskRow(t: JSONObject, perVideo: Int, onClick: () -> Unit) {
    val done = t.optBoolean("done")
    val videos = t.optInt("videos")
    val slots = t.optInt("video_slots", 1)
    Row(
        Modifier.fillMaxWidth().clickable { onClick() }.padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (done) IconTile(Icons.Filled.Check, GreenBg, Green) else IconTile(Icons.Filled.Videocam, OrangeBg, Orange)
        Column(Modifier.padding(start = 12.dp, end = 8.dp).weight(1f)) {
            Text(t.optString("title"), fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = Ink, lineHeight = 19.sp,
                maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(Modifier.padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("+$perVideo अंक/वीडियो", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Green, maxLines = 1)
                Text(" · $videos/$slots वीडियो", fontSize = 12.sp, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (done) {
            Row(
                Modifier.clip(RoundedCornerShape(11.dp)).background(GreenBg).padding(horizontal = 11.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Check, null, tint = Green, modifier = Modifier.size(15.dp))
                Text(" पूरा", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = GreenText)
            }
        } else {
            Text(
                "टास्क चेक करें", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1,
                modifier = Modifier.clip(RoundedCornerShape(11.dp)).background(Navy).clickable { onClick() }.padding(horizontal = 11.dp, vertical = 8.dp),
            )
        }
    }
}

private data class Platform(val key: String, val label: String, val color: Color)
private val PLATFORMS = listOf(Platform("facebook", "Facebook", Color(0xFF1877F2)), Platform("x", "X", Color(0xFF111111)), Platform("instagram", "Instagram", Color(0xFFC13584)))

/**
 * Post cards for Facebook, X and Instagram. Each card comes from an admin share card (title, description, links).
 * The first open per post and platform is recorded by the server and earns points.
 */
@Composable
private fun SocialPosts(shareTasks: List<JSONObject>, social: JSONObject?, perShare: Int, onShared: () -> Unit) {
    val ctx = LocalContext.current
    val firstWithPosts = PLATFORMS.firstOrNull { p -> shareTasks.any { it.str("link_${p.key}") != null } }?.key ?: "facebook"
    var platform by remember(shareTasks) { mutableStateOf(firstWithPosts) }
    val p = PLATFORMS.first { it.key == platform }
    val posts = shareTasks.filter { it.str("link_${p.key}") != null }

    Row(
        Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0xFFE7EBF2)).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PLATFORMS.forEach { item ->
            val on = item.key == platform
            Text(
                item.label, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                color = if (on) Ink else Color(0xFF55607A),
                modifier = Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(if (on) Color.White else Color.Transparent)
                    .clickable { platform = item.key }.padding(vertical = 8.dp),
            )
        }
    }
    Spacer(Modifier.height(12.dp))

    if (posts.isEmpty()) {
        Column(
            Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color.White)
                .border(1.dp, Line, RoundedCornerShape(18.dp)).padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("इस दिन ${p.label} की कोई पोस्ट नहीं है।", color = Muted, fontSize = 14.sp, textAlign = TextAlign.Center)
            social?.str(p.key)?.let { url ->
                TextButton(onClick = { Social.open(ctx, p.key, url) }) { Text("${p.label} प्रोफ़ाइल देखें", color = Blue, fontWeight = FontWeight.Bold) }
            }
        }
        return
    }

    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items(posts, key = { p.key + it.optLong("id") }) { t ->
            PostCard(t, p, perShare, Modifier.fillParentMaxWidth(if (posts.size > 1) 0.86f else 1f), onShared)
        }
    }
}

@Composable
private fun PostCard(t: JSONObject, p: Platform, perShare: Int, modifier: Modifier, onShared: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val taskId = t.optLong("id")
    val url = t.str("link_${p.key}") ?: return
    val wa = t.str("link_whatsapp")
    var shared by remember(taskId) {
        mutableStateOf(t.optJSONArray("shared")?.let { a -> (0 until a.length()).map { a.getString(it) }.toSet() } ?: emptySet())
    }

    fun record(platform: String, action: String) {
        scope.launch {
            try {
                val r = Api.call(ctx, "share", JSONObject().put("task_id", taskId).put("platform", platform).put("share_action", action))
                if (r.optInt("earned") > 0) {
                    Toast.makeText(ctx, "+${r.optInt("earned")} अंक मिले", Toast.LENGTH_SHORT).show()
                    onShared()
                }
                shared = shared + platform
            } catch (e: Exception) {
            }
        }
    }

    val isTweet = p.key == "x" && Social.tweetId(url) != null
    Column(modifier.clip(RoundedCornerShape(18.dp)).background(Color.White).border(1.dp, Line, RoundedCornerShape(18.dp))) {
        Row(Modifier.padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(CircleShape).background(Navy)) {
                Image(
                    painterResource(R.drawable.home_banner), contentDescription = null,
                    modifier = Modifier.fillMaxSize().graphicsLayer {
                        scaleX = 2.2f; scaleY = 2.2f
                        transformOrigin = TransformOrigin(0.71f, 0.25f)
                        translationX = (0.5f - 0.71f) * size.width
                        translationY = (0.45f - 0.25f) * size.height
                    },
                    contentScale = ContentScale.Crop, alignment = BiasAlignment(0.55f, -1f),
                )
            }
            Column(Modifier.padding(start = 10.dp).weight(1f)) {
                Text("Devender Yadav", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text("${p.label} पोस्ट", fontSize = 11.5.sp, color = Muted)
            }
            if (p.key in shared) Row(
                Modifier.clip(RoundedCornerShape(50)).background(GreenBg).padding(horizontal = 8.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Check, null, tint = Green, modifier = Modifier.size(13.dp))
                Text(" शेयर किया", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = GreenText)
            } else Text("+$perShare अंक", fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold, color = Green,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(GreenBg).padding(horizontal = 8.dp, vertical = 3.dp))
        }
        Text(t.optString("title"), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink, lineHeight = 20.sp,
            modifier = Modifier.padding(horizontal = 12.dp), maxLines = 3, overflow = TextOverflow.Ellipsis)
        t.str("description")?.let {
            Text(it, fontSize = 13.sp, color = Color(0xFF3A4560), lineHeight = 19.sp, maxLines = 3, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 2.dp))
        }
        // Preview panel: tapping it opens the real post
        Box(
            Modifier.padding(12.dp).fillMaxWidth().height(120.dp).clip(RoundedCornerShape(12.dp))
                .background(Brush.linearGradient(listOf(Navy, NavySoft, p.color.copy(alpha = 0.85f))))
                .clickable { Social.open(ctx, p.key, url); record(p.key, "open") },
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(42.dp).clip(CircleShape).background(Color(0x33FFFFFF)), contentAlignment = Alignment.Center) {
                    Icon(Icons.AutoMirrored.Filled.OpenInNew, null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
                Text("${p.label} पर पोस्ट देखें", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                Text(url.removePrefix("https://").removePrefix("www.").take(38), color = Color(0xFFC9D4EC), fontSize = 11.sp, maxLines = 1)
            }
        }
        Row(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (isTweet) {
                OutlinedButton(
                    onClick = { Social.open(ctx, "x", url, "like"); record("x", "like") },
                    modifier = Modifier.weight(1f).height(42.dp), shape = RoundedCornerShape(11.dp), border = BorderStroke(1.dp, Line),
                    contentPadding = PaddingValues(horizontal = 4.dp),
                ) { Icon(Icons.Filled.ThumbUp, null, tint = Ink, modifier = Modifier.size(16.dp)); Text("  लाइक", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
                Button(
                    onClick = { Social.open(ctx, "x", url, "retweet"); record("x", "retweet") },
                    modifier = Modifier.weight(1f).height(42.dp), shape = RoundedCornerShape(11.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Orange), contentPadding = PaddingValues(horizontal = 4.dp),
                ) { Icon(Icons.Filled.Repeat, null, modifier = Modifier.size(16.dp)); Text("  रीट्वीट", fontSize = 13.sp, fontWeight = FontWeight.Bold) }
            } else {
                OutlinedButton(
                    onClick = { Social.open(ctx, p.key, url); record(p.key, "open") },
                    modifier = Modifier.weight(1f).height(42.dp), shape = RoundedCornerShape(11.dp), border = BorderStroke(1.dp, Line),
                    contentPadding = PaddingValues(horizontal = 4.dp),
                ) { Icon(Icons.AutoMirrored.Filled.OpenInNew, null, tint = Ink, modifier = Modifier.size(16.dp)); Text("  पोस्ट खोलें", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
                Button(
                    onClick = {
                        if (wa != null) { Social.open(ctx, "whatsapp", wa, "share"); record("whatsapp", "share") }
                        else { Social.open(ctx, p.key, url); record(p.key, "open") }
                    },
                    modifier = Modifier.weight(1f).height(42.dp), shape = RoundedCornerShape(11.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Orange), contentPadding = PaddingValues(horizontal = 4.dp),
                ) { Icon(Icons.Filled.Share, null, modifier = Modifier.size(16.dp)); Text(if (wa != null) "  WhatsApp" else "  शेयर करें", fontSize = 13.sp, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BottomBar(selected: String, nav: Nav) {
    NavigationBar(containerColor = Color.White, tonalElevation = 0.dp, modifier = Modifier.border(BorderStroke(1.dp, Line))) {
        val colors = NavigationBarItemDefaults.colors(
            selectedIconColor = Orange, selectedTextColor = Navy, indicatorColor = OrangeBg,
            unselectedIconColor = Color(0xFF7C86A0), unselectedTextColor = Color(0xFF7C86A0),
        )
        NavigationBarItem(selected = selected == "home", onClick = nav.home, colors = colors,
            icon = { Icon(Icons.Filled.Home, null) }, label = { Text("होम", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) })
        NavigationBarItem(selected = selected == "messages", onClick = nav.messages, colors = colors,
            icon = { Icon(Icons.Filled.Videocam, null) }, label = { Text("संदेश", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) })
        NavigationBarItem(selected = selected == "notifications", onClick = nav.notifications, colors = colors,
            icon = {
                BadgedBox(badge = { if (nav.unread) Badge(containerColor = Color(0xFFE5402F)) }) {
                    Icon(Icons.Filled.Notifications, null)
                }
            },
            label = { Text("सूचनाएँ", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) })
        NavigationBarItem(selected = selected == "progress", onClick = nav.progress, colors = colors,
            icon = { Icon(Icons.Filled.EmojiEvents, null) }, label = { Text("मेरे अंक", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) })
    }
}

@Composable
private fun AppFooter(helpline: String?) {
    val ctx = LocalContext.current
    Column(
        Modifier.fillMaxWidth().padding(top = 30.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        HorizontalDivider(color = Line)
        Image(
            painterResource(R.drawable.logo), contentDescription = null,
            modifier = Modifier.padding(top = 24.dp).size(44.dp).clip(CircleShape).background(Color.White).border(1.dp, Line, CircleShape),
            contentScale = ContentScale.Fit,
        )
        Text(APP_NAME, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Ink, letterSpacing = 0.4.sp, modifier = Modifier.padding(top = 8.dp))
        Text("दिल्ली प्रदेश कांग्रेस कमेटी", fontSize = 13.sp, color = Muted)
        Row(
            Modifier.padding(top = 10.dp, bottom = 26.dp).clip(RoundedCornerShape(50)).background(Color.White)
                .border(1.dp, Line, RoundedCornerShape(50))
                .clickable(enabled = helpline != null) { helpline?.let { openLink(ctx, "tel:$it") } }
                .padding(horizontal = 12.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.Phone, null, tint = Muted, modifier = Modifier.size(14.dp))
            Text("  हेल्पलाइन: ${helpline ?: "जल्द उपलब्ध"}", fontSize = 12.5.sp, color = if (helpline != null) Blue else Muted)
        }
    }
}

private data class ShareBtn(val label: String, val platform: String, val url: String, val action: String, val color: Color)

private val FbBlue = Color(0xFF1877F2)
private val IgPink = Color(0xFFC13584)
private val WaGreen = Color(0xFF128C7E)

/** Retweet / like / share buttons for one share card. Each first tap per platform earns points (set on the server). */
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
                    e.code == "not_open_yet" -> Toast.makeText(ctx, "यह टास्क अपनी तारीख पर खुलेगा", Toast.LENGTH_LONG).show()
                    e.code == "limit_reached" -> Toast.makeText(ctx, "इस टास्क के सभी वीडियो जुड़ चुके हैं", Toast.LENGTH_LONG).show()
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
            Text("टास्क", fontSize = 16.sp, fontWeight = FontWeight.Bold)
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
                Chip("$slots वीडियो · +200 अंक/वीडियो", Ground, Color(0xFF3B4250))
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
                    text = "टास्क सफलतापूर्वक जमा हुआ! 🎉",
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
                        text = "आपका टास्क और वीडियो सफलतापूर्वक रिकॉर्ड कर लिया गया है। धन्यवाद!",
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
                        Text("अब यह कंटेंट शेयर करें (हर शेयर +100 अंक)", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.fillMaxWidth())
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
private fun NotificationsScreen(data: JSONObject, nav: Nav) {
    val ctx = LocalContext.current
    BackHandler { nav.home() }
    val update = data.optJSONObject("app_update")
    val serverVersionCode = update?.optInt("version_code", 1) ?: 1
    val isUpdateAvailable = serverVersionCode > BuildConfig.VERSION_CODE
    val versionName = update?.optString("version_name").orEmpty().ifBlank { "" }
    val updateNotes = update?.optString("notes").orEmpty().ifBlank { "नया वर्शन उपलब्ध है।" }
    val downloadUrl = update?.optString("download_url").orEmpty().ifBlank { "https://ward-sadasya.vercel.app/download.html" }

    val announcements = data.optJSONArray("announcements") ?: JSONArray()
    val leader = data.optJSONObject("leader")
    val tasks = data.optJSONArray("tasks") ?: JSONArray()
    val isToday = data.optString("date") == data.optString("today")
    val pendingUploads = if (!isToday) emptyList() else (0 until tasks.length())
        .map { tasks.getJSONObject(it) }
        .filter { it.optString("kind") == "upload" && !it.optBoolean("done") }

    Scaffold(containerColor = Ground, bottomBar = { BottomBar("notifications", nav) }) { inner ->
        Column(Modifier.fillMaxSize().padding(inner)) {
            PageTop("सूचनाएँ", nav.home)
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (isUpdateAvailable) {
                        Column(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFFEFF4FF))
                                .border(1.5.dp, Color(0xFFC9D8F5), RoundedCornerShape(16.dp)).padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconTile(Icons.Filled.SystemUpdate, Color(0xFFDDE7FB), Blue, 40)
                                Column(Modifier.padding(start = 12.dp).weight(1f)) {
                                    Text("नया ऐप अपडेट उपलब्ध है", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Navy)
                                    if (versionName.isNotBlank()) Text("वर्शन v$versionName (Build $serverVersionCode)", fontSize = 12.sp, color = Muted)
                                }
                            }
                            Text(updateNotes, fontSize = 13.sp, color = Ink, lineHeight = 19.sp)
                            Button(
                                onClick = { openLink(ctx, downloadUrl) },
                                colors = ButtonDefaults.buttonColors(containerColor = Navy),
                                shape = RoundedCornerShape(11.dp),
                                modifier = Modifier.fillMaxWidth().height(46.dp),
                            ) { Text("अभी नया वर्शन डाउनलोड करें", fontWeight = FontWeight.Bold, fontSize = 14.sp) }
                        }
                    }

                    if (leader != null) {
                        val seen = leader.optBoolean("seen")
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White)
                                .border(1.dp, if (!seen) Color(0xFFF6C9A0) else Line, RoundedCornerShape(16.dp))
                                .clickable { nav.messages() }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LeaderThumb(64, 26)
                            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("देवेन्द्र यादव जी का संदेश", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink)
                                    if (!seen) Text(" नया", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFE5402F))
                                }
                                Text(leader.optString("title"), fontSize = 13.sp, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(hiDate(leader.str("published_at")), fontSize = 11.5.sp, color = Muted)
                            }
                        }
                    }

                    if (pendingUploads.isNotEmpty()) {
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White)
                                .border(1.dp, Color(0xFFF6C9A0), RoundedCornerShape(16.dp)).clickable { nav.home() }.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            IconTile(Icons.Filled.Info, OrangeBg, Orange, 40)
                            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                                Text("आज के टास्क बाकी हैं", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = OrangeText)
                                Text("आपके ${pendingUploads.size} टास्क बाकी हैं। आज रात 11:59 तक वीडियो अपलोड करें।", fontSize = 12.sp, color = Muted)
                            }
                        }
                    }

                    if (announcements.length() > 0) {
                        Text("पार्टी घोषणाएँ", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Muted, modifier = Modifier.padding(top = 8.dp, start = 2.dp))
                        for (i in 0 until announcements.length()) {
                            val a = announcements.getJSONObject(i)
                            Row(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White)
                                    .border(1.dp, Line, RoundedCornerShape(16.dp)).padding(14.dp),
                                verticalAlignment = Alignment.Top,
                            ) {
                                IconTile(Icons.Filled.Campaign, OrangeBg, Orange, 40)
                                Column(Modifier.padding(start = 12.dp).weight(1f)) {
                                    a.str("title")?.let { Text(it, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink) }
                                    Text(a.optString("body"), fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Ink, lineHeight = 20.sp)
                                    val created = hiDate(a.str("created_at"))
                                    if (created.isNotBlank()) Text(created, fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 4.dp))
                                }
                            }
                        }
                    }

                    if (!isUpdateAvailable && leader == null && announcements.length() == 0 && pendingUploads.isEmpty()) {
                        Column(Modifier.fillMaxWidth().padding(top = 60.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.Notifications, null, tint = Color(0xFFCBD5E1), modifier = Modifier.size(56.dp))
                            Text("अभी कोई नई सूचना नहीं है।", color = Muted, fontSize = 15.sp, modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                }
                AppFooter(helpline = data.str("helpline"))
            }
        }
    }
}

// ---------------------------------------------------------------- Leader messages

@Composable
private fun MessagesScreen(nav: Nav, helpline: String?) {
    val ctx = LocalContext.current
    var list by remember { mutableStateOf<List<JSONObject>?>(null) }
    var current by remember { mutableStateOf<JSONObject?>(null) }
    var seen by remember { mutableStateOf(setOf<Long>()) }
    val scroll = rememberScrollState()
    val scope = rememberCoroutineScope()

    BackHandler { nav.home() }
    LaunchedEffect(Unit) {
        try {
            val r = Api.call(ctx, "messages").optJSONArray("messages") ?: JSONArray()
            val l = (0 until r.length()).map { r.getJSONObject(it) } // newest first, as sent by the server
            list = l; current = l.firstOrNull()
            seen = l.filter { it.optBoolean("seen") }.map { it.getLong("id") }.toSet()
        } catch (e: Exception) { list = emptyList() }
    }

    Scaffold(containerColor = Ground, bottomBar = { BottomBar("messages", nav) }) { inner ->
        Column(Modifier.fillMaxSize().padding(inner)) {
            PageTop("अध्यक्ष जी का संदेश", nav.home)
            Column(Modifier.weight(1f).verticalScroll(scroll)) {
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
                        Text(hiDate(m.str("published_at")), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Orange)
                        // The admin's caption, shown exactly as written
                        Text(m.optString("title"), fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, color = Ink, lineHeight = 27.sp, modifier = Modifier.padding(top = 4.dp))
                        Text(
                            m.str("summary") ?: "माननीय DPCC अध्यक्ष देवेन्द्र यादव जी का सभी वार्ड सदस्यों के लिए संदेश।",
                            fontSize = 14.5.sp, color = Color(0xFF3A4560), lineHeight = 24.sp, modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                    HorizontalDivider(color = Line)
                }
                val l = list
                when {
                    l == null -> Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Orange) }
                    l.isEmpty() -> Text("अभी कोई संदेश नहीं है।", color = Muted, modifier = Modifier.padding(20.dp))
                    l.size > 1 -> {
                        Text("पिछले संदेश", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Muted, modifier = Modifier.padding(start = 18.dp, top = 18.dp, bottom = 10.dp))
                        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            // Every message except the one playing, still newest first
                            l.filter { it.getLong("id") != current?.getLong("id") }.forEach { m ->
                                val isAudio = m.optString("kind") == "audio"
                                val wasSeen = m.getLong("id") in seen
                                Row(
                                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White)
                                        .border(1.dp, Line, RoundedCornerShape(16.dp))
                                        .clickable { current = m; scope.launch { scroll.animateScrollTo(0) } }
                                        .padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    LeaderThumb(64, 26)
                                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                                        Text(m.optString("title"), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                        Text("${hiDate(m.str("published_at"))} · ${if (isAudio) "ऑडियो" else "वीडियो"}", fontSize = 12.sp, color = Muted)
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
                AppFooter(helpline = helpline)
            }
        }
    }
}

// ---------------------------------------------------------------- Points

@Composable
private fun ProgressScreen(data: JSONObject?, onData: (JSONObject) -> Unit, nav: Nav) {
    val ctx = LocalContext.current
    BackHandler { nav.home() }
    // Totals always come fresh from the server.
    LaunchedEffect(Unit) {
        try {
            val p = JSONObject(); data?.str("date")?.let { p.put("date", it) }
            onData(Api.call(ctx, "home", p))
        } catch (e: Exception) {}
    }
    val stats = data?.optJSONObject("stats") ?: JSONObject()
    val rule = data?.optJSONObject("points_rule") ?: JSONObject()
    val perShare = rule.optInt("share", 100)
    val perPhoto = rule.optInt("photo", 100)
    val perVideo = rule.optInt("video", 200)

    Scaffold(containerColor = Ground, bottomBar = { BottomBar("progress", nav) }) { inner ->
        Column(Modifier.fillMaxSize().padding(inner)) {
            PageTop("मेरे अंक", nav.home)
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                Column(Modifier.padding(16.dp)) {
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
                            .background(Brush.linearGradient(listOf(Color(0xFF22396F), Navy))).padding(horizontal = 18.dp, vertical = 22.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(62.dp).clip(RoundedCornerShape(18.dp)).background(Color(0x1FFFFFFF)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Filled.EmojiEvents, null, tint = Gold, modifier = Modifier.size(34.dp))
                        }
                        Column(Modifier.padding(start = 16.dp)) {
                            Text("कुल अंक", color = Color(0xFFAFC0E3), fontSize = 13.sp)
                            Text(fmtNum(stats.optInt("points")), color = Color.White, fontSize = 42.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 46.sp)
                        }
                    }
                    Text("अंक कैसे बनें", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Muted, modifier = Modifier.padding(start = 2.dp, top = 20.dp, bottom = 10.dp))
                    CardBox {
                        PointsRow(Icons.Filled.Share, Color(0xFFE8F0FE), Blue, "सोशल मीडिया शेयर", stats.optInt("shares"), perShare)
                        HorizontalDivider(color = Color(0xFFF0F2F6))
                        PointsRow(Icons.Filled.PhotoCamera, GreenBg, Green, "फोटो अपलोड", stats.optInt("photos"), perPhoto)
                        HorizontalDivider(color = Color(0xFFF0F2F6))
                        PointsRow(Icons.Filled.Videocam, OrangeBg, Orange, "वीडियो अपलोड", stats.optInt("videos"), perVideo)
                    }
                    Row(Modifier.padding(top = 10.dp, start = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Info, null, tint = Muted, modifier = Modifier.size(14.dp))
                        Text("  हर शेयर पर $perShare, हर फोटो पर $perPhoto और हर वीडियो पर $perVideo अंक।", fontSize = 12.5.sp, color = Muted)
                    }
                }
                AppFooter(helpline = data?.str("helpline"))
            }
        }
    }
}

@Composable
private fun PointsRow(icon: ImageVector, bg: Color, fg: Color, label: String, count: Int, each: Int) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
        IconTile(icon, bg, fg)
        Column(Modifier.padding(start = 12.dp).weight(1f)) {
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text("हर एक पर $each अंक", fontSize = 12.sp, color = Muted)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(fmtNum(count * each), fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = Ink)
            Text("$count × $each", fontSize = 11.5.sp, color = Muted)
        }
    }
}
