'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import Editor from '@/components/admin/Editor';
import People from '@/components/admin/People';
import Control from '@/components/admin/Control';
import Grading from '@/components/admin/Grading';
import Results from '@/components/admin/Results';
import Messages from '@/components/admin/Messages';
import { useStaff } from '@/components/admin/StaffContext';
import { api } from '@/lib/client';
import { PHASE } from '@/lib/model';

const TABS = [['edit', '✏️ ข้อสอบ', 'admin'], ['people', '👥 ผู้เข้าสอบ & รหัส', 'admin'], ['control', '⏱ ควบคุมการสอบ'], ['grade', '📝 ตรวจ'], ['results', '🏆 สรุปผล'], ['chat', '💬 ข้อความ']];

function Inner({ id }) {
  const { role } = useStaff();
  const isAdmin = role === 'admin';
  const [exam, setExam] = useState(null);
  const [chatP, setChatP] = useState('');
  const [ov, setOv] = useState(null);
  const [tab, setTab] = useState(isAdmin ? 'edit' : 'control');
  const [err, setErr] = useState('');
  const off = useRef(0);
  const reload = useCallback(async () => {
    const r = await api(`/api/admin/exams/${id}/overview`);
    if (r.ok) { off.current = r.data.serverNow - Date.now(); setOv(r.data); }
  }, [id]);
  // เปิดแท็บข้อความจากลิงก์แจ้งเตือน (?tab=chat&p=…) หรือจากอีเวนต์ในหน้า
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (u.get('tab') === 'chat') { setTab('chat'); setChatP(u.get('p') || ''); }
    const h = (e) => { setTab('chat'); setChatP(e.detail.p); };
    window.addEventListener('spark-open-chat', h);
    return () => window.removeEventListener('spark-open-chat', h);
  }, []);
  useEffect(() => {
    if (isAdmin) api(`/api/admin/exams/${id}`).then((r) => (r.ok ? setExam(r.data.exam) : setErr(r.error)));
    reload();
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [id, reload, isAdmin]);
  if (err) return <div className="wrap"><div className="alert bad">{err}</div><a href="/admin">← กลับ</a></div>;
  if ((isAdmin && !exam) || !ov) return <div className="wrap muted">กำลังโหลด…</div>;
  const [lab, cls] = PHASE[ov.phase];
  return (
    <div className="wrap">
      <div className="row between" style={{ marginBottom: 6 }}>
        <div><a href="/admin" className="small">← ข้อสอบทั้งหมด</a><h1 style={{ margin: 0 }}>{ov.exam.title}</h1></div>
        <span className={'badge ' + cls}>{lab}</span>
      </div>
      <div className="tabs">{TABS.filter(([, , only]) => !only || isAdmin).map(([k, l]) => <button key={k} className={'tab' + (tab === k ? ' cur' : '')} onClick={() => setTab(k)}>{l}{k === 'chat' && ov.unreadMsgs > 0 && <span className="navbadge">{ov.unreadMsgs}</span>}</button>)}</div>
      {isAdmin && <div style={{ display: tab === 'edit' ? 'block' : 'none' }}><Editor initial={exam} onSaved={(e) => { setExam(e); reload(); }} /></div>}
      {tab === 'people' && isAdmin && <People ov={ov} examId={id} reload={reload} />}
      {tab === 'control' && <Control ov={ov} offset={off.current} reload={reload} />}
      {tab === 'grade' && <Grading examId={id} people={ov.participants} />}
      {tab === 'results' && <Results examId={id} />}
      {tab === 'chat' && <Messages examId={id} participants={ov.participants} focus={chatP} />}
    </div>
  );
}

export default function Page({ params }) {
  const { id } = use(params);
  return <AdminShell current="exams"><Inner id={id} /></AdminShell>;
}
