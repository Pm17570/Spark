'use client';
import { useRef, useState } from 'react';
import Rich from '../Rich';
import { hasMath } from '@/lib/model';

const SNIPS = [
  ['x²', '$x^2$'], ['xₙ', '$x_n$'], ['a/b', '$\\dfrac{a}{b}$'], ['√', '$\\sqrt{x}$'], ['∑', '$\\sum_{i=1}^{n} i$'], ['∫', '$\\int_{a}^{b} f(x)\\,dx$'],
  ['lim', '$\\lim_{x\\to 0}$'], ['π', '$\\pi$'], ['∞', '$\\infty$'], ['≤', '$\\le$'], ['≥', '$\\ge$'], ['≠', '$\\ne$'], ['±', '$\\pm$'], ['×', '$\\times$'], ['÷', '$\\div$'],
  ['→', '$\\to$'], ['α', '$\\alpha$'], ['β', '$\\beta$'], ['θ', '$\\theta$'], ['Δ', '$\\Delta$'], ['°', '$^\\circ$'], ['เมทริกซ์', '$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$'], ['สูตรบรรทัดใหม่', '$$ $$'],
];

export default function MathField({ value, onChange, multiline = true, rows = 3, placeholder = '' }) {
  const ref = useRef(null);
  const [bar, setBar] = useState(false);
  const insert = (snip) => {
    const el = ref.current;
    const v = value || '';
    const a = el ? el.selectionStart : v.length;
    const b = el ? el.selectionEnd : v.length;
    const sel = v.slice(a, b);
    const text = sel && /^\$[^$]/.test(snip) ? snip.replace(/^\$(.*)\$$/s, (_, inner) => `$${sel}$`) : snip;
    onChange(v.slice(0, a) + text + v.slice(b));
    setTimeout(() => { if (el) { el.focus(); const p = a + text.length; el.setSelectionRange(p, p); } }, 0);
  };
  const P = multiline ? 'textarea' : 'input';
  return (
    <div>
      <div className="row" style={{ marginBottom: 4, gap: 6 }}>
        <button type="button" className="btn sm" onClick={() => setBar(!bar)} title="แทรกสูตร LaTeX">∑ สูตร</button>
        {bar && <span className="small muted">พิมพ์ LaTeX ระหว่าง $…$ (บรรทัดเดียว) หรือ $$…$$ (กลางบรรทัด)</span>}
      </div>
      {bar && <div className="mathbar">{SNIPS.map(([l, s]) => <button type="button" key={l} onClick={() => insert(s)}>{l}</button>)}</div>}
      <P ref={ref} className={multiline ? 'textarea' : 'input'} {...(multiline ? { rows } : { type: 'text' })} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hasMath(value) && <div className="mathprev"><span className="small muted">ตัวอย่าง: </span><Rich text={value} /></div>}
    </div>
  );
}
