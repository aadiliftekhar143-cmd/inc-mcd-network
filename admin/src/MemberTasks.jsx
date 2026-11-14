import React, { useEffect, useState } from 'react';
import { supabase, fetchAll, timeAgo, wardLabel } from './lib.js';
import { Check, X } from './icons.jsx';

// Tasks members create for work they did on their own (2 photos and 2 videos). 100 points on approval.
export default function MemberTasks() {
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState({});
  const [files, setFiles] = useState({});
  const [status, setStatus] = useState('pending');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const list = await fetchAll('member_tasks', '*', (q) => q.order('created_at', { ascending: false }));
    setRows(list);
    setMembers(Object.fromEntries((await fetchAll('members', 'mobile, name, ward_no, district, zone')).map((m) => [m.mobile, m])));
    const paths = [...new Set(list.filter((r) => r.status === status || status === 'all').slice(0, 60).flatMap((r) => (r.media || []).map((m) => m.path)))];
    if (paths.length) {
      const { data } = await supabase.storage.from('uploads').createSignedUrls(paths, 3600);
      setFiles(Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])));
    }
  };
  useEffect(() => { load(); }, [status]);

  const review = async (r, ok) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('member_tasks').update({ status: ok ? 'approved' : 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: u?.user?.email || 'admin' }).eq('id', r.id);
    setMsg(error ? error.message : ok ? 'Approved. 100 points added to the member.' : 'Rejected.');
    load();
  };
  const list = rows.filter((r) => status === 'all' || r.status === status);
  const count = (s) => rows.filter((r) => r.status === s).length;

  return (
    <section className="card">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h2>Member tasks</h2>
          <p className="sub">Work members did on their own, with 2 photos and 2 videos. Check that it really happened. Approving adds 100 points.</p>
        </div>
        <div className="seg">
          {[['pending', `Waiting ${count('pending')}`], ['approved', `Approved ${count('approved')}`], ['rejected', `Rejected ${count('rejected')}`], ['all', 'All']].map(([k, l]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>))}
        </div>
      </div>
      {msg && <div className="notice ok" style={{ marginTop: 10 }}>{msg}</div>}
      {list.map((r) => { const m = members[r.mobile] || {}; return (
        <div key={r.id} style={{ borderTop: '1px solid #E3E6EB', padding: '14px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div><b>{r.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{m.name || r.mobile} · {r.mobile} · {m.ward_no ? wardLabel(m.ward_no) : ''} · {timeAgo(r.created_at)}</div></div>
            {r.status === 'pending'
              ? <div style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => review(r, true)}><Check size={14} />Approve</button>{' '}<button className="btn warn sm" onClick={() => review(r, false)}><X size={14} />Reject</button></div>
              : <span className={'tag ' + (r.status === 'approved' ? 'live' : 'mute')}>{r.status === 'approved' ? 'Approved' : 'Rejected'}</span>}
          </div>
          {r.description && <p style={{ margin: '6px 0' }}>{r.description}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(r.media || []).map((x) => files[x.path] ? (x.kind === 'video'
              ? <video key={x.path} src={files[x.path]} controls style={{ width: 200, borderRadius: 8 }} />
              : <a key={x.path} href={files[x.path]} target="_blank" rel="noreferrer"><img src={files[x.path]} alt="" style={{ width: 140, height: 105, objectFit: 'cover', borderRadius: 8 }} /></a>) : null)}
          </div>
        </div>); })}
      {!list.length && <p className="muted">Nothing here.</p>}
    </section>
  );
}
