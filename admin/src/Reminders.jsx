import React, { useEffect, useState } from 'react';
import { supabase, wardLabel } from './lib.js';

const KEYS = [
  ['social_facebook', 'Devender Yadav ji Facebook page link'],
  ['social_x', 'Devender Yadav ji X (Twitter) profile link'],
  ['social_instagram', 'Devender Yadav ji Instagram profile link'],
  ['helpline', 'Helpline number shown on the login screen'],
  ['reminder_hours', 'Reminder hours (24-hour clock, comma separated)'],
  ['app_version_code', 'Android App Latest Version Code (Integer, e.g. 2)'],
  ['app_version_name', 'Android App Latest Version Name (e.g. 1.1)'],
  ['app_download_url', 'APK Download Link URL (e.g. https://ward-sadasya.vercel.app/download.html)'],
  ['app_update_notes', 'App Update Message shown to members (Hindi)'],
  ['app_update_mandatory', 'Mandatory update? (true / false)'],
];

export default function Reminders() {
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState('');
  const [ann, setAnn] = useState([]);
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [ward, setWard] = useState('1');
  const [zone, setZone] = useState('');

  const load = async () => {
    const { data } = await supabase.from('settings').select('*');
    setSettings(Object.fromEntries((data || []).map((r) => [r.key, r.value || ''])));
    const { data: a } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(30);
    setAnn(a || []);
  };
  useEffect(() => { load(); }, []);

  const saveSettings = async (e) => {
    e.preventDefault();
    const rows = KEYS.map(([key]) => ({ key, value: settings[key] || '' }));
    const { error } = await supabase.from('settings').upsert(rows);
    setSaved(error ? error.message : 'Saved. The app picks this up on next open.');
  };

  const send = async (e) => {
    e.preventDefault();
    const row = { body, only_pending: target === 'pending', ward_no: target === 'ward' ? Number(ward) : null, district: target === 'zone' ? zone : null, zone: target === 'zone' ? zone : null };
    await supabase.from('announcements').insert(row);
    setBody(''); load();
  };

  return (
    <>
      <section className="card">
        <h2>Reminders</h2>
        <p className="sub">The app checks in at these hours (7 am to 10 pm). Members with pending tasks get a notification. Messages below go out at the next check, or when the member opens the app.</p>
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
          {target === 'zone' && <label>District name (as in the Excel)<input type="text" value={zone} onChange={(e) => setZone(e.target.value)} required /></label>}
          <label style={{ gridColumn: '1 / -1' }}>Message (Hindi)<input type="text" value={body} onChange={(e) => setBody(e.target.value)} required placeholder="आज के काम रात 11:59 तक पूरे करें" /></label>
          <div><button className="btn" type="submit">Send</button></div>
        </form>
        <div className="tbl">
          <table>
            <thead><tr><th>Sent</th><th>To</th><th>Message</th></tr></thead>
            <tbody>
              {ann.map((a) => (
                <tr key={a.id}><td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString('en-IN')}</td>
                  <td>{a.ward_no ? wardLabel(a.ward_no) : (a.district || a.zone) ? (a.district || a.zone) : a.only_pending ? 'Pending tasks' : 'Everyone'}</td><td>{a.body}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Links and settings</h2>
        <form onSubmit={saveSettings} className="form">
          {KEYS.map(([k, label]) => (
            <label key={k}>{label}<input type="text" value={settings[k] || ''} onChange={(e) => setSettings({ ...settings, [k]: e.target.value })} /></label>
          ))}
          <div style={{ alignSelf: 'end' }}><button className="btn" type="submit">Save</button></div>
        </form>
        {saved && <div className="notice ok" style={{ marginTop: 12 }}>{saved}</div>}
      </section>
    </>
  );
}
