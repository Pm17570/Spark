'use client';
import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { useStaff } from '@/components/admin/StaffContext';
import { api, fmtDT } from '@/lib/client';

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const randPw = () => Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => ALPHA[n % ALPHA.length]).join('');

function Page() {
  const me = useStaff();
  const [list, setList] = useState(null);
  const [f, setF] = useState({ username: '', name: '', password: randPw() });
  const [msg, setMsg] = useState(null);
  const load = useCallback(async () => { const r = await api('/api/admin/moderators'); if (r.ok) setList(r.data.moderators); }, []);
  useEffect(() => { if (me.role === 'admin') load(); }, [me.role, load]);
  if (me.role !== 'admin') return <div className="wrap"><div className="alert bad">เฉพาะผู้ดูแลหลักเท่านั้น</div></div>;

  async function create(e) {
    e.preventDefault();
    const r = await api('/api/admin/moderators', { method: 'POST', body: f });
    if (r.ok) { setMsg({ ok: true, t: `สร้างบัญชีแล้ว — ชื่อผู้ใช้: ${f.username}  รหัสผ่าน: ${f.password}  (จดไว้ให้ผู้ช่วย ระบบจะไม่แสดงรหัสผ่านอีก)` }); setF({ username: '', name: '', password: randPw() }); load(); }
    else setMsg({ ok: false, t: r.error });
  }
  async function patch(m, body, okText) {
    const r = await api(`/api/admin/moderators/${m.id}`, { method: 'PATCH', body });
    setMsg(r.ok ? { ok: true, t: okText } : { ok: false, t: r.error });
    load();
  }
  async function reset(m) {
    const pw = randPw();
    if (!confirm(`รีเซ็ตรหัสผ่านของ ${m.username}? (เซสชันเดิมจะหลุดทันที)`)) return;
    await patch(m, { password: pw }, `รหัสผ่านใหม่ของ ${m.username}: ${pw}  (จดไว้ ระบบจะไม่แสดงอีก)`);
  }
  async function del(m) {
    if (!confirm(`ลบบัญชี ${m.username}?`)) return;
    await api(`/api/admin/moderators/${m.id}`, { method: 'DELETE' });
    load();
  }
  return (
    <div className="wrap">
      <h1>ผู้ช่วยดูแล (Moderator)</h1>
      <div className="card small muted">
        Moderator ล็อกอินที่หน้า <b>/admin</b> ด้วยชื่อผู้ใช้ + รหัสผ่านที่นี่ · <b>ทำได้:</b> ดูสถานะผู้สอบสด, เพิ่มเวลาให้รายคน/ให้ทำต่อ, ตรวจข้อสอบ, ดูสรุปผล, ส่งและรับข้อความ ·
        <b> ทำไม่ได้:</b> แก้ข้อสอบ, ตั้งเวลา/เปิด-ปิดสอบ, ดูหรือสร้างรหัสเข้าสอบ, ลบข้อมูล, จัดการบัญชี
      </div>
      <form className="card stack" onSubmit={create}>
        <h3 style={{ margin: 0 }}>เพิ่ม moderator</h3>
        <div className="field-row">
          <div className="field"><label>ชื่อผู้ใช้ (a-z 0-9 . _ -)</label><input type="text" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" /></div>
          <div className="field"><label>ชื่อที่แสดงให้ผู้เข้าสอบเห็น</label><input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="เช่น พี่สมชาย" /></div>
          <div className="field"><label>รหัสผ่าน</label><div className="row" style={{ flexWrap: 'nowrap' }}><input type="text" className="mono" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><button type="button" className="btn sm" onClick={() => setF({ ...f, password: randPw() })}>สุ่ม</button></div></div>
        </div>
        <div><button className="btn primary" disabled={f.username.length < 3 || f.password.length < 8}>สร้างบัญชี</button></div>
      </form>
      {msg && <div className={'alert ' + (msg.ok ? 'ok' : 'bad')} style={{ marginBottom: 12, wordBreak: 'break-all' }}>{msg.t}</div>}
      <div className="card tblwrap">
        <table className="tbl"><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อที่แสดง</th><th>สถานะ</th><th>สร้างเมื่อ</th><th></th></tr></thead><tbody>
          {(list || []).map((m) => (
            <tr key={m.id}><td className="mono">{m.username}</td><td>{m.name}</td>
              <td>{m.active ? <span className="badge ok">ใช้งานได้</span> : <span className="badge bad">ระงับ</span>}</td><td className="small">{fmtDT(m.createdAt)}</td>
              <td className="nowrap">
                <button className="btn sm" onClick={() => { const n = prompt('ชื่อที่แสดง', m.name); if (n !== null) patch(m, { name: n }, 'บันทึกแล้ว'); }}>แก้ชื่อ</button>{' '}
                <button className="btn sm" onClick={() => reset(m)}>รีเซ็ตรหัสผ่าน</button>{' '}
                <button className="btn sm" onClick={() => patch(m, { active: !m.active }, m.active ? 'ระงับแล้ว' : 'เปิดใช้งานแล้ว')}>{m.active ? 'ระงับ' : 'เปิดใช้'}</button>{' '}
                <button className="btn sm danger" onClick={() => del(m)}>ลบ</button></td></tr>
          ))}
          {list && !list.length && <tr><td colSpan="5" className="muted center">ยังไม่มี moderator</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}
export default function Wrapper() { return <AdminShell current="mods"><Page /></AdminShell>; }
