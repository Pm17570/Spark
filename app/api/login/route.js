import { json, fail, readJson, setSession, clientIp, isLimited, noteFail } from '@/lib/auth';
import { participantByCode, newSession } from '@/lib/repo';
import { cleanCode } from '@/lib/model';
import { boot } from '@/lib/boot';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  boot();
  const ip = clientIp(req);
  if (isLimited(`pl:${ip}`, 120) || isLimited('pl:*', 3000)) return fail('ลองรหัสผิดบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่', 429);
  const body = await readJson(req);
  const code = cleanCode(body?.code);
  const p = code.length === 8 ? participantByCode(code) : null;
  if (!p) {
    noteFail(`pl:${ip}`);
    noteFail('pl:*');
    return fail('ไม่พบรหัสนี้ กรุณาตรวจสอบรหัสอีกครั้ง', 401);
  }
  const tok = newSession(p.id); // เข้าใหม่ = เครื่องเก่าถูกเตะออก (1 รหัส = 1 เครื่อง)
  await setSession(req, { r: 'p', id: p.id, t: tok }, 24 * 3600);
  return json({ ok: true });
}
