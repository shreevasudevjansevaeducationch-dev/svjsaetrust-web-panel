// ============================================================================
// PUT THIS FILE AT:  app/api/member/payment-history/route.js
// ============================================================================
//
// Member Payment History API — full paid-transaction breakdown, member-wise
// (self + every family member sharing the same phone in this program).
//
// Call: GET /api/member/payment-history?programId=<optional>&method=<optional>&search=<optional>
// Header: Authorization: Bearer <member's Firebase ID token>
//
// Query params (all optional):
//   programId — defaults to the member's home program; must be a program
//               their phone is actually linked to.
//   method    — 'cash' | 'online' to filter each member's transaction list
//               before it's returned (aggregate totals in the response
//               always reflect the UNFILTERED totals).
//   search    — case-insensitive match against TRX number, beneficiary
//               name/reg no, or online reference.

import { NextResponse } from 'next/server';
import { getProgramFamilyClosingStatus, resolveMemberRequest } from '../../_lib/memberFamily';

function filterTxns(list, search, method) {
  const sl = (search || '').toLowerCase();
  return list.filter((t) => {
    const matchesSearch =
      !sl ||
      t.transactionNumber?.toLowerCase().includes(sl) ||
      t.closingMemberName?.toLowerCase().includes(sl) ||
      t.closingMemberRegistrationNumber?.toLowerCase().includes(sl) ||
      t.onlineReference?.toLowerCase().includes(sl);
    const matchesMethod = !method || method === 'all' || t.paymentMethod === method;
    return matchesSearch && matchesMethod;
  });
}

export async function GET(request) {
  try {
    const ctx = await resolveMemberRequest(request);
    if (ctx.error) return ctx.error;

    const { basePath, programId, phone, uid } = ctx;
    const { searchParams } = new URL(request.url);
    const method = searchParams.get('method') || 'all';
    const search = searchParams.get('search') || '';

    const { members, aggregateTransactionsSummary } = await getProgramFamilyClosingStatus(
      basePath,
      programId,
      phone,
      uid
    );

    const allTxnsUnfiltered = members.flatMap((m) => m.transactions || []);
    const cashCount = allTxnsUnfiltered.filter((t) => t.paymentMethod === 'cash').length;
    const onlineCount = allTxnsUnfiltered.filter((t) => t.paymentMethod === 'online').length;

    const membersOut = members.map((m) => {
      const filtered = filterTxns(m.transactions || [], search, method);
      return {
        id: m.id,
        isSelf: m.isSelf,
        displayName: m.displayName || '',
        registrationNumber: m.registrationNumber || '',
        phone: m.phone || '',
        photoURL: m.photoURL || null,
        transactionsSummary: m.transactionsSummary, // this member's OWN unfiltered totals
        transactions: filtered, // filtered by ?method / ?search
      };
    });

    const totalFilteredCount = membersOut.reduce((s, m) => s + m.transactions.length, 0);

    return NextResponse.json({
      programId,
      aggregateTransactionsSummary, // unfiltered totals across every linked member
      cashCount,
      onlineCount,
      totalMembers: membersOut.length,
      totalFilteredCount,
      members: membersOut,
    });
  } catch (err) {
    console.error('[member/payment-history]', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}