import React, { useEffect, useState } from 'react';
import { supabase, fmt } from './lib.js';

export default function Messages() {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = async () => {
    const { data: msgs } = await supabase.from('leader_messages').select('*').order('published_at', { ascending: false });
    const withViews = await Promise.all((msgs || []).map(async (m) => {
      const { count } = await supabase.from('message_views').select('mobile', { count: 'exact', head: true }).eq('message_id', m.id);
      return { ...m, views: count || 0, url: supabase.storage.from('leader').getPublicUrl(m.path).data.publicUrl };
    }));
    setList(withViews);
  };
  useEffect(() => { load(); }, []);

  const publish = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setNote(null);
    const kind = file.type.startsWith('audio') ? 'audio' : 'video';
    const ext = (file.name.split('.').pop() || (kind === 'audio' ? 'mp3' : 'mp4')).toLowerCase();
    const path = `${Date.now()}.${ext}`;
    const up = await supabase.storage.from('leader').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setNote({ ok: false, text: up.error.message }); setBusy(false); return; }
    const { error } = await supabase.from('leader_messages').insert({ title, kind, path });
    if (error) setNote({ ok: false, text: error.message });
    else { setNote({ ok: true, text: 'Published. Members will see it on the home screen and at the next reminder check.' }); setTitle(''); setFile(null); e.target.reset(); load(); }
    setBusy(false);
  };

  const remove = async (m) => {
    if (!window.confirm('Delete "' + m.title + '"?')) return;
    await supabase.storage.from('leader').remove([m.path]);
    await supabase.from('leader_messages').delete().eq('id', m.id);
    load();
  };

  return (
    <>
      <section className="card">
        <h2>New leader message</h2>
        <p className="sub">Landscape video (MP4) or audio (MP3/M4A). Shows on top of every member's home screen.</p>
        <form onSubmit={publish} className="form">
          <label>Title (Hindi)<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="वादों का हिसाब दो, दिल्ली को जवाब दो" /></label>
          <label>File<input type="file" accept="video/*,audio/*" onChange={(e) => setFile(e.target.files[0])} required /></label>
          <div style={{ alignSelf: 'end' }}><button className="btn" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Publish'}</button></div>
        </form>
        {note && <div className={'notice' + (note.ok ? ' ok' : '')} style={{ marginTop: 12 }}>{note.text}</div>}
      </section>

      <section className="card">
        <h2>Published messages</h2>
        <div className="media-grid">
          {list.map((m) => (
            <div key={m.id} className="card" style={{ padding: 12 }}>
              {m.kind === 'video' ? <video src={m.url} controls preload="metadata" /> : <audio src={m.url} controls style={{ width: '100%' }} />}
              <div style={{ marginTop: 8 }}><b>{m.title}</b></div>
              <div className="muted" style={{ fontSize: 12 }}>{new Date(m.published_at).toLocaleString('en-IN')} · {m.kind}</div>
              <div style={{ marginTop: 6, fontSize: 13 }}><b>{fmt(m.views)}</b> members {m.kind === 'audio' ? 'listened' : 'watched'}</div>
              <button className="btn warn" style={{ marginTop: 8, minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => remove(m)}>Delete</button>
            </div>
          ))}
        </div>
        {!list.length && <p className="muted">Nothing published yet.</p>}
      </section>
    </>
  );
}
