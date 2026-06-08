import React, { useEffect, useState, useMemo } from 'react'
import {
    Drawer, message, Table, Button,
    Typography, Tag, Modal, Select, Input, Radio,
    Space
} from 'antd'
import {
    DeleteOutlined,
    ExclamationCircleOutlined,
    ReloadOutlined,
    WarningOutlined,
    SearchOutlined,
    UserOutlined,
    TeamOutlined,
    CheckOutlined,
    CloseOutlined
} from '@ant-design/icons'
import {
    collection, getDocs, doc, deleteDoc, query, where,
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { db } from '@/lib/firebase'

const { Text } = Typography

/* ─── Design tokens ─────────────────────────────────────────────────── */
const t = {
    red:   { bg: '#fff1f0', border: '#ffa39e', text: '#cf1322' },
    amber: { bg: '#fffbe6', border: '#ffe58f', text: '#d46b08' },
    green: { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d' },
    blue:  { bg: '#e6f4ff', border: '#91caff', text: '#0958d9' },
}

const styles = {
    sectionLabel: {
        fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: '#8c8c8c',
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
    },
    statsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: 10, margin: '14px 0',
    },
    statCard: {
        background: '#fafafa', borderRadius: 8,
        padding: '12px 14px', border: '0.5px solid #f0f0f0',
    },
    statLabel: {
        fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: '#8c8c8c', marginBottom: 4,
    },
    statValue: (color) => ({
        fontSize: 22, fontWeight: 500, lineHeight: 1, color: color || 'inherit',
    }),
    warningBox: {
        background: t.red.bg, border: `0.5px solid ${t.red.border}`,
        borderRadius: 8, padding: '12px 14px', marginTop: 16,
    },
    infoBox: {
        background: t.blue.bg, border: `0.5px solid ${t.blue.border}`,
        borderRadius: 8, padding: '12px 14px', marginBottom: 14,
    },
    infoBoxTitle: {
        fontSize: 13, fontWeight: 600, color: t.blue.text,
        marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
    },
    breakdownGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: 8, maxHeight: 180, overflow: 'auto', margin: '10px 0 14px',
    },
    breakdownCard: {
        background: '#fff', border: '0.5px solid #f0f0f0',
        borderRadius: 8, padding: '10px 12px',
    },
    footer: {
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '0.5px solid #f0f0f0',
    },
    deletePill: {
        fontSize: 11, padding: '2px 8px', borderRadius: 999,
        background: 'rgba(255,255,255,0.25)', color: '#fff',
        fontWeight: 600, marginLeft: 6,
        border: '0.5px solid rgba(255,255,255,0.3)',
    },
}

/* ─── Component ──────────────────────────────────────────────────────── */
const DeleteUnlinkedPayments = ({ open, setOpen, user, selectedProgram,allClosingMembers }) => {
    const [loading, setLoading]                         = useState(false)
    const [deleting, setDeleting]                       = useState(false)
    const [unlinkedPayments, setUnlinkedPayments]       = useState([])
    const [selectedRowKeys, setSelectedRowKeys]         = useState([])
    const [searchText, setSearchText]                   = useState('')
    const [deleteMode, setDeleteMode]                   = useState('all')
    const [selectedClosingMemberIds, setSelectedClosingMemberIds] = useState([])
    // const [allClosingMembers, setAllClosingMembers]     = useState([]) // Store only real members
    const [stats, setStats]                             = useState({ totalUnlinked: 0, byClosingMember: {}, totalAmount: 0 })

    // ── FIX: controlled modal state instead of Modal.confirm() ──
    const [confirmModalOpen, setConfirmModalOpen]       = useState(false)
    const [pendingDeleteIds, setPendingDeleteIds]       = useState([])

    // Prepare options with useMemo to avoid duplicates
    const closingMemberOptions = useMemo(() => {
        const options = allClosingMembers.map(member => ({
            label: `${member.displayName} (${member.registrationNumber || 'N/A'}) — ${member.closingGroupName || 'No Group'}`,
            value: member.id,
            data: member,
        }))
        return options
    }, [allClosingMembers])



    // Handle select change - simplified
    const handleClosingMemberChange = (values) => {
        // Filter out any potential undefined or null values
        const cleanValues = values.filter(v => v && v !== 'SELECT_ALL')
        setSelectedClosingMemberIds(cleanValues)
        setSelectedRowKeys([])
    }

    // Select all members
    const handleSelectAll = () => {
        const allIds = allClosingMembers.map(m => m.id)
        setSelectedClosingMemberIds(allIds)
        setSelectedRowKeys([])
        message.success(`Selected ${allIds.length} closing members`)
    }

    // Clear all selections
    const handleClearAll = () => {
        setSelectedClosingMemberIds([])
        setSelectedRowKeys([])
        message.info('Cleared all selections')
    }

    /* ── fetch unlinked payments ── */
    const fetchUnlinkedPayments = async () => {
        if (!user?.uid || !selectedProgram?.id) return
        if (!selectedClosingMemberIds.length) {
            setUnlinkedPayments([])
            setStats({ totalUnlinked: 0, byClosingMember: {}, totalAmount: 0 })
            return
        }
        setLoading(true)
        try {
            const ref  = collection(db, `users/${user.uid}/programs/${selectedProgram.id}/payment_pending`)
            const snap = await getDocs(query(ref, where('delete_flag', '==', false)))
            const selectedSet = new Set(selectedClosingMemberIds)
            const unlinked = []
            let totalAmount = 0
            const byClosingMember = {}

            for (const payDoc of snap.docs) {
                const data = payDoc.data()
                if (!selectedSet.has(data.closingMemberId)) {
                    const amt = data.payAmount || 200
                    totalAmount += amt
                    const cid = data.closingMemberId
                    if (!byClosingMember[cid]) {
                        byClosingMember[cid] = {
                            count: 0, amount: 0,
                            name: data.paymentFor || cid,
                            regNo: data.closingRegNo || 'N/A',
                        }
                    }
                    byClosingMember[cid].count++
                    byClosingMember[cid].amount += amt
                    unlinked.push({
                        key: payDoc.id, id: payDoc.id, ...data,
                        createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
                    })
                }
            }
            setUnlinkedPayments(unlinked)
            setStats({ totalUnlinked: unlinked.length, byClosingMember, totalAmount })
        } catch (e) {
            console.error(e)
            message.error('Failed to fetch payment entries: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    /* ── step 1: collect IDs and open the controlled modal ── */
    const handleDeletePayments = () => {
        const ids = deleteMode === 'all'
            ? unlinkedPayments.map(p => p.id)
            : selectedRowKeys

        if (!ids.length) {
            message.warning(deleteMode === 'all'
                ? 'No payments to delete'
                : 'Select at least one entry')
            return
        }

        setPendingDeleteIds(ids)
        setConfirmModalOpen(true)
    }

    /* ── step 2: execute deletion after user confirms in modal ── */
    const executeDelete = async () => {
        setConfirmModalOpen(false)
        setDeleting(true)
        let success = 0, errors = 0

        for (const id of pendingDeleteIds) {
            try {
                await deleteDoc(
                    doc(db, `users/${user.uid}/programs/${selectedProgram.id}/payment_pending/${id}`)
                )
                success++
            } catch (err) {
                console.error(`Error deleting ${id}:`, err)
                errors++
            }
        }

        if (success) message.success(`Deleted ${success} payment ${success === 1 ? 'entry' : 'entries'}`)
        if (errors)  message.error(`Failed to delete ${errors} ${errors === 1 ? 'entry' : 'entries'}`)

        setSelectedRowKeys([])
        setPendingDeleteIds([])
        setDeleting(false)
        await fetchUnlinkedPayments()
    }

    /* ── search filter ── */
    const filteredPayments = unlinkedPayments.filter(p => {
        if (!searchText) return true
        const s = searchText.toLowerCase()
        return (
            p.paymentFor?.toLowerCase().includes(s) ||
            p.memberDetails?.displayName?.toLowerCase().includes(s) ||
            p.closingRegNo?.toLowerCase().includes(s) ||
            p.memberDetails?.registrationNumber?.toLowerCase().includes(s) ||
            p.memberDetails?.phone?.toLowerCase().includes(s)
        )
    })

    useEffect(() => {
        if (open && user?.uid && selectedProgram?.id) {
            // fetchClosingMembers()
            // Reset selections when drawer opens
            setSelectedClosingMemberIds([])
            setSelectedRowKeys([])
            setSearchText('')
        }
    }, [open, user?.uid, selectedProgram?.id])

    useEffect(() => {
        if (selectedClosingMemberIds.length > 0) {
            fetchUnlinkedPayments()
        } else {
            setUnlinkedPayments([])
            setStats({ totalUnlinked: 0, byClosingMember: {}, totalAmount: 0 })
        }
    }, [selectedClosingMemberIds])

    /* ── table columns ── */
    const columns = [
        {
            title: '#', key: 'index', width: 48,
            render: (_, __, i) => <span style={{ color: '#8c8c8c', fontSize: 12 }}>{i + 1}</span>,
        },
        {
            title: 'Closing member', dataIndex: 'paymentFor', key: 'paymentFor', width: 190,
            render: (text, record) => (
                <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{text || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Reg: {record.closingRegNo || 'N/A'}</div>
                    {record.closingFatherName && (
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Father: {record.closingFatherName}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Paying member', dataIndex: 'memberDetails', key: 'memberDetails', width: 190,
            render: (details, record) => (
                <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{details?.displayName || record.memberId}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Reg: {details?.registrationNumber || 'N/A'}</div>
                    {details?.phone && <div style={{ fontSize: 11, color: '#8c8c8c' }}>Ph: {details.phone}</div>}
                </div>
            ),
        },
        {
            title: 'Amount', dataIndex: 'payAmount', key: 'payAmount', width: 90,
            render: (amt) => <span style={{ fontWeight: 500 }}>₹{amt || 200}</span>,
        },
        {
            title: 'Due date', dataIndex: 'dueDate', key: 'dueDate', width: 110,
            render: (d) => {
                const overdue = d && dayjs(d, 'DD-MM-YYYY').isBefore(dayjs())
                return <Tag color={overdue ? 'red' : 'blue'} style={{ fontSize: 11 }}>{d || 'N/A'}</Tag>
            },
        },
        {
            title: 'Status', key: 'status', width: 100,
            render: () => (
                <Tag icon={<WarningOutlined />} color="orange" style={{ fontSize: 11 }}>Not linked</Tag>
            ),
        },
        {
            title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 130,
            render: (d) => (
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>{dayjs(d).format('DD-MM-YYYY HH:mm')}</span>
            ),
        },
    ]

    const rowSelection = {
        selectedRowKeys,
        onChange: setSelectedRowKeys,
        getCheckboxProps: () => ({ disabled: deleteMode === 'all' }),
    }

    const deleteCount = deleteMode === 'all' ? unlinkedPayments.length : selectedRowKeys.length

    const handleClose = () => {
        setOpen(false)
        setSelectedClosingMemberIds([])
        setSelectedRowKeys([])
        setSearchText('')
        setAllClosingMembers([])
    }

    // Custom dropdown renderer with select all in menu
    const dropdownRender = (menu) => {
        return (
            <div>
                <div style={{ 
                    padding: '8px 12px', 
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontWeight: 500, fontSize: 12 }}>Quick Actions</span>
                    <Space size={8}>
                        <Button 
                            type="link" 
                            size="small"
                            onClick={handleSelectAll}
                            icon={<CheckOutlined />}
                        >
                            Select All ({allClosingMembers.length})
                        </Button>
                        <Button 
                            type="link" 
                            size="small"
                            onClick={handleClearAll}
                            icon={<CloseOutlined />}
                        >
                            Clear All
                        </Button>
                    </Space>
                </div>
                {menu}
            </div>
        )
    }

    return (
        <>
            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                        <DeleteOutlined style={{ color: t.red.text }} />
                        Delete unlinked payment entries
                    </div>
                }
                placement="right"
                onClose={handleClose}
                open={open}
                width="82%"
                bodyStyle={{ padding: '18px 20px' }}
                destroyOnHidden
                footer={
                    <div style={styles.footer}>
                        <Button onClick={handleClose}>Close</Button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 13, color: '#8c8c8c' }}>
                                {deleteMode === 'all'
                                    ? `${unlinkedPayments.length} entries will be deleted`
                                    : `${selectedRowKeys.length} of ${unlinkedPayments.length} selected`}
                            </span>
                            <Button
                                danger
                                type="primary"
                                icon={<DeleteOutlined />}
                                onClick={handleDeletePayments}
                                loading={deleting}
                                disabled={deleteCount === 0}
                            >
                                {deleteMode === 'all' ? 'Delete all unlinked' : 'Delete selected'}
                                {deleteCount > 0 && (
                                    <span style={styles.deletePill}>{deleteCount}</span>
                                )}
                            </Button>
                        </div>
                    </div>
                }
            >
                {/* ── Closing member select with Select All option ── */}
                <div style={{ marginBottom: 14 }}>
                    <div style={styles.sectionLabel}>
                        <TeamOutlined /> Select closing members (marriage cases)
                    </div>
                    <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        placeholder="Search by name, reg. no. or group…"
                        value={selectedClosingMemberIds}
                        onChange={handleClosingMemberChange}
                        options={closingMemberOptions}
                        showSearch
                        filterOption={(input, opt) => {
                            return opt.label.toLowerCase().includes(input.toLowerCase())
                        }}
                        loading={allClosingMembers.length === 0}
                        maxTagCount="responsive"
                        maxTagPlaceholder={(o) => `+${o.length} more`}
                        notFoundContent="No closing members found"
                        dropdownRender={dropdownRender}
                    />
                    {selectedClosingMemberIds.length > 0 && (
                        <div style={{ fontSize: 12, color: '#52c41a', marginTop: 5 }}>
                            ✓ {selectedClosingMemberIds.length} closing member{selectedClosingMemberIds.length > 1 ? 's' : ''} selected
                        </div>
                    )}
                    {!selectedClosingMemberIds.length && allClosingMembers.length > 0 && (
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 5 }}>
                            Select one or more closing members to scan for unlinked payments. Total available: {allClosingMembers.length}
                        </div>
                    )}
                </div>

                {selectedClosingMemberIds.length > 0 && (
                    <>
                        {/* ── Info box ── */}
                        <div style={styles.infoBox}>
                            <div style={styles.infoBoxTitle}>
                                <ExclamationCircleOutlined /> What are unlinked entries?
                            </div>
                            <div style={{ fontSize: 13, color: '#595959' }}>
                                Payment entries whose closing member is <strong>not</strong> in your{' '}
                                {selectedClosingMemberIds.length} selected member
                                {selectedClosingMemberIds.length > 1 ? 's' : ''}. These can be safely deleted.
                            </div>
                        </div>

                        {/* ── Stats row ── */}
                        <div style={styles.statsGrid}>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Unlinked entries</div>
                                <div style={styles.statValue(t.amber.text)}>{stats.totalUnlinked}</div>
                            </div>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Total amount</div>
                                <div style={styles.statValue(t.red.text)}>₹{stats.totalAmount.toLocaleString()}</div>
                            </div>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Selected members</div>
                                <div style={styles.statValue(t.green.text)}>{selectedClosingMemberIds.length}</div>
                            </div>
                        </div>

                        {/* ── Breakdown by closing member ── */}
                        {Object.keys(stats.byClosingMember).length > 0 && (
                            <>
                                <div style={{ ...styles.sectionLabel, marginTop: 4 }}>
                                    <UserOutlined /> Breakdown by closing member
                                </div>
                                <div style={styles.breakdownGrid}>
                                    {Object.entries(stats.byClosingMember).map(([cid, d]) => (
                                        <div key={cid} style={styles.breakdownCard}>
                                            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{d.name}</div>
                                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>Reg: {d.regNo}</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                                <span style={{ fontSize: 12, color: t.amber.text, fontWeight: 600 }}>{d.count} entries</span>
                                                <span style={{ fontSize: 12, color: t.red.text, fontWeight: 600 }}>₹{d.amount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* ── Delete mode + search toolbar ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                            <Radio.Group
                                value={deleteMode}
                                onChange={(e) => {
                                    setDeleteMode(e.target.value)
                                    if (e.target.value === 'all') setSelectedRowKeys([])
                                }}
                                buttonStyle="solid"
                                size="small"
                            >
                                <Radio.Button value="all">Delete all ({unlinkedPayments.length})</Radio.Button>
                                <Radio.Button value="selected">Select specific</Radio.Button>
                            </Radio.Group>

                            <Input
                                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="Search name, reg. no., phone…"
                                allowClear
                                style={{ flex: 1, minWidth: 220 }}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                size="small"
                            />

                            <Button
                                icon={<ReloadOutlined />}
                                onClick={fetchUnlinkedPayments}
                                loading={loading}
                                size="small"
                            >
                                Refresh
                            </Button>
                        </div>

                        {/* ── Table ── */}
                        <Table
                            rowSelection={deleteMode === 'selected' ? rowSelection : undefined}
                            columns={columns}
                            dataSource={filteredPayments}
                            loading={loading || deleting}
                            size="small"
                            scroll={{ x: 900, y: 'calc(100vh - 560px)' }}
                            pagination={{
                                pageSize: 25,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
                                size: 'small',
                            }}
                            locale={{
                                emptyText: loading
                                    ? 'Scanning for unlinked entries…'
                                    : 'No unlinked payment entries found.',
                            }}
                        />

                        {/* ── Warning note ── */}
                        {unlinkedPayments.length > 0 && (
                            <div style={styles.warningBox}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <WarningOutlined style={{ color: t.red.text }} />
                                    <span style={{ fontWeight: 600, fontSize: 13, color: t.red.text }}>Before you delete</span>
                                </div>
                                {[
                                    `${unlinkedPayments.length} entries are not linked to any of your ${selectedClosingMemberIds.length} selected closing member(s).`,
                                    `Deleting will clear ₹${stats.totalAmount.toLocaleString()} from pending payments.`,
                                    'Payments for your selected closing members will NOT be affected.',
                                    'This action cannot be undone.',
                                ].map(txt => (
                                    <div key={txt} style={{ fontSize: 12, color: '#595959', marginTop: 3, paddingLeft: 2 }}>
                                        · {txt}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </Drawer>

            {/* Confirmation modal */}
            <Modal
                open={confirmModalOpen}
                onCancel={() => {
                    setConfirmModalOpen(false)
                    setPendingDeleteIds([])
                }}
                onOk={executeDelete}
                okText={`Delete ${pendingDeleteIds.length} ${pendingDeleteIds.length === 1 ? 'entry' : 'entries'}`}
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ExclamationCircleOutlined style={{ color: t.red.text }} />
                        <span>Delete unlinked payment entries</span>
                    </div>
                }
                centered
                maskClosable={false}
                zIndex={1100}
            >
                <div style={{ padding: '8px 0' }}>
                    <p style={{ marginBottom: 8 }}>
                        You are about to delete{' '}
                        <strong>{pendingDeleteIds.length}</strong>{' '}
                        payment {pendingDeleteIds.length === 1 ? 'entry' : 'entries'}.
                    </p>
                    <div style={{
                        background: t.red.bg,
                        border: `0.5px solid ${t.red.border}`,
                        borderRadius: 6,
                        padding: '10px 12px',
                    }}>
                        <div style={{ fontSize: 13, color: t.red.text, fontWeight: 600, marginBottom: 4 }}>
                            This action cannot be undone.
                        </div>
                        <div style={{ fontSize: 12, color: '#595959' }}>
                            These entries are not linked to any of your selected closing members.
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    )
}

export default DeleteUnlinkedPayments