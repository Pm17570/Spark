'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { formatCode, parseFill, lines, OPT_LABELS } from '@/lib/model';
import Rich from '../Rich';
import { Img } from '../PartView';

function Review({ p, value }) {
  const none = <span className="muted">(ไม่ได้ตอบ)</span>;
  if (value === null || value === undefined) return none;
  if (p.type === 'mcq') {
    const sel = Array.isArray(value) ? value : [];
    return <div>{p.options.map((o, i) => (
      <div key={i} className="row" style={{ gap: 6, color: o.correct ? 'var(--ok)' : undefined }}>
        <span>{sel.includes(i) ? '☑' : '☐'}</span><b>{OPT_LABELS[i]}.</b><Rich text={o.text} inline />{o.correct && <span className="small">(เฉลย)</span>}
      </div>))}</div>;
  }
  if (p.type === 'tf') {
    return <div>{p.statements.map((s, i) => {
      const a = (value || [])[i] || {};
      return <div key={i} style={{ marginBottom: 6 }}><Rich text={s.text} />
        <div className="small">ตอบ: <b>{a.v === true ? 'ถูก' : a.v === false ? 'ผิด' : '—'}</b>{a.fix ? <> · แก้เป็น: <Rich text={a.fix} inline /></> : null} · เฉลย: <b style={{ color: 'var(--ok)' }}>{s.correct ? 'ถูก' : 'ผิด'}</b>{!s.correct && s.fixes ? ` (${lines(s.fixes).join(' / ')})` : ''}</div></div>;
    })}</div>;
  }
  if (p.type === 'fill') {
    const k = parseFill(p.template).blanks;
    return <div>{k.map((b, i) => <div key={i} className="small">ช่อง {i + 1}: <b><Rich text={(value || [])[i] || '—'} inline /></b> · เฉลย <span style={{ color: 'var(--ok)' }}>{b.answers.join(' | ')}</span></div>)}</div>;
  }
  if (p.type === 'match') {
    return <div>{p.pairs.map((x, i) => <div key={i} className="small"><Rich text={x.left} inline /> → <b><Rich text={(value || [])[i] || '—'} inline /></b> · เฉลย <span style={{ color: 'var(--ok)' }}><Rich text={x.right} inline /></span></div>)}</div>;
  }
  return <div><div className="ansbox pre">{String(value) || none}</div>{!p.manual && p.accepted && <div className="small muted" style={{ marginTop: 4 }}>เฉลย: {lines(p.accepted).join(' / ')}</div>}</div>;
}

function ScoreBox({ examId, pid, partId, max, initial, auto, onSaved }) {
  const [v, setV] = useState(initial ?? '');
  const [st, setSt] = useState('');
  useEffect(() => setV(initial ?? ''), [initial]);
  async function save(val) {
    const r = await api(`/api/admin/exams/${examId}/grade`, { method: 'POST', body: { participantId: pid, partId, score: val === '' ? null : Number(val) } });
    setSt(r.ok ? 'บันทึกแล้ว' : r.error);
    if (r.ok) onSaved?.();
  }
  return (
    <div className="row">
      <input type="number" className="scoreinput" min="0" max={max} step="0.5" value={v} placeholder={String(auto)} onChange={(e) => setV(e.target.value)} onBlur={() => String(v) !== String(initial ?? '') && save(v)} />
      <span className="small muted">/ {max}</span>
      <button className="btn sm primary" onClick={() => save(v === '' ? max : v)}>{v === '' ? 'เต็ม' : 'บันทึก'}</button>
      <button className="btn sm" onClick={() => { setV(0); save(0); }}>0</button>
      {initial !== null && initial !== undefined && <button className="btn sm ghost" onClick={() => { setV(''); save(''); }}>ล้าง</button>}
      <span className="small muted">{st}</span>
    </div>
  );
}

function ByPart({ examId, meta, reloadMeta }) {
  const [pid, setPid] = useState('');
  const [only, setOnly] = useState('pending');
  const [data, setData] = useState(null);
  const [off, setOff] = useState(0);
  const base = `/api/admin/exams/${examId}/grade`;
  useEffect(() => { if (!pid && meta?.parts?.length) setPid(meta.parts.find((x) => meta.pending[x.id])?.id || meta.parts[0].id); }, [meta, pid]);
  const load = useCallback(async () => {
    if (!pid) return;
    const r = await api(`${base}?partId=${pid}&only=${only}&offset=${off}&limit=20`);
    if (r.ok) setData(r.data);
  }, [base, pid, only, off]);
  useEffect(() => { load(); }, [load]);
  if (!meta) return null;
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={pid} onChange={(e) => { setPid(e.target.value); setOff(0); }} style={{ width: 'auto', maxWidth: '100%' }}>
          {meta.parts.map((x) => <option key={x.id} value={x.id}>{x.full}{meta.pending[x.id] ? ` — รอตรวจ ${meta.pending[x.id]}` : ''}</option>)}
        </select>
        <select value={only} onChange={(e) => { setOnly(e.target.value); setOff(0); }} style={{ width: 'auto' }}><option value="pending">เฉพาะที่รอตรวจ</option><option value="all">ทุกคำตอบที่ส่งแล้ว</option></select>
        <button className="btn sm" onClick={() => { load(); reloadMeta(); }}>รีเฟรช</button>
      </div>
      {data && <div className="card flat"><div className="small muted">โจทย์ ({data.part.full} · {data.part.points} คะแนน)</div><Rich text={data.part.text} /><Img name={data.part.image} className="thumb sm" /></div>}
      {data?.rows.map((x) => (
        <div key={x.participantId} className={'gcard' + (x.needsManual ? ' pend' : '')}>
          <div className="row between"><b>{x.name || '-'} <span className="mono small muted">{formatCode(x.code)}</span></b>{x.needsManual ? <span className="badge warn">รอตรวจ</span> : <span className="badge ok">ได้ {x.score}/{x.max}</span>}</div>
          <div style={{ margin: '8px 0' }}><Review p={data.part} value={x.value} /></div>
          <ScoreBox examId={examId} pid={x.participantId} partId={pid} max={x.max} initial={x.manual} auto={x.auto} onSaved={() => { load(); reloadMeta(); }} />
        </div>
      ))}
      {data && !data.rows.length && <div className="card muted center">ไม่มีรายการ{only === 'pending' ? 'ที่รอตรวจ 🎉' : ''}</div>}
      {data && data.total > 20 && <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn sm" disabled={off === 0} onClick={() => setOff(Math.max(0, off - 20))}>← ก่อนหน้า</button><span className="small muted">{off + 1}–{Math.min(off + 20, data.total)} จาก {data.total}</span><button className="btn sm" disabled={off + 20 >= data.total} onClick={() => setOff(off + 20)}>ถัดไป →</button></div>}
    </div>
  );
}

function ByPerson({ examId, people, reloadMeta }) {
  const [pid, setPid] = useState('');
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    if (!pid) return setData(null);
    const r = await api(`/api/admin/exams/${examId}/grade?participantId=${pid}`);
    if (r.ok) setData(r.data);
  }, [examId, pid]);
  useEffect(() => { load(); }, [load]);
  const opts = people.filter((p) => p.attempt);
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={pid} onChange={(e) => setPid(e.target.value)} style={{ width: 'auto', maxWidth: '100%' }}>
          <option value="">— เลือกผู้เข้าสอบ —</option>
          {opts.map((p) => <option key={p.id} value={p.id}>{p.name || formatCode(p.code)} ({formatCode(p.code)})</option>)}
        </select>
        {data && <b>รวม {data.score}/{data.max}</b>}
      </div>
      {data?.items.map((it) => (
        <div key={it.partId} className={'gcard' + (it.needsManual ? ' pend' : '')}>
          <div className="row between"><b>{it.full}</b><span className={'badge ' + (it.needsManual ? 'warn' : it.status === 'correct' ? 'ok' : it.status === 'wrong' ? 'bad' : 'gray')}>{it.needsManual ? 'รอตรวจ' : `${it.score}/${it.max}`}</span></div>
          <Rich text={it.part.text} className="muted" />
          <div style={{ margin: '8px 0' }}><Review p={it.part} value={it.value} /></div>
          <ScoreBox examId={examId} pid={pid} partId={it.partId} max={it.max} initial={it.manual ? it.score : null} auto={it.auto} onSaved={() => { load(); reloadMeta(); }} />
        </div>
      ))}
    </div>
  );
}

export default function Grading({ examId, people }) {
  const [mode, setMode] = useState('part');
  const [meta, setMeta] = useState(null);
  const reloadMeta = useCallback(async () => { const r = await api(`/api/admin/exams/${examId}/grade`); if (r.ok) setMeta(r.data); }, [examId]);
  useEffect(() => { reloadMeta(); }, [reloadMeta]);
  const total = meta ? Object.values(meta.pending).reduce((a, b) => a + b, 0) : 0;
  return (
    <div>
      <div className="card row between">
        <div>ระบบตรวจอัตโนมัติให้ทุกข้อที่มีเฉลย — ข้อที่ตั้งให้ “กรรมการตรวจเอง” หรือไม่มีเฉลยจะรอตรวจที่นี่ {total > 0 ? <span className="badge warn">รอตรวจ {total}</span> : <span className="badge ok">ไม่มีค้างตรวจ</span>}</div>
        <div className="tabs" style={{ margin: 0 }}><button className={'tab' + (mode === 'part' ? ' cur' : '')} onClick={() => setMode('part')}>ตรวจทีละข้อ</button><button className={'tab' + (mode === 'person' ? ' cur' : '')} onClick={() => setMode('person')}>ตรวจทีละคน</button></div>
      </div>
      {mode === 'part' ? <ByPart examId={examId} meta={meta} reloadMeta={reloadMeta} /> : <ByPerson examId={examId} people={people} reloadMeta={reloadMeta} />}
    </div>
  );
}
