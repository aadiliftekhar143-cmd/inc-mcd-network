import React, { useEffect, useMemo, useState } from 'react';
import { supabase, fetchAll, istToday, fmt, pct, wardLabel, timeAgo, heatClass, dayLabel } from './lib.js';
import MemberUploads from './MemberUploads.jsx';

const WARDS = Array.from({ length: 250 }, (_, i) => i + 1);

export default function Dashboard() {
  const [members, setMembers] = useState([]);
  const [days, setDays] = useState([]);           // day_stats rows
  const [wardDay, setWardDay] = useState([]);     // ward_day_stats for selected day
  const [hours, setHours] = useState([]);
  const [day, setDay] = useState(istToday());
  const [ward, setWard] = useState('all');
  const [group, setGroup] = useState('zone');
  const [color, setColor] = useState('completion');
  const [scope, setScope] = useState('delhi');
  const [openMember, setOpenMember] = useState(null);
  const [updated, setUpdated] = useState(null);

  async function load() {
    const [m, d, wd, h] = await Promise.all([
      fetchAll('member_stats'),
      fetchAll('day_stats', '*', (q) => q.order('task_date')),
      fetchAll('ward_day_stats', '*', (q) => q.eq('task_date', day)),
      fetchAll('hour_stats', '*', (q) => q.eq('day', day)),
    ]);
    setMembers(m); setDays(d); setWardDay(wd); setHours(h); setUpdated(new Date());
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [day]);

  const dayRow = days.find((d) => d.task_date === day) || { tasks: 0, completed: 0, active: 0, videos: 0 };
  const tasksToday = dayRow.tasks;

  const scoped = ward === 'all' ? members : members.filter((m) => m.ward_no === Number(ward));
  const loggedIn = scoped.filter((m) => m.first_login_at).length;
  const wdScoped = ward === 'all' ? wardDay : wardDay.filter((w) => w.ward_no === Number(ward));
  const completed = wdScoped.reduce((a, w) => a + w.completed, 0);
  const active = wdScoped.reduce((a, w) => a + w.active, 0);
  const videos = wdScoped.reduce((a, w) => a + Number(w.videos), 0);
  const assigned = scoped.length * tasksToday;

  // Per-ward completion for the selected day.
  const wardStats = useMemo(() => {
    const byWard = {};
    for (const m of members) {
      const w = (byWard[m.ward_no] ||= { ward_no: m.ward_no, zone: m.zone || 'No zone', assembly: m.assembly || 'No assembly', members: 0, completed: 0, active: 0, videos: 0 });
      w.members += 1;
    }
    for (const r of wardDay) {
      const w = byWard[r.ward_no];
      if (w) { w.completed = r.completed; w.active = r.active; w.videos = Number(r.videos); }
    }
    return Object.values(byWard).map((w) => ({
      ...w,
      completion: pct(w.completed, w.members * tasksToday),
      activePct: pct(w.active, w.members),
    }));
  }, [members, wardDay, tasksToday]);

  const metric = (w) => (color === 'completion' ? w.completion : color === 'active' ? w.activePct : Math.min(100, w.videos * 5));

  const groups = useMemo(() => {
    const key = group === 'assembly' ? 'assembly' : 'zone';
    const g = {};
    for (const w of wardStats) (g[w[key]] ||= []).push(w);
    return Object.entries(g).map(([name, wards]) => ({
      name,
      wards: wards.sort((a, b) => a.ward_no - b.ward_no),
      avg: Math.round(wards.reduce((a, w) => a + w.completion, 0) / wards.length),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [wardStats, group]);

  const groupRank = [...groups].sort((a, b) => b.avg - a.avg);
  const wardRank = [...wardStats].sort((a, b) => b.completion - a.completion);

  const ranking = useMemo(() => {
    const list = scope === 'ward' && ward !== 'all' ? scoped : members;
    const sorted = [...list].sort((a, b) => b.tasks_done - a.tasks_done || b.videos - a.videos);
    const wardPos = {};
    const byWard = {};
    for (const m of [...members].sort((a, b) => b.tasks_done - a.tasks_done || b.videos - a.videos)) {
      byWard[m.ward_no] = (byWard[m.ward_no] || 0) + 1;
      wardPos[m.mobile] = byWard[m.ward_no];
    }
    const wardSize = {};
    for (const m of members) wardSize[m.ward_no] = (wardSize[m.ward_no] || 0) + 1;
    return sorted.slice(0, 25).map((m, i) => ({ ...m, rank: i + 1, wardRank: `${wardPos[m.mobile]} of ${wardSize[m.ward_no]}` }));
  }, [members, scoped, scope, ward]);

  const maxHour = Math.max(1, ...hours.map((h) => Number(h.uploads)));
  const hourCols = Array.from({ length: 17 }, (_, i) => {
    const hr = 7 + i;
    const row = hours.find((h) => h.hour === hr);
    return { hr, v: row ? Number(row.uploads) : 0, label: hr === 12 ? '12p' : hr > 12 ? hr - 12 + 'p' : hr + 'a' };
  });

  const notInstalled = scoped.length - loggedIn;
  const inactive = scoped.filter((m) => m.first_login_at && (!m.last_active_at || Date.now() - new Date(m.last_active_at) > 86400000)).length;

  return (
    <>
      <div className="filters">
        <label htmlFor="ward">Ward</label>
        <select id="ward" value={ward} onChange={(e) => setWard(e.target.value)} style={{ minWidth: 200 }}>
          <option value="all">All 250 wards</option>
          {WARDS.map((w) => <option key={w} value={w}>{wardLabel(w)}</option>)}
        </select>
        <label htmlFor="group">Group by</label>
        <select id="group" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="zone">MCD zone</option>
          <option value="assembly">Assembly</option>
        </select>
        <label htmlFor="day">Day</label>
        <select id="day" value={day} onChange={(e) => setDay(e.target.value)}>
          {!days.find((d) => d.task_date === istToday()) && <option value={istToday()}>Today ({dayLabel(istToday())})</option>}
          {days.map((d, i) => <option key={d.task_date} value={d.task_date}>Day {i + 1} · {dayLabel(d.task_date)}{d.task_date === istToday() ? ' (today)' : ''}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>{updated ? 'Updated ' + updated.toLocaleTimeString('en-IN') + ' · refreshes every 30 sec' : 'Loading…'}</span>
      </div>

      <section className="kpis" aria-label="Key numbers">
        <Kpi l="Registered members" v={fmt(scoped.length)} s={ward === 'all' ? '250 wards' : wardLabel(ward)} />
        <Kpi l="Logged in to app" v={fmt(loggedIn)} s={pct(loggedIn, scoped.length) + '% of registered'} />
        <Kpi l="Active this day" v={fmt(active)} s={pct(active, scoped.length) + '% response rate'} />
        <Kpi l="Tasks completed" v={fmt(completed)} s={pct(completed, assigned) + '% of ' + fmt(assigned) + ' assigned'} />
        <Kpi l="Videos uploaded" v={fmt(videos)} s={completed ? (videos / completed).toFixed(1) + ' per completed task' : '–'} />
        <Kpi l="Tasks this day" v={fmt(tasksToday)} s="per member" />
      </section>

      <div className="row">
        <section className="card grow" aria-label="Ward heat map">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2>Ward heat map</h2>
              <p className="sub">Each square is one ward, grouped by {group === 'zone' ? 'MCD zone' : 'assembly'}. Click a square to filter to that ward.</p>
            </div>
            <div className="seg" role="group" aria-label="Colour by">
              {[['completion', 'Completion'], ['active', 'Active'], ['videos', 'Videos']].map(([k, l]) => (
                <button key={k} className={color === k ? 'on' : ''} onClick={() => setColor(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="zones">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="zh"><b>{g.name}</b><span className="muted">{g.avg}%</span></div>
                <div className="cells">
                  {g.wards.map((w) => (
                    <button key={w.ward_no} className={'cell ' + (tasksToday ? heatClass(metric(w)) : 'hx')}
                      title={`${wardLabel(w.ward_no)}: ${w.completion}% done, ${w.active}/${w.members} active, ${w.videos} videos`}
                      aria-label={`${wardLabel(w.ward_no)}: ${w.completion}% done`}
                      onClick={() => setWard(String(w.ward_no))} />
                  ))}
                </div>
              </div>
            ))}
            {!groups.length && <p className="muted">No members uploaded yet.</p>}
          </div>
          <div className="legend">
            <span><i className="h0" />Under 40% (push)</span><span><i className="h1" />40 to 54%</span>
            <span><i className="h2" />55 to 69%</span><span><i className="h3" />70 to 84%</span><span><i className="h4" />85%+</span>
          </div>
        </section>

        <section className="card side" aria-label="Group ranking">
          <h2>{group === 'zone' ? 'Zone' : 'Assembly'} ranking</h2>
          <p className="sub" style={{ marginBottom: 12 }}>Average ward completion, this day</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflow: 'auto' }}>
            {groupRank.map((g, i) => (
              <div key={g.name} style={{ display: 'grid', gridTemplateColumns: '22px 120px minmax(0,1fr) 40px', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span className="muted">{i + 1}</span><span>{g.name}</span>
                <span className="bar"><span style={{ width: g.avg + '%', background: g.avg < 40 ? '#C2560A' : '#1B4FA8' }} /></span>
                <b style={{ textAlign: 'right' }}>{g.avg}%</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="row">
        <section className="card grow" aria-label="Live ranking">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <h2>Live ranking · all 11 days</h2>
              <p className="sub">Ranked by tasks completed, then videos uploaded. Top 25 shown.</p>
            </div>
            <div className="seg" role="group" aria-label="Ranking scope">
              <button className={scope === 'delhi' ? 'on' : ''} onClick={() => setScope('delhi')}>Delhi</button>
              <button className={scope === 'ward' ? 'on' : ''} onClick={() => setScope('ward')} disabled={ward === 'all'} title={ward === 'all' ? 'Pick a ward first' : ''}>Within ward</button>
            </div>
          </div>
          <div className="tbl">
            <table>
              <thead><tr><th>Rank</th><th>Member</th><th>Ward</th><th>Ward rank</th><th>Tasks done</th><th>Videos</th><th>Last active</th><th /></tr></thead>
              <tbody>
                {ranking.map((m) => (
                  <tr key={m.mobile}>
                    <td><b>{m.rank}</b></td>
                    <td><b>{m.name}</b><div className="muted" style={{ fontSize: 12 }}>{m.mobile}</div></td>
                    <td>{wardLabel(m.ward_no)}</td><td>{m.wardRank}</td>
                    <td>{m.tasks_done}</td><td><b>{m.videos}</b></td>
                    <td className="muted">{timeAgo(m.last_active_at)}</td>
                    <td><button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => setOpenMember(m)}>Uploads</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="side" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <h2 style={{ marginBottom: 8 }}>Top 5 wards</h2>
            {wardRank.slice(0, 5).map((w) => (
              <div key={w.ward_no} className="list-row"><span><b>{wardLabel(w.ward_no)}</b> <span className="muted">· {w.zone}</span></span><b style={{ color: '#1B4FA8' }}>{w.completion}%</b></div>
            ))}
          </div>
          <div className="card">
            <h2>Bottom 5 wards</h2>
            <p className="sub" style={{ marginBottom: 6 }}>Share with the calling team</p>
            {wardRank.slice(-5).reverse().map((w) => (
              <div key={w.ward_no} className="list-row"><span><b>{wardLabel(w.ward_no)}</b> <span className="muted">· {w.zone}</span></span><b style={{ color: '#C2560A' }}>{w.completion}%</b></div>
            ))}
          </div>
        </section>
      </div>

      <div className="row">
        <section className="card" style={{ flex: '1 1 420px', minWidth: 0 }}>
          <h2>Daily completion</h2>
          <p className="sub" style={{ marginBottom: 14 }}>Tasks completed out of assigned, per campaign day</p>
          <div className="chart" style={{ gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0,1fr))` }}>
            {days.map((d) => {
              const v = pct(d.completed, members.length * d.tasks);
              return <div key={d.task_date} className="col"><span>{d.completed ? v + '%' : ''}</span><i style={{ height: Math.max(4, v * 1.5), background: d.task_date === day ? '#1B4FA8' : '#6F96D4' }} /></div>;
            })}
          </div>
          <div className="xlabels" style={{ gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0,1fr))` }}>
            {days.map((d) => <span key={d.task_date}>{dayLabel(d.task_date)}</span>)}
          </div>
        </section>

        <section className="card" style={{ flex: '1 1 420px', minWidth: 0 }}>
          <h2>Video uploads by hour</h2>
          <p className="sub" style={{ marginBottom: 14 }}>Selected day, India time. Darker bars are reminder hours.</p>
          <div className="chart" style={{ gridTemplateColumns: 'repeat(17, minmax(0,1fr))', gap: 4 }}>
            {hourCols.map((h) => (
              <div key={h.hr} className="col" title={h.v + ' uploads'}><span style={{ fontSize: 10 }}>{h.v || ''}</span><i style={{ height: Math.max(3, (h.v / maxHour) * 150), background: [7, 10, 13, 16, 19, 22].includes(h.hr) ? '#1B4FA8' : '#A9C1E6' }} /></div>
            ))}
          </div>
          <div className="xlabels" style={{ gridTemplateColumns: 'repeat(17, minmax(0,1fr))', gap: 4, fontSize: 10 }}>
            {hourCols.map((h) => <span key={h.hr}>{h.label}</span>)}
          </div>
        </section>

        <section className="card" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h2 style={{ marginBottom: 12 }}>Reach funnel</h2>
          {[['Registered', scoped.length], ['Logged in to app', loggedIn], ['Did at least 1 task (all days)', scoped.filter((m) => m.tasks_done > 0).length], ['Active this day', active]].map(([l, v]) => (
            <div key={l} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{l}</span><b>{fmt(v)}</b></div>
              <div className="bar" style={{ height: 12 }}><span style={{ height: 12, width: pct(v, scoped.length) + '%' }} /></div>
            </div>
          ))}
          <div className="notice" style={{ marginTop: 14 }}>
            <b>For the calling team</b>
            <div style={{ marginTop: 4, color: '#14171C' }}>{fmt(notInstalled)} not logged in · {fmt(inactive)} inactive 24 hrs</div>
          </div>
        </section>
      </div>

      {openMember && <MemberUploads member={openMember} onClose={() => setOpenMember(null)} />}
    </>
  );
}

function Kpi({ l, v, s }) {
  return <div className="card kpi"><div className="l">{l}</div><div className="v">{v}</div><div className="s">{s}</div></div>;
}
