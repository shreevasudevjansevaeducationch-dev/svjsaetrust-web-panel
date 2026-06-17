// app/api/all-payment-status/route.js
import { NextResponse } from 'next/server';
import admin from '../admin';

const adminDb = admin.firestore();
const adminAuth = admin.auth();

// ── Auth helper ───────────────────────────────────────────────────────────────
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

// ── Core data fetching logic (shared between GET & POST) ──────────────────────
async function fetchPaymentData(uid, agentId, programId, groupId = null) {
  const base = adminDb
    .collection('users')
    .doc(uid)
    .collection('programs')
    .doc(programId);

  // Build members query
  const membersQuery = base
    .collection('members')
    .where('agentId', '==', agentId)
    .where('active_flag', '==', true)
    .where('delete_flag', '==', false)
    .where('status', '==', 'accepted');

  // Build payments query
  let paymentsQuery = base
    .collection('payment_pending')
    .where('memberDetails.agentId', '==', agentId);

  if (groupId) {
    paymentsQuery = paymentsQuery.where('closingGroupId', '==', groupId);
  }

  // Execute all queries in parallel
  const [membersSnap, paymentsSnap, programSnap, groupsSnap] = await Promise.all([
    membersQuery.get(),
    paymentsQuery.get(),
    base.get(),
    base.collection('closing_groups').get(),
  ]);

  const programName = programSnap.data()?.name || programId;

  // Build payments map by memberId
  const paymentsByMember = {};
  paymentsSnap.forEach((doc) => {
    const p = doc.data();
    const key = p.memberId;
    if (!paymentsByMember[key]) paymentsByMember[key] = [];
    paymentsByMember[key].push({ id: doc.id, ...p });
  });

  // Aggregate rows
  const rows = [];
  membersSnap.forEach((doc) => {
    const m = doc.data();
    const payments = paymentsByMember[doc.id];
    if (!payments?.length) return;

    let totalPaid = 0, totalPending = 0, paidCount = 0, pendingCount = 0;

    for (const p of payments) {
      const amt = Number(p.payAmount || 0);
      if (p.status === 'paid') {
        totalPaid += amt;
        paidCount++;
      } else {
        totalPending += amt;
        pendingCount++;
      }
    }

    rows.push({
      memberId: doc.id,
      registrationNumber: m.registrationNumber,
      memberName: m.displayName,
      fatherName: m.fatherName,
      phone: m.phone,
      village: m.village,
      programName,
      programId,
      totalPaid,
      totalPending,
      paidCount,
      pendingCount,
      status: paidCount > 0 && pendingCount > 0 ? 'both'
        : paidCount > 0 ? 'paid'
        : 'pending',
    });
  });

  // Closing groups list
  const closingGroups = groupsSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name,
    memberCount: d.data().memberCount || 0,
  }));

  return {
    rows: rows.map((r, i) => ({ ...r, index: i + 1 })),
    closingGroups,
    programName,
    total: rows.length,
  };
}

// ── GET /api/all-payment-status ──────────────────────────────────────────────
export async function GET(request) {
  const startTime = Date.now();
  
  try {
    // 1. Auth
    const { uid, error: authError } = await verifyToken(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    // 2. Get query parameters
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const programId = searchParams.get('programId');
    const groupId = searchParams.get('groupId');

    if (!agentId || !programId) {
      return NextResponse.json(
        { error: 'agentId and programId are required' },
        { status: 400 }
      );
    }

    // 3. Fetch data with timeout protection
    const fetchPromise = fetchPaymentData(uid, agentId, programId, groupId);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 25000);
    });

    const data = await Promise.race([fetchPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    console.log(`[GET /api/all-payment-status] Completed in ${duration}ms`);

    return NextResponse.json(data);

  } catch (err) {
    console.error('[GET /api/all-payment-status]', err);
    const status = err.message === 'Database query timeout' ? 504 : 500;
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status }
    );
  }
}

// ── POST /api/all-payment-status ─────────────────────────────────────────────
export async function POST(request) {
  const startTime = Date.now();
  
  try {
    // 1. Auth
    const { uid, error: authError } = await verifyToken(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    // 2. Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { agentId, programId, groupId } = body;

    if (!agentId || !programId) {
      return NextResponse.json(
        { error: 'agentId and programId are required' },
        { status: 400 }
      );
    }

    // 3. Fetch data with timeout protection
    const fetchPromise = fetchPaymentData(uid, agentId, programId, groupId);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 25000);
    });

    const data = await Promise.race([fetchPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    console.log(`[POST /api/all-payment-status] Completed in ${duration}ms`);

    return NextResponse.json(data);

  } catch (err) {
    console.error('[POST /api/all-payment-status]', err);
    const status = err.message === 'Database query timeout' ? 504 : 500;
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status }
    );
  }
}