import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, fetchAll, fmt, timeAgo, istToday } from './lib.js';

/** 10-digit Indian mobile from any input, or empty. */
const mobile10 = (v) => { const d = String(v || '').replace(/\D/g, '').slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; };
import { Users, ClipboardList, UserCheck, Check, X, Download, ImageIcon } from './icons.jsx';

const ROLES = [
  ['president', 'DPCC President'],
  ['gs', 'General Secretary'],
  ['dp', 'District President'],
  ['observer', 'Assembly Observer'],
];
const roleName = (r) => (ROLES.find(([k]) => k === r) || [r, r])[1];
const LEVELS = [['gs', 'General Secretary'], ['dp', 'District Presidents'], ['observer', 'Assembly Observers']];
const PRESIDENT = 'माननीय दिल्ली प्रदेश कांग्रेस कमेटी अध्यक्ष देवेन्द्र यादव जी';

/** Signed links for private files (voice notes, photos, videos). */
async function signAll(paths) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return {};
  const { data } = await supabase.storage.from('uploads').createSignedUrls(list, 3600);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

// ---------------------------------------------------------------- People

function People() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ name: '', mobile: '', role: 'observer', district: '', assembly: '' });
  const load = async () => setRows(await fetchAll('leaders', '*', (q) => q.order('role').order('name')));
  useEffect(() => { load(); }, []);

  const save = async (list) => {
    const clean = list.map((r) => ({
      name: String(r.name || '').trim(), mobile: mobile10(r.mobile), role: String(r.role || '').trim().toLowerCase(),
      district: String(r.district || '').trim() || null, assembly: String(r.assembly || '').trim() || null, active: true,
    }));
    const bad = clean.filter((r) => !r.name || !r.mobile || !ROLES.some(([k]) => k === r.role));
    const good = clean.filter((r) => !bad.includes(r));
    if (good.length) {
      const { error } = await supabase.from('leaders').upsert(good);
      if (error) { setMsg(error.message); return; }
    }
    setMsg(`${good.length} saved${bad.length ? `, ${bad.length} skipped (name, 10-digit mobile and role president / gs / dp / observer are needed)` : ''}.`);
    load();
  };

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const wb = XLSX.read(await file.arrayBuffer());
    const list = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v])));
    await save(list); e.target.value = '';
  };
  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['name', 'mobile', 'role', 'district', 'assembly'],
      ['Devender Yadav', '9800000001', 'president', '', ''],
      ['General Secretary name', '9800000002', 'gs', '', ''],
      ['District President name', '9800000003', 'dp', 'Central', ''],
      ['Observer name', '9800000004', 'observer', 'Central', '20 - Chandni Chowk'],
    ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'leaders');
    XLSX.writeFile(wb, 'leaders-template.xlsx');
  };
  const toggle = async (r) => { await supabase.from('leaders').update({ active: !r.active }).eq('mobile', r.mobile); load(); };

  const count = (k) => rows.filter((r) => r.role === k && r.active).length;
  return (
    <>
      <section className="kpis">
        {ROLES.map(([k, l]) => <div key={k} className="card kpi"><div className="l">{l}</div><div className="v">{count(k)}</div></div>)}
      </section>
      <section className="card">
        <h2>Leader logins</h2>
        <p className="sub">The login number decides which app opens. District names must match the member list, and an observer's assembly must match members' assembly exactly (for example "20 - Chandni Chowk"), or their numbers will be empty.</p>
        {msg && <div className="notice ok">{msg}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
          <label className="btn">Upload Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={upload} hidden /></label>
          <button className="btn ghost" onClick={template}><Download size={14} /> Template</button>
        </div>
        <form className="form" onSubmit={(e) => { e.preventDefault(); save([form]); setForm({ ...form, name: '', mobile: '' }); }}>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Mobile<input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required /></label>
          <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>District<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
          <label>Assembly (observers)<input value={form.assembly} onChange={(e) => setForm({ ...form, assembly: e.target.value })} /></label>
          <div><button className="btn" type="submit">Add or update</button></div>
        </form>
        <div className="tbl">
          <table>
            <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>District</th><th>Assembly</th><th>Last active</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.mobile} style={{ opacity: r.active ? 1 : 0.5 }}>
                <td><b>{r.name}</b></td><td>{r.mobile}</td><td>{roleName(r.role)}</td><td>{r.district || '–'}</td><td>{r.assembly || '–'}</td>
                <td className="muted">{r.last_active_at ? timeAgo(r.last_active_at) : r.first_login_at ? 'Logged in' : 'Never'}</td>
                <td><button className="btn ghost sm" onClick={() => toggle(r)}>{r.active ? 'Turn off' : 'Turn on'}</button></td>
              </tr>))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- Tasks for leaders

