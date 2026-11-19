'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { formatCode } from '@/lib/model';

export default function People({ ov, examId, reload }) {
  const [n, setN] = useState(10);
  const [text, setText] = useState('');
  const [one, setOne] = useState({ name: '', school: '' });
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState('');
  const [slips, setSlips] = useState(false);
  const base = `/api/admin/exams/${examId}`;
  const list = ov.participants;
  const shown = list.filter((p) => !q || `${p.name} ${p.school} ${p.code}`.toLowerCase().includes(q.toLowerCase().replace(/-/g, '')));

  async function post(body, ok) {
    const r = await api(`${base}/participants`, { method: 'POST', body });
    setMsg(r.ok ? { ok: true, t: `${ok} ${r.data.created} รายการ` } : { ok: false, t: r.error });
    if (r.ok) reload();
    return r.ok;
  }
  async function patch(p, body) {
    const r = await api(`${base}/participants/${p.id}`, { method: 'PATCH', body });
    if (!r.ok) setMsg({ ok: false, t: r.error });
    reload();
  }
  async function rename(p) {
    const name = prompt('ชื่อผู้เข้าสอบ', p.name);
    if (name === null) return;
    const school = prompt('โรงเรียน / สังกัด', p.school);
    if (school === null) return;
    patch(p, { action: 'rename', name, school });
  }
  async function del(p) {
    if (!confirm(`ลบ “${p.name || formatCode(p.code)}” พร้อมคำตอบ?`)) return;
    await api(`${base}/participants/${p.id}`, { method: 'DELETE' });
    reload();
  }
  async function regen(p) {
    if (!confirm('สุ่มรหัสใหม่? รหัสเดิมจะใช้ไม่ได้และเครื่องที่กำลังสอบอยู่จะหลุด')) return;
    patch(p, { action: 'regen' });
  }

  if (slips) return (
    <div>
      <div className="row no-print" style={{ marginBottom: 10 }}><button className="btn" onClick={() => setSlips(false)}>← กลับ</button><button className="btn primary" onClick={() => window.print()}>🖨 พิมพ์</button></div>
      <div className="slips">{list.map((p) => <div key={p.id} className="slip"><div className="brand">SPARK</div><div className="small">{ov.exam.title}</div><div className="mono">{formatCode(p.code)}</div><div className="small">{p.name || '-'}{p.school ? ` · ${p.school}` : ''}</div></div>)}</div>
    </div>
  );

  return (
    <div>
      <div className="grid2">
        <div className="card stack">
          <h3 style={{ margin: 0 }}>สุ่มรหัสเข้าสอบ</h3>
          <div className="small muted">ระบบสุ่มรหัส 8 ตัวอักษร ไม่ซ้ำกัน ให้ผู้เข้าสอบ 1 คนต่อ 1 รหัส</div>
          <div className="row"><input type="number" min="1" max="2000" style={{ width: 110 }} value={n} onChange={(e) => setN(e.target.value)} /><button className="btn primary" onClick={() => post({ mode: 'generate', count: Number(n) }, 'สร้างรหัสแล้ว')}>สร้างรหัส</button></div>
          <h3 style={{ margin: '8px 0 0' }}>เพิ่มทีละคน</h3>
          <div className="row"><input type="text" placeholder="ชื่อ" value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} /><input type="text" placeholder="โรงเรียน" value={one.school} onChange={(e) => setOne({ ...one, school: e.target.value })} />
            <button className="btn" onClick={async () => { if (await post({ mode: 'add', ...one }, 'เพิ่มแล้ว')) setOne({ name: '', school: '' }); }}>เพิ่ม</button></div>
        </div>
        <div className="card stack">
          <h3 style={{ margin: 0 }}>นำเข้ารายชื่อ</h3>
          <div className="small muted">1 บรรทัดต่อ 1 คน รูปแบบ “ชื่อ, โรงเรียน” (วางจาก Excel ได้) — ระบบสุ่มรหัสให้แต่ละคน</div>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={'สมชาย ใจดี, โรงเรียน A\nสมหญิง เก่งมาก, โรงเรียน B'} />
          <div><button className="btn primary" disabled={!text.trim()} onClick={async () => { if (await post({ mode: 'import', text }, 'นำเข้าแล้ว')) setText(''); }}>นำเข้า</button></div>
        </div>
      </div>
      {msg && <div className={'alert ' + (msg.ok ? 'ok' : 'bad')} style={{ marginBottom: 12 }}>{msg.t}</div>}
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <b>ผู้เข้าสอบ {list.length} คน</b>
          <div className="row"><input type="text" placeholder="ค้นหา…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 180 }} />
            <a className="btn sm" style={{ textDecoration: 'none' }} href={`${base}/export?kind=credentials`}>⬇ CSV รายชื่อ+รหัส</a>
            <button className="btn sm" onClick={() => setSlips(true)} disabled={!list.length}>🖨 พิมพ์สลิปรหัส</button></div>
        </div>
        <div className="tblwrap"><table className="tbl"><thead><tr><th>#</th><th>รหัส</th><th>ชื่อ</th><th>โรงเรียน/สังกัด</th><th>สถานะ</th><th></th></tr></thead><tbody>
          {shown.map((p, i) => (
            <tr key={p.id}>
              <td>{i + 1}</td>
              <td className="mono nowrap">{formatCode(p.code)} <button className="btn sm ghost" title="คัดลอก" onClick={() => navigator.clipboard?.writeText(formatCode(p.code))}>⧉</button></td>
              <td>{p.name || <span className="muted">-</span>}</td><td>{p.school}</td>
              <td>{!p.attempt ? <span className="badge gray">ยังไม่เริ่ม</span> : p.attempt.submittedAt ? <span className="badge ok">ส่งแล้ว</span> : <span className="badge warn">กำลังทำ</span>}</td>
              <td className="nowrap"><button className="btn sm" onClick={() => rename(p)}>แก้ชื่อ</button> <button className="btn sm" onClick={() => regen(p)}>สุ่มรหัสใหม่</button> <button className="btn sm danger" onClick={() => del(p)}>ลบ</button></td>
            </tr>
          ))}
          {!shown.length && <tr><td colSpan="6" className="muted center">ยังไม่มีผู้เข้าสอบ</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}
