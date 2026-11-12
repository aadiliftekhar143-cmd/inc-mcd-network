// INC MCD NETWORK: user management for the admin panel (master admins only).
// Deploy with: supabase functions deploy admin
//
// POST { action: 'list' }
// POST { action: 'create', role: 'telecaller'|'admin', name, phone, password, email?, districts?, remarks? }
// POST { action: 'update', user_id, name?, phone?, districts?, remarks?, active? }
// POST { action: 'reset_password', user_id, password }
// POST { action: 'delete', user_id }
import { callerRole, cors, json, serviceClient } from "../_shared/common.ts";

// Telecallers log in with their mobile number; Supabase Auth needs an email, so we derive one.
const loginEmail = (phone: string) => `${phone}@inc-mcd.local`;
const cleanPhone = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(-10);
const cleanDistricts = (v: unknown) =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((d) => String(d).trim()).filter(Boolean).slice(0, 50);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const { userId, role } = await callerRole(req);
  if (role !== "admin") return json({ error: "forbidden" }, 403);

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const db = serviceClient();
  const action = String(body.action ?? "");

  try {
    if (action === "list") {
      const { data: tcs } = await db.from("telecallers").select("*").order("created_at");
      const { data: admins } = await db.from("admins").select("*");
      const users: Record<string, { email?: string; last_sign_in_at?: string }> = {};
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        for (const u of data.users) users[u.id] = { email: u.email, last_sign_in_at: u.last_sign_in_at };
        if (data.users.length < 1000) break;
      }
      const { data: calls } = await db.from("call_logs").select("caller_id, created_at");
      const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
      const callCount: Record<string, { total: number; today: number }> = {};
      for (const c of calls ?? []) {
        if (!c.caller_id) continue;
        const k = (callCount[c.caller_id] ||= { total: 0, today: 0 });
        k.total++;
        const d = new Date(new Date(c.created_at).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
        if (d === today) k.today++;
      }
      return json({
        telecallers: (tcs ?? []).map((t) => ({ ...t, ...users[t.user_id], calls: callCount[t.user_id] ?? { total: 0, today: 0 } })),
        admins: (admins ?? []).map((a) => ({ ...a, ...users[a.user_id], is_me: a.user_id === userId })),
      });
    }

    if (action === "create") {
      const newRole = body.role === "admin" ? "admin" : "telecaller";
      const name = String(body.name ?? "").trim();
      const phone = cleanPhone(body.phone);
      const password = String(body.password ?? "");
      const email = String(body.email ?? "").trim().toLowerCase() || (phone ? loginEmail(phone) : "");
      if (!name) return json({ error: "name_required" }, 400);
      if (!email) return json({ error: "phone_or_email_required" }, 400);
      if (password.length < 8) return json({ error: "password_too_short" }, 400);
      const districts = cleanDistricts(body.districts);
      if (newRole === "telecaller" && !districts.length) return json({ error: "districts_required" }, 400);

      const { data: created, error } = await db.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { role: newRole, name, phone },
      });
      if (error) return json({ error: "create_failed", detail: error.message }, 400);
      const id = created.user!.id;
      const ins = newRole === "admin"
        ? await db.from("admins").insert({ user_id: id, label: name })
        : await db.from("telecallers").insert({ user_id: id, name, phone, districts, remarks: String(body.remarks ?? "") || null });
      if (ins.error) {
        await db.auth.admin.deleteUser(id);
        throw ins.error;
      }
      return json({ ok: true, user_id: id, login: phone && !body.email ? phone : email });
    }

    if (action === "update") {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = String(body.name).trim();
      if (body.phone !== undefined) patch.phone = cleanPhone(body.phone);
      if (body.remarks !== undefined) patch.remarks = String(body.remarks) || null;
      if (body.districts !== undefined) patch.districts = cleanDistricts(body.districts);
      if (body.active !== undefined) patch.active = !!body.active;
      const { error } = await db.from("telecallers").update(patch).eq("user_id", String(body.user_id));
      if (error) throw error;
      if (body.active !== undefined) {
        await db.auth.admin.updateUserById(String(body.user_id), { ban_duration: body.active ? "none" : "876000h" });
      }
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const password = String(body.password ?? "");
      if (password.length < 8) return json({ error: "password_too_short" }, 400);
      const { error } = await db.auth.admin.updateUserById(String(body.user_id), { password });
      if (error) return json({ error: "reset_failed", detail: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      if (String(body.user_id) === userId) return json({ error: "cannot_delete_self" }, 400);
      const { error } = await db.auth.admin.deleteUser(String(body.user_id));
      if (error) return json({ error: "delete_failed", detail: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
