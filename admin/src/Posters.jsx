import React, { useEffect, useState } from 'react';
import { supabase, fetchAll, timeAgo, callFn } from './lib.js';
import { Download, X, ImageIcon } from './icons.jsx';

// Posters and banners members download from the app's menu and send to their local printer.
export default function Posters() {
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = async () => setRows(await fetchAll('posters', '*', (q) => q.order('created_at', { ascending: false })));
  useEffect(() => { load(); }, []);
  const url = (p) => supabase.storage.from('posters').getPublicUrl(p).data.publicUrl;

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setMsg('This file is over 50 MB. Save it as a smaller JPEG or PDF.'); return; }
    setBusy(true); setMsg('');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('posters').upload(path, file, { contentType: file.type });
    if (error) { setMsg(error.message); setBusy(false); return; }
    const { error: e2 } = await supabase.from('posters').insert({ title: title.trim() || file.name, path, mime: file.type, size_bytes: file.size });
    if (e2) { setMsg(e2.message); setBusy(false); return; }
    let note = 'Uploaded. It shows in the app under ☰ > पोस्टर और बैनर.';
    if (notify) {
      const { error: pe } = await callFn('push', { title: 'नया पोस्टर / बैनर', body: title.trim() || 'डाउनलोड करें और अपने इलाके में लगवाएं', target: 'all', type: 'poster' });
      note += pe ? ' (Notification not sent.)' : ' Members were notified.';
    }
    setMsg(note); setTitle(''); setFile(null); setBusy(false); e.target.reset(); load();
  };
  const remove = async (r) => {
    if (!window.confirm(`Remove "${r.title}" from the app?`)) return;
    await supabase.storage.from('posters').remove([r.path]);
    await supabase.from('posters').delete().eq('id', r.id); load();
  };

  return (
    <>
      <section className="card">
        <h2>Posters and banners</h2>
        <p className="sub">Upload a JPEG, PNG or PDF (up to 50 MB). Every member sees it in the app menu, can download it, or open it in WhatsApp to send to their printer.</p>
        {msg && <div className="notice ok">{msg}</div>}
        <form className="form" onSubmit={upload}>
          <label>Name shown in the app<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="न्याय यात्रा होर्डिंग 20x10" /></label>
          <label>File<input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required /></label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Notify all members</label>
          <div><button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button></div>
        </form>
      </section>
      <section className="card">
        <h2>In the app ({rows.length})</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginTop: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: '1px solid #E3E6EB', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              {String(r.mime).startsWith('image/') ? <img src={url(r.path)} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                : <div style={{ height: 140, display: 'grid', placeItems: 'center', background: '#F2F4F8' }}><ImageIcon size={32} /></div>}
              <div style={{ padding: 10 }}>
                <b style={{ fontSize: 13.5 }}>{r.title}</b>
                <div className="muted" style={{ fontSize: 12 }}>{timeAgo(r.created_at)} · {(Number(r.size_bytes || 0) / 1048576).toFixed(1)} MB</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <a className="btn ghost sm" href={url(r.path)} target="_blank" rel="noreferrer"><Download size={13} />Open</a>
                  <button className="btn warn sm" onClick={() => remove(r)}><X size={13} />Remove</button>
                </div>
              </div>
            </div>))}
        </div>
      </section>
    </>
  );
}
