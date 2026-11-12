// INC MCD NETWORK: instant notifications (Firebase Cloud Messaging), called from the admin panel.
// Deploy with: supabase functions deploy push
// Needs the secret FIREBASE_SERVICE_ACCOUNT (the Firebase service account JSON).
//
// POST { title, body, target: 'all'|'ward'|'district'|'pending'|'mobiles', ward_no?, district?, mobiles?,
//        type?: 'announcement'|'task'|'leader', ref_id?, save_announcement?: boolean }
import { callerRole, cors, json, pool, sendFcm, serviceAccount, serviceClient, slug } from "../_shared/common.ts";

const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const { role } = await callerRole(req);
  if (role !== "admin") return json({ error: "forbidden" }, 403);

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const db = serviceClient();
  const title = String(body.title ?? "INC MCD NETWORK").slice(0, 120);
  const text = String(body.body ?? "").slice(0, 900);
  if (!text) return json({ error: "empty_body" }, 400);
  const target = String(body.target ?? "all");
  const type = String(body.type ?? "announcement");

  try {
    // Save it as an announcement too, so it shows in the app's notification screen and reaches phones without Firebase.
    let refId = body.ref_id ? String(body.ref_id) : "";
    if (body.save_announcement) {
      const { data: a, error } = await db.from("announcements").insert({
        title,
        body: text,
        only_pending: target === "pending",
        ward_no: target === "ward" ? Number(body.ward_no) : null,
        district: target === "district" ? String(body.district ?? "") : null,
        zone: target === "district" ? String(body.district ?? "") : null,
        priority: "high",
      }).select("id").single();
      if (error) throw error;
      refId = String(a.id);
    }

    const sa = serviceAccount();
    if (!sa) {
      return json({ ok: true, pushed: false, reason: "firebase_not_configured", announcement_id: refId || null });
    }

    const payload = { title, body: text, data: { type, ref_id: refId } };
    let sent = 0, failed = 0, removed = 0;

    if (target === "all" || target === "ward" || target === "district") {
      const topic = target === "all" ? "all"
        : target === "ward" ? `ward_${Number(body.ward_no)}`
        : `district_${slug(body.district)}`;
      const r = await sendFcm(sa, { topic }, payload);
      r === "ok" ? sent++ : failed++;
    } else {
      // Per-device sends: members with pending tasks today, or a given list of mobiles.
      let mobiles: string[] = [];
      if (target === "mobiles") {
        mobiles = (Array.isArray(body.mobiles) ? body.mobiles : []).map((m: unknown) => String(m)).slice(0, 5000);
      } else {
        const today = istToday();
        const { data: tasks } = await db.from("tasks").select("id").eq("task_date", today).eq("kind", "upload");
        const ids = (tasks ?? []).map((t) => t.id);
        if (ids.length) {
          const { data: members } = await db.from("members").select("mobile").eq("active", true);
          const { data: done } = await db.from("completions").select("mobile, task_id").in("task_id", ids);
          const count: Record<string, number> = {};
          for (const d of done ?? []) count[d.mobile] = (count[d.mobile] ?? 0) + 1;
          mobiles = (members ?? []).map((m) => m.mobile).filter((m) => (count[m] ?? 0) < ids.length);
        }
      }
      const tokens: string[] = [];
      for (let i = 0; i < mobiles.length; i += 500) {
        const { data } = await db.from("push_tokens").select("token").in("mobile", mobiles.slice(i, i + 500));
        tokens.push(...(data ?? []).map((t) => t.token));
      }
      const results = await pool(tokens, 25, (t) => sendFcm(sa, { token: t }, payload));
      const dead: string[] = [];
      results.forEach((r, i) => {
        if (r === "ok") sent++;
        else { failed++; if (r === "unregistered") dead.push(tokens[i]); }
      });
      if (dead.length) { await db.from("push_tokens").delete().in("token", dead); removed = dead.length; }
    }

    if (refId && body.save_announcement) {
      await db.from("announcements").update({ pushed_count: sent }).eq("id", Number(refId));
    }
    return json({ ok: true, pushed: true, sent, failed, removed_tokens: removed, announcement_id: refId || null });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
