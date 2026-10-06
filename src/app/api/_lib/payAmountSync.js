// app/api/_lib/payAmountSync.js
//
// Pure planning logic for "Update existing amounts" on the Yojna page.
// No Firestore calls in this file, so it can be tested on its own.
//
// Background: the contribution amount is copied in three places.
//   1. program.ageGroups[].payAmount   (edited on the Yojna page)
//   2. member.payAmount                (copied when a member is added/edited)
//   3. payment_pending.payAmount       (copied from the member at closing time)
// Editing the yojna only changes (1). buildPlan() works out which member docs
// and which still-unpaid payment_pending docs have to change so that (2) and
// (3) match (1) again.
//
// Used by: app/api/programs/sync-pay-amount/route.js

import dayjs from 'dayjs';

// Same string the member forms store in member.ageGroupRange.
export const rangeKey = (group) => `${group?.startAge}-${group?.endAge}`;

// Accepts 'DD-MM-YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD...' strings and Firestore
// Timestamps. Returns a dayjs object, or null when the value is not a date.
export function parseDate(value) {
  if (!value) return null;

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return dayjs(value.toDate());
    const secs = value.seconds ?? value._seconds;
    return typeof secs === 'number' ? dayjs(secs * 1000) : null;
  }
  if (typeof value !== 'string') return null;

  const s = value.trim();
  let day, month, year;

  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return null;
    [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  const d = dayjs(new Date(year, month - 1, day));
  // Reject overflow dates such as 31-02-2020.
  if (!d.isValid() || d.date() !== day || d.month() !== month - 1) return null;
  return d;
}

// Same formula as AddMember / EditMember.
export const decimalAge = (birth, join) => join.diff(birth, 'year', true);

// Which age group of the yojna does this member belong to?
//   1. the range saved on the member ('18-25') if that range still exists
//   2. otherwise age at joining, worked out from date of birth + join date
//      (the same rule the Add/Edit member forms use)
//   3. otherwise the saved age-group id
// Returns { group, by } or null when nothing matches.
export function resolveAgeGroup(member, ageGroups) {
  const groups = Array.isArray(ageGroups) ? ageGroups : [];

  const stored = typeof member?.ageGroupRange === 'string' ? member.ageGroupRange.trim() : '';
  if (stored) {
    const g = groups.find((x) => rangeKey(x) === stored);
    if (g) return { group: g, by: 'range' };
  }

  const birth = parseDate(member?.bobDate);
  const join = parseDate(member?.dateJoin) || parseDate(member?.requestCreatedAt);
  if (birth && join) {
    const age = decimalAge(birth, join);
    const g = groups.find((x) => age >= Number(x.startAge) && age < Number(x.endAge));
    if (g) return { group: g, by: 'age' };
  }

  if (member?.ageGroup) {
    const g = groups.find((x) => x.id && x.id === member.ageGroup);
    if (g) return { group: g, by: 'id' };
  }

  return null;
}

// null = member takes part in the update, otherwise the reason it is left out.
export function ineligibleReason(member) {
  if (member?.delete_flag === true) return 'deleted';
  if (member?.isFixedAmountMember === true) return 'fixed';
  if (member?.active_flag === false || member?.status === 'blocked') return 'inactive';
  if (member?.status !== 'accepted' && member?.status !== 'closed') return 'notMember';
  return null;
}

// Only entries on which nothing has been paid yet may change amount.
export function isOpenPendingEntry(entry) {
  if (!entry || entry.delete_flag === true) return false;
  if (entry.status && entry.status !== 'pending') return false;
  return !(Number(entry.paidAmount) > 0);
}

