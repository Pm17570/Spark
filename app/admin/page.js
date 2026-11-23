'use client';
import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { api, fmtDT } from '@/lib/client';
import { PHASE } from '@/lib/model';
import { useStaff } from '@/components/admin/StaffContext';

function List() {
  const isAdmin = useStaff().role === 'admin';
  const [exams, setExams] = useState(null);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const r = await api('/api/admin/exams');
    if (r.ok) setExams(r.data.exams); else setErr(r.error);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  async function create(sample) {
    const r = await api('/api/admin/exams', { method: 'POST', body: sample ? { sample: true } : { title: title || 'ข้อสอบใหม่' } });
    if (r.ok) location.href = `/admin/exams/${r.data.id}`; else setErr(r.error);
  }
  async function del(e) {
    if (!confirm(`ลบข้อสอบ "${e.title}" พร้อมผู้เข้าสอบและคำตอบทั้งหมด? ย้อนกลับไม่ได้`)) return;
    await api(`/api/admin/exams/${e.id}`, { method: 'DELETE' });
    load();
  }
  return (
    <div className="wrap">
      <h1>ข้อสอบทั้งหมด</h1>
      {isAdmin && <div className="card row">
        <input className="input grow" placeholder="ชื่อข้อสอบใหม่" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn primary" onClick={() => create(false)}>+ สร้างข้อสอบ</button>
        <button className="btn" onClick={() => create(true)}>สร้างข้อสอบตัวอย่าง</button>
      </div>}
      {err && <div className="alert bad">{err}</div>}
      {exams === null ? <p className="muted">กำลังโหลด…</p> : exams.length === 0 ? <div className="card muted center">ยังไม่มีข้อสอบ</div> : exams.map((e) => {
        const [lab, cls] = PHASE[e.phase];
        return (
          <div className="card" key={e.id}>
            <div className="row between">
              <div className="grow"><h3 style={{ margin: 0 }}>{e.title}</h3>
                <div className="small muted">{e.subjects} วิชา · {e.questions} ข้อใหญ่ · {e.parts} ข้อย่อย · {e.points} คะแนน · เวลา {e.durationMin ? `${e.durationMin} นาที` : 'ไม่จำกัด'} · สร้าง {fmtDT(e.createdAt)}</div></div>
              <span className={'badge ' + cls}>{lab}</span>
            </div>
            <div className="row between" style={{ marginTop: 10 }}>
              <div className="small">ผู้เข้าสอบ {e.participants} · เริ่มแล้ว {e.started} · ส่งแล้ว {e.submitted}</div>
              <div className="row"><a className="btn primary sm" href={`/admin/exams/${e.id}`} style={{ textDecoration: 'none' }}>{isAdmin ? 'จัดการ' : 'เข้าดู'}</a>{isAdmin && <button className="btn danger sm" onClick={() => del(e)}>ลบ</button>}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
export default function Page() { return <AdminShell current="exams"><List /></AdminShell>; }
