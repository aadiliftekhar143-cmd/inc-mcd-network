import React, { useEffect, useState } from 'react';
import { supabase, istToday, dayLabel } from './lib.js';

const EMPTY = { task_date: istToday(), sort: 1, kind: 'upload', title: '', description: '', video_slots: 3, allow_photos: true, link_x: '', link_instagram: '', link_facebook: '', link_whatsapp: '' };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const { data } = await supabase.from('tasks').select('*').order('task_date').order('sort');
    setTasks(data || []);
  };
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    const row = { ...form, sort: Number(form.sort), video_slots: Number(form.video_slots) };
    for (const k of ['link_x', 'link_instagram', 'link_facebook', 'link_whatsapp', 'description']) if (!row[k]) row[k] = null;
    const { error } = row.id ? await supabase.from('tasks').update(row).eq('id', row.id) : await supabase.from('tasks').insert(row);
    if (error) { setMsg(error.message); return; }
    setMsg('Saved.'); setForm(null); load();
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
            <p className="sub">Upload tasks need at least 1 video to tick. Share cards are not tasks: they show X, Instagram, Facebook and WhatsApp buttons.</p>
          </div>
          <button className="btn" onClick={() => setForm({ ...EMPTY })}>+ New task</button>
        </div>
        {msg && <div className="notice ok" style={{ marginTop: 12 }}>{msg}</div>}

        {form && (
          <form onSubmit={save} className="card" style={{ marginTop: 14, background: '#F8F9FB' }}>
            <h2>{form.id ? 'Edit task' : 'New task'}</h2>
            <div className="form">
              <label>Date<input type="date" value={form.task_date} onChange={set('task_date')} required /></label>
              <label>Order in the day<input type="number" min="1" max="10" value={form.sort} onChange={set('sort')} /></label>
              <label>Type
                <select value={form.kind} onChange={set('kind')}>
                  <option value="upload">Task with video upload</option>
                  <option value="share">Share card (watch and reshare)</option>
                </select>
              </label>
              {form.kind === 'upload' && (
                <label>Number of videos (1 to 5)<input type="number" min="1" max="5" value={form.video_slots} onChange={set('video_slots')} /></label>
              )}
            </div>
            <div className="form" style={{ gridTemplateColumns: '1fr' }}>
              <label>Title (Hindi)<input type="text" value={form.title} onChange={set('title')} required placeholder="3 स्थानीय लोगों से वायु प्रदूषण पर बात करें, बाइट रिकॉर्ड करें" /></label>
              <label>Details (optional)<textarea rows="3" value={form.description || ''} onChange={set('description')} /></label>
            </div>
            {form.kind === 'upload' && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 10 }}>
                <input type="checkbox" checked={form.allow_photos} onChange={set('allow_photos')} /> Show the photo section
              </label>
            )}
            {form.kind === 'share' && (
              <div className="form">
                <label>X (Twitter) post link<input type="text" value={form.link_x || ''} onChange={set('link_x')} placeholder="https://x.com/..." /></label>
                <label>Instagram post link<input type="text" value={form.link_instagram || ''} onChange={set('link_instagram')} /></label>
                <label>Facebook post link<input type="text" value={form.link_facebook || ''} onChange={set('link_facebook')} /></label>
                <label>WhatsApp share text or link<input type="text" value={form.link_whatsapp || ''} onChange={set('link_whatsapp')} placeholder="Text members will forward" /></label>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn" type="submit">Save</button>
              <button className="btn ghost" type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      {dates.map((d, i) => (
        <section key={d} className="card">
          <h2>Day {i + 1} · {dayLabel(d)} {d === istToday() && <span className="tag live" style={{ marginLeft: 6 }}>Today</span>}</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>#</th><th>Type</th><th>Title</th><th>Videos</th><th /></tr></thead>
              <tbody>
                {tasks.filter((t) => t.task_date === d).map((t) => (
                  <tr key={t.id}>
                    <td>{t.sort}</td>
                    <td><span className={'tag ' + (t.kind === 'upload' ? 'live' : 'mute')}>{t.kind === 'upload' ? 'Task' : 'Share card'}</span></td>
                    <td><b>{t.title}</b>{t.description && <div className="muted" style={{ fontSize: 12 }}>{t.description}</div>}</td>
                    <td>{t.kind === 'upload' ? t.video_slots : '–'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => setForm({ ...t })}>Edit</button>{' '}
                      <button className="btn warn" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => remove(t)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!dates.length && <p className="muted">No tasks yet. Add the first one with + New task.</p>}
    </>
  );
}
