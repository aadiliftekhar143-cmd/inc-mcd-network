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
