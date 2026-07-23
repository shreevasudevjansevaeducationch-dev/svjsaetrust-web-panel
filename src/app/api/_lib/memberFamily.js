// ============================================================================
// PUT THIS FILE AT:  app/api/_lib/memberFamily.js
// (in your Next.js ADMIN WEB PROJECT — not the mobile app)
// ============================================================================
//
// Shared helpers for the MEMBER self-service APIs (home dashboard, closing
// list, payment history). These are used by:
//   app/api/member/home/route.js
//   app/api/member/closing-list/route.js
//   app/api/member/payment-history/route.js
//
// IMPORTANT — auth model difference vs your existing admin-side routes:
// Your existing `/api/member/closing-status` and `/api/member/search-by-phone`
// routes are called by the TRUST ADMIN, so `decoded.uid` IS the trust owner
// and basePath = `users/${decoded.uid}/`.
//
// These NEW routes are called by a MEMBER logging in with their own Firebase
// account. A member's ID token has custom claims (see mobile app's
// lib/ctx.tsx) that look like:
//   { role: 'member', createdBy: '<trustAdminUid>', programId: '<homeProgramId>', ... }
// So here basePath = `users/${decoded.createdBy}/`  — NOT `users/${decoded.uid}/`.
//
// Also: the member's Firestore document ID (under
// programs/{programId}/members/{id}) is NOT the Firebase Auth uid — it's
// stored in the `user_id` custom claim set when the member's Firebase
// account was created. This mirrors the mobile app's own sign-in code
// (lib/ctx.tsx), which already reads `customClaims.user_id` for the same
// reason. `resolveMemberRequest()` below resolves this correctly
// (`claims.user_id || authUid`) — if your account-creation flow changes
// so the doc id always equals the Auth uid, this still works unchanged
// since it only falls back to `authUid` when `user_id` is absent.

import { NextResponse } from 'next/server';
import admin from '../admin'; // adjust if your admin.js lives elsewhere

const adminDb = admin.firestore();
const adminAuth = admin.auth();

const emptySummary = () => ({
  total: 0,
  pendingCount: 0,
  paidCount: 0,
  partialCount: 0,
  pendingAmount: 0,
  paidAmount: 0,
  totalAmount: 0,
});

const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
};

// ── Token verify ─────────────────────────────────────────────────────────
export async function verifyToken(request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split('Bearer ')[1];
  if (!token) return { uid: null, claims: null, error: 'Unauthorized' };
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, claims: decoded, error: null };
  } catch {
    return { uid: null, claims: null, error: 'Invalid or expired token' };
  }
}

// ── Member's own doc (identity + phone) ─────────────────────────────────
export async function getMemberOwnProfile(basePath, programId, memberId) {
  if (!basePath || !programId || !memberId) return null;
  const snap = await adminDb.doc(`${basePath}programs/${programId}/members/${memberId}`).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// ── Closing group id -> name map ─────────────────────────────────────────
export async function getClosingGroupMap(basePath, programId) {
  const snap = await adminDb.collection(`${basePath}programs/${programId}/closing_groups`).get();
  const map = {};
  snap.docs.forEach((d) => {
    map[d.id] = d.data()?.name || '';
  });
  return map;
}

// ── One member's closing list (pending/partial/paid), as PAYER ──────────
export async function getMemberClosingList(basePath, programId, memberId, groupMap = {}) {
  const snap = await adminDb
    .collection(`${basePath}programs/${programId}/payment_pending`)
    .where('memberId', '==', memberId)
    .where('delete_flag', '==', false)
    .get();

  let pendingCount = 0, paidCount = 0, partialCount = 0;
  let pendingAmount = 0, paidAmount = 0;

  const closings = snap.docs.map((d) => {
    const p = d.data();
    const status = p.status || 'pending';
    const amount = Number(p.payAmount || 0);
    const paid = Number(p.paidAmount || 0);

    if (status === 'paid') {
      paidCount++;
      paidAmount += paid || amount;
    } else if (status === 'partial') {
      partialCount++;
      paidAmount += paid;
      pendingAmount += Math.max(0, amount - paid);
    } else {
      pendingCount++;
      pendingAmount += amount;
    }

    return {
      id: d.id,
      status,
      amount,
      paidAmount: paid,
      closingMemberId: p.closingMemberId || null,
      closingMemberName: p.closingMemberName || '',
      closingRegNo: p.closingRegNo || 'NA',
      closingFatherName: p.closingFatherName || 'NA',
      closingVillage: p.village || 'NA',
      closingDate: p.closing_date || '',
      paymentFor: p.paymentFor || 'Marriage Case',
      closingGroupId: p.closingGroupId || null,
      closingGroupName: (p.closingGroupId && groupMap[p.closingGroupId]) || p.closingGroupName || null,
      paymentMethod: p.paymentMethod || null,
      onlineReference: p.onlineReference || null,
      dueDate: p.dueDate || '',
      createdDate: p.createdDate || '',
    };
  });

  const statusOrder = { pending: 0, partial: 1, paid: 2 };
  closings.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    }
    return new Date(b.createdDate || 0) - new Date(a.createdDate || 0);
  });

  return {
    closings,
    summary: {
      total: closings.length,
      pendingCount,
      paidCount,
      partialCount,
      pendingAmount,
      paidAmount,
      totalAmount: pendingAmount + paidAmount,
    },
  };
}

