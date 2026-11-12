package com.coceptual.wardsadasya

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri

/** Opens social posts in their own apps (X, Facebook, Instagram, WhatsApp), falling back to the browser. */
object Social {
    private const val X_PKG = "com.twitter.android"
    private const val FB_PKG = "com.facebook.katana"
    private const val IG_PKG = "com.instagram.android"
    private val WA_PKGS = listOf("com.whatsapp", "com.whatsapp.w4b")

    private val tweetRegex = Regex("""(?:twitter\.com|x\.com)/[^/?#]+/status(?:es)?/(\d+)""")

    fun tweetId(url: String): String? = tweetRegex.find(url)?.groupValues?.get(1)

    /**
     * platform: "x", "facebook", "instagram" or "whatsapp".
     * action (X only): "open", "retweet" or "like".
     */
    fun open(ctx: Context, platform: String, url: String, action: String = "open"): Boolean = when (platform) {
        "x" -> {
            val id = tweetId(url)
            val target = when {
                id != null && action == "retweet" -> "https://x.com/intent/retweet?tweet_id=$id"
                id != null && action == "like" -> "https://x.com/intent/like?tweet_id=$id"
                else -> url
            }
            // Intent links open best through the X app's own link handling; plain posts open directly in the app.
            view(ctx, target, X_PKG) || view(ctx, url, null)
        }
        "facebook" ->
            tryStart(ctx, Intent(Intent.ACTION_VIEW, Uri.parse("fb://facewebmodal/f?href=" + Uri.encode(url))).setPackage(FB_PKG)) ||
                view(ctx, url, null)
        "instagram" -> view(ctx, url, IG_PKG)
        "whatsapp" -> shareWhatsApp(ctx, url)
        else -> view(ctx, url, null)
    }

    /** Shares text (and any link inside it) straight into WhatsApp, or the share sheet if WhatsApp is missing. */
    fun shareWhatsApp(ctx: Context, text: String): Boolean {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
        for (pkg in WA_PKGS) if (tryStart(ctx, Intent(send).setPackage(pkg))) return true
        return tryStart(ctx, Intent.createChooser(send, "शेयर करें"))
    }

    private fun view(ctx: Context, url: String, pkg: String?): Boolean {
        val uri = try { Uri.parse(url) } catch (e: Exception) { return false }
        if (pkg != null && tryStart(ctx, Intent(Intent.ACTION_VIEW, uri).setPackage(pkg))) return true
        return tryStart(ctx, Intent(Intent.ACTION_VIEW, uri))
    }

    private fun tryStart(ctx: Context, intent: Intent): Boolean = try {
        ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (e: ActivityNotFoundException) {
        false
    } catch (e: SecurityException) {
        false
    }
}
