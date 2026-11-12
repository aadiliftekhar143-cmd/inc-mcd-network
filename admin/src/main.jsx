import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { supabase, loginId } from './lib.js';
import Dashboard from './Dashboard.jsx';
import Tasks from './Tasks.jsx';
import Members from './Members.jsx';
import Messages from './Messages.jsx';
import Reminders from './Reminders.jsx';
import Calling from './Calling.jsx';
import Reports from './Reports.jsx';
import Team from './Team.jsx';
import Settings from './Settings.jsx';
import ProfileUpdates from './ProfileUpdates.jsx';

const APP_NAME = 'INC MCD NETWORK';

const ADMIN_TABS = [
  ['dashboard', 'Analytics'],
  ['reports', 'Reports'],
  ['calling', 'Calling'],
  ['tasks', 'Tasks'],
  ['members', 'Ward members'],
  ['messages', 'Leader messages'],
  ['reminders', 'Notifications'],
  ['profiles', 'Profile updates'],
  ['team', 'Team'],
  ['settings', 'Settings'],
];
const TELECALLER_TABS = [['calling', 'Calling list']];

function Login() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginId(id), password });
    setBusy(false);
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Wrong mobile/email or password.' : error.message);
  };
  return (
    <div className="login-wrap">
      <div className="login card">
        <div className="brand" style={{ marginBottom: 16 }}>
          <img src="/logo.png" alt="Congress party symbol" />
          <div><b>{APP_NAME}</b><small style={{ color: '#5B6270' }}>Admin and calling panel</small></div>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>Mobile number or email
            <input type="text" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} required /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>Password
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {err && <div className="notice">{err}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
      </div>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span><b>{APP_NAME}</b> · Delhi Pradesh Congress Committee · 250 MCD wards</span>
      <span>© {new Date().getFullYear()} · Built by Coceptual Media</span>
    </footer>
  );
}

function App() {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(null); // { userId, role, name, districts }
  const [tab, setTab] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMe(null); setTab(null); return; }
    (async () => {
      const userId = session.user.id;
      const { data: role } = await supabase.rpc('my_role');
      if (role === 'telecaller') {
        const { data: t } = await supabase.from('telecallers').select('name, districts').eq('user_id', userId).maybeSingle();
        setMe({ userId, role, name: t?.name || 'Telecaller', districts: t?.districts || [] });
        setTab('calling');
      } else if (role === 'admin') {
        const { data: a } = await supabase.from('admins').select('label').eq('user_id', userId).maybeSingle();
        setMe({ userId, role, name: a?.label || session.user.email, districts: [] });
        setTab((t) => t || 'dashboard');
      } else {
        setMe({ userId, role: null });
      }
    })();
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (!me) return <div className="login card"><p className="muted">Loading…</p></div>;
  if (!me.role) {
    return (
      <div className="login card">
        <p>This login has no access yet. Ask a master admin to add you in the Team tab.</p>
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Log out</button>
      </div>
    );
  }

  const tabs = me.role === 'admin' ? ADMIN_TABS : TELECALLER_TABS;

  return (
    <>
      <header className="header">
        <div className="brand">
          <img src="/logo.png" alt="Congress party symbol" />
          <div><b>{APP_NAME} · {me.role === 'admin' ? 'Command Dashboard' : 'Calling Panel'}</b>
            <small>Delhi Pradesh Congress Committee · {me.role === 'admin' ? '250 MCD wards' : (me.districts || []).join(', ')}</small></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pill"><span className="dot" />{me.name}{me.role === 'telecaller' ? ' · Telecaller' : ' · Admin'}</span>
          <button className="btn ghost" style={{ minHeight: 34, padding: '6px 12px' }} onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
      </header>
      {tabs.length > 1 && (
        <nav className="nav" aria-label="Admin sections">
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      )}
      <main className="main">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'reports' && <Reports />}
        {tab === 'calling' && <Calling me={me} />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'members' && <Members />}
        {tab === 'messages' && <Messages />}
        {tab === 'reminders' && <Reminders />}
        {tab === 'team' && <Team />}
        {tab === 'profiles' && <ProfileUpdates />}
        {tab === 'settings' && <Settings />}
      </main>
      <Footer />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
