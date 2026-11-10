import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, fetchAll, wardLabel, timeAgo, fmt } from './lib.js';
import MemberUploads from './MemberUploads.jsx';

const WARDS = Array.from({ length: 250 }, (_, i) => i + 1);

// Accepts headers in English or Hindi, any case.
const pick = (row, names) => {
  for (const k of Object.keys(row)) if (names.includes(k.trim().toLowerCase())) return row[k];
  return undefined;
};

export default function Members() {
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState('');
  const [ward, setWard] = useState('all');
  const [status, setStatus] = useState('all');
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);

  const load = async () => setMembers(await fetchAll('member_stats', '*', (x) => x.order('ward_no')));
  useEffect(() => { load(); }, []);

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
        good.push({
          mobile, name, ward_no,
          ward_name: String(pick(r, ['ward name', 'ward_name']) ?? '').trim() || null,
          zone: String(pick(r, ['zone', 'mcd zone', 'ज़ोन', 'जोन']) ?? '').trim() || null,
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
    const ws = XLSX.utils.aoa_to_sheet([['name', 'mobile', 'ward', 'ward name', 'zone', 'assembly'], ['Ramesh Kumar', '9876543210', 17, '', 'Central', '']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'members');
    XLSX.writeFile(wb, 'ward-members-template.xlsx');
  };

  const exportAll = () => {
    const ws = XLSX.utils.json_to_sheet(members.map((m) => ({ name: m.name, mobile: m.mobile, ward: m.ward_no, zone: m.zone, assembly: m.assembly, logged_in: m.first_login_at ? 'yes' : 'no', tasks_done: m.tasks_done, videos: m.videos, last_active: m.last_active_at })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'members');
    XLSX.writeFile(wb, 'ward-members-report.xlsx');
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

  const list = members.filter((m) =>
    (ward === 'all' || m.ward_no === Number(ward)) &&
    (status === 'all' ||
      (status === 'in' && m.first_login_at && m.active !== false) ||
      (status === 'out' && !m.first_login_at && m.active !== false) ||
      (status === 'idle' && m.first_login_at && m.active !== false && (!m.last_active_at || Date.now() - new Date(m.last_active_at) > 86400000)) ||
      (status === 'blocked' && m.active === false)) &&
    (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.mobile.includes(q)));

  return (
    <section className="card">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h2>Ward members · {fmt(members.length)}</h2>
          <p className="sub">Excel columns: name, mobile, ward (1 to 250). Optional: ward name, zone, assembly. Re-uploading updates existing numbers.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={template}>Download template</button>
          <button className="btn ghost" onClick={exportAll}>Export report</button>
          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
            {busy ? 'Uploading…' : 'Upload Excel'}
            <input type="file" accept=".xlsx,.xls,.csv" hidden disabled={busy} onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
          </label>
        </div>
      </div>
      {note && <div className={'notice' + (note.ok ? ' ok' : '')} style={{ marginTop: 12 }}>{note.text}</div>}

      <div className="filters" style={{ marginTop: 14 }}>
        <label htmlFor="mq">Find</label>
        <input id="mq" type="text" placeholder="Name or mobile number" value={q} onChange={(e) => setQ(e.target.value)} />
        <label htmlFor="mw">Ward</label>
        <select id="mw" value={ward} onChange={(e) => setWard(e.target.value)}>
          <option value="all">All 250 wards</option>
          {WARDS.map((w) => <option key={w} value={w}>{wardLabel(w)}</option>)}
        </select>
        <label htmlFor="ms">Status</label>
        <select id="ms" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All</option>
          <option value="in">Logged in</option>
          <option value="out">Not logged in</option>
          <option value="idle">Inactive 24 hrs</option>
          <option value="blocked">Blocked</option>
        </select>
        <span className="muted" style={{ fontSize: 13 }}>{fmt(list.length)} shown</span>
      </div>

      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Ward</th>
              <th>Zone</th>
              <th>App login</th>
              <th>Status</th>
              <th>Tasks done</th>
              <th>Videos</th>
              <th>Last active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 500).map((m) => (
              <tr key={m.mobile}>
                <td><b>{m.name}</b></td>
                <td>{m.mobile}</td>
                <td>{wardLabel(m.ward_no)}</td>
                <td className="muted">{m.zone || '–'}</td>
                <td><span className={'tag ' + (m.first_login_at ? 'ok' : 'no')}>{m.first_login_at ? 'Logged in' : 'Not yet'}</span></td>
                <td><span className={'tag ' + (m.active !== false ? 'ok' : 'no')}>{m.active !== false ? 'Active' : 'Blocked'}</span></td>
                <td>{m.tasks_done}</td>
                <td>{m.videos}</td>
                <td className="muted">{timeAgo(m.last_active_at)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }} onClick={() => setOpen(m)}>Uploads</button>{' '}
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
            ))}
          </tbody>
        </table>
        {list.length > 500 && <p className="muted">Showing first 500. Use the ward filter or search to narrow.</p>}
      </div>
      {open && <MemberUploads member={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
