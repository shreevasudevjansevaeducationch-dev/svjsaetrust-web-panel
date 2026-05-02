// app/api/payments/process/route.js
import { NextResponse } from 'next/server';
import admin from '../../admin';

const adminDb = admin.firestore();
const adminAuth = admin.auth();

// ═══════════════════════════════════════════════════════════════════════════
// SMART BATCH
// ═══════════════════════════════════════════════════════════════════════════
class SmartBatch {
  constructor(db) {
    this.db      = db;
    this.batch   = db.batch();
    this.ops     = 0;
    this.commits = [];
  }
  set(ref, data) {
    this.batch.set(ref, data);
    this._maybeFlush();
  }
  update(ref, data) {
    this.batch.update(ref, data);
    this._maybeFlush();
  }
  _maybeFlush() {
    this.ops++;
    if (this.ops >= 480) {
      this.commits.push(this.batch.commit());
      this.batch = this.db.batch();
      this.ops   = 0;
    }
  }
  async commit() {
    if (this.ops > 0) this.commits.push(this.batch.commit());
    return Promise.all(this.commits);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
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

function createSearchIndex(words) {
  const tokens = new Set();
  for (const w of words) {
    if (!w) continue;
    const s = w.toLowerCase().trim();
    for (let i = 1; i <= s.length; i++) tokens.add(s.slice(0, i));
  }
  return [...tokens];
}

async function isDuplicateRef(uid, programId, ref) {
  const snap = await adminDb
    .collection(`users/${uid}/programs/${programId}/transactions`)
    .where('onlineReference', '==', ref)
    .where('delete_flag', '==', false)
    .limit(1)
    .get();
  return !snap.empty;
}

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function batchGetDocs(basePath, col, ids) {
  if (!ids.length) return {};
  const snaps = await Promise.all(
    ids.map((id) => adminDb.doc(`${basePath}/${col}/${id}`).get())
  );
  const map = {};
  for (const s of snaps) {
    if (s.exists) map[s.id] = { id: s.id, ...s.data() };
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════
export async function POST(request) {
  try {
    const { uid, error: authError } = await verifyToken(request);
    if (authError) return NextResponse.json({ error: authError }, { status: 401 });

    const body = await request.json();

    if (body.type === 'single') return processSinglePayment(uid, body);
    if (body.type === 'bulk')   return processBulkPayment(uid, body);

    return NextResponse.json({ error: 'Invalid type. Use "single" or "bulk"' }, { status: 400 });
  } catch (err) {
    console.error('[payments/process]', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE PAYMENT
// ═══════════════════════════════════════════════════════════════════════════
async function processSinglePayment(uid, body) {
  const {
    programId, programName,
    payerId, selectedClosingIds,
    paymentMethod, paymentDate, note,
    onlineReference, perClosingAmount, customTotalAmount,
  } = body;

  if (!programId || !payerId || !selectedClosingIds?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const basePath = `users/${uid}/programs/${programId}`;

  const [memberSnap, closingMap, pendingSnap, dupCheck] = await Promise.all([
    adminDb.doc(`${basePath}/members/${payerId}`).get(),
    batchGetDocs(basePath, 'members', selectedClosingIds),
    // Only filter by memberId — JS mein status/delete_flag filter karenge
    adminDb.collection(`${basePath}/payment_pending`)
      .where('memberId', '==', payerId)
      .get(),
    paymentMethod === 'online' && onlineReference
      ? isDuplicateRef(uid, programId, onlineReference)
      : Promise.resolve(false),
  ]);

  if (!memberSnap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  if (dupCheck) return NextResponse.json({ error: 'Duplicate reference number' }, { status: 409 });

  const member = { id: memberSnap.id, ...memberSnap.data() };

  // JS mein filter — delete_flag field absent ho tab bhi kaam karega
  const pendingEntries = pendingSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.delete_flag !== true); // absent = treat as false

  const pendingMap = {};
  for (const p of pendingEntries) {
    const key = p.closingMemberId || p.marriageId;
    if (key) pendingMap[key] = p;
  }

  const resolvedPerClosing = Number(perClosingAmount) || Number(member.payAmount) || 200;
  const totalAmount        = Number(customTotalAmount) || selectedClosingIds.length * resolvedPerClosing;

  const distributions = [];
  let remaining = totalAmount;

  for (const closingId of selectedClosingIds) {
    if (remaining <= 0) break;
    const pay = Math.min(remaining, resolvedPerClosing);
    distributions.push({ closingId, amount: pay, isFullPayment: pay >= resolvedPerClosing });
    remaining -= pay;
  }

  const timestamp = Date.now();
  const batchId   = Math.random().toString(36).substr(2, 6).toUpperCase();
  const sb        = new SmartBatch(adminDb);
  let seq         = 0;

  for (const dist of distributions) {
    seq++;
    const closing      = closingMap[dist.closingId] || {};
    const pendingEntry = pendingMap[dist.closingId];
    const txNum        = `TRX-${timestamp}-${batchId}-${String(seq).padStart(3, '0')}`;
    const txRef        = adminDb.collection(`${basePath}/transactions`).doc();

    sb.set(txRef, {
      amount:                           dist.amount,
      paymentMethod,
      paymentDate,
      note:                             note || '',
      status:                           'completed',
      createdAt:                        new Date().toISOString(),
      updatedAt:                        new Date().toISOString(),
      programId,
      programName,
      payerId:                          member.id,
      payerName:                        member.displayName || '',
      payerFatherName:                  member.fatherName || '',
      payerRegistrationNumber:          member.registrationNumber || '',
      payerPhone:                       member.phone || '',
      payerPhoto:                       member.photoURL || '',
      marriageId:                       dist.closingId,
      closingMemberId:                  dist.closingId,
      closingMemberName:                closing.displayName || '',
      marriageMemberName:               closing.displayName || '',
      closingMemberFatherName:          closing.fatherName || '',
      closingMemberRegistrationNumber:  closing.registrationNumber || '',
      marriageRegistrationNumber:       closing.registrationNumber || '',
      marriageDate:                     closing.marriage_date || closing.closingAt || '',
      paymentPendingId:                 pendingEntry?.id || '',
      isFullPayment:                    dist.isFullPayment,
      originalClosingAmount:            resolvedPerClosing,
      createdBy:                        uid,
      active_flag:                      true,
      delete_flag:                      false,
      transactionType:                  'marriage_payment',
      transactionNumber:                txNum,
      batchId:                          `BATCH-${batchId}`,
      sequenceNumber:                   seq,
      search_keywords:                  createSearchIndex([
        member.displayName, member.registrationNumber,
        closing.displayName, closing.registrationNumber,
        programName, txNum, onlineReference || '',
      ]),
      ...(paymentMethod === 'online' && onlineReference
        ? { onlineReference, onlineVerified: false } : {}),
    });

    if (pendingEntry) {
      sb.update(adminDb.doc(`${basePath}/payment_pending/${pendingEntry.id}`), {
        status:        dist.isFullPayment ? 'paid' : 'partial',
        paymentDate:   new Date().toISOString(),
        transactionId: txRef.id,
        updatedAt:     new Date().toISOString(),
        paidAmount:    dist.amount,
        paymentMethod,
        ...(paymentMethod === 'online' && onlineReference ? { onlineReference } : {}),
      });
    }
  }

  await sb.commit();

  return NextResponse.json({
    success:   true,
    processed: distributions.length,
    totalPaid: totalAmount - remaining,
    fullyPaid: distributions.filter((d) => d.isFullPayment).length,
    remaining,
    batchId:   `BATCH-${batchId}`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK PAYMENT
// ROOT CAUSE FIX:
// Firestore mein composite index nahi tha ya delete_flag field absent thi
// Isliye .where('status','==','pending').where('delete_flag','==',false)
// = 0 results deta tha
// FIX: Sirf memberId se query karo, baaki JS mein filter karo
// ═══════════════════════════════════════════════════════════════════════════
async function processBulkPayment(uid, body) {
  const {
    programId, programName,
    memberIds, globalAmount,
    paymentMethod, paymentDate, note,
    onlineReference,
  } = body;

  if (!programId || !memberIds?.length || !globalAmount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const basePath     = `users/${uid}/programs/${programId}`;
  const memberChunks = chunkArray(memberIds, 30);

  // ─── ONE parallel round ───────────────────────────────────────────────────
  const parallelTasks = [
    Promise.all(memberIds.map((id) => adminDb.doc(`${basePath}/members/${id}`).get())),

    paymentMethod === 'online' && onlineReference
      ? isDuplicateRef(uid, programId, onlineReference)
      : Promise.resolve(false),

    // ✅ KEY FIX: Sirf memberId filter — NO status, NO delete_flag in query
    // Composite index ki zaroorat nahi, aur absent fields se crash nahi
    ...memberChunks.map((ch) =>
      adminDb.collection(`${basePath}/payment_pending`)
        .where('memberId', 'in', ch)
        .get()
    ),
  ];

  const [memberSnaps, dupCheck, ...pendingSnapChunks] = await Promise.all(parallelTasks);

  if (dupCheck) return NextResponse.json({ error: 'Duplicate reference number' }, { status: 409 });

  const members = memberSnaps
    .filter((s) => s.exists)
    .map((s) => ({ id: s.id, ...s.data() }));

  // ✅ JS mein filter — delete_flag absent ho toh bhi pending treat karo
  const allPending = pendingSnapChunks
    .flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    .filter((p) => {
      const notDeleted = p.delete_flag !== true;     // absent = false = include
      const isPending  = !p.status || p.status === 'pending'; // absent ya 'pending' = include
      return notDeleted && isPending;
    });

  console.log(`[bulk] members: ${members.length}, pending after JS filter: ${allPending.length}`);
  console.log(`[bulk] sample pending:`, allPending.slice(0, 3).map(p => ({
    id: p.id, memberId: p.memberId, status: p.status, delete_flag: p.delete_flag
  })));

  // ─── Pre-group by memberId ────────────────────────────────────────────────
  const pendingByMember = {};
  for (const p of allPending) {
    if (!pendingByMember[p.memberId]) pendingByMember[p.memberId] = [];
    pendingByMember[p.memberId].push(p);
  }

  // ─── Waterfall allocation ─────────────────────────────────────────────────
  const sortedMembers = [...members].sort((a, b) =>
    (pendingByMember[b.id]?.length || 0) - (pendingByMember[a.id]?.length || 0)
  );

  let remainingGlobal = Number(globalAmount);
  const memberPayments = [];

  for (const member of sortedMembers) {
    if (remainingGlobal <= 0) break;

    const payAmount  = Number(member.payAmount) > 0 ? Number(member.payAmount) : 200;
    const memberPend = pendingByMember[member.id] || [];

    if (!memberPend.length) continue;

    const maxCanPay     = Math.min(remainingGlobal, memberPend.length * payAmount);
    const closingsToPay = Math.floor(maxCanPay / payAmount);
    const actualAmount  = closingsToPay * payAmount;

    console.log(`[bulk] ${member.displayName}: payAmount=${payAmount}, pending=${memberPend.length}, paying=${actualAmount}`);

    if (actualAmount > 0) {
      memberPayments.push({
        member,
        closings:    memberPend.slice(0, closingsToPay),
        amountToPay: actualAmount,
      });
      remainingGlobal -= actualAmount;
    }
  }

  if (!memberPayments.length) {
    return NextResponse.json({
      error: 'No pending closings found for selected members',
      debug: {
        globalAmount,
        membersFound:        members.length,
        pendingEntriesFound: allPending.length,
        memberDetails: sortedMembers.map(m => ({
          id:           m.id,
          name:         m.displayName,
          payAmount:    m.payAmount,
          pendingCount: pendingByMember[m.id]?.length || 0,
        })),
      }
    }, { status: 400 });
  }

  // ─── Batch-fetch closing member details ───────────────────────────────────
  const closingMemberIds = [
    ...new Set(
      memberPayments.flatMap((mp) =>
        mp.closings.map((c) => c.closingMemberId || c.marriageId).filter(Boolean)
      )
    ),
  ];

  const closingMemberMap = await batchGetDocs(basePath, 'members', closingMemberIds);

  // ─── SmartBatch write ─────────────────────────────────────────────────────
  const timestamp = Date.now();
  const batchId   = Math.random().toString(36).substr(2, 6).toUpperCase();
  const sb        = new SmartBatch(adminDb);
  let globalSeq   = 0;
  let totalProc   = 0;

  for (const { member, closings, amountToPay } of memberPayments) {
    const payAmount = Number(member.payAmount) > 0 ? Number(member.payAmount) : 200;
    let remaining   = amountToPay;

    for (const closing of closings) {
      if (remaining <= 0) break;
      globalSeq++;

      const pay             = Math.min(remaining, payAmount);
      const isFull          = pay >= payAmount;
      const closingMemberId = closing.closingMemberId || closing.marriageId;
      const cm              = closingMemberMap[closingMemberId] || {};
      const txNum           = `TRX-${timestamp}-${batchId}-${String(globalSeq).padStart(3, '0')}`;
      const txRef           = adminDb.collection(`${basePath}/transactions`).doc();

      sb.set(txRef, {
        amount:                           pay,
        paymentMethod,
        paymentDate,
        note:                             note || '',
        status:                           'completed',
        createdAt:                        new Date().toISOString(),
        updatedAt:                        new Date().toISOString(),
        programId,
        programName,
        payerId:                          member.id,
        payerName:                        member.displayName || '',
        payerRegistrationNumber:          member.registrationNumber || '',
        payerFatherName:                  member.fatherName || '',
        payerPhone:                       member.phone || '',
        payerPhoto:                       member.photoURL || '',
        marriageId:                       closingMemberId,
        closingMemberId,
        closingMemberName:                cm.displayName || closing.closingMemberName || '',
        marriageMemberName:               cm.displayName || '',
        closingMemberRegistrationNumber:  cm.registrationNumber || closing.closingMemberRegistrationNumber || '',
        marriageRegistrationNumber:       cm.registrationNumber || '',
        closingMemberPhoto:               cm.photoURL || '',
        closingMemberFatherName:          cm.fatherName || '',
        marriageDate:                     cm.marriage_date || closing.marriageDate || '',
        paymentPendingId:                 closing.id,
        isFullPayment:                    isFull,
        createdBy:                        uid,
        active_flag:                      true,
        delete_flag:                      false,
        transactionType:                  'marriage_payment',
        transactionNumber:                txNum,
        batchId:                          `BATCH-${batchId}`,
        sequenceNumber:                   globalSeq,
        search_keywords:                  createSearchIndex([
          member.displayName, member.registrationNumber,
          cm.displayName, cm.registrationNumber,
          programName, txNum, onlineReference || '',
        ]),
        ...(paymentMethod === 'online' && onlineReference
          ? { onlineReference, onlineVerified: false } : {}),
      });

      sb.update(adminDb.doc(`${basePath}/payment_pending/${closing.id}`), {
        status:        isFull ? 'paid' : 'partial',
        paymentDate:   new Date().toISOString(),
        transactionId: txRef.id,
        updatedAt:     new Date().toISOString(),
        paidAmount:    pay,
        paymentMethod,
        ...(paymentMethod === 'online' && onlineReference ? { onlineReference } : {}),
      });

      remaining -= pay;
      totalProc++;
    }
  }

  await sb.commit();

  return NextResponse.json({
    success:           true,
    membersProcessed:  memberPayments.length,
    closingsProcessed: totalProc,
    totalPaid:         Number(globalAmount) - remainingGlobal,
    remaining:         remainingGlobal,
    batchId:           `BATCH-${batchId}`,
  });
}