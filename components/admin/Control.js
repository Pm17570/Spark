'use client';
import { useEffect, useState } from 'react';
import { api, fmtDT, toLocalInput, fromLocalInput } from '@/lib/client';
import { PHASE, fmtDuration, formatCode } from '@/lib/model';

export { PHASE };
export function useTick(ms = 1000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return t;
}

export default function Control({ ov, offset, reload }) {
  const ex = ov.exam;
  const now = useTick() + offset;
  const [f, setF] = useState({ openAt: toLocalInput(ex.openAt), closeAt: toLocalInput(ex.closeAt), durationMin: ex.durationMin });
  const [msg, setMsg] = useState('');
  const base = `/api/admin/exams/${ex.id}`;
  const [lab, cls] = PHASE[ov.phase];

  async function ctl(body, m = 'บันทึกแล้ว') {
    const r = await api(`${base}/control`, { method: 'POST', body });
    setMsg(r.ok ? m : r.error);
    reload();
  }
  async function act(p, body, ask) {
    if (ask && !confirm(ask)) return;
    await api(`${base}/participants/${p.id}`, { method: 'PATCH', body });
    reload();
  }
  const list = ov.participants;
  const c = { total: list.length, online: list.filter((p) => p.online).length, doing: list.filter((p) => p.attempt && !p.attempt.submittedAt).length, done: list.filter((p) => p.attempt?.submittedAt).length };

  return (
    <div>
      <div className="card">
        <div className="row between"><div className="row"><h3 style={{ margin: 0 }}>สถานะการสอบ</h3><span className={'badge ' + cls}>{lab}</span></div>
          <div className="row">
            <button className="btn primary" onClick={() => ctl({ status: 'open', openAt: null }, 'เปิดสอบแล้ว (ยกเลิกเวลาเริ่มที่ตั้งไว้)')} disabled={ov.phase === 'open'}>▶ เปิดสอบทันที</button>
            <button className="btn danger" onClick={() => confirm('ปิดสอบ? ทุกคนที่กำลังทำจะถูกส่งอัตโนมัติ') && ctl({ status: 'closed' }, 'ปิดสอบแล้ว')} disabled={ov.phase === 'closed'}>■ ปิดสอบ</button>
            <button className="btn" onClick={() => ctl({ status: 'draft' }, 'เปลี่ยนเป็นฉบับร่าง')}>ฉบับร่าง</button>
          </div></div>
        <div className="grid3" style={{ marginTop: 12 }}>
          <div className="stat"><span className="muted small">ผู้เข้าสอบ</span><b>{c.total}</b></div>
          <div className="stat"><span className="muted small">ออนไลน์ตอนนี้</span><b>{c.online}</b></div>
          <div className="stat"><span className="muted small">กำลังทำ</span><b>{c.doing}</b></div>
          <div className="stat"><span className="muted small">ส่งแล้ว</span><b>{c.done}</b></div>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>ตั้งเวลา</h3>
        <div className="field-row">
          <div className="field"><label>เวลาเริ่มสอบ (ถ้ากำหนด จะเปิดอัตโนมัติ)</label><input type="datetime-local" value={f.openAt} onChange={(e) => setF({ ...f, openAt: e.target.value })} /></div>
          <div className="field"><label>เวลาปิดสอบ (ทุกคนถูกส่งอัตโนมัติ)</label><input type="datetime-local" value={f.closeAt} onChange={(e) => setF({ ...f, closeAt: e.target.value })} /></div>
          <div className="field"><label>เวลาทำต่อคน (นาที, 0 = ไม่จำกัด)</label><input type="number" min="0" max="1440" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} /></div>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => ctl({ openAt: fromLocalInput(f.openAt), closeAt: fromLocalInput(f.closeAt), durationMin: Number(f.durationMin) || 0, ...(f.openAt ? (ex.status !== 'closed' && ex.status !== 'draft' ? { status: 'scheduled' } : {}) : ex.status === 'scheduled' ? { status: 'open' } : {}) }, f.openAt ? 'บันทึกแล้ว — ผู้เข้าสอบจะกดเริ่มได้เมื่อถึงเวลาเริ่มเท่านั้น' : 'บันทึกแล้ว')}>บันทึกเวลา</button>
          <span className="small muted">เวลาในเครื่องคุณ · ปัจจุบัน {fmtDT(now)}</span>
        </div>
        <div className="row"><b className="small">เพิ่ม/ลดเวลาให้ทุกคน:</b>
          {[-5, 5, 10, 15].map((m) => <button key={m} className="btn sm" onClick={() => ctl({ addExtraMin: m }, `ปรับเวลาทุกคน ${m > 0 ? '+' : ''}${m} นาที`)}>{m > 0 ? '+' : ''}{m} นาที</button>)}
          <span className="small muted">(รวมที่ปรับแล้ว {ex.extraMin} นาที)</span></div>
        <label className="check"><input type="checkbox" checked={ex.showResult} onChange={(e) => ctl({ showResult: e.target.checked })} />แสดงคะแนนให้ผู้เข้าสอบเห็นหลังส่งข้อสอบ</label>
        <label className="check"><input type="checkbox" checked={ex.shuffle} onChange={(e) => ctl({ shuffle: e.target.checked })} />สลับลำดับตัวเลือก/คำ ของผู้เข้าสอบแต่ละคน</label>
        {msg && <div className="alert ok">{msg}</div>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>ติดตามสด</h3>
        <div className="tblwrap"><table className="tbl"><thead><tr><th>ชื่อ</th><th>รหัส</th><th>สถานะ</th><th>ตอบแล้ว</th><th>เวลาเหลือ</th><th>ออกจากหน้าจอ</th><th></th></tr></thead><tbody>
          {list.map((p) => {
            const a = p.attempt;
            const left = a && !a.submittedAt && p.deadline ? p.deadline - now : null;
            return (
              <tr key={p.id}>
                <td>{p.online ? <span title="ออนไลน์" style={{ color: 'var(--ok)' }}>● </span> : <span className="muted">○ </span>}{p.name || '-'}</td>
                <td className="mono nowrap">{formatCode(p.code)}</td>
                <td>{!a ? <span className="badge gray">ยังไม่เริ่ม</span> : a.submittedAt ? <span className="badge ok">{a.auto ? 'ส่งอัตโนมัติ' : 'ส่งแล้ว'}</span> : <span className="badge warn">กำลังทำ</span>}</td>
                <td>{p.answered}</td>
                <td className="mono">{left !== null ? fmtDuration(left) : '-'}</td>
                <td>{a?.blurCount ? <span className={a.blurCount > 5 ? 'badge bad' : 'badge'}>{a.blurCount}</span> : '-'}</td>
                <td className="nowrap">{a && !a.submittedAt && <button className="btn sm" onClick={() => act(p, { action: 'extend', minutes: 5 })}>+5 นาที</button>} {a?.submittedAt && <button className="btn sm" onClick={() => act(p, { action: 'unsubmit' }, 'เปิดให้ทำต่อ?')}>ให้ทำต่อ</button>} {a && <button className="btn sm danger" onClick={() => act(p, { action: 'reset' }, 'รีเซ็ตการสอบของคนนี้ (ลบคำตอบ)?')}>รีเซ็ต</button>}</td>
              </tr>
            );
          })}
          {!list.length && <tr><td colSpan="7" className="muted center">ยังไม่มีผู้เข้าสอบ</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}
