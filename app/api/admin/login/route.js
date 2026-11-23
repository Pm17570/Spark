import { json, fail, readJson, setSession, adminVersion, verifyAdminPassword, verifyModerator, staffVersion, clientIp, isLimited, noteFail, clearFails, getStaff } from '@/lib/auth';
import { cleanUsername } from '@/lib/chat';
import { boot } from '@/lib/boot';

export const dynamic = 'force-dynamic';

export async function GET() {
  boot();
  const s = await getStaff();
  return json({ admin: !!s, role: s?.role || null, name: s?.name || '' });
}

// ช่องชื่อผู้ใช้เว้นว่าง (หรือ "admin") = แอดมิน, ชื่ออื่น = moderator
export async function POST(req) {
  boot();
  const ip = clientIp(req);
  if (isLimited(`al:${ip}`, 8) || isLimited('al:*', 40)) return fail('ลองรหัสผิดบ่อยเกินไป กรุณารอสักครู่', 429);
  const b = (await readJson(req, 2000)) || {};
  const pw = String(b.password ?? '');
  const u = cleanUsername(b.username);
  if (!u || u === 'admin') {
    if (!verifyAdminPassword(pw)) { noteFail(`al:${ip}`); noteFail('al:*'); return fail('รหัสผ่านไม่ถูกต้อง', 401); }
    clearFails(`al:${ip}`);
    await setSession(req, { r: 'a', v: adminVersion() }, 12 * 3600);
    return json({ ok: true, role: 'admin' });
  }
  const m = verifyModerator(u, pw);
  if (!m) { noteFail(`al:${ip}`); noteFail('al:*'); return fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401); }
  clearFails(`al:${ip}`);
  await setSession(req, { r: 'm', id: m.id, v: staffVersion(m) }, 12 * 3600);
  return json({ ok: true, role: 'mod' });
}
