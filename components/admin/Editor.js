'use client';
import { useEffect, useRef, useState } from 'react';
import MathField from './MathField';
import ImageField from './ImageField';
import { api } from '@/lib/client';
import { TYPES, TYPE_LABEL, TYPE_SHORT, OPT_LABELS, blankPart, blankQuestion, blankSubject, partWarnings, parseFill, rid, examCounts } from '@/lib/model';

const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

function PartEditor({ p, set, label, onUp, onDown, onDel }) {
  const w = partWarnings(p);
  const up = (patch) => set({ ...p, ...patch });
  const setIn = (key, i, patch) => up({ [key]: p[key].map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const delIn = (key, i) => up({ [key]: p[key].filter((_, k) => k !== i) });
  return (
    <div className="gcard">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row"><b>ข้อย่อย {label}</b>
          <select value={p.type} style={{ width: 'auto' }} onChange={(e) => { const b = blankPart(e.target.value); set({ ...b, id: p.id, text: p.text, image: p.image, points: p.points }); }}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <label className="row small" style={{ gap: 4 }}>คะแนน <input type="number" min="0" step="0.5" style={{ width: 80 }} value={p.points} onChange={(e) => up({ points: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
        </div>
        <div className="row"><button className="btn sm" onClick={onUp}>↑</button><button className="btn sm" onClick={onDown}>↓</button><button className="btn sm danger" onClick={onDel}>ลบข้อย่อย</button></div>
      </div>
      <div className="field"><label>โจทย์ (รองรับ LaTeX)</label><MathField value={p.text} onChange={(v) => up({ text: v })} rows={2} /></div>
      <div style={{ margin: '8px 0' }}><ImageField value={p.image} onChange={(v) => up({ image: v })} label="แนบรูปโจทย์" /></div>

      {p.type === 'mcq' && (
        <div className="stack">
          <div className="row">
            <label className="check"><input type="checkbox" checked={p.multiple} onChange={(e) => up({ multiple: e.target.checked })} />เลือกถูกได้หลายข้อ (เช็คบอกซ์)</label>
            {p.multiple && <label className="check"><input type="checkbox" checked={p.partial} onChange={(e) => up({ partial: e.target.checked })} />ให้คะแนนบางส่วน</label>}
          </div>
          {p.options.map((o, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
              <label className="check" title="เป็นคำตอบที่ถูก"><input type={p.multiple ? 'checkbox' : 'radio'} checked={o.correct} onChange={(e) => {
                if (p.multiple) setIn('options', i, { correct: e.target.checked });
                else up({ options: p.options.map((x, k) => ({ ...x, correct: k === i })) });
              }} /><b>{OPT_LABELS[i]}.</b></label>
              <div className="grow"><MathField multiline={false} value={o.text} onChange={(v) => setIn('options', i, { text: v })} placeholder="ตัวเลือก (LaTeX ได้)" />
                <ImageField small value={o.image} onChange={(v) => setIn('options', i, { image: v })} label="รูป" /></div>
              <button className="btn sm danger" disabled={p.options.length <= 2} onClick={() => delIn('options', i)}>✕</button>
            </div>
          ))}
          <div><button className="btn sm" disabled={p.options.length >= 10} onClick={() => up({ options: [...p.options, { text: '', image: '', correct: false }] })}>+ เพิ่มตัวเลือก</button> <span className="small muted">ติ๊กหน้าตัวเลือกที่ถูก</span></div>
        </div>
      )}

      {p.type === 'tf' && (
        <div className="stack">
          <label className="check"><input type="checkbox" checked={p.correctable} onChange={(e) => up({ correctable: e.target.checked })} />ถ้าตอบ “ผิด” ให้ผู้สอบแก้ข้อความให้ถูกต้อง</label>
          {p.statements.map((s, i) => (
            <div key={i} className="keybox stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="grow"><MathField value={s.text} rows={2} onChange={(v) => setIn('statements', i, { text: v })} placeholder="ข้อความ" /></div>
                <select style={{ width: 'auto' }} value={s.correct ? '1' : '0'} onChange={(e) => setIn('statements', i, { correct: e.target.value === '1' })}><option value="1">เฉลย: ถูก</option><option value="0">เฉลย: ผิด</option></select>
                <button className="btn sm danger" disabled={p.statements.length <= 1} onClick={() => delIn('statements', i)}>✕</button>
              </div>
              {p.correctable && !s.correct && <div className="field"><label>คำแก้ที่ยอมรับ (บรรทัดละ 1 คำตอบ)</label><textarea rows={2} value={s.fixes} onChange={(e) => setIn('statements', i, { fixes: e.target.value })} /></div>}
            </div>
          ))}
          <div><button className="btn sm" disabled={p.statements.length >= 30} onClick={() => up({ statements: [...p.statements, { text: '', correct: true, fixes: '' }] })}>+ เพิ่มข้อความ</button></div>
        </div>
      )}

      {p.type === 'fill' && (
        <div className="stack">
          <div className="field"><label>ข้อความ — ใส่คำตอบในช่องว่างด้วย [[คำตอบ]] (คำตอบที่ยอมรับหลายแบบ: [[คำตอบ|อีกแบบ]])</label><MathField value={p.template} rows={3} onChange={(v) => up({ template: v })} placeholder="น้ำเดือดที่ [[100]] องศาเซลเซียส" /></div>
          <div className="field"><label>คำหลอก (คั่นด้วย , หรือขึ้นบรรทัดใหม่)</label><input type="text" value={p.distractors} onChange={(e) => up({ distractors: e.target.value })} /></div>
          <div className="small muted">มี {parseFill(p.template).blanks.length} ช่องว่าง</div>
        </div>
      )}

      {p.type === 'match' && (
        <div className="stack">
          {p.pairs.map((x, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
              <b>{i + 1}.</b>
              <div className="grow"><MathField multiline={false} value={x.left} onChange={(v) => setIn('pairs', i, { left: v })} placeholder="ฝั่งซ้าย (โจทย์)" /><ImageField small value={x.leftImage} onChange={(v) => setIn('pairs', i, { leftImage: v })} label="รูป" /></div>
              <span>⇄</span>
              <div className="grow"><MathField multiline={false} value={x.right} onChange={(v) => setIn('pairs', i, { right: v })} placeholder="ฝั่งขวา (คำตอบที่ถูก)" /></div>
              <button className="btn sm danger" disabled={p.pairs.length <= 2} onClick={() => delIn('pairs', i)}>✕</button>
            </div>
          ))}
          <div><button className="btn sm" disabled={p.pairs.length >= 20} onClick={() => up({ pairs: [...p.pairs, { left: '', leftImage: '', right: '' }] })}>+ เพิ่มคู่</button></div>
          <div className="field"><label>คำหลอกฝั่งขวา (คั่นด้วย ,)</label><input type="text" value={p.extras} onChange={(e) => up({ extras: e.target.value })} /></div>
        </div>
      )}

      {p.type === 'text' && (
        <div className="stack">
          <div className="row">
            <label className="check"><input type="checkbox" checked={p.long} onChange={(e) => up({ long: e.target.checked })} />ช่องตอบยาว (หลายบรรทัด)</label>
            <label className="check"><input type="checkbox" checked={p.manual} onChange={(e) => up({ manual: e.target.checked })} />ให้กรรมการตรวจเอง</label>
          </div>
          {!p.manual && <>
            <div className="field"><label>คำตอบที่ยอมรับ (บรรทัดละ 1 คำตอบ)</label><textarea rows={2} value={p.accepted} onChange={(e) => up({ accepted: e.target.value })} /></div>
            <div className="field-row">
              <div className="field"><label>วิธีเทียบคำตอบ</label><select value={p.matchMode} onChange={(e) => up({ matchMode: e.target.value })}><option value="exact">ตรงทั้งหมด (ไม่สนช่องว่าง/ตัวพิมพ์)</option><option value="contains">มีคำตอบอยู่ในข้อความ</option><option value="numeric">ตัวเลข (ยอมรับเศษส่วน เช่น 1/3)</option></select></div>
              {p.matchMode === 'numeric' && <div className="field"><label>ความคลาดเคลื่อนที่ยอมรับ ±</label><input type="number" step="any" min="0" value={p.tolerance} onChange={(e) => up({ tolerance: Number(e.target.value) })} /></div>}
            </div>
          </>}
        </div>
      )}
      {w.length > 0 && <div className="alert" style={{ marginTop: 8 }}>⚠ {w.join(' · ')}</div>}
    </div>
  );
}

function QuestionEditor({ q, qi, set, onUp, onDown, onDel }) {
  const up = (patch) => set({ ...q, ...patch });
  const setPart = (i, v) => up({ parts: q.parts.map((x, k) => (k === i ? v : x)) });
  return (
    <div className="qcard">
      <div className="qh">
        <span className="qnum">ข้อใหญ่ {qi + 1}</span>
        <input type="text" className="grow" placeholder="หัวข้อ (ไม่บังคับ)" value={q.title} onChange={(e) => up({ title: e.target.value })} />
        <select style={{ width: 'auto' }} value={q.layout} onChange={(e) => up({ layout: e.target.value })}>
          <option value="same">ข้อย่อยอยู่หน้าเดียวกัน</option><option value="split">ข้อย่อยแยกคนละหน้า</option>
        </select>
        <button className="btn sm" onClick={onUp}>↑</button><button className="btn sm" onClick={onDown}>↓</button><button className="btn sm danger" onClick={onDel}>ลบข้อใหญ่</button>
      </div>
      <div className="qb">
        <div className="field"><label>โจทย์ร่วม / เนื้อเรื่อง (แสดงเหนือข้อย่อย — LaTeX ได้)</label><MathField value={q.stem} onChange={(v) => up({ stem: v })} rows={3} /></div>
        <div style={{ margin: '8px 0 12px' }}><ImageField value={q.stemImage} onChange={(v) => up({ stemImage: v })} label="แนบรูปประกอบโจทย์ร่วม" /></div>
        {q.parts.map((p, i) => (
          <PartEditor key={p.id} p={p} label={q.parts.length > 1 ? `${qi + 1}.${i + 1}` : `${qi + 1}`} set={(v) => setPart(i, v)}
            onUp={() => { const a = q.parts.slice(); move(a, i, -1); up({ parts: a }); }}
            onDown={() => { const a = q.parts.slice(); move(a, i, 1); up({ parts: a }); }}
            onDel={() => { if (q.parts.length > 1 || confirm('ลบข้อย่อยสุดท้าย?')) up({ parts: q.parts.filter((_, k) => k !== i) }); }} />
        ))}
        <div className="row">
          <span className="small muted">+ เพิ่มข้อย่อย:</span>
          {TYPES.map((t) => <button key={t} className="btn sm" onClick={() => up({ parts: [...q.parts, blankPart(t)] })}>{TYPE_SHORT[t]}</button>)}
        </div>
      </div>
    </div>
  );
}

export default function Editor({ initial, onSaved }) {
  const [d, setD] = useState(() => JSON.parse(JSON.stringify({ title: initial.title, description: initial.description, subjects: initial.subjects })));
  const [cur, setCur] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const dRef = useRef(d);
  dRef.current = d;
  const mut = (fn) => { setD((x) => { const c = JSON.parse(JSON.stringify(x)); fn(c); return c; }); setDirty(true); setMsg(null); };
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const sIdx = Math.min(cur, d.subjects.length - 1);
  const s = d.subjects[sIdx];
  const counts = examCounts(d);
  async function save() {
    setBusy(true);
    const r = await api(`/api/admin/exams/${initial.id}`, { method: 'PUT', body: dRef.current });
    setBusy(false);
    if (r.ok) { setDirty(false); setMsg({ ok: true, t: 'บันทึกลงฐานข้อมูลแล้ว' }); onSaved?.(r.data.exam); }
    else setMsg({ ok: false, t: r.error });
  }
  return (
    <div>
      <div className="card stack">
        <div className="field"><label>ชื่อข้อสอบ</label><input type="text" value={d.title} onChange={(e) => mut((c) => { c.title = e.target.value; })} /></div>
        <div className="field"><label>คำอธิบาย / ข้อปฏิบัติ (แสดงหน้าก่อนเริ่มสอบ)</label><MathField value={d.description} rows={2} onChange={(v) => mut((c) => { c.description = v; })} /></div>
        <div className="small muted">โครงสร้าง: ข้อสอบ → วิชา → ข้อใหญ่ → ข้อย่อย · ตอนนี้ {counts.subjects} วิชา {counts.questions} ข้อใหญ่ {counts.parts} ข้อย่อย รวม {counts.points} คะแนน</div>
      </div>

      <div className="tabs">
        {d.subjects.map((x, i) => <button key={x.id} className={'tab' + (i === sIdx ? ' cur' : '')} onClick={() => setCur(i)}>{x.title || `วิชา ${i + 1}`}</button>)}
        <button className="tab" onClick={() => { mut((c) => c.subjects.push(blankSubject(`วิชาที่ ${c.subjects.length + 1}`))); setCur(d.subjects.length); }}>+ เพิ่มวิชา</button>
      </div>

      <div className="scard">
        <div className="sh">
          <b>วิชา</b>
          <input type="text" className="grow" placeholder="ชื่อวิชา" value={s.title} onChange={(e) => mut((c) => { c.subjects[sIdx].title = e.target.value; })} />
          <button className="btn sm" disabled={sIdx === 0} onClick={() => { mut((c) => move(c.subjects, sIdx, -1)); setCur(sIdx - 1); }}>← เลื่อนซ้าย</button>
          <button className="btn sm" disabled={sIdx === d.subjects.length - 1} onClick={() => { mut((c) => move(c.subjects, sIdx, 1)); setCur(sIdx + 1); }}>เลื่อนขวา →</button>
          <button className="btn sm danger" disabled={d.subjects.length <= 1} onClick={() => { if (confirm(`ลบวิชา “${s.title || sIdx + 1}” พร้อมข้อทั้งหมด?`)) { mut((c) => c.subjects.splice(sIdx, 1)); setCur(0); } }}>ลบวิชา</button>
        </div>
        <div className="sb">
          <div className="field" style={{ marginBottom: 12 }}><label>คำชี้แจงวิชา (ไม่บังคับ)</label><MathField value={s.description} rows={2} onChange={(v) => mut((c) => { c.subjects[sIdx].description = v; })} /></div>
          {s.questions.map((q, qi) => (
            <QuestionEditor key={q.id} q={q} qi={qi}
              set={(v) => mut((c) => { c.subjects[sIdx].questions[qi] = v; })}
              onUp={() => mut((c) => move(c.subjects[sIdx].questions, qi, -1))}
              onDown={() => mut((c) => move(c.subjects[sIdx].questions, qi, 1))}
              onDel={() => { if (confirm('ลบข้อใหญ่นี้พร้อมข้อย่อยทั้งหมด?')) mut((c) => c.subjects[sIdx].questions.splice(qi, 1)); }} />
          ))}
          <button className="btn" onClick={() => mut((c) => c.subjects[sIdx].questions.push(blankQuestion()))}>+ เพิ่มข้อใหญ่</button>
        </div>
      </div>

      <div className="sticky-bar">
        <span className={dirty ? 'badge warn' : 'badge ok'}>{dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'บันทึกแล้ว'}</span>
        {msg && <span className={'alert ' + (msg.ok ? 'ok' : 'bad')} style={{ padding: '4px 12px' }}>{msg.t}</span>}
        <button className="btn primary" onClick={save} disabled={busy || !dirty}>{busy ? 'กำลังบันทึก…' : '💾 บันทึกข้อสอบ'}</button>
      </div>
    </div>
  );
}
