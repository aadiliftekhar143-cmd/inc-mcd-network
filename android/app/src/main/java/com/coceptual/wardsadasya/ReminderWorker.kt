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
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/** Runs about every 3 hours: asks the server what is pending and shows a notification. */
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
        Store.setLastPoll(ctx, res.optString("now"))

        val hour = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata")).get(Calendar.HOUR_OF_DAY)
        if (hour < 7 || hour >= 23) return Result.success() // quiet hours

        val ann = res.optJSONArray("announcements")
        if (ann != null) for (i in 0 until ann.length()) {
            Notify.show(ctx, 1000 + i, "वार्ड सदस्य", ann.getJSONObject(i).optString("body"))
        }
        res.optJSONObject("new_message")?.let {
            Notify.show(ctx, 2000, "देवेन्द्र यादव जी का संदेश", it.optString("title"))
        }
        val pending = res.optInt("pending")
        if (pending > 0) {
            Notify.show(ctx, 3000, "आज के काम बाकी हैं", "आपके $pending काम बाकी हैं। रात 11:59 तक वीडियो अपलोड करें।")
        }
        return Result.success()
    }

    companion object {
        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<ReminderWorker>(3, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("reminders", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}

object Notify {
    private const val CHANNEL = "reminders"

    fun createChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(CHANNEL, "काम के रिमाइंडर", NotificationManager.IMPORTANCE_HIGH)
            ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    @SuppressLint("MissingPermission")
    fun show(ctx: Context, id: Int, title: String, text: String) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val open = PendingIntent.getActivity(
            ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
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
            .build()
        NotificationManagerCompat.from(ctx).notify(id, n)
    }
}