function LeaderTasks() {
  const [tasks, setTasks] = useState([]);
  const [done, setDone] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ level: 'dp', title: '', description: '', due_date: '', target_district: '', target_assembly: '' });
  const load = async () => {
    setTasks(await fetchAll('leader_tasks', '*', (q) => q.order('created_at', { ascending: false })));
    setDone(await fetchAll('leader_task_done', 'task_id, mobile'));
    setLeaders(await fetchAll('leaders', 'mobile, name, role, district, assembly', (q) => q.eq('active', true)));
  };
  useEffect(() => { load(); }, []);
  const districts = [...new Set(leaders.map((l) => l.district).filter(Boolean))].sort();
  const assemblies = [...new Set(leaders.filter((l) => l.role === 'observer').map((l) => l.assembly).filter(Boolean))].sort();

  const push = async (e) => {
    e.preventDefault();
    const row = { ...form, status: 'active', created_by: 'admin' };
    for (const k of ['description', 'due_date', 'target_district', 'target_assembly']) if (!row[k]) row[k] = null;
    const { error } = await supabase.from('leader_tasks').insert(row);
    setMsg(error ? error.message : `Task sent. It shows in their app as coming from ${PRESIDENT}.`);
    if (!error) setForm({ ...form, title: '', description: '' });
    load();
  };
  const setStatus = async (t, status) => { await supabase.from('leader_tasks').update({ status, approved_at: status === 'active' ? new Date().toISOString() : null }).eq('id', t.id); load(); };
  const reach = (t) => leaders.filter((l) => l.role === t.level && (!t.target_district || l.district === t.target_district)
    && (!t.target_assembly || l.assembly === t.target_assembly) && (!t.target_mobile || l.mobile === t.target_mobile));
  const by = (t) => (t.created_by === 'admin' ? 'Admin' : `${roleName(t.created_by)}${t.created_by_mobile ? ' · ' + (leaders.find((l) => l.mobile === t.created_by_mobile)?.name || t.created_by_mobile) : ''}`);

  const waiting = tasks.filter((t) => t.status === 'suggested' || t.status === 'pending');
  return (
    <>
      <section className="card">
        <h2>Push a task to leaders</h2>
        <p className="sub">Every task shows in the app as coming from {PRESIDENT}.</p>
        {msg && <div className="notice ok">{msg}</div>}
        <form className="form" onSubmit={push}>
          <label>Level<select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {form.level !== 'gs' && <label>District (optional)<select value={form.target_district} onChange={(e) => setForm({ ...form, target_district: e.target.value })}><option value="">All</option>{districts.map((d) => <option key={d}>{d}</option>)}</select></label>}
          {form.level === 'observer' && <label>Assembly (optional)<select value={form.target_assembly} onChange={(e) => setForm({ ...form, target_assembly: e.target.value })}><option value="">All</option>{assemblies.map((d) => <option key={d}>{d}</option>)}</select></label>}
          <label>Last date (optional)<input type="date" min={istToday()} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Task (Hindi)<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label style={{ gridColumn: '1 / -1' }}>Details (optional)<textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div><button className="btn" type="submit">Send task</button></div>
        </form>
      </section>

      <section className="card">
        <h2>Waiting ({waiting.length})</h2>
        <p className="sub">Task ideas from District Presidents and Observers, and General Secretary tasks still waiting for the President. Approving sends them out as from the President.</p>
        <div className="tbl"><table>
          <thead><tr><th>Task</th><th>For</th><th>From</th><th>When</th><th /></tr></thead>
          <tbody>{waiting.map((t) => (
            <tr key={t.id}><td><b>{t.title}</b>{t.description && <div className="muted" style={{ fontSize: 12 }}>{t.description}</div>}</td>
              <td>{roleName(t.level)}{t.target_district ? ' · ' + t.target_district : ''}{t.target_assembly ? ' · ' + t.target_assembly : ''}</td>
              <td>{by(t)}{t.status === 'pending' && <div className="muted" style={{ fontSize: 12 }}>Waiting for the President</div>}</td>
              <td className="muted">{timeAgo(t.created_at)}</td>
              <td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => setStatus(t, 'active')}><Check size={14} />Approve</button>{' '}<button className="btn warn sm" onClick={() => setStatus(t, 'rejected')}><X size={14} />Reject</button></td></tr>))}</tbody>
        </table></div>
        {!waiting.length && <p className="muted">Nothing waiting.</p>}
      </section>

      <section className="card">
        <h2>Live tasks</h2>
        <div className="tbl"><table>
          <thead><tr><th>Task</th><th>For</th><th>Given by</th><th>Done</th><th /></tr></thead>
          <tbody>{tasks.filter((t) => t.status === 'active').map((t) => {
            const who = reach(t), d = new Set(done.filter((x) => x.task_id === t.id).map((x) => x.mobile));
            return (<tr key={t.id}><td><b>{t.title}</b><div className="muted" style={{ fontSize: 12 }}>{t.due_date ? 'By ' + t.due_date : ''}</div></td>
              <td>{roleName(t.level)}{t.target_district ? ' · ' + t.target_district : ''}{t.target_assembly ? ' · ' + t.target_assembly : ''}</td>
              <td>{by(t)}</td>
              <td><b>{who.filter((l) => d.has(l.mobile)).length}/{who.length}</b></td>
              <td><button className="btn ghost sm" onClick={() => setStatus(t, 'rejected')}>Remove</button></td></tr>);
          })}</tbody>
        </table></div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- Message approvals (District Presidents and Observers)

