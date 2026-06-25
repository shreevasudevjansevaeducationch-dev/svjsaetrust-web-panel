'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react';
import {
    ClientSideRowModelModule, ModuleRegistry, NumberEditorModule,
    NumberFilterModule, PaginationModule, RowSelectionModule,
    TextEditorModule, TextFilterModule, ValidationModule, RowStyleModule
} from 'ag-grid-community';
import {
    EyeOutlined, EditOutlined, PlusCircleOutlined, FilterOutlined,
    ClearOutlined, CalendarOutlined, FilePdfOutlined,
    WalletOutlined, UserOutlined, CloseOutlined, CheckCircleFilled,
    ClockCircleFilled, TeamOutlined, DownOutlined
} from '@ant-design/icons';
import { MdOutlinePendingActions } from 'react-icons/md';
import { GrCertificate } from 'react-icons/gr';
import {
    Avatar, Button, Dropdown, Tag, Tooltip, Select,
    DatePicker, Modal, Badge, Divider, message, Spin
} from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { getData } from '@/lib/services/firebaseService';
import { useAuth } from '@/lib/AuthProvider';
import { BsThreeDots } from 'react-icons/bs';
import MemberDetailsView from '../MemberDetailsView';
import EditMember from '../EditMember';
import MemberCertificateCom from '../MemberCertificates';
import { FaFile } from 'react-icons/fa';
import MemberRegForm from '../MemberRegForm';
import { setgetMemberDataChange } from '@/redux/slices/commonSlice';
import ClosingForm from './ClosingForm';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { fetchSingleMemberMarriageReport } from '@/lib/helper';
import MemberPaymentDetails from './MemberPaymentDetails';
import MemberExportPDF from './MemberExportPDF';
import JoinFeesMemberList from './JoinFeesCom/JoinFeesMemberList';
import FixedPaymentGroups from '../FixedPaymentGroups';

dayjs.extend(isBetween);

const { Option } = Select;
const { RangePicker } = DatePicker;

ModuleRegistry.registerModules([
    NumberEditorModule, TextEditorModule, TextFilterModule,
    NumberFilterModule, RowSelectionModule, PaginationModule,
    ClientSideRowModelModule, ValidationModule, RowStyleModule
]);

// ── presets ────────────────────────────────────────────────────────────────────
const DATE_PRESETS = [
    { label: 'This week',     value: [dayjs().startOf('week'),                         dayjs().endOf('week')]                         },
    { label: 'This month',    value: [dayjs().startOf('month'),                        dayjs().endOf('month')]                        },
    { label: 'Last month',    value: [dayjs().subtract(1,'month').startOf('month'),    dayjs().subtract(1,'month').endOf('month')]    },
    { label: 'Last 3 months', value: [dayjs().subtract(3,'month'),                     dayjs()]                                       },
    { label: 'This year',     value: [dayjs().startOf('year'),                         dayjs().endOf('year')]                         },
];

