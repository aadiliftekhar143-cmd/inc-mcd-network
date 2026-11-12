import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  supabase, fetchAll, istToday, istDate, fmt, wardLabel, timeAgo, districtOf, CALL_OUTCOMES, outcomeLabel, downloadXlsx,
} from './lib.js';

const DAY = 86400000;

const SEGMENTS = [
  ['needs', 'Needs a call'],
  ['not_logged', 'Not logged in'],
  ['inactive', 'Inactive 24 hrs+'],
  ['pending', "Today's tasks pending"],
  ['zero', 'No task done yet'],
  ['followup', 'Follow-up due'],
  ['all', 'All members'],
];

function matches(r, k) {
  if (r.active === false) return k === 'all';
  switch (k) {
    case 'needs': return !r.first_login_at || r.inactive || r.followUp || r.pending;
    case 'not_logged': return !r.first_login_at;
    case 'inactive': return r.inactive;
    case 'pending': return r.pending;
    case 'zero': return r.tasks_done === 0;
    case 'followup': return r.followUp;
    default: return true;
  }
}

// Calling list for telecallers (their districts only, enforced by the database) and admins (everyone).
export default function Calling({ me }) {
  const [members, setMembers] = useState([]);
  const [lastCalls, setLastCalls] = useState({});
  const [todayDone, setTodayDone] = useState({});
  const [todayTasks, setTodayTasks] = useState(0);
  const [segment, setSegment] = useState('needs');
  const [district, setDistrict] = useState('all');
  const [ward, setWard] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myCallsToday, setMyCallsToday] = useState(0);

  async function load() {
    const today = istToday();
    const [m, lc, tasks] = await Promise.all([
      fetchAll('member_stats', '*', (x) => x.order('ward_no')),
      fetchAll('member_last_call'),
      fetchAll('tasks', 'id', (x) => x.eq('task_date', today).eq('kind', 'upload')),
    ]);
    const ids = tasks.map((t) => t.id);
    const done = ids.length ? await fetchAll('completions', 'mobile, task_id', (x) => x.in('task_id', ids)) : [];
    const count = {};
    for (const d of done) count[d.mobile] = (count[d.mobile] || 0) + 1;
    const since = new Date(today + 'T00:00:00+05:30').toISOString();
    const { count: mine } = await supabase.from('call_logs').select('id', { count: 'exact', head: true })
      .eq('caller_id', me.userId).gte('created_at', since);
    setMembers(m);
    setLastCalls(Object.fromEntries(lc.map((c) => [c.mobile, c])));
    setTodayTasks(ids.length);
    setTodayDone(count);
    setMyCallsToday(mine || 0);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const today = istToday();
  const rows = useMemo(() => members.map((m) => {
    const lc = lastCalls[m.mobile];
    const inactive = m.first_login_at && (!m.last_active_at || Date.now() - new Date(m.last_active_at) > DAY);
    const pending = todayTasks > 0 && (todayDone[m.mobile] || 0) < todayTasks;
    const followUp = lc?.next_follow_up && lc.next_follow_up <= today;
    const calledToday = !!lc?.last_call_at && istDate(lc.last_call_at) === today;
    // Priority: not logged in > inactive > follow-up due > pending today > no task done
    const score = (!m.first_login_at ? 50 : 0) + (inactive ? 30 : 0) + (followUp ? 25 : 0) + (pending ? 15 : 0) + (m.tasks_done === 0 ? 10 : 0) - (calledToday ? 40 : 0);
    return { ...m, lc, inactive, pending, followUp, calledToday, score, doneToday: todayDone[m.mobile] || 0 };
  }), [members, lastCalls, todayDone, todayTasks, today]);

  const districts = useMemo(() => [...new Set(members.map(districtOf).filter(Boolean))].sort(), [members]);
  const wards = useMemo(() => [...new Set(members.map((m) => m.ward_no))].sort((a, b) => a - b), [members]);

  const inSegment = (r) => matches(r, segment);

  const list = rows.filter((r) => {
    if (!inSegment(r)) return false;
    if (district !== 'all' && districtOf(r).toLowerCase() !== district.toLowerCase()) return false;
    if (ward !== 'all' && r.ward_no !== Number(ward)) return false;
    if (q) {
      const s = q.trim().toLowerCase();
      if (!r.name.toLowerCase().includes(s) && !r.mobile.includes(s)) return false;
    }
    return true;
  }).sort((a, b) => b.score - a.score || a.ward_no - b.ward_no);

  const counts = Object.fromEntries(SEGMENTS.map(([k]) => [k, rows.filter((r) => matches(r, k)).length]));

  const exportList = () => downloadXlsx(XLSX, list.map((r) => ({
    name: r.name, mobile: r.mobile, ward: r.ward_no, district: districtOf(r),
    logged_in: r.first_login_at ? 'yes' : 'no', last_active: r.last_active_at || '',
    tasks_done: r.tasks_done, today_done: `${r.doneToday}/${todayTasks}`, points: r.points,
    last_call: r.lc?.last_call_at || '', last_outcome: r.lc ? outcomeLabel(r.lc.last_outcome) : '',
    last_remarks: r.lc?.last_remarks || '', follow_up: r.lc?.next_follow_up || '',
  })), 'calling list', `calling-list-${today}.xlsx`);

  return (
    <>
      <section className="kpis" aria-label="Calling summary">
        <div className="card kpi"><div className="l">{me.role === 'telecaller' ? 'Your members' : 'Members'}</div><div className="v">{fmt(members.length)}</div><div className="s">{me.role === 'telecaller' ? (me.districts || []).join(', ') : 'All districts'}</div></div>
        <div className="card kpi"><div className="l">Need a call</div><div className="v">{fmt(counts.needs)}</div><div className="s">Not logged in, inactive, pending or follow-up</div></div>
        <div className="card kpi"><div className="l">Not logged in</div><div className="v">{fmt(counts.not_logged)}</div><div className="s">Never opened the app</div></div>
        <div className="card kpi"><div className="l">Follow-ups due</div><div className="v">{fmt(counts.followup)}</div><div className="s">Today or earlier</div></div>
        <div className="card kpi"><div className="l">Your calls today</div><div className="v">{fmt(myCallsToday)}</div><div className="s">Logged from this panel</div></div>
      </section>

      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h2>Calling list</h2>
            <p className="sub">Sorted by who needs a call most. Tap a number to call. Log every call so the team can see follow-ups.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => { setLoading(true); load(); }}>Refresh</button>
            <button className="btn ghost" onClick={exportList}>Export list</button>
          </div>
        </div>

        <div className="tabs-subnav" role="tablist" aria-label="Segments" style={{ marginTop: 14 }}>
          {SEGMENTS.map(([k, l]) => (
            <button key={k} className={segment === k ? 'on' : ''} onClick={() => setSegment(k)} role="tab" aria-selected={segment === k}>
              {l} <span className="muted" style={{ color: 'inherit', opacity: 0.75 }}>({fmt(counts[k])})</span>
            </button>
          ))}
        </div>

        <div className="filters">
          <label htmlFor="cq">Find</label>
          <input id="cq" type="text" placeholder="Name or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
          {districts.length > 1 && (<>
            <label htmlFor="cd">District</label>
            <select id="cd" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="all">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </>)}
          <label htmlFor="cw">Ward</label>
          <select id="cw" value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="all">All wards</option>
            {wards.map((w) => <option key={w} value={w}>{wardLabel(w)}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 13 }}>{fmt(list.length)} shown</span>
        </div>

        {loading ? <p className="muted">Loading…</p> : (
          <div className="tbl">
            <table>
              <thead><tr><th>Member</th><th>Ward</th><th>Status</th><th>Today</th><th>Tasks / points</th><th>Last call</th><th /></tr></thead>
              <tbody>
                {list.slice(0, 400).map((r) => (
                  <tr key={r.mobile}>
                    <td>
                      <b>{r.name}</b>
                      <div style={{ fontSize: 13 }}><a href={`tel:+91${r.mobile}`}>{r.mobile}</a>{' · '}
                        <a href={`https://wa.me/91${r.mobile}`} target="_blank" rel="noreferrer">WhatsApp</a></div>
                    </td>
                    <td>{wardLabel(r.ward_no)}<div className="muted" style={{ fontSize: 12 }}>{districtOf(r) || '–'}</div></td>
                    <td>
                      {r.active === false ? <span className="tag no">Blocked</span>
                        : !r.first_login_at ? <span className="tag no">Not logged in</span>
                        : r.inactive ? <span className="tag no">Inactive · {timeAgo(r.last_active_at)}</span>
                        : <span className="tag ok">Active · {timeAgo(r.last_active_at)}</span>}
                      {r.followUp && <div style={{ marginTop: 4 }}><span className="tag live">Follow-up due</span></div>}
                    </td>
                    <td>{todayTasks ? `${r.doneToday}/${todayTasks}` : '–'}</td>
                    <td>{r.tasks_done} tasks<div className="muted" style={{ fontSize: 12 }}>{fmt(r.points)} pts</div></td>
                    <td style={{ maxWidth: 240 }}>
                      {r.lc ? (<>
                        <b style={{ fontSize: 12 }}>{outcomeLabel(r.lc.last_outcome)}</b>
                        <div className="muted" style={{ fontSize: 12 }}>{timeAgo(r.lc.last_call_at)} · {r.lc.last_caller || ''}</div>
                        {r.lc.last_remarks && <div style={{ fontSize: 12 }}>{r.lc.last_remarks}</div>}
                      </>) : <span className="muted">Never called</span>}
                    </td>
                    <td><button className="btn" style={{ minHeight: 34, padding: '6px 12px', fontSize: 13 }} onClick={() => setOpen(r)}>Log call</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > 400 && <p className="muted">Showing the first 400. Use filters to narrow.</p>}
            {!list.length && <p className="muted">Nobody in this list.</p>}
          </div>
        )}
      </section>

      {open && <CallModal member={open} me={me} onClose={(saved) => { setOpen(null); if (saved) load(); }} />}
    </>
  );
}

function CallModal({ member, me, onClose }) {
  const [history, setHistory] = useState(null);
  const [outcome, setOutcome] = useState('connected');
  const [remarks, setRemarks] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('call_logs').select('*').eq('member_mobile', member.mobile).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setHistory(data || []));
  }, [member.mobile]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.from('call_logs').insert({
      member_mobile: member.mobile, caller_id: me.userId, caller_name: me.name,
      outcome, remarks: remarks.trim() || null, follow_up: followUp || null,
    });
    setBusy(false);
    if (error) setErr(error.message); else onClose(true);
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={'Log call to ' + member.name} onClick={() => onClose(false)}>
      <div className="card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2>{member.name}</h2>
            <p className="sub"><a href={`tel:+91${member.mobile}`}>{member.mobile}</a> · {wardLabel(member.ward_no)} · {districtOf(member) || '–'} · {member.tasks_done} tasks · {fmt(member.points)} pts</p>
          </div>
          <button className="btn ghost" onClick={() => onClose(false)}>Close</button>
        </div>
        <form onSubmit={save} className="form">
          <label>Call outcome
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {CALL_OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>Follow-up date (optional)<input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Remarks<textarea rows="3" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="What did they say? Any problem with the app?" /></label>
          {err && <div className="notice" style={{ gridColumn: '1 / -1' }}>{err}</div>}
          <div><button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save call'}</button></div>
        </form>
        <h2 style={{ marginTop: 18, fontSize: 15 }}>Call history</h2>
        {history === null ? <p className="muted">Loading…</p> : !history.length ? <p className="muted">No calls yet.</p> : (
          <div className="tbl"><table>
            <thead><tr><th>When</th><th>By</th><th>Outcome</th><th>Remarks</th><th>Follow-up</th></tr></thead>
            <tbody>{history.map((h) => (
              <tr key={h.id}><td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(h.created_at).toLocaleString('en-IN')}</td>
                <td>{h.caller_name || '–'}</td><td>{outcomeLabel(h.outcome)}</td><td>{h.remarks || ''}</td><td>{h.follow_up || ''}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
