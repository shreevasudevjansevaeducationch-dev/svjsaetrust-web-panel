// app/api/member/search-by-phone/route.js
// Search members by phone number. If multiple members share the same phone
// (duplicates), return ALL of them — each with their own closing list
// (pending + paid, group-name enriched) and their own paid transactions.
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

// Firestore 'in' queries are capped at 30 values — chunk member ids.
const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function GET(request) {
  try {
    // 1. Auth
    const { uid, error: authError } = await verifyToken(request);
    if (authError) return NextResponse.json({ error: authError }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const phone = searchParams.get('phone')?.trim();

    if (!programId || !phone) {
      return NextResponse.json({ error: 'programId and phone required' }, { status: 400 });
    }

    const basePath = `users/${uid}/programs/${programId}`;

    // 2. Find every member doc with this phone (duplicates included)
    const membersSnap = await adminDb.collection(`${basePath}/members`)
      .where('phone', '==', phone)
      .where('delete_flag', '==', false)
      .get();

    if (membersSnap.empty) {
      return NextResponse.json({
        phone,
        totalMatched: 0,
        isDuplicate: false,
        members: [],
      });
    }

    const memberIds = membersSnap.docs.map((d) => d.id);
    const idChunks = chunkArray(memberIds, 30);

    // 3. Parallel fetch — closings (pending+paid) + paid transactions + group names
    //    for ALL matched member ids in one shot
    const [pendingSnaps, txSnaps, groupsSnap] = await Promise.all([
      Promise.all(idChunks.map((chunk) =>
        adminDb.collection(`${basePath}/payment_pending`)
          .where('memberId', 'in', chunk)
          .where('delete_flag', '==', false)
          .get()
      )),
      Promise.all(idChunks.map((chunk) =>
        adminDb.collection(`${basePath}/transactions`)
          .where('payerId', 'in', chunk)
          .where('status', '==', 'completed')
          .where('delete_flag', '==', false)
          .get()
      )),
      adminDb.collection(`${basePath}/closing_groups`).get(),
    ]);

    const groupMap = {};
    groupsSnap.docs.forEach((d) => {
      groupMap[d.id] = d.data().name || '';
    });

    // 3b. payment_pending docs don't reliably carry closing-member name/reg/
    // father/village/phone (those flat fields are basically never written by
    // the actual write path — only `closingMemberId` + `paymentFor` are).
    // So batch-fetch the real closing member docs across ALL matched
    // members' pending docs and join them in.
    const allPendingDocs = pendingSnaps.flatMap((snap) => snap.docs);
    const closingMemberIds = [
      ...new Set(allPendingDocs.map((d) => d.data().closingMemberId).filter(Boolean)),
    ];
    const closingMemberSnaps = closingMemberIds.length
      ? await Promise.all(closingMemberIds.map((id) => adminDb.doc(`${basePath}/members/${id}`).get()))
      : [];
    const closingMemberMap = {};
    closingMemberSnaps.forEach((s) => {
      if (s.exists) closingMemberMap[s.id] = { id: s.id, ...s.data() };
    });

    // 4. Group closings by memberId
    const closingsByMember = {};
    for (const d of allPendingDocs) {
      const p = d.data();
      const cm = closingMemberMap[p.closingMemberId] || {};
      const key = p.memberId;
      if (!closingsByMember[key]) closingsByMember[key] = [];
      closingsByMember[key].push({
        id: d.id,
        status: p.status || 'pending',
        amount: Number(p.payAmount || 0),
        paidAmount: Number(p.paidAmount || 0),
        closingMemberId: p.closingMemberId || null,
        // Name resolution order: live member doc -> paymentFor (the field
        // actually written at closing time) -> closingMemberName (legacy) -> N/A
        closingMemberName: cm.displayName || p.paymentFor || p.closingMemberName || 'N/A',
        closingRegNo: cm.registrationNumber || p.closingRegNo || 'NA',
        closingFatherName: cm.fatherName || p.closingFatherName || 'NA',
        closingJati: cm.jati || p.jati || 'NA',
        closingVillage: cm.village || p.village || 'NA',
        closingDate: p.closing_date || cm.closing_date || cm.marriage_date || '',
        paymentFor: p.paymentFor || cm.displayName || 'Marriage Case',
        closingGroupId: p.closingGroupId || null,
        closingGroupName: (p.closingGroupId && groupMap[p.closingGroupId]) || p.closingGroupName || null,
        createdDate: p.createdDate || '',
      });
    }

    // 5. Group PAID transactions by payerId
    const transactionsByMember = {};
    for (const snap of txSnaps) {
      for (const d of snap.docs) {
        const t = d.data();
        const key = t.payerId;
        if (!transactionsByMember[key]) transactionsByMember[key] = [];
        transactionsByMember[key].push({
          id: d.id,
          transactionNumber: t.transactionNumber || '',
          amount: Number(t.amount || 0),
          paymentDate: t.paymentDate || '',
          paymentMethod: t.paymentMethod || '',
          onlineReference: t.onlineReference || null,
          closingMemberName: t.closingMemberName || t.marriageMemberName || '',
          closingMemberRegistrationNumber:
            t.closingMemberRegistrationNumber || t.marriageRegistrationNumber || '',
          createdAt: t.createdAt || '',
        });
      }
    }

    // 6. Build one entry PER matched member document (handles same-phone duplicates)
    const members = membersSnap.docs.map((d) => {
      const m = { id: d.id, ...d.data() };
      const closings = closingsByMember[d.id] || [];
      const transactions = (transactionsByMember[d.id] || [])
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      const pendingCount = closings.filter((c) => c.status === 'pending' || c.status === 'partial').length;
      const paidCount = closings.filter((c) => c.status === 'paid').length;
      const pendingAmount = closings
        .filter((c) => c.status !== 'paid')
        .reduce((s, c) => s + Math.max(0, c.amount - c.paidAmount), 0);
      const totalTransactionsPaid = transactions.reduce((s, t) => s + t.amount, 0);

      return {
        id: m.id,
        displayName: m.displayName || '',
        fatherName: m.fatherName || '',
        phone: m.phone || '',
        registrationNumber: m.registrationNumber || '',
        payAmount: m.payAmount || 0,
        agentId: m.agentId || null,
        status: m.status || null,
        active_flag: m.active_flag,
        closings,
        closingSummary: {
          total: closings.length,
          pendingCount,
          paidCount,
          pendingAmount,
        },
        transactions,
        transactionsSummary: {
          count: transactions.length,
          totalPaid: totalTransactionsPaid,
        },
      };
    });

    return NextResponse.json({
      phone,
      totalMatched: members.length,
      isDuplicate: members.length > 1, // true => same phone matched multiple members
      members,
    });
  } catch (err) {
    console.error('[member/search-by-phone]', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
