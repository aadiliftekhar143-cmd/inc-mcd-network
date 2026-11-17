import React, { useEffect, useState } from 'react';
import { supabase, fetchAll, timeAgo } from './lib.js';
import { Check, X } from './icons.jsx';

const ROLE = { president: 'DPCC President', gs: 'General Secretary', dc: 'District Coordinator', dp: 'District President', observer: 'Assembly Observer' };
const FIELDS = [['name', 'Name'], ['position', 'Post in the party'], ['dob', 'Date of birth'], ['gender', 'Gender'], ['married', 'Married'], ['anniversary', 'Anniversary']];
const show = (v) => (v == null || v === '' ? '–' : v === true ? 'Yes' : v === false ? 'No' : String(v));

// Profile changes leaders send from the app (photo, name, post, birthday). They apply only after approval here.
export default function LeaderProfiles() {
  const [rows, setRows] = useState([]);
  const [leaders, setLeaders] = useState({});
  const [photos, setPhotos] = useState({});
  const [msg, setMsg] = useState('');
  const load = async () => {
    const reqs = await fetchAll('leader_profile_requests', '*', (q) => q.eq('status', 'pending').order('submitted_at', { ascending: false }));
    setRows(reqs);
    setLeaders(Object.fromEntries((await fetchAll('leaders', '*')).map((l) => [l.mobile, l])));
    const paths = [...new Set(reqs.map((r) => r.photo_path).filter(Boolean))];
    if (paths.length) {
      const { data } = await supabase.storage.from('uploads').createSignedUrls(paths, 3600);
      setPhotos(Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])));
    }
  };
  useEffect(() => { load().catch(() => {}); }, []);
  const review = async (r, ok) => {
    const { data: u } = await supabase.auth.getUser();
    if (ok) {
      const patch = Object.fromEntries(FIELDS.map(([k]) => [k, r[k] ?? null]));
      if (r.photo_path) patch.photo_path = r.photo_path;
      const { error } = await supabase.from('leaders').update(patch).eq('mobile', r.mobile);
      if (error) { setMsg(error.message); return; }
    }
    const { error } = await supabase.from('leader_profile_requests').update({ status: ok ? 'approved' : 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: u?.user?.email || 'admin' }).eq('id', r.id);
    setMsg(error ? error.message : ok ? 'Approved. The leader sees the new profile in the app.' : 'Rejected.');
    load();
  };
  if (!rows.length && !msg) return null;
  return (
    <section className="card">
      <h2>Leader profile updates ({rows.length} waiting)</h2>
      <p className="sub">District Presidents, Observers, Coordinators and the General Secretary edit their profile in the app. Nothing changes until you approve it.</p>
      {msg && <div className="notice ok" style={{ marginTop: 10 }}>{msg}</div>}
      <div className="mt-grid">
        {rows.map((r) => { const l = leaders[r.mobile] || {}; return (
          <article key={r.id} className="mt-card">
            <header>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {photos[r.photo_path] ? <img src={photos[r.photo_path]} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E3E7EF' }} />}
                <div><b>{l.name || r.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{ROLE[l.role] || ''}{l.assembly ? ' · ' + l.assembly : l.district ? ' · ' + l.district : ''} · {r.mobile}</div></div>
              </div>
              <span className="tag live">Waiting</span>
            </header>
            <table className="mini"><tbody>
              {FIELDS.map(([k, label]) => (
                <tr key={k}><td className="muted">{label}</td><td>{show(l[k])}</td><td style={{ fontWeight: String(l[k] ?? '') !== String(r[k] ?? '') ? 700 : 400 }}>{show(r[k])}</td></tr>))}
            </tbody></table>
            <footer>
              <span className="muted" style={{ fontSize: 12.5 }}>Now, then asked for · {timeAgo(r.submitted_at)}</span>
              <span style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => review(r, true)}><Check size={14} />Approve</button>{' '}<button className="btn warn sm" onClick={() => review(r, false)}><X size={14} />Reject</button></span>
            </footer>
          </article>); })}
      </div>
    </section>
  );
}
