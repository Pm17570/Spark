import { json, fail, readJson, isAdmin, noAdmin, verifyAdminPassword, setAdminPassword, setSession, adminVersion } from '@/lib/auth';

export async function POST(req) {
  if (!(await isAdmin())) return noAdmin();
  const b = await readJson(req, 2000);
  if (!verifyAdminPassword(String(b?.current ?? ''))) return fail('รหัสผ่านเดิมไม่ถูกต้อง', 403);
  const np = String(b?.next ?? '');
  if (np.length < 8) return fail('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร', 400);
  setAdminPassword(np);
  await setSession(req, { r: 'a', v: adminVersion() }, 12 * 3600);
  return json({ ok: true });
}
