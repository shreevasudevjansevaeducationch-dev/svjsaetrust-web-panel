// Client helper for fixed-amount members.
// Asks the server how much of a member's fixed amount is paid and, unless
// dryRun is set, lets it clear (or restore) the member's pending closing
// entries. Server side: app/api/members/fixed-amount/route.js
import { getAuth } from 'firebase/auth';

export async function syncFixedMembers(programId, memberIds, { dryRun = false } = {}) {
  const ids = [...new Set((memberIds || []).filter(Boolean))];
  if (!programId || ids.length === 0) return [];

  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/members/fixed-amount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ programId, memberIds: ids, dryRun }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data.results || [];
}

// Same check the Cloud Functions use when deciding whether to create a new
// closing entry for a member.
export function isFixedAmountComplete(member) {
  const fixedAmount = Number(member?.fixedAmount) || 0;
  if (member?.isFixedAmountMember !== true || fixedAmount <= 0) return false;
  return member.fixedAmountCompleted === true || (Number(member.closingAmountPaid) || 0) >= fixedAmount;
}
