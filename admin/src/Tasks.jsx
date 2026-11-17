import React, { useEffect, useState } from 'react';
import { supabase, istToday, dayLabel, callFn, PLATFORMS, platformOf, taskNotice } from './lib.js';
import { Facebook, Instagram, Twitter, MessageCircle } from './icons.jsx';

const PLATFORM_ICON = { facebook: Facebook, instagram: Instagram, x: Twitter, whatsapp: MessageCircle };

// Ready-made titles for share cards, by platform, so nobody retypes them.
const SHARE_TITLES = {
  x: 'देवेंद्र यादव जी की X (ट्विटर) पोस्ट को लाइक और रीपोस्ट करें। साथ ही कमेंट में अपनी राय भी साझा करें।',
  instagram: 'देवेंद्र यादव जी की Instagram पोस्ट को लाइक करें, कम से कम 10 लोगों को Instagram पर फॉरवर्ड करें, पोस्ट को रीपोस्ट करें और कमेंट करके अपनी राय भी साझा करें।',
  facebook: 'देवेंद्र यादव जी की Facebook पोस्ट को लाइक करें, अपने फेसबुक अकाउंट से शेयर करें और कमेंट करके अपनी राय भी साझा करें।',
};
/** Puts the platform's ready-made title in, unless the admin has typed their own. */
const withPreset = (f) => {
  const untouched = !f.title || Object.values(SHARE_TITLES).includes(f.title);
  if (f.kind === 'share' && untouched) return { ...f, title: SHARE_TITLES[f.platform] || '' };
  if (f.kind === 'upload' && Object.values(SHARE_TITLES).includes(f.title)) return { ...f, title: '' };
  return f;
};
const EMPTY = { audience: 'all', type_label: '', platform: 'facebook', task_date: istToday(), sort: 1, kind: 'upload', title: '', description: '', video_slots: 2, allow_photos: true, link_x: '', link_instagram: '', link_facebook: '', link_whatsapp: '' };
const AUDIENCES = [['all', 'Ward members and Block Presidents'], ['member', 'Only ward members'], ['block', 'Only Block Presidents']];
const TASK_COLUMNS = ['audience', 'type_label', 'id', 'task_date', 'sort', 'kind', 'title', 'description', 'video_slots', 'allow_photos', 'link_x', 'link_instagram', 'link_facebook', 'link_whatsapp'];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [notify, setNotify] = useState(true);
  const [types, setTypes] = useState([]);        // custom task types: { id, label, base }
  const [newType, setNewType] = useState(null);  // { label, base } while adding one
  const [date, setDate] = useState(istToday());  // '' = all dates

  const load = async () => {
    const { data } = await supabase.from('tasks').select('*').order('task_date').order('sort');
    setTasks(data || []);
    const { data: ty } = await supabase.from('task_types').select('*').order('label');
    setTypes(ty || []);
  };
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    const row = Object.fromEntries(TASK_COLUMNS.filter((k) => k in form).map((k) => [k, form[k]]));
    // Order in the day is automatic: a new task goes after the ones already on that date.
    if (!form.id) row.sort = Math.max(0, ...tasks.filter((t) => t.task_date === form.task_date).map((t) => t.sort || 0)) + 1;
    else row.sort = Number(form.sort) || 1;
    row.video_slots = 2; row.allow_photos = true;
    // A share card is for one platform: keep only that platform's link.
    for (const p of PLATFORMS) if (row.kind !== 'share' || p.key !== form.platform) row[p.col] = null;
    if (row.kind === 'share' && !row[PLATFORMS.find((p) => p.key === form.platform).col]) { setMsg('Add the post link for the chosen platform.'); return; }
    if (!row.description) row.description = null;
    row.type_label = row.type_label || null; row.audience = row.audience || 'all';
    const isNew = !row.id;
    if (isNew) delete row.id;
    const { data: saved, error } = isNew
      ? await supabase.from('tasks').insert(row).select('id').single()
      : await supabase.from('tasks').update(row).eq('id', row.id).select('id').single();
    if (error) { setMsg(error.message); return; }
    let note = 'Task saved.';
    if (isNew && notify && row.task_date === istToday()) {
      const notice = taskNotice(row);
      const { data, error: pe } = await callFn('push', {
        title: notice.title, body: notice.body,
        target: 'all', type: 'task', ref_id: String(saved.id),
      });
      note += pe ? ` Instant notification failed (${pe}); phones will see it at their next check-in.`
        : data.pushed ? ' Instant notification sent to all members.' : ' Firebase not set up: phones will see it at their next check-in.';
    }
    setMsg(note); setDate(row.task_date); setForm(null); load();
  };

  // The Type dropdown holds the two built-in kinds and every custom type; a custom type works like one of the two.
  const typeValue = (f) => (f.type_label && types.find((t) => t.label === f.type_label) ? 'c:' + f.type_label : f.kind);
  const pickType = (v) => {
    if (v === '+') { setNewType({ label: '', base: 'upload' }); return; }
    if (v.startsWith('c:')) { const t = types.find((x) => x.label === v.slice(2)); setForm(withPreset({ ...form, kind: t.base, type_label: t.label })); }
    else setForm(withPreset({ ...form, kind: v, type_label: '' }));
  };
  const addType = async () => {
    const label = (newType.label || '').trim();
    if (!label) return;
    const { error } = await supabase.from('task_types').insert({ label, base: newType.base });
    if (error) { setMsg(error.message); return; }
    setTypes([...types, { label, base: newType.base }].sort((a, b) => a.label.localeCompare(b.label)));
    setForm(withPreset({ ...form, kind: newType.base, type_label: label })); setNewType(null);
  };
  const removeType = async (t) => {
    if (!window.confirm('Remove the type "' + t.label + '"? Tasks already made with it stay as they are.')) return;
    await supabase.from('task_types').delete().eq('label', t.label);
    setTypes(types.filter((x) => x.label !== t.label));
  };

  const remove = async (t) => {
    if (!window.confirm('Delete "' + t.title + '"? Uploads for it will also be removed from the dashboard.')) return;
    await supabase.from('tasks').delete().eq('id', t.id);
    load();
  };

  const dates = [...new Set(tasks.map((t) => t.task_date))];

  return (
    <>
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h2>Tasks</h2>
            <p className="sub">Every upload task needs 2 photos and 2 videos, and gives 100 points once all 4 are in. A share card is for one platform (Facebook, Instagram, X or WhatsApp): pick it, then paste the post link. It shows on the app home screen and right after a member completes a task. Each share earns 100 points. Notifications use the task's own title and details.</p>
          </div>
          <button className="btn" onClick={() => setForm({ ...EMPTY })}>+ New task</button>
        </div>
        {msg && <div className="notice ok" style={{ marginTop: 12 }}>{msg}</div>}

        {form && (
          <form onSubmit={save} className="card" style={{ marginTop: 14, background: '#F8F9FB' }}>
            <h2>{form.id ? 'Edit task' : 'New task'}</h2>
            <div className="form">
              <label>Date<input type="date" value={form.task_date} onChange={set('task_date')} required /></label>
              <label>Type
                <select value={typeValue(form)} onChange={(e) => pickType(e.target.value)}>
                  <option value="upload">Task with video upload</option>
                  <option value="share">Share card (watch and reshare)</option>
                  {types.map((t) => <option key={t.label} value={'c:' + t.label}>{t.label}</option>)}
                  <option value="+">+ Add a new type…</option>
                </select>
              </label>
              <label>For
                <select value={form.audience || 'all'} onChange={set('audience')}>
                  {AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              {form.kind === 'upload' && (
                <label>Uploads needed<input value="2 photos + 2 videos (100 points)" disabled /></label>
              )}
              {form.kind === 'share' && (
                <label>Platform
                  <select value={form.platform} onChange={(e) => setForm(withPreset({ ...form, platform: e.target.value }))}>
                    {PLATFORMS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                  </select>
                </label>
              )}
            </div>
            {newType && (
              <div className="notice" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <b>New task type</b>
                <input type="text" placeholder="Name, e.g. जनसंपर्क, बैठक, धरना" value={newType.label} onChange={(e) => setNewType({ ...newType, label: e.target.value })} style={{ minWidth: 220 }} />
                <select value={newType.base} onChange={(e) => setNewType({ ...newType, base: e.target.value })}>
                  <option value="upload">Works like an upload task (2 photos + 2 videos)</option>
                  <option value="share">Works like a share card (post link)</option>
                </select>
                <button type="button" className="btn sm" onClick={addType}>Add type</button>
                <button type="button" className="btn ghost sm" onClick={() => setNewType(null)}>Cancel</button>
              </div>
            )}
            {types.length > 0 && (
              <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>Your types: {types.map((t) => (
                <span key={t.label} className="tag mute" style={{ marginRight: 6 }}>{t.label} <a href="#" onClick={(e) => { e.preventDefault(); removeType(t); }} title="Remove this type">×</a></span>))}</p>
            )}
            {form.kind === 'share' && (() => {
              const p = PLATFORMS.find((x) => x.key === form.platform) || PLATFORMS[0];
              return (
                <div className="form" style={{ gridTemplateColumns: '1fr' }}>
                  <label>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{React.createElement(PLATFORM_ICON[p.key], { size: 15 })}{p.field}</span>
                    {p.key === 'whatsapp'
                      ? <textarea rows="2" className="big" value={form[p.col] || ''} onChange={set(p.col)} placeholder={p.placeholder} required />
                      : <input type="url" className="big" value={form[p.col] || ''} onChange={set(p.col)} placeholder={p.placeholder} required />}
                  </label>
                </div>
              );
            })()}
            <div className="form" style={{ gridTemplateColumns: '1fr' }}>
              <label>Title (Hindi){form.kind === 'share' && SHARE_TITLES[form.platform] && <span className="muted" style={{ fontSize: 12 }}>Filled in for the platform. You can still edit it.</span>}
                {form.kind === 'share'
                  ? <textarea rows="2" value={form.title} onChange={set('title')} required />
                  : <input type="text" value={form.title} onChange={set('title')} required placeholder="3 स्थानीय लोगों से वायु प्रदूषण पर बात करें, बाइट रिकॉर्ड करें" />}
              </label>
              <label>Details (optional)<textarea rows="3" value={form.description || ''} onChange={set('description')} /></label>
            </div>
            {!form.id && form.task_date === istToday() && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 10 }}>
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Send an instant notification to all members now
              </label>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn" type="submit">Save</button>
              <button className="btn ghost" type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <div className="filters">
          <label htmlFor="tkdate">Date</label>
          <input id="tkdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className={'btn sm ' + (date === istToday() ? '' : 'ghost')} onClick={() => setDate(istToday())}>Today</button>
          <button className={'btn sm ' + (date ? 'ghost' : '')} onClick={() => setDate('')}>All dates</button>
          <span className="muted" style={{ fontSize: 13 }}>{dates.length} days have tasks so far</span>
        </div>
      </section>
      {dates.filter((d) => !date || d === date).reverse().map((d) => (
        <section key={d} className="card">
          <h2>{dayLabel(d)} {d === istToday() && <span className="tag live" style={{ marginLeft: 6 }}>Today</span>}</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>#</th><th>Type</th><th>Title</th><th>For</th><th>Uploads</th><th /></tr></thead>
              <tbody>
                {tasks.filter((t) => t.task_date === d).map((t) => (
                  <tr key={t.id}>
                    <td>{t.sort}</td>
                    <td><span className={'tag ' + (t.kind === 'upload' ? 'live' : 'mute')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t.kind === 'upload' ? (t.type_label || 'Task') : <>{React.createElement(PLATFORM_ICON[platformOf(t)], { size: 12 })}{t.type_label || 'Share card'}</>}</span></td>
                    <td><b>{t.title}</b>{t.description && <div className="muted" style={{ fontSize: 12 }}>{t.description}</div>}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{t.audience === 'block' ? 'Block Presidents' : t.audience === 'member' ? 'Ward members' : 'Everyone'}</td>
                    <td>{t.kind === 'upload' ? '2 + 2' : '–'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => setForm({ ...t, platform: platformOf(t), type_label: t.type_label || '', audience: t.audience || 'all' })}>Edit</button>{' '}
                      <button className="btn warn" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => remove(t)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {dates.length > 0 && date && !dates.includes(date) && <p className="muted">No task on {dayLabel(date)}. Pick another date or press All dates.</p>}
      {!dates.length && <p className="muted">No tasks yet. Add the first one with + New task.</p>}
    </>
  );
}
