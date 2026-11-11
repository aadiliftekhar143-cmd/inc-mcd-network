package com.coceptual.wardsadasya

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/** Runs periodically and on-demand: checks for new tasks, announcements, and reminders. */
class ReminderWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        if (Store.token(ctx) == null) return Result.success()
        val res = try {
            val p = JSONObject()
            Store.lastPoll(ctx)?.let { p.put("since", it) }
            Api.call(ctx, "poll", p)
        } catch (e: ApiError) {
            if (e.code == "unauthorized") Store.setToken(ctx, null)
            return Result.success()
        } catch (e: Exception) {
            return Result.retry()
        }
        val serverNow = res.optString("now")
        if (serverNow.isNotBlank()) Store.setLastPoll(ctx, serverNow)

        val hour = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata")).get(Calendar.HOUR_OF_DAY)
        if (hour < 7 || hour >= 23) return Result.success() // quiet hours (11 PM to 7 AM IST)

        // 1. New tasks created by Admin
        val newTasks = res.optJSONArray("new_tasks")
        if (newTasks != null) {
            for (i in 0 until newTasks.length()) {
                val t = newTasks.getJSONObject(i)
                val taskId = t.optInt("id", (System.currentTimeMillis() % 10000).toInt())
                val title = t.optString("title", "नया काम")
                Notify.show(
                    ctx,
                    4000 + taskId,
                    "नया काम: $title",
                    "आज रात 11:59 तक वीडियो अपलोड करें।"
                )
            }
        }

        // 2. Announcements
        val ann = res.optJSONArray("announcements")
        if (ann != null) {
            for (i in 0 until ann.length()) {
                val a = ann.getJSONObject(i)
                val annId = a.optInt("id", i)
                Notify.show(ctx, 1000 + annId, "वार्ड सदस्य", a.optString("body"))
            }
        }

        // 3. Leader video message
        res.optJSONObject("new_message")?.let {
            val msgId = it.optInt("id", 2000)
            Notify.show(ctx, 2000 + msgId, "देवेन्द्र यादव जी का संदेश", it.optString("title"))
        }

        // 4. Pending tasks reminder
        val pending = res.optInt("pending")
        if (pending > 0 && (newTasks == null || newTasks.length() == 0)) {
            Notify.show(ctx, 3000, "आज के काम बाकी हैं", "आपके $pending काम बाकी हैं। रात 11:59 तक वीडियो अपलोड करें।")
        }
        return Result.success()
    }

    companion object {
        fun schedule(ctx: Context) {
            // Periodic background check every 15 minutes (Android WorkManager minimum)
            val req = PeriodicWorkRequestBuilder<ReminderWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                "reminders",
                ExistingPeriodicWorkPolicy.UPDATE,
                req
            )
            checkNow(ctx)
        }

        fun checkNow(ctx: Context) {
            if (Store.token(ctx) == null) return
            val req = OneTimeWorkRequestBuilder<ReminderWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx).enqueue(req)
        }
    }
}

object Notify {
    private const val CHANNEL = "reminders"

    fun createChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(CHANNEL, "काम और घोषणाएं", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "दैनिक काम, नेताजी के संदेश और घोषणाएं"
                enableVibration(true)
                enableLights(true)
            }
            ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    @SuppressLint("MissingPermission")
    fun show(ctx: Context, id: Int, title: String, text: String) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val open = PendingIntent.getActivity(
            ctx, id, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(open)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()
        NotificationManagerCompat.from(ctx).notify(id, n)
    }
}
