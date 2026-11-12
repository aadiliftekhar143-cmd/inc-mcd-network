import React, { useEffect, useState } from 'react';
import { supabase, wardLabel, callFn, fetchAll, districtOf } from './lib.js';


export default function Reminders() {
  const [ann, setAnn] = useState([]);
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [ward, setWard] = useState('1');
  const [zone, setZone] = useState('');
  const [title, setTitle] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [districts, setDistricts] = useState([]);

  const load = async () => {
    const { data: a } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(30);
    setAnn(a || []);
  };
  useEffect(() => {
    load();
    fetchAll('members', 'district, zone').then((rows) => setDistricts([...new Set(rows.map(districtOf).filter(Boolean))].sort()));
  }, []);

  const send = async (e) => {
    e.preventDefault();
    setSending(true); setResult(null);
    // The push function saves the announcement and sends an instant high-priority notification.
    const { data, error } = await callFn('push', {
      title: title.trim() || 'INC MCD NETWORK', body,
      target: target === 'zone' ? 'district' : target,
      ward_no: Number(ward), district: zone, type: 'announcement', save_announcement: true,
    });
    if (error) {
      // Fallback: save the announcement directly so phones still get it at their next check-in.
      const row = { title: title.trim() || null, body, only_pending: target === 'pending', ward_no: target === 'ward' ? Number(ward) : null, district: target === 'zone' ? zone : null, zone: target === 'zone' ? zone : null };
      const { error: e2 } = await supabase.from('announcements').insert(row);
      setResult(e2 ? { ok: false, text: e2.message } : { ok: false, text: `Saved, but the instant push failed (${error}). Phones will get it at their next check-in.` });
    } else if (!data.pushed) {
      setResult({ ok: false, text: 'Saved. Firebase is not set up yet, so phones will get it at their next check-in (up to 15 min), not instantly.' });
    } else {
      setResult({ ok: true, text: target === 'pending' ? `Sent instantly to ${data.sent} phones.` : 'Sent instantly.' });
    }
    setSending(false); setBody(''); setTitle(''); load();
  };

  return (
    <>
      <section className="card">
        <h2>Send a notification</h2>
        <p className="sub">High priority: lands on phones instantly (when Firebase is set up) and also shows in the app's notification screen. The app also reminds members with pending tasks automatically.</p>
        <form onSubmit={send} className="form">
          <label>Send to
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="all">Everyone</option>
              <option value="pending">Only members with pending tasks today</option>
              <option value="ward">One ward</option>
              <option value="zone">One district</option>
            </select>
          </label>
          {target === 'ward' && <label>Ward<select value={ward} onChange={(e) => setWard(e.target.value)}>{Array.from({ length: 250 }, (_, i) => <option key={i + 1} value={i + 1}>{wardLabel(i + 1)}</option>)}</select></label>}
          {target === 'zone' && <label>District
            <select value={zone} onChange={(e) => setZone(e.target.value)} required>
              <option value="">Choose…</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select></label>}
          <label>Title (optional)<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="INC MCD NETWORK" /></label>
          <label style={{ gridColumn: '1 / -1' }}>Message (Hindi)<textarea rows="2" value={body} onChange={(e) => setBody(e.target.value)} required placeholder="आज के टास्क रात 11:59 तक पूरे करें" /></label>
          <div><button className="btn" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send now'}</button></div>
        </form>
        {result && <div className={'notice' + (result.ok ? ' ok' : '')} style={{ marginTop: 12 }}>{result.text}</div>}
        <div className="tbl">
          <table>
            <thead><tr><th>Sent</th><th>To</th><th>Message</th><th>Pushed</th></tr></thead>
            <tbody>
              {ann.map((a) => (
                <tr key={a.id}><td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString('en-IN')}</td>
                  <td>{a.ward_no ? wardLabel(a.ward_no) : (a.district || a.zone) ? (a.district || a.zone) : a.only_pending ? 'Pending tasks' : 'Everyone'}</td><td>{a.title && <b>{a.title}: </b>}{a.body}</td><td className="muted">{a.pushed_count != null ? 'Yes' : 'Check-in only'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </>
  );
}
