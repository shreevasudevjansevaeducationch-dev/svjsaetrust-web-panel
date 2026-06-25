'use client'
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image
} from '@react-pdf/renderer';
import NotoSansDevanagari from '@/app/api/helperfile/static/font/NotoSansDevanagari';
import NotoSansDevanagariBold from '@/app/api/helperfile/static/font/NotoSansDevanagariBold';
import PdfHeaderCom from '@/components/screen/agents/agentDetails/component/pdfcom/HeaderCom';

Font.register({
  family: 'NotoSansDevanagari',
  fonts: [
    { src: NotoSansDevanagari,     fontWeight: 'normal' },
    { src: NotoSansDevanagariBold, fontWeight: 'bold'   },
  ]
});

const ROWS_PER_PAGE = 15;

/* ─────────────────────────── THEME ─────────────────────────── */
// Colours swap based on report type; pass `theme` object to renderers
const THEMES = {
  pending: {
    primary:       '#8B0000',
    primaryLight:  '#fee2e2',
    primaryText:   '#dc2626',
    badge:         '#fff8f8',
    accentBg:      '#8B0000',
    label:         'बकाया रसीद',
    labelEN:       'PENDING PAYMENT REPORT',
    statsBg:       '#8B0000',
    statsLabel:    '#ffccc7',
    summaryBg:     '#f0f4ff',
    amountColor:   '#cf1322',
    rowAlt:        '#fafafa',
    borderColor:   '#d4af37',
    noDataMsgHI:   'कोई बकाया भुगतान नहीं है',
    noDataMsgHI2:  'इस सदस्य का कोई भी भुगतान बकाया नहीं है',
  },
  paid: {
    primary:       '#14532d',
    primaryLight:  '#dcfce7',
    primaryText:   '#16a34a',
    badge:         '#f0fdf4',
    accentBg:      '#15803d',
    label:         'भुगतान रसीद',
    labelEN:       'PAID PAYMENT RECEIPT',
    statsBg:       '#15803d',
    statsLabel:    '#bbf7d0',
    summaryBg:     '#f0fdf4',
    amountColor:   '#15803d',
    rowAlt:        '#f0fdf4',
    borderColor:   '#86efac',
    noDataMsgHI:   'कोई भुगतान नहीं हुआ',
    noDataMsgHI2:  'इस सदस्य का कोई भी भुगतान अभी तक नहीं हुआ है',
  },
};

/* ─────────────────────────── STYLES ─────────────────────────── */
const makeStyles = (t) => StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'NotoSansDevanagari',
    padding: 14,
    fontSize: 11,
  },
  outerBorder: {
    border: `2px solid ${t.borderColor}`,
    padding: 5,
    minHeight: '100%',
  },
  innerBorder: {
    border: `1px solid ${t.borderColor}`,
    padding: 8,
    minHeight: '100%',
  },
  topText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  smallText: {
    fontSize: 10,
    color: t.primary,
    fontWeight: 'bold',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  logoImage:     { width: 65, height: 65 },
  centerContent: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  mainTitle:     { fontSize: 26, color: t.primary, fontWeight: 'bold', marginBottom: 2 },
  subTitle:      { fontSize: 13, color: '#000',    fontWeight: 'bold', marginBottom: 2 },
  address:       { fontSize: 9,  color: '#444',    textAlign: 'center', marginBottom: 2 },
  phoneNumbers:  { fontSize: 10, color: '#000',    fontWeight: 'bold', marginBottom: 4 },
  headerBox:{
    width:'100%',
 justifyContent:'center',
 alignItems:'center'
  },
  schemeBox: {
    backgroundColor: t.accentBg,
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  schemeText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },

  /* receipt type badge */
  typeBadgeRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 6 },
  typeBadge: {
    backgroundColor: t.primaryLight,
    border: `1px solid ${t.primaryText}`,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 16,
  },
  typeBadgeText: { fontSize: 11, color: t.primaryText, fontWeight: 'bold', textAlign: 'center' },

  /* member card */
  memberCard: {
    flexDirection: 'row',
    backgroundColor: t.badge,
    marginBottom: 10,
    borderRadius: 4,
    border: `1.5px solid ${t.borderColor}`,
    overflow: 'hidden',
  },
  memberPhotoBox: {
    width: 90,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRight: `1px solid ${t.borderColor}`,
    padding: 5,
  },
  memberPhotoImg:         { width: 80, height: 85, borderRadius: 3 },
  memberPhotoPlaceholder: {
    width: 80, height: 85, backgroundColor: '#e8e8e8', borderRadius: 3,
    justifyContent: 'center', alignItems: 'center', border: '1px dashed #bbb',
  },
  memberPhotoText: { fontSize: 9, color: '#999', textAlign: 'center' },
  memberDetails:   { flex: 1, padding: 10 },
  memberNameRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${t.borderColor}`,
  },
  memberName:     { fontSize: 16, fontWeight: 'bold', color: t.primary },
  memberRegBadge: {
    backgroundColor: '#1a0f5e', borderRadius: 3, paddingVertical: 3, paddingHorizontal: 8,
  },
  memberRegText:   { fontSize: 9, color: '#fff', fontWeight: 'bold' },
  memberInfoGrid:  { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  memberInfoGridItem: { width: '33.33%', flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  memberInfoLabel: { fontSize: 10, fontWeight: 'bold', color: '#555', marginRight: 4, minWidth: 45 },
  memberInfoValue: { fontSize: 10, color: '#1a0f5e', fontWeight: 'bold' },
  amountBadge: {
    backgroundColor: t.primaryLight, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 8, marginLeft: 3,
  },
  amountBadgeText: { fontSize: 10, color: t.amountColor, fontWeight: 'bold' },
  closingGroupBadge: {
    backgroundColor: '#ede9fe', borderRadius: 3, paddingVertical: 2, paddingHorizontal: 8, marginLeft: 3,
  },
  closingGroupText:  { fontSize: 9, color: '#5b21b6', fontWeight: 'bold' },
  statsRow: {
    flexDirection: 'row', backgroundColor: t.statsBg, borderRadius: 3,
    padding: 6, justifyContent: 'space-around', marginTop: 4,
  },
  statItem:  { alignItems: 'center' },
  statLabel: { fontSize: 8, color: t.statsLabel, marginBottom: 2 },
  statValue: { fontSize: 12, color: '#fff', fontWeight: 'bold' },

  /* table */
  tableSectionTitle: {
    fontSize: 12, color: t.primary, fontWeight: 'bold',
    marginBottom: 6, paddingBottom: 3,
    borderBottom: `1.5px solid ${t.borderColor}`, textAlign: 'center',
  },
  table:       { width: '100%', borderWidth: 1, borderColor: '#d9d9d9', marginBottom: 6 },
  tableHeader: { flexDirection: 'row', backgroundColor: t.accentBg },
  tableRow:    {
    flexDirection: 'row', minHeight: 24,
    borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8',
  },
  tableRowAlt:   { backgroundColor: t.rowAlt },
  tableRowEmpty: { backgroundColor: '#fdfdfd' },
  tableCell: {
    paddingVertical: 5, paddingHorizontal: 4, fontSize: 9,
    borderRightWidth: 0.5, borderRightColor: '#d9d9d9', justifyContent: 'center',
  },
  tableHeaderCell: {
    paddingVertical: 6, paddingHorizontal: 4, fontSize: 9, fontWeight: 'bold',
    color: '#fff', borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
  },

  colSerial:      { width: '6%' },
  colDate:        { width: '11%' },
  colBeneficiary: { width: '24%' },
  colFatherName:  { width: '18%' },
  colRegNo:       { width: '12%' },
  colPhone:       { width: '14%' },
  colVillage:     { width: '15%' },
  textLeft:       { textAlign: 'left' },
  textCenter:     { textAlign: 'center' },
  textRight:      { textAlign: 'right' },

  /* summary */
  summaryBox: {
    marginTop: 10, padding: 12, backgroundColor: t.summaryBg,
    borderRadius: 5, border: `1px solid ${t.primary}`,
  },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 11, fontWeight: 'bold', color: '#555' },
  summaryValue: { fontSize: 11, fontWeight: 'bold', color: '#1a0f5e' },
  summaryDivider: {
    borderBottom: `0.5px solid ${t.borderColor}`, marginBottom: 6, marginTop: 2,
  },

  /* notice */
  noticeSection: {
    marginTop: 8, paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 3,
  },
  noticeText: { fontSize: 8, color: '#5d4037', fontWeight: 'bold', textAlign: 'center', lineHeight: 1.4 },

  /* footer */
  footer: {
    marginTop: 8, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', fontSize: 8, color: '#8c8c8c',
    borderTop: `0.5px solid ${t.borderColor}`, paddingTop: 4,
  },
});

/* ═══════════════════════════ COMPONENT ══════════════════════════ */
const MemberPaymentPdf = ({
  memberData,
  paymentReport,
  programInfo     = {},
  closingGroupList= [],
  reportType      = 'pending',   // 'pending' | 'paid'
  filterApplied   = false,
  selectedGroupName = null,
}) => {
  if (!memberData || !paymentReport) return null;

  const t   = THEMES[reportType] || THEMES.pending;
  const S   = makeStyles(t);
  const isPaid = reportType === 'paid';

  const { report }   = paymentReport;
  const member       = memberData;
  const allMarriages = report.marriages || [];
  // Already filtered to the correct status by the parent, but guard anyway:
  const marriages    = allMarriages.filter(m => m.status === reportType);

  const getGroupName = (id) =>
    (!id || !closingGroupList?.length)
      ? null
      : closingGroupList.find(g => g.id === id)?.name || null;

  const totalAmount = marriages.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
  const reportSummary = {
    total:        marriages.length,
    totalAmount,
    totalMarriages: report.summary?.totalMarriages  || 0,
    paidMarriages:  report.summary?.paidMarriages   || 0,
    paidAmount:     report.summary?.paidAmount      || 0,
    pendingCount:   report.summary?.pendingMarriages|| 0,
    pendingAmount:  report.summary?.pendingAmount   || 0,
  };

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const formatCurrency = (a) => `₹${parseFloat(a || 0).toLocaleString('hi-IN')}`;

  const chunks = [];
  for (let i = 0; i < marriages.length; i += ROWS_PER_PAGE)
    chunks.push(marriages.slice(i, i + ROWS_PER_PAGE));
  if (chunks.length === 0) chunks.push([]);



  const renderMemberCard = () => {
    const groupName   = filterApplied && selectedGroupName ? selectedGroupName : null;

    const countLabel  = isPaid ? 'कुल भुगतान' : 'कुल बकाया';

    return (
      <View style={S.memberCard}>
        <View style={S.memberPhotoBox}>
          {member.photoURL
            ? <Image src={member.photoURL} style={S.memberPhotoImg} />
            : (
              <View style={S.memberPhotoPlaceholder}>
                <Text style={S.memberPhotoText}>{'फोटो\nनहीं'}</Text>
              </View>
            )
          }
        </View>

        <View style={S.memberDetails}>
          <View style={S.memberNameRow}>
            <Text style={S.memberName}>{member.displayName} {member.jati || ''}</Text>
            <View style={S.memberRegBadge}>
              <Text style={S.memberRegText}>रजि. {member.registrationNumber || 'N/A'}</Text>
            </View>
          </View>

          <View style={S.memberInfoGrid}>
            <View style={S.memberInfoGridItem}>
              <Text style={S.memberInfoLabel}>पिता/पति:</Text>
              <Text style={S.memberInfoValue}>{member.fatherName || 'N/A'}</Text>
            </View>
            <View style={S.memberInfoGridItem}>
              <Text style={S.memberInfoLabel}>फोन:</Text>
              <Text style={S.memberInfoValue}>{member.phone || 'N/A'}</Text>
            </View>
            <View style={S.memberInfoGridItem}>
              <Text style={S.memberInfoLabel}>गाँव:</Text>
              <Text style={S.memberInfoValue}>{member.village || 'N/A'}</Text>
            </View>
            <View style={S.memberInfoGridItem}>
              <Text style={S.memberInfoLabel}> सहयोग राशि</Text>
              <View style={S.amountBadge}>
                <Text style={S.amountBadgeText}>{member.payAmount}</Text>
              </View>
            </View>
            {groupName && (
              <View style={S.memberInfoGridItem}>
                <Text style={S.memberInfoLabel}>समूह:</Text>
                <View style={S.closingGroupBadge}>
                  <Text style={S.closingGroupText}>{groupName}</Text>
                </View>
              </View>
            )}
            <View style={S.memberInfoGridItem}>
              <Text style={S.memberInfoLabel}>योजना:</Text>
              <Text style={S.memberInfoValue}>{member.programName || programInfo?.name || 'N/A'}</Text>
            </View>
          </View>

          <View style={S.statsRow}>
            <View style={S.statItem}>
              <Text style={S.statLabel}>{countLabel}</Text>
              <Text style={S.statValue}>{reportSummary.total}</Text>
            </View>
            <View style={S.statItem}>
              <Text style={S.statLabel}>{isPaid ? 'कुल प्राप्त' : 'बकाया राशि'}</Text>
              <Text style={S.statValue}>{formatCurrency(reportSummary.totalAmount)}</Text>
            </View>
            <View style={S.statItem}>
              <Text style={S.statLabel}>कुल समापन</Text>
              <Text style={S.statValue}>{reportSummary.totalMarriages}</Text>
            </View>
            <View style={S.statItem}>
              <Text style={S.statLabel}>भुगतान हुए</Text>
              <Text style={S.statValue}>{reportSummary.paidMarriages}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderTable = (data, startIndex) => (
    <View style={S.table}>
      <View style={S.tableHeader}>
        <View style={[S.tableHeaderCell, S.colSerial]}>
          <Text style={S.textCenter}>क्र.</Text>
        </View>
        <View style={[S.tableHeaderCell, S.colBeneficiary]}>
          <Text style={S.textLeft}>नाम</Text>
        </View>
        <View style={[S.tableHeaderCell, S.colFatherName]}>
          <Text style={S.textLeft}>पिता/पति</Text>
        </View>
        <View style={[S.tableHeaderCell, S.colRegNo]}>
          <Text style={S.textCenter}>रजि. नं.</Text>
        </View>
        <View style={[S.tableHeaderCell, S.colPhone]}>
          <Text style={S.textCenter}>फोन</Text>
        </View>
        <View style={[S.tableHeaderCell, S.colVillage]}>
          <Text style={S.textLeft}>गाँव</Text>
        </View>
        <View style={[S.tableHeaderCell, S.colDate, { borderRightWidth: 0 }]}>
          <Text style={S.textCenter}>तिथि</Text>
        </View>
      </View>

      {data.map((m, idx) => (
        <View
          key={m.paymentId || idx}
          style={[S.tableRow, (startIndex + idx) % 2 === 1 && S.tableRowAlt]}
        >
          <View style={[S.tableCell, S.colSerial]}>
            <Text style={S.textCenter}>{startIndex + idx + 1}</Text>
          </View>
          <View style={[S.tableCell, S.colBeneficiary]}>
            <Text style={S.textLeft}>{m.paymentFor || '-'}</Text>
          </View>
          <View style={[S.tableCell, S.colFatherName]}>
            <Text style={S.textLeft}>{m.closingFatherName || '-'}</Text>
          </View>
          <View style={[S.tableCell, S.colRegNo]}>
            <Text style={S.textCenter}>{m.closingRegNo || '-'}</Text>
          </View>
          <View style={[S.tableCell, S.colPhone]}>
            <Text style={S.textCenter}>{m.closingPhone || '-'}</Text>
          </View>
          <View style={[S.tableCell, S.colVillage]}>
            <Text style={S.textLeft}>{m.closingVillage || '-'}</Text>
          </View>
          <View style={[S.tableCell, S.colDate, { borderRightWidth: 0 }]}>
            <Text style={S.textCenter}>{m.marriageDate || '-'}</Text>
          </View>
        </View>
      ))}

      {/* filler rows */}
      {data.length < ROWS_PER_PAGE &&
        Array.from({ length: ROWS_PER_PAGE - data.length }).map((_, i) => (
          <View key={`empty-${i}`} style={[S.tableRow, S.tableRowEmpty]}>
            {[S.colSerial, S.colBeneficiary, S.colFatherName, S.colRegNo, S.colPhone, S.colVillage].map((col, ci) => (
              <View key={ci} style={[S.tableCell, col]}><Text> </Text></View>
            ))}
            <View style={[S.tableCell, S.colDate, { borderRightWidth: 0 }]}><Text> </Text></View>
          </View>
        ))
      }
    </View>
  );

  const renderSummary = () => (
    <View style={S.summaryBox}>
      {/* Overall context */}
      <View style={S.summaryRow}>
        <Text style={S.summaryLabel}>कुल समापन:</Text>
        <Text style={S.summaryValue}>{reportSummary.totalMarriages}</Text>
      </View>
      <View style={S.summaryRow}>
        <Text style={S.summaryLabel}>कुल भुगतान हुए:</Text>
        <Text style={[S.summaryValue, { color: '#15803d' }]}>{reportSummary.paidMarriages}</Text>
      </View>
      <View style={S.summaryRow}>
        <Text style={S.summaryLabel}>कुल बकाया:</Text>
        <Text style={[S.summaryValue, { color: '#dc2626' }]}>{reportSummary.pendingCount}</Text>
      </View>
      <View style={S.summaryDivider} />
      {/* Report-specific totals */}
      <View style={S.summaryRow}>
        <Text style={S.summaryLabel}>
          {isPaid ? 'इस रिपोर्ट में भुगतान:' : 'इस रिपोर्ट में बकाया:'}
        </Text>
        <Text style={[S.summaryValue, { color: t.amountColor }]}>{reportSummary.total}</Text>
      </View>
      <View style={S.summaryRow}>
        <Text style={S.summaryLabel}>
          {isPaid ? 'कुल प्राप्त राशि:' : 'कुल बकाया राशि:'}
        </Text>
        <Text style={[S.summaryValue, { color: t.amountColor, fontSize: 13 }]}>
          {formatCurrency(reportSummary.totalAmount)}
        </Text>
      </View>
    </View>
  );

  /* ── build pages ── */
  const allPages = [];

  if (marriages.length === 0) {
    allPages.push(
      <Page key="empty" size="A4" style={S.page}>
        <View style={S.outerBorder}>
          <View style={S.innerBorder}>
          <PdfHeaderCom/>
  
            {renderMemberCard()}
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: t.primary, marginBottom: 10 }}>{t.noDataMsgHI}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>{t.noDataMsgHI2}</Text>
            </View>
            <View style={S.noticeSection}>
              <Text style={S.noticeText}>
                यह दान स्वेच्छिक रूप से दिया गया है और किसी भी कारणवश इसकी वापसी नहीं की जाएगी।
              </Text>
            </View>
            <View style={S.footer}>
              <Text style={{ flex: 1 }}>{member.displayName} ({member.registrationNumber})</Text>
              <Text style={{ flex: 1, textAlign: 'center' }}>पृष्ठ 1</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{currentDate}</Text>
            </View>
          </View>
        </View>
      </Page>
    );
  } else {
    chunks.forEach((chunk, ci) => {
      const startIndex = ci * ROWS_PER_PAGE;
      const isLastPage = ci === chunks.length - 1;

      allPages.push(
        <Page key={`page-${ci + 1}`} size="A4" style={S.page} wrap>
          <View style={S.outerBorder}>
            <View style={S.innerBorder}>
          <PdfHeaderCom/>

         

              {/* Member card only on first page */}
              {ci === 0 && renderMemberCard()}
              <View style={S.headerBox}>

         <View style={S.schemeBox}>
            <Text style={S.schemeText}>{t.label}</Text>
          </View>
              </View>


              {renderTable(chunk, startIndex)}

              {/* Summary on last page */}
              {/* {isLastPage && renderSummary()} */}

              <View style={S.noticeSection}>
                <Text style={S.noticeText}>
                  यह दान स्वेच्छिक रूप से दिया गया है और किसी भी कारणवश इसकी वापसी नहीं की जाएगी।
                </Text>
              </View>
              <View style={S.footer}>
                <Text style={{ flex: 1 }}>{member.displayName} ({member.registrationNumber})</Text>
                <Text style={{ flex: 1, textAlign: 'center' }}>पृष्ठ {ci + 1}/{chunks.length}</Text>
                <Text style={{ flex: 1, textAlign: 'right' }}>{currentDate}</Text>
              </View>
            </View>
          </View>
        </Page>
      );
    });
  }

  return <Document>{allPages}</Document>;
};

export default MemberPaymentPdf;