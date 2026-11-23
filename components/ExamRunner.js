'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fmtDT } from '@/lib/client';
import { fmtDuration } from '@/lib/model';
import Rich from './Rich';
import PartView, { Img, isAnswered } from './PartView';

export default function ExamRunner() {
  const router = useRouter();
  const [st, setSt] = useState(null);
  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState({});
  const [subj, setSubj] = useState(0);
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [save, setSave] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const off = useRef(0);
  const dirty = useRef({});
  const timer = useRef(null);
  const stRef = useRef(null);

  const load = useCallback(async (full = false) => {
    const r = await api('/api/exam/state' + (full ? '?full=1' : ''));
    if (r.status === 401) { router.replace(r.data?.code === 'replaced' ? '/?replaced=1' : '/'); return null; }
    if (!r.ok) return null;
    const d = r.data;
    off.current = d.serverNow - Date.now();
    setSt(d); stRef.current = d;
    if (full && d.paper) { setPaper(d.paper); setAnswers((a) => ({ ...d.answers, ...a })); }
    if (d.attempt?.submittedAt) { setPaper(null); }
    return d;
  }, [router]);

  useEffect(() => { load(true); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + off.current), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(async () => {
      const d = await load(false);
      if (d?.attempt && !d.attempt.submittedAt && !paper) load(true);
    }, 8000);
    return () => clearInterval(t);
  }, [load, paper]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const batch = dirty.current;
    if (!Object.keys(batch).length) return true;
    dirty.current = {};
    setSave('กำลังบันทึก…');
    const r = await api('/api/exam/answers', { method: 'PUT', body: { answers: batch } });
    if (r.ok) { setSave('บันทึกแล้ว'); return true; }
    dirty.current = { ...batch, ...dirty.current };
    if (r.data?.code === 'submitted') { load(false); return false; }
    if (r.status === 401) { router.replace('/'); return false; }
    setSave('บันทึกไม่สำเร็จ — กำลังลองใหม่');
    timer.current = setTimeout(flush, 3000);
    return false;
  }, [load, router]);

  const setAns = (id, v) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    dirty.current[id] = v;
    setSave('รอบันทึก…');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  // ตรวจจับการออกจากหน้าจอ
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && stRef.current?.attempt && !stRef.current.attempt.submittedAt) {
        flush();
        fetch('/api/exam/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'blur' }), keepalive: true }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [flush]);

  const attempt = st?.attempt;
  const remaining = attempt && !attempt.submittedAt && attempt.deadline ? attempt.deadline - now : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0) { flush().then(() => load(false)); }
  }, [remaining !== null && remaining <= 0]); // eslint-disable-line

  // ถึงเวลาเปิดสอบ → รีเฟรชสถานะทันที เพื่อให้ปุ่มเริ่มขึ้นโดยไม่ต้องรอรอบโพล
  const waitLeft = st && !st.attempt && st.exam.phase === 'waiting' && st.exam.openAt ? st.exam.openAt - now : null;
  useEffect(() => {
    if (waitLeft !== null && waitLeft <= 0) { const t = setTimeout(() => load(false), 300); return () => clearTimeout(t); }
  }, [waitLeft !== null && waitLeft <= 0, now > 0 && Math.floor(now / 2000)]); // eslint-disable-line

  async function start() {
    setErr('');
    const r = await api('/api/exam/start', { method: 'POST' });
    if (!r.ok) { setErr(r.error); return; }
    await load(true);
  }
  async function submit() {
    setConfirm(false);
    await flush();
    const r = await api('/api/exam/submit', { method: 'POST' });
    if (!r.ok) { setErr(r.error); return; }
    await load(false);
  }
  async function logout() {
    await api('/api/logout', { method: 'POST' });
    router.replace('/');
  }

  // หน้าของวิชาปัจจุบัน: ข้อใหญ่แบบ same = 1 หน้า, แบบ split = 1 หน้าต่อข้อย่อย
  const pages = useMemo(() => {
    const s = paper?.subjects?.[subj];
    if (!s) return [];
    const out = [];
    s.questions.forEach((q, qi) => {
      if (q.layout === 'split' && q.parts.length > 1) q.parts.forEach((p, pi) => out.push({ q, qi, parts: [p], label: `${qi + 1}.${pi + 1}` }));
      else out.push({ q, qi, parts: q.parts, label: q.parts.length > 1 ? `${qi + 1}` : `${qi + 1}` });
    });
    return out;
  }, [paper, subj]);

  if (!st) return <div className="wrap center muted" style={{ paddingTop: 80 }}>กำลังโหลด…</div>;

  const Top = ({ children }) => (
    <div className="exam-top">
      <div><span className="brand">SPARK</span><span className="muted small" style={{ marginLeft: 10 }}>{st.me.name || 'ผู้เข้าสอบ'}</span></div>
      <div className="row">{children}</div>
    </div>
  );

  // ---------- ส่งแล้ว ----------
  if (attempt?.submittedAt) {
    const r = st.result;
    return (
      <>
        <Top><button className="btn sm" onClick={logout}>ออกจากระบบ</button></Top>
        <div className="wrap narrow"><div className="card done-box">
          <div style={{ fontSize: '3rem' }}>✅</div>
          <h2>{attempt.auto ? 'ระบบส่งข้อสอบให้อัตโนมัติ (หมดเวลา)' : 'ส่งข้อสอบเรียบร้อยแล้ว'}</h2>
          <p className="muted">ส่งเมื่อ {fmtDT(attempt.submittedAt)}</p>
          {r ? (
            <>
              <div className="score">{r.score} <span className="muted" style={{ fontSize: '1.2rem' }}>/ {r.max}</span></div>
              {r.pending > 0 && <div className="alert" style={{ margin: '10px 0' }}>มี {r.pending} ข้อที่รอกรรมการตรวจ คะแนนอาจเปลี่ยนแปลง</div>}
              <div className="grid3" style={{ marginTop: 12 }}>
                {r.subjects.map((s, i) => <div key={i} className="stat"><span className="muted small">{s.title}</span><b>{s.score}/{s.max}</b></div>)}
              </div>
            </>
          ) : <p>ผลคะแนนจะประกาศโดยผู้จัดการสอบ</p>}
        </div></div>
      </>
    );
  }

  // ---------- ยังไม่เริ่ม ----------
  if (!attempt) {
    const ph = st.exam.phase;
    const c = st.exam.counts;
    return (
      <>
        <Top><button className="btn sm" onClick={logout}>ออกจากระบบ</button></Top>
        <div className="wrap narrow"><div className="card">
          <h1>{st.exam.title}</h1>
          {st.exam.description && <Rich text={st.exam.description} className="muted" />}
          <div className="grid3" style={{ margin: '14px 0' }}>
            <div className="stat"><span className="muted small">วิชา</span><b>{c.subjects}</b></div>
            <div className="stat"><span className="muted small">จำนวนข้อ</span><b>{c.parts}</b></div>
            <div className="stat"><span className="muted small">เวลา</span><b>{st.exam.durationMin > 0 ? `${st.exam.durationMin} นาที` : 'ไม่จำกัด'}</b></div>
          </div>
          {ph === 'open' && (
            <>
              <div className="alert">เมื่อกดเริ่ม ระบบจะจับเวลาทันที คำตอบถูกบันทึกอัตโนมัติ และสลับวิชาได้อิสระ</div>
              {err && <div className="alert bad" style={{ marginTop: 8 }}>{err}</div>}
              <div className="center" style={{ marginTop: 16 }}><button className="btn primary lg" onClick={start}>เริ่มทำข้อสอบ</button></div>
            </>
          )}
          {ph === 'waiting' && <div className="alert">ยังไม่ถึงเวลาสอบ — เปิดสอบ {fmtDT(st.exam.openAt)} {st.exam.openAt ? `(อีก ${fmtDuration(st.exam.openAt - now)})` : ''} หน้านี้จะอัปเดตเอง</div>}
          {ph === 'draft' && <div className="alert">ข้อสอบนี้ยังไม่เปิดให้เข้าสอบ กรุณารอประกาศจากผู้จัดการสอบ</div>}
          {ph === 'closed' && <div className="alert bad">การสอบนี้ปิดแล้ว</div>}
        </div></div>
      </>
    );
  }

  // ---------- กำลังสอบ ----------
  if (!paper) return <div className="wrap center muted" style={{ paddingTop: 80 }}>กำลังโหลดข้อสอบ…</div>;
  const s = paper.subjects[subj];
  const pg = pages[Math.min(page, pages.length - 1)] || { parts: [] };
  const pageDone = (x) => x.parts.every((p) => isAnswered(p, answers[p.id]));
  const total = paper.subjects.reduce((n, x) => n + x.questions.reduce((m, q) => m + q.parts.length, 0), 0);
  const done = paper.subjects.reduce((n, x) => n + x.questions.reduce((m, q) => m + q.parts.filter((p) => isAnswered(p, answers[p.id])).length, 0), 0);
  const low = remaining !== null && remaining < 5 * 60000;

  return (
    <>
      <div className="exam-top">
        <div><span className="brand">SPARK</span><span className="muted small" style={{ marginLeft: 10 }}>{st.me.name}</span></div>
        <div className="row">
          <span className="savedot">{save}</span>
          <span className="small muted">ตอบแล้ว {done}/{total}</span>
          {remaining !== null && <span className={'timer' + (low ? ' low' : '')}>⏱ {fmtDuration(Math.max(0, remaining))}</span>}
          <button className="btn accent sm" onClick={() => setConfirm(true)}>ส่งข้อสอบ</button>
        </div>
      </div>
      <div className="wrap narrow">
        <div className="subj-tabs">
          {paper.subjects.map((x, i) => {
            const n = x.questions.reduce((m, q) => m + q.parts.length, 0);
            const d = x.questions.reduce((m, q) => m + q.parts.filter((p) => isAnswered(p, answers[p.id])).length, 0);
            return <button key={x.id} className={'subj-tab' + (i === subj ? ' cur' : '')} onClick={() => { setSubj(i); setPage(0); }}>{x.title || `วิชา ${i + 1}`} <span className="small">({d}/{n})</span></button>;
          })}
        </div>
        {s.description && <Rich text={s.description} className="muted" />}
        <div className="navs" style={{ margin: '8px 0 14px' }}>
          {pages.map((x, i) => <button key={i} className={'navbtn' + (pageDone(x) ? ' done' : '') + (i === page ? ' cur' : '')} onClick={() => setPage(i)}>{x.label}</button>)}
        </div>
        <div className="card">
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="qnum">ข้อ {pg.qi + 1}{pg.q?.layout === 'split' && pg.parts.length === 1 && pg.q.parts.length > 1 ? ` (ข้อย่อย ${pg.label})` : ''}</span>
            {pg.q?.title && <b>{pg.q.title}</b>}
          </div>
          {pg.q?.stem && <Rich text={pg.q.stem} />}
          <Img name={pg.q?.stemImage} />
          {pg.parts.map((p, i) => (
            <div key={p.id} className="gcard" style={{ marginTop: 12 }}>
              {pg.q.parts.length > 1 && pg.parts.length > 1 && <div className="row small muted" style={{ marginBottom: 4 }}><b>{pg.qi + 1}.{i + 1}</b><span>({p.points} คะแนน)</span></div>}
              {pg.parts.length === 1 && <div className="small muted" style={{ marginBottom: 4 }}>({p.points} คะแนน)</div>}
              <PartView part={p} value={answers[p.id]} onChange={(v) => setAns(p.id, v)} />
            </div>
          ))}
        </div>
        <div className="row between">
          <button className="btn" disabled={page === 0} onClick={() => { setPage(page - 1); window.scrollTo(0, 0); }}>← ก่อนหน้า</button>
          <button className="btn" disabled={page >= pages.length - 1} onClick={() => { setPage(page + 1); window.scrollTo(0, 0); }}>ถัดไป →</button>
        </div>
      </div>
      {confirm && (
        <div className="modal-bg"><div className="modal">
          <h3>ส่งข้อสอบ?</h3>
          <p>ตอบแล้ว {done} จาก {total} ข้อ {done < total && <b style={{ color: 'var(--warn)' }}>(ยังไม่ได้ตอบ {total - done} ข้อ)</b>}<br />เมื่อส่งแล้วจะแก้ไขไม่ได้</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirm(false)}>กลับไปทำต่อ</button>
            <button className="btn accent" onClick={submit}>ยืนยันส่งข้อสอบ</button>
          </div>
        </div></div>
      )}
    </>
  );
}
