// ============================================================================
// PUT THIS FILE AT:  app/api/member/home/route.js
// ============================================================================
//
// Member Home Dashboard API.
// Call: GET /api/member/home?programId=<optional>
// Header: Authorization: Bearer <member's Firebase ID token>
//
// If ?programId is omitted, uses the member's own (home) program from their
// token claims. If provided, it must be a program where this member's phone
// number actually has a record (checked in resolveMemberRequest) — otherwise
// this returns 403.

import { NextResponse } from 'next/server';
import {
  getMemberProgramsWithPhoneCounts,
  getProgramFamilyClosingStatus,
  getProgramOverviewCounts,
  resolveMemberRequest,
} from '../../_lib/memberFamily';

export async function GET(request) {
  try {
    const ctx = await resolveMemberRequest(request);
    if (ctx.error) return ctx.error;

    const { basePath, programId, phone, uid, homeProfile } = ctx;

    const [{ members, aggregateSummary, aggregateTransactionsSummary }, programs, programOverview] = await Promise.all([
      getProgramFamilyClosingStatus(basePath, programId, phone, uid),
      getMemberProgramsWithPhoneCounts(basePath, phone),
      getProgramOverviewCounts(basePath, programId),
    ]);

    // Member-level breakdown (not closing-item level): how many linked
    // members still owe something vs how many are fully cleared.
    const pendingMembersCount = members.filter(
      (m) => m.summary.pendingCount > 0 || m.summary.partialCount > 0
    ).length;
    const paidMembersCount = members.filter(
      (m) => m.summary.pendingCount === 0 && m.summary.partialCount === 0 && m.summary.paidCount > 0
    ).length;

    // Pending closings preview across every linked member (max 2, caller
    // can request the rest via /api/member/closing-list).
    const combinedClosings = members
      .flatMap((m) =>
        (m.closings || []).map((c) => ({
          ...c,
          ownerId: m.id,
          ownerName: m.isSelf ? 'You' : m.displayName || 'Member',
        }))
      )
      .filter((c) => c.status !== 'paid');

    const statusOrder = { pending: 0, partial: 1 };
    combinedClosings.sort((a, b) => (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2));

    // Recent payments preview (max 2) across every linked member.
    const combinedTxns = members.flatMap((m) =>
      (m.transactions || []).map((t) => ({
        ...t,
        ownerId: m.id,
        ownerName: m.isSelf ? 'You' : m.displayName || 'Member',
      }))
    );
    combinedTxns.sort((a, b) => {
      const at = a.createdAt?._seconds ? a.createdAt._seconds * 1000 : 0;
      const bt = b.createdAt?._seconds ? b.createdAt._seconds * 1000 : 0;
      return bt - at;
    });

    return NextResponse.json({
      identity: {
        id: homeProfile.id,
        displayName: homeProfile.displayName || '',
        photoURL: homeProfile.photoURL || null,
        registrationNumber: homeProfile.registrationNumber || '',
        phone: homeProfile.phone || '',
        status: homeProfile.status || null,
        active_flag: homeProfile.active_flag,
      },
      programId,
      programs, // every program this phone is linked to, with phoneMemberCount
      programOverview, // { activeMembersCount, inactiveMembersCount, closingMembersCount } — program-wide, same numbers the agent Home screen shows
      linkedMembersCount: members.length,
      aggregateSummary, // { total, pendingCount, paidCount, partialCount, pendingAmount, paidAmount, totalAmount }
      aggregateTransactionsSummary, // { count, totalPaid }
      memberStatusBreakdown: { pendingMembersCount, paidMembersCount },
      pendingClosingsPreview: combinedClosings.slice(0, 2),
      pendingClosingsTotal: combinedClosings.length,
      recentPaymentsPreview: combinedTxns.slice(0, 2),
      members: members.map((m) => ({
        id: m.id,
        isSelf: m.isSelf,
        displayName: m.displayName || '',
        fatherName: m.fatherName || '',
        registrationNumber: m.registrationNumber || '',
        phone: m.phone || '',
        village: m.village || '',
        photoURL: m.photoURL || null,
        status: m.status || null,
        active_flag: m.active_flag,
        summary: m.summary,
        transactionsSummary: m.transactionsSummary,
      })),
    });
  } catch (err) {
    console.error('[member/home]', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}