/**
 * @param {object}   args
 * @param {object[]} args.ageGroups      program.ageGroups
 * @param {object[]} args.members        member docs ({ id, ...fields })
 * @param {object[]} args.pendingEntries payment_pending docs ({ id, memberId, payAmount, ... })
 * @param {string[]} [args.onlyRanges]   limit the update to these age-group ranges
 *                                       (e.g. ['18-25']); omit for all groups
 *
 * Each returned update carries `source` (the original object passed in), so the
 * caller can keep its own document references on those objects.
 */
export function buildPlan({ ageGroups, members, pendingEntries, onlyRanges }) {
  const groups = Array.isArray(ageGroups) ? ageGroups : [];
  const only = Array.isArray(onlyRanges) ? new Set(onlyRanges) : null;

  const stats = new Map();
  for (const g of groups) {
    const key = rangeKey(g);
    if (stats.has(key)) continue;
    stats.set(key, {
      key,
      startAge: g.startAge,
      endAge: g.endAge,
      payAmount: Number(g.payAmount) || 0,
      members: 0,
      membersToUpdate: 0,
      entriesToUpdate: 0,
      oldEntriesTotal: 0,
      newEntriesTotal: 0,
      fromAmounts: {}, // { '300': 120 } = 120 pending entries currently at 300
    });
  }

  const skipped = { fixed: 0, inactive: 0, notMember: 0, unmatched: 0, noAmount: 0 };
  const unmatchedSamples = [];
  const memberUpdates = [];
  const targetByMember = new Map();

  for (const m of members || []) {
    const reason = ineligibleReason(m);
    if (reason) {
      if (reason !== 'deleted') skipped[reason]++;
      continue;
    }

    const match = resolveAgeGroup(m, groups);
    if (!match) {
      skipped.unmatched++;
      if (unmatchedSamples.length < 20) {
        unmatchedSamples.push({
          id: m.id,
          displayName: m.displayName || '',
          registrationNumber: m.registrationNumber || '',
          ageGroupRange: m.ageGroupRange || '',
          payAmount: m.payAmount ?? null,
        });
      }
      continue;
    }

    const key = rangeKey(match.group);
    const st = stats.get(key);
    const target = st.payAmount;
    if (!(target > 0)) {
      // Never write 0 / empty amounts onto members.
      skipped.noAmount++;
      continue;
    }

    st.members++;
    if (only && !only.has(key)) continue;

    targetByMember.set(m.id, { target, key });
    if (Number(m.payAmount) !== target) {
      st.membersToUpdate++;
      memberUpdates.push({ id: m.id, from: m.payAmount ?? null, to: target, key, source: m });
    }
  }

  const entryUpdates = [];
  for (const e of pendingEntries || []) {
    if (!isOpenPendingEntry(e)) continue;
    const t = targetByMember.get(e.memberId);
    if (!t) continue;

    const current = Number(e.payAmount);
    if (current === t.target) continue;

    const st = stats.get(t.key);
    const hasAmount = Number.isFinite(current) && e.payAmount !== null && e.payAmount !== undefined && e.payAmount !== '';
    const fromKey = hasAmount ? String(current) : 'none';

    st.entriesToUpdate++;
    st.oldEntriesTotal += hasAmount ? current : 0;
    st.newEntriesTotal += t.target;
    st.fromAmounts[fromKey] = (st.fromAmounts[fromKey] || 0) + 1;

    entryUpdates.push({
      id: e.id,
      memberId: e.memberId,
      from: e.payAmount ?? null,
      to: t.target,
      key: t.key,
      source: e,
    });
  }

  const groupList = [...stats.values()];
  const totals = groupList.reduce(
    (acc, g) => {
      acc.oldEntriesTotal += g.oldEntriesTotal;
      acc.newEntriesTotal += g.newEntriesTotal;
      return acc;
    },
    {
      membersToUpdate: memberUpdates.length,
      entriesToUpdate: entryUpdates.length,
      oldEntriesTotal: 0,
      newEntriesTotal: 0,
    }
  );

  return { groups: groupList, totals, skipped, unmatchedSamples, memberUpdates, entryUpdates };
}
