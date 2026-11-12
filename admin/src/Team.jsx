import React, { useEffect, useMemo, useState } from 'react';
import { fetchAll, callFn, districtOf, timeAgo, fmt } from './lib.js';

const EMPTY = { role: 'telecaller', name: '', phone: '', email: '', password: '', districts: [], remarks: '' };

// Master admin only: create and manage telecallers (district-level access) and other admins.
export default function Team() {
  const [data, setData] = useState(null);
  const [allDistricts, setAllDistricts] = useState([]);
  const [form, setForm] = useState(null);
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: d, error } = await callFn('admin', { action: 'list' });
    if (error) { setNote({ ok: false, text: 'Could not load the team: ' + error + '. Is the "admin" function deployed?' }); setData({ telecallers: [], admins: [] }); return; }
    setData(d);
  }
  useEffect(() => {
    load();
    fetchAll('members', 'district, zone').then((rows) => setAllDistricts([...new Set(rows.map(districtOf).filter(Boolean))].sort()));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setNote(null);
    const { data: r, error } = await callFn('admin', { action: 'create', ...form });
    setBusy(false);
    if (error) { setNote({ ok: false, text: error }); return; }
    setNote({ ok: true, text: `Created. Login ID: ${r.login} · Password: the one you set. Share these with ${form.name}.` });
    setForm(null); load();
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await callFn('admin', { action: 'update', user_id: edit.user_id, name: edit.name, phone: edit.phone, districts: edit.districts, remarks: edit.remarks });
    setBusy(false);
    if (error) { setNote({ ok: false, text: error }); return; }
    setEdit(null); load();
  };

  const toggleActive = async (t) => {
    if (!window.confirm(`${t.active ? 'Disable' : 'Enable'} login for ${t.name}?`)) return;
    const { error } = await callFn('admin', { action: 'update', user_id: t.user_id, active: !t.active });
    if (error) setNote({ ok: false, text: error }); else load();
  };

  const resetPassword = async (u) => {
    const pw = window.prompt(`New password for ${u.name || u.label || u.email} (at least 8 characters):`);
    if (!pw) return;
    const { error } = await callFn('admin', { action: 'reset_password', user_id: u.user_id, password: pw });
    setNote(error ? { ok: false, text: error } : { ok: true, text: 'Password changed.' });
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name || u.label || u.email}? Their call history stays.`)) return;
    const { error } = await callFn('admin', { action: 'delete', user_id: u.user_id });
    if (error) setNote({ ok: false, text: error }); else load();
  };

  const coverage = useMemo(() => {
    const covered = new Set();
    (data?.telecallers || []).filter((t) => t.active).forEach((t) => t.districts.forEach((d) => covered.add(d.toLowerCase())));
    return allDistricts.filter((d) => !covered.has(d.toLowerCase()));
  }, [data, allDistricts]);

  const loginOf = (u) => (u.email || '').endsWith('@inc-mcd.local') ? u.email.replace('@inc-mcd.local', '') : u.email;

  return (
    <>
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h2>Team: telecallers and admins</h2>
            <p className="sub">Telecallers log in to this panel with their mobile number and password, and see only the ward members of their districts.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setForm({ ...EMPTY })}>+ Add telecaller</button>
            <button className="btn ghost" onClick={() => setForm({ ...EMPTY, role: 'admin' })}>+ Add admin</button>
          </div>
        </div>
        {note && <div className={'notice' + (note.ok ? ' ok' : '')} style={{ marginTop: 12 }}>{note.text}</div>}
        {coverage.length > 0 && data && (
          <div className="notice" style={{ marginTop: 12 }}>No active telecaller covers: {coverage.join(', ')}</div>
        )}

        {form && (
          <form onSubmit={create} className="card" style={{ marginTop: 14, background: '#F8F9FB' }}>
            <h2>{form.role === 'admin' ? 'New admin (full access)' : 'New telecaller'}</h2>
            <div className="form">
              <label>Name<input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
              <label>Mobile number (login ID)<input type="tel" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required={form.role === 'telecaller'} placeholder="10 digits" /></label>
              {form.role === 'admin' && <label>Email (optional, login with this instead)<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>}
              <label>Password (8+ characters)<input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>
            </div>
            {form.role === 'telecaller' && (
              <DistrictPicker all={allDistricts} value={form.districts} onChange={(districts) => setForm({ ...form, districts })} />
            )}
            {form.role === 'telecaller' && (
              <div className="form" style={{ gridTemplateColumns: '1fr' }}>
                <label>Remarks<textarea rows="2" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Shift timing, language, anything the team should know" /></label>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn" type="submit" disabled={busy || (form.role === 'telecaller' && !form.districts.length)}>{busy ? 'Creating…' : 'Create login'}</button>
              <button className="btn ghost" type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <h2>Telecallers · {data ? data.telecallers.length : '…'}</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>Name</th><th>Login (mobile)</th><th>Districts</th><th>Calls today</th><th>Calls total</th><th>Last login</th><th>Remarks</th><th>Status</th><th /></tr></thead>
            <tbody>
              {(data?.telecallers || []).map((t) => (
                <tr key={t.user_id}>
                  <td><b>{t.name}</b>{t.phone && <div className="muted" style={{ fontSize: 12 }}><a href={`tel:+91${t.phone}`}>{t.phone}</a></div>}</td>
                  <td>{loginOf(t)}</td>
                  <td style={{ maxWidth: 220 }}>{t.districts.join(', ')}</td>
                  <td><b>{fmt(t.calls?.today)}</b></td>
                  <td>{fmt(t.calls?.total)}</td>
                  <td className="muted">{timeAgo(t.last_sign_in_at)}</td>
                  <td style={{ maxWidth: 200, fontSize: 12 }}>{t.remarks || ''}</td>
                  <td><span className={'tag ' + (t.active ? 'ok' : 'no')}>{t.active ? 'Active' : 'Disabled'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => setEdit({ ...t })}>Edit</button>{' '}
                    <button className="btn ghost sm" onClick={() => resetPassword(t)}>Password</button>{' '}
                    <button className="btn ghost sm" onClick={() => toggleActive(t)}>{t.active ? 'Disable' : 'Enable'}</button>{' '}
                    <button className="btn warn sm" onClick={() => remove(t)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.telecallers.length && <p className="muted">No telecallers yet. Add the first one above.</p>}
        </div>
      </section>

      <section className="card">
        <h2>Admins · {data ? data.admins.length : '…'}</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>Name</th><th>Login</th><th>Last login</th><th /></tr></thead>
            <tbody>
              {(data?.admins || []).map((a) => (
                <tr key={a.user_id}>
                  <td><b>{a.label || '–'}</b>{a.is_me && <span className="tag live" style={{ marginLeft: 6 }}>You</span>}</td>
                  <td>{loginOf(a)}</td>
                  <td className="muted">{timeAgo(a.last_sign_in_at)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => resetPassword(a)}>Password</button>{' '}
                    {!a.is_me && <button className="btn warn sm" onClick={() => remove(a)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {edit && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={'Edit ' + edit.name} onClick={() => setEdit(null)}>
          <form className="card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <h2>Edit telecaller</h2>
            <div className="form">
              <label>Name<input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></label>
              <label>Contact number<input type="tel" value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
            </div>
            <DistrictPicker all={allDistricts} value={edit.districts} onChange={(districts) => setEdit({ ...edit, districts })} />
            <div className="form" style={{ gridTemplateColumns: '1fr' }}>
              <label>Remarks<textarea rows="2" value={edit.remarks || ''} onChange={(e) => setEdit({ ...edit, remarks: e.target.value })} /></label>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>The login ID does not change. To change it, delete and re-create the telecaller.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" type="submit" disabled={busy || !edit.districts.length}>Save</button>
              <button className="btn ghost" type="button" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function DistrictPicker({ all, value, onChange }) {
  const [extra, setExtra] = useState('');
  const options = [...new Set([...all, ...value])].sort();
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <fieldset style={{ border: '1px solid #E3E6EB', borderRadius: 10, padding: 12, marginTop: 12 }}>
      <legend style={{ fontSize: 13, padding: '0 6px' }}>Districts this telecaller can see ({value.length} selected)</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((d) => (
          <label key={d} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, border: '1px solid #CDD2DA', borderRadius: 999, padding: '5px 10px', background: value.includes(d) ? '#E3ECFA' : '#fff' }}>
            <input type="checkbox" checked={value.includes(d)} onChange={() => toggle(d)} /> {d}
          </label>
        ))}
        {!options.length && <span className="muted" style={{ fontSize: 13 }}>No districts yet. Upload members first, or type one below.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input type="text" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add a district name exactly as in the Excel" style={{ flex: 1 }} aria-label="Add district" />
        <button type="button" className="btn ghost" onClick={() => { const d = extra.trim(); if (d && !value.includes(d)) onChange([...value, d]); setExtra(''); }}>Add</button>
      </div>
    </fieldset>
  );
}