// ── One member's paid transaction history, as PAYER ──────────────────────
export async function getMemberTransactions(basePath, programId, memberId) {
  const snap = await adminDb
    .collection(`${basePath}programs/${programId}/transactions`)
    .where('payerId', '==', memberId)
    .where('active_flag', '==', true)
    .where('delete_flag', '==', false)
    .get();

  const list = snap.docs.map((d) => {
    const t = d.data();
    return {
      id: d.id,
      transactionNumber: t.transactionNumber || '',
      amount: Number(t.amount || 0),
      paymentDate: t.paymentDate || '',
      paymentMethod: t.paymentMethod || '',
      onlineReference: t.onlineReference || null,
      closingMemberName: t.closingMemberName || t.marriageMemberName || '',
      closingMemberRegistrationNumber: t.closingMemberRegistrationNumber || t.marriageRegistrationNumber || '',
      createdAt: t.createdAt || null,
    };
  });

  list.sort((a, b) => {
    const diff = toMillis(b.createdAt) - toMillis(a.createdAt);
    if (diff !== 0) return diff;
    return new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0);
  });

  return list;
}

// ── Combined closings + transactions for one member ──────────────────────
export async function getMemberFullClosingStatus(basePath, programId, memberId, groupMap) {
  const gMap = groupMap || (await getClosingGroupMap(basePath, programId));
  const [{ closings, summary }, transactions] = await Promise.all([
    getMemberClosingList(basePath, programId, memberId, gMap),
    getMemberTransactions(basePath, programId, memberId),
  ]);
  return {
    closings,
    summary,
    transactions,
    transactionsSummary: {
      count: transactions.length,
      totalPaid: transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    },
  };
}

// ── Every member record sharing a phone number in ONE program, each
//    enriched with closings + transactions, plus an aggregate summary.
//    `currentUid` (if it matches a record) gets `isSelf: true`, and self
//    is sorted first.
export async function getProgramFamilyClosingStatus(basePath, programId, phone, currentUid) {
  const empty = {
    members: [],
    aggregateSummary: emptySummary(),
    aggregateTransactionsSummary: { count: 0, totalPaid: 0 },
  };
  if (!basePath || !programId || !phone) return empty;

  const snap = await adminDb
    .collection(`${basePath}programs/${programId}/members`)
    .where('phone', '==', phone)
    .where('delete_flag', '==', false)
    .get();

  const rawMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (rawMembers.length === 0) return empty;

  const groupMap = await getClosingGroupMap(basePath, programId);

  const enriched = await Promise.all(
    rawMembers.map(async (m) => {
      const status = await getMemberFullClosingStatus(basePath, programId, m.id, groupMap);
      return { ...m, isSelf: !!currentUid && m.id === currentUid, ...status };
    })
  );

  enriched.sort((a, b) => (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0));

  const aggregateSummary = enriched.reduce(
    (acc, m) => ({
      total: acc.total + m.summary.total,
      pendingCount: acc.pendingCount + m.summary.pendingCount,
      paidCount: acc.paidCount + m.summary.paidCount,
      partialCount: acc.partialCount + m.summary.partialCount,
      pendingAmount: acc.pendingAmount + m.summary.pendingAmount,
      paidAmount: acc.paidAmount + m.summary.paidAmount,
      totalAmount: acc.totalAmount + m.summary.totalAmount,
    }),
    emptySummary()
  );

  const aggregateTransactionsSummary = enriched.reduce(
    (acc, m) => ({
      count: acc.count + m.transactionsSummary.count,
      totalPaid: acc.totalPaid + m.transactionsSummary.totalPaid,
    }),
    { count: 0, totalPaid: 0 }
  );

  return { members: enriched, aggregateSummary, aggregateTransactionsSummary };
}

