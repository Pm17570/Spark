'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

export default function AdminShell({ current = 'exams', children }) {
  const [ok, setOk] = useState(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [chg, setChg] = useState(false);
  const [f, setF] = useState({ current: '', next: '', msg: '' });

  useEffect(() => { api('/api/admin/login').then((r) => setOk(!!r.data?.admin)); }, []);
  async function login(e) {
    e.preventDefault(); setErr('');
    const r = await api('/api/admin/login', { method: 'POST', body: { password: pw } });
    if (r.ok) setOk(true); else setErr(r.error);
  }
  async function logout() { await api('/api/admin/logout', { method: 'POST' }); setOk(false); setPw(''); }
  async function change(e) {
    e.preventDefault();
    const r = await api('/api/admin/password', { method: 'POST', body: { current: f.current, next: f.next } });
    setF({ ...f, msg: r.ok ? 'เปลี่ยนรหัสผ่านแล้ว' : r.error });
    if (r.ok) setTimeout(() => setChg(false), 900);
  }

  if (ok === null) return <div className="wrap center muted" style={{ paddingTop: 80 }}>กำลังโหลด…</div>;
  if (!ok) return (
    <div className="wrap"><div className="login-box">
      <div className="logo">SPARK</div>
      <p className="muted" style={{ marginTop: 0 }}>เข้าสู่ระบบผู้ดูแล</p>
      <form className="card stack" onSubmit={login}>
        <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="รหัสผ่านแอดมิน" autoFocus />
        {err && <div className="alert bad">{err}</div>}
        <button className="btn primary lg" disabled={!pw}>เข้าสู่ระบบ</button>
      </form>
      <a href="/" className="small muted">← หน้าเข้าสอบ</a>
    </div></div>
  );
  return (
    <>
      <div className="topbar">
        <div className="row"><span className="brand">SPARK<small>แอดมิน</small></span>
          <nav className="admin-nav"><a href="/admin" className={current === 'exams' ? 'cur' : ''}>ข้อสอบทั้งหมด</a></nav></div>
        <div className="row"><button className="btn sm" onClick={() => setChg(true)}>เปลี่ยนรหัสผ่าน</button><button className="btn sm" onClick={logout}>ออกจากระบบ</button></div>
      </div>
      {children}
      {chg && <div className="modal-bg"><form className="modal stack" onSubmit={change}>
        <h3>เปลี่ยนรหัสผ่านแอดมิน</h3>
        <input type="password" placeholder="รหัสผ่านเดิม" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        <input type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        {f.msg && <div className="alert">{f.msg}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => setChg(false)}>ปิด</button><button className="btn primary" disabled={!f.current || f.next.length < 8}>บันทึก</button></div>
      </form></div>}
    </>
  );
}
