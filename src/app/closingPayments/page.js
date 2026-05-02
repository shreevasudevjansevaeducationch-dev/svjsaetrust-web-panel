'use client';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  App, Input, Select, Button, Tag, Tooltip, Modal,
  Drawer, Form, DatePicker, Spin, Avatar, Row, Col,
  Steps, Alert, InputNumber, Empty, Popconfirm, message as antdMessage, Badge
} from 'antd';
import dayjs from 'dayjs';
import {
  DollarOutlined, UserOutlined, SearchOutlined, FilterOutlined,
  CheckCircleOutlined, WarningOutlined, CloseOutlined, ReloadOutlined,
  CreditCardOutlined, WalletOutlined, TeamOutlined, UnorderedListOutlined,
  AppstoreOutlined, ThunderboltOutlined, CalendarOutlined, InfoCircleOutlined,
  SortAscendingOutlined, GlobalOutlined, PercentageOutlined,
  EyeOutlined, RocketOutlined
} from '@ant-design/icons';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthProvider';
import { useSelector } from 'react-redux';
import { getData } from '@/lib/services/firebaseService';

import { AgGridReact } from 'ag-grid-react';
import {
  ClientSideRowModelModule, ModuleRegistry, NumberEditorModule,
  NumberFilterModule, PaginationModule, RowSelectionModule,
  TextEditorModule, TextFilterModule, ValidationModule, RowStyleModule, CheckboxEditorModule
} from 'ag-grid-community';

const { Option } = Select;
const { Search } = Input;
const { TextArea } = Input;

ModuleRegistry.registerModules([
  NumberEditorModule, TextEditorModule, TextFilterModule, NumberFilterModule,
  RowSelectionModule, PaginationModule, ClientSideRowModelModule,
  ValidationModule, RowStyleModule, CheckboxEditorModule
]);

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pct = (paid, total) => (total > 0 ? Math.round((paid / total) * 100) : 0);

// ─── API HELPER: get Firebase ID token and call server API ───────────────────
async function callApi(endpoint, options = {}) {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();

  if (!token) throw new Error('Not authenticated');

  const res = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || 'API Error');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Fetch payment data from server
async function fetchPaymentDataAPI(programId) {
  return callApi(`/api/payments/fetch?programId=${programId}`);
}

// Process single payment
async function processSinglePaymentAPI(payload) {
  return callApi('/api/payments/process', {
    method: 'POST',
    body: JSON.stringify({ type: 'single', ...payload }),
  });
}

// Process bulk payment
async function processBulkPaymentAPI(payload) {
  return callApi('/api/payments/process', {
    method: 'POST',
    body: JSON.stringify({ type: 'bulk', ...payload }),
  });
}

// Check duplicate reference (uses server)
async function checkDupRefAPI(programId, onlineReference) {
  try {
    await callApi('/api/payments/process', {
      method: 'POST',
      body: JSON.stringify({ type: 'single', programId, selectedClosingIds: [], payerId: '_check_only_', onlineReference, paymentMethod: 'online', _checkOnly: true }),
    });
    return false;
  } catch (err) {
    return err.status === 409;
  }
}

