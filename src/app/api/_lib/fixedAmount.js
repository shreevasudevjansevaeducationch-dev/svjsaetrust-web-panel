// app/api/_lib/fixedAmount.js
//
// Fixed-amount members (Members page > Fixed Payment Groups).
//
// Rule: a fixed-amount member owes ONE total (member.fixedAmount, e.g. 15,200)
// instead of a contribution per closing. Every closing payment the member has
// ever made counts towards that total. Once the total is reached:
//   - nothing more is due, so the member's leftover unpaid closing entries
//     (payment_pending) are moved out to an archive collection, and
//   - member.fixedAmountCompleted = true is written, which the Cloud Functions
//     read so that no new entries are created for this member.
// If the member later drops below the total again (a transaction is deleted,
// or the member is taken out of the fixed group) the archived entries are put
// back exactly as they were.
//
// Used by:
//   app/api/members/fixed-amount/route.js   (called from the admin panel)
//   app/api/payments/process/route.js       (Closing Payments page)

import admin from '../admin';

const adminDb = admin.firestore();

// Archived entries keep their original document id and data.
export const ARCHIVE_COLLECTION = 'payment_pending_fixed_settled';

const ENTRIES_PER_BATCH = 200; // 2 writes per entry, Firestore limit is 500 per batch

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Pure: where does this member stand against the fixed amount?
export function fixedStatus(member, paidTotal) {
  const fixedAmount = Number(member?.fixedAmount) || 0;
  const isFixed = member?.isFixedAmountMember === true && fixedAmount > 0;
  if (!isFixed) return { isFixed: false, fixedAmount: 0, paid: 0, remaining: 0, completed: false };

  const paid = Math.max(0, Number(paidTotal) || 0);
  return {
    isFixed: true,
    fixedAmount,
    paid,
    remaining: Math.max(0, fixedAmount - paid),
    completed: paid >= fixedAmount,
  };
}

// Everything the member has paid towards closings (same filter the
// Closing Payments page uses for "total paid").
async function sumPaid(basePath, memberId) {
  const snap = await adminDb.collection(`${basePath}/transactions`)
    .where('payerId', '==', memberId)
    .where('status', '==', 'completed')
    .where('delete_flag', '==', false)
    .select('amount')
    .get();
  return snap.docs.reduce((sum, d) => sum + (Number(d.data().amount) || 0), 0);
}

// Move every not-yet-paid entry of this member into the archive.
async function archiveOpenEntries(basePath, memberId, nowIso) {
  const snap = await adminDb.collection(`${basePath}/payment_pending`)
    .where('memberId', '==', memberId)
    .get();

  const open = snap.docs.filter((d) => {
    const p = d.data();
    return p.delete_flag !== true && p.status !== 'paid';
  });

  let archived = 0;
  let failed = 0;
  for (const chunk of chunkArray(open, ENTRIES_PER_BATCH)) {
    const batch = adminDb.batch();
    for (const d of chunk) {
      batch.set(adminDb.doc(`${basePath}/${ARCHIVE_COLLECTION}/${d.id}`), {
        ...d.data(),
        settledByFixedAmount: true,
        settledAt: nowIso,
      });
      // Precondition: if the entry changed after we read it (for example it was
      // paid just now) the batch is rejected instead of removing newer data.
      batch.delete(d.ref, { lastUpdateTime: d.updateTime });
    }
    try {
      await batch.commit();
      archived += chunk.length;
    } catch (err) {
      console.error('[fixedAmount] archive batch failed:', err.message);
      failed += chunk.length;
    }
  }
  return { archived, failed };
}

// Put archived entries back (member is no longer fully paid / no longer fixed).
async function restoreArchivedEntries(basePath, memberId) {
  const snap = await adminDb.collection(`${basePath}/${ARCHIVE_COLLECTION}`)
    .where('memberId', '==', memberId)
    .get();
  if (snap.empty) return { restored: 0, failed: 0 };

  let restored = 0;
  let failed = 0;
  for (const chunk of chunkArray(snap.docs, ENTRIES_PER_BATCH)) {
    const targets = chunk.map((d) => adminDb.doc(`${basePath}/payment_pending/${d.id}`));
    const existing = await Promise.all(targets.map((ref) => ref.get()));

    const batch = adminDb.batch();
    let count = 0;
    chunk.forEach((d, i) => {
      // An entry with this id may have been created again meanwhile; keep that one.
      if (!existing[i].exists) {
        const { settledByFixedAmount, settledAt, ...original } = d.data();
        batch.set(targets[i], original);
        count++;
      }
      batch.delete(d.ref);
    });
    try {
      await batch.commit();
      restored += count;
    } catch (err) {
      console.error('[fixedAmount] restore batch failed:', err.message);
      failed += chunk.length;
    }
  }
  return { restored, failed };
}

/**
 * Bring one member's pending entries in line with their fixed-amount status.
 * Safe to call any number of times, for any member (fixed or not).
 *
 * @param {string}  basePath  users/{uid}/programs/{programId}
 * @param {string}  memberId
 * @param {object}  [opts]
 * @param {boolean} [opts.dryRun] only report the status, write nothing
 */
export async function syncFixedMember(basePath, memberId, { dryRun = false } = {}) {
  const memberRef = adminDb.doc(`${basePath}/members/${memberId}`);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) return { memberId, found: false };

  const member = memberSnap.data();
  const isFixed = fixedStatus(member, 0).isFixed;
  const paid = isFixed ? await sumPaid(basePath, memberId) : 0;
  const status = fixedStatus(member, paid);

  const result = { memberId, found: true, ...status, archived: 0, restored: 0, failed: 0 };
  if (dryRun) return result;

  const nowIso = new Date().toISOString();

  if (status.completed) {
    const r = await archiveOpenEntries(basePath, memberId, nowIso);
    result.archived = r.archived;
    result.failed = r.failed;
  } else {
    const r = await restoreArchivedEntries(basePath, memberId);
    result.restored = r.restored;
    result.failed = r.failed;
  }

  // Keep the fields the Cloud Functions and the admin panel read up to date.
  const patch = {};
  if (status.isFixed) {
    if (member.fixedAmountCompleted !== status.completed) patch.fixedAmountCompleted = status.completed;
    if (Number(member.fixedAmountPaid) !== status.paid) patch.fixedAmountPaid = status.paid;
  } else if (member.fixedAmountCompleted === true) {
    patch.fixedAmountCompleted = false;
  }
  if (Object.keys(patch).length > 0) {
    await memberRef.update({ ...patch, fixedAmountCheckedAt: nowIso });
  }

  return result;
}

// Several members, a few at a time.
export async function syncFixedMembers(basePath, memberIds, opts) {
  const ids = [...new Set((memberIds || []).filter(Boolean))];
  const results = [];
  for (const chunk of chunkArray(ids, 5)) {
    results.push(...await Promise.all(chunk.map((id) => syncFixedMember(basePath, id, opts))));
  }
  return results;
}
