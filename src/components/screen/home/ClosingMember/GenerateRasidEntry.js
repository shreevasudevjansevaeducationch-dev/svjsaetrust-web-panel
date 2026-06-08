import React, { useEffect, useState } from 'react'
import { Drawer, message, Select, Space, Divider, Typography, Button, Spin, Tag, Badge, Progress } from 'antd'
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    FileOutlined,
    FileDoneOutlined,
    InfoCircleOutlined,
    BoldOutlined
} from '@ant-design/icons'
import { getData } from '@/lib/services/firebaseService'
import {
    collection, addDoc, getDocs, updateDoc, deleteDoc,
    doc, onSnapshot, query, orderBy, where, writeBatch
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { db } from '@/lib/firebase'

const { Option } = Select
const { Text } = Typography

/* ─── Design tokens ──────────────────────────────────────────────────── */
const t = {
    green:  { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d' },
    amber:  { bg: '#fffbe6', border: '#ffe58f', text: '#d46b08' },
    blue:   { bg: '#e6f4ff', border: '#91caff', text: '#0958d9' },
    red:    { bg: '#fff1f0', border: '#ffa39e', text: '#cf1322' },
    gray:   { bg: '#fafafa', border: '#d9d9d9', text: '#595959' },
}

const styles = {
    /* layout */
    content: { padding: '20px 24px 8px' },

    /* section labels */
    sectionLabel: {
        fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: '#8c8c8c',
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 8,
    },
    sectionHeader: {
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 8,
    },

    /* member count pill */
    countPill: {
        fontSize: 11, padding: '2px 8px', borderRadius: 999,
        background: '#f5f5f5', border: '0.5px solid #e0e0e0',
        color: '#595959', fontWeight: 500,
    },

    /* closing member cards */
    closingCard: (state) => ({
        background: state === 'done' ? t.green.bg : state === 'partial' ? t.amber.bg : '#fafafa',
        border: `0.5px solid ${state === 'done' ? t.green.border : state === 'partial' ? t.amber.border : '#e0e0e0'}`,
        borderLeft: `3px solid ${state === 'done' ? t.green.text : state === 'partial' ? t.amber.text : '#d9d9d9'}`,
        borderRadius: 10, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 14,
        marginBottom: 8,
    }),
    avatar: (color) => ({
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 600,
        background: color === 'teal' ? '#e1f5ee' : color === 'amber' ? '#faeeda' : '#f1efe8',
        color:      color === 'teal' ? '#0f6e56' : color === 'amber' ? '#854f0b' : '#5f5e5a',
    }),
    cardInfo: { flex: 1, minWidth: 0 },
    cardName: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    cardMeta: { fontSize: 12, color: '#8c8c8c', marginTop: 2 },
    cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 },

    /* stat grid */
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '16px 0' },
    statCard: { background: '#fafafa', borderRadius: 8, padding: '12px 14px' },
    statLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#8c8c8c', marginBottom: 4 },
    statValue: (color) => ({ fontSize: 24, fontWeight: 500, lineHeight: 1, color: color || 'inherit' }),

    /* info box */
    infoBox: {
        background: t.blue.bg, border: `0.5px solid ${t.blue.border}`,
        borderRadius: 8, padding: '14px 16px', margin: '16px 0',
    },
    infoBoxTitle: { fontSize: 13, fontWeight: 600, color: t.blue.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 },
    infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 8 },
    infoItem: { fontSize: 13, color: '#595959' },
    skipItem: { fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 3 },

    /* result chips */
    resultsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, margin: '10px 0 4px' },
    chip: (color) => ({
        background: t[color].bg, borderRadius: 8, padding: '10px 0',
        textAlign: 'center',
    }),
    chipVal: (color) => ({ fontSize: 20, fontWeight: 500, color: t[color].text, lineHeight: 1 }),
    chipLbl: (color) => ({ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: t[color].text, marginTop: 3 }),

    /* footer */
    footer: {
        padding: '14px 24px', borderTop: '0.5px solid #f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    pendingBadge: {
        fontSize: 11, padding: '2px 8px', borderRadius: 999,
        background: t.amber.bg, color: t.amber.text, fontWeight: 600, marginLeft: 6,
    },
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
const initials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')

const avatarColor = (i) => ['teal', 'amber', 'gray'][i % 3]

const parseDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null
    const parts = dateStr.split('-')
    if (parts.length !== 3) return null
    const [day, month, year] = parts.map(Number)
    if (!day || !month || !year) return null
    return new Date(year, month - 1, day)
}

/* ─── Component ──────────────────────────────────────────────────────── */
const GenerateRasidEntry = ({ open, setOpen, selectedProgram, user, closingMemberList }) => {
    const [isLoading, setIsLoading] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const [allMembersData, setAllMembersData] = useState([])
    const [selectedClosingMembers, setSelectedClosingMembers] = useState([])
    const [selectedMembers, setSelectedMembers] = useState([])
    const [existingPaymentsMap, setExistingPaymentsMap] = useState(new Map())
    const [paymentGenerationStatus, setPaymentGenerationStatus] = useState({})
    const [closingMembersStatus, setClosingMembersStatus] = useState(new Map())

    /* fetch members */
    const fetchAllMembers = async () => {
        if (!selectedProgram) return
        setIsLoading(true)
        try {
            const data = await getData(
                `/users/${user.uid}/programs/${selectedProgram.id}/members`,
                [{ field: 'delete_flag', operator: '==', value: false }],
                { field: 'createdAt', direction: 'desc' }
            )
            setAllMembersData(data)
        } catch (e) {
            console.error(e)
            message.error('Failed to fetch members')
        } finally {
            setIsLoading(false)
        }
    }

    /* check existing payments */
    const checkExistingPayments = async () => {
        if (!selectedClosingMembers.length || !selectedMembers.length) return
        setIsChecking(true)
        const paymentsRef = collection(db, `users/${user.uid}/programs/${selectedProgram.id}/payment_pending`)
        const existingMap = new Map()
        const closingStatus = new Map()

        try {
            selectedClosingMembers.forEach(id => {
                closingStatus.set(id, { total: 0, generated: 0, percentage: 0, memberStatus: new Map() })
            })

            for (const closingId of selectedClosingMembers) {
                const statusData = closingStatus.get(closingId)
                for (const memberId of selectedMembers) {
                    const paymentId = `${closingId}_${memberId}`
                    const snap = await getDocs(query(paymentsRef, where('__name__', '==', paymentId)))
                    if (!snap.empty) {
                        existingMap.set(paymentId, snap.docs[0].data())
                        statusData.generated++
                        statusData.memberStatus.set(memberId, { exists: true, data: snap.docs[0].data() })
                    } else {
                        statusData.memberStatus.set(memberId, { exists: false })
                    }
                    statusData.total++
                }
                statusData.percentage = (statusData.generated / statusData.total) * 100
                closingStatus.set(closingId, statusData)
            }

            setExistingPaymentsMap(existingMap)
            setClosingMembersStatus(closingStatus)
        } catch (e) {
            console.error(e)
            message.error('Failed to check existing payments')
        } finally {
            setIsChecking(false)
        }
    }

    /* generate one payment */
    const generatePaymentEntry = async (closingMember, payingMember, batch) => {
        const paymentId = `${closingMember.id}_${payingMember.id}`
        const paymentsRef = collection(db, `users/${user.uid}/programs/${selectedProgram.id}/payment_pending`)
        const snap = await getDocs(query(paymentsRef, where('__name__', '==', paymentId)))
        if (!snap.empty) return { success: false, exists: true, id: paymentId }

        const marriageDate = closingMember.marriage_date || closingMember.closing_date
        const joinDate = payingMember.dateJoin || payingMember.createdAt

        if (joinDate && marriageDate) {
            const j = parseDDMMYYYY(joinDate)
            const m = parseDDMMYYYY(marriageDate)
            if (j && m && j > m) return { success: false, reason: 'joined_after_marriage', id: paymentId }
        }
        if (payingMember.marriage_flag === true) {
            const ocd = parseDDMMYYYY(payingMember.marriage_date || payingMember.closing_date)
            const cmd = parseDDMMYYYY(marriageDate)
            if (ocd && cmd && ocd.getTime() <= cmd.getTime())
                return { success: false, reason: 'already_closed', id: paymentId }
        }

        const payAmount = payingMember?.payAmount || 200
        const paymentData = {
            closingMemberId: closingMember.id,
            closingGroupId: closingMember?.closingGroupId || '',
            memberId: payingMember.id,
            memberDetails: {
                displayName: payingMember.displayName || 'N/A',
                registrationNumber: payingMember.registrationNumber || 'N/A',
                fatherName: payingMember.fatherName || 'N/A',
                photoURL: payingMember.photoURL || '',
                phone: payingMember.phone || payingMember.phoneNo || 'N/A',
                dateJoin: payingMember.dateJoin || payingMember.createdAt || 'N/A',
                village: payingMember.village || 'N/A',
                district: payingMember.district || 'N/A',
                addedByName: payingMember.addedByName || 'N/A',
                agentId: payingMember.agentId || '',
                currentStatus: payingMember.status || 'N/A',
            },
            status: 'pending',
            payAmount,
            programId: selectedProgram.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            delete_flag: false,
            dueDate: dayjs().add(30, 'days').format('DD-MM-YYYY'),
            isClosingMember: payingMember.id === closingMember.id,
            paymentFor: closingMember?.displayName || 'Marriage Case',
            closingRegNo: closingMember?.registrationNumber || '',
            closingFatherName: closingMember?.fatherName || '',
            closing_date: marriageDate || '',
            village: closingMember?.village || '',
            jati: closingMember?.jati || '',
            phone: closingMember?.phone || '',
            notes: `Payment for ${closingMember?.displayName}'s marriage`,
            paymentType: 'contribution',
        }

        if (batch) {
            batch.set(doc(paymentsRef, paymentId), paymentData)
            return { success: true, id: paymentId, batch: true }
        }
        await addDoc(paymentsRef, paymentData)
        return { success: true, id: paymentId }
    }

    /* generate all */
    const handleGeneratePayments = async () => {
        if (!selectedClosingMembers.length) { message.warning('Select at least one closing member'); return }
        if (!selectedMembers.length) { message.warning('Select at least one member'); return }

        setIsGenerating(true)
        const closingMembers = closingMemberList.filter(m => selectedClosingMembers.includes(m.id))
        const payingMembers = allMembersData.filter(m => selectedMembers.includes(m.id))
        let totalGenerated = 0, totalSkipped = 0, totalErrors = 0
        const statusUpdates = {}
        const updatedClosingStatus = new Map(closingMembersStatus)

        try {
            const batch = writeBatch(db)
            let batchOps = 0

            for (const closingMember of closingMembers) {
                for (const payingMember of payingMembers) {
                    const key = `${closingMember.id}_${payingMember.id}`
                    if (closingMember.id === payingMember.id) {
                        totalSkipped++; statusUpdates[key] = { status: 'skipped', reason: 'same_member' }; continue
                    }
                    if (payingMember.status === 'blocked' || payingMember.active_flag === false) {
                        totalSkipped++; statusUpdates[key] = { status: 'skipped', reason: 'member_inactive' }; continue
                    }
                    const result = await generatePaymentEntry(closingMember, payingMember, batch)
                    if (result.success) {
                        totalGenerated++
                        statusUpdates[key] = { status: 'generated', id: result.id }
                        const cs = updatedClosingStatus.get(closingMember.id)
                        if (cs) {
                            cs.generated++
                            cs.percentage = (cs.generated / cs.total) * 100
                            cs.memberStatus.set(payingMember.id, { exists: true, newlyGenerated: true })
                            updatedClosingStatus.set(closingMember.id, cs)
                        }
                        batchOps++
                    } else if (result.exists) {
                        totalSkipped++; statusUpdates[key] = { status: 'exists', reason: 'payment_already_exists' }
                    } else if (result.reason === 'joined_after_marriage') {
                        totalSkipped++; statusUpdates[key] = { status: 'skipped', reason: 'joined_after_marriage_date' }
                    } else if (result.reason === 'already_closed') {
                        totalSkipped++; statusUpdates[key] = { status: 'skipped', reason: 'member_already_closed' }
                    } else {
                        totalErrors++; statusUpdates[key] = { status: 'error', reason: 'unknown_error' }
                    }
                    if (batchOps >= 500) { await batch.commit(); batchOps = 0 }
                }
            }
            if (batchOps > 0) await batch.commit()

            setPaymentGenerationStatus(statusUpdates)
            setClosingMembersStatus(updatedClosingStatus)
            message.success(`Generated ${totalGenerated} entries — Skipped: ${totalSkipped}, Errors: ${totalErrors}`, 5)
            await checkExistingPayments()
        } catch (e) {
            console.error(e)
            message.error('Failed to generate entries: ' + e.message)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleGenerateForClosingMember = (closingMemberId) => {
        setSelectedClosingMembers([closingMemberId])
        setTimeout(handleGeneratePayments, 100)
    }

    useEffect(() => {
        if (selectedClosingMembers.length > 0 && selectedMembers.length > 0) checkExistingPayments()
        else { setClosingMembersStatus(new Map()); setExistingPaymentsMap(new Map()) }
    }, [selectedClosingMembers, selectedMembers])

    useEffect(() => {
        if (open) {
            fetchAllMembers()
            setSelectedClosingMembers([])
            setSelectedMembers([])
            setPaymentGenerationStatus({})
            setClosingMembersStatus(new Map())
        }
    }, [open, selectedProgram, user.uid])

    const filterClosingMember = (input, option) => {
        const m = closingMemberList.find(m => m.id === option.value)
        if (!m) return false
        const s = input.toLowerCase()
        return [m.registrationNumber, m.displayName, m.fatherName, m.phone, m.closingGroupName].some(v => v?.toLowerCase().includes(s))
    }

    const filterAllMember = (input, option) => {
        const m = allMembersData.find(m => m.id === option.value)
        if (!m) return false
        const s = input.toLowerCase()
        return [m.registrationNumber, m.displayName, m.fatherName, m.phone].some(v => v?.toLowerCase().includes(s))
    }

    /* derived counts */
    const totalCombinations = selectedClosingMembers.length * selectedMembers.length
    const totalGeneratedPayments = Array.from(closingMembersStatus.values()).reduce((s, v) => s + (v?.generated || 0), 0)
    const pendingCount = totalCombinations - totalGeneratedPayments

    /* result chip data */
    const genResults = [
        { label: 'Generated', color: 'green', count: Object.values(paymentGenerationStatus).filter(s => s.status === 'generated').length },
        { label: 'Exists',    color: 'amber', count: Object.values(paymentGenerationStatus).filter(s => s.status === 'exists').length },
        { label: 'Skipped',   color: 'blue',  count: Object.values(paymentGenerationStatus).filter(s => s.status === 'skipped').length },
        { label: 'Errors',    color: 'red',   count: Object.values(paymentGenerationStatus).filter(s => s.status === 'error').length },
    ]

    /* render closing member status cards */
    const renderClosingCards = () => {
        if (!selectedClosingMembers.length) return null
        const members = closingMemberList.filter(m => selectedClosingMembers.includes(m.id))
        return (
            <div style={{ marginBottom: 20 }}>
                <div style={styles.sectionLabel}>
                    <FileDoneOutlined /> Closing members status
                </div>
                {members.map((member, i) => {
                    const status = closingMembersStatus.get(member.id)
                    const isDone = status && status.generated === status.total && status.total > 0
                    const isPartial = status && status.generated > 0 && status.generated < status.total
                    const state = isDone ? 'done' : isPartial ? 'partial' : 'empty'
                    return (
                        <div key={member.id} style={styles.closingCard(state)}>
                            <div style={styles.avatar(avatarColor(i))}>
                                {initials(member.displayName)}
                            </div>
                            <div style={styles.cardInfo}>
                                <div style={styles.cardName}>{member.displayName}</div>
                                <div style={styles.cardMeta}>
                                    Reg: {member.registrationNumber || 'N/A'}
                                    {member.fatherName && ` · Father: ${member.fatherName}`}
                                </div>
                                {status && (
                                    <div style={{ marginTop: 6 }}>
                                        <Progress
                                            percent={Math.round(status.percentage)}
                                            size="small"
                                            status={isDone ? 'success' : 'active'}
                                            strokeColor={isDone ? t.green.text : isPartial ? t.amber.text : '#1677ff'}
                                            showInfo={false}
                                        />
                                    </div>
                                )}
                            </div>
                            <div style={styles.cardRight}>
                                {status && (
                                    <span style={{ fontSize: 13, color: '#595959' }}>
                                        <strong style={{ color: '#141414' }}>{status.generated}</strong> / {status.total}
                                    </span>
                                )}
                                <Button
                                    size="small"
                                    type={isDone ? 'default' : 'primary'}
                                    ghost={!isDone}
                                    disabled={isDone}
                                    onClick={() => handleGenerateForClosingMember(member.id)}
                                    style={isDone ? { color: t.green.text, borderColor: t.green.border, background: t.green.bg } : {}}
                                >
                                    {isDone ? '✓ Complete' : isPartial ? 'Generate remaining' : 'Generate all'}
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <Drawer
            title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                    <FileDoneOutlined style={{ color: '#0958d9' }} />
                    Generate Rasid Entry
                </span>
            }
            placement="right"
            onClose={() => setOpen(false)}
            open={open}
            width={620}
            destroyOnHidden
            bodyStyle={{ padding: 0 }}
            footer={
                <div style={styles.footer}>
                    <span style={{ fontSize: 13, color: '#8c8c8c' }}>
                        {isChecking
                            ? <Spin size="small" style={{ marginRight: 8 }} />
                            : null
                        }
                        {totalCombinations > 0 && `${totalGeneratedPayments} / ${totalCombinations} generated`}
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Button onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            type="primary"
                            icon={<BoldOutlined />}
                            onClick={handleGeneratePayments}
                            loading={isGenerating}
                            disabled={!selectedClosingMembers.length || !selectedMembers.length || pendingCount === 0}
                        >
                            Generate all
                            {pendingCount > 0 && (
                                <span style={styles.pendingBadge}>{pendingCount} pending</span>
                            )}
                        </Button>
                    </div>
                </div>
            }
        >
            <div style={styles.content}>

                {/* ── Closing members select ── */}
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionLabel}>Closing members (marriage cases)</div>
                    {selectedClosingMembers.length > 0 && (
                        <span style={styles.countPill}>{selectedClosingMembers.length} selected</span>
                    )}
                </div>
                <Select
                    style={{ width: '100%', marginBottom: 16 }}
                    placeholder="Search by name, reg. no., father's name or phone…"
                    mode="multiple"
                    value={selectedClosingMembers}
                    onChange={setSelectedClosingMembers}
                    loading={isLoading}
                    showSearch
                    filterOption={filterClosingMember}
                    maxTagCount="responsive"
                    maxTagPlaceholder={(omitted) => `+${omitted.length} more`}
                    notFoundContent="No members found"
                    dropdownRender={(menu) => (
                        <>
                            {menu}
                            {selectedClosingMembers.length > 0 && (
                                <div style={{ padding: '6px 12px', borderTop: '0.5px solid #f0f0f0' }}>
                                    <Button type="link" size="small" onClick={() => setSelectedClosingMembers([])} style={{ padding: 0 }}>
                                        Clear all
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                >
                    {closingMemberList.map((member) => {
                        const status = closingMembersStatus.get(member.id)
                        const isDone = status && status.generated === status.total && status.total > 0
                        const isPartial = status && status.generated > 0 && !isDone
                        return (
                            <Option key={member.id} value={member.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {isDone
                                        ? <CheckCircleOutlined style={{ color: t.green.text }} />
                                        : isPartial
                                        ? <ClockCircleOutlined style={{ color: t.amber.text }} />
                                        : <FileOutlined style={{ color: '#bfbfbf' }} />
                                    }
                                    <span style={{ fontWeight: 500 }}>{member.displayName}</span>
                                    {member.closingGroupName && (
                                        <span style={{ color: '#8c8c8c', fontSize: 12 }}>[{member.closingGroupName}]</span>
                                    )}
                                    {status && status.total > 0 && (
                                        <Tag color={isDone ? 'green' : isPartial ? 'orange' : 'default'} style={{ marginLeft: 'auto', fontSize: 11 }}>
                                            {status.generated}/{status.total}
                                        </Tag>
                                    )}
                                </div>
                                <div style={{ fontSize: 12, color: '#8c8c8c', paddingLeft: 22 }}>
                                    Reg: {member.registrationNumber || 'N/A'}
                                    {member.fatherName && ` · Father: ${member.fatherName}`}
                                    {member.phone && ` · ${member.phone}`}
                                </div>
                                {status && status.total > 0 && (
                                    <Progress
                                        percent={Math.round(status.percentage)}
                                        size="small"
                                        showInfo={false}
                                        status={isDone ? 'success' : 'active'}
                                        strokeColor={isDone ? t.green.text : t.amber.text}
                                        style={{ marginLeft: 22, marginTop: 4 }}
                                    />
                                )}
                            </Option>
                        )
                    })}
                </Select>

                <Divider style={{ margin: '8px 0 16px' }} />

                {/* ── Members select ── */}
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionLabel}>Members to generate payments for</div>
                    {selectedMembers.length > 0 && (
                        <span style={styles.countPill}>{selectedMembers.length} selected</span>
                    )}
                </div>
                <Select
                    style={{ width: '100%', marginBottom: 4 }}
                    placeholder="Search by name, reg. no., father's name or phone…"
                    mode="multiple"
                    value={selectedMembers}
                    onChange={setSelectedMembers}
                    loading={isLoading}
                    showSearch
                    filterOption={filterAllMember}
                    maxTagCount="responsive"
                    maxTagPlaceholder={(omitted) => `+${omitted.length} more`}
                    notFoundContent="No members found"
                >
                    {allMembersData.map((member) => {
                        let paymentCount = 0
                        for (const cid of selectedClosingMembers)
                            if (existingPaymentsMap.has(`${cid}_${member.id}`)) paymentCount++
                        const total = selectedClosingMembers.length
                        const isFullyPaid = total > 0 && paymentCount === total

                        return (
                            <Option key={member.id} value={member.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {paymentCount > 0 && <CheckCircleOutlined style={{ color: t.green.text }} />}
                                    <span style={{ fontWeight: 500 }}>{member.displayName}</span>
                                    {member.marriage_flag && <Tag color="orange" style={{ fontSize: 11 }}>Closed</Tag>}
                                    {paymentCount > 0 && (
                                        <Tag color={isFullyPaid ? 'green' : 'blue'} style={{ marginLeft: 'auto', fontSize: 11 }}>
                                            {paymentCount}/{total}
                                        </Tag>
                                    )}
                                </div>
                                <div style={{ fontSize: 12, color: '#8c8c8c', paddingLeft: paymentCount > 0 ? 22 : 0 }}>
                                    Reg: {member.registrationNumber || 'N/A'}
                                    {member.fatherName && ` · Father: ${member.fatherName}`}
                                    {member.phone && ` · ${member.phone}`}
                                </div>
                            </Option>
                        )
                    })}
                </Select>

                {/* ── Closing member cards ── */}
                {selectedClosingMembers.length > 0 && selectedMembers.length > 0 && (
                    <>
                        <Divider style={{ margin: '16px 0' }} />
                        {renderClosingCards()}
                    </>
                )}

                {/* ── Summary stats ── */}
                {totalCombinations > 0 && (
                    <>
                        <div style={styles.statsGrid}>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Combinations</div>
                                <div style={styles.statValue()}>
                                    {totalCombinations}
                                </div>
                            </div>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Generated</div>
                                <div style={styles.statValue(t.green.text)}>
                                    {totalGeneratedPayments}
                                </div>
                            </div>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Pending</div>
                                <div style={styles.statValue(pendingCount > 0 ? t.amber.text : t.green.text)}>
                                    {pendingCount}
                                </div>
                            </div>
                        </div>

                        <div style={styles.infoBox}>
                            <div style={styles.infoBoxTitle}>
                                <InfoCircleOutlined /> Payment generation summary
                            </div>
                            <div style={styles.infoGrid}>
                                <div style={styles.infoItem}>
                                    Amount per member{' '}
                                    <strong>₹{allMembersData.find(m => selectedMembers.includes(m.id))?.payAmount || 200}</strong>
                                </div>
                                <div style={styles.infoItem}>Due date <strong>+30 days</strong></div>
                            </div>
                            <div>
                                {[
                                    'Skips already existing payments',
                                    'Skips members who joined after marriage date',
                                    'Skips already closed or married members',
                                ].map(text => (
                                    <div key={text} style={styles.skipItem}>
                                        <span style={{ marginTop: 2 }}>·</span> {text}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ── Result chips ── */}
                {Object.keys(paymentGenerationStatus).length > 0 && (
                    <>
                        <div style={styles.sectionLabel}>Last generation results</div>
                        <div style={styles.resultsGrid}>
                            {genResults.map(({ label, color, count }) => (
                                <div key={label} style={styles.chip(color)}>
                                    <div style={styles.chipVal(color)}>{count}</div>
                                    <div style={styles.chipLbl(color)}>{label}</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </Drawer>
    )
}

export default GenerateRasidEntry