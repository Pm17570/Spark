import { json, fail, readJson, setSession, adminVersion, verifyAdminPassword, clientIp, isLimited, noteFail, clearFails, getSession } from '@/lib/auth';
import { boot } from '@/lib/boot';

export const dynamic = 'force-dynamic';

export async function GET() {
  boot();
  return json({ admin: (await getSession())?.role === 'admin' });
}

export async function POST(req) {
  boot();
  const ip = clientIp(req);
  if (isLimited(`al:${ip}`, 8) || isLimited('al:*', 40)) return fail('ลองรหัสผิดบ่อยเกินไป กรุณารอสักครู่', 429);
  const b = await readJson(req, 2000);
  if (!verifyAdminPassword(String(b?.password ?? ''))) {
    noteFail(`al:${ip}`);
    noteFail('al:*');
    return fail('รหัสผ่านไม่ถูกต้อง', 401);
  }
  clearFails(`al:${ip}`);
  await setSession(req, { r: 'a', v: adminVersion() }, 12 * 3600);
  return json({ ok: true });
}
