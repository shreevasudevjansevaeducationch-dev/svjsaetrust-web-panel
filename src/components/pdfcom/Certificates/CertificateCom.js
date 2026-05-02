import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  PDFViewer, 
  Font,
  Image
} from '@react-pdf/renderer';
import NotoSansDevanagari from '@/app/api/helperfile/static/font/NotoSansDevanagari';
import NotoSansDevanagariBold from '@/app/api/helperfile/static/font/NotoSansDevanagariBold';

// Register Devanagari Font
Font.register({
  family: 'NotoSansDevanagari',
  fonts: [
    {
      src: NotoSansDevanagari,
      fontWeight: 'normal',
    },
    {
      src: NotoSansDevanagariBold,
      fontWeight: 'bold',
    }
  ]
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'NotoSansDevanagari',
    padding: 15,
    width: '210mm',
    height: '148mm',
  },
  outerBorder: {
    border: '4px solid #d4af37',
    padding: 8,
    height: '100%',
    position: 'relative',
    borderRadius: 4,
  },
  innerBorder: {
    border: '2px solid #d4af37',
    padding: 14,
    height: '100%',
    borderRadius: 2,
    position: 'relative',
  },
  topText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  smallText: {
    fontSize: 9,
    color: '#8B0000',
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  // ── NEW: Registration & CIN bar ──────────────────────────────────────────────
  regCinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f0e0',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
    border: '0.5px solid #d4af37',
  },
  regCinText: {
    fontSize: 7.8,
    color: '#4a2800',
    fontWeight: 'bold',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  regCinLabel: {
    fontSize: 7.8,
    color: '#666',
    fontWeight: 'normal',
  },
  // ─────────────────────────────────────────────────────────────────────────────
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  logoImage: {
    width: 68,
    height: 68,
    borderRadius: 4,
  },
  logoImage1: {
    width: 78,
    height: 68,
    borderRadius: 4,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  mainTitle: {
    fontSize: 23,
    color: '#8B0000',
    fontWeight: 'bold',
    marginBottom: 0,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subTitle: {
    fontSize: 13,
    color: '#000',
    fontWeight: 'bold',
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  address: {
    fontSize: 9,
    color: '#333',
    textAlign: 'center',
    marginBottom: 3,
    lineHeight: 1.3,
    paddingHorizontal: 10,
  },
  phoneNumbers: {
    fontSize: 9,
    color: '#000',
    fontWeight: 'bold',
    marginBottom: 5,
    letterSpacing: 0.2,
  },
  schemeBox: {
    backgroundColor: '#1a0f5e',
    borderRadius: 14,
    paddingVertical: 3,
    paddingHorizontal: 14,
    alignSelf: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  schemeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  formSection: {
    marginTop: 9,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 7,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 9.5,
    color: '#000',
    marginRight: 4,
    fontWeight: 'normal',
  },
  value: {
    fontSize: 10,
    color: '#000',
    fontWeight: 'bold',
    borderBottom: '1px dotted #000',
    paddingBottom: 2,
    paddingHorizontal: 5,
    minHeight: 16,
    textTransform: 'capitalize',
  },
  memberIdBox: {
    position: 'absolute',
    right: 18,
    top: 125,
    border: '2px solid #333',
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 3,
    overflow: 'hidden',
  },
  memberIdText: {
    fontSize: 8,
    textAlign: 'center',
    color: '#666',
    marginTop: 2,
  },
  memberIdLabel: {
    fontSize: 8,
    textAlign: 'center',
    color: '#666',
    paddingTop: 10,
  },
  detailsSection: {
    marginTop: 6,
    fontFamily: 'NotoSansDevanagari',
    fontSize: 8.5,
    color: '#000',
    textAlign: 'justify',
    lineHeight: 1.4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#fafafa',
    borderRadius: 2,
    border: '0.5px solid #ddd',
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  leftFooter: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '45%',
  },
  rightFooter: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '45%',
  },
  footerLabel: {
    fontSize: 9,
    color: '#000',
    marginTop: 5,
    fontWeight: 'bold',
  },
  footerValue: {
    fontSize: 9.5,
    color: '#000',
    fontWeight: 'bold',
    borderBottom: '1px dotted #000',
    paddingBottom: 8,
    paddingTop: 1,
    minWidth: 140,
    textAlign: 'center',
    marginTop: 2,
  },
  signatureText: {
    fontSize: 10,
    color: '#000',
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'right',
    borderTop: '1px solid #000',
    paddingTop: 3,
    minWidth: 140,
  },
  serialNumber: {
    position: 'absolute',
    top: -10,
    right: 24,
    fontSize: 10,
    color: '#000',
    fontWeight: 'bold',
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  fieldGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 2,
  },
  watermark: {
    position: 'absolute',
    top: '28mm',
    left: '42mm',
    width: '115mm',
    height: '85mm',
    opacity: 0.08,
    zIndex: 0,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  donationHighlight: {
    backgroundColor: '#fff3cd',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  regNoBox: {
    position: 'absolute',
    bottom:-4,
    left: 4,
    alignItems: 'center',
    direction: 'row',
    gap: 2,
    display: 'flex',
    width: 'auto',
    width: 300,
  },

  regCinText: {
    fontSize: 7.8,
    color: '#4a2800',
    fontWeight: 'bold',
  }

});

const Certificate = ({ data, selectedProgram }) => (
  <Document>
    <Page size={{ width: '210mm', height: '148mm' }} style={styles.page}>
      <View style={styles.outerBorder}>
        <Text style={styles.serialNumber}>{data?.registrationNumber}</Text>
        <View style={styles.innerBorder}>

          {/* Top Text */}
          <View style={styles.topText}>
            <Text style={styles.smallText}>॥ श्री गणेशाय नमः ॥</Text>
            <Text style={styles.smallText}>॥ श्री साँवलाजी भगवान नमः ॥</Text>
          </View>

 

          {/* Watermark */}
          <Image
            src="/Images/logo.jpg"
            style={styles.watermark}
          />

          {/* Header Section */}
          <View style={styles.headerSection}>
            <Image
              src="/Images/krinshnaImage.jpg"
              style={styles.logoImage}
            />
     

            <View style={styles.centerContent}>
              <Text style={styles.mainTitle}>श्री साँवलाजी सेवा संस्थान</Text>
              <Text style={styles.mainTitle}>फाउंडेशन</Text>
              <Text style={styles.subTitle}>अहमदाबाद-गुजरात</Text>
                <Text style={styles.regCinText}>
               Reg No. (CIN):U88900GJ2026NPL174962
              </Text>
              <Text style={styles.address}>
                20/2, शिवम् फ्लेट, आनंद फ्लेट पुलिस चौकी के पास, बापूनगर, अहमदाबाद
              </Text>
               
              <Text style={styles.phoneNumbers}>
                9723878021 / 8511878021 / 9408323975
              </Text>
              
              <View style={styles.schemeBox}>
                <Text style={styles.schemeText}>{selectedProgram?.hiname}</Text>
              </View>
            </View>

            <Image
              src="/Images/logo.jpg"
              style={styles.logoImage1}
            />
          </View>

          {/* Member ID Box */}
          <View style={styles.memberIdBox}>
            {data?.photoURL ? (
              <Image src={data.photoURL} style={styles.photoImage} />
            ) : (
              <View>
                <Text style={styles.memberIdLabel}>सदस्य फोटो</Text>
              </View>
            )}
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Row 1 */}
            <View style={[styles.row, { justifyContent: 'space-between', marginRight: 55 }]}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>सदस्यता क्रमांक:</Text>
                <Text style={[styles.value, { minWidth: 90 }]}>{data?.registrationNumber || '---'}</Text>
              </View>
              <View style={[styles.fieldGroup, { marginLeft: 20, marginRight: 40 }]}>
                <Text style={styles.label}>दिनांक:</Text>
                <Text style={[styles.value, { minWidth: 60 }]}>{data?.dateJoin || '---'}</Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={styles.row}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>नाम:</Text>
                <Text style={[styles.value, { minWidth: 150 }]}>{data?.displayName || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>पिता/पति का नाम:</Text>
                <Text style={[styles.value, { minWidth: 150 }]}>{data?.fatherName || '---'}</Text>
              </View>
            </View>

            {/* Row 3 */}
            <View style={styles.row}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>गोत्र:</Text>
                <Text style={[styles.value, { minWidth: 90 }]}>{data?.gotra || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>जाति:</Text>
                <Text style={[styles.value, { minWidth: 100 }]}>{data?.jati || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>जन्म दि.:</Text>
                <Text style={[styles.value, { minWidth: 110 }]}>{data?.bobDate || '---'}</Text>
              </View>
            </View>

            {/* Row 4 */}
            <View style={styles.row}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>मोबाईल नंबर:</Text>
                <Text style={[styles.value, { minWidth: 140 }]}>{data?.phone || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>गाँव/शहर का नाम:</Text>
                <Text style={[styles.value, { minWidth: 135 }]}>{data?.village || '---'}</Text>
              </View>
            </View>

            {/* Row 5 */}
            <View style={styles.row}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>जिला:</Text>
                <Text style={[styles.value, { minWidth: 160 }]}>{data?.district || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>राज्य:</Text>
                <Text style={[styles.value, { minWidth: 180 }]}>{data?.state || '---'}</Text>
              </View>
            </View>

            {/* Row 6 */}
            <View style={styles.row}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>वारिसदार:</Text>
                <Text style={[styles.value, { minWidth: 160 }]}>{data?.guardian || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  प्रत्येक {selectedProgram?.isSuraksha ? 'देहांत' : selectedProgram?.isMamera ? 'मायरा' : 'विवाह'} पर सहयोग राशि:
                </Text>
                <Text style={[styles.value, { minWidth: 70 }]}>
                  {data?.payAmount || '0'}/-
                </Text>
                <Text style={styles.label}>रुपये</Text>
              </View>
            </View>
          </View>

          {/* Details Section */}
          {selectedProgram?.noteLine && (
            <View style={styles.detailsSection}>
              <Text>{selectedProgram?.noteLine}</Text>
            </View>
          )}

          {/* Footer Section */}
          <View style={styles.footerSection}>
            <View style={styles.leftFooter}>
              <Text style={styles.footerValue}>{data?.addedByName || '---'} ({data.agentPhone})</Text>
              <Text style={styles.footerLabel}>कार्यकर्ता</Text>
            </View>
            <View style={styles.rightFooter}>
              <Text style={styles.footerValue}>राजेंद्र कुमार बाबूलाल घांची</Text>
              <Text style={styles.footerLabel}>संस्थापक</Text>
            </View>
          </View>

        </View>
      </View>
    </Page>
  </Document>
);

export default Certificate;