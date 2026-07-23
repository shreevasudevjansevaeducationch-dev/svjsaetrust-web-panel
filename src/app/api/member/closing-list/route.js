// ============================================================================
// PUT THIS FILE AT:  app/api/member/closing-list/route.js
// ============================================================================
//
// Member Closing List API — full pending/partial/paid closing breakdown,
// member-wise (self + every family member sharing the same phone in this
// program).
//
// Call: GET /api/member/closing-list?programId=<optional>&status=<optional>&search=<optional>
// Header: Authorization: Bearer <member's Firebase ID token>
//
// Query params (all optional):
//   programId — defaults to the member's home program; must be a program
//               their phone is actually linked to.
//   status    — 'pending' | 'partial' | 'paid' to filter each member's
//               closing list before it's returned (aggregate counts in the
//               response always reflect the UNFILTERED totals).
//   search    — case-insensitive match against closing member name, reg no,
//               payment reason, or closing group name.

import { NextResponse } from 'next/server';
import { getProgramFamilyClosingStatus, resolveMemberRequest } from '../../_lib/memberFamily';

function filterClosings(list, search, status) {
  const sl = (search || '').toLowerCase();
  return list.filter((c) => {
    const matchesSearch =
      !sl ||
      c.closingMemberName?.toLowerCase().includes(sl) ||
      c.closingRegNo?.toLowerCase().includes(sl) ||
      c.paymentFor?.toLowerCase().includes(sl) ||
      c.closingGroupName?.toLowerCase().includes(sl);
    const matchesStatus = !status || status === 'all' || c.status === status;
    return matchesSearch && matchesStatus;
  });
}

export async function GET(request) {
  try {
    const ctx = await resolveMemberRequest(request);
    if (ctx.error) return ctx.error;

    const { basePath, programId, phone, uid } = ctx;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    const { members, aggregateSummary } = await getProgramFamilyClosingStatus(basePath, programId, phone, uid);

    const membersOut = members.map((m) => {
      const filtered = filterClosings(m.closings || [], search, status);
      return {
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
        summary: m.summary, // this member's OWN unfiltered totals
        closings: filtered, // filtered by ?status / ?search
      };
    });

    const totalFilteredCount = membersOut.reduce((s, m) => s + m.closings.length, 0);

    return NextResponse.json({
      programId,
      aggregateSummary, // unfiltered totals across every linked member
      totalMembers: membersOut.length,
      totalFilteredCount,
      members: membersOut,
    });
  } catch (err) {
    console.error('[member/closing-list]', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}