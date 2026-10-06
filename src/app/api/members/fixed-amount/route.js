// app/api/members/fixed-amount/route.js
//
// Fixed-amount members: report how much of the fixed amount is paid and, when
// it is fully paid, clear the member's leftover pending closing entries
// (see app/api/_lib/fixedAmount.js for the rule).
//
// POST /api/members/fixed-amount
// Header: Authorization: Bearer <admin's Firebase ID token>
// Body:   { programId, memberIds: [id, ...], dryRun?: boolean }
//   dryRun true  -> only returns the status of each member, writes nothing
//   dryRun false -> also archives / restores pending entries as needed
// Response: { results: [{ memberId, found, isFixed, fixedAmount, paid,
//                         remaining, completed, archived, restored, failed }] }
import { NextResponse } from 'next/server';
import admin from '../../admin';
import { syncFixedMembers } from '../../_lib/fixedAmount';

export const runtime = 'nodejs';

const adminAuth = admin.auth();

const MAX_MEMBERS = 300;

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

const isId = (v) => typeof v === 'string' && v.length > 0 && !v.includes('/');

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

    const { programId, memberIds, dryRun } = body || {};
    if (!isId(programId)) {
      return NextResponse.json({ error: 'programId required' }, { status: 400 });
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0 || !memberIds.every(isId)) {
      return NextResponse.json({ error: 'memberIds must be a non-empty array of ids' }, { status: 400 });
    }
    if (memberIds.length > MAX_MEMBERS) {
      return NextResponse.json({ error: `At most ${MAX_MEMBERS} members per request` }, { status: 400 });
    }

    const basePath = `users/${uid}/programs/${programId}`;
    const results = await syncFixedMembers(basePath, memberIds, { dryRun: dryRun === true });

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[members/fixed-amount]', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
