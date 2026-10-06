// app/api/programs/sync-pay-amount/route.js
//
// "Update existing amounts" for a yojna.
//
// After the contribution amount of an age group is changed on the Yojna page,
// existing members and their unpaid closing entries still carry the old
// amount. This route brings them in line with the yojna:
//   - member.payAmount                -> amount of the member's age group
//   - member.joinFees                 -> join fee of the member's age group, ONLY
//                                        for members who have not yet paid their
//                                        join fee in full (remaining is re-worked)
//   - payment_pending.payAmount       -> same amount, ONLY for entries that are
//                                        still fully pending (nothing paid yet)
// Paid and partially paid entries, fixed-amount members and blocked members
// are never touched.
//
// POST /api/programs/sync-pay-amount
// Header: Authorization: Bearer <admin's Firebase ID token>
// Body:
//   { programId, mode: 'preview' }                       -> counts only, no writes
//   { programId, mode: 'apply', ranges?: ['18-25', ...] } -> writes the changes
//
// 'apply' is safe to run again: it only writes docs whose amount still differs.
import { NextResponse } from 'next/server';
import admin from '../../admin';
import { buildPlan, memberWrites } from '../../_lib/payAmountSync';

export const runtime = 'nodejs';
export const maxDuration = 300;

const adminDb = admin.firestore();
const adminAuth = admin.auth();

const BATCH_SIZE = 400;      // Firestore allows 500 writes per batch
const PARALLEL_BATCHES = 5;

const MEMBER_FIELDS = [
  'payAmount', 'ageGroup', 'ageGroupRange', 'bobDate', 'dateJoin', 'requestCreatedAt',
  'status', 'active_flag', 'delete_flag', 'isFixedAmountMember',
  'displayName', 'registrationNumber',
  'joinFees', 'joinFeesPaidAmount', 'joinFeesDone', 'joinFeesPaymentType',
];
const ENTRY_FIELDS = ['memberId', 'payAmount', 'paidAmount', 'status', 'delete_flag'];

async function verifyToken(request) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return { uid: null, error: 'Unauthorized' };
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, error: null };
  } catch {
    return { uid: null, error: 'Invalid or expired token' };
  }
}

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Keep the Firestore ref + last update time next to the data, so the plan's
// `source` objects can be written back without another read.
const withRef = (d) => ({ id: d.id, ...d.data(), _ref: d.ref, _updateTime: d.updateTime });

async function loadPlan(uid, programId, onlyRanges) {
  const basePath = `users/${uid}/programs/${programId}`;

  const [programSnap, membersSnap, pendingSnap] = await Promise.all([
    adminDb.doc(basePath).get(),
    adminDb.collection(`${basePath}/members`)
      .where('delete_flag', '==', false)
      .select(...MEMBER_FIELDS)
      .get(),
    adminDb.collection(`${basePath}/payment_pending`)
      .where('status', '==', 'pending')
      .select(...ENTRY_FIELDS)
      .get(),
  ]);

  if (!programSnap.exists) return { program: null, plan: null };

  const program = { id: programSnap.id, ...programSnap.data() };
  const plan = buildPlan({
    ageGroups: program.ageGroups || [],
    members: membersSnap.docs.map(withRef),
    pendingEntries: pendingSnap.docs.map(withRef),
    onlyRanges,
  });

  return { program, plan };
}

// Writes in batches. Every update carries a lastUpdateTime precondition: if a
// doc changed after we read it (for example the entry was paid in the
// meantime) that batch is rejected instead of overwriting the newer data.
async function applyUpdates(updates) {
  let written = 0;
  let failed = 0;

  const chunks = chunkArray(updates, BATCH_SIZE);
  for (let i = 0; i < chunks.length; i += PARALLEL_BATCHES) {
    const results = await Promise.all(
      chunks.slice(i, i + PARALLEL_BATCHES).map(async (chunk) => {
        const batch = adminDb.batch();
        for (const u of chunk) {
          batch.update(u.source._ref, u.data, { lastUpdateTime: u.source._updateTime });
        }
        try {
          await batch.commit();
          return { ok: chunk.length, bad: 0 };
        } catch (err) {
          console.error('[programs/sync-pay-amount] batch failed:', err.message);
          return { ok: 0, bad: chunk.length };
        }
      })
    );
    for (const r of results) {
      written += r.ok;
      failed += r.bad;
    }
  }

  return { written, failed };
}

export async function POST(request) {
  try {
    const { uid, error: authError } = await verifyToken(request);
    if (authError) return NextResponse.json({ error: authError }, { status: 401 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { programId, mode, ranges } = body || {};
    if (!programId || typeof programId !== 'string' || programId.includes('/')) {
      return NextResponse.json({ error: 'programId required' }, { status: 400 });
    }
    if (mode !== 'preview' && mode !== 'apply') {
      return NextResponse.json({ error: 'mode must be "preview" or "apply"' }, { status: 400 });
    }
    if (ranges !== undefined && (!Array.isArray(ranges) || ranges.some((r) => typeof r !== 'string'))) {
      return NextResponse.json({ error: 'ranges must be an array of strings' }, { status: 400 });
    }

    const onlyRanges = mode === 'apply' && Array.isArray(ranges) ? ranges : undefined;
    const { program, plan } = await loadPlan(uid, programId, onlyRanges);
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    if (mode === 'preview') {
      return NextResponse.json({
        programId,
        programName: program.name || '',
        groups: plan.groups,
        totals: plan.totals,
        skipped: plan.skipped,
        unmatchedSamples: plan.unmatchedSamples,
      });
    }

    const nowIso = new Date().toISOString();
    const [memberResult, entryResult] = await Promise.all([
      applyUpdates(memberWrites(plan, nowIso)),
      applyUpdates(plan.entryUpdates.map((u) => ({
        source: u.source,
        data: { payAmount: u.to, previousPayAmount: u.from, payAmountUpdatedAt: nowIso },
      }))),
    ]);
    const failedWrites = memberResult.failed + entryResult.failed;

    console.log(
      `[programs/sync-pay-amount] ${programId}: ${memberResult.written} members, ` +
      `${entryResult.written} entries updated, ${failedWrites} failed`
    );

    return NextResponse.json({
      success: failedWrites === 0,
      membersUpdated: memberResult.written,
      entriesUpdated: entryResult.written,
      failedWrites,
    });
  } catch (err) {
    console.error('[programs/sync-pay-amount]', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
