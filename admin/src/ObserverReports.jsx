import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, fetchAll, fmt, wardLabel, districtOf, downloadXlsx } from './lib.js';

// First day of the month before today (India time): the month observers are writing about right now.
const lastMonth = () => { const d = new Date(Date.now() + 5.5 * 3600 * 1000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7); };
const monthName = (ym) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

// Observers write about every ward member of their assembly once a month: ticked lines, a note and a voice note.
// The month that just ended opens on the 1st and stays open for the whole next month.
export default function ObserverReports() {
  const [month, setMonth] = useState(lastMonth());
  const [rows, setRows] = useState([]);
  const [observers, setObservers] = useState([]);
  const [members, setMembers] = useState([]);
  const [files, setFiles] = useState({});
  const [district, setDistrict] = useState('all');
  const [open, setOpen] = useState(null);

  useEffect(() => { (async () => {
    setObservers(await fetchAll('leaders', 'mobile, name, district, assembly', (q) => q.eq('role', 'observer').eq('active', true)));
    setMembers(await fetchAll('members', 'mobile, name, ward_no, assembly, district, zone', (q) => q.eq('active', true).eq('is_applicant', true)));
  })().catch(() => {}); }, []);
  useEffect(() => { (async () => {
    const list = await fetchAll('member_feedback', '*', (q) => q.eq('month', month + '-01').order('created_at', { ascending: false }));
    setRows(list);
    const paths = [...new Set(list.map((r) => r.audio_path).filter(Boolean))];
    if (paths.length) {
      const { data } = await supabase.storage.from('uploads').createSignedUrls(paths, 3600);
      setFiles(Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])));
    } else setFiles({});
  })().catch(() => setRows([])); }, [month]);

  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const table = useMemo(() => observers.map((o) => {
    const mine = members.filter((m) => same(m.assembly, o.assembly));
    const done = rows.filter((r) => r.observer_mobile === o.mobile);
    return { ...o, total: mine.length, done: done.length, list: mine, feedback: done };
  }).filter((o) => district === 'all' || o.district === district).sort((a, b) => (a.done / (a.total || 1)) - (b.done / (b.total || 1))), [observers, members, rows, district]);
  const districts = [...new Set(observers.map((o) => o.district).filter(Boolean))].sort();
  const totals = table.reduce((a, o) => ({ total: a.total + o.total, done: a.done + o.done }), { total: 0, done: 0 });
  const flagCounts = Object.entries(rows.reduce((a, r) => { for (const f of r.flags || []) a[f] = (a[f] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const memberOf = (mobile) => members.find((m) => m.mobile === mobile) || { name: mobile };

  const exportAll = () => downloadXlsx(XLSX, rows.map((r) => {
    const o = observers.find((x) => x.mobile === r.observer_mobile) || {}; const m = memberOf(r.member_mobile);
    return { month, observer: o.name || r.observer_mobile, assembly: o.assembly || '', district: o.district || '', member: m.name, member_mobile: r.member_mobile, ward: m.ward_no || '',
      ticked: (r.flags || []).join(', '), note: r.note || '', voice_note: r.audio_path ? 'yes' : '', sent: new Date(r.created_at).toLocaleString('en-IN') };
  }), 'observer feedback', `observer-reports-${month}.xlsx`);

  return (
    <>
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h2>Observer reports · {monthName(month)}</h2>
            <p className="sub">Once a month each observer writes about every ward member of their assembly. The report for a month opens on the 1st of the next month and stays open all that month. Observers who have not finished see a reminder on their home screen.</p>
          </div>
          <div className="filters">
            <label htmlFor="ormonth">Month</label>
            <input id="ormonth" type="month" value={month} max={lastMonth()} onChange={(e) => setMonth(e.target.value || lastMonth())} />
            <select value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="all">All districts</option>{districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button className="btn ghost" onClick={exportAll} disabled={!rows.length}>Export</button>
          </div>
        </div>
      </section>
      <section className="kpis">
        <div className="card kpi"><div className="l">Feedback written</div><div className="v">{fmt(totals.done)}</div><div className="s">of {fmt(totals.total)} ward members</div></div>
        <div className="card kpi"><div className="l">Observers finished</div><div className="v">{table.filter((o) => o.total && o.done >= o.total).length}</div><div className="s">of {table.length}</div></div>
        <div className="card kpi"><div className="l">Not started</div><div className="v" style={{ color: '#C2560A' }}>{table.filter((o) => !o.done).length}</div><div className="s">observers with nothing sent</div></div>
        <div className="card kpi"><div className="l">Voice notes</div><div className="v">{rows.filter((r) => r.audio_path).length}</div></div>
      </section>
      {flagCounts.length > 0 && (
        <section className="card">
          <h2>What observers ticked</h2>
          {flagCounts.map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '260px 1fr 50px', gap: 8, alignItems: 'center', fontSize: 13, margin: '5px 0' }}>
              <span>{k}</span><div style={{ background: '#EEF0F4', borderRadius: 6, height: 10 }}><div style={{ width: `${(v / flagCounts[0][1]) * 100}%`, background: '#1B4FA8', height: 10, borderRadius: 6 }} /></div><b>{v}</b>
            </div>))}
        </section>
      )}
      <section className="card">
        <h2>Observer by observer</h2>
        <p className="sub">Those with the least done come first. Open one to read what they wrote about each member.</p>
        <div className="tbl"><table>
          <thead><tr><th>Observer</th><th>Assembly</th><th>District</th><th>Done</th><th /></tr></thead>
          <tbody>{table.map((o) => (
            <React.Fragment key={o.mobile}>
              <tr>
                <td><b>{o.name}</b><div className="muted" style={{ fontSize: 12 }}>{o.mobile}</div></td><td>{o.assembly || '–'}</td><td className="muted">{o.district || '–'}</td>
                <td><b>{o.done}</b>/{o.total} <span className={'tag ' + (!o.done ? 'no' : o.done >= o.total ? 'ok' : 'live')} style={{ marginLeft: 6 }}>{!o.done ? 'Not started' : o.done >= o.total ? 'Finished' : 'In progress'}</span></td>
                <td><button className="btn ghost sm" onClick={() => setOpen(open === o.mobile ? null : o.mobile)}>{open === o.mobile ? 'Close' : 'Open'}</button></td>
              </tr>
              {open === o.mobile && (
                <tr><td colSpan="5" style={{ background: '#F8F9FB' }}>
                  {o.list.sort((a, b) => a.ward_no - b.ward_no).map((m) => { const f = o.feedback.find((x) => x.member_mobile === m.mobile); return (
                    <div key={m.mobile} style={{ borderBottom: '1px solid #E3E6EB', padding: '10px 0' }}>
                      <b>{m.name}</b> <span className="muted" style={{ fontSize: 12.5 }}>· {wardLabel(m.ward_no)} · {m.mobile}</span>
                      {!f ? <span className="tag no" style={{ marginLeft: 8 }}>Nothing written</span> : (<>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>{(f.flags || []).map((x) => <span key={x} className="tag ok">{x}</span>)}</div>
                        {f.note && <p style={{ margin: '6px 0' }}>{f.note}</p>}
                        {f.audio_path && files[f.audio_path] && <audio controls src={files[f.audio_path]} style={{ width: 280 }} />}
                      </>)}
                    </div>); })}
                  {!o.list.length && <p className="muted">No ward members are loaded for this assembly. Check that the assembly name matches the master sheet.</p>}
                </td></tr>)}
            </React.Fragment>))}</tbody>
        </table></div>
        {!table.length && <p className="muted">No observers loaded yet.</p>}
      </section>
    </>
  );
}
