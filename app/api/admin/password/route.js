import { json, fail, readJson, getStaff, noStaff, verifyAdminPassword, setAdminPassword, setSession, adminVersion, verifyModerator, hashPassword, staffVersion } from '@/lib/auth';
import { updateModerator, modRawById } from '@/lib/chat';

export async function POST(req) {
  const st = await getStaff();
  if (!st) return noStaff();
  const b = (await readJson(req, 2000)) || {};
  const np = String(b.next ?? '');
  if (st.role === 'admin') {
    if (!verifyAdminPassword(String(b.current ?? ''))) return fail('รหัสผ่านเดิมไม่ถูกต้อง', 403);
    if (np.length < 8) return fail('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร', 400);
    setAdminPassword(np);
    await setSession(req, { r: 'a', v: adminVersion() }, 12 * 3600);
    return json({ ok: true });
  }
  if (!verifyModerator(st.username, String(b.current ?? ''))) return fail('รหัสผ่านเดิมไม่ถูกต้อง', 403);
  if (np.length < 8) return fail('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร', 400);
  updateModerator(st.id, { hash: hashPassword(np) });
  await setSession(req, { r: 'm', id: st.id, v: staffVersion(modRawById(st.id)) }, 12 * 3600);
  return json({ ok: true });
}
