import React, { useEffect, useMemo, useState } from 'react';
import { Stars, Pts } from './icons.jsx';
import * as XLSX from 'xlsx';
import { supabase, fetchAll, wardLabel, timeAgo, fmt, getMemberRating, districtOf } from './lib.js';
import MemberUploads from './MemberUploads.jsx';

const WARDS = Array.from({ length: 250 }, (_, i) => i + 1);

// Accepts headers in English or Hindi, any case.
const pick = (row, names) => {
  for (const k of Object.keys(row)) if (names.includes(k.trim().toLowerCase())) return row[k];
  return undefined;
};

const mobile10 = (v) => { const d = String(v ?? '').replace(/\D/g, '').slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; };
const ROLE_NAME = { president: 'DPCC President', gs: 'General Secretary', dc: 'District Coordinator', dp: 'District President', observer: 'Observer' };

/**
 * Ward members list. With mode="block" the same screen lists Block Presidents: people who hold a block
 * (one block per ward). A person can be both, and can also hold a leader post on the same number.
 */
export default function Members({ mode = 'members' }) {
  const block = mode === 'block';
  const [all, setAll] = useState([]);
  const [master, setMaster] = useState([]);
  const [leaders, setLeaders] = useState({});
  const [district, setDistrict] = useState('all');
  const [assembly, setAssembly] = useState('all');
  const [edit, setEdit] = useState(null);
  const [bp, setBp] = useState({ name: '', mobile: '', block_no: '' });
  const members = useMemo(() => all.filter((m) => (block ? m.block_no != null : m.is_applicant !== false)), [all, block]);
  const [q, setQ] = useState('');
  const [ward, setWard] = useState('all');
  const [status, setStatus] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);

  const load = async () => setAll(await fetchAll('member_stats', '*', (x) => x.order('ward_no')));
  useEffect(() => {
    load();
    fetchAll('wards', 'ward_no, ward_name, district, assembly, lok_sabha').then(setMaster).catch(() => {});
    fetchAll('leaders', 'mobile, role, district, assembly', (q) => q.eq('active', true)).then((ls) => setLeaders(Object.fromEntries(ls.map((l) => [l.mobile, l])))).catch(() => {});
  }, []);

  // Area lists for the filters: district, then the assemblies of that district, then the wards of that assembly.
  const areaOf = (m) => {
    const w = master.find((x) => x.ward_no === (block ? m.block_no : m.ward_no));
    return { district: w?.district || districtOf(m), assembly: w?.assembly || m.assembly || '' };
  };
  const districts = useMemo(() => [...new Set([...master.map((w) => w.district), ...all.map(districtOf)].filter(Boolean))].sort(), [master, all]);
  const assemblies = useMemo(() => [...new Set((master.length ? master : all).filter((w) => district === 'all' || (w.district || districtOf(w)) === district).map((w) => w.assembly).filter(Boolean))].sort(), [master, all, district]);
  const wardOptions = useMemo(() => (master.length ? master : WARDS.map((n) => ({ ward_no: n })))
    .filter((w) => (district === 'all' || w.district === district) && (assembly === 'all' || w.assembly === assembly)).sort((a, b) => a.ward_no - b.ward_no), [master, district, assembly]);

  /** Adds Block Presidents: an existing person just gets the block; a new number is added as a Block President only. */
  const saveBlockPresidents = async (rows) => {
    const have = new Map(all.map((m) => [m.mobile, m]));
    let added = 0, updated = 0; const bad = [];
    for (const [i, r] of rows.entries()) {
      const mobile = mobile10(r.mobile), name = String(r.name || '').trim(), no = parseInt(String(r.block_no ?? '').replace(/\D/g, ''), 10);
      if (!mobile || !(no >= 1 && no <= 250) || (!name && !have.has(mobile))) { bad.push(i + 1); continue; }
      const w = master.find((x) => x.ward_no === no) || {};
      const res = have.has(mobile)
        ? await supabase.from('members').update({ block_no: no }).eq('mobile', mobile)
        : await supabase.from('members').insert({ mobile, name, ward_no: no, ward_name: w.ward_name || null, district: w.district || null, zone: w.district || null, assembly: w.assembly || null, lok_sabha: w.lok_sabha || null, is_applicant: false, block_no: no });
      if (res.error) { setNote({ ok: false, text: res.error.message }); return; }
      have.has(mobile) ? updated++ : added++;
    }
    setNote({ ok: true, text: `${added} new Block Presidents added, ${updated} existing people given a block.` + (bad.length ? ` ${bad.length} rows skipped (need name, 10-digit mobile and block number 1 to 250).` : '') });
    load();
  };
  const uploadBlock = async (file) => {
    setBusy(true); setNote(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }).map((r) => ({
        name: pick(r, ['name', 'नाम', 'block president', 'block president name']), mobile: pick(r, ['mobile', 'mobile number', 'phone', 'मोबाइल']),
        block_no: pick(r, ['block', 'block no', 'block_no', 'block number', 'ward', 'ward no', 'ward_no', 'ब्लॉक', 'वार्ड']),
      }));
      await saveBlockPresidents(rows);
    } catch (e) { setNote({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const removeBlock = async (m) => {
    if (!window.confirm(`Take the block away from ${m.name}? ${m.is_applicant === false ? 'They are only a Block President, so their login will be removed too.' : 'They stay a ward member.'}`)) return;
    const res = m.is_applicant === false ? await supabase.from('members').delete().eq('mobile', m.mobile) : await supabase.from('members').update({ block_no: null }).eq('mobile', m.mobile);
    if (res.error) alert(res.error.message); else load();
  };

  const upload = async (file) => {
    setBusy(true); setNote(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const good = []; const bad = [];
      rows.forEach((r, i) => {
        const mobile = String(pick(r, ['mobile', 'mobile number', 'phone', 'मोबाइल']) ?? '').replace(/\D/g, '').slice(-10);
        const name = String(pick(r, ['name', 'नाम']) ?? '').trim();
        const ward_no = parseInt(String(pick(r, ['ward', 'ward no', 'ward_no', 'ward number', 'वार्ड']) ?? '').replace(/\D/g, ''), 10);
        if (!/^[6-9]\d{9}$/.test(mobile) || !name || !(ward_no >= 1 && ward_no <= 250)) { bad.push(i + 2); return; }
        const distVal = String(pick(r, ['district', 'district name', 'dist', 'ज़िला', 'जिला', 'zone', 'mcd zone', 'ज़ोन', 'जोन']) ?? '').trim() || null;
        good.push({
          mobile, name, ward_no,
          ward_name: String(pick(r, ['ward name', 'ward_name']) ?? '').trim() || null,
          district: distVal,
          zone: distVal,
          assembly: String(pick(r, ['assembly', 'ac', 'vidhan sabha', 'विधानसभा']) ?? '').trim() || null,
        });
      });
      const unique = Object.values(Object.fromEntries(good.map((g) => [g.mobile, g])));
      for (let i = 0; i < unique.length; i += 500) {
        const { error } = await supabase.from('members').upsert(unique.slice(i, i + 500), { onConflict: 'mobile' });
        if (error) throw error;
      }
      setNote({ ok: true, text: `${fmt(unique.length)} members saved.` + (bad.length ? ` ${bad.length} rows skipped (bad mobile, name or ward): rows ${bad.slice(0, 20).join(', ')}${bad.length > 20 ? '…' : ''}` : '') });
      load();
    } catch (e) {
      setNote({ ok: false, text: e.message });
    }
    setBusy(false);
  };

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet(block
      ? [['name', 'mobile', 'block'], ['Ramesh Kumar', '9876543210', 17]]
      : [['name', 'mobile', 'ward', 'ward name', 'district', 'assembly'], ['Ramesh Kumar', '9876543210', 17, '', 'Central', '']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, block ? 'block presidents' : 'members');
    XLSX.writeFile(wb, block ? 'block-presidents-template.xlsx' : 'ward-members-template.xlsx');
  };

  const exportAll = () => {
    const ws = XLSX.utils.json_to_sheet(members.map((m) => {
      const r = getMemberRating(m);
      return {
        name: m.name,
        mobile: m.mobile,
        ward: m.ward_no,
        district: m.district || m.zone,
        assembly: m.assembly,
        points: m.points || 0,
        rating_stars: r.stars,
        rating_grade: r.grade,
        rating_label: r.label,
        logged_in: m.first_login_at ? 'yes' : 'no',
        status: m.active !== false ? 'Active' : 'Blocked',
        tasks_done: m.tasks_done,
        videos: m.videos,
        photos: m.photos || 0,
        last_active: m.last_active_at,
      };
    }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'members');
    XLSX.writeFile(wb, 'ward-members-performance-report.xlsx');
  };

  const toggle = async (m) => {
    const isCurrentlyActive = m.active !== false;
    const action = isCurrentlyActive ? 'block' : 'unblock';
    if (!window.confirm(`Are you sure you want to ${action} ${m.name} (${m.mobile})?`)) return;
    const { error } = await supabase.from('members').update({ active: !isCurrentlyActive }).eq('mobile', m.mobile);
    if (error) {
      alert(`Failed to update status: ${error.message}`);
      return;
    }
    load();
  };

  const list = members.filter((m) => {
    if (ward !== 'all' && (block ? m.block_no : m.ward_no) !== Number(ward)) return false;
    if (district !== 'all' && areaOf(m).district !== district) return false;
    if (assembly !== 'all' && areaOf(m).assembly !== assembly) return false;
    if (status === 'in' && (!m.first_login_at || m.active === false)) return false;
    if (status === 'out' && (m.first_login_at || m.active === false)) return false;
    if (status === 'idle' && (!m.first_login_at || m.active === false || (m.last_active_at && Date.now() - new Date(m.last_active_at) <= 86400000))) return false;
    if (status === 'blocked' && m.active !== false) return false;
    if (ratingFilter !== 'all') {
      const r = getMemberRating(m);
      if (String(r.stars) !== ratingFilter) return false;
    }
    if (q) {
      const s = q.trim().toLowerCase();
      return m.name.toLowerCase().includes(s) || m.mobile.includes(s) || (m.district && m.district.toLowerCase().includes(s));
    }
    return true;
  });

  return (
    <section className="card">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h2>{block ? 'Block Presidents' : 'Ward members'} · {fmt(members.length)}</h2>
          <p className="sub">{block
            ? 'One block per ward, 250 in all. Block Presidents use the app like ward members: same tasks, same points. Excel columns: name, mobile, block (1 to 250). Someone who is already a ward member or a leader just gets the block added to the same number.'
            : 'Excel columns: name, mobile, ward (1 to 250). Optional: ward name, district, assembly. Re-uploading updates existing numbers.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={template}>Download template</button>
          <button className="btn ghost" onClick={exportAll}>Export performance report</button>
          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
            {busy ? 'Uploading…' : 'Upload Excel'}
            <input type="file" accept=".xlsx,.xls,.csv" hidden disabled={busy} onChange={(e) => { const f = e.target.files[0]; if (f) (block ? uploadBlock(f) : upload(f)); e.target.value = ''; }} />
          </label>
        </div>
      </div>
      {note && <div className={'notice' + (note.ok ? ' ok' : '')} style={{ marginTop: 12 }}>{note.text}</div>}

      {block && (
        <form className="form" style={{ alignItems: 'end' }} onSubmit={(e) => { e.preventDefault(); saveBlockPresidents([bp]); setBp({ name: '', mobile: '', block_no: '' }); }}>
          <label>Name<input value={bp.name} onChange={(e) => setBp({ ...bp, name: e.target.value })} placeholder="Leave empty if the number is already in the app" /></label>
          <label>Mobile<input value={bp.mobile} onChange={(e) => setBp({ ...bp, mobile: e.target.value })} inputMode="numeric" required /></label>
          <label>Block (same number as the ward)
            <select value={bp.block_no} onChange={(e) => setBp({ ...bp, block_no: e.target.value })} required>
              <option value="">Choose…</option>
              {(master.length ? master : WARDS.map((n) => ({ ward_no: n }))).map((w) => <option key={w.ward_no} value={w.ward_no}>Block {w.ward_no}{w.ward_name ? ' · ' + w.ward_name : ''}</option>)}
            </select>
          </label>
          <div><button className="btn" type="submit">Add Block President</button></div>
        </form>
      )}

      <div className="filters" style={{ marginTop: 14 }}>
        <label htmlFor="mq">Find</label>
        <input id="mq" type="text" placeholder="Name or mobile number" value={q} onChange={(e) => setQ(e.target.value)} />
        <label htmlFor="md">District</label>
        <select id="md" value={district} onChange={(e) => { setDistrict(e.target.value); setAssembly('all'); setWard('all'); }}>
          <option value="all">All districts</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label htmlFor="ma">Assembly</label>
        <select id="ma" value={assembly} onChange={(e) => { setAssembly(e.target.value); setWard('all'); }}>
          <option value="all">{district === 'all' ? 'All assemblies' : `All of ${district}`}</option>
          {assemblies.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label htmlFor="mw">{block ? 'Block' : 'Ward'}</label>
        <select id="mw" value={ward} onChange={(e) => setWard(e.target.value)}>
          <option value="all">{district === 'all' && assembly === 'all' ? 'All 250' : `All ${wardOptions.length}`}</option>
          {wardOptions.map((w) => <option key={w.ward_no} value={w.ward_no}>{wardLabel(w.ward_no)}{w.ward_name ? ' · ' + w.ward_name : ''}</option>)}
        </select>
        <label htmlFor="ms">Status</label>
        <select id="ms" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="in">Logged in</option>
          <option value="out">Not logged in</option>
          <option value="idle">Inactive 24 hrs</option>
          <option value="blocked">Blocked</option>
        </select>
        <label htmlFor="mr">Rating</label>
        <select id="mr" value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
          <option value="all">All ratings</option>
          <option value="5">5 Stars - Star Leader</option>
          <option value="4">4 Stars - Active</option>
          <option value="3">3 Stars - Moderate</option>
          <option value="2">2 Stars - Needs Push</option>
          <option value="1">1 Star - Inactive</option>
        </select>
        <span className="muted" style={{ fontSize: 13 }}>{fmt(list.length)} shown</span>
      </div>

      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>{block ? 'Block' : 'Ward'}</th>
              <th>District</th>
              <th>Points</th>
              <th>Performance & Rating</th>
              <th>Tasks</th>
              <th>Videos</th>
              <th>Status</th>
              <th>Last active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 500).map((m) => {
              const r = getMemberRating(m);
              return (
                <tr key={m.mobile}>
                  <td><b>{m.name}</b>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                      {!block && m.block_no != null && <span className="tag live">Also Block President · {m.block_no}</span>}
                      {block && m.is_applicant !== false && <span className="tag live">Also ward member · {wardLabel(m.ward_no)}</span>}
                      {leaders[m.mobile] && <span className="tag mute">Also {ROLE_NAME[leaders[m.mobile].role] || leaders[m.mobile].role}{leaders[m.mobile].assembly ? ' · ' + leaders[m.mobile].assembly : leaders[m.mobile].district ? ' · ' + leaders[m.mobile].district : ''}</span>}
                    </div>
                  </td>
                  <td>{m.mobile}</td>
                  <td>{block ? 'Block ' + m.block_no : wardLabel(m.ward_no)}<div className="muted" style={{ fontSize: 12 }}>{areaOf(m).assembly}</div></td>
                  <td className="muted">{areaOf(m).district || '–'}</td>
                  <td><span className="pts-badge"><Pts>{fmt(m.points || 0)}</Pts></span></td>
                  <td>
                    <Stars n={r.stars} />{' '}
                    <span className={r.badgeClass}>{r.grade} · {r.label}</span>
                  </td>
                  <td><b>{m.tasks_done}</b></td>
                  <td>{m.videos}</td>
                  <td><span className={'tag ' + (m.active !== false ? (m.first_login_at ? 'ok' : 'live') : 'no')}>{m.active !== false ? (m.first_login_at ? 'Active' : 'Invited') : 'Blocked'}</span></td>
                  <td className="muted">{timeAgo(m.last_active_at)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => setEdit(m)}>Edit details</button>{' '}
                    <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => setOpen(m)}>Uploads</button>{' '}
                    {block && <><button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => removeBlock(m)}>Remove block</button>{' '}</>}
                    <button
                      className={'btn ' + (m.active !== false ? 'warn' : 'ghost')}
                      style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                      onClick={() => toggle(m)}
                      title={m.active !== false ? 'Block member login' : 'Unblock member login'}
                    >
                      {m.active !== false ? 'Block' : 'Unblock'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length > 500 && <p className="muted">Showing first 500. Use the ward/rating filter or search to narrow.</p>}
      </div>
      {!list.length && <p className="muted">{block && !members.length ? 'No Block Presidents yet. Add one above or upload the Excel when the list arrives.' : 'Nobody matches these filters.'}</p>}
      {open && <MemberUploads member={open} onClose={() => setOpen(null)} />}
      {edit && <EditMember member={edit} master={master} onClose={(saved) => { setEdit(null); if (saved) { setNote({ ok: true, text: saved }); load(); } }} />}
    </section>
  );
}

/** Edit one person: name, login number, ward, block and contact number. The area follows the ward from the master sheet. */
function EditMember({ member, master, onClose }) {
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => {
    const { data } = await supabase.from('members').select('*').eq('mobile', member.mobile).maybeSingle();
    const m = data || member;
    setF({ name: m.name || '', mobile: m.mobile, ward_no: m.ward_no, ward_name: m.ward_name || '', district: m.district || m.zone || '', assembly: m.assembly || '', lok_sabha: m.lok_sabha || '',
      alt_mobile: m.alt_mobile || '', block_no: m.block_no ?? '', is_applicant: m.is_applicant !== false });
  })(); }, [member.mobile]);
  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setWard = (e) => {
    const no = Number(e.target.value); const w = master.find((x) => x.ward_no === no);
    setF({ ...f, ward_no: no, ...(w ? { ward_name: w.ward_name || '', district: w.district || '', assembly: w.assembly || '', lok_sabha: w.lok_sabha || '' } : {}) });
  };
  const save = async (e) => {
    e.preventDefault(); setErr('');
    const name = f.name.trim(), mobile = mobile10(f.mobile);
    if (!name) { setErr('Name is needed.'); return; }
    if (!mobile) { setErr('Login number must be a 10-digit mobile number.'); return; }
    if (f.alt_mobile && !mobile10(f.alt_mobile)) { setErr('The other number must be a 10-digit mobile number, or leave it empty.'); return; }
    if (!f.is_applicant && f.block_no === '') { setErr('This person must be a ward member, a Block President, or both.'); return; }
    setBusy(true);
    let note = 'Details saved.';
    if (mobile !== member.mobile) {
      if (!window.confirm(`Change the login number from ${member.mobile} to ${mobile}?\n\nPoints, tasks, uploads and messages move to the new number. The old number stops working and the member has to log in again with the new one.`)) { setBusy(false); return; }
      const { error } = await supabase.rpc('change_member_mobile', { old_mobile: member.mobile, new_mobile: mobile });
      if (error) { setBusy(false); setErr(error.message.includes('number_in_use') ? `${mobile} already belongs to another person in this list. Nothing was changed.` : error.message); return; }
      note = `Details saved. Login number changed to ${mobile}.`;
    }
    const row = { name, ward_no: Number(f.ward_no), ward_name: f.ward_name || null, district: f.district || null, zone: f.district || null, assembly: f.assembly || null,
      lok_sabha: f.lok_sabha || null, alt_mobile: mobile10(f.alt_mobile) || null, block_no: f.block_no === '' ? null : Number(f.block_no), is_applicant: f.is_applicant };
    const { error } = await supabase.from('members').update(row).eq('mobile', mobile);
    // Keep the approved profile in step, so the app shows the corrected name and area too.
    if (!error) await supabase.from('member_profiles').update({ full_name: name, ward_no: row.ward_no, assembly: row.assembly, district: row.district, lok_sabha: row.lok_sabha }).eq('mobile', mobile);
    setBusy(false);
    if (error) setErr(error.message); else onClose(note);
  };
  const wards = master.length ? master : Array.from({ length: 250 }, (_, i) => ({ ward_no: i + 1 }));
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={'Edit ' + member.name} onClick={() => onClose(null)}>
      <form className="card" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>Edit details</h2>
        <p className="sub">Changes show in the app the next time it opens.</p>
        <div className="form">
          <label>Name<input value={f.name} onChange={set('name')} required /></label>
          <label>Login number<input value={f.mobile} onChange={set('mobile')} inputMode="numeric" required />
            <span className="muted" style={{ fontSize: 12 }}>Changing this moves everything to the new number.</span></label>
          <label>Ward<select value={f.ward_no} onChange={setWard}>{wards.map((w) => <option key={w.ward_no} value={w.ward_no}>{wardLabel(w.ward_no)}{w.ward_name ? ' · ' + w.ward_name : ''}</option>)}</select></label>
          <label>Assembly<input value={f.assembly} onChange={set('assembly')} /></label>
          <label>Congress district<input value={f.district} onChange={set('district')} /></label>
          <label>Lok Sabha<input value={f.lok_sabha} onChange={set('lok_sabha')} /></label>
          <label>Other mobile number<input value={f.alt_mobile} onChange={set('alt_mobile')} inputMode="numeric" /></label>
          <label>Block President of
            <select value={f.block_no} onChange={set('block_no')}>
              <option value="">Not a Block President</option>
              {wards.map((w) => <option key={w.ward_no} value={w.ward_no}>Block {w.ward_no}{w.ward_name ? ' · ' + w.ward_name : ''}</option>)}
            </select></label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={f.is_applicant} onChange={set('is_applicant')} /> Is a ward member (applicant)</label>
        </div>
        {err && <div className="notice" style={{ marginTop: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="btn ghost" type="button" onClick={() => onClose(null)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