const STATUS_OPTIONS = [
    { value: 'active',   label: 'Active',   color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    { value: 'blocked',  label: 'Blocked',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
];

const GENDER_OPTIONS = [
    { value: 'all',    label: 'All genders' },
    { value: 'male',   label: 'Male'        },
    { value: 'female', label: 'Female'      },
];

const JOIN_FEES_OPTIONS = [
    { value: 'all',     label: 'All',              icon: '·' },
    { value: 'pending', label: 'Pending',           icon: '⏳' },
    { value: 'paid',    label: 'Paid',              icon: '✓' },
];

// ── helpers ────────────────────────────────────────────────────────────────────
const countActive = ({ gender, agent, dateRange, joinFees, fixedPayment }) => {
    let n = 0;
    if (gender       !== 'all')  n++;
    if (agent)                   n++;
    if (dateRange)               n++;
    if (joinFees    !== 'all')   n++;
    if (fixedPayment !== 'all')  n++;
    return n;
};

// ── main component ─────────────────────────────────────────────────────────────
const MemberList = () => {
    const [allMembersData,       setAllMembersData]       = useState([]);
    const [filteredMembersData,  setFilteredMembersData]  = useState([]);
    const [isLoading,            setIsLoading]            = useState(false);

    const [selectedMember,       setSelectedMember]       = useState(null);
    const [isDetailsView,        setIsDetailsView]        = useState(false);
    const [isEditmemberOpen,     setIsEditmemberOpen]     = useState(false);
    const [isCertModalOpen,      setIsCertModalOpen]      = useState(false);
    const [isOpenRegModal,       setIsOpenRegModal]       = useState(false);
    const [isOpenClosingForm,    setIsOpenClosingForm]    = useState(false);
    const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);
    const [paymentReport,        setPaymentReport]        = useState(null);
    const [loadingReport,        setLoadingReport]        = useState(false);
    const [isExportOpen,         setIsExportOpen]         = useState(false);
    const [isFilterModalOpen,    setIsFilterModalOpen]    = useState(false);

    const [statusFilter,         setStatusFilter]         = useState('active');
    const [genderFilter,         setGenderFilter]         = useState('all');
    const [selectedAgentFilter,  setSelectedAgentFilter]  = useState(null);
    const [dateRange,            setDateRange]            = useState(null);
    const [joinFeesFilter,       setJoinFeesFilter]       = useState('all');
    const [fixedPaymentFilter,   setFixedPaymentFilter]   = useState('all');
    const [fixedPaymentGroups,   setFixedPaymentGroups]   = useState([]);

    const [draftStatus,          setDraftStatus]          = useState('active');
    const [draftGender,          setDraftGender]          = useState('all');
    const [draftAgent,           setDraftAgent]           = useState(null);
    const [draftDateRange,       setDraftDateRange]       = useState(null);
    const [draftJoinFees,        setDraftJoinFees]        = useState('all');
    const [draftFixedPayment,    setDraftFixedPayment]    = useState('all');

    const [isCertDownloading,    setIsCertDownloading]    = useState(false);
    const [JoinFeesMemberListOpen, setJoinFeesMemberListOpen] = useState(false);
    const [fixedPaymentGroupsOpen, setFixedPaymentGroupsOpen] = useState(false);

    const dispatch           = useDispatch();
    const memberStatusChange = useSelector(s => s.data.getMemberDataChange);
    const selectedProgram    = useSelector(s => s.data.selectedProgram);
    const agentList          = useSelector(s => s.data.agentList);
    const { agentsList }     = useSelector(s => s.data);
    const { user }           = useAuth();
    const gridRef            = useRef();

    const [windowWidth, setWindowWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 1200
    );

    const activeFilterCount = countActive({
        gender: genderFilter, agent: selectedAgentFilter,
        dateRange, joinFees: joinFeesFilter, fixedPayment: fixedPaymentFilter
    });

    const defaultColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 100 };

    const openFilterModal = () => {
        setDraftStatus(statusFilter);
        setDraftGender(genderFilter);
        setDraftAgent(selectedAgentFilter);
        setDraftDateRange(dateRange);
        setDraftJoinFees(joinFeesFilter);
        setDraftFixedPayment(fixedPaymentFilter);
        setIsFilterModalOpen(true);
    };

    const handleApplyFilters = () => {
        setStatusFilter(draftStatus);
        setGenderFilter(draftGender);
        setSelectedAgentFilter(draftAgent);
        setDateRange(draftDateRange);
        setJoinFeesFilter(draftJoinFees);
        setFixedPaymentFilter(draftFixedPayment);
        setIsFilterModalOpen(false);
    };

    const handleClearDrafts = () => {
        setDraftStatus('active');
        setDraftGender('all');
        setDraftAgent(null);
        setDraftDateRange(null);
        setDraftJoinFees('all');
        setDraftFixedPayment('all');
    };

    const removeFilter = (key) => {
        if (key === 'gender')       setGenderFilter('all');
        if (key === 'agent')        setSelectedAgentFilter(null);
        if (key === 'dateRange')    setDateRange(null);
        if (key === 'joinFees')     setJoinFeesFilter('all');
        if (key === 'fixedPayment') { setFixedPaymentFilter('all'); setDraftFixedPayment('all'); }
    };

    const applyFilters = useCallback((data, opts = {}) => {
        if (!data?.length) return data ?? [];
        const s  = opts.status       ?? statusFilter;
        const g  = opts.gender       ?? genderFilter;
        const ag = opts.agent        ?? selectedAgentFilter;
        const dr = opts.dateRange    ?? dateRange;
        const jf = opts.joinFees     ?? joinFeesFilter;
        const fp = opts.fixedPayment ?? fixedPaymentFilter;

        let out = [...data];

        if (s === 'active')
            out = out.filter(m => m.status === 'accepted' && m.active_flag === true && !m.delete_flag);
        else if (s === 'blocked')
            out = out.filter(m => m.status === 'blocked' && m.active_flag === false && !m.delete_flag);

        if (g !== 'all')
            out = out.filter(m => m.gender?.toLowerCase() === g);

        if (ag)
            out = out.filter(m => m.agentId === ag);

        if (jf === 'pending')
            out = out.filter(m => !m.joinFeesDone);
        else if (jf === 'paid')
            out = out.filter(m => !!m.joinFeesDone);

        if (fp === 'none') {
            out = out.filter(m => !m.isFixedAmountMember);
        } else if (fp === 'any') {
            out = out.filter(m => m.isFixedAmountMember === true);
        } else if (fp !== 'all') {
            const groupAmount = Number(fp);
            out = out.filter(m => m.isFixedAmountMember === true && Number(m.fixedAmount) === groupAmount);
        }

        if (dr?.[0] && dr?.[1]) {
            const start = dr[0].startOf('day');
            const end   = dr[1].endOf('day');
            out = out.filter(m => {
                if (!m.dateJoin) return false;
                const d = dayjs(m.dateJoin, ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD', undefined]);
                return d.isValid() && d.isBetween(start, end, null, '[]');
            });
        }

        return out;
    }, [statusFilter, genderFilter, selectedAgentFilter, dateRange, joinFeesFilter, fixedPaymentFilter]);

    const onGridReady = useCallback(async () => {
        if (!selectedProgram) return;
        setIsLoading(true);
        try {
            const [memberData, fpGroups] = await Promise.all([
                getData(
                    `/users/${user.uid}/programs/${selectedProgram.id}/members`,
                    [{ field: 'delete_flag', operator: '==', value: false }],
                    { field: 'createdAt', direction: 'desc' }
                ),
                getData(
                    `/users/${user.uid}/programs/${selectedProgram.id}/fixedPaymentGroups`,
                    [{ field: 'delete_flag', operator: '==', value: false }],
                    { field: 'createdAt', direction: 'desc' }
                ),
            ]);
            dispatch(setgetMemberDataChange(false));
            setAllMembersData(memberData);
            setFixedPaymentGroups(fpGroups);
            setFilteredMembersData(applyFilters(memberData));
        } catch (e) {
            console.error('Error fetching members:', e);
            message.error('Failed to load members');
        } finally {
            setIsLoading(false);
        }
    }, [selectedProgram, user, applyFilters, dispatch]);

    useEffect(() => {
        if (allMembersData.length) setFilteredMembersData(applyFilters(allMembersData));
    }, [statusFilter, genderFilter, selectedAgentFilter, dateRange, joinFeesFilter, fixedPaymentFilter, allMembersData, applyFilters]);

    useEffect(() => { onGridReady(); }, [selectedProgram, memberStatusChange]);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleShowPaymentDetails = async (data) => {
        setSelectedMember(data);
        setLoadingReport(true);
        setIsPaymentDetailsOpen(true);
        try {
            const res = await fetchSingleMemberMarriageReport({
                userId: user.uid, programId: selectedProgram.id, memberId: data.id
            });
            setPaymentReport(res);
        } catch (e) {
            console.error(e);
            message.error('Failed to load payment details');
        } finally {
            setLoadingReport(false);
        }
    };

    const previewCount = applyFilters(allMembersData, {
        status: draftStatus, gender: draftGender, agent: draftAgent,
        dateRange: draftDateRange, joinFees: draftJoinFees,
        fixedPayment: draftFixedPayment,
    }).length;

    const draftActiveCount = countActive({
        gender: draftGender, agent: draftAgent,
        dateRange: draftDateRange, joinFees: draftJoinFees,
        fixedPayment: draftFixedPayment,
    });

    const filterSummary = (() => {
        const parts = [`Status: ${STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}`];
        if (genderFilter !== 'all')       parts.push(`Gender: ${genderFilter}`);
        if (selectedAgentFilter)          parts.push(`Agent: ${agentsList?.find(a => a.id === selectedAgentFilter)?.displayName || ''}`);
        if (joinFeesFilter !== 'all')     parts.push(`Join Fees: ${joinFeesFilter === 'pending' ? 'Pending' : 'Paid'}`);
        if (fixedPaymentFilter !== 'all') parts.push(fixedPaymentFilter === 'none' ? 'Normal members' : fixedPaymentFilter === 'any' ? 'Fixed amount' : `Fixed ₹${Number(fixedPaymentFilter).toLocaleString('en-IN')}`);
        if (dateRange)                    parts.push(`Date: ${dateRange[0]?.format('DD/MM/YYYY')} – ${dateRange[1]?.format('DD/MM/YYYY')}`);
        return parts.join(' · ');
    })();

    const downloadMultipleCertificates = async (membersArray, selectedProgram) => {
        if (!membersArray || membersArray.length === 0) {
            message.warning('No members selected for certificate download');
            return;
        }
        setIsCertDownloading(true);
        const loadingMessage = message.loading('Generating certificates, please wait...', 0);
        const membersData = membersArray.map(member => ({
            ...member,
            agentPhone: agentsList?.find(a => a.id === member.agentId)?.phone || 'N/A',
            agentCode: agentsList?.find(a => a.id === member.agentId)?.agentCode
        }));
        try {
            const response = await fetch('/api/certificate-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberData: membersData, selectedProgram }),
            });
            const data = await response.json();
            const binaryString = atob(data.base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 100);
            message.success('Certificates generated successfully!');
        } catch (error) {
            console.error('Error:', error);
            message.error('Failed to generate certificates. Please try again.');
        } finally {
            loadingMessage();
            setIsCertDownloading(false);
        }
    };

    // ── column defs ────────────────────────────────────────────────────────────
    const COL_DEFS = [
        {
            field: 'displayName', cellDataType: 'text', headerName: 'Member', pinned: 'left', minWidth: 200,
            cellRenderer: ({ data }) => (
                <div className="flex items-center gap-2.5 py-1">
                    <div className="relative flex-shrink-0">
                        <Avatar
                            src={data.photoURL}
                            alt={data.displayName}
                            size={34}
                            style={{
                                background: data.gender === 'female' ? '#fce7f3' : '#dbeafe',
                                color: data.gender === 'female' ? '#be185d' : '#1d4ed8',
                                fontWeight: 600,
                                fontSize: 13
                            }}
                        >
                            {data.displayName?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <span
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                            style={{ background: data.joinFeesDone ? '#16a34a' : '#dc2626' }}
                        />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-gray-800 text-sm leading-tight truncate">{data.displayName}</span>
                        <span className="text-xs leading-tight mt-0.5" style={{
                            color: data.status === 'blocked' ? '#dc2626' : data.status === 'accepted' ? '#16a34a' : '#6b7280'
                        }}>
                            {data.status === 'blocked'  ? '⛔ Blocked'  :
                             data.delete_flag           ? 'Deleted'     :
                             data.status === 'closed'   ? 'Closed'      :
                             data.status === 'accepted' ? 'Active'      : 'Pending'}
                            {!data.joinFeesDone && (
                                <span className="ml-1 text-red-500">· Fees due</span>
                            )}
                        </span>
                    </div>
                </div>
            )
        },
        {
            field: 'fatherName', headerName: "Father's name", width: 150, cellDataType: 'text',
            cellRenderer: ({ data }) => <span className="text-sm text-gray-700">{data.fatherName || '—'}</span>
        },
        {
            field: 'jati', headerName: 'Surname', width: 130, cellDataType: 'text',
            cellRenderer: ({ data }) => <span className="text-sm text-gray-700">{data.jati || '—'}</span>
        },
        {
            field: 'registrationNumber', headerName: 'Reg. no.', width: 120, cellDataType: 'text',
            cellRenderer: ({ data }) => (
                <span className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    {data.registrationNumber || '—'}
                </span>
            )
        },
        {
            field: 'phone', headerName: 'Phone', width: 130, cellDataType: 'text',
            cellRenderer: ({ data }) => <span className="text-sm font-mono text-gray-700">{data.phone || '—'}</span>
        },
        {
            field: 'gender', headerName: 'Gender', width: 95,
            cellRenderer: ({ data }) => {
                const g = data.gender?.toLowerCase();
                if (!g) return <span className="text-gray-400 text-xs">—</span>;
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        g === 'male'   ? 'bg-blue-50 text-blue-700'   :
                        g === 'female' ? 'bg-pink-50 text-pink-700'   : 'bg-gray-100 text-gray-600'
                    }`}>
                        {g === 'male' ? '♂' : g === 'female' ? '♀' : g}
                        <span className="ml-1 capitalize">{g}</span>
                    </span>
                );
            }
        },
        {
            field: 'village', headerName: 'Village', width: 110, cellDataType: 'text',
            cellRenderer: ({ data }) => <span className="text-sm text-gray-700">{data.village || '—'}</span>
        },
        {
            field: 'addedByName', headerName: 'Created by',
            cellRenderer: ({ data }) => (
                <span className="text-sm text-gray-500">{data.addedByName || '—'}</span>
            )
        },
        {
            field: 'aadhaarNo', headerName: 'Aadhaar', cellDataType: 'text',
            cellRenderer: ({ data }) => (
                <span className="text-sm font-mono text-gray-600">{data.aadhaarNo || '—'}</span>
            )
        },
        {
            field: 'payAmount', headerName: 'D. amount',
            cellRenderer: ({ data }) => (
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${data.processedColorClass}`} />
                    <span className="text-sm font-medium text-gray-800">{data.payAmount}</span>
                </div>
            )
        },
        {
            field: 'joinFeesDone', headerName: 'Join fees', width: 110,
            cellRenderer: ({ data }) => (
                data.joinFeesDone
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <CheckCircleFilled style={{ fontSize: 10 }} /> Paid
                      </span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                        <ClockCircleFilled style={{ fontSize: 10 }} /> Pending
                      </span>
            )
        },
        {
            field: 'isFixedAmountMember', headerName: 'Payment type', width: 140,
            cellRenderer: ({ data }) => (
                data.isFixedAmountMember
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                        ₹{Number(data.fixedAmount || 15200).toLocaleString('en-IN')} fixed
                      </span>
                    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                        Normal
                      </span>
            )
        },
        {
            field: 'ageGroupRange', headerName: 'Age group', width: 110, cellDataType: 'text',
            cellRenderer: ({ data }) => <span className="text-sm text-gray-600">{data.ageGroupRange || '—'}</span>
        },
        {
            field: 'createdAt', headerName: 'Join date', width: 110,
            cellRenderer: ({ data }) => (
                <span className="text-sm text-gray-500">{data.dateJoin || '—'}</span>
            )
        },
        {
            field: 'Action', headerName: 'Actions', pinned: 'right', width: 130, filter: false, sortable: false,
            cellRenderer: ({ data }) => {
                const isDeleted = data.delete_flag === true;
                const isBlocked = data.status === 'blocked';
                const isClosed  = data.status === 'closed' && data.marriage_flag === true;

                const dropdownItems = [
                    {
                        key: '0',
                        disabled: isDeleted || isBlocked || isClosed,
                        label: (
                            <button
                                onClick={() => { setSelectedMember(data); setIsOpenClosingForm(true); }}
                                disabled={isDeleted || isBlocked || isClosed}
                                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-700 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <PlusCircleOutlined /> Close form
                            </button>
                        ),
                    },
                    {
                        key: '1',
                        disabled: isDeleted,
                        label: (
                            <button
                                onClick={() => { setSelectedMember(data); setIsCertModalOpen(true); }}
                                disabled={isDeleted}
                                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-700 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <GrCertificate /> Certificate
                            </button>
                        ),
                    },
                    {
                        key: '2',
                        disabled: isDeleted || isBlocked || isClosed,
                        label: (
                            <button
                                onClick={() => handleShowPaymentDetails(data)}
                                disabled={isDeleted || isBlocked || isClosed}
                                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-700 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <MdOutlinePendingActions /> Payment details
                            </button>
                        ),
                    },
                    {
                        key: '3',
                        disabled: isDeleted,
                        label: (
                            <button
                                onClick={() => { setSelectedMember(data); setIsOpenRegModal(true); }}
                                disabled={isDeleted}
                                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-700 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <FaFile /> Reg form
                            </button>
                        ),
                    },
                ].filter(i => !i.disabled);

                return (
                    <div className="flex items-center gap-1.5">
                        <Tooltip title="View details">
                            <button
                                onClick={() => { setSelectedMember(data); setIsDetailsView(true); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                            >
                                <EyeOutlined style={{ fontSize: 13 }} />
                            </button>
                        </Tooltip>
                        <Tooltip title="Edit member">
                            <button
                                onClick={() => { setSelectedMember(data); setIsEditmemberOpen(true); }}
                                disabled={isDeleted || isBlocked || isClosed}
                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <EditOutlined style={{ fontSize: 13 }} />
                            </button>
                        </Tooltip>
                        <Dropdown menu={{ items: dropdownItems }} trigger={['click']} disabled={isDeleted}>
                            <button
                                disabled={isDeleted}
                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <BsThreeDots style={{ fontSize: 13 }} />
                            </button>
                        </Dropdown>
                    </div>
                );
            }
        },
    ];

    // ── active status indicator ─────────────────────────────────────────────────
    const currentStatus = STATUS_OPTIONS.find(o => o.value === statusFilter);

    // ── render ─────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-3">

            {/* ══════════════════ TOOLBAR ══════════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Top row: actions */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-wrap gap-2">

                    {/* Left: filter button + active status pill */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                            count={activeFilterCount}
                            size="small"
                            offset={[-3, 3]}
                            style={{ backgroundColor: '#4f46e5' }}
                        >
                            <button
                                onClick={openFilterModal}
                                className={`inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium border transition-all ${
                                    activeFilterCount > 0
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                }`}
                            >
                                <FilterOutlined style={{ fontSize: 14 }} />
                                Filters
                            </button>
                        </Badge>

                        {/* Status pill */}
                        <span
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-medium border"
                            style={{
                                background: currentStatus?.bg,
                                borderColor: currentStatus?.border,
                                color: currentStatus?.color
                            }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: currentStatus?.color }} />
                            {currentStatus?.label} members
                        </span>
                    </div>

                    {/* Right: action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setFixedPaymentGroupsOpen(true)}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors"
                        >
                            <WalletOutlined style={{ fontSize: 14 }} />
                            Fixed payment
                        </button>
                        <button
                            onClick={() => setJoinFeesMemberListOpen(true)}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 transition-colors"
                        >
                            <TeamOutlined style={{ fontSize: 14 }} />
                            Join fees list
                        </button>
                        <button
                            onClick={() => downloadMultipleCertificates(filteredMembersData, selectedProgram)}
                            disabled={isCertDownloading || filteredMembersData.length === 0}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isCertDownloading ? (
                                <><Spin size="small" /> Generating…</>
                            ) : (
                                <><FilePdfOutlined style={{ fontSize: 14 }} /> Certificates</>
                            )}
                        </button>
                        <button
                            onClick={() => setIsExportOpen(true)}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
                        >
                            <FilePdfOutlined style={{ fontSize: 14 }} />
                            Export PDF
                        </button>
                    </div>
                </div>

                {/* Bottom row: active filter chips + count */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 flex-wrap gap-2 min-h-[40px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {activeFilterCount === 0 ? (
                            <span className="text-xs text-gray-400">No additional filters active</span>
                        ) : (
                            <>
                                {genderFilter !== 'all' && (
                                    <FilterChip
                                        label={genderFilter === 'male' ? '♂ Male' : '♀ Female'}
                                        color={genderFilter === 'male' ? 'blue' : 'pink'}
                                        onRemove={() => removeFilter('gender')}
                                    />
                                )}
                                {selectedAgentFilter && (
                                    <FilterChip
                                        label={`Agent: ${agentsList?.find(a => a.id === selectedAgentFilter)?.displayName || selectedAgentFilter}`}
                                        color="violet"
                                        onRemove={() => removeFilter('agent')}
                                    />
                                )}
                                {joinFeesFilter !== 'all' && (
                                    <FilterChip
                                        label={joinFeesFilter === 'pending' ? '⏳ Fees pending' : '✓ Fees paid'}
                                        color={joinFeesFilter === 'pending' ? 'red' : 'green'}
                                        onRemove={() => removeFilter('joinFees')}
                                    />
                                )}
                                {fixedPaymentFilter !== 'all' && (
                                    <FilterChip
                                        label={
                                            fixedPaymentFilter === 'none' ? 'Normal members' :
                                            fixedPaymentFilter === 'any'  ? 'Any fixed amount' :
                                            `₹${Number(fixedPaymentFilter).toLocaleString('en-IN')} fixed`
                                        }
                                        color="violet"
                                        onRemove={() => removeFilter('fixedPayment')}
                                    />
                                )}
                                {dateRange && (
                                    <FilterChip
                                        label={`📅 ${dateRange[0]?.format('DD/MM/YY')} – ${dateRange[1]?.format('DD/MM/YY')}`}
                                        color="amber"
                                        onRemove={() => removeFilter('dateRange')}
                                    />
                                )}
                                <button
                                    onClick={() => { setGenderFilter('all'); setSelectedAgentFilter(null); setDateRange(null); setJoinFeesFilter('all'); setFixedPaymentFilter('all'); }}
                                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-0.5 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    <ClearOutlined style={{ fontSize: 11 }} /> Clear all
                                </button>
                            </>
                        )}
                    </div>
                    <span className="text-xs font-semibold text-gray-500 bg-white px-3 py-1 rounded-lg border border-gray-200 tabular-nums">
                        {filteredMembersData.length.toLocaleString('en-IN')} members
                    </span>
                </div>
            </div>

            {/* ══════════════════ AG GRID ══════════════════════════════════════ */}
            <div
                className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
                style={{ height: windowWidth < 768 ? '70vh' : '65vh' }}
            >
                <AgGridReact
                    ref={gridRef}
                    rowData={filteredMembersData}
                    loading={isLoading}
                    defaultColDef={defaultColDef}
                    columnDefs={COL_DEFS}
                    pagination={true}
                    onGridReady={onGridReady}
                    rowHeight={52}
                    headerHeight={40}
                    suppressCellFocus={true}
                    overlayLoadingTemplate='<span class="ag-overlay-loading-center">Loading members…</span>'
                    overlayNoRowsTemplate='<span class="ag-overlay-loading-center">No members found</span>'
                />
            </div>

            {/* ══════════════════ FILTER MODAL ══════════════════════════════════ */}
            <Modal
                open={isFilterModalOpen}
                onCancel={() => setIsFilterModalOpen(false)}
                footer={null}
                width={540}
                centered
                closable={false}
                styles={{ body: { padding: 0 } }}
                className="filter-modal"
            >
                {/* Modal header */}
                <div className="flex items-center justify-between   border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <FilterOutlined style={{ fontSize: 15, color: '#4f46e5' }} />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800 text-sm leading-none">Filter members</p>
                            {draftActiveCount > 0 && (
                                <p className="text-xs text-indigo-600 mt-0.5">{draftActiveCount} filter{draftActiveCount > 1 ? 's' : ''} active</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setIsFilterModalOpen(false)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <CloseOutlined style={{ fontSize: 13 }} />
                    </button>
                </div>

                <div className=" space-y-3 mt-2">
                    {/* Status */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Member status
                        </label>
                        <div className="flex gap-2">
                            {STATUS_OPTIONS.map(o => (
                                <button
                                    key={o.value}
                                    onClick={() => setDraftStatus(o.value)}
                                    className="flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl border text-sm font-medium transition-all"
                                    style={draftStatus === o.value ? {
                                        background: o.bg,
                                        borderColor: o.border,
                                        color: o.color,
                                    } : {
                                        background: '#fff',
                                        borderColor: '#e5e7eb',
                                        color: '#6b7280'
                                    }}
                                >
                                    <span className="w-2 h-2 rounded-full" style={{ background: draftStatus === o.value ? o.color : '#d1d5db' }} />
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Gender
                        </label>
                        <div className="flex gap-2">
                            {GENDER_OPTIONS.map(o => (
                                <button
                                    key={o.value}
                                    onClick={() => setDraftGender(o.value)}
                                    className={`flex-1 h-10 px-3 rounded-xl border text-sm font-medium transition-all ${
                                        draftGender === o.value
                                            ? o.value === 'male'   ? 'bg-blue-50 border-blue-300 text-blue-700'
                                            : o.value === 'female' ? 'bg-pink-50 border-pink-300 text-pink-700'
                                            : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                                >
                                    {o.value === 'male' && '♂ '}{o.value === 'female' && '♀ '}{o.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Join fees */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Join fees status
                        </label>
                        <div className="flex gap-2">
                            {JOIN_FEES_OPTIONS.map(o => (
                                <button
                                    key={o.value}
                                    onClick={() => setDraftJoinFees(o.value)}
                                    className={`flex-1 h-10 px-3 rounded-xl border text-sm font-medium transition-all ${
                                        draftJoinFees === o.value
                                            ? o.value === 'pending' ? 'bg-red-50 border-red-300 text-red-700'
                                            : o.value === 'paid'    ? 'bg-green-50 border-green-300 text-green-700'
                                            : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>

               

                    <div className='grid grid-cols-2 gap-1'>
                             {/* Agent */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Agent
                        </label>
                        <Select
                            value={draftAgent}
                            onChange={setDraftAgent}
                            className="w-full"
                            size="large"
                            placeholder="All agents"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                            options={agentsList?.map(a => ({ value: a.id, label: a.displayName }))}
                            optionRender={(opt) => (
                                <div className="flex items-center gap-2">
                                    <Avatar size={20} style={{ backgroundColor: '#7c3aed', fontSize: 10 }}>
                                        {opt.label?.charAt(0)?.toUpperCase()}
                                    </Avatar>
                                    <span>{opt.label}</span>
                                </div>
                            )}
                        />
                    </div>
                          {/* Fixed payment */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Fixed payment group
                        </label>
                        <Select
                            value={draftFixedPayment}
                            onChange={setDraftFixedPayment}
                            className="w-full"
                            size="large"
                            placeholder="All members"
                        >
                            <Option value="all">All members</Option>
                            <Option value="any">Any fixed amount member</Option>
                            <Option value="none">Normal members (no fixed)</Option>
                            {fixedPaymentGroups.map(g => (
                                <Option key={g.id} value={String(g.fixedAmount)}>
                                    {g.name} — ₹{Number(g.fixedAmount).toLocaleString('en-IN')}
                                </Option>
                            ))}
                        </Select>
                    </div>
                    </div>

                    {/* Date range */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Join date range
                        </label>
                        <RangePicker
                            value={draftDateRange}
                            onChange={setDraftDateRange}
                            className="w-full"
                            size="large"
                            format="DD/MM/YYYY"
                            allowClear
                            placeholder={['From date', 'To date']}
                            suffixIcon={<CalendarOutlined className="text-orange-400" />}
                        />
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {DATE_PRESETS.map(p => (
                                <button
                                    key={p.label}
                                    onClick={() => setDraftDateRange(p.value)}
                                    className={`px-3 py-1 text-xs rounded-lg border font-medium transition-all ${
                                        draftDateRange?.[0]?.isSame(p.value[0], 'day') &&
                                        draftDateRange?.[1]?.isSame(p.value[1], 'day')
                                            ? 'bg-amber-400 text-white border-amber-400'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-700'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
              
                </div>

                {/* Modal footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <div>
                        <span className="text-sm text-gray-500">
                            <span className="font-semibold text-gray-800 text-base">{previewCount.toLocaleString('en-IN')}</span>
                            <span className="ml-1">members match</span>
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleClearDrafts}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <ClearOutlined style={{ fontSize: 13 }} /> Clear all
                        </button>
                        <button
                            onClick={handleApplyFilters}
                            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-medium text-white transition-colors"
                        >
                            Apply filters
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ══════════════════ OTHER MODALS ══════════════════════════════════ */}
            <MemberExportPDF
                open={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                members={filteredMembersData}
                filterSummary={filterSummary}
                programName={selectedProgram?.name || ''}
            />
            {JoinFeesMemberListOpen && (
                <JoinFeesMemberList
                    onSuccess={onGridReady}
                    selectedProgram={selectedProgram}
                    agentData={agentsList?.find(a => a.id === draftAgent)}
                    membersData={filteredMembersData}
                    open={JoinFeesMemberListOpen}
                    onClose={() => setJoinFeesMemberListOpen(false)}
                />
            )}
            <FixedPaymentGroups
                open={fixedPaymentGroupsOpen}
                onClose={() => setFixedPaymentGroupsOpen(false)}
            />
            <MemberDetailsView
                isModalVisible={isDetailsView}
                handleCloseModal={() => setIsDetailsView(false)}
                showDeleteConfirm={false}
                selectedMember={selectedMember}
            />
            <EditMember
                open={isEditmemberOpen}
                setOpen={setIsEditmemberOpen}
                memberData={selectedMember}
                programId={selectedProgram?.id}
                onSuccess={onGridReady}
            />
            <MemberCertificateCom
                open={isCertModalOpen}
                onClose={() => setIsCertModalOpen(false)}
                memberData={selectedMember}
            />
            <MemberRegForm
                open={isOpenRegModal}
                onClose={() => setIsOpenRegModal(false)}
                memberData={selectedMember}
            />
            {isOpenClosingForm && (
                <ClosingForm
                    open={isOpenClosingForm}
                    onClose={() => setIsOpenClosingForm(false)}
                    memberData={selectedMember}
                    user={user}
                    selectedProgram={selectedProgram}
                    onSuccess={onGridReady}
                />
            )}
            <MemberPaymentDetails
                visible={isPaymentDetailsOpen}
                onClose={() => { setIsPaymentDetailsOpen(false); setPaymentReport(null); }}
                memberData={selectedMember}
                paymentReport={paymentReport}
                loading={loadingReport}
            />
        </div>
    );
};

// ── FilterChip sub-component ───────────────────────────────────────────────────
const colorMap = {
    blue:   { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    pink:   { bg: '#fdf2f8', border: '#fbcfe8', text: '#be185d' },
    violet: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
    red:    { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
    green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    amber:  { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
};

const FilterChip = ({ label, color = 'blue', onRemove }) => {
    const c = colorMap[color] || colorMap.blue;
    return (
        <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border"
            style={{ background: c.bg, borderColor: c.border, color: c.text }}
        >
            {label}
            <button
                onClick={onRemove}
                className="ml-0.5 rounded-sm hover:opacity-70 transition-opacity"
                style={{ color: c.text }}
            >
                <CloseOutlined style={{ fontSize: 10 }} />
            </button>
        </span>
    );
};

export default MemberList;