// ── Which programs (under this trust) actually contain a member record
//    for this phone number, with a per-program count. Used both to
//    restrict "select program" pickers and to validate ?programId= on
//    incoming requests.
export async function getMemberProgramsWithPhoneCounts(basePath, phone) {
  if (!basePath || !phone) return [];

  const programsSnap = await adminDb.collection(`${basePath}programs`).get();
  const programs = programsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const withCounts = await Promise.all(
    programs.map(async (p) => {
      const snap = await adminDb
        .collection(`${basePath}programs/${p.id}/members`)
        .where('phone', '==', phone)
        .where('delete_flag', '==', false)
        .get();
      return { ...p, phoneMemberCount: snap.size };
    })
  );

  return withCounts.filter((p) => p.phoneMemberCount > 0);
}

// ── Program-wide overview counts — the SAME numbers the agent app's Home
//    screen shows (active/inactive members from the program doc's own
//    `memberCount` / `inactivemembercount` fields, plus a live count of
//    "closing"/married members). Computed via the Admin SDK so it works
//    regardless of the member-facing Firestore security rules (a member's
//    client can't necessarily run an aggregate query across the whole
//    members collection, only the admin server can be trusted to).
export async function getProgramOverviewCounts(basePath, programId) {
  if (!basePath || !programId) {
    return { activeMembersCount: 0, inactiveMembersCount: 0, closingMembersCount: 0 };
  }

  const [programSnap, closingCountSnap] = await Promise.all([
    adminDb.doc(`${basePath}programs/${programId}`).get(),
    adminDb
      .collection(`${basePath}programs/${programId}/members`)
      .where('status', '==', 'accepted')
      .where('active_flag', '==', true)
      .where('marriage_flag', '==', true)
      .count()
      .get(),
  ]);

  const programData = programSnap.exists ? programSnap.data() : {};

  return {
    activeMembersCount: programData.memberCount || 0,
    inactiveMembersCount: programData.inactivemembercount || 0,
    closingMembersCount: closingCountSnap.data().count || 0,
  };
}

// ── Shared request bootstrap for all 3 member-facing routes ─────────────
// Verifies the token, resolves basePath/home program/phone from the
// member's own account, validates any requested ?programId= actually
// belongs to this member's phone, and returns a ready-to-use context.
// On any failure, `error` is a NextResponse you should return immediately.
export async function resolveMemberRequest(request) {
  const { uid: authUid, claims, error: authError } = await verifyToken(request);
  if (authError) {
    return { error: NextResponse.json({ error: authError }, { status: 401 }) };
  }

  const createdBy = claims?.createdBy;
  const homeProgramId = claims?.programId;

  if (!createdBy || !homeProgramId) {
    return {
      error: NextResponse.json(
        { error: 'Member token missing createdBy/programId claims' },
        { status: 400 }
      ),
    };
  }

  const basePath = `users/${createdBy}/`;

  // IMPORTANT: the member's Firestore document id (under
  // programs/{programId}/members/{id}) is stored in the `user_id` custom
  // claim set when the member's Firebase account was created — it is NOT
  // guaranteed to equal the Firebase Auth uid. The mobile app's own
  // sign-in code (lib/ctx.tsx) already relies on `user_id` for this same
  // reason. Using the raw Auth uid here would 404 for any member whose
  // ids differ, so `uid` from this point on means "the correct Firestore
  // member doc id", with `authUid` kept only for reference/logging.
  const uid = claims?.user_id || authUid;

  const homeProfile = await getMemberOwnProfile(basePath, homeProgramId, uid);
  if (!homeProfile) {
    return { error: NextResponse.json({ error: 'Member profile not found' }, { status: 404 }) };
  }
  if (!homeProfile.phone) {
    return { error: NextResponse.json({ error: 'Member has no phone number on file' }, { status: 400 }) };
  }

  const { searchParams } = new URL(request.url);
  const requestedProgramId = searchParams.get('programId') || homeProgramId;

  // Security check: don't let a member pull data from a program their
  // phone number has no record in.
  let programId = homeProgramId;
  if (requestedProgramId === homeProgramId) {
    programId = homeProgramId;
  } else {
    const allowedPrograms = await getMemberProgramsWithPhoneCounts(basePath, homeProfile.phone);
    const allowed = allowedPrograms.find((p) => p.id === requestedProgramId);
    if (!allowed) {
      return {
        error: NextResponse.json(
          { error: 'You do not have access to this program' },
          { status: 403 }
        ),
      };
    }
    programId = requestedProgramId;
  }

  return { uid, authUid, basePath, homeProgramId, programId, phone: homeProfile.phone, homeProfile };
}