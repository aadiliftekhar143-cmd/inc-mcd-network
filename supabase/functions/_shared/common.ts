// Shared helpers for the admin-side Edge Functions (push, admin).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const serviceClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

/** Returns the caller's user id and role ('admin' | 'telecaller' | null) from their admin-panel login. */
export async function callerRole(req: Request): Promise<{ userId: string | null; role: string | null }> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { userId: null, role: null };
  const asUser: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await asUser.auth.getUser(auth.slice(7));
  if (!u?.user) return { userId: null, role: null };
  const { data: role } = await asUser.rpc("my_role");
  return { userId: u.user.id, role: (role as string) ?? null };
}

/** FCM topic names allow letters, digits and _ only. Must match the app function. */
export const slug = (v: unknown) =>
  String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ---------------------------------------------------------------- Firebase Cloud Messaging (HTTP v1)

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let cachedToken: { value: string; expires: number } | null = null;

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${b64url(sig)}`,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error("fcm_auth_failed: " + JSON.stringify(j));
  cachedToken = { value: j.access_token, expires: Date.now() + Number(j.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

export type PushPayload = { title: string; body: string; data?: Record<string, string> };

/** Sends one high-priority message to a topic or a device token. Returns "ok", "unregistered" or an error string. */
export async function sendFcm(sa: ServiceAccount, target: { topic?: string; token?: string }, p: PushPayload): Promise<string> {
  const token = await accessToken(sa);
  const data: Record<string, string> = { title: p.title, body: p.body, ...(p.data ?? {}) };
  const message = {
    ...target,
    data,
    notification: { title: p.title, body: p.body },
    android: {
      priority: "HIGH",
      ttl: "21600s",
      notification: {
        channel_id: "urgent",
        sound: "default",
        notification_priority: "PRIORITY_MAX",
        default_vibrate_timings: true,
        visibility: "PUBLIC",
      },
    },
  };
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (res.ok) return "ok";
  const txt = await res.text();
  if (res.status === 404 || txt.includes("UNREGISTERED") || txt.includes("INVALID_ARGUMENT")) return "unregistered";
  return `error_${res.status}`;
}

/** Runs async jobs with a concurrency limit. */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
