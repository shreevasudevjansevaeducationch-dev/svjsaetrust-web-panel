import {
    doc,
    getDoc,
    collection,
    runTransaction,
    getDocs,
    query,
    where,
    orderBy,
    updateDoc,
    addDoc,
    Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

function memberAdvanceColPath(userId, programId, memberId) {
    return `users/${userId}/programs/${programId}/members/${memberId}/advanceTransactions`;
}

function memberDocPath(userId, programId, memberId) {
    return `users/${userId}/programs/${programId}/members/${memberId}`;
}

export async function getAdvanceBalance(userId, programId, memberId) {
    try {
        const memberRef = doc(db, memberDocPath(userId, programId, memberId));
        const memberSnap = await getDoc(memberRef);
        if (!memberSnap.exists()) return 0;
        return memberSnap.data().advanceBalance || 0;
    } catch (e) {
        console.error("Error getting advance balance:", e);
        return 0;
    }
}

export async function getAdvanceTransactions(userId, programId, memberId) {
    try {
        const snap = await getDocs(
            query(
                collection(db, memberAdvanceColPath(userId, programId, memberId)),
                where("delete_flag", "==", false),
                orderBy("transactionDate", "desc"),
            ),
        );
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Error getting advance transactions:", e);
        return [];
    }
}

export async function addAdvanceCredit(userId, programId, memberId, data) {
    const memberRef = doc(db, memberDocPath(userId, programId, memberId));
    const advTxColRef = collection(db, memberAdvanceColPath(userId, programId, memberId));

    return await runTransaction(db, async (transaction) => {
        const memberSnap = await transaction.get(memberRef);
        if (!memberSnap.exists()) throw new Error("Member not found");

        const currentBalance = memberSnap.data().advanceBalance || 0;
        const newBalance = currentBalance + Number(data.amount);

        const txData = {
            type: "credit",
            amount: Number(data.amount),
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            paymentMethod: data.paymentMethod || "cash",
            onlineReference: data.onlineReference || "",
            note: data.note || "",
            transactionDate: data.transactionDate || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            createdBy: userId,
            active_flag: true,
            delete_flag: false,
        };

        transaction.update(memberRef, { advanceBalance: newBalance });
        const newTxRef = doc(advTxColRef);
        transaction.set(newTxRef, txData);

        return { id: newTxRef.id, ...txData };
    });
}

export async function addAdvanceDebit(
    userId,
    programId,
    memberId,
    amount,
    relatedInfo = {},
) {
    const memberRef = doc(db, memberDocPath(userId, programId, memberId));
    const advTxColRef = collection(db, memberAdvanceColPath(userId, programId, memberId));

    return await runTransaction(db, async (transaction) => {
        const memberSnap = await transaction.get(memberRef);
        if (!memberSnap.exists()) throw new Error("Member not found");

        const currentBalance = memberSnap.data().advanceBalance || 0;
        const debitAmount = Number(amount);

        if (currentBalance < debitAmount) {
            throw new Error("Insufficient advance balance");
        }

        const newBalance = currentBalance - debitAmount;

        const txData = {
            type: "debit",
            amount: debitAmount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            paymentMethod: "advance",
            note: relatedInfo.note || "Used from advance wallet",
            transactionDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            createdBy: userId,
            relatedTransactionId: relatedInfo.transactionId || "",
            relatedMarriageId: relatedInfo.marriageId || "",
            relatedMarriageName: relatedInfo.marriageName || "",
            active_flag: true,
            delete_flag: false,
        };

        transaction.update(memberRef, { advanceBalance: newBalance });
        const newTxRef = doc(advTxColRef);
        transaction.set(newTxRef, txData);

        return { id: newTxRef.id, ...txData };
    });
}

export async function revertAdvanceCredit(userId, programId, memberId, txId, amount) {
    const memberRef = doc(db, memberDocPath(userId, programId, memberId));
    const txRef = doc(db, `${memberAdvanceColPath(userId, programId, memberId)}/${txId}`);

    return await runTransaction(db, async (transaction) => {
        const [memberSnap, txSnap] = await Promise.all([
            transaction.get(memberRef),
            transaction.get(txRef),
        ]);

        if (!memberSnap.exists()) throw new Error("Member not found");
        if (!txSnap.exists()) throw new Error("Transaction not found");

        const txData = txSnap.data();
        if (txData.type !== "credit") throw new Error("Only credit transactions can be reverted");
        if (txData.delete_flag === true) throw new Error("Transaction already deleted");

        const currentBalance = memberSnap.data().advanceBalance || 0;
        const newBalance = Math.max(0, currentBalance - Number(amount));

        transaction.update(memberRef, { advanceBalance: newBalance });
        transaction.update(txRef, {
            delete_flag: true,
            revertedAt: new Date().toISOString(),
            revertedBy: userId,
        });

        return { newBalance };
    });
}
