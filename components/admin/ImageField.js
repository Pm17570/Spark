'use client';
import { useRef, useState } from 'react';
import { Img } from '../PartView';

export default function ImageField({ value, onChange, label = 'แนบรูป', small = false }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.append('file', f);
    try {
      const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok) onChange(d.name); else setErr(d.error || 'อัปโหลดไม่สำเร็จ');
    } catch { setErr('อัปโหลดไม่สำเร็จ'); }
    setBusy(false);
  }
  return (
    <div className="row" style={{ gap: 8 }}>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={pick} style={{ display: 'none' }} />
      <button type="button" className="btn sm" onClick={() => ref.current.click()} disabled={busy}>{busy ? 'กำลังอัปโหลด…' : `🖼 ${value ? 'เปลี่ยนรูป' : label}`}</button>
      {value && <><Img name={value} className={small ? 'thumb sm' : 'thumb'} /><button type="button" className="btn sm danger" onClick={() => onChange('')}>ลบรูป</button></>}
      {err && <span className="small" style={{ color: 'var(--bad)' }}>{err}</span>}
    </div>
  );
}
