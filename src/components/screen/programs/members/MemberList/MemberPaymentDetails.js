'use client'
import React, { useState, useMemo } from 'react';
import { 
    Drawer, 
    Table, 
    Tag, 
    Typography, 
    Card, 
    Statistic, 
    Row, 
    Col,
    Space,
    Badge,
    Button,
    Select,
    Input,
    Dropdown,
} from 'antd';
import { 
    DollarOutlined, 
    CheckCircleOutlined, 
    ClockCircleOutlined,
    CalendarOutlined,
    CreditCardOutlined,
    DownloadOutlined,
    FilterOutlined,
    CloseOutlined,
    SearchOutlined,
    FilePdfOutlined,
    CaretDownOutlined,
} from '@ant-design/icons';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import MemberPaymentPdf from './PendingPaymentPdf';

const { Title, Text } = Typography;
const { Option } = Select;

function MemberPaymentDetails({ visible, onClose, memberData, paymentReport, loading = false }) {
    const closingGroupList = useSelector((s) => s.data.closingGroupList);
    const selectedProgram  = useSelector((s) => s.data.selectedProgram);

    console.log(closingGroupList,'closingGroupList')
    const [pdfPreviewOpen,  setPdfPreviewOpen]  = useState(false);
    const [pdfReportType,   setPdfReportType]   = useState('pending'); // 'pending' | 'paid'
    const [selectedClosingGroup, setSelectedClosingGroup] = useState(null);
    const [searchText, setSearchText] = useState('');

    const report  = paymentReport?.report  || { marriages: [], summary: {} };
    const summary = paymentReport?.summary || {};
    const member  = memberData || {};

    const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

    const getStatusInfo = (status) => {
        switch (status) {
            case 'paid':    return { color: 'success', icon: <CheckCircleOutlined />, text: 'Paid' };
            case 'pending': return { color: 'warning', icon: <ClockCircleOutlined />,  text: 'Pending' };
            default:        return { color: 'default', icon: null, text: status };
        }
    };

    const findClosingGroupName = (id) =>
        closingGroupList?.find((g) => g.id === id)?.name || null;

    /* ── filtered data ── */
    const filteredMarriages = useMemo(() => {
        let data = report.marriages || [];
        if (selectedClosingGroup) data = data.filter((m) => m.closingGroupId === selectedClosingGroup);
        if (searchText) {
            const s = searchText.toLowerCase();
            data = data.filter((m) =>
                m.paymentFor?.toLowerCase().includes(s) ||
                m.closingRegNo?.toLowerCase().includes(s) ||
                m.closingFatherName?.toLowerCase().includes(s)
            );
        }
        return data;
    }, [report.marriages, selectedClosingGroup, searchText]);

    const filteredSummary = useMemo(() => {
        const paid    = filteredMarriages.filter(m => m.status === 'paid');
        const pending = filteredMarriages.filter(m => m.status === 'pending');
        return {
            total:         filteredMarriages.length,
            paidAmount:    paid.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0),
            paidCount:     paid.length,
            pendingAmount: pending.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0),
            pendingCount:  pending.length,
            totalAmount:   filteredMarriages.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0),
        };
    }, [filteredMarriages]);

    /* ── PDF report data (pending or paid based on type) ── */
    const buildPdfReport = (type) => {
        const marriages = filteredMarriages.filter(m => m.status === type);
        const amountSum = marriages.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
        return {
            report: {
                marriages,
                summary: {
                    totalMarriages:   report.summary?.totalMarriages  || 0,
                    paidMarriages:    report.summary?.paidMarriages   || 0,
                    pendingMarriages: report.summary?.pendingMarriages|| 0,
                    paidAmount:       report.summary?.paidAmount      || 0,
                    pendingAmount:    report.summary?.pendingAmount   || 0,
                    totalAmount:      report.summary?.totalAmount     || 0,
                    filteredCount:    marriages.length,
                    filteredAmount:   amountSum,
                }
            }
        };
    };

    const activePdfReport = useMemo(() => buildPdfReport(pdfReportType), [filteredMarriages, pdfReportType]);

    /* ── helpers ── */
    const isFiltered       = !!(selectedClosingGroup || searchText);
    const selectedGroupName = selectedClosingGroup
        ? closingGroupList?.find(g => g.id === selectedClosingGroup)?.name
        : null;

    const getFileName = (type) => {
        const namePart = (member.displayName || 'Member').replace(/\s+/g, '_');
        const datePart = dayjs().format('YYYYMMDD_HHmmss');
        const typePart = type === 'paid' ? 'Paid' : 'Pending';
        const grpPart  = selectedClosingGroup
            ? `_${(selectedGroupName || '').replace(/\s+/g, '_')}`
            : '';
        return `${typePart}_Payment_Report_${namePart}${grpPart}_${datePart}.pdf`;
    };

    const openPdfPreview = (type) => {
        setPdfReportType(type);
        setPdfPreviewOpen(true);
    };

    /* ── early return AFTER all hooks ── */
    if (!memberData || !paymentReport) return null;

    /* ── table columns ── */
    const marriageColumns = [
        {
            title: 'Closing Date',
            dataIndex: 'marriageDate',
            key: 'marriageDate',
            render: (d) => d || '-',
            width: 110,
        },
        {
            title: 'Beneficiary',
            key: 'beneficiary',
            render: (_, r) => (
                <div>
                    <div className="font-medium">{r.paymentFor || '-'}</div>
                    <div className="text-xs text-gray-500">Reg: {r.closingRegNo || '-'}</div>
                    {r.closingFatherName && <div className="text-xs text-gray-400">{r.closingFatherName}</div>}
                </div>
            ),
        },
        {
            title: 'Group',
            key: 'group',
            width: 120,
            render: (_, r) => {
                const gn = findClosingGroupName(r.closingGroupId);
                return gn
                    ? <Tag color="purple" style={{ fontSize: 11 }}>{gn}</Tag>
                    : <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
            },
            filters: closingGroupList?.map(g => ({ text: g.name, value: g.id })) || [],
            onFilter: (v, r) => r.closingGroupId === v,
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: (a) => <Text strong className="text-green-600">{formatCurrency(a)}</Text>,
            align: 'right',
            sorter: (a, b) => a.amount - b.amount,
            width: 100,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 90,
            render: (s) => {
                const { color, icon, text } = getStatusInfo(s);
                return <Tag icon={icon} color={color}>{text}</Tag>;
            },
            filters: [
                { text: 'Paid',    value: 'paid' },
                { text: 'Pending', value: 'pending' },
            ],
            onFilter: (v, r) => r.status === v,
        },
    ];

    /* ── dropdown menu for PDF buttons ── */
    const pdfMenuItems = [
        {
            key: 'pending',
            icon: <ClockCircleOutlined style={{ color: '#fa8c16' }} />,
            label: <span>Pending Receipt PDF</span>,
            onClick: () => openPdfPreview('pending'),
        },
        {
            key: 'paid',
            icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
            label: <span>Paid Receipt PDF</span>,
            onClick: () => openPdfPreview('paid'),
        },
    ];

    const pdfLabel = pdfReportType === 'paid' ? 'Paid' : 'Pending';
    const pdfLabelColor = pdfReportType === 'paid' ? '#52c41a' : '#fa8c16';

    return (
        <Drawer
            title={
                <div>
                    <Title level={4} style={{ margin: 0 }}>
                        Payment Details: {member.displayName}
                    </Title>
                    <Text type="secondary">{member.registrationNumber}</Text>
                </div>
            }
            placement="right"
            width={780}
            onClose={() => { setSelectedClosingGroup(null); setSearchText(''); onClose(); }}
            open={visible}
            loading={loading}
            extra={
                <Space>
                    {/* Split button: default action = pending, dropdown for paid */}
                    <Button.Group>
                        <Button
                            type="primary"
                            icon={<FilePdfOutlined />}
                            onClick={() => openPdfPreview('pending')}
                        >
                            Pending PDF
                        </Button>
                        <Dropdown menu={{ items: pdfMenuItems }} placement="bottomRight" trigger={['click']}>
                            <Button type="primary" icon={<CaretDownOutlined />} style={{ paddingLeft: 6, paddingRight: 6 }} />
                        </Dropdown>
                    </Button.Group>

                    <Button onClick={onClose}>Close</Button>
                </Space>
            }
        >
            {/* ── Summary Cards ── */}
            <Row gutter={16} className="mb-4">
                <Col span={8}>
                    <Card size="small" className="bg-blue-50">
                        <Statistic
                            title={isFiltered ? 'Filtered Closings' : 'Total Marriages'}
                            value={isFiltered ? filteredSummary.total : (report?.summary?.totalMarriages || 0)}
                            prefix={<CalendarOutlined />}
                            valueStyle={{ color: '#1890ff', fontSize: '20px' }}
                        />
                        {isFiltered && (
                            <div className="text-xs text-gray-400 mt-1">
                                of {report?.summary?.totalMarriages || 0} total
                            </div>
                        )}
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small" className="bg-green-50">
                        <Statistic
                            title="Paid"
                            value={isFiltered ? filteredSummary.paidAmount : (report?.summary?.paidAmount || 0)}
                            precision={2}
                            prefix={<DollarOutlined />}
                            valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                        />
                        <div className="text-xs text-gray-500">
                            {isFiltered ? filteredSummary.paidCount : (report?.summary?.paidMarriages || 0)} Closings
                        </div>
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small" className="bg-orange-50">
                        <Statistic
                            title="Pending"
                            value={isFiltered ? filteredSummary.pendingAmount : (report?.summary?.pendingAmount || 0)}
                            precision={2}
                            prefix={<ClockCircleOutlined />}
                            valueStyle={{ color: '#fa8c16', fontSize: '20px' }}
                        />
                        <div className="text-xs text-gray-500">
                            {isFiltered ? filteredSummary.pendingCount : (report?.summary?.pendingMarriages || 0)} Closings
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* ── Filter Row ── */}
            <Card size="small" className="mb-4" bodyStyle={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Input
                        placeholder="Search name, reg. no., father…"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        size="middle"
                        style={{ flex: 1, minWidth: 180 }}
                        prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                    />
                    <Select
                        placeholder={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FilterOutlined style={{ fontSize: 12, color: '#6b7280' }} />
                                <span>All Groups</span>
                            </span>
                        }
                        allowClear
                        showSearch
                        size="middle"
                        optionFilterProp="label"
                        value={selectedClosingGroup}
                        onChange={setSelectedClosingGroup}
                        style={{ width: 170 }}
                    >
                        {(closingGroupList || []).map((g) => (
                            <Option key={g.id} value={g.id} label={g.name}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                                        flexShrink: 0, display: 'inline-block'
                                    }} />
                                    {g.name}
                                </div>
                            </Option>
                        ))}
                    </Select>

                    {isFiltered && (
                        <Button
                            size="middle"
                            icon={<CloseOutlined />}
                            onClick={() => { setSelectedClosingGroup(null); setSearchText(''); }}
                        >
                            Clear Filters
                        </Button>
                    )}
                </div>

                {selectedClosingGroup && (
                    <div style={{
                        marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', background: '#f5f3ff', border: '1px solid #ddd6fe',
                        borderRadius: 20, fontSize: 12, color: '#6366f1'
                    }}>
                        <FilterOutlined style={{ fontSize: 11 }} />
                        <span>Group: <strong>{selectedGroupName}</strong></span>
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>
                            · {filteredMarriages.length} result{filteredMarriages.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                )}
            </Card>

            {/* ── Table ── */}
            <Card
                title={
                    <Space>
                        <CreditCardOutlined />
                        <span>Closings Payments</span>
                        <Badge count={filteredMarriages.length} style={{ backgroundColor: '#1890ff' }} />
                        {isFiltered && <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>(filtered)</Text>}
                    </Space>
                }
                className="mb-4"
            >
                <Table
                    columns={marriageColumns}
                    dataSource={filteredMarriages}
                    rowKey="paymentId"
                    pagination={{ pageSize: 15, size: 'small', showTotal: (t) => `${t} records` }}
                    size="small"
                    scroll={{ x: 'max-content' }}
                    summary={() => (
                        <Table.Summary fixed>
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={3}>
                                    <Text strong>{isFiltered ? 'Filtered Total:' : 'Total Amount:'}</Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">
                                    <Text strong className="text-green-600">
                                        {formatCurrency(isFiltered ? filteredSummary.totalAmount : (summary?.totalAmount || 0))}
                                    </Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={2} />
                            </Table.Summary.Row>
                        </Table.Summary>
                    )}
                />
            </Card>

            {/* ── PDF Preview Drawer ── */}
            <Drawer
                title={
                    <Space>
                        <FilePdfOutlined style={{ color: pdfLabelColor }} />
                        <span style={{ color: pdfLabelColor, fontWeight: 700 }}>{pdfLabel} Payment Report</span>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{member.displayName}</Text>
                    </Space>
                }
                width={820}
                placement="right"
                onClose={() => setPdfPreviewOpen(false)}
                open={pdfPreviewOpen}
                maskClosable={false}
                destroyOnHidden={true}
                keyboard={false}
                footer={
                    <Space style={{ float: 'right' }}>
                        <Button onClick={() => setPdfPreviewOpen(false)} size="large">Cancel</Button>
                        <PDFDownloadLink
                            document={
                                <MemberPaymentPdf
                                    memberData={member}
                                    paymentReport={activePdfReport}
                                    programInfo={selectedProgram}
                                    closingGroupList={closingGroupList}
                                    reportType={pdfReportType}
                                    filterApplied={isFiltered}
                                    selectedGroupName={selectedGroupName}
                                />
                            }
                            fileName={getFileName(pdfReportType)}
                        >
                            {({ loading: pdfLoading }) => (
                                <Button
                                    type="primary"
                                    icon={<DownloadOutlined />}
                                    size="large"
                                    loading={pdfLoading}
                                    style={{ background: pdfLabelColor, borderColor: pdfLabelColor }}
                                >
                                    Download {pdfLabel} PDF
                                </Button>
                            )}
                        </PDFDownloadLink>
                    </Space>
                }
            >
      

                <PDFViewer style={{ width: '100%', height: 'calc(100vh - 160px)', border: 'none' }}>
                    <MemberPaymentPdf
                        memberData={member}
                        paymentReport={activePdfReport}
                        programInfo={selectedProgram}
                        closingGroupList={closingGroupList}
                        reportType={pdfReportType}
                        filterApplied={isFiltered}
                        selectedGroupName={selectedGroupName}
                    />
                </PDFViewer>
            </Drawer>
        </Drawer>
    );
}

export default MemberPaymentDetails;