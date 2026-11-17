import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, fetchAll, fmt, timeAgo, istToday, istDate, dayLabel, districtOf, wardLabel } from './lib.js';
import Members from './Members.jsx';

/** 10-digit Indian mobile from any input, or empty. */
const mobile10 = (v) => { const d = String(v || '').replace(/\D/g, '').slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; };
import { Users, ClipboardList, UserCheck, Check, X, Download, ImageIcon } from './icons.jsx';

const ROLES = [
  ['president', 'DPCC President'],
  ['gs', 'General Secretary'],
  ['dc', 'District Coordinator'],
  ['dp', 'District President'],
  ['observer', 'Assembly Observer'],
];
const roleName = (r) => ({ block: 'Block Presidents', member: 'Ward members' }[r] || (ROLES.find(([k]) => k === r) || [r, r])[1]);
const LEVELS = [['gs', 'General Secretary'], ['dc', 'District Coordinators'], ['dp', 'District Presidents'], ['observer', 'Assembly Observers'], ['block', 'Block Presidents'], ['member', 'Ward members']];
const PRESIDENT = 'माननीय दिल्ली प्रदेश कांग्रेस कमेटी अध्यक्ष देवेन्द्र यादव जी';

/** Signed links for private files (voice notes, photos, videos). */
async function signAll(paths) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return {};
  const { data } = await supabase.storage.from('uploads').createSignedUrls(list, 3600);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

// ---------------------------------------------------------------- People

function People({ only }) {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');
  const [role, setRole] = useState(only || 'all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [form, setForm] = useState({ name: '', mobile: '', role: only || 'observer', district: '', assembly: '' });
  const load = async () => setRows(await fetchAll('leaders', '*', (x) => x.order('role').order('name')));
  useEffect(() => {
    load();
    fetchAll('wards', 'district, assembly').then((ws) => {
      setDistricts([...new Set(ws.map((w) => w.district).filter(Boolean))].sort());
      setAssemblies([...new Map(ws.filter((w) => w.assembly).map((w) => [w.assembly, w])).values()].sort((x, y) => x.assembly.localeCompare(y.assembly)));
    }).catch(() => {});
  }, []);

  const save = async (list) => {
    const clean = list.map((r) => ({
      name: String(r.name || '').trim(), mobile: mobile10(r.mobile), role: String(r.role || only || '').trim().toLowerCase(),
      district: String(r.district || '').trim() || null, assembly: String(r.assembly || '').trim() || null, active: true,
    }));
    const bad = clean.filter((r) => !r.name || !r.mobile || !ROLES.some(([k]) => k === r.role));
    const good = clean.filter((r) => !bad.includes(r));
    if (good.length) {
      const { error } = await supabase.from('leaders').upsert(good);
      if (error) { setMsg(error.message); return; }
    }
    setMsg(`${good.length} saved${bad.length ? `, ${bad.length} skipped (name, 10-digit mobile and role president / gs / dc / dp / observer are needed)` : ''}.`);
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
    const ws = XLSX.utils.aoa_to_sheet(only === 'dc'
      ? [['name', 'mobile', 'role', 'district'], ['Coordinator name', '9800000005', 'dc', 'Adarsh Nagar']]
      : [
        ['name', 'mobile', 'role', 'district', 'assembly'],
        ['Devender Yadav', '9800000001', 'president', '', ''],
        ['General Secretary name', '9800000002', 'gs', '', ''],
        ['District Coordinator name', '9800000005', 'dc', 'Adarsh Nagar', ''],
        ['District President name', '9800000003', 'dp', 'Adarsh Nagar', ''],
        ['Observer name', '9800000004', 'observer', 'Adarsh Nagar', 'Adarsh Nagar'],
      ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'leaders');
    XLSX.writeFile(wb, only === 'dc' ? 'district-coordinators-template.xlsx' : 'leaders-template.xlsx');
  };
  const toggle = async (r) => { await supabase.from('leaders').update({ active: !r.active }).eq('mobile', r.mobile); load(); };

  const count = (k) => rows.filter((r) => r.role === k && r.active).length;
  const list = rows.filter((r) => (role === 'all' || r.role === role)
    && (!q || r.name.toLowerCase().includes(q.trim().toLowerCase()) || r.mobile.includes(q.trim()) || (r.district || '').toLowerCase().includes(q.trim().toLowerCase()) || (r.assembly || '').toLowerCase().includes(q.trim().toLowerCase())));
  const missing = only === 'dc' ? districts.filter((d) => !rows.some((r) => r.role === 'dc' && r.active && (r.district || '').toLowerCase() === d.toLowerCase())) : [];
  return (
    <>
      {!only && (
        <section className="kpis">
          {ROLES.map(([k, l]) => <div key={k} className="card kpi"><div className="l">{l}</div><div className="v">{count(k)}</div></div>)}
        </section>
      )}
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h2>{only === 'dc' ? `District Coordinators · ${count('dc')} of ${districts.length || 14}` : 'Leader logins'}</h2>
            <p className="sub">{only === 'dc'
              ? 'One per Congress district. They report only to the General Secretary: they call the District President, observers, ward members and Block Presidents of their district, and send a calling report each day.'
              : 'The login number decides which app opens. Pick the district and assembly from the lists so the names match the master sheet exactly.'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setAdding(!adding)}>{adding ? 'Close' : only === 'dc' ? '+ Add coordinator' : '+ Add a leader'}</button>
            <label className="btn ghost">Upload Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={upload} hidden /></label>
            <button className="btn ghost" onClick={template}><Download size={14} /> Template</button>
          </div>
        </div>
        {msg && <div className="notice ok" style={{ marginTop: 12 }}>{msg}</div>}
        {missing.length > 0 && <div className="notice" style={{ marginTop: 12 }}>No coordinator yet for: {missing.join(', ')}</div>}
        {adding && (
          <form className="form addbox" onSubmit={(e) => { e.preventDefault(); save([form]); setForm({ ...form, name: '', mobile: '' }); }}>
            <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Mobile (login number)<input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} inputMode="numeric" required /></label>
            {!only && <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>}
            {form.role === 'observer' && (
              <label>Assembly
                <select value={form.assembly} onChange={(e) => { const w = assemblies.find((x) => x.assembly === e.target.value); setForm({ ...form, assembly: e.target.value, district: w?.district || form.district }); }} required>
                  <option value="">Choose…</option>{assemblies.map((w) => <option key={w.assembly} value={w.assembly}>{w.assembly}</option>)}
                </select></label>)}
            {['dp', 'dc', 'observer'].includes(form.role) && (
              <label>Congress district
                <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required>
                  <option value="">Choose…</option>{districts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select></label>)}
            <div style={{ alignSelf: 'end' }}><button className="btn" type="submit">Save</button></div>
          </form>
        )}
        <div className="filters" style={{ marginTop: 14 }}>
          {!only && (
            <div className="seg">
              <button className={role === 'all' ? 'on' : ''} onClick={() => setRole('all')}>All {rows.length}</button>
              {ROLES.map(([k, l]) => <button key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}>{l} {rows.filter((x) => x.role === k).length}</button>)}
            </div>)}
          <input type="text" placeholder="Find by name, mobile, district or assembly" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 280 }} />
          <span className="muted" style={{ fontSize: 13 }}>{list.length} shown</span>
        </div>
        <div className="tbl">
          <table>
            <thead><tr><th>Name</th><th>Mobile</th>{!only && <th>Role</th>}<th>District</th>{only !== 'dc' && <th>Assembly</th>}<th>App</th><th /></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.mobile} style={{ opacity: r.active ? 1 : 0.5 }}>
                <td><b>{r.name}</b>{r.position && <div className="muted" style={{ fontSize: 12 }}>{r.position}</div>}</td><td>{r.mobile}</td>
                {!only && <td><span className="tag mute">{roleName(r.role)}</span></td>}
                <td>{r.district || '–'}</td>{only !== 'dc' && <td>{r.assembly || '–'}</td>}
                <td><span className={'tag ' + (!r.active ? 'no' : r.first_login_at ? 'ok' : 'live')}>{!r.active ? 'Turned off' : r.first_login_at ? 'Active ' + timeAgo(r.last_active_at || r.first_login_at) : 'Not logged in yet'}</span></td>
                <td><button className="btn ghost sm" onClick={() => toggle(r)}>{r.active ? 'Turn off' : 'Turn on'}</button></td>
              </tr>))}</tbody>
          </table>
        </div>
        {!list.length && <p className="muted">{only === 'dc' ? 'No District Coordinators yet. Add them above or upload the Excel.' : 'Nobody here yet.'}</p>}
      </section>
      {only === 'dc' && <CoordinatorReports />}
    </>
  );
}

