'use client';
// แสดงข้อความที่มี LaTeX: $…$  $$…$$  \(…\)  \[…\]  (พิมพ์ \$ เพื่อแสดงเครื่องหมายดอลลาร์)
import { useMemo } from 'react';
import katex from 'katex';

export function tokenize(src) {
  const s = String(src ?? '');
  const out = [];
  let buf = '';
  let i = 0;
  const flush = () => { if (buf) out.push({ t: 'text', v: buf }); buf = ''; };
  while (i < s.length) {
    if (s[i] === '\\' && s[i + 1] === '$') { buf += '$'; i += 2; continue; }
    let close = null, disp = false, open = 0;
    if (s.startsWith('$$', i)) { close = '$$'; disp = true; open = 2; }
    else if (s.startsWith('\\[', i)) { close = '\\]'; disp = true; open = 2; }
    else if (s.startsWith('\\(', i)) { close = '\\)'; open = 2; }
    else if (s[i] === '$') { close = '$'; open = 1; }
    if (close) {
      let j = i + open;
      let found = -1;
      while (j < s.length) {
        if (s[j] === '\\' && close === '$') { j += 2; continue; }
        if (s.startsWith(close, j)) { found = j; break; }
        j++;
      }
      if (found > i + open) {
        flush();
        out.push({ t: 'math', v: s.slice(i + open, found), disp });
        i = found + close.length;
        continue;
      }
    }
    buf += s[i++];
  }
  flush();
  return out;
}

export default function Rich({ text, inline = false, className = '' }) {
  const html = useMemo(() => {
    const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return tokenize(text).map((tk) => {
      if (tk.t === 'text') return esc(tk.v).replace(/\n/g, '<br/>');
      try {
        return katex.renderToString(tk.v, { displayMode: tk.disp, throwOnError: false, trust: false, strict: 'ignore', output: 'htmlAndMathml' });
      } catch {
        return esc(tk.v);
      }
    }).join('');
  }, [text]);
  const Tag = inline ? 'span' : 'div';
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