function Approvals() {
  const [rows, setRows] = useState([]);
  const [files, setFiles] = useState({});
  const [leaders, setLeaders] = useState({});
  const [msg, setMsg] = useState('');
  const load = async () => {
    const list = await fetchAll('leader_broadcasts', '*', (q) => q.order('created_at', { ascending: false }).limit(300));
    setRows(list);
    setFiles(await signAll(list.map((r) => r.audio_path)));
    setLeaders(Object.fromEntries((await fetchAll('leaders', 'mobile, name, role')).map((l) => [l.mobile, l])));
  };
  useEffect(() => { load(); }, []);
  const review = async (r, ok) => {
    setMsg('');
    if (!ok) { await supabase.from('leader_broadcasts').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', r.id); load(); return; }
    // Approve: put it in each recipient's inbox.
    const sender = leaders[r.from_mobile] || { name: '', role: r.from_role };
    const label = { gs: 'महासचिव', dp: 'ज़िला अध्यक्ष', observer: 'विधानसभा ऑब्ज़र्वर' }[r.from_role] || '';
    let to = [];
    if (r.audience === 'member') {
      const ms = await fetchAll('members', 'mobile, district, zone, assembly', (q) => q.eq('active', true));
      to = ms.filter((m) => (!r.district || (m.district || m.zone || '').trim().toLowerCase() === r.district.trim().toLowerCase())
        && (!r.assembly || (m.assembly || '').trim().toLowerCase() === r.assembly.trim().toLowerCase())).map((m) => m.mobile);
    } else {
      const ls = await fetchAll('leaders', 'mobile, role, district, assembly', (q) => q.eq('active', true));
      to = ls.filter((l) => l.role === r.audience && (!r.district || (l.district || '').toLowerCase() === r.district.toLowerCase())
        && (!r.assembly || (l.assembly || '').toLowerCase() === r.assembly.toLowerCase())).map((l) => l.mobile);
    }
    for (let i = 0; i < to.length; i += 500) {
      const { error } = await supabase.from('inbox').insert(to.slice(i, i + 500).map((m) => ({
        to_mobile: m, from_name: `${sender.name} (${label})`, from_role: r.from_role, kind: 'broadcast', text: r.text, audio_path: r.audio_path, broadcast_id: r.id,
      })));
      if (error) { setMsg(error.message); return; }
    }
    await supabase.from('leader_broadcasts').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', r.id);
    setMsg(`Approved and delivered to ${fmt(to.length)} inboxes.`);
    load();
  };
  const audience = { member: 'Ward members', observer: 'Observers', dp: 'District Presidents', gs: 'General Secretary', all: 'Everyone' };
  const pending = rows.filter((r) => r.status === 'pending');
  return (
    <section className="card">
      <h2>Messages waiting for approval ({pending.length})</h2>
      <p className="sub">District President and Observer messages wait here. They are not told it needs approval. President and General Secretary messages go out at once.</p>
      {msg && <div className="notice ok">{msg}</div>}
      <div className="tbl"><table>
        <thead><tr><th>From</th><th>To</th><th>Message</th><th>When</th><th /></tr></thead>
        <tbody>{rows.slice(0, 100).map((r) => (
          <tr key={r.id}>
            <td><b>{leaders[r.from_mobile]?.name || r.from_mobile}</b><div className="muted" style={{ fontSize: 12 }}>{roleName(r.from_role)}</div></td>
            <td>{audience[r.audience] || r.audience}{r.district ? ' · ' + r.district : ''}{r.assembly ? ' · ' + r.assembly : ''}</td>
            <td style={{ maxWidth: 420 }}>{r.text}{r.audio_path && files[r.audio_path] && <audio controls src={files[r.audio_path]} style={{ display: 'block', marginTop: 6, width: 260 }} />}</td>
            <td className="muted">{timeAgo(r.created_at)}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{r.status === 'pending'
              ? <><button className="btn sm" onClick={() => review(r, true)}><Check size={14} />Approve</button>{' '}<button className="btn warn sm" onClick={() => review(r, false)}><X size={14} />Reject</button></>
              : <span className={'tag ' + (r.status === 'approved' ? 'live' : 'mute')}>{r.status === 'approved' ? 'Sent' : 'Rejected'}</span>}</td>
          </tr>))}</tbody>
      </table></div>
    </section>
  );
}

// ---------------------------------------------------------------- Field reports and calls

function Reports() {
  const [rows, setRows] = useState([]);
  const [calls, setCalls] = useState([]);
  const [files, setFiles] = useState({});
  const [leaders, setLeaders] = useState({});
  useEffect(() => { (async () => {
    const list = await fetchAll('field_reports', '*', (q) => q.order('created_at', { ascending: false }).limit(200));
    setRows(list);
    setFiles(await signAll(list.flatMap((r) => [r.audio_path, ...(r.media || []).map((m) => m.path)])));
    setLeaders(Object.fromEntries((await fetchAll('leaders', 'mobile, name, role, district, assembly')).map((l) => [l.mobile, l])));
    setCalls(await fetchAll('leader_calls', '*', (q) => q.order('created_at', { ascending: false }).limit(300)));
  })(); }, []);
  return (
    <>
      <section className="card">
        <h2>Field reports ({rows.length})</h2>
        {rows.map((r) => { const l = leaders[r.mobile] || {}; return (
          <div key={r.id} style={{ borderTop: '1px solid #E3E6EB', padding: '12px 0' }}>
            <b>{l.name || r.mobile}</b> <span className="muted">· {roleName(l.role)} · {l.assembly || l.district || ''} · {timeAgo(r.created_at)}</span>
            {r.note && <p style={{ margin: '6px 0' }}>{r.note}</p>}
            {r.audio_path && files[r.audio_path] && <audio controls src={files[r.audio_path]} style={{ width: 280 }} />}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {(r.media || []).map((m) => files[m.path] && (m.kind === 'video'
                ? <video key={m.path} src={files[m.path]} controls style={{ width: 180, borderRadius: 8 }} />
                : <a key={m.path} href={files[m.path]} target="_blank" rel="noreferrer"><img src={files[m.path]} alt="" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8 }} /></a>))}
            </div>
            {r.lat != null && <a className="muted" style={{ fontSize: 12 }} href={`https://maps.google.com/?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer">Location from the phone: {r.lat.toFixed(5)}, {r.lng.toFixed(5)}</a>}
          </div>); })}
        {!rows.length && <p className="muted"><ImageIcon size={14} /> No reports yet.</p>}
      </section>
      <section className="card">
        <h2>Leader calls ({calls.length})</h2>
        <div className="tbl"><table>
          <thead><tr><th>By</th><th>To</th><th>Result</th><th>When</th></tr></thead>
          <tbody>{calls.map((c) => (<tr key={c.id}><td>{leaders[c.by_mobile]?.name || c.by_mobile}</td><td>{c.to_name || c.to_mobile}<div className="muted" style={{ fontSize: 12 }}>{c.to_role}</div></td><td>{c.outcome}</td><td className="muted">{timeAgo(c.created_at)}</td></tr>))}</tbody>
        </table></div>
      </section>
    </>
  );
}

export default function Leaders() {
  const [sub, setSub] = useState('people');
  return (
    <>
      <div className="seg" style={{ marginBottom: 14 }}>
        {[['people', 'People', Users], ['tasks', 'Tasks', ClipboardList], ['approvals', 'Message approvals', UserCheck], ['reports', 'Field reports and calls', ImageIcon]].map(([k, l, I]) => (
          <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><I size={14} />{l}</button>))}
      </div>
      {sub === 'people' && <People />}
      {sub === 'tasks' && <LeaderTasks />}
      {sub === 'approvals' && <Approvals />}
      {sub === 'reports' && <Reports />}
    </>
  );
}
