'use client';
// กล่องข้อความฝั่งผู้เข้าสอบ: ทักหาทีมงาน + รับข้อความจากแอดมิน/ผู้คุมสอบ (เด้งแจ้งเตือนบนหน้าเว็บ)
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { beep } from '@/lib/beep';

const hhmm = (t) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

export default function ChatWidget({ chat }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef(null);      // staff message id ที่แจ้งเตือนไปแล้ว
  const readUpTo = useRef(0);     // staff message id ที่เปิดอ่านแล้ว
  const openRef = useRef(false);
  const box = useRef(null);
  openRef.current = open;

  const load = useCallback(async (read) => {
    const r = await api('/api/exam/messages' + (read ? '?read=1' : ''));
    if (!r.ok) return null;
    setMsgs(r.data.messages);
    if (read) readUpTo.current = Math.max(readUpTo.current, ...r.data.messages.filter((m) => m.from !== 'participant').map((m) => m.id), 0);
    return r.data.messages;
  }, []);

  // มีข้อความใหม่จากทีมงาน → เด้งแจ้งเตือน
  const last = chat?.lastStaffId || 0;
  useEffect(() => {
    if (!chat) return;
    if (seen.current === null) {
      seen.current = last;
      if (chat.unread > 0) {
        load(false).then((m) => { const x = m && [...m].reverse().find((y) => y.from !== 'participant'); if (x) { setToast(x); beep(); } });
      }
      return;
    }
    if (last > seen.current) {
      seen.current = last;
      load(openRef.current).then((m) => {
        const x = m && [...m].reverse().find((y) => y.from !== 'participant');
        // ไม่เด้งถ้าเปิดอ่านข้อความนั้นในแผงไปแล้ว
        if (x && !openRef.current && x.id > readUpTo.current) { setToast(x); beep(); }
      });
    }
  }, [last]); // eslint-disable-line

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 12000); return () => clearTimeout(t); } }, [toast]);

  // แผงเปิดอยู่ → โหลดทันที + โพลทุก 4 วินาที
  useEffect(() => {
    if (!open) return;
    load(true);
    const t = setInterval(() => load(true), 4000);
    return () => clearInterval(t);
  }, [open, load]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, open]);

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr('');
    const r = await api('/api/exam/messages', { method: 'POST', body: { body } });
    setBusy(false);
    if (r.ok) { setText(''); load(true); } else setErr(r.error);
  }

  const unread = !open && chat && chat.unread > 0 && last > readUpTo.current;
  const who = (m) => (m.from === 'admin' ? 'ผู้ดูแลระบบ' : `ผู้คุมสอบ${m.name ? ' · ' + m.name : ''}`);

  return (
    <>
      {toast && !open && (
        <div className="chat-toast" role="alert" onClick={() => { setOpen(true); setToast(null); }}>
          <b>💬 {who(toast)}</b>
          <div className="clamp2 small">{toast.body}</div>
          <div className="small muted">แตะเพื่อเปิดอ่าน / ตอบกลับ</div>
        </div>
      )}
      {open && (
        <div className="chat-panel">
          <div className="chat-head"><b>💬 ข้อความถึงทีมงาน</b><button className="btn sm" onClick={() => setOpen(false)}>ปิด</button></div>
          <div className="chat-body" ref={box}>
            {msgs.length === 0 && <div className="muted small center" style={{ padding: 16 }}>ถ้ามีปัญหาหรือข้อสงสัยระหว่างสอบ พิมพ์ข้อความถึงผู้ดูแลได้ที่นี่</div>}
            {msgs.map((m) => (
              <div key={m.id} className={'bubble ' + (m.from === 'participant' ? 'me' : 'staff')}>
                {m.from !== 'participant' && <div className="small"><b>{who(m)}</b></div>}
                <div className="pre">{m.body}</div>
                <div className="small muted">{hhmm(m.at)}</div>
              </div>
            ))}
          </div>
          {err && <div className="alert bad small" style={{ margin: '0 10px' }}>{err}</div>}
          <form className="chat-input" onSubmit={send}>
            <input type="text" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์ข้อความ…" autoComplete="off" />
            <button className="btn primary sm" disabled={!text.trim() || busy}>ส่ง</button>
          </form>
        </div>
      )}
      {!open && (
        <button className="chat-fab" onClick={() => { setOpen(true); setToast(null); }} aria-label="ข้อความ">
          💬{unread && <span className="chat-dot">{chat.unread}</span>}
        </button>
      )}
    </>
  );
}
