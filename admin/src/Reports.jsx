import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  supabase, fetchAll, istToday, fmt, pct, wardLabel, timeAgo, dayLabel, districtOf, outcomeLabel, downloadXlsx,
} from './lib.js';
import MemberUploads from './MemberUploads.jsx';

// Reports: one page per ward member (everything they uploaded and completed), plus task-wise totals.
export default function Reports() {
  const [view, setView] = useState('members');
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('all');
  const [onlyActive, setOnlyActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAll('member_stats').then(setMembers);
    fetchAll('task_stats', '*', (x) => x.order('task_date').order('sort')).then(setTasks);
  }, []);

  const ranked = useMemo(() => {
    const sorted = members.map((m) => ({ ...m })).sort((a, b) => b.points - a.points || b.tasks_done - a.tasks_done);
    const wardPos = {}; const wardCount = {};
    sorted.forEach((m, i) => {
      m.delhiRank = i + 1;
      wardCount[m.ward_no] = (wardCount[m.ward_no] || 0) + 1;
      wardPos[m.mobile] = wardCount[m.ward_no];
    });
    return sorted.map((m) => ({ ...m, wardRank: wardPos[m.mobile], wardSize: wardCount[m.ward_no] }));
  }, [members]);

  const districts = useMemo(() => [...new Set(members.map(districtOf).filter(Boolean))].sort(), [members]);
  const uploadTasks = tasks.filter((t) => t.kind === 'upload' && t.task_date <= istToday());

  const list = ranked.filter((m) => {
    if (onlyActive && !(m.tasks_done > 0 || m.videos > 0)) return false;
    if (district !== 'all' && districtOf(m) !== district) return false;
    if (q) { const s = q.trim().toLowerCase(); if (!m.name.toLowerCase().includes(s) && !m.mobile.includes(s) && String(m.ward_no) !== s) return false; }
    return true;
  });

  // Full export: one row per member per task.
  const exportAll = async () => {
    setBusy(true);
    const [done, media, shares] = await Promise.all([
      fetchAll('completions', 'mobile, task_id, completed_at, video_count, photo_count'),
      fetchAll('media', 'mobile, task_id, kind'),
      fetchAll('share_events', 'mobile, task_id, platform'),
    ]);
    const key = (m, t) => m + '|' + t;
    const doneMap = Object.fromEntries(done.map((d) => [key(d.mobile, d.task_id), d]));
    const vid = {}; const pho = {}; const sh = {};
    media.forEach((x) => { const k = key(x.mobile, x.task_id); if (x.kind === 'video') vid[k] = (vid[k] || 0) + 1; else pho[k] = (pho[k] || 0) + 1; });
    shares.forEach((x) => { const k = key(x.mobile, x.task_id); (sh[k] ||= []).push(x.platform); });
    const rows = [];
    for (const m of ranked) for (const t of uploadTasks) {
      const k = key(m.mobile, t.id); const d = doneMap[k];
      rows.push({
        name: m.name, mobile: m.mobile, ward: m.ward_no, district: districtOf(m), task_date: t.task_date, task: t.title,
        status: d ? 'Completed' : (vid[k] ? 'Uploaded, not ticked' : 'Not done'),
        videos: vid[k] || 0, photos: pho[k] || 0, shared_on: (sh[k] || []).join(', '),
        completed_at: d ? new Date(d.completed_at).toLocaleString('en-IN') : '', member_points: m.points,
      });
    }
    downloadXlsx(XLSX, rows, 'member x task', `member-task-report-${istToday()}.xlsx`);
    setBusy(false);
  };

  const exportTasks = () => downloadXlsx(XLSX, tasks.map((t) => ({
    date: t.task_date, order: t.sort, type: t.kind === 'upload' ? 'Task' : 'Share card', title: t.title,
    completed: t.completed, completion_pct: t.kind === 'upload' ? pct(t.completed, members.length) : '', videos: t.videos, photos: t.photos,
    shares_total: t.shares, x: t.shares_x, facebook: t.shares_facebook, instagram: t.shares_instagram, whatsapp: t.shares_whatsapp,
  })), 'tasks', `task-report-${istToday()}.xlsx`);

  if (selected) return <MemberReport member={selected} tasks={uploadTasks} onBack={() => setSelected(null)} />;

  return (
    <>
      <div className="tabs-subnav" role="tablist" aria-label="Report type">
        <button className={view === 'members' ? 'on' : ''} onClick={() => setView('members')}>Member reports</button>
        <button className={view === 'tasks' ? 'on' : ''} onClick={() => setView('tasks')}>Task report</button>
      </div>

      {view === 'members' && (
        <section className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <h2>Member reports</h2>
              <p className="sub">Open any ward member for their full report: every task, video, photo, share and call.</p>
            </div>
            <button className="btn ghost" onClick={exportAll} disabled={busy}>{busy ? 'Preparing…' : 'Export member × task report'}</button>
          </div>
          <div className="filters" style={{ marginTop: 14 }}>
            <label htmlFor="rq">Find</label>
            <input id="rq" type="text" placeholder="Name, mobile or ward number" value={q} onChange={(e) => setQ(e.target.value)} />
            <label htmlFor="rd">District</label>
            <select id="rd" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="all">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} /> Only members who uploaded or completed
            </label>
            <span className="muted" style={{ fontSize: 13 }}>{fmt(list.length)} members</span>
          </div>
          <div className="tbl">
            <table>
              <thead><tr><th>Rank</th><th>Member</th><th>Ward</th><th>District</th><th>Tasks</th><th>Videos</th><th>Photos</th><th>Shares</th><th>Points</th><th>Last done</th><th /></tr></thead>
              <tbody>
                {list.slice(0, 500).map((m) => (
                  <tr key={m.mobile}>
                    <td><b>{m.delhiRank}</b></td>
                    <td><b>{m.name}</b><div className="muted" style={{ fontSize: 12 }}>{m.mobile}</div></td>
                    <td>{wardLabel(m.ward_no)}<div className="muted" style={{ fontSize: 12 }}>#{m.wardRank} of {m.wardSize}</div></td>
                    <td className="muted">{districtOf(m) || '–'}</td>
                    <td><b>{m.tasks_done}</b>/{uploadTasks.length}</td>
                    <td>{m.videos}</td><td>{m.photos}</td><td>{m.shares}</td>
                    <td><span className="pts-badge">{fmt(m.points)}</span></td>
                    <td className="muted">{timeAgo(m.last_completed_at)}</td>
                    <td><button className="btn sm" onClick={() => setSelected(m)}>Open report</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > 500 && <p className="muted">Showing 500. Search or filter to narrow.</p>}
          </div>
        </section>
      )}

      {view === 'tasks' && (
        <section className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <h2>Task report</h2>
              <p className="sub">How each task and share card performed, out of {fmt(members.length)} members.</p>
            </div>
            <button className="btn ghost" onClick={exportTasks}>Export</button>
          </div>
          <div className="tbl">
            <table>
              <thead><tr><th>Date</th><th>Task</th><th>Completed</th><th>Videos</th><th>Photos</th><th>X</th><th>Facebook</th><th>Instagram</th><th>WhatsApp</th></tr></thead>
              <tbody>
                {[...tasks].reverse().map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dayLabel(t.task_date)}</td>
                    <td><b>{t.title}</b><div className="muted" style={{ fontSize: 12 }}>{t.kind === 'upload' ? 'Task' : 'Share card'}</div></td>
                    <td>{t.kind === 'upload' ? (<><b>{fmt(t.completed)}</b> <span className="muted">({pct(t.completed, members.length)}%)</span>
                      <div className="bar" style={{ marginTop: 4, width: 120 }}><span style={{ width: pct(t.completed, members.length) + '%' }} /></div></>) : '–'}</td>
                    <td>{fmt(t.videos)}</td><td>{fmt(t.photos)}</td>
                    <td>{fmt(t.shares_x)}</td><td>{fmt(t.shares_facebook)}</td><td>{fmt(t.shares_instagram)}</td><td>{fmt(t.shares_whatsapp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tasks.length && <p className="muted">No tasks yet.</p>}
          </div>
        </section>
      )}
    </>
  );
}

function MemberReport({ member: m, tasks, onBack }) {
  const [detail, setDetail] = useState(null);
  const [showUploads, setShowUploads] = useState(false);

  useEffect(() => {
    (async () => {
      const [done, media, shares, calls, views] = await Promise.all([
        supabase.from('completions').select('*').eq('mobile', m.mobile),
        supabase.from('media').select('task_id, kind, created_at').eq('mobile', m.mobile),
        supabase.from('share_events').select('task_id, platform').eq('mobile', m.mobile),
        supabase.from('call_logs').select('*').eq('member_mobile', m.mobile).order('created_at', { ascending: false }),
        supabase.from('message_views').select('message_id', { count: 'exact', head: true }).eq('mobile', m.mobile),
      ]);
      setDetail({ done: done.data || [], media: media.data || [], shares: shares.data || [], calls: calls.data || [], views: views.count || 0 });
    })();
  }, [m.mobile]);

  const today = istToday();
  const rows = detail ? tasks.map((t) => {
    const d = detail.done.find((x) => x.task_id === t.id);
    const v = detail.media.filter((x) => x.task_id === t.id && x.kind === 'video').length;
    const p = detail.media.filter((x) => x.task_id === t.id && x.kind === 'photo').length;
    const s = detail.shares.filter((x) => x.task_id === t.id).map((x) => x.platform);
    const status = d ? 'Completed' : v ? 'Uploaded, not ticked' : t.task_date === today ? 'Pending today' : 'Missed';
    return { t, d, v, p, s, status };
  }).reverse() : [];

  const exportOne = () => downloadXlsx(XLSX, rows.map((r) => ({
    date: r.t.task_date, task: r.t.title, status: r.status, videos: r.v, photos: r.p, shared_on: r.s.join(', '),
    completed_at: r.d ? new Date(r.d.completed_at).toLocaleString('en-IN') : '',
  })), m.name, `report-${m.mobile}.xlsx`);

  const tag = (st) => st === 'Completed' ? 'ok' : st === 'Missed' ? 'no' : 'live';

  return (
    <>
      <div><button className="btn ghost" onClick={onBack}>← All members</button></div>
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>{m.name}</h2>
            <p className="sub"><a href={`tel:+91${m.mobile}`}>{m.mobile}</a> · {wardLabel(m.ward_no)}{m.ward_name ? ` (${m.ward_name})` : ''} · {districtOf(m) || '–'}{m.assembly ? ` · ${m.assembly}` : ''}</p>
            <p className="sub">First login: {m.first_login_at ? new Date(m.first_login_at).toLocaleString('en-IN') : 'never'} · Last active: {timeAgo(m.last_active_at)}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <button className="btn ghost" onClick={() => setShowUploads(true)}>View all uploads</button>
            <button className="btn ghost" onClick={exportOne} disabled={!detail}>Export</button>
          </div>
        </div>
      </section>

      <section className="kpis">
        <div className="card kpi"><div className="l">Points</div><div className="v">{fmt(m.points)}</div><div className="s">Rank {m.delhiRank} in Delhi · #{m.wardRank} of {m.wardSize} in ward</div></div>
        <div className="card kpi"><div className="l">Tasks completed</div><div className="v">{m.tasks_done}/{tasks.length}</div><div className="s">{pct(m.tasks_done, tasks.length)}% of tasks so far</div></div>
        <div className="card kpi"><div className="l">Videos · photos</div><div className="v">{m.videos} · {m.photos}</div><div className="s">Uploaded in total</div></div>
        <div className="card kpi"><div className="l">Shares</div><div className="v">{m.shares}</div><div className="s">X, Facebook, Instagram, WhatsApp taps</div></div>
        <div className="card kpi"><div className="l">Leader messages</div><div className="v">{detail ? detail.views : '…'}</div><div className="s">Watched or listened</div></div>
        <div className="card kpi"><div className="l">Calls received</div><div className="v">{detail ? detail.calls.length : '…'}</div><div className="s">From the calling team</div></div>
      </section>

      <section className="card">
        <h2>Task by task</h2>
        {!detail ? <p className="muted">Loading…</p> : (
          <div className="tbl"><table>
            <thead><tr><th>Date</th><th>Task</th><th>Status</th><th>Videos</th><th>Photos</th><th>Shared on</th><th>Completed at</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.t.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{dayLabel(r.t.task_date)}</td>
                <td><b>{r.t.title}</b></td>
                <td><span className={'tag ' + tag(r.status)}>{r.status}</span></td>
                <td>{r.v}</td><td>{r.p}</td><td>{r.s.join(', ') || '–'}</td>
                <td className="muted">{r.d ? new Date(r.d.completed_at).toLocaleString('en-IN') : ''}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card">
        <h2>Call history</h2>
        {!detail ? <p className="muted">Loading…</p> : !detail.calls.length ? <p className="muted">No calls logged.</p> : (
          <div className="tbl"><table>
            <thead><tr><th>When</th><th>By</th><th>Outcome</th><th>Remarks</th><th>Follow-up</th></tr></thead>
            <tbody>{detail.calls.map((c) => (
              <tr key={c.id}><td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleString('en-IN')}</td>
                <td>{c.caller_name || '–'}</td><td>{outcomeLabel(c.outcome)}</td><td>{c.remarks || ''}</td><td>{c.follow_up || ''}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      {showUploads && <MemberUploads member={m} onClose={() => setShowUploads(false)} />}
    </>
  );
}
