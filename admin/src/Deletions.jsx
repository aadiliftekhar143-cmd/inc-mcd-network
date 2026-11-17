import React, { useEffect, useState } from 'react';
import { supabase, fetchAll, timeAgo, callFn, wardLabel } from './lib.js';

// Requests to delete an account and its data. They come from the app (Settings) or the public page /delete-account.
// Google Play needs both ways to exist. Deleting removes the login, points, uploads, messages and files for that number.
export default function Deletions() {
  const [rows, setRows] = useState([]);
  const [who, setWho] = useState({});
  const [status, setStatus] = useState('pending');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = async () => {
    const list = await fetchAll('deletion_requests', '*', (q) => q.order('created_at', { ascending: false }));
    setRows(list);
    const mobiles = [...new Set(list.map((r) => r.mobile))];
    const info = {};
    for (let i = 0; i < mobiles.length; i += 200) {
      const part = mobiles.slice(i, i + 200);
      const [m, l] = await Promise.all([
        supabase.from('members').select('mobile, name, ward_no, block_no, is_applicant').in('mobile', part),
        supabase.from('leaders').select('mobile, name, role').in('mobile', part),
      ]);
      (m.data || []).forEach((x) => { (info[x.mobile] ||= {}).member = x; });
      (l.data || []).forEach((x) => { (info[x.mobile] ||= {}).leader = x; });
    }
    setWho(info);
  };
  useEffect(() => { load().catch((e) => setMsg({ ok: false, text: e.message })); }, []);

  const remove = async (r) => {
    const w = who[r.mobile] || {};
    if (!window.confirm(`Delete the account of ${r.name || r.mobile} (${r.mobile}) and everything stored for it?\n\nThis removes the login, points, uploads, messages and files. It cannot be undone.`)) return;
    setBusy(r.id); setMsg(null);
    const { data, error } = await callFn('admin', { action: 'delete_account', request_id: r.id });
    setBusy(null);
    setMsg(error ? { ok: false, text: 'Could not delete: ' + error } : { ok: true, text: `Deleted. ${data.files} files removed${w.leader ? ', leader login removed' : ''}${w.member ? ', ward member login removed' : ''}.` });
    load();
  };
  const reject = async (r) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from('deletion_requests').update({ status: 'rejected', processed_at: new Date().toISOString(), processed_by: u?.user?.email || 'admin' }).eq('id', r.id);
    load();
  };
  const list = rows.filter((r) => status === 'all' || r.status === status);
  const n = (s) => rows.filter((r) => r.status === s).length;
  return (
    <section className="card">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h2>Account deletion requests</h2>
          <p className="sub">Sent from the app or from the public page congressdelhinetwork.com/delete-account. A web request is not verified, so call the number first and confirm it is really them before deleting.</p>
        </div>
        <div className="seg">
          {[['pending', `Waiting ${n('pending')}`], ['done', `Deleted ${n('done')}`], ['rejected', `Not deleted ${n('rejected')}`], ['all', 'All']].map(([k, l]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>))}
        </div>
      </div>
      {msg && <div className={'notice' + (msg.ok ? ' ok' : '')} style={{ marginTop: 12 }}>{msg.text}</div>}
      <div className="tbl"><table>
        <thead><tr><th>Who</th><th>In the app as</th><th>Asked from</th><th>Reason</th><th>When</th><th /></tr></thead>
        <tbody>{list.map((r) => { const w = who[r.mobile] || {}; return (
          <tr key={r.id}>
            <td><b>{r.name || '–'}</b><div className="muted" style={{ fontSize: 12.5 }}><a href={`tel:+91${r.mobile}`}>{r.mobile}</a></div></td>
            <td>{w.member && <div>{w.member.is_applicant !== false ? `Ward member · ${wardLabel(w.member.ward_no)}` : ''}{w.member.block_no != null ? ` Block President · ${w.member.block_no}` : ''}</div>}
              {w.leader && <div>Leader · {w.leader.role}</div>}
              {!w.member && !w.leader && <span className="muted">{r.status === 'done' ? 'Removed' : 'This number is not in the app'}</span>}</td>
            <td><span className={'tag ' + (r.source === 'web' ? 'no' : 'live')}>{r.source === 'web' ? 'Web page (verify by call)' : 'Inside the app'}</span></td>
            <td style={{ maxWidth: 320 }}>{r.reason || ''}</td>
            <td className="muted">{timeAgo(r.created_at)}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{r.status === 'pending'
              ? <><button className="btn warn sm" disabled={busy === r.id} onClick={() => remove(r)}>{busy === r.id ? 'Deleting…' : 'Delete account'}</button>{' '}<button className="btn ghost sm" onClick={() => reject(r)}>Do not delete</button></>
              : <span className={'tag ' + (r.status === 'done' ? 'ok' : 'mute')}>{r.status === 'done' ? 'Deleted' : 'Not deleted'}</span>}</td>
          </tr>); })}</tbody>
      </table></div>
      {!list.length && <p className="muted">Nothing here.</p>}
    </section>
  );
}
