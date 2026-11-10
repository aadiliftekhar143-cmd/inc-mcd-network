import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { supabase } from './lib.js';
import Dashboard from './Dashboard.jsx';
import Tasks from './Tasks.jsx';
import Members from './Members.jsx';
import Messages from './Messages.jsx';
import Reminders from './Reminders.jsx';

const TABS = [
  ['dashboard', 'Analytics'],
  ['tasks', 'Tasks'],
  ['members', 'Ward members'],
  ['messages', 'Leader messages'],
  ['reminders', 'Reminders and links'],
];

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
  };
  return (
    <div className="login card">
      <div className="brand" style={{ marginBottom: 16 }}>
        <img src="/logo.png" alt="Congress party symbol" />
        <div><b>Ward Sadasya Admin</b></div>
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <div className="notice">{err}</div>}
        <button className="btn" type="submit">Log in</button>
      </form>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(null);
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (isAdmin === false) {
    return (
      <div className="login card">
        <p>This account is not an admin. Add its user ID to the <code>admins</code> table in Supabase.</p>
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Log out</button>
      </div>
    );
  }
  if (isAdmin === null) return null;

  return (
    <>
      <header className="header">
        <div className="brand">
          <img src="/logo.png" alt="Congress party symbol" />
          <div><b>Ward Sadasya · Command Dashboard</b><small>Delhi Pradesh Congress Committee · 250 MCD wards</small></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pill"><span className="dot" />Live</span>
          <button className="btn ghost" style={{ minHeight: 34, padding: '6px 12px' }} onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
      </header>
      <nav className="nav" aria-label="Admin sections">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      <main className="main">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'members' && <Members />}
        {tab === 'messages' && <Messages />}
        {tab === 'reminders' && <Reminders />}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
