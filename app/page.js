'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { cleanCode, formatCode } from '@/lib/model';

export default function Login() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api('/api/exam/state').then((r) => { if (r.ok) router.replace('/exam'); });
  }, [router]);
  const fmt = (v) => {
    const c = cleanCode(v).slice(0, 8);
    return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
  };
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await api('/api/login', { method: 'POST', body: { code } });
    if (r.ok) router.replace('/exam');
    else { setErr(r.error); setBusy(false); }
  }
  return (
    <div className="wrap">
      <div className="login-box">
        <div className="logo">SPARK</div>
        <p className="muted" style={{ marginTop: 0 }}>ระบบสอบออนไลน์</p>
        <form className="card stack" onSubmit={submit}>
          <label htmlFor="code" className="lbl">กรอกรหัสเข้าสอบของคุณ</label>
          <input id="code" className="input codein" value={code} onChange={(e) => setCode(fmt(e.target.value))} placeholder="XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus />
          {err && <div className="alert bad">{err}</div>}
          <button className="btn primary lg" disabled={busy || cleanCode(code).length !== 8}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ห้องสอบ'}</button>
          <div className="small muted">1 รหัสต่อ 1 คน ใช้ได้ครั้งละ 1 อุปกรณ์ — อย่าแชร์รหัสให้ผู้อื่น</div>
        </form>
        <a href="/admin" className="small muted">สำหรับผู้ดูแลระบบ</a>
      </div>
    </div>
  );
}
