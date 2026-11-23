import { json, fail, readJson } from '@/lib/auth';
import { participantContext } from '@/lib/session-exam';
import { threadOf, markRead, addMessage, participantSendLimited } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// GET [?read=1] → ข้อความของฉัน (read=1 = เปิดแผงแชตอยู่ ทำเครื่องหมายอ่านแล้ว)
export async function GET(req) {
  const c = await participantContext();
  if (c.err) return c.err;
  if (new URL(req.url).searchParams.get('read') === '1') markRead(c.p.id, true);
  return json({ messages: threadOf(c.p.id) });
}

// POST { body } → ทักหาทีมงาน (แอดมิน + moderator ทุกคนจะเห็นและมีแจ้งเตือน)
export async function POST(req) {
  const c = await participantContext();
  if (c.err) return c.err;
  if (participantSendLimited(c.p.id)) return fail('ส่งข้อความถี่เกินไป กรุณารอสักครู่', 429);
  const b = (await readJson(req, 3000)) || {};
  const id = addMessage({ examId: c.exam.id, participantId: c.p.id, fromRole: 'participant', fromName: c.p.name, body: b.body });
  if (!id) return fail('ข้อความว่างเปล่า');
  return json({ id });
}
