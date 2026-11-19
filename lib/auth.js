// เซสชัน / รหัสผ่านแอดมิน / จำกัดความถี่การลองรหัส
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { boot } from './boot';
import { getSetting, setSetting, participantById } from './repo';

const COOKIE = 'spark_s';

/* ---------- ผลตอบกลับมาตรฐาน ---------- */
export const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (error, status = 400, extra = {}) => json({ error, ...extra }, status);
export async function readJson(req, maxBytes = 2_000_000) {
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ---------- รหัสผ่านแอดมิน (scrypt) ---------- */
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 32);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}
export function checkPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const h = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 32);
  const want = Buffer.from(hashHex, 'hex');
  return want.length === h.length && crypto.timingSafeEqual(h, want);
}
export const adminVersion = () => (getSetting('admin_hash') || '').slice(-8);
export function setAdminPassword(pw) {
  setSetting('admin_hash', hashPassword(pw)); // เปลี่ยนรหัส → เซสชันแอดมินเก่าทั้งหมดใช้ไม่ได้
}
export function verifyAdminPassword(pw) {
  return checkPassword(pw, getSetting('admin_hash'));
}

/* ---------- เซสชัน (คุกกี้ลงลายมือชื่อด้วย HMAC) ---------- */
function secret() {
  let s = getSetting('session_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setSetting('session_secret', s);
  }
  return s;
}
const sign = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
};
function verify(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.e > Date.now() ? p : null;
  } catch {
    return null;
  }
}

const isHttps = (req) => (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https';

export async function setSession(req, payload, maxAgeSec) {
  const c = await cookies();
  c.set(COOKIE, sign({ ...payload, e: Date.now() + maxAgeSec * 1000 }), { httpOnly: true, sameSite: 'lax', secure: isHttps(req), path: '/', maxAge: maxAgeSec });
}
export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

// → { role:'admin' } | { role:'participant', p } | { role:'replaced' } | null
export async function getSession() {
  boot();
  const raw = (await cookies()).get(COOKIE)?.value;
  const s = verify(raw);
  if (!s) return null;
  if (s.r === 'a') return s.v === adminVersion() ? { role: 'admin' } : null;
  if (s.r === 'p') {
    const p = participantById(s.id);
    if (!p) return null;
    if (p.session !== s.t) return { role: 'replaced' };
    return { role: 'participant', p };
  }
  return null;
}
export async function isAdmin() {
  return (await getSession())?.role === 'admin';
}
export const noAdmin = () => fail('ต้องเข้าสู่ระบบแอดมิน', 401);

/* ---------- จำกัดความถี่ (ในหน่วยความจำ) ---------- */
const hits = globalThis.__sparkHits || (globalThis.__sparkHits = new Map());
const WINDOW = 10 * 60 * 1000;
export const clientIp = (req) => (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'local').split(',')[0].trim();
const recent = (k) => {
  const t = Date.now();
  const arr = (hits.get(k) || []).filter((x) => t - x < WINDOW);
  hits.set(k, arr);
  return arr;
};
export const isLimited = (k, max) => recent(k).length >= max;
export const noteFail = (k) => {
  recent(k).push(Date.now());
  if (hits.size > 5000) for (const [key, v] of hits) if (!v.length) hits.delete(key);
};
export const clearFails = (k) => hits.delete(k);
