// Client helper for "apply the yojna's amounts to existing members".
// Server side: app/api/programs/sync-pay-amount/route.js
//
//   callYojnaSync({ programId, mode: 'preview' })
//     -> what would change, nothing is written
//   callYojnaSync({ programId, mode: 'apply', ranges: ['18-25'] })
//     -> writes the changes (ranges is optional: limit to these age groups)
import { getAuth } from 'firebase/auth';

export async function callYojnaSync(body) {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch('/api/programs/sync-pay-amount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
