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
    return { stars: 5, score: 95, grade: 'A+', label: 'Star Performer', badgeClass: 'badge-5star', color: '#10B981', starStr: '★★★★★' };
  }
  if (tasks >= 2 || pts >= 250 || (tasks >= 1 && vids >= 2)) {
    return { stars: 4, score: 80, grade: 'A', label: 'Active', badgeClass: 'badge-4star', color: '#2563EB', starStr: '★★★★☆' };
  }
  if (tasks >= 1 || pts >= 100) {
    return { stars: 3, score: 65, grade: 'B', label: 'Moderate', badgeClass: 'badge-3star', color: '#D97706', starStr: '★★★☆☆' };
  }
  if (loggedIn) {
    return { stars: 2, score: 40, grade: 'C', label: 'Needs Push', badgeClass: 'badge-2star', color: '#EA580C', starStr: '★★☆☆☆' };
  }
  return { stars: 1, score: 10, grade: 'D', label: 'Inactive', badgeClass: 'badge-1star', color: '#DC2626', starStr: '★☆☆☆☆' };
}

export function getWardRating(completionRate) {
  const rate = Number(completionRate || 0);
  if (rate >= 85) return { stars: 5, grade: 'A+', label: 'Top Tier', badgeClass: 'badge-5star', color: '#10B981', starStr: '★★★★★' };
  if (rate >= 70) return { stars: 4, grade: 'A', label: 'Good', badgeClass: 'badge-4star', color: '#2563EB', starStr: '★★★★☆' };
  if (rate >= 50) return { stars: 3, grade: 'B', label: 'Moderate', badgeClass: 'badge-3star', color: '#D97706', starStr: '★★★☆☆' };
  if (rate >= 25) return { stars: 2, grade: 'C', label: 'Needs Push', badgeClass: 'badge-2star', color: '#EA580C', starStr: '★★☆☆☆' };
  return { stars: 1, grade: 'D', label: 'Critical', badgeClass: 'badge-1star', color: '#DC2626', starStr: '★☆☆☆☆' };
}
