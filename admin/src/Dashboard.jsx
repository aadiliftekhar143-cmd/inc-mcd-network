import React, { useEffect, useMemo, useState } from 'react';
import { Stars, IconText, Pts, Star, Download, BarChart3, Building2, Trophy, ClipboardList, Medal, TriangleAlert } from './icons.jsx';
import * as XLSX from 'xlsx';
import { supabase, fetchAll, istToday, fmt, pct, wardLabel, timeAgo, heatClass, dayLabel, getMemberRating, getWardRating } from './lib.js';
import MemberUploads from './MemberUploads.jsx';

const WARDS = Array.from({ length: 250 }, (_, i) => i + 1);

export default function Dashboard() {
  const [members, setMembers] = useState([]);
  const [days, setDays] = useState([]);           // day_stats rows
  const [wardDay, setWardDay] = useState([]);     // ward_day_stats for selected day
  const [hours, setHours] = useState([]);
  const [day, setDay] = useState(istToday());
  const [ward, setWard] = useState('all');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [group, setGroup] = useState('district');
  const [color, setColor] = useState('completion');
  const [scope, setScope] = useState('delhi');
  const [activeTab, setActiveTab] = useState('overview'); // overview, districts, leaderboard, followup
  const [ratingFilter, setRatingFilter] = useState('all');
  const [wardSearch, setWardSearch] = useState('');
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

  // Filter scoped members
  const scoped = useMemo(() => {
    return members.filter((m) => {
      if (ward !== 'all' && m.ward_no !== Number(ward)) return false;
      if (selectedDistrict !== 'all' && (m.district || m.zone) !== selectedDistrict) return false;
      return true;
    });
  }, [members, ward, selectedDistrict]);

  const loggedIn = scoped.filter((m) => m.first_login_at).length;
  const wdScoped = ward === 'all'
    ? (selectedDistrict === 'all' ? wardDay : wardDay.filter((w) => {
        const m = members.find((x) => x.ward_no === w.ward_no);
        return m && (m.district || m.zone) === selectedDistrict;
      }))
    : wardDay.filter((w) => w.ward_no === Number(ward));

  const completed = wdScoped.reduce((a, w) => a + w.completed, 0);
  const active = wdScoped.reduce((a, w) => a + w.active, 0);
  const videos = wdScoped.reduce((a, w) => a + Number(w.videos), 0);
  const assigned = scoped.length * tasksToday;
  const totalPoints = scoped.reduce((a, m) => a + Number(m.points || 0), 0);

  // Per-ward completion & points for the selected day
  const wardStats = useMemo(() => {
    const byWard = {};
    for (const m of members) {
      const dist = m.district || m.zone || 'Central';
      const w = (byWard[m.ward_no] ||= {
        ward_no: m.ward_no,
        zone: dist,
        district: dist,
        assembly: m.assembly || 'No assembly',
        members: 0,
        completed: 0,
        active: 0,
        videos: 0,
        points: 0,
      });
      w.members += 1;
      w.points += Number(m.points || 0);
    }
    for (const r of wardDay) {
      const w = byWard[r.ward_no];
      if (w) { w.completed = r.completed; w.active = r.active; w.videos = Number(r.videos); }
    }
    return Object.values(byWard).map((w) => {
      const comp = pct(w.completed, w.members * tasksToday);
      return {
        ...w,
        completion: comp,
        activePct: pct(w.active, w.members),
        rating: getWardRating(comp),
      };
    });
  }, [members, wardDay, tasksToday]);

  const metric = (w) => (color === 'completion' ? w.completion : color === 'active' ? w.activePct : Math.min(100, w.videos * 5));

  // Groups by District or Assembly
  const groups = useMemo(() => {
    const key = group === 'assembly' ? 'assembly' : 'district';
    const g = {};
    for (const w of wardStats) (g[w[key]] ||= []).push(w);
    return Object.entries(g).map(([name, wards]) => ({
      name,
      wards: wards.sort((a, b) => a.ward_no - b.ward_no),
      avg: Math.round(wards.reduce((a, w) => a + w.completion, 0) / wards.length),
      totalPoints: wards.reduce((a, w) => a + Number(w.points || 0), 0),
      totalVideos: wards.reduce((a, w) => a + Number(w.videos || 0), 0),
      totalMembers: wards.reduce((a, w) => a + Number(w.members || 0), 0),
      rating: getWardRating(Math.round(wards.reduce((a, w) => a + w.completion, 0) / wards.length)),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [wardStats, group]);

  const groupRank = [...groups].sort((a, b) => b.avg - a.avg || b.totalPoints - a.totalPoints);
  const wardRank = [...wardStats].sort((a, b) => b.completion - a.completion || b.points - a.points);
  const topDistrict = groupRank[0];

  // Distinct districts list
  const districtList = useMemo(() => {
    const set = new Set();
    members.forEach((m) => { if (m.district || m.zone) set.add(m.district || m.zone); });
    return Array.from(set).sort();
  }, [members]);

  // Star rating distribution counts
  const starCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, total: scoped.length };
    scoped.forEach((m) => {
      const r = getMemberRating(m);
      counts[r.stars] = (counts[r.stars] || 0) + 1;
    });
    return counts;
  }, [scoped]);

  // Member Leaderboard Ranking
  const ranking = useMemo(() => {
    const list = scope === 'ward' && ward !== 'all' ? scoped : members;
    const filtered = list.filter((m) => {
      if (selectedDistrict !== 'all' && (m.district || m.zone) !== selectedDistrict) return false;
      if (ratingFilter !== 'all') {
        const r = getMemberRating(m);
        if (String(r.stars) !== ratingFilter) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => (b.points || 0) - (a.points || 0) || b.tasks_done - a.tasks_done || b.videos - a.videos);
    const wardPos = {};
    const byWard = {};
    for (const m of [...members].sort((a, b) => (b.points || 0) - (a.points || 0))) {
      byWard[m.ward_no] = (byWard[m.ward_no] || 0) + 1;
      wardPos[m.mobile] = byWard[m.ward_no];
    }
    const wardSize = {};
    for (const m of members) wardSize[m.ward_no] = (wardSize[m.ward_no] || 0) + 1;

    return sorted.slice(0, 50).map((m, i) => ({
      ...m,
      rank: i + 1,
      wardRank: `${wardPos[m.mobile]} of ${wardSize[m.ward_no]}`,
      rating: getMemberRating(m),
    }));
  }, [members, scoped, scope, ward, selectedDistrict, ratingFilter]);

  // Hours
  const maxHour = Math.max(1, ...hours.map((h) => Number(h.uploads)));
  const hourCols = Array.from({ length: 17 }, (_, i) => {
    const hr = 7 + i;
    const row = hours.find((h) => h.hour === hr);
    return { hr, v: row ? Number(row.uploads) : 0, label: hr === 12 ? '12p' : hr > 12 ? hr - 12 + 'p' : hr + 'a' };
  });

  const notInstalled = scoped.length - loggedIn;
  const inactive = scoped.filter((m) => m.first_login_at && (!m.last_active_at || Date.now() - new Date(m.last_active_at) > 86400000)).length;

  // Export Complete Performance & Rating Report
  const exportPerformanceReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: District Performance
    const distData = groupRank.map((g, i) => ({
      Rank: i + 1,
      District: g.name,
      'Total Wards': g.wards.length,
      'Total Members': g.totalMembers,
      'Total Points': g.totalPoints,
      'Average Completion %': g.avg + '%',
      'Total Videos': g.totalVideos,
      Rating: g.rating.starStr,
      Grade: g.rating.grade,
      Status: g.rating.label,
    }));
    const ws1 = XLSX.utils.json_to_sheet(distData);
    XLSX.utils.book_append_sheet(wb, ws1, 'District Performance');

    // Sheet 2: Ward Performance
    const wardData = wardRank.map((w, i) => ({
      Rank: i + 1,
      Ward: wardLabel(w.ward_no),
      District: w.district,
      Assembly: w.assembly,
      Members: w.members,
      'Tasks Completed': w.completed,
      'Videos Uploaded': w.videos,
      'Total Points': w.points,
      'Completion %': w.completion + '%',
      Rating: w.rating.starStr,
      Grade: w.rating.grade,
      Status: w.rating.label,
    }));
    const ws2 = XLSX.utils.json_to_sheet(wardData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Ward Performance');

    // Sheet 3: Top Member Leaderboard
    const memData = members.map((m) => {
      const r = getMemberRating(m);
      return {
        Name: m.name,
        Mobile: m.mobile,
        Ward: wardLabel(m.ward_no),
        District: m.district || m.zone || '–',
        Points: m.points || 0,
        Rating: r.starStr,
        Grade: r.grade,
        'Rating Label': r.label,
        'Tasks Done': m.tasks_done || 0,
        'Videos Uploaded': m.videos || 0,
        'Photos Uploaded': m.photos || 0,
        'App Logged In': m.first_login_at ? 'Yes' : 'No',
        'Last Active': m.last_active_at || 'Never',
      };
    }).sort((a, b) => b.Points - a.Points);
    const ws3 = XLSX.utils.json_to_sheet(memData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Member Leaderboard');

    XLSX.writeFile(wb, `MCD-2027-Performance-Report-${day}.xlsx`);
  };

  return (
    <>
      {/* Top Filter Bar */}
      <div className="filters" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="dist">District</label>
          <select id="dist" value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
            <option value="all">All Districts</option>
            {districtList.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <label htmlFor="ward">Ward</label>
          <select id="ward" value={ward} onChange={(e) => setWard(e.target.value)} style={{ minWidth: 160 }}>
            <option value="all">All 250 wards</option>
            {WARDS.map((w) => <option key={w} value={w}>{wardLabel(w)}</option>)}
          </select>

          <label htmlFor="day">Day</label>
          <select id="day" value={day} onChange={(e) => setDay(e.target.value)}>
            {!days.find((d) => d.task_date === istToday()) && <option value={istToday()}>Today ({dayLabel(istToday())})</option>}
            {days.map((d, i) => <option key={d.task_date} value={d.task_date}>Day {i + 1} · {dayLabel(d.task_date)}{d.task_date === istToday() ? ' (today)' : ''}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" style={{ minHeight: 38, padding: '6px 14px', fontSize: 13 }} onClick={exportPerformanceReport}>
            <IconText icon={Download}>Export Performance & Ratings</IconText>
          </button>
          <span className="muted" style={{ fontSize: 12 }}>{updated ? 'Updated ' + updated.toLocaleTimeString('en-IN') : 'Loading…'}</span>
        </div>
      </div>

      {/* KPI Cards with Points and Ratings */}
      <section className="kpis" aria-label="Key numbers">
        <div className="card kpi" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="l">Total Campaign Points</div>
          <div className="v" style={{ color: '#B45309', display: 'flex', alignItems: 'center', gap: 6 }}><Star size={24} fill="currentColor" />{fmt(totalPoints)}</div>
          <div className="s">{scoped.length ? Math.round(totalPoints / scoped.length) + ' avg pts / member' : '0 pts'}</div>
        </div>
        <Kpi l="Registered members" v={fmt(scoped.length)} s={ward === 'all' ? (selectedDistrict === 'all' ? '250 wards' : selectedDistrict) : wardLabel(ward)} />
        <Kpi l="Tasks completed" v={fmt(completed)} s={pct(completed, assigned) + '% of ' + fmt(assigned) + ' assigned'} />
        <Kpi l="Videos uploaded" v={fmt(videos)} s={completed ? (videos / completed).toFixed(1) + ' per completed task' : '–'} />
        <Kpi l="Active this day" v={fmt(active)} s={pct(active, scoped.length) + '% response rate'} />
        <div className="card kpi" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="l">Top District</div>
          <div className="v" style={{ fontSize: 20, marginTop: 10 }}>{topDistrict ? topDistrict.name : '–'}</div>
          <div className="s">{topDistrict ? `${topDistrict.avg}% completion · ${fmt(topDistrict.totalPoints)} pts` : ''}</div>
        </div>
      </section>

      {/* Star Rating Breakdown Filter Bar */}
      <div className="card" style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Performance & Ratings:</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className={'star-btn ' + (ratingFilter === 'all' ? 'on' : '')} onClick={() => setRatingFilter('all')}>
              All <span className="cnt">{starCounts.total}</span>
            </button>
            <button className={'star-btn ' + (ratingFilter === '5' ? 'on' : '')} onClick={() => setRatingFilter('5')}>
              <Stars n={5} /> Star Leaders <span className="cnt">{starCounts[5] || 0}</span>
            </button>
            <button className={'star-btn ' + (ratingFilter === '4' ? 'on' : '')} onClick={() => setRatingFilter('4')}>
              <Stars n={4} /> Active <span className="cnt">{starCounts[4] || 0}</span>
            </button>
            <button className={'star-btn ' + (ratingFilter === '3' ? 'on' : '')} onClick={() => setRatingFilter('3')}>
              <Stars n={3} /> Moderate <span className="cnt">{starCounts[3] || 0}</span>
            </button>
            <button className={'star-btn ' + (ratingFilter === '2' ? 'on' : '')} onClick={() => setRatingFilter('2')}>
              <Stars n={2} /> Needs Push <span className="cnt">{starCounts[2] || 0}</span>
            </button>
            <button className={'star-btn ' + (ratingFilter === '1' ? 'on' : '')} onClick={() => setRatingFilter('1')}>
              <Stars n={1} /> Inactive <span className="cnt">{starCounts[1] || 0}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="tabs-subnav">
        <button className={activeTab === 'overview' ? 'on' : ''} onClick={() => setActiveTab('overview')}>
          <IconText icon={BarChart3}>Overview & Heatmap</IconText>
        </button>
        <button className={activeTab === 'districts' ? 'on' : ''} onClick={() => setActiveTab('districts')}>
          <IconText icon={Building2}>District Performance Matrix ({groups.length})</IconText>
        </button>
        <button className={activeTab === 'leaderboard' ? 'on' : ''} onClick={() => setActiveTab('leaderboard')}>
          <IconText icon={Trophy}>Points Leaderboard & Ratings</IconText>
        </button>
        <button className={activeTab === 'wards' ? 'on' : ''} onClick={() => setActiveTab('wards')}>
          <IconText icon={ClipboardList}>Ward Performance Scorecard ({wardStats.length})</IconText>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & HEATMAP */}
      {activeTab === 'overview' && (
        <>
          <div className="row">
            <section className="card grow" aria-label="Ward heat map">
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2>Ward heat map</h2>
                  <p className="sub">Each square is one ward, grouped by {group === 'district' ? 'district' : 'assembly'}. Click a square to filter to that ward.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <select value={group} onChange={(e) => setGroup(e.target.value)} style={{ padding: '4px 8px', fontSize: 13 }}>
                    <option value="district">Group by District</option>
                    <option value="assembly">Group by Assembly</option>
                  </select>
                  <div className="seg" role="group" aria-label="Colour by">
                    {[['completion', 'Completion'], ['active', 'Active'], ['videos', 'Videos']].map(([k, l]) => (
                      <button key={k} className={color === k ? 'on' : ''} onClick={() => setColor(k)}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="zones">
                {groups.map((g) => (
                  <div key={g.name}>
                    <div className="zh">
                      <b>{g.name}</b>
                      <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className="pts-badge" style={{ fontSize: 10, padding: '1px 5px' }}><Pts size={10}>{fmt(g.totalPoints)}</Pts></span>
                        {g.avg}%
                      </span>
                    </div>
                    <div className="cells">
                      {g.wards.map((w) => (
                        <button key={w.ward_no} className={'cell ' + (tasksToday ? heatClass(metric(w)) : 'hx')}
                          title={`${wardLabel(w.ward_no)} (${w.district}): ${w.completion}% done, ${w.active}/${w.members} active, ${w.points} pts, ${w.videos} videos`}
                          aria-label={`${wardLabel(w.ward_no)}: ${w.completion}% done`}
                          onClick={() => { setWard(String(w.ward_no)); }} />
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

            <section className="card side" aria-label="District ranking">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h2>District Ranking & Rating</h2>
                <button className="btn ghost" style={{ minHeight: 28, padding: '2px 8px', fontSize: 11 }} onClick={() => setActiveTab('districts')}>View full</button>
              </div>
              <p className="sub" style={{ marginBottom: 12 }}>Ranked by completion & points</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflow: 'auto' }}>
                {groupRank.map((g, i) => (
                  <div key={g.name} style={{ display: 'grid', gridTemplateColumns: '22px 110px minmax(0,1fr) 50px', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <span className="muted">
                      {i < 3 ? <Medal size={16} color={['#D4A017', '#9CA3AF', '#B87333'][i]} aria-label={'Rank ' + (i + 1)} /> : i + 1}
                    </span>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    <span className="bar"><span style={{ width: g.avg + '%', background: g.avg < 40 ? '#C2560A' : '#1B4FA8' }} /></span>
                    <b style={{ textAlign: 'right' }}>{g.avg}%</b>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Quick Top & Bottom Wards */}
          <div className="row">
            <section className="card grow" style={{ flex: '1 1 450px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2><IconText icon={Trophy} size={17} color="#B45309"><span style={{ color: '#14171C' }}>Top Performing Wards</span></IconText></h2>
                <span className="tag ok">High Activity</span>
              </div>
              <div className="tbl">
                <table>
                  <thead>
                    <tr><th>Ward</th><th>District</th><th>Points</th><th>Completion</th><th>Rating</th></tr>
                  </thead>
                  <tbody>
                    {wardRank.slice(0, 6).map((w) => (
                      <tr key={w.ward_no}>
                        <td><b>{wardLabel(w.ward_no)}</b></td>
                        <td className="muted">{w.district}</td>
                        <td><span className="pts-badge"><Pts>{fmt(w.points)}</Pts></span></td>
                        <td><b style={{ color: '#1B4FA8' }}>{w.completion}%</b></td>
                        <td>
                          <Stars n={w.rating.stars} />{' '}
                          <span className={w.rating.badgeClass}>{w.rating.grade}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card grow" style={{ flex: '1 1 450px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2><IconText icon={TriangleAlert} size={17} color="#C2560A"><span style={{ color: '#14171C' }}>Needs Attention Wards (Calling List)</span></IconText></h2>
                <span className="tag no">Low Activity</span>
              </div>
              <div className="tbl">
                <table>
                  <thead>
                    <tr><th>Ward</th><th>District</th><th>Points</th><th>Completion</th><th>Rating</th></tr>
                  </thead>
                  <tbody>
                    {wardRank.slice(-6).reverse().map((w) => (
                      <tr key={w.ward_no}>
                        <td><b>{wardLabel(w.ward_no)}</b></td>
                        <td className="muted">{w.district}</td>
                        <td><span className="pts-badge"><Pts>{fmt(w.points)}</Pts></span></td>
                        <td><b style={{ color: '#C2560A' }}>{w.completion}%</b></td>
                        <td>
                          <Stars n={w.rating.stars} />{' '}
                          <span className={w.rating.badgeClass}>{w.rating.grade}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Charts Row */}
          <div className="row">
            <section className="card" style={{ flex: '1 1 420px', minWidth: 0 }}>
              <h2>Daily completion trend</h2>
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
              {[
                ['Registered Members', scoped.length],
                ['Logged in to App', loggedIn],
                ['Did at least 1 task', scoped.filter((m) => m.tasks_done > 0).length],
                ['Active this day', active],
              ].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{l}</span><b>{fmt(v)}</b></div>
                  <div className="bar" style={{ height: 12 }}><span style={{ height: 12, width: pct(v, scoped.length) + '%' }} /></div>
                </div>
              ))}
              <div className="notice" style={{ marginTop: 14 }}>
                <b>Campaign Follow-up Alert</b>
                <div style={{ marginTop: 4, color: '#14171C' }}>{fmt(notInstalled)} not logged in · {fmt(inactive)} inactive 24 hrs</div>
              </div>
            </section>
          </div>
        </>
      )}

      {/* TAB 2: DISTRICT PERFORMANCE MATRIX */}
      {activeTab === 'districts' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h2><IconText icon={Building2} size={17}>District Performance & Rating Matrix</IconText></h2>
              <p className="sub">Comparative ranking of all {districtList.length} Delhi districts by points, tasks and response rate.</p>
            </div>
            <button className="btn ghost" onClick={exportPerformanceReport}>Export Matrix</button>
          </div>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>District</th>
                  <th>Wards</th>
                  <th>Members</th>
                  <th>Total Points</th>
                  <th>Videos</th>
                  <th>Completion Rate</th>
                  <th>Performance Rating</th>
                  <th>Action Status</th>
                </tr>
              </thead>
              <tbody>
                {groupRank.map((g, i) => (
                  <tr key={g.name}>
                    <td>
                      <span className={'rank-badge ' + (i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '')}>
                        {i + 1}
                      </span>
                    </td>
                    <td><b>{g.name}</b></td>
                    <td>{g.wards.length}</td>
                    <td>{fmt(g.totalMembers)}</td>
                    <td><span className="pts-badge large"><Pts size={13}>{fmt(g.totalPoints)}</Pts></span></td>
                    <td><b>{g.totalVideos}</b></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="bar" style={{ width: 80, height: 8 }}><span style={{ width: g.avg + '%', background: g.avg < 40 ? '#C2560A' : '#10B981' }} /></span>
                        <b>{g.avg}%</b>
                      </div>
                    </td>
                    <td>
                      <Stars n={g.rating.stars} />{' '}
                      <span className={g.rating.badgeClass}>{g.rating.grade} · {g.rating.label}</span>
                    </td>
                    <td>
                      <span className={'tag ' + (g.avg >= 70 ? 'ok' : g.avg >= 40 ? 'live' : 'no')}>
                        {g.avg >= 70 ? 'Excellent' : g.avg >= 40 ? 'Needs Attention' : 'Immediate Follow-up'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: POINTS LEADERBOARD & RATINGS */}
      {activeTab === 'leaderboard' && (
        <section className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div>
              <h2><IconText icon={Trophy} size={17}>Member Points Leaderboard & Ratings</IconText></h2>
              <p className="sub">Ranked by points (100 per share, 100 per photo, 200 per video). Showing top performers.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="seg" role="group" aria-label="Ranking scope">
                <button className={scope === 'delhi' ? 'on' : ''} onClick={() => setScope('delhi')}>Delhi</button>
                <button className={scope === 'ward' ? 'on' : ''} onClick={() => setScope('ward')} disabled={ward === 'all'} title={ward === 'all' ? 'Pick a ward first' : ''}>Within Ward</button>
              </div>
            </div>
          </div>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Member Name</th>
                  <th>Ward</th>
                  <th>District</th>
                  <th>Points</th>
                  <th>Performance & Rating</th>
                  <th>Tasks Done</th>
                  <th>Videos</th>
                  <th>Photos</th>
                  <th>Last Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ranking.map((m) => (
                  <tr key={m.mobile}>
                    <td>
                      <span className={'rank-badge ' + (m.rank === 1 ? 'rank-1' : m.rank === 2 ? 'rank-2' : m.rank === 3 ? 'rank-3' : '')}>
                        {m.rank}
                      </span>
                    </td>
                    <td>
                      <b>{m.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{m.mobile}</div>
                    </td>
                    <td>{wardLabel(m.ward_no)}</td>
                    <td className="muted">{m.district || m.zone || '–'}</td>
                    <td><span className="pts-badge large"><Pts size={13}>{fmt(m.points || 0)}</Pts></span></td>
                    <td>
                      <Stars n={m.rating.stars} />{' '}
                      <span className={m.rating.badgeClass}>{m.rating.grade} · {m.rating.label}</span>
                    </td>
                    <td><b>{m.tasks_done}</b></td>
                    <td>{m.videos}</td>
                    <td>{m.photos || 0}</td>
                    <td className="muted">{timeAgo(m.last_active_at)}</td>
                    <td>
                      <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => setOpenMember(m)}>Uploads</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: WARD SCORECARD */}
      {activeTab === 'wards' && (
        <section className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div>
              <h2><IconText icon={ClipboardList} size={17}>Ward Performance Scorecard</IconText></h2>
              <p className="sub">All 250 wards ranked by completion rate, activity, and total points.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search ward or district..."
                value={wardSearch}
                onChange={(e) => setWardSearch(e.target.value)}
                style={{ padding: '6px 12px', fontSize: 13 }}
              />
            </div>
          </div>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Ward</th>
                  <th>District</th>
                  <th>Members</th>
                  <th>Points</th>
                  <th>Tasks Completed</th>
                  <th>Videos</th>
                  <th>Completion Rate</th>
                  <th>Rating</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {wardRank
                  .filter((w) => {
                    if (!wardSearch) return true;
                    const s = wardSearch.toLowerCase();
                    return wardLabel(w.ward_no).toLowerCase().includes(s) || String(w.ward_no).includes(s) || w.district.toLowerCase().includes(s);
                  })
                  .slice(0, 100)
                  .map((w, i) => (
                    <tr key={w.ward_no}>
                      <td><span className="muted">{i + 1}</span></td>
                      <td><b>{wardLabel(w.ward_no)}</b></td>
                      <td className="muted">{w.district}</td>
                      <td>{w.members}</td>
                      <td><span className="pts-badge"><Pts>{fmt(w.points)}</Pts></span></td>
                      <td><b>{w.completed}</b></td>
                      <td>{w.videos}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="bar" style={{ width: 60, height: 8 }}><span style={{ width: w.completion + '%', background: w.completion < 40 ? '#C2560A' : '#10B981' }} /></span>
                          <b>{w.completion}%</b>
                        </div>
                      </td>
                      <td>
                        <Stars n={w.rating.stars} />{' '}
                        <span className={w.rating.badgeClass}>{w.rating.grade}</span>
                      </td>
                      <td>
                        <button className="btn ghost" style={{ minHeight: 30, padding: '3px 8px', fontSize: 11 }} onClick={() => { setWard(String(w.ward_no)); setActiveTab('leaderboard'); }}>
                          View Members
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {openMember && <MemberUploads member={openMember} onClose={() => setOpenMember(null)} />}
    </>
  );
}

function Kpi({ l, v, s }) {
  return <div className="card kpi"><div className="l">{l}</div><div className="v">{v}</div><div className="s">{s}</div></div>;
}
