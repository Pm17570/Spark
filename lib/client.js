// ตัวช่วยฝั่งเบราว์เซอร์
export async function api(url, { method = 'GET', body } = {}) {
  try {
    const r = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    let data = null;
    try {
      data = await r.json();
    } catch {}
    return { ok: r.ok, status: r.status, data, error: r.ok ? '' : data?.error || `เกิดข้อผิดพลาด (${r.status})` };
  } catch {
    return { ok: false, status: 0, data: null, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' };
  }
}

export const fmtDT = (ms) => (ms ? new Date(ms).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const p2 = (n) => String(n).padStart(2, '0');
export function toLocalInput(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export function fromLocalInput(s) {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}
