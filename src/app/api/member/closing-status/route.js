// app/api/member/closing-status/route.js
// Fetch a single member's closing details — pending + paid + group name + all.
import { NextResponse } from 'next/server';
import admin from '../../admin';

const adminDb = admin.firestore();
const adminAuth = admin.auth();

// ── Token verify ───────────────────────────────────────────────────────────
async function verifyToken(request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split('Bearer ')[1];
  if (!token) return { uid: null, error: 'Unauthorized' };
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, error: null };
  } catch {
    return { uid: null, error: 'Invalid or expired token' };
  }
}

export async function GET(request) {
  try {
    // 1. Auth
    const { uid, error: authError } = await verifyToken(request);
    if (authError) return NextResponse.json({ error: authError }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const memberId = searchParams.get('memberId');

    if (!programId || !memberId) {
      return NextResponse.json({ error: 'programId and memberId required' }, { status: 400 });
    }

    const basePath = `users/${uid}/programs/${programId}`;

    // 2. Parallel fetch — member doc + all their closings + closing groups (for names)
    const [memberSnap, pendingSnap, groupsSnap] = await Promise.all([
      adminDb.doc(`${basePath}/members/${memberId}`).get(),

      adminDb.collection(`${basePath}/payment_pending`)
        .where('memberId', '==', memberId)
        .where('delete_flag', '==', false)
        .get(),

      adminDb.collection(`${basePath}/closing_groups`).get(),
    ]);

    if (!memberSnap.exists) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const member = { id: memberSnap.id, ...memberSnap.data() };

    // 3. Group id -> name map
    const groupMap = {};
    groupsSnap.docs.forEach((d) => {
      groupMap[d.id] = d.data().name || '';
    });

    // 3b. payment_pending docs don't reliably carry closing-member name/reg/
    // father/village/phone (those flat fields are basically never written by
    // the actual write path — only `closingMemberId` + `paymentFor` are).
    // So batch-fetch the real closing member docs and join them in — this is
    // the same pattern used in payments/process/route.js.
    const closingMemberIds = [
      ...new Set(pendingSnap.docs.map((d) => d.data().closingMemberId).filter(Boolean)),
    ];
    const closingMemberSnaps = closingMemberIds.length
      ? await Promise.all(closingMemberIds.map((id) => adminDb.doc(`${basePath}/members/${id}`).get()))
      : [];
    const closingMemberMap = {};
    closingMemberSnaps.forEach((s) => {
      if (s.exists) closingMemberMap[s.id] = { id: s.id, ...s.data() };
    });

    // 4. Build closings list + running totals
    let pendingCount = 0, paidCount = 0, partialCount = 0;
    let pendingAmount = 0, paidAmount = 0;

    const closings = pendingSnap.docs.map((d) => {
      const p = d.data();
      const cm = closingMemberMap[p.closingMemberId] || {};
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
        // Name resolution order: live member doc (most accurate) -> paymentFor
        // (the field actually written at closing time, used everywhere else
        // in the app) -> closingMemberName (legacy/rarely populated) -> N/A
        closingMemberName: cm.displayName || p.paymentFor || p.closingMemberName || 'N/A',
        closingRegNo: cm.registrationNumber || p.closingRegNo || 'NA',
        closingFatherName: cm.fatherName || p.closingFatherName || 'NA',
        closingJati: cm.jati || p.jati || 'NA',
        closingVillage: cm.village || p.village || 'NA',
        closingDate: p.closing_date || cm.closing_date || cm.marriage_date || '',
        paymentFor: p.paymentFor || cm.displayName || 'Marriage Case',
        closingPhone: cm.phone || p.phone || 'NA',
        closingGroupId: p.closingGroupId || null,
        closingGroupName: (p.closingGroupId && groupMap[p.closingGroupId]) || p.closingGroupName || null,
        paymentMethod: p.paymentMethod || null,
        onlineReference: p.onlineReference || null,
        transactionId: p.transactionId || null,
        createdDate: p.createdDate || '',
        updatedDate: p.updatedDate || '',
      };
    });

    // 5. Sort — pending first, then partial, then paid; newest first within each
    const statusOrder = { pending: 0, partial: 1, paid: 2 };
    closings.sort((a, b) => {
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return new Date(b.createdDate || 0) - new Date(a.createdDate || 0);
    });

    return NextResponse.json({
      member: {
        id: member.id,
        displayName: member.displayName || '',
        fatherName: member.fatherName || '',
        phone: member.phone || '',
        registrationNumber: member.registrationNumber || '',
        payAmount: member.payAmount || 0,
        agentId: member.agentId || null,
        status: member.status || null,
        active_flag: member.active_flag,
      },
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
    });
  } catch (err) {
    console.error('[member/closing-status]', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
