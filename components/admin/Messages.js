'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { useStaff } from './StaffContext';

const hhmm = (t) => new Date(t).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

export default function Messages({ examId, participants, focus }) {
  const me = useStaff();
  const [threads, setThreads] = useState([]);
  const [pid, setPid] = useState(focus || '');
  const [conv, setConv] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const box = useRef(null);
  const base = `/api/admin/exams/${examId}/messages`;

  useEffect(() => { if (focus) setPid(focus); }, [focus]);
  const loadThreads = useCallback(async () => { const r = await api(base); if (r.ok) setThreads(r.data.threads); }, [base]);
  const loadConv = useCallback(async () => {
    if (!pid) return setConv(null);
    const r = await api(`${base}?participantId=${pid}`);
    if (r.ok) setConv(r.data);
  }, [base, pid]);
  useEffect(() => { loadThreads(); const t = setInterval(loadThreads, 4000); return () => clearInterval(t); }, [loadThreads]);
  useEffect(() => { loadConv(); if (!pid) return; const t = setInterval(loadConv, 3000); return () => clearInterval(t); }, [loadConv, pid]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [conv?.messages?.length, pid]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !pid) return;
    setErr('');
    const r = await api(base, { method: 'POST', body: { participantId: pid, body } });
    if (r.ok) { setText(''); loadConv(); loadThreads(); } else setErr(r.error);
  }
  const withThread = new Set(threads.map((t) => t.participantId));
  const others = participants.filter((p) => !withThread.has(p.id) && (!q || `${p.name} ${p.school}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="chat-admin">
      <div>
        <div className="card flat" style={{ padding: 10 }}>
          <div className="small muted" style={{ marginBottom: 6 }}>เริ่มส่งข้อความถึงผู้เข้าสอบ</div>
          <input type="text" placeholder="ค้นหาชื่อ…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <div style={{ marginTop: 6, maxHeight: 160, overflowY: 'auto' }}>
            {others.slice(0, 20).map((p) => <button key={p.id} className="thread" onClick={() => { setPid(p.id); setQ(''); }}>{p.name || '(ไม่มีชื่อ)'} <span className="small muted">{p.school}</span></button>)}
            {!others.length && <div className="small muted">ไม่พบ</div>}
          </div>}
        </div>
        <div className="small muted" style={{ margin: '8px 2px' }}>การสนทนา ({threads.length})</div>
        {threads.map((t) => (
          <button key={t.participantId} className={'thread' + (pid === t.participantId ? ' cur' : '')} onClick={() => setPid(t.participantId)}>
            <div className="row between"><b>{t.name || '(ไม่มีชื่อ)'}</b>{t.unread > 0 && <span className="navbadge">{t.unread}</span>}</div>
            <div className="small muted clamp2">{t.lastFrom === 'participant' ? '' : 'คุณ/ทีมงาน: '}{t.lastBody}</div>
          </button>
        ))}
        {!threads.length && <div className="small muted">ยังไม่มีการสนทนา — ข้อความจากผู้เข้าสอบจะแสดงที่นี่</div>}
      </div>
      <div className="card" style={{ margin: 0 }}>
        {!pid ? <div className="muted center" style={{ padding: 40 }}>เลือกการสนทนาทางซ้าย หรือค้นหาชื่อเพื่อส่งข้อความใหม่</div> : (
          <>
            <div className="row between" style={{ marginBottom: 8 }}><b>{conv?.participant?.name || '…'} <span className="small muted">{conv?.participant?.school}</span></b>
              <span className="small muted">ข้อความจะเด้งขึ้นบนหน้าจอผู้เข้าสอบทันที</span></div>
            <div className="chat-log" ref={box}>
              {conv?.messages?.length === 0 && <div className="muted small center">ยังไม่มีข้อความ</div>}
              {conv?.messages?.map((m) => (
                <div key={m.id} className={'bubble ' + (m.from === 'participant' ? 'staff' : 'me')}>
                  <div className="small"><b>{m.from === 'participant' ? conv.participant.name || 'ผู้เข้าสอบ' : m.name}</b>{m.from === 'mod' ? ' (ผู้ช่วย)' : m.from === 'admin' ? ' (แอดมิน)' : ''}</div>
                  <div className="pre">{m.body}</div>
                  <div className="small muted">{hhmm(m.at)}{m.from !== 'participant' && (m.read ? ' · อ่านแล้ว' : '')}</div>
                </div>
              ))}
            </div>
            {err && <div className="alert bad" style={{ marginTop: 8 }}>{err}</div>}
            <form className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }} onSubmit={send}>
              <input type="text" className="grow" maxLength={1500} placeholder={`ตอบในนาม ${me.role === 'admin' ? 'ผู้ดูแลระบบ' : me.name}…`} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
              <button className="btn primary" disabled={!text.trim()}>ส่ง</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