// ─── CLOSING DETAILS DRAWER ───────────────────────────────────────────────────
function MemberClosingsDrawer({ open, onClose, member, programId, user }) {
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !member || !programId || !user) return;
    (async () => {
      setLoading(true);
      try {
        const pendRef = collection(db, `users/${user.uid}/programs/${programId}/payment_pending`);
        const q = query(pendRef, where('memberId', '==', member.id), where('delete_flag', '==', false));
        const snap = await getDocs(q);
        const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const enriched = await Promise.all(entries.map(async entry => {
          try {
            const closingMemberId = entry.closingMemberId || entry.marriageId;
            if (!closingMemberId) return entry;
            const cmRef = doc(db, `users/${user.uid}/programs/${programId}/members`, closingMemberId);
            const cmSnap = await getDoc(cmRef);
            const cm = cmSnap.exists() ? cmSnap.data() : {};
            return {
              ...entry,
              closingMemberName: cm.displayName || entry.closingMemberName || '—',
              closingMemberReg: cm.registrationNumber || entry.closingMemberRegistrationNumber || '—',
              closingMemberPhoto: cm.photoURL || '',
              closingMemberFather: cm.fatherName || '',
              marriageDate: cm.marriage_date || entry.closingAt || '',
            };
          } catch { return entry; }
        }));
        setClosings(enriched);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [open, member, programId, user]);

  const pendingCount = closings.filter(c => c.status === 'pending').length;
  const paidCount = closings.filter(c => c.status === 'paid').length;

  return (
    <Drawer
      open={open} onClose={onClose} width={520}
      title={
        <div className="flex items-center gap-3">
          {member?.photoURL
            ? <Avatar src={member.photoURL} size={40} />
            : <Avatar size={40} style={{ background: `hsl(${(member?.displayName?.charCodeAt(0) || 0) * 7 % 360},55%,55%)`, fontWeight: 700 }}>
                {member?.displayName?.charAt(0)?.toUpperCase()}
              </Avatar>}
          <div>
            <div className="font-bold text-gray-900">{member?.displayName}</div>
            <div className="text-xs text-gray-400">{member?.registrationNumber} · Closing Details</div>
          </div>
        </div>
      }
    >
      <Row gutter={12} className="mb-4">
        {[
          { label: 'Total', value: closings.length, color: '#6366f1', bg: '#eef2ff' },
          { label: 'Pending', value: pendingCount, color: '#f97316', bg: '#fff7ed' },
          { label: 'Paid', value: paidCount, color: '#10b981', bg: '#ecfdf5' },
        ].map(s => (
          <Col span={8} key={s.label}>
            <div className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
              <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      {loading
        ? <div className="flex items-center justify-center py-16"><Spin /></div>
        : closings.length === 0
          ? <Empty description="No closing entries found" />
          : (
            <div className="space-y-3">
              {closings.map((c, i) => {
                const isPaid = c.status === 'paid';
                const isPartial = c.status === 'partial';
                const payAmount = c.payAmount || member?.payAmount || 200;
                return (
                  <div key={c.id}
                    className={`rounded-2xl border p-3 flex items-center gap-3 transition-all
                      ${isPaid ? 'bg-green-50 border-green-200' : isPartial ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                    <div className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">{i + 1}</div>
                    {c.closingMemberPhoto
                      ? <Avatar src={c.closingMemberPhoto} size={36} className="flex-shrink-0" />
                      : <Avatar size={36} className="flex-shrink-0"
                          style={{ background: `hsl(${(c.closingMemberName?.charCodeAt(0) || 0) * 11 % 360},55%,55%)`, fontWeight: 700, fontSize: 13 }}>
                          {c.closingMemberName?.charAt(0)?.toUpperCase()}
                        </Avatar>}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{c.closingMemberName}</div>
                      <div className="text-xs text-gray-400">{c.closingMemberReg}</div>
                      {c.closingMemberFather && <div className="text-xs text-gray-400 truncate">S/o {c.closingMemberFather}</div>}
                      {c.marriageDate && <div className="text-xs text-indigo-400 mt-0.5"><CalendarOutlined className="mr-1" />{c.marriageDate}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm text-gray-800">{fmt(c.paidAmount || 0)} / {fmt(payAmount)}</div>
                      {isPaid
                        ? <Tag color="success" className="text-xs mt-1"><CheckCircleOutlined /> Paid</Tag>
                        : isPartial
                          ? <Tag color="processing" className="text-xs mt-1">Partial</Tag>
                          : <Tag color="warning" className="text-xs mt-1">Pending</Tag>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
    </Drawer>
  );
}

// ─── BULK PAYMENT DRAWER ──────────────────────────────────────────────────────
function BulkPaymentDrawer({ open, onClose, selectedRows, programId, programName, user, onSuccess }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [globalAmount, setGlobalAmount] = useState(0);
  const [refValid, setRefValid] = useState(true);
  const [checkingRef, setCheckingRef] = useState(false);
  const [memberPayments, setMemberPayments] = useState([]);

  // Calculate waterfall distribution preview (client side only for preview)
  useEffect(() => {
    if (open && selectedRows.length && globalAmount > 0) {
      const distribution = [];
      let remainingAmount = globalAmount;

      const sortedMembers = [...selectedRows].sort((a, b) => {
        const aHasPending = (a.pendingClosingCount || 0) > 0;
        const bHasPending = (b.pendingClosingCount || 0) > 0;
        if (aHasPending && !bHasPending) return -1;
        if (!aHasPending && bHasPending) return 1;
        return (a.totalPending || 0) - (b.totalPending || 0);
      });

      for (const member of sortedMembers) {
        if (remainingAmount <= 0) break;
        const pendingAmount = member.totalPending || 0;
        const perClosingAmount = member.payAmount || 200;
        const pendingClosings = member.pendingClosingCount || Math.ceil(pendingAmount / perClosingAmount);
        const maxPossibleAmount = Math.min(pendingAmount, remainingAmount);
        const closingsCanPay = Math.floor(maxPossibleAmount / perClosingAmount);
        const amountToPay = closingsCanPay * perClosingAmount;

        if (amountToPay > 0) {
          distribution.push({
            memberId: member.id,
            memberName: member.displayName,
            memberReg: member.registrationNumber,
            memberPhoto: member.photoURL,
            pendingAmount,
            pendingClosings,
            amountToPay,
            closingsToPay: closingsCanPay,
            isFullPayment: amountToPay >= pendingAmount,
            perClosingAmount,
          });
          remainingAmount -= amountToPay;
        }
      }
      setMemberPayments(distribution);
    } else if (globalAmount === 0) {
      setMemberPayments([]);
    }
  }, [globalAmount, selectedRows, open]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setPaymentMethod('cash');
      setGlobalAmount(0);
      setRefValid(true);
      setMemberPayments([]);
    }
  }, [open, form]);

  const handleCheckRef = async (ref) => {
    if (!ref || !programId) return;
    setCheckingRef(true);
    try {
      const isDup = await checkDupRefAPI(programId, ref);
      setRefValid(!isDup);
    } finally {
      setCheckingRef(false);
    }
  };

  const handleSubmit = async (values) => {
    if (values.paymentMethod === 'online' && !values.onlineReference?.trim()) {
      message.error('Enter transaction reference');
      return;
    }
    if (memberPayments.length === 0) {
      message.error('No valid payments to process');
      return;
    }

    setLoading(true);
    try {
      // ✅ Server side call - token auto-attached
      const result = await processBulkPaymentAPI({
        programId,
        programName,
        memberIds: selectedRows.map((r) => r.id),
        globalAmount,
        paymentMethod: values.paymentMethod,
        paymentDate: dayjs(values.paymentDate).toISOString(),
        note: values.note || '',
        onlineReference: values.onlineReference || '',
      });

      message.success(
        `बल्क पेमेंट हो गया! ₹${result.totalPaid?.toLocaleString()} का भुगतान ${result.membersProcessed} सदस्यों में वितरित किया गया.`
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err.status === 409) {
        message.error('Duplicate reference number');
        setRefValid(false);
      } else if (err.status === 401) {
        message.error('Session expired. Please login again.');
      } else {
        message.error(err.message || 'Failed to process bulk payment');
      }
    } finally {
      setLoading(false);
    }
  };

  const totalOwe = selectedRows.reduce((s, r) => s + (r.totalPending || 0), 0);
  const totalAllocated = memberPayments.reduce((sum, p) => sum + p.amountToPay, 0);
  const remainingAmount = globalAmount - totalAllocated;
  const activeMembersCount = memberPayments.length;
  const fullPaidMembers = memberPayments.filter(p => p.isFullPayment).length;

  return (
    <Drawer
      open={open} onClose={onClose} width={620} destroyOnClose
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
            <ThunderboltOutlined className="text-white text-lg" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Bulk Payment - Waterfall</div>
            <div className="text-xs text-gray-400">{selectedRows.length} members selected · {programName}</div>
          </div>
        </div>
      }
      footer={
        <div className="flex gap-3 p-2">
          <Button onClick={onClose} block size="large">Cancel</Button>
          <Button
            type="primary" size="large" loading={loading} block
            disabled={memberPayments.length === 0 || !refValid || checkingRef}
            className="bg-gradient-to-r from-amber-500 to-orange-500 border-0 shadow-md"
            icon={<ThunderboltOutlined />}
            onClick={() => form.submit()}
          >
            Process {activeMembersCount} Member{activeMembersCount !== 1 ? 's' : ''}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-blue-700">
            <ThunderboltOutlined className="text-lg" />
            <span className="text-sm font-semibold">Waterfall Distribution</span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            पहले एक member के सभी pending closings का पूरा भुगतान करें, फिर अगले member का.
            प्रति closing ₹{selectedRows[0]?.payAmount || 200} का भुगतान होगा.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Owed', value: fmt(totalOwe), color: '#6366f1', bg: '#eef2ff' },
            { label: 'Will Pay', value: fmt(totalAllocated), color: '#10b981', bg: '#ecfdf5' },
            { label: 'Remaining', value: fmt(remainingAmount > 0 ? remainingAmount : 0), color: remainingAmount > 0 ? '#f97316' : '#ef4444', bg: remainingAmount > 0 ? '#fff7ed' : '#fef2f2' },
            { label: 'Full Paid', value: fullPaidMembers, color: '#22c55e', bg: '#f0fdf4' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
              <div className="text-base font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
          <div className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
            <GlobalOutlined /> Enter Payment Amount (Waterfall)
          </div>
          <div className="flex gap-2">
            <InputNumber
              prefix={<span className="text-amber-600 font-bold">₹</span>}
              size="large" className="flex-1"
              placeholder="Enter total amount to distribute"
              min={0} value={globalAmount} onChange={setGlobalAmount}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v?.replace(/,/g, '') || '0'}
            />
            <Button type="default" size="large" onClick={() => setGlobalAmount(totalOwe)}
              className="border-amber-400 text-amber-600 font-semibold">Full Payment</Button>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <PercentageOutlined className="text-indigo-500" /> Waterfall Distribution (Member-wise)
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b grid grid-cols-12 text-xs font-semibold text-gray-400">
              <div className="col-span-5">Member</div>
              <div className="col-span-2 text-right">Pending</div>
              <div className="col-span-3 text-right">Paying</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {memberPayments.length === 0 && globalAmount > 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <WarningOutlined className="text-2xl mb-2" />
                  <p className="text-sm">Amount too low to pay any full closing</p>
                </div>
              ) : memberPayments.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm">Enter amount to see distribution</p>
                </div>
              ) : (
                memberPayments.map((payment, i) => {
                  const isFull = payment.isFullPayment;
                  return (
                    <div key={payment.memberId}
                      className="grid grid-cols-12 items-center gap-2 px-3 py-3 border-b last:border-0 bg-white">
                      <div className="col-span-5 flex items-center gap-2 min-w-0">
                        <div className="text-xs font-bold text-gray-300 w-4 flex-shrink-0">{i + 1}</div>
                        {payment.memberPhoto
                          ? <Avatar src={payment.memberPhoto} size={30} className="flex-shrink-0" />
                          : <Avatar size={30} className="flex-shrink-0"
                              style={{ background: `hsl(${(i * 47) % 360},60%,55%)`, fontSize: 11, fontWeight: 700 }}>
                              {payment.memberName?.charAt(0)?.toUpperCase()}
                            </Avatar>}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate">{payment.memberName}</div>
                          <div className="text-xs text-gray-400 truncate">{payment.memberReg}</div>
                        </div>
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="text-xs font-bold text-red-500">{fmt(payment.pendingAmount)}</div>
                        <div className="text-xs text-gray-400">{payment.pendingClosings} closings</div>
                      </div>
                      <div className="col-span-3 text-right">
                        <div className="text-xs font-black text-green-600">{fmt(payment.amountToPay)}</div>
                        <div className="text-xs text-gray-400">{payment.closingsToPay} @ {fmt(payment.perClosingAmount)}</div>
                      </div>
                      <div className="col-span-2 text-right">
                        {isFull
                          ? <Tag color="success" className="text-xs m-0">✅ Full</Tag>
                          : <Tag color="processing" className="text-xs m-0">Partial</Tag>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {globalAmount > 0 && remainingAmount > 0 && (
            <div className="mt-3 bg-yellow-50 rounded-lg p-2 text-center border border-yellow-200">
              <span className="text-xs text-yellow-700">
                ⚠️ {fmt(remainingAmount)} राशि बच गई - पर्याप्त members नहीं हैं
              </span>
            </div>
          )}
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit}
          initialValues={{ paymentDate: dayjs(), paymentMethod: 'cash' }}>
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-0">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CreditCardOutlined className="text-indigo-500" /> Payment Details
            </div>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="paymentMethod" label="Payment Method" rules={[{ required: true }]} className="mb-3">
                  <Select size="large" onChange={setPaymentMethod}>
                    <Option value="cash"><div className="flex items-center gap-2"><WalletOutlined className="text-green-500" /><span>Cash</span></div></Option>
                    <Option value="online"><div className="flex items-center gap-2"><CreditCardOutlined className="text-blue-500" /><span>Online</span></div></Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true }]} className="mb-3">
                  <DatePicker className="w-full" size="large" format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
            </Row>
            {paymentMethod === 'online' && (
              <Form.Item name="onlineReference" label="Transaction / UTR Reference"
                rules={[{ required: true }, { min: 3 }]}
                validateStatus={!refValid ? 'error' : checkingRef ? 'validating' : ''}
                help={!refValid ? 'Reference already exists' : undefined} className="mb-3">
                <Input size="large" placeholder="UTR/Transaction ID"
                  onChange={async e => {
                    const v = e.target.value;
                    if (v.length >= 3) await handleCheckRef(v);
                    else setRefValid(true);
                  }}
                  suffix={
                    checkingRef ? <Spin size="small" />
                      : !refValid ? <WarningOutlined className="text-red-500" />
                        : <CheckCircleOutlined className="text-green-400" />
                  }
                />
              </Form.Item>
            )}
            <Form.Item name="note" label="Note (Optional)" className="mb-0">
              <TextArea rows={2} placeholder="Add payment notes..." maxLength={200} showCount />
            </Form.Item>
          </div>
        </Form>
      </div>
    </Drawer>
  );
}

// ─── ADD SINGLE PAYMENT DRAWER ────────────────────────────────────────────────
function AddPaymentDrawer({ open, onClose, programId, programName, programList, user, onSuccess }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [members, setMembers] = useState([]);
  const [marriages, setMarriages] = useState([]);
  const [filteredMarriages, setFilteredMarriages] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedMarriages, setSelectedMarriages] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [fetchingMarriages, setFetchingMarriages] = useState(false);
  const [paymentPendingEntries, setPaymentPendingEntries] = useState([]);
  const [alreadyPaidMarriages, setAlreadyPaidMarriages] = useState([]);
  const [checkingReference, setCheckingReference] = useState(false);
  const [isReferenceValid, setIsReferenceValid] = useState(true);
  const [marriageSearchText, setMarriageSearchText] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [waterfallPreview, setWaterfallPreview] = useState(null);
  const [customTotalAmount, setCustomTotalAmount] = useState(null);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setCurrentStep(0);
      setSelectedProgram(null);
      setMembers([]);
      setMarriages([]);
      setFilteredMarriages([]);
      setSelectedMember(null);
      setSelectedMarriages([]);
      setPaymentMethod('cash');
      setPaymentPendingEntries([]);
      setAlreadyPaidMarriages([]);
      setIsReferenceValid(true);
      setMarriageSearchText('');
      setShowPendingOnly(false);
      setWaterfallPreview(null);
      setCustomTotalAmount(null);
    }
  }, [open]);

  const distributeWaterfall = (totalAmount, closingsList, perClosingAmount) => {
    const sortedClosings = [...closingsList].sort((a, b) => {
      const dateA = a.closingAt || a.createdAt || '';
      const dateB = b.closingAt || b.createdAt || '';
      return dateA.localeCompare(dateB);
    });
    const distribution = [];
    let remainingAmount = totalAmount;
    for (const closing of sortedClosings) {
      if (remainingAmount <= 0) break;
      const amountForThisClosing = Math.min(remainingAmount, perClosingAmount);
      distribution.push({
        closingId: closing.id,
        amount: amountForThisClosing,
        isFullPayment: amountForThisClosing >= perClosingAmount,
        closingData: closing,
        closingName: closing.displayName,
        closingReg: closing.registrationNumber,
      });
      remainingAmount -= amountForThisClosing;
    }
    return {
      distributions: distribution,
      totalDistributed: totalAmount - remainingAmount,
      remainingAmount,
      fullyPaidClosings: distribution.filter(d => d.isFullPayment).length,
      totalClosingsProcessed: distribution.length,
    };
  };

  const perClosingAmountValue = Form.useWatch('amount', form) || 200;

  useEffect(() => {
    if (selectedMarriages.length > 0 && selectedMember && perClosingAmountValue > 0) {
      const totalAmount = customTotalAmount || (selectedMarriages.length * perClosingAmountValue);
      const selectedClosingsData = marriages.filter(m => selectedMarriages.includes(m.id));
      const preview = distributeWaterfall(totalAmount, selectedClosingsData, perClosingAmountValue);
      setWaterfallPreview(preview);
    } else {
      setWaterfallPreview(null);
    }
  }, [selectedMarriages, selectedMember, perClosingAmountValue, customTotalAmount, marriages]);

  const fetchClosings = async (prog) => {
    setFetchingMarriages(true);
    try {
      const data = await getData(
        `/users/${user.uid}/programs/${prog.id}/members`,
        [
          { field: 'active_flag', operator: '==', value: true },
          { field: 'delete_flag', operator: '==', value: false },
          { field: 'marriage_flag', operator: '==', value: true },
          { field: 'status', operator: 'in', value: ['closed', 'accepted'] }
        ],
        { field: 'closingAt', direction: 'desc' }
      );
      setMarriages(data);
      setFilteredMarriages(data);
    } catch (e) { message.error('Failed to fetch closings'); }
    finally { setFetchingMarriages(false); }
  };

  const fetchMembers = async (prog) => {
    setFetchingMembers(true);
    try {
      const data = await getData(
        `/users/${user.uid}/programs/${prog.id}/members`,
        [
          { field: 'active_flag', operator: '==', value: true },
          { field: 'delete_flag', operator: '==', value: false },
          { field: 'status', operator: '==', value: 'accepted' }
        ],
        { field: 'createdAt', direction: 'desc' }
      );
      setMembers(data);
    } catch (e) { message.error('Failed to fetch members'); }
    finally { setFetchingMembers(false); }
  };

  const fetchMemberPaymentInfo = async (memberId, prog) => {
    if (!memberId || !prog || !user) return;
    try {
      const pendQ = query(
        collection(db, `users/${user.uid}/programs/${prog.id}/payment_pending`),
        where('memberId', '==', memberId),
        where('delete_flag', '==', false)
      );
      const pendSnap = await getDocs(pendQ);
      setPaymentPendingEntries(pendSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const paidQ = query(
        collection(db, `users/${user.uid}/programs/${prog.id}/transactions`),
        where('payerId', '==', memberId),
        where('status', '==', 'completed'),
        where('delete_flag', '==', false)
      );
      const paidSnap = await getDocs(paidQ);
      const paidIds = [...new Set(paidSnap.docs.map(d => {
        const data = d.data();
        return data.marriageId || data.closingMemberId;
      }).filter(Boolean))];
      setAlreadyPaidMarriages(paidIds);
    } catch (e) { console.error(e); }
  };

  const checkDupRef = async (ref) => {
    if (!ref || !selectedProgram) return false;
    setCheckingReference(true);
    try {
      const isDup = await checkDupRefAPI(selectedProgram.id, ref);
      setIsReferenceValid(!isDup);
      return isDup;
    } finally { setCheckingReference(false); }
  };

  useEffect(() => {
    let filtered = [...marriages];
    if (marriageSearchText) {
      const s = marriageSearchText.toLowerCase();
      filtered = filtered.filter(m =>
        m.displayName?.toLowerCase().includes(s) ||
        m.fatherName?.toLowerCase().includes(s) ||
        m.registrationNumber?.toLowerCase().includes(s)
      );
    }
    if (showPendingOnly && selectedMember) {
      const pendingIds = paymentPendingEntries.map(p => p.closingMemberId || p.marriageId);
      filtered = filtered.filter(m => pendingIds.includes(m.id));
    }
    filtered = filtered.filter(m => !alreadyPaidMarriages.includes(m.id));
    setFilteredMarriages(filtered);
  }, [marriageSearchText, showPendingOnly, marriages, paymentPendingEntries, selectedMember, alreadyPaidMarriages]);

  const handleProgramSelect = async (value) => {
    const prog = programList.find(p => p.id === value);
    setSelectedProgram(prog);
    form.setFieldsValue({ program: value });
    if (prog) await Promise.all([fetchClosings(prog), fetchMembers(prog)]);
  };

  const handleMemberSelect = async (memberId) => {
    setSelectedMember(memberId);
    setSelectedMarriages([]);
    setWaterfallPreview(null);
    setCustomTotalAmount(null);
    const member = members.find(m => m.id === memberId);
    form.setFieldsValue({ amount: member?.payAmount || 200 });
    await fetchMemberPaymentInfo(memberId, selectedProgram);
    setCurrentStep(2);
  };

  const handleSelectAllPending = () => {
    const pendingIds = paymentPendingEntries
      .map(p => p.closingMemberId || p.marriageId)
      .filter(id => !alreadyPaidMarriages.includes(id));
    const available = marriages.filter(m => pendingIds.includes(m.id)).map(m => m.id);
    if (!available.length) { message.info('No pending payments available'); return; }
    setSelectedMarriages(available);
    setCustomTotalAmount(null);
  };

  const totalSelectedAmount = selectedMarriages.length * perClosingAmountValue;
  const effectiveTotalAmount = customTotalAmount || totalSelectedAmount;

  const processPayment = async (values) => {
    if (values.paymentMethod === 'online' && !values.onlineReference?.trim()) {
      message.error('Enter transaction reference');
      return;
    }

    setLoading(true);
    try {
      // ✅ Server side call - token auto-attached
      const result = await processSinglePaymentAPI({
        programId: selectedProgram.id,
        programName: selectedProgram.name,
        payerId: selectedMember,
        selectedClosingIds: selectedMarriages,
        paymentMethod: values.paymentMethod,
        paymentDate: dayjs(values.paymentDate).toISOString(),
        note: values.note || '',
        onlineReference: values.onlineReference || '',
        perClosingAmount: Number(values.amount) || 200,
        customTotalAmount: customTotalAmount || null,
      });

      const fullPayments = result.fullyPaid || 0;
      const partialCount = (result.processed || 0) - fullPayments;

      if (result.remaining > 0) {
        message.warning(
          `Payment of ${fmt(effectiveTotalAmount)} processed but ${fmt(result.remaining)} remains unallocated.`
        );
      } else {
        message.success(
          `Payment of ${fmt(result.totalPaid)} distributed across ${result.processed} closing(s). ${fullPayments} fully paid, ${partialCount} partially paid.`
        );
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      if (err.status === 409) {
        message.error('Duplicate reference number');
        setIsReferenceValid(false);
      } else if (err.status === 401) {
        message.error('Session expired. Please login again.');
      } else {
        message.error(err.message || 'Failed to save payments');
      }
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = paymentPendingEntries.length;
  const memberDetails = members.find(m => m.id === selectedMember);

  const steps = [
    { title: 'Program', icon: <AppstoreOutlined /> },
    { title: 'Payer', icon: <TeamOutlined /> },
    { title: 'Closings', icon: <UnorderedListOutlined /> },
    { title: 'Payment', icon: <DollarOutlined /> },
  ];

  const canProceed = () => {
    if (currentStep === 0) return !!selectedProgram;
    if (currentStep === 1) return !!selectedMember;
    if (currentStep === 2) return selectedMarriages.length > 0;
    return true;
  };

  return (
    <Drawer
      open={open} onClose={onClose} width={520} destroyOnClose
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center shadow">
            <DollarOutlined className="text-white text-sm" />
          </div>
          <div>
            <div className="text-sm font-semibold">Record Payment</div>
            <div className="text-xs text-gray-400">Process marriage payments with waterfall distribution</div>
          </div>
        </div>
      }
      footer={
        <div>
          <Steps current={currentStep} size="small" className="mb-3" items={steps} />
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(s => s - 1)} disabled={loading} size="middle" block>
                Previous
              </Button>
            )}
            {currentStep < 3
              ? <Button type="primary" onClick={() => {
                  if (!canProceed()) { message.warning('Complete this step first'); return; }
                  setCurrentStep(s => s + 1);
                }} block size="middle" className="bg-blue-500">Next</Button>
              : <Button type="primary" loading={loading}
                  disabled={!selectedMarriages.length || (paymentMethod === 'online' && !isReferenceValid)}
                  icon={<CheckCircleOutlined />} block size="middle"
                  className="bg-gradient-to-r from-green-500 to-blue-500 border-0"
                  onClick={() => form.submit()}>Confirm Payment</Button>}
          </div>
        </div>
      }
    >
      <Form form={form} layout="vertical" size="middle"
        initialValues={{ paymentDate: dayjs(), paymentMethod: 'cash', amount: 200 }}
        onFinish={processPayment}>

        {/* STEP 0: Program */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <AppstoreOutlined className="text-white text-xl" />
              </div>
              <h3 className="text-base font-semibold">Select Program</h3>
              <p className="text-xs text-gray-500">Choose the program for payment</p>
            </div>
            <Form.Item name="program" rules={[{ required: true }]}>
              <Select placeholder="Select program" size="large" showSearch
                optionFilterProp="label" onChange={handleProgramSelect}>
                {programList.map(p => (
                  <Option key={p.id} value={p.id} label={p.name}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                        <AppstoreOutlined className="text-white text-xs" />
                      </div>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>
        )}

        {/* STEP 1: Member */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <TeamOutlined className="text-white text-xl" />
              </div>
              <h3 className="text-base font-semibold">Select Payer</h3>
              <p className="text-xs text-gray-500">Who is making the payment?</p>
            </div>
            <Form.Item name="member" rules={[{ required: true }]}>
              <Select loading={fetchingMembers} placeholder="Search member..." size="large" showSearch
                filterOption={(input, option) => (option['data-search'] || '').toLowerCase().includes(input.toLowerCase())}
                onChange={handleMemberSelect} optionLabelProp="label"
                notFoundContent={fetchingMembers ? <Spin size="small" /> : 'No members'}>
                {members.map(m => (
                  <Option key={m.id} value={m.id} label={m.displayName}
                    data-search={`${m.displayName} ${m.fatherName} ${m.registrationNumber}`}>
                    <div className="flex items-center gap-2">
                      <Avatar size={28} src={m.photoURL}
                        style={{ background: `hsl(${(m.displayName?.charCodeAt(0) || 0) * 7 % 360},55%,55%)`, fontSize: 12, fontWeight: 700 }}>
                        {m.displayName?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{m.displayName}</div>
                        <div className="text-xs text-gray-400">{m.registrationNumber}</div>
                      </div>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
            {memberDetails && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3">
                  <Avatar size={40} src={memberDetails.photoURL}
                    style={{ background: `hsl(${(memberDetails.displayName?.charCodeAt(0) || 0) * 7 % 360},55%,55%)`, fontWeight: 700 }}>
                    {memberDetails.displayName?.charAt(0)?.toUpperCase()}
                  </Avatar>
                  <div>
                    <div className="font-semibold">{memberDetails.displayName}</div>
                    <div className="text-xs text-gray-400">{memberDetails.registrationNumber}</div>
                    <div className="flex gap-1 mt-1">
                      <Tag color="blue" className="text-xs">₹{memberDetails.payAmount || 200}/closing</Tag>
                      {pendingCount > 0 && <Tag color="orange" className="text-xs">{pendingCount} pending</Tag>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Closings */}
        {currentStep === 2 && (
          <div className="space-y-3">
            <div className="text-center mb-3">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <UnorderedListOutlined className="text-white text-xl" />
              </div>
              <h3 className="text-base font-semibold">Select Closings</h3>
              <p className="text-xs text-gray-500">Choose closings to pay for (waterfall distribution)</p>
            </div>

            <Row gutter={8}>
              {[
                { label: 'Available', value: filteredMarriages.length, color: '#10b981', bg: '#ecfdf5' },
                { label: 'Pending', value: pendingCount, color: '#f97316', bg: '#fff7ed' },
                { label: 'Selected', value: selectedMarriages.length, color: '#3b82f6', bg: '#eff6ff' },
              ].map(s => (
                <Col span={8} key={s.label}>
                  <div className="rounded-xl p-2 text-center" style={{ background: s.bg }}>
                    <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                </Col>
              ))}
            </Row>

            <div className="flex gap-2">
              <Search placeholder="Search closing..." value={marriageSearchText}
                onChange={e => setMarriageSearchText(e.target.value)} allowClear size="small" className="flex-1" />
              <Button size="small" type={showPendingOnly ? 'primary' : 'default'}
                icon={<FilterOutlined />} onClick={() => setShowPendingOnly(v => !v)}
                className={showPendingOnly ? 'bg-orange-500 border-orange-500' : ''} />
            </div>

            {pendingCount > 0 && (
              <div className="flex items-center justify-between bg-orange-50 px-3 py-2 rounded-lg border border-orange-100">
                <span className="text-xs text-orange-600">{pendingCount} pending payments</span>
                <Button type="link" size="small" onClick={handleSelectAllPending}
                  className="text-orange-600 p-0 h-auto text-xs font-semibold">Select All Pending</Button>
              </div>
            )}

            {selectedMarriages.length > 0 && waterfallPreview && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                    <ThunderboltOutlined className="text-xs" /> Waterfall Preview
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Custom:</span>
                    <InputNumber
                      placeholder="Auto"
                      value={customTotalAmount}
                      onChange={setCustomTotalAmount}
                      size="small" prefix="₹" className="w-28" min={0}
                      max={selectedMarriages.length * perClosingAmountValue}
                    />
                    <Button size="small" type="link" onClick={() => setCustomTotalAmount(null)} className="text-blue-500 p-0 h-auto">Reset</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-gray-400">Total Amount</div>
                    <div className="font-bold text-blue-600">{fmt(effectiveTotalAmount)}</div>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-gray-400">Will Pay</div>
                    <div className="font-bold text-green-600">{fmt(waterfallPreview.totalDistributed)}</div>
                  </div>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {waterfallPreview.distributions.map((dist, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-white rounded-lg px-2 py-1">
                      <div className="flex items-center gap-2 truncate flex-1">
                        <span className="font-mono text-gray-400 w-5">{idx + 1}</span>
                        <span className="font-medium truncate">{dist.closingName}</span>
                        {dist.isFullPayment
                          ? <Tag color="green" className="text-xs m-0 px-1">Full</Tag>
                          : <Tag color="orange" className="text-xs m-0 px-1">Partial</Tag>}
                      </div>
                      <div className="font-mono font-medium">{fmt(dist.amount)} / {fmt(perClosingAmountValue)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {fetchingMarriages
                ? <div className="flex justify-center py-8"><Spin /></div>
                : filteredMarriages.length === 0
                  ? <Empty description="No closings available" className="py-8" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  : filteredMarriages.map(m => {
                      const isPending = paymentPendingEntries.some(p =>
                        (p.closingMemberId === m.id || p.marriageId === m.id) && p.memberId === selectedMember
                      );
                      const isSelected = selectedMarriages.includes(m.id);
                      const idx = selectedMarriages.indexOf(m.id);
                      return (
                        <div key={m.id}
                          onClick={() => {
                            if (isSelected) setSelectedMarriages(prev => prev.filter(id => id !== m.id));
                            else setSelectedMarriages(prev => [...prev, m.id]);
                            setCustomTotalAmount(null);
                          }}
                          className={`flex items-center gap-3 p-3 border-b last:border-0 cursor-pointer transition-colors
                            ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                            ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                            {isSelected && <CheckCircleOutlined className="text-white text-xs" style={{ fontSize: 11 }} />}
                          </div>
                          <Avatar size={32} src={m.photoURL}
                            style={{ background: `hsl(${(m.displayName?.charCodeAt(0) || 0) * 7 % 360},55%,55%)`, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {m.displayName?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{m.displayName}</span>
                              {isPending && <Tag color="orange" className="text-xs m-0 flex-shrink-0" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>PENDING</Tag>}
                            </div>
                            <div className="text-xs text-gray-400">{m.registrationNumber} · {m.fatherName}</div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {idx + 1}
                            </div>
                          )}
                        </div>
                      );
                    })}
            </div>

            {selectedMarriages.length > 0 && (
              <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-blue-700">
                    {selectedMarriages.length} selected · {fmt(totalSelectedAmount)} total
                  </span>
                  {customTotalAmount && customTotalAmount !== totalSelectedAmount && (
                    <span className="text-xs text-blue-500">Custom: {fmt(customTotalAmount)} (waterfall)</span>
                  )}
                </div>
                <Button type="text" size="small" icon={<CloseOutlined />}
                  onClick={() => { setSelectedMarriages([]); setCustomTotalAmount(null); }}
                  className="text-blue-500 text-xs">Clear</Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Payment Details */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <DollarOutlined className="text-white text-xl" />
              </div>
              <h3 className="text-base font-semibold">Payment Details</h3>
              <p className="text-xs text-gray-500">Confirm payment with waterfall distribution</p>
            </div>

            {waterfallPreview && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-blue-700">Waterfall Distribution</span>
                  <Tag color={waterfallPreview.remainingAmount === 0 ? 'green' : 'orange'} className="text-xs">
                    {waterfallPreview.remainingAmount === 0 ? 'Fully Allocated' : `${fmt(waterfallPreview.remainingAmount)} Unallocated`}
                  </Tag>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-gray-400">Total Paid</div>
                    <div className="font-bold text-green-600">{fmt(waterfallPreview.totalDistributed)}</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-gray-400">Closings</div>
                    <div className="font-bold text-blue-600">{waterfallPreview.totalClosingsProcessed}</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-gray-400">Fully Paid</div>
                    <div className="font-bold text-emerald-600">{waterfallPreview.fullyPaidClosings}</div>
                  </div>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {waterfallPreview.distributions.map((dist, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-white rounded-lg px-2 py-1">
                      <div className="flex items-center gap-2 truncate flex-1">
                        <span className="font-mono text-gray-400 w-5">{idx + 1}</span>
                        <span className="font-medium truncate">{dist.closingName}</span>
                      </div>
                      <div className="font-mono font-medium">{fmt(dist.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="amount" label="Per Closing Amount" rules={[{ required: true }]}>
                  <InputNumber className="w-full" prefix="₹" min={1} size="middle" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="paymentMethod" label="Method" rules={[{ required: true }]}>
                  <Select onChange={setPaymentMethod} size="middle">
                    <Option value="cash"><div className="flex items-center gap-2"><WalletOutlined className="text-green-500" /> Cash</div></Option>
                    <Option value="online"><div className="flex items-center gap-2"><CreditCardOutlined className="text-blue-500" /> Online</div></Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true }]}>
              <DatePicker className="w-full" format="DD/MM/YYYY" size="middle" />
            </Form.Item>

            {paymentMethod === 'online' && (
              <Form.Item name="onlineReference" label="Transaction / UTR Reference"
                rules={[{ required: true }, { min: 3 }]}
                validateStatus={!isReferenceValid ? 'error' : checkingReference ? 'validating' : ''}
                help={!isReferenceValid ? 'Reference already exists' : undefined}>
                <Input placeholder="UTR/Transaction ID" size="middle"
                  onChange={async e => {
                    if (e.target.value.length >= 3) await checkDupRef(e.target.value);
                    else setIsReferenceValid(true);
                  }}
                  suffix={checkingReference ? <Spin size="small" /> : !isReferenceValid
                    ? <WarningOutlined className="text-red-500" /> : <CheckCircleOutlined className="text-green-400" />} />
              </Form.Item>
            )}

            <Form.Item name="note" label="Note (Optional)">
              <TextArea rows={2} placeholder="Add notes..." maxLength={200} showCount size="middle" />
            </Form.Item>

            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Payer</span>
                <span className="font-medium text-gray-700">{memberDetails?.displayName}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Closings Selected</span>
                <span className="font-medium text-gray-700">{selectedMarriages.length}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Per Closing</span>
                <span className="font-medium text-gray-700">{fmt(perClosingAmountValue)}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between">
                <span className="text-sm font-semibold">Total to Pay</span>
                <span className="text-base font-black text-green-600">
                  {fmt(customTotalAmount || (selectedMarriages.length * perClosingAmountValue))}
                </span>
              </div>
            </div>
          </div>
        )}
      </Form>
    </Drawer>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function PaymentPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const programList = useSelector(state => state.data.programList);
  const selectedProgram = useSelector(state => state.data.selectedProgram);
  const agentList = useSelector(state => state.data.agentsList) || [];

  const [membersData, setMembersData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({ total: 0, totalAmount: 0, totalPaid: 0, totalPending: 0, membersWithPending: 0 });
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [agentFilter, setAgentFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showBulk, setShowBulk] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [closingDrawerMember, setClosingDrawerMember] = useState(null);

  const gridRef = useRef();

  // ✅ Fetch via server API (fast - parallel queries, token verified)
  const fetchData = useCallback(async () => {
    if (!selectedProgram || !user) return;
    setLoading(true);
    try {
      const { members, summary } = await fetchPaymentDataAPI(selectedProgram.id);

      // Attach agentName from Redux agentList
      const enriched = members.map((member) => {
        const agentFromList = agentList?.find(a => a.id === member.agentId);
        return {
          ...member,
          agentName: agentFromList?.name || agentFromList?.displayName || member.agentName || '',
        };
      });

      setMembersData(enriched);
      setSummaryStats(summary);
    } catch (err) {
      console.error(err);
      if (err.status === 401) {
        message.error('Session expired. Please login again.');
      } else {
        message.error('Failed to load payment data');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProgram, user, agentList]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = useMemo(() => {
    let data = [...membersData];
    if (searchText) {
      const s = searchText.toLowerCase();
      data = data.filter(r =>
        r.displayName?.toLowerCase().includes(s) ||
        r.fatherName?.toLowerCase().includes(s) ||
        r.registrationNumber?.toLowerCase().includes(s) ||
        r.phone?.includes(s)
      );
    }
    if (agentFilter) data = data.filter(r => r.agentId === agentFilter);
    if (statusFilter === 'pending') data = data.filter(r => r.totalPending > 0);
    else if (statusFilter === 'cleared') data = data.filter(r => r.paidPct === 100 && r.closingCount > 0);
    else if (statusFilter === 'partial') data = data.filter(r => r.totalPaid > 0 && r.paidPct < 100);
    else if (statusFilter === 'no_closings') data = data.filter(r => r.closingCount === 0);
    return data;
  }, [membersData, searchText, agentFilter, statusFilter]);

  const columnDefs = useMemo(() => [
    {
      field: 'displayName',
      headerName: 'Member',
      cellRenderer: ({ data: row }) => (
        <div className="flex items-center gap-2 h-full">
          <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${row.totalPending > 0 ? 'bg-red-400' : 'bg-green-400'}`} />
          <Avatar src={row.photoURL} size={32} className="flex-shrink-0"
            style={{ background: `hsl(${(row.displayName?.charCodeAt(0) || 0) * 7 % 360},55%,55%)`, fontSize: 12, fontWeight: 700 }}>
            {row.displayName?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate leading-tight">{row.displayName}</div>
            <div className="text-xs text-gray-400 truncate leading-tight">{row.registrationNumber}</div>
            {row.agentName && <div className="text-xs text-indigo-400 truncate leading-tight">↳ {row.agentName}</div>}
          </div>
        </div>
      )
    },
    {
      field: 'closingCount',
      headerName: 'Closings',
      cellRenderer: ({ data: row }) => (
        <div className="flex flex-col justify-center h-full gap-0.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-600">{row.paidClosingCount} paid</span>
            </span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-gray-600">{row.pendingClosingCount} due</span>
            </span>
          </div>
          <div className="text-xs text-gray-400">{row.closingCount} total · {fmt(row.payAmount)}/closing</div>
          {row.closingCount > 0 && (
            <Button type="text" size="small"
              className="p-0 h-auto text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 w-fit"
              icon={<EyeOutlined style={{ fontSize: 11 }} />}
              onClick={e => { e.stopPropagation(); setClosingDrawerMember(row); }}>
              View Closings
            </Button>
          )}
        </div>
      )
    },
    {
      field: 'totalAmount', headerName: 'Total',
      cellRenderer: ({ value }) => <span className="text-sm font-medium text-gray-500 tabular-nums">{fmt(value)}</span>
    },
    {
      field: 'totalPaid', headerName: 'Paid',
      cellRenderer: ({ value }) => (
        <span className={`text-sm font-semibold tabular-nums ${value > 0 ? 'text-green-600' : 'text-gray-300'}`}>
          {value > 0 ? fmt(value) : '—'}
        </span>
      )
    },
    {
      field: 'totalPending', headerName: 'Pending',
      cellRenderer: ({ value }) => (
        <span className={`text-sm font-semibold tabular-nums ${value > 0 ? 'text-red-500' : 'text-gray-300'}`}>
          {value > 0 ? fmt(value) : '—'}
        </span>
      )
    },
    {
      field: 'paidPct', headerName: 'Progress',
      cellRenderer: ({ data: row }) => {
        if (row.closingCount === 0) return <Tag style={{ fontSize: 11 }}>No closings</Tag>;
        return (
          <div className="flex flex-col justify-center h-full gap-1">
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full transition-all"
                style={{ width: `${row.paidPct}%`, background: row.paidPct === 100 ? '#10b981' : row.paidPct > 0 ? '#3b82f6' : '#f97316' }} />
            </div>
            <div className="text-xs text-gray-500">{row.paidPct}% cleared</div>
          </div>
        );
      }
    },
    {
      field: 'status', headerName: 'Status',
      cellRenderer: ({ data: row }) => {
        if (row.paidPct === 100 && row.closingCount > 0) return <Tag color="success" style={{ fontSize: 11 }}><CheckCircleOutlined /> Cleared</Tag>;
        if (row.totalPaid > 0) return <Tag color="processing" style={{ fontSize: 11 }}>Partial {row.paidPct}%</Tag>;
        if (row.closingCount > 0) return <Tag color="warning" style={{ fontSize: 11 }}>Pending</Tag>;
        return <Tag style={{ fontSize: 11 }}>No closings</Tag>;
      }
    }
  ], []);

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  const rowSelection = useMemo(() => ({
    mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false,
  }), []);

  const onSelectionChanged = useCallback(() => {
    setSelectedRows(gridRef.current?.api?.getSelectedRows() || []);
  }, []);

  const agentOptions = useMemo(() => {
    const memberAgentIds = new Set(membersData.map(m => m.agentId).filter(Boolean));
    return (agentList || []).filter(a => memberAgentIds.has(a.id)).map(a => ({
      id: a.id, name: a.name || a.displayName || a.id,
    }));
  }, [agentList, membersData]);

  const getRowStyle = useCallback(({ data }) => {
    if (data?.totalPending === 0 && data?.closingCount > 0) return { background: '#f0fdf4' };
    return null;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 m-0">Payment Management</h1>
            {selectedProgram && <p className="text-xs text-gray-400 m-0">{selectedProgram.name}</p>}
          </div>

        </div>

        {selectedProgram && (
          <Row gutter={[10, 10]}>
            {[
              { label: 'Total Members', value: summaryStats.total, color: '#6366f1', bg: '#eef2ff', icon: <TeamOutlined /> },
              { label: 'Total Amount', value: fmt(summaryStats.totalAmount), color: '#8b5cf6', bg: '#f5f3ff', icon: <DollarOutlined /> },
              { label: 'Total Paid', value: fmt(summaryStats.totalPaid), color: '#10b981', bg: '#ecfdf5', icon: <CheckCircleOutlined /> },
              { label: 'Total Pending', value: fmt(summaryStats.totalPending), color: '#f97316', bg: '#fff7ed', icon: <WarningOutlined /> },
              { label: 'Members w/ Dues', value: summaryStats.membersWithPending, color: '#ef4444', bg: '#fef2f2', icon: <UserOutlined /> },
            ].map(stat => (
              <Col key={stat.label} xs={12} sm={12} md={8} lg={6} xl={4}>
                <div className="bg-white rounded-xl border border-gray-100 px-3 py-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">{stat.label}</div>
                      <div className="text-base font-bold text-gray-900">
                        {loading ? <Spin size="small" /> : stat.value}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{ background: stat.bg, color: stat.color }}>{stat.icon}</div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}

        {selectedProgram && (
          <div className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Search placeholder="Search name, reg no, phone..."
                value={searchText} onChange={e => setSearchText(e.target.value)}
                allowClear size="small" className="flex-1" style={{ minWidth: 180 }} />
              <Select placeholder="All agents" size="small" style={{ minWidth: 150 }}
                value={agentFilter} onChange={setAgentFilter} allowClear showSearch>
                {agentOptions.map(a => <Option key={a.id} value={a.id}>{a.name}</Option>)}
              </Select>
              <Select placeholder="All status" allowClear size="small" style={{ minWidth: 130 }}
                value={statusFilter} onChange={setStatusFilter}>
                <Option value="pending">Pending</Option>
                <Option value="partial">Partial</Option>
                <Option value="cleared">Cleared</Option>
                <Option value="no_closings">No Closings</Option>
              </Select>
              <Button icon={<ReloadOutlined />} onClick={fetchData} size="small" type="text">Refresh</Button>
              {selectedRows.length > 0 && (
                <Button size="small" type="text"
                  onClick={() => { gridRef.current?.api?.deselectAll(); setSelectedRows([]); }}
                  icon={<CloseOutlined />}>Clear ({selectedRows.length})</Button>
              )}
            </div>
          </div>
        )}

        {selectedRows.length > 0 && (
          <Alert type="info" showIcon
            message={
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span>
                  <strong>{selectedRows.length}</strong> members selected ·
                  Total Pending: <strong className="text-orange-600">
                    {fmt(selectedRows.reduce((s, r) => s + (r.totalPending || 0), 0))}
                  </strong>
                </span>
                <Button size="small" type="primary" icon={<ThunderboltOutlined />}
                  onClick={() => setShowBulk(true)}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 border-0">
                  Process Bulk Payment
                </Button>
              </div>
            }
          />
        )}

        {selectedProgram ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ag-theme-alpine"
            style={{ height: '65vh', width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              rowData={filteredData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              loading={loading}
              rowHeight={70}
              pagination={true}
              paginationPageSize={100}
              paginationPageSizeSelector={[20, 50, 100]}
              rowSelection={rowSelection}
              onSelectionChanged={onSelectionChanged}
              getRowStyle={getRowStyle}
              suppressRowClickSelection={true}
              overlayLoadingTemplate='<span class="ag-overlay-loading-center">Loading members...</span>'
              overlayNoRowsTemplate='<span class="ag-overlay-loading-center">No members found</span>'
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <AppstoreOutlined className="text-indigo-400 text-2xl" />
            </div>
            <h3 className="text-gray-600 font-semibold mb-1">Select a Program</h3>
            <p className="text-gray-400 text-sm">Choose a program from above to view and manage payments</p>
          </div>
        )}
      </div>

      <BulkPaymentDrawer
        open={showBulk}
        onClose={() => setShowBulk(false)}
        selectedRows={selectedRows}
        programId={selectedProgram?.id}
        programName={selectedProgram?.name}
        user={user}
        onSuccess={() => {
          fetchData();
          gridRef.current?.api?.deselectAll();
          setSelectedRows([]);
        }}
      />

      <AddPaymentDrawer
        open={showAddPayment}
        onClose={() => setShowAddPayment(false)}
        programId={selectedProgram?.id}
        programName={selectedProgram?.name}
        programList={programList || []}
        user={user}
        onSuccess={fetchData}
      />

      <MemberClosingsDrawer
        open={!!closingDrawerMember}
        onClose={() => setClosingDrawerMember(null)}
        member={closingDrawerMember}
        programId={selectedProgram?.id}
        user={user}
      />
    </div>
  );
}