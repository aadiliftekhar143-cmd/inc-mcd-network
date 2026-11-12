import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

// Supabase returns max 1000 rows per request; page through everything.
export async function fetchAll(table, select = '*', build = (q) => q) {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(supabase.from(table).select(select)).range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

export const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

export const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export const wardLabel = (n) => 'Ward ' + String(n).padStart(3, '0');

export function timeAgo(iso) {
  if (!iso) return 'Never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
  return Math.floor(s / 86400) + ' days ago';
}

export const heatClass = (v) => (v < 40 ? 'h0' : v < 55 ? 'h1' : v < 70 ? 'h2' : v < 85 ? 'h3' : 'h4');

export const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function getMemberRating(m) {
  const pts = Number(m.points || 0);
  const tasks = Number(m.tasks_done || 0);
  const vids = Number(m.videos || 0);
  const loggedIn = !!m.first_login_at;

  if (tasks >= 3 || pts >= 500 || (tasks >= 2 && vids >= 4)) {
    return { stars: 5, score: 95, grade: 'A+', label: 'Star Performer', badgeClass: 'badge-5star', color: '#10B981', starStr: '5/5' };
  }
  if (tasks >= 2 || pts >= 250 || (tasks >= 1 && vids >= 2)) {
    return { stars: 4, score: 80, grade: 'A', label: 'Active', badgeClass: 'badge-4star', color: '#2563EB', starStr: '4/5' };
  }
  if (tasks >= 1 || pts >= 100) {
    return { stars: 3, score: 65, grade: 'B', label: 'Moderate', badgeClass: 'badge-3star', color: '#D97706', starStr: '3/5' };
  }
  if (loggedIn) {
    return { stars: 2, score: 40, grade: 'C', label: 'Needs Push', badgeClass: 'badge-2star', color: '#EA580C', starStr: '2/5' };
  }
  return { stars: 1, score: 10, grade: 'D', label: 'Inactive', badgeClass: 'badge-1star', color: '#DC2626', starStr: '1/5' };
}

export function getWardRating(completionRate) {
  const rate = Number(completionRate || 0);
  if (rate >= 85) return { stars: 5, grade: 'A+', label: 'Top Tier', badgeClass: 'badge-5star', color: '#10B981', starStr: '5/5' };
  if (rate >= 70) return { stars: 4, grade: 'A', label: 'Good', badgeClass: 'badge-4star', color: '#2563EB', starStr: '4/5' };
  if (rate >= 50) return { stars: 3, grade: 'B', label: 'Moderate', badgeClass: 'badge-3star', color: '#D97706', starStr: '3/5' };
  if (rate >= 25) return { stars: 2, grade: 'C', label: 'Needs Push', badgeClass: 'badge-2star', color: '#EA580C', starStr: '2/5' };
  return { stars: 1, grade: 'D', label: 'Critical', badgeClass: 'badge-1star', color: '#DC2626', starStr: '1/5' };
}

// ---- Shared helpers added for telecallers, reports and instant notifications ----

export const districtOf = (m) => String(m?.district || m?.zone || '').trim();

/** Calls one of our Edge Functions with the signed-in user's token. Returns { data, error }. */
export async function callFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let detail = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) detail = j.detail ? `${j.error}: ${j.detail}` : j.error; } catch (_) { /* keep message */ }
    return { data: null, error: detail };
  }
  return { data, error: null };
}

/** Telecallers log in with their 10-digit mobile number; Supabase needs an email, so map it. */
export const loginId = (v) => {
  const t = String(v || '').trim();
  const digits = t.replace(/\D/g, '');
  return /^\d{10}$/.test(t.replace(/[\s-]/g, '')) ? `${digits}@inc-mcd.local` : t;
};

export const CALL_OUTCOMES = [
  ['connected', 'Connected, spoke'],
  ['will_do', 'Will do tasks'],
  ['call_back', 'Asked to call back'],
  ['not_reachable', 'Not reachable / no answer'],
  ['switched_off', 'Switched off'],
  ['wrong_number', 'Wrong number'],
  ['not_interested', 'Not interested'],
  ['other', 'Other'],
];
export const outcomeLabel = (k) => (CALL_OUTCOMES.find(([v]) => v === k) || [k, k || '–'])[1];

export const istDate = (iso) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : '');

export function downloadXlsx(XLSX, rows, sheet, file) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  XLSX.writeFile(wb, file);
}

// ---- Share-card platforms and task notification text ----

export const PLATFORMS = [
  { key: 'facebook', col: 'link_facebook', label: 'Facebook', field: 'Facebook post link', placeholder: 'https://www.facebook.com/…' },
  { key: 'instagram', col: 'link_instagram', label: 'Instagram', field: 'Instagram post or reel link', placeholder: 'https://www.instagram.com/p/…' },
  { key: 'x', col: 'link_x', label: 'X (Twitter)', field: 'X (Twitter) post link', placeholder: 'https://x.com/user/status/123…' },
  { key: 'whatsapp', col: 'link_whatsapp', label: 'WhatsApp', field: 'WhatsApp message (text and/or link members forward)', placeholder: 'वादों का हिसाब दो, दिल्ली को जवाब दो। देखें: https://…' },
];

/** Which platform a share card is for (the first link that is filled). */
export const platformOf = (t) => (PLATFORMS.find((p) => t?.[p.col]) || PLATFORMS[0]).key;

/** Notification title and text for a task, built from the task itself. Keep in step with taskNotice() in supabase/functions/app/index.ts. */
export function taskNotice(t) {
  const desc = String(t.description || '').trim();
  if (t.kind === 'share') {
    const p = PLATFORMS.find((x) => t[x.col]) || PLATFORMS[0];
    return { title: `नई पोस्ट: ${p.label} पर शेयर करें`, body: desc ? `${t.title} · ${desc}`.slice(0, 240) : t.title };
  }
  const slots = Number(t.video_slots || 1);
  return { title: `नया टास्क: ${t.title}`.slice(0, 120), body: desc ? desc.slice(0, 240) : `${slots} वीडियो अपलोड करें, आज रात 11:59 तक।` };
}
