'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { formatCode, fmtDuration } from '@/lib/model';
import Rich from '../Rich';

export default function Results({ examId }) {
  const [r, setR] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    let on = true;
    const load = async () => { const x = await api(`/api/admin/exams/${examId}/results`); if (on && x.ok) setR(x.data); };
    load();
    const t = setInterval(load, 6000);
    return () => { on = false; clearInterval(t); };
  }, [examId]);
  if (!r) return <div className="muted">กำลังคำนวณ…</div>;
  const subs = r.exam.subjects;
  const fin = r.rows.filter((x) => x.attempt?.submittedAt);
  const ranked = r.rows.filter((x) => x.attempt).sort((a, b) => a.rank - b.rank);
  const avg = fin.length ? fin.reduce((s, x) => s + x.score, 0) / fin.length : 0;
  const best = fin.length ? Math.max(...fin.map((x) => x.score)) : 0;
  const max = ranked[0]?.max || 0;
  const shown = ranked.filter((x) => !q || `${x.name} ${x.school} ${x.code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="grid3" style={{ marginBottom: 14 }}>
        <div className="stat"><span className="muted small">ผู้เข้าสอบทั้งหมด</span><b>{r.rows.length}</b></div>
        <div className="stat"><span className="muted small">ส่งแล้ว</span><b>{fin.length}</b></div>
        <div className="stat"><span className="muted small">คะแนนเฉลี่ย</span><b>{avg.toFixed(2)}{max ? <span className="small muted"> / {max}</span> : null}</b></div>
        <div className="stat"><span className="muted small">คะแนนสูงสุด</span><b>{best}</b></div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>เฉลี่ยรายวิชา</h3>
        <div className="grid2">{r.subjectStats.map((s) => (
          <div key={s.id}><div className="row between"><span>{s.title}</span><span className="small muted">{s.avg} / {s.max} ({s.n} คน)</span></div><div className="bar"><i style={{ width: `${s.max ? (s.avg / s.max) * 100 : 0}%` }} /></div></div>
        ))}</div>
      </div>
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>อันดับ</h3>
          <div className="row"><input type="text" placeholder="ค้นหา…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 180 }} /><a className="btn sm" style={{ textDecoration: 'none' }} href={`/api/admin/exams/${examId}/export?kind=results`}>⬇ ดาวน์โหลด CSV</a></div>
        </div>
        <div className="tblwrap"><table className="tbl"><thead><tr><th>อันดับ</th><th>ชื่อ</th><th>โรงเรียน</th><th>รหัส</th>{subs.map((s) => <th key={s.id}>{s.title}</th>)}<th>รวม</th><th>เวลา</th><th>สถานะ</th></tr></thead><tbody>
          {shown.map((x) => (
            <tr key={x.id}>
              <td><b>{x.rank}</b></td><td>{x.name || '-'}</td><td>{x.school}</td><td className="mono nowrap">{formatCode(x.code)}</td>
              {subs.map((s) => <td key={s.id}>{x.subjects[s.id]?.score ?? '-'}</td>)}
              <td><b>{x.score}</b>/{x.max}{x.pending > 0 && <span className="badge warn" style={{ marginLeft: 6 }}>รอตรวจ {x.pending}</span>}</td>
              <td className="mono">{fmtDuration(x.used)}</td>
              <td>{x.attempt.submittedAt ? <span className="badge ok">{x.attempt.auto ? 'ส่งอัตโนมัติ' : 'ส่งแล้ว'}</span> : <span className="badge warn">กำลังทำ</span>}</td>
            </tr>
          ))}
          {!shown.length && <tr><td colSpan={7 + subs.length} className="muted center">ยังไม่มีผู้เริ่มสอบ</td></tr>}
        </tbody></table></div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>วิเคราะห์รายข้อ</h3>
        <div className="tblwrap"><table className="tbl"><thead><tr><th>ข้อ</th><th>โจทย์</th><th>ผู้ตอบ</th><th>ได้เฉลี่ย</th><th>ตอบถูกเต็ม</th><th>เว้นว่าง</th></tr></thead><tbody>
          {r.partStats.map((s) => (
            <tr key={s.id}><td className="nowrap">{s.full}</td><td style={{ maxWidth: 360 }}><Rich text={s.text} className="clamp2" /></td><td>{s.n}</td>
              <td style={{ minWidth: 120 }}><div className="small">{s.avgPct.toFixed(0)}%</div><div className="bar"><i style={{ width: `${s.avgPct}%` }} /></div></td>
              <td>{s.fullCount}</td><td>{s.blank}{s.pending > 0 && <span className="badge warn" style={{ marginLeft: 6 }}>รอตรวจ {s.pending}</span>}</td></tr>
          ))}
        </tbody></table></div>
      </div>
    </div>
  );
}