/** Daily calling reports District Coordinators send to the General Secretary. */
function CoordinatorReports() {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [date, setDate] = useState('');
  useEffect(() => { (async () => {
    setRows(await fetchAll('coordinator_reports', '*', (x) => x.order('report_date', { ascending: false }).order('created_at', { ascending: false }).limit(500)));
    setNames(Object.fromEntries((await fetchAll('leaders', 'mobile, name, district', (x) => x.eq('role', 'dc'))).map((l) => [l.mobile, l])));
  })().catch(() => {}); }, []);
  const list = rows.filter((x) => !date || x.report_date === date);
  return (
    <section className="card">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><h2>Calling reports</h2><p className="sub">What each coordinator sent to the General Secretary. The call counts come from the calls they made in the app that day.</p></div>
        <div className="filters">
          <label htmlFor="crdate">Date</label>
          <input id="crdate" type="date" value={date} max={istToday()} onChange={(e) => setDate(e.target.value)} />
          <button className={'btn sm ' + (date ? 'ghost' : '')} onClick={() => setDate('')}>All dates</button>
        </div>
      </div>
      <div className="tbl"><table>
        <thead><tr><th>Date</th><th>Coordinator</th><th>District</th><th>Calls made</th><th>Spoke to</th><th>Note</th></tr></thead>
        <tbody>{list.map((x) => (
          <tr key={x.id}><td style={{ whiteSpace: 'nowrap' }}>{dayLabel(x.report_date)}</td><td><b>{names[x.mobile]?.name || x.mobile}</b></td><td>{names[x.mobile]?.district || '–'}</td>
            <td><b>{x.calls}</b></td><td>{x.talked}</td><td style={{ maxWidth: 420 }}>{x.note || ''}</td></tr>))}</tbody>
      </table></div>
      {!list.length && <p className="muted">No report {date ? 'on ' + dayLabel(date) : 'yet'}.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- Tasks for leaders

function LeaderTasks() {
  const [tasks, setTasks] = useState([]);
  const [done, setDone] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [msg, setMsg] = useState('');
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState({ level: 'dp', title: '', description: '', due_date: '', target_district: '', target_assembly: '' });
  const [open, setOpen] = useState(null);   // live task whose remarks are open
  const load = async () => {
    setTasks(await fetchAll('leader_tasks', '*', (q) => q.order('created_at', { ascending: false })));
    setDone(await fetchAll('leader_task_done', '*'));
    setLeaders(await fetchAll('leaders', 'mobile, name, role, district, assembly', (q) => q.eq('active', true)));
    // Older databases have no block columns yet: the leader tasks must still load.
    setPeople(await fetchAll('members', 'mobile, district, zone, assembly, block_no, is_applicant', (q) => q.eq('active', true)).catch(() => []));
  };
  useEffect(() => { load(); }, []);
  const districts = [...new Set([...leaders.map((l) => l.district), ...people.map(districtOf)].filter(Boolean))].sort();
  const assemblies = [...new Set(leaders.filter((l) => l.role === 'observer').map((l) => l.assembly).filter(Boolean))].sort();

  // A task for ward members or Block Presidents goes into the daily tasks (Field work > Tasks): same list in the app, 100 points.
  // It is answered with a remark or a voice note. Tasks for leaders stay here and are finished with a remark.
  const wardSide = (level) => level === 'block' || level === 'member';
  const toDailyTasks = async (t) => {
    const today = istToday();
    const { data: last } = await supabase.from('tasks').select('sort').eq('task_date', today).order('sort', { ascending: false }).limit(1);
    return supabase.from('tasks').insert({
      task_date: today, sort: (last?.[0]?.sort || 0) + 1, kind: 'text', title: t.title, description: t.description || null, audio_path: t.audio_path || null,
      audience: t.level === 'block' ? 'block' : 'member', from_president: true, target_district: t.target_district || null, target_assembly: t.target_assembly || null,
      until_date: t.due_date || null, created_by: t.created_by || 'admin',
    });
  };
  const push = async (e) => {
    e.preventDefault();
    const row = { ...form, status: 'active', created_by: 'admin' };
    for (const k of ['description', 'due_date', 'target_district', 'target_assembly']) if (!row[k]) row[k] = null;
    const { error } = wardSide(row.level) ? await toDailyTasks(row) : await supabase.from('leader_tasks').insert(row);
    setMsg(error ? error.message : wardSide(row.level)
      ? `Task sent. It is in today's tasks in the app (also listed under Field work > Tasks) and is worth 100 points.`
      : `Task sent. It shows in their app as coming from ${PRESIDENT}.`);
    if (!error) setForm({ ...form, title: '', description: '' });
    load();
  };
  const setStatus = async (t, status) => {
    let next = status;
    if (status === 'active' && wardSide(t.level)) {
      const { error } = await toDailyTasks(t);
      if (error) { setMsg(error.message); return; }
      next = 'moved';
    }
    await supabase.from('leader_tasks').update({ status: next, approved_at: status === 'active' ? new Date().toISOString() : null }).eq('id', t.id); load();
  };
  const reach = (t) => (t.level === 'block' || t.level === 'member')
    ? people.filter((m) => (t.level === 'block' ? m.block_no != null : m.is_applicant !== false)
      && (!t.target_district || districtOf(m) === t.target_district) && (!t.target_assembly || m.assembly === t.target_assembly) && (!t.target_mobile || m.mobile === t.target_mobile))
    : leaders.filter((l) => l.role === t.level && (!t.target_district || l.district === t.target_district)
      && (!t.target_assembly || l.assembly === t.target_assembly) && (!t.target_mobile || l.mobile === t.target_mobile));
  const by = (t) => (t.created_by === 'admin' ? 'Admin' : `${roleName(t.created_by)}${t.created_by_mobile ? ' · ' + (leaders.find((l) => l.mobile === t.created_by_mobile)?.name || t.created_by_mobile) : ''}`);

  const waiting = tasks.filter((t) => t.status === 'suggested' || t.status === 'pending');
  return (
    <>
      <section className="card">
        <h2>Push a task</h2>
        <p className="sub">Pick the level it is for. Every task shows in the app as coming from {PRESIDENT}. A task for Block Presidents or ward members goes into their daily tasks and is worth 100 points. Leaders finish theirs with a remark; they get no points, only a count of tasks given and done.</p>
        {msg && <div className="notice ok">{msg}</div>}
        <form className="form" onSubmit={push}>
          <label>For<select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value, target_assembly: '' })}>{LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {form.level !== 'gs' && <label>District (optional)<select value={form.target_district} onChange={(e) => setForm({ ...form, target_district: e.target.value })}><option value="">All</option>{districts.map((d) => <option key={d}>{d}</option>)}</select></label>}
          {form.level === 'observer' && <label>Assembly (optional)<select value={form.target_assembly} onChange={(e) => setForm({ ...form, target_assembly: e.target.value })}><option value="">All</option>{assemblies.map((d) => <option key={d}>{d}</option>)}</select></label>}
          <label>Reaches<input value={`${fmt(reach({ ...form, target_district: form.target_district || null, target_assembly: form.target_assembly || null }).length)} people`} disabled /></label>
          <label>Last date (optional)<input type="date" min={istToday()} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Task (Hindi)<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label style={{ gridColumn: '1 / -1' }}>Details (optional)<textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div><button className="btn" type="submit">Send task</button></div>
        </form>
      </section>

      <section className="card">
        <h2>Waiting ({waiting.length})</h2>
        <p className="sub">Tasks and ideas from the General Secretary, District Presidents and Observers. The President approves them in his app; you can also approve here. Once approved they go out as from the President.</p>
        <div className="tbl"><table>
          <thead><tr><th>Task</th><th>For</th><th>From</th><th>When</th><th /></tr></thead>
          <tbody>{waiting.map((t) => (
            <tr key={t.id}><td><b>{t.title}</b>{t.description && <div className="muted" style={{ fontSize: 12 }}>{t.description}</div>}</td>
              <td>{roleName(t.level)}{t.target_district ? ' · ' + t.target_district : ''}{t.target_assembly ? ' · ' + t.target_assembly : ''}</td>
              <td>{by(t)}<div className="muted" style={{ fontSize: 12 }}>{t.status === 'pending' ? 'Task, waiting for the President' : 'Idea, waiting for the President'}</div></td>
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
            const marks = done.filter((x) => x.task_id === t.id);
            return (<React.Fragment key={t.id}><tr><td><b>{t.title}</b><div className="muted" style={{ fontSize: 12 }}>{t.due_date ? 'By ' + t.due_date : ''}</div></td>
              <td>{roleName(t.level)}{t.target_district ? ' · ' + t.target_district : ''}{t.target_assembly ? ' · ' + t.target_assembly : ''}</td>
              <td>{by(t)}</td>
              <td><b>{who.filter((l) => d.has(l.mobile)).length}/{who.length}</b></td>
              <td style={{ whiteSpace: 'nowrap' }}><button className="btn ghost sm" onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? 'Close' : 'Remarks'}</button>{' '}<button className="btn ghost sm" onClick={() => setStatus(t, 'rejected')}>Remove</button></td></tr>
              {open === t.id && (<tr><td colSpan="5" style={{ background: '#F8F9FB' }}>
                {marks.map((x) => { const l = leaders.find((y) => y.mobile === x.mobile); return (
                  <div key={x.mobile} style={{ padding: '6px 0', borderBottom: '1px solid #E3E6EB' }}><b>{l?.name || x.mobile}</b> <span className="muted" style={{ fontSize: 12 }}>{l?.assembly || l?.district || ''} · {timeAgo(x.done_at)}</span>
                    <div>{x.note || <span className="muted">Marked done before remarks were needed{x.audio_path ? '' : '.'}</span>}{x.audio_path ? <span className="tag mute" style={{ marginLeft: 6 }}>voice note</span> : null}</div></div>); })}
                {!marks.length && <span className="muted">Nobody has finished this yet.</span>}
              </td></tr>)}</React.Fragment>);
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
  const audience = { member: 'Ward members', block: 'Block Presidents', observer: 'Observers', dp: 'District Presidents', dc: 'District Coordinators', gs: 'General Secretary', all: 'Everyone' };
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
  const [date, setDate] = useState('');
  useEffect(() => { (async () => {
    const list = await fetchAll('field_reports', '*', (q) => q.order('created_at', { ascending: false }).limit(400));
    setRows(list);
    setFiles(await signAll(list.flatMap((r) => [r.audio_path, ...(r.media || []).map((m) => m.path)])));
    setLeaders(Object.fromEntries((await fetchAll('leaders', 'mobile, name, role, district, assembly')).map((l) => [l.mobile, l])));
    setCalls(await fetchAll('leader_calls', '*', (q) => q.order('created_at', { ascending: false }).limit(300)));
  })(); }, []);
  return (
    <>
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <h2>Field reports ({rows.filter((r) => !date || istDate(r.created_at) === date).length})</h2>
          <div className="filters">
            <label htmlFor="frdate">Date</label>
            <input id="frdate" type="date" value={date} max={istToday()} onChange={(e) => setDate(e.target.value)} />
            <button className={'btn sm ' + (date ? 'ghost' : '')} onClick={() => setDate('')}>All dates</button>
          </div>
        </div>
        {rows.filter((r) => !date || istDate(r.created_at) === date).map((r) => { const l = leaders[r.mobile] || {}; return (
          <div key={r.id} style={{ borderTop: '1px solid #E3E6EB', padding: '12px 0' }}>
            <b>{l.name || r.mobile}</b> <span className="muted">· {roleName(l.role)} · {l.assembly || l.district || ''} · {timeAgo(r.created_at)}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {r.ward_no && <span className="tag live">Visited {wardLabel(r.ward_no)}</span>}
              {(r.activities || []).map((a) => <span key={a} className="tag mute">{a}</span>)}
            </div>
            {r.note && <p style={{ margin: '6px 0' }}>{r.note}</p>}
            {r.audio_path && files[r.audio_path] && <audio controls src={files[r.audio_path]} style={{ width: 280 }} />}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {(r.media || []).map((m) => files[m.path] && (m.kind === 'video'
                ? <video key={m.path} src={files[m.path]} controls style={{ width: 180, borderRadius: 8 }} />
                : <a key={m.path} href={files[m.path]} target="_blank" rel="noreferrer"><img src={files[m.path]} alt="" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8 }} /></a>))}
            </div>
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
  const TABS = [['people', 'Leader logins', Users], ['dc', 'District Coordinators', UserCheck], ['block', 'Block Presidents', Users], ['tasks', 'Tasks', ClipboardList],
    ['approvals', 'Message approvals', UserCheck], ['reports', 'Field reports and calls', ImageIcon]];
  return (
    <>
      <div className="tabs-subnav" role="tablist" aria-label="Leaders section">
        {TABS.map(([k, l, I]) => (
          <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}><I size={14} />{l}</button>))}
      </div>
      {sub === 'people' && <People />}
      {sub === 'dc' && <People key="dc" only="dc" />}
      {sub === 'block' && <Members mode="block" />}
      {sub === 'tasks' && <LeaderTasks />}
      {sub === 'approvals' && <Approvals />}
      {sub === 'reports' && <Reports />}
    </>
  );
}
