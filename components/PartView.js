'use client';
import { useState } from 'react';
import Rich from './Rich';
import { OPT_LABELS } from '@/lib/model';

export const fileUrl = (name) => `/api/files/${name}`;
export function Img({ name, className = 'thumb', alt = '' }) {
  if (!name) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fileUrl(name)} alt={alt} className={className} loading="lazy" />;
}

export function isAnswered(p, v) {
  if (v === undefined || v === null) return false;
  switch (p.type) {
    case 'mcq': return Array.isArray(v) && v.length > 0;
    case 'tf': return Array.isArray(v) && v.some((x) => x && typeof x.v === 'boolean');
    case 'fill': case 'match': return Array.isArray(v) && v.some((x) => String(x || '').trim());
    default: return typeof v === 'string' && v.trim() !== '';
  }
}

/* ---------- ช่อง + คลังคำ (ใช้ทั้งเติมคำและจับคู่) : ลากวาง หรือ แตะคำแล้วแตะช่อง ---------- */
function useBank(bank, values, setValues, disabled) {
  const [sel, setSel] = useState(null); // index ในคลัง
  const [over, setOver] = useState(null);
  const usedIdx = new Set();
  values.forEach((v) => {
    if (!v) return;
    const k = bank.findIndex((b, i) => b === v && !usedIdx.has(i));
    if (k >= 0) usedIdx.add(k);
  });
  const put = (slot, word) => {
    if (disabled) return;
    const next = values.slice();
    next[slot] = word;
    setValues(next);
  };
  const dropOn = (slot, e) => {
    e.preventDefault();
    setOver(null);
    const d = e.dataTransfer.getData('text/plain');
    if (d.startsWith('b:')) put(slot, bank[Number(d.slice(2))]);
    else if (d.startsWith('s:')) {
      const from = Number(d.slice(2));
      if (from === slot) return;
      const next = values.slice();
      const tmp = next[slot];
      next[slot] = next[from];
      next[from] = tmp || '';
      setValues(next);
    }
  };
  const clickSlot = (slot) => {
    if (disabled) return;
    if (sel !== null) { put(slot, bank[sel]); setSel(null); }
    else if (values[slot]) put(slot, '');
  };
  const slotProps = (slot) => ({
    className: 'slot' + (over === slot ? ' over' : ''),
    onDragOver: (e) => { e.preventDefault(); setOver(slot); },
    onDragLeave: () => setOver(null),
    onDrop: (e) => dropOn(slot, e),
    onClick: () => clickSlot(slot),
  });
  const filled = (slot) => values[slot]
    ? <span className="chip" draggable={!disabled} onDragStart={(e) => e.dataTransfer.setData('text/plain', `s:${slot}`)}><Rich text={values[slot]} inline /></span>
    : null;
  const Bank = () => (
    <div className="bank" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('s:')) put(Number(d.slice(2)), ''); }}>
      {bank.map((w, i) => (
        <span key={i} className={'chip' + (usedIdx.has(i) ? ' used' : '') + (sel === i ? ' sel' : '')} draggable={!disabled && !usedIdx.has(i)}
          onDragStart={(e) => e.dataTransfer.setData('text/plain', `b:${i}`)}
          onClick={() => !disabled && !usedIdx.has(i) && setSel(sel === i ? null : i)}>
          <Rich text={w} inline />
        </span>
      ))}
    </div>
  );
  return { slotProps, filled, Bank };
}

function Fill({ p, value, onChange, disabled }) {
  const blanks = p.parts.filter((x) => typeof x === 'object').length;
  const values = Array.from({ length: blanks }, (_, i) => (value && value[i]) || '');
  const b = useBank(p.bank, values, onChange, disabled);
  return (
    <div>
      <b.Bank />
      <div style={{ lineHeight: 2.4 }}>
        {p.parts.map((x, i) => typeof x === 'string'
          ? <Rich key={i} text={x} inline />
          : <span key={i} {...b.slotProps(x.blank)}>{b.filled(x.blank)}</span>)}
      </div>
      <div className="small muted">ลากคำจากกล่องด้านบนมาวางในช่องว่าง หรือแตะคำแล้วแตะช่องว่าง (แตะคำที่วางแล้วเพื่อเอาออก)</div>
    </div>
  );
}

