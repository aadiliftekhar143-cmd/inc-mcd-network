import React, { useEffect, useMemo, useState } from 'react';
import { supabase, fetchAll, fmt, wardLabel, timeAgo } from './lib.js';
import { Check, X, UserCheck, Users, Clock } from './icons.jsx';

const FIELDS = [
  ['full_name', 'Name'],
  ['details', 'Details'],
  ['ward_no', 'Ward'],
  ['assembly', 'Vidhan Sabha'],
  ['lok_sabha', 'Lok Sabha'],
  ['district', 'District'],
  ['family_members', 'Family members'],
  ['contact_mobile', 'Mobile'],
  ['alt_mobile', 'Alternate mobile'],
];
const show = (k, v) => (v == null || v === '' ? '–' : k === 'ward_no' ? wardLabel(v) : String(v));

export default function ProfileUpdates() {
  const [rows, setRows] = useState([]);
  const [approved, setApproved] = useState({});
  const [members, setMembers] = useState({});
  const [photos, setPhotos] = useState({});
  const [status, setStatus] = useState('pending');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const reqs = await fetchAll('profile_requests', '*', (q) => q.order('submitted_at', { ascending: false }));
    setRows(reqs);
    const ap = await fetchAll('member_profiles', '*');
    setApproved(Object.fromEntries(ap.map((p) => [p.mobile, p])));
    const mem = await fetchAll('members', 'mobile, name, ward_no, district, zone');
    setMembers(Object.fromEntries(mem.map((m) => [m.mobile, m])));
    const paths = [...new Set(reqs.map((r) => r.photo_path).filter(Boolean))];
    if (paths.length) {
      const { data } = await supabase.storage.from('uploads').createSignedUrls(paths, 3600);
      setPhotos(Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])));
    }
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const by = (s) => rows.filter((r) => r.status === s).length;
    return {
      pending: by('pending'), approved: by('approved'), rejected: by('rejected'),
      members: new Set(rows.map((r) => r.mobile)).size,
      recent: new Set(rows.filter((r) => new Date(r.submitted_at).getTime() > weekAgo).map((r) => r.mobile)).size,
    };
  }, [rows]);

  const review = async (r, ok) => {
    setBusy(r.id); setMsg('');
    const { data: u } = await supabase.auth.getUser();
    const who = u?.user?.email || 'admin';
    if (ok) {
      const profile = Object.fromEntries([...FIELDS.map(([k]) => k), 'photo_path'].map((k) => [k, r[k] ?? null]));
      const { error } = await supabase.from('member_profiles').upsert({ mobile: r.mobile, ...profile, request_id: r.id, approved_at: new Date().toISOString() });
      if (error) { setMsg(error.message); setBusy(null); return; }
    }
    const { error } = await supabase.from('profile_requests')
      .update({ status: ok ? 'approved' : 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: who }).eq('id', r.id);
    setMsg(error ? error.message : ok ? 'Approved. The details are now in the member profile.' : 'Rejected.');
    setBusy(null); load();
  };

  const list = rows.filter((r) => status === 'all' || r.status === status);

  return (
    <>
      <section className="kpis" aria-label="Profile update numbers">
        <div className="card kpi"><div className="l">Waiting for approval</div><div className="v">{fmt(stats.pending)}</div></div>
        <div className="card kpi"><div className="l">Approved</div><div className="v">{fmt(stats.approved)}</div><div className="s">{fmt(stats.rejected)} rejected</div></div>
        <div className="card kpi"><div className="l">Members who filled a profile</div><div className="v">{fmt(stats.members)}</div></div>
        <div className="card kpi"><div className="l">Updated in the last 7 days</div><div className="v">{fmt(stats.recent)}</div><div className="s">Members keeping details current</div></div>
      </section>

      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserCheck size={18} />Profile updates</h2>
            <p className="sub">Details members submit from the app. Nothing reaches the member profile until you approve it. Login numbers never change.</p>
          </div>
          <div className="seg">
            {[['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) => (
              <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>
            ))}
          </div>
        </div>
        {msg && <div className="notice ok" style={{ marginTop: 12 }}>{msg}</div>}
        <div className="tbl">
          <table className="diff">
            <thead><tr><th>Photo</th><th>Member (login)</th><th>Submitted details</th><th>Submitted</th><th /></tr></thead>
            <tbody>
              {list.map((r) => {
                const m = members[r.mobile] || {};
                const cur = approved[r.mobile] || {};
                return (
                  <tr key={r.id}>
                    <td>{r.photo_path && photos[r.photo_path] ? <a href={photos[r.photo_path]} target="_blank" rel="noreferrer"><img className="avatar" src={photos[r.photo_path]} alt="" /></a> : <div className="avatar" />}</td>
                    <td><b>{m.name || '–'}</b><div className="muted" style={{ fontSize: 12 }}>{r.mobile} · {m.ward_no ? wardLabel(m.ward_no) : '–'}</div></td>
                    <td>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 13 }}>
                        {FIELDS.map(([k, l]) => {
                          const changed = r.status === 'pending' && cur.mobile && String(cur[k] ?? '') !== String(r[k] ?? '');
                          return (
                            <React.Fragment key={k}>
                              <span className="muted">{l}</span>
                              <span className={changed ? 'chg' : ''}>{show(k, r[k])}{changed && <span className="muted"> (was {show(k, cur[k])})</span>}</span>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={13} />{timeAgo(r.submitted_at)}</span>
                      <div><span className={'tag ' + (r.status === 'approved' ? 'live' : 'mute')}>{r.status === 'pending' ? 'Waiting' : r.status === 'approved' ? 'Approved' : 'Rejected'}</span></div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.status === 'pending' && (
                        <>
                          <button className="btn sm" disabled={busy === r.id} onClick={() => review(r, true)}><Check size={14} />Approve</button>{' '}
                          <button className="btn warn sm" disabled={busy === r.id} onClick={() => review(r, false)}><X size={14} />Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={15} />Nothing here yet.</p>}
      </section>
    </>
  );
}
