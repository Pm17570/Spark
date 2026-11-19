import { json, clearSession } from '@/lib/auth';
export async function POST() {
  await clearSession();
  return json({ ok: true });
}