function Match({ p, value, onChange, disabled }) {
  const values = p.left.map((_, i) => (value && value[i]) || '');
  const b = useBank(p.right, values, onChange, disabled);
  return (
    <div>
      <b.Bank />
      {p.left.map((l, i) => (
        <div key={i} className="matchrow">
          <div><Img name={l.image} className="thumb sm" /><Rich text={l.text} /></div>
          <div {...b.slotProps(i)}>{b.filled(i)}</div>
        </div>
      ))}
      <div className="small muted">ลากคำตอบมาวางให้ตรงกับแต่ละข้อ หรือแตะคำแล้วแตะช่อง</div>
    </div>
  );
}

function Mcq({ p, value, onChange, disabled }) {
  const v = Array.isArray(value) ? value : [];
  const toggle = (i) => {
    if (disabled) return;
    if (p.multiple) onChange(v.includes(i) ? v.filter((x) => x !== i) : [...v, i].sort((a, b) => a - b));
    else onChange(v.includes(i) ? [] : [i]);
  };
  return (
    <div>
      {p.multiple && <div className="small muted">เลือกได้มากกว่า 1 ข้อ</div>}
      {p.order.map((i, pos) => {
        const o = p.options[i];
        const on = v.includes(i);
        return (
          <label key={i} className={'opt' + (on ? ' sel' : '')}>
            <input type={p.multiple ? 'checkbox' : 'radio'} checked={on} onChange={() => toggle(i)} disabled={disabled} />
            <b>{OPT_LABELS[pos]}.</b>
            <span className="grow"><Img name={o.image} className="thumb sm" /><Rich text={o.text} /></span>
          </label>
        );
      })}
    </div>
  );
}

function Tf({ p, value, onChange, disabled }) {
  const v = Array.isArray(value) ? value : [];
  const set = (i, patch) => {
    const next = p.statements.map((_, k) => ({ ...(v[k] || {}) }));
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  return (
    <div>
      {p.statements.map((s, i) => {
        const a = v[i] || {};
        return (
          <div key={i} className="tfrow">
            <Rich text={s.text} />
            <div className="row" style={{ marginTop: 6 }}>
              <label className={'opt' + (a.v === true ? ' sel' : '')} style={{ margin: 0 }}><input type="radio" checked={a.v === true} onChange={() => set(i, { v: true })} disabled={disabled} />ถูก</label>
              <label className={'opt' + (a.v === false ? ' sel' : '')} style={{ margin: 0 }}><input type="radio" checked={a.v === false} onChange={() => set(i, { v: false })} disabled={disabled} />ผิด</label>
            </div>
            {p.correctable && a.v === false && (
              <div className="field" style={{ marginTop: 6 }}>
                <label>แก้ข้อความให้ถูกต้อง</label>
                <input type="text" value={a.fix || ''} onChange={(e) => set(i, { fix: e.target.value })} disabled={disabled} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PartView({ part: p, value, onChange, disabled }) {
  return (
    <div>
      {p.text ? <Rich text={p.text} /> : null}
      <Img name={p.image} />
      <div style={{ marginTop: 8 }}>
        {p.type === 'mcq' && <Mcq {...{ p, value, onChange, disabled }} />}
        {p.type === 'tf' && <Tf {...{ p, value, onChange, disabled }} />}
        {p.type === 'fill' && <Fill {...{ p, value, onChange, disabled }} />}
        {p.type === 'match' && <Match {...{ p, value, onChange, disabled }} />}
        {p.type === 'text' && (p.long
          ? <textarea rows={6} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="พิมพ์คำตอบ…" />
          : <input type="text" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="พิมพ์คำตอบ…" autoComplete="off" />)}
      </div>
    </div>
  );
}
