'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { beep } from '@/lib/beep';
import { StaffContext } from './StaffContext';

// โพลกล่องข้อความทุก 4 วิ — ข้อความใหม่จากผู้เข้าสอบเด้งขึ้นให้ทีมงานทุกคนที่เปิดหน้าแอดมินอยู่
function useInbox(enabled) {
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState([]);
  const since = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    let on = true;
    const tick = async () => {
      const r = await api('/api/admin/inbox' + (since.current === null ? '' : `?since=${since.current}`));
      if (!on || !r.ok) return;
      setUnread(r.data.unread);
      if (since.current !== null && r.data.items.length) {
        setToasts((t) => [...t, ...r.data.items.map((x) => ({ ...x, key: x.id, born: Date.now() }))].slice(-4));
        beep();
      }
      since.current = r.data.maxId;
    };
    tick();
    const i = setInterval(tick, 4000);
    return () => { on = false; clearInterval(i); };
  }, [enabled]);
  // แจ้งเตือนหายเองหลัง 15 วินาที
  useEffect(() => {
    const i = setInterval(() => setToasts((t) => (t.some((x) => Date.now() - x.born > 15000) ? t.filter((x) => Date.now() - x.born <= 15000) : t)), 2000);
    return () => clearInterval(i);
  }, []);
  const dismiss = useCallback((key) => setToasts((t) => t.filter((x) => x.key !== key)), []);
  return { unread, toasts, dismiss };
}

export default function AdminShell({ current = 'exams', children }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState(undefined); // undefined = กำลังโหลด, null = ยังไม่ล็อกอิน
  const [un, setUn] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [chg, setChg] = useState(false);
  const [f, setF] = useState({ current: '', next: '', msg: '' });
  const inbox = useInbox(!!me);

  useEffect(() => { api('/api/admin/login').then((r) => setMe(r.data?.admin ? { role: r.data.role, name: r.data.name } : null)); }, []);
  async function login(e) {
    e.preventDefault(); setErr('');
    const r = await api('/api/admin/login', { method: 'POST', body: { username: un, password: pw } });
    if (r.ok) { const m = await api('/api/admin/login'); setMe({ role: m.data.role, name: m.data.name }); } else setErr(r.error);
  }
  async function logout() { await api('/api/admin/logout', { method: 'POST' }); setMe(null); setPw(''); }
  async function change(e) {
    e.preventDefault();
    const r = await api('/api/admin/password', { method: 'POST', body: { current: f.current, next: f.next } });
    setF({ ...f, msg: r.ok ? 'เปลี่ยนรหัสผ่านแล้ว' : r.error });
    if (r.ok) setTimeout(() => setChg(false), 900);
  }
  function openChat(t) {
    inbox.dismiss(t.key);
    if (path === `/admin/exams/${t.examId}`) window.dispatchEvent(new CustomEvent('spark-open-chat', { detail: { p: t.participantId } }));
    else router.push(`/admin/exams/${t.examId}?tab=chat&p=${t.participantId}`);
  }

  if (me === undefined) return <div className="wrap center muted" style={{ paddingTop: 80 }}>กำลังโหลด…</div>;
  if (!me) return (
    <div className="wrap"><div className="login-box">
      <div className="logo">SPARK</div>
      <p className="muted" style={{ marginTop: 0 }}>เข้าสู่ระบบทีมงาน</p>
      <form className="card stack" onSubmit={login}>
        <input id="un" type="text" value={un} onChange={(e) => setUn(e.target.value)} placeholder="ชื่อผู้ใช้ (ผู้ดูแลหลักเว้นว่างไว้)" autoComplete="username" autoCapitalize="none" />
        <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="รหัสผ่าน" autoComplete="current-password" autoFocus />
        {err && <div className="alert bad">{err}</div>}
        <button className="btn primary lg" disabled={!pw}>เข้าสู่ระบบ</button>
      </form>
      <a href="/" className="small muted">← หน้าเข้าสอบ</a>
    </div></div>
  );
  const isAdmin = me.role === 'admin';
  return (
    <StaffContext.Provider value={me}>
      <div className="topbar">
        <div className="row"><span className="brand">SPARK<small>{isAdmin ? 'แอดมิน' : 'ผู้ช่วยดูแล'}</small></span>
          <nav className="admin-nav">
            <a href="/admin" className={current === 'exams' ? 'cur' : ''}>ข้อสอบทั้งหมด</a>
            {isAdmin && <a href="/admin/moderators" className={current === 'mods' ? 'cur' : ''}>ผู้ช่วยดูแล</a>}
          </nav></div>
        <div className="row">
          {inbox.unread > 0 && <span className="badge warn" title="ข้อความจากผู้เข้าสอบที่ยังไม่ได้อ่าน">💬 {inbox.unread}</span>}
          {!isAdmin && <span className="small muted">{me.name}</span>}
          <button className="btn sm" onClick={() => setChg(true)}>เปลี่ยนรหัสผ่าน</button><button className="btn sm" onClick={logout}>ออกจากระบบ</button>
        </div>
      </div>
      {children}
      <div className="staff-toasts">
        {inbox.toasts.map((t) => (
          <div key={t.key} className="staff-toast" onClick={() => openChat(t)}>
            <div className="row between"><b>💬 {t.name || 'ผู้เข้าสอบ'}</b><button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); inbox.dismiss(t.key); }}>✕</button></div>
            <div className="small muted">{t.examTitle}</div>
            <div className="clamp2">{t.body}</div>
            <div className="small" style={{ color: 'var(--lime)' }}>คลิกเพื่อเปิดแชต</div>
          </div>
        ))}
      </div>
      {chg && <div className="modal-bg"><form className="modal stack" onSubmit={change}>
        <h3>เปลี่ยนรหัสผ่านของฉัน</h3>
        <input type="password" placeholder="รหัสผ่านเดิม" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        <input type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        {f.msg && <div className="alert">{f.msg}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => setChg(false)}>ปิด</button><button className="btn primary" disabled={!f.current || f.next.length < 8}>บันทึก</button></div>
      </form></div>}
    </StaffContext.Provider>
  );
}
