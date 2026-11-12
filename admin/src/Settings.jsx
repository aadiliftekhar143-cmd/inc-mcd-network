import React, { useEffect, useState } from 'react';
import { supabase } from './lib.js';
import { Pencil, Check, X, ExternalLink, Facebook, Instagram, Twitter, Phone, Clock, Smartphone, LinkIcon, Bell } from './icons.jsx';

// Every value the app reads from the settings table, grouped for the page.
const GROUPS = [
  {
    title: 'Devender Yadav ji social media',
    sub: 'Shown in the app under संदेश as "follow" buttons.',
    items: [
      { key: 'social_facebook', label: 'Facebook page link', icon: Facebook, type: 'url' },
      { key: 'social_x', label: 'X (Twitter) profile link', icon: Twitter, type: 'url' },
      { key: 'social_instagram', label: 'Instagram profile link', icon: Instagram, type: 'url' },
    ],
  },
  {
    title: 'Delhi Pradesh Congress Committee social media',
    sub: 'Shown in the app under संदेश, below Devender Yadav ji\'s follow buttons.',
    items: [
      { key: 'dpcc_facebook', label: 'DPCC Facebook page link', icon: Facebook, type: 'url' },
      { key: 'dpcc_x', label: 'DPCC X (Twitter) profile link', icon: Twitter, type: 'url' },
      { key: 'dpcc_instagram', label: 'DPCC Instagram profile link', icon: Instagram, type: 'url' },
    ],
  },
  {
    title: 'Helpline and reminders',
    items: [
      { key: 'helpline', label: 'Helpline number (login screen and app footer)', icon: Phone, type: 'tel' },
      { key: 'reminder_hours', label: 'Reminder hours (24-hour clock, comma separated)', icon: Clock, type: 'text', hint: 'e.g. 7,10,13,16,19,22' },
    ],
  },
  {
    title: 'App update',
    sub: 'Raise the version code to make phones on an older version show the update prompt.',
    items: [
      { key: 'app_version_code', label: 'Latest version code (number, e.g. 5)', icon: Smartphone, type: 'number' },
      { key: 'app_version_name', label: 'Latest version name (e.g. 1.4)', icon: Smartphone, type: 'text' },
      { key: 'app_download_url', label: 'APK download link', icon: LinkIcon, type: 'url' },
      { key: 'app_update_notes', label: 'Update message shown to members (Hindi)', icon: Bell, type: 'textarea' },
      { key: 'app_update_mandatory', label: 'Mandatory update?', icon: Bell, type: 'bool' },
    ],
  },
];

function SettingItem({ item, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const save = async () => {
    setBusy(true); setErr('');
    const e = await onSave(item.key, String(draft ?? '').trim());
    setBusy(false);
    if (e) setErr(e); else setEditing(false);
  };
  const Icon = item.icon;
  const isLink = item.type === 'url' && /^https?:\/\//.test(value || '');

  return (
    <div className="set-item">
      <div className="lbl"><Icon size={14} />{item.label}</div>
      {editing ? (
        item.type === 'textarea' ? <textarea rows="3" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          : item.type === 'bool' ? (
            <select value={draft === 'true' ? 'true' : 'false'} onChange={(e) => setDraft(e.target.value)}>
              <option value="false">No, members can skip it</option>
              <option value="true">Yes, members must update</option>
            </select>
          ) : <input type={item.type === 'number' ? 'number' : item.type === 'tel' ? 'tel' : 'text'} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={item.hint} autoFocus />
      ) : (
        <div className={'val' + (value ? '' : ' empty')}>
          {!value ? 'Not set'
            : item.type === 'bool' ? (value === 'true' ? 'Yes, must update' : 'No')
            : isLink ? <a href={value} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{value}<ExternalLink size={13} /></a>
            : value}
        </div>
      )}
      {err && <div className="notice">{err}</div>}
      <div className="acts">
        {editing ? (
          <>
            <button className="btn sm" onClick={save} disabled={busy}><Check size={14} />{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn ghost sm" onClick={() => { setEditing(false); setErr(''); }} disabled={busy}><X size={14} />Cancel</button>
          </>
        ) : (
          <button className="btn ghost sm" onClick={() => setEditing(true)}><Pencil size={13} />Edit</button>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [note, setNote] = useState('');

  const load = async () => {
    const { data } = await supabase.from('settings').select('*');
    setSettings(Object.fromEntries((data || []).map((r) => [r.key, r.value || ''])));
  };
  useEffect(() => { load(); }, []);

  const saveOne = async (key, value) => {
    const { error } = await supabase.from('settings').upsert({ key, value });
    if (error) return error.message;
    setSettings((s) => ({ ...s, [key]: value }));
    setNote('Saved. The app picks this up the next time it opens.');
    return null;
  };

  return (
    <>
      {note && <div className="notice ok">{note}</div>}
      {GROUPS.map((g) => (
        <section key={g.title} className="card">
          <h2>{g.title}</h2>
          {g.sub && <p className="sub">{g.sub}</p>}
          <div className="set-grid">
            {g.items.map((it) => <SettingItem key={it.key} item={it} value={settings[it.key] || ''} onSave={saveOne} />)}
          </div>
        </section>
      ))}
    </>
  );
}
