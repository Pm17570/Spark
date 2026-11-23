import { json, getStaff, noStaff } from '@/lib/auth';
import { staffInbox } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// ทีมงานทุกคน (แอดมิน + moderator) โพลที่นี่ — ?since=<id> คืนข้อความใหม่จากผู้เข้าสอบ, ไม่ส่ง since = แค่ขอ maxId/จำนวนที่ยังไม่อ่าน
export async function GET(req) {
  if (!(await getStaff())) return noStaff();
  const raw = new URL(req.url).searchParams.get('since');
  const since = raw === null || raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw);
  return json(staffInbox(since));
}
