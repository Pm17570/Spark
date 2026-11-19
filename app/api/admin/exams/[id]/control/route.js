import { json, fail, readJson, isAdmin, noAdmin } from '@/lib/auth';
import { loadExam, updateExamSettings, finalizeExpired } from '@/lib/repo';

export async function POST(req, { params }) {
  if (!(await isAdmin())) return noAdmin();
  const id = (await params).id;
  const cur = loadExam(id);
  if (!cur) return fail('ไม่พบข้อสอบ', 404);
  const b = (await readJson(req, 5000)) || {};
  const patch = {};
  if (['draft', 'open', 'scheduled', 'closed'].includes(b.status)) patch.status = b.status;
  for (const k of ['openAt', 'closeAt']) if (k in b) patch[k] = Number.isFinite(Number(b[k])) && b[k] !== null ? Number(b[k]) : null;
  if ('durationMin' in b) patch.durationMin = b.durationMin;
  if ('showResult' in b) patch.showResult = !!b.showResult;
  if ('shuffle' in b) patch.shuffle = !!b.shuffle;
  if (Number.isFinite(Number(b.addExtraMin)) && b.addExtraMin) patch.extraMin = cur.extraMin + Number(b.addExtraMin);
  if (patch.status === 'open' && cur.status === 'closed' && !('closeAt' in b)) patch.closeAt = null;
  const e = updateExamSettings(id, patch);
  finalizeExpired(e);
  return json({ ok: true });
}
