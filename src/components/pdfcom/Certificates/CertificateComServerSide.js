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
import logo from '@/app/api/helperfile/Images/logo';
import krinshnaImage from '@/app/api/helperfile/Images/KrinshnaImage';
import { TrsutData } from '@/lib/constentData';
import semkariLogo from '@/app/api/helperfile/Images/semkariLogo';
import { pdfColors } from '../../../lib/constentData';
import NotoSansGujaratiRegular from '@/app/api/helperfile/static/font/NotoSansGujarati-Regular';
import NotoSansGujaratiBold from '@/app/api/helperfile/static/font/NotoSansGujarati-Bold';
import RobotoRegular from '@/app/api/helperfile/static/font/Roboto-Regular';
import RobotoMedium from '@/app/api/helperfile/static/font/Roboto-Medium';
import RobotoItalic from '@/app/api/helperfile/static/font/Roboto-Italic';
import RobotoBold from '@/app/api/helperfile/static/font/Roboto-Bold';
import certificateImg from '@/app/api/helperfile/Images/CertificateImg';


// Register Devanagari Font
Font.register({
  family: 'NotoSansDevanagari',
  fonts: [
    {
      src: NotoSansDevanagari,
      fontWeight: 'normal',
    },
    {
      src:NotoSansDevanagariBold,
      fontWeight: 'bold',
    },
  ],
});

Font.register({
  family: 'NotoSansGujarati',
  fonts: [
    {
      src: NotoSansGujaratiRegular,
      fontWeight: 'normal',
    },
    {
      src: NotoSansGujaratiBold,
      fontWeight: 'bold',
    }
  ]
});
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src:RobotoRegular,
      fontWeight: 'normal',
    },
    {
      src: RobotoMedium,
      fontWeight: 'medium',
    },
    {
      src: RobotoItalic,
      fontStyle: 'italic',
    },
    {
      src: RobotoBold,
      fontWeight: 'bold',
    }
  ]
});
const styles = StyleSheet.create({
  page: {
    backgroundColor:pdfColors.bgColor,
    fontFamily: 'NotoSansGujarati',
    // padding: 12,
    width: '210mm',
    height: '148mm',
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '210mm',
    height: '148mm',
    zIndex: 0,
  },
  outerBorder: {
    // border: `4px solid ${pdfColors.borderColor}`,
    // padding: 8,
    height: '100%',
    position: 'relative',
    // borderRadius: 4,
  },
  innerBorder: {
    // border: `2px solid ${pdfColors.borderColor}`,
    padding: 20,
    height: '100%',
    borderRadius: 2,
    position: 'relative',
  },
  topText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  smallText: {
    fontSize: 9,
    color: pdfColors.headingColor,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  headerSection:{
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    paddingHorizontal: 4,
    height: 100,
  },
logoImage: {
  width: 68,
  height: 68,
  borderRadius: 4,
},
  logoImage1: {
    width: 90,
    height: 70,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  mainTitle: {
    fontSize: 23,
    color: pdfColors.headingColor,
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
    position: 'absolute',
    bottom: -12,
    left: '50%',
     transform: 'translateX(-50%)',
    // width:300,
    width:'50%'
  },
  schemeText: {
    fontSize: 11,
    color: pdfColors.schemeColor,
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
    fontSize: 11,
    color: pdfColors.infoLabelColor,
    marginRight: 4,
    fontWeight: 'normal',
  },
  value: {
    fontSize: 11,
    color: pdfColors.infoValueColor,
    fontWeight: 'bold',
    borderBottom: '1px dotted ' + pdfColors.infoValueColor,
    paddingBottom: 2,
    paddingHorizontal: 5,
    minHeight: 16,
    textTransform:'capitalize'
  },
  memberIdBox: {
    position: 'absolute',
    right: 18,
    top: 135,
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
    marginTop: 3,
    fontFamily: 'NotoSansDevanagari',
    fontSize: 9.5,
    color:pdfColors.infoValueColor ,
    textAlign: 'justify',
    fontWeight: 'bold',
    position: 'absolute',
    bottom:13,
    textAlign: 'center',
    width: '100%',
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // alignItems: 'flex-end',
    // marginTop: 'auto',
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
    marginTop:5,
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
  regCinText:{
    fontSize: 7.8,
    color: '#333',
     fontWeight: 'bold',
     letterSpacing: 0.2,
      marginBottom: 3,
  }
});
const detectLanguage = (text) => {
  if (!text) return 'english';
  
  // Check for Gujarati script
  const gujaratiRegex = /[\u0A80-\u0AFF]/;
  // Check for Devanagari script (Hindi, Marathi, Sanskrit, etc.)
  const devanagariRegex = /[\u0900-\u097F]/;
  
  if (gujaratiRegex.test(text)) {
    return 'gujarati';
  } else if (devanagariRegex.test(text)) {
    return 'hindi';
  } else {
    return 'english';
  }
};

// Helper function to get appropriate font family based on language
const getFontFamily = (text) => {
  const language = detectLanguage(text);
  
  switch (language) {
    case 'hindi':
      return 'NotoSansDevanagari';
    case 'gujarati':
      return 'NotoSansGujarati';
    case 'english':
    default:
      return 'Roboto';
  }
};

const DynamicText = ({ children, style = {}, ...props }) => {
  const fontFamily = getFontFamily(children);

  return (
    <Text
      style={[style, { fontFamily }]}   // ✅ correct way
      {...props}
    >
      {children}
    </Text>
  );
};

const CertificateServerSide = ({data,selectedProgram,fontPath}) => (
  <Document>
    <Page size={{ width: '210mm', height: '148mm' }} style={styles.page}>
      <View style={styles.outerBorder}>
      <Image src={certificateImg} style={styles.backgroundImage} /> 
        {/* <Text style={styles.serialNumber}>{data?.registrationNumber}</Text> */}
        <View style={styles.innerBorder}>
          {/* Top Text */}
    

          {/* Watermark */}
          <Image 
           src={TrsutData.logo}
            style={styles.watermark}
          />

          {/* Header Section */}
      <View style={styles.headerSection}>
  
  {/* Left Logo — always show main logo as fallback */}
  {/* <Image 
    src={TrsutData.RightLogo || TrsutData.logo}
    style={styles.logoImage1}
  /> */}

  {/* Center Content */}
  {/* <View style={styles.centerContent}>
    <Text style={styles.mainTitle}>{TrsutData.name}</Text>
    {TrsutData.cityState && (
      <Text style={styles.subTitle}>{TrsutData.cityState}</Text>
    )}
    {TrsutData.regNo && (
      <Text style={styles.regCinText}>{TrsutData.regNo}</Text>
    )}
    {TrsutData.address && (
      <Text style={styles.address}>{TrsutData.address}</Text>
    )}
    {TrsutData.contact && (
      <Text style={styles.address}>{TrsutData.contact}</Text>
    )}
    <View style={styles.schemeBox}>
      <Text style={styles.schemeText}>{selectedProgram?.hiname}</Text>
    </View>
  </View> */}

  {/* Right Logo — show main logo, or blank placeholder if none */}
  {/* {TrsutData.RightLogo ? (
    <Image src={TrsutData.logo} style={styles.logoImage} />
  ) : (
    <View style={styles.logoImage} />
  )} */}
    <View style={styles.schemeBox}>
      <DynamicText style={styles.schemeText}>{
        selectedProgram?.hiname
        }</DynamicText>
    </View>

</View>

          {/* Member ID Box */}
          <View style={styles.memberIdBox}>
            {data?.photoURL ? (
              <Image src={data.photoURL} style={styles.photoImage} />
            ) : (
              <View>
                <Text style={styles.memberIdLabel}>Member Photo</Text>
              </View>
            )}
          </View>

          {/* Form Section */}
       <View style={styles.formSection}>
  {/* Row 1 */}
  <View style={[styles.row,{
    justifyContent:'space-between',
    marginRight:55
  }]}>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>સભ્યતા ક્રમાંક:</Text>
      
      <Text style={[styles.value, { minWidth: 90 }]}>{data?.registrationNumber || '---'}</Text>
    </View>
    <View style={[styles.fieldGroup, { marginLeft: 20,marginRight:40 }]}>
      <Text style={styles.label}>તારીખ:</Text>
      <Text style={[styles.value, { minWidth: 60 }]}>{data?.dateJoin || '---'}</Text>
    </View>
  </View>

  {/* Row 2 */}
  <View style={styles.row}>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>નામ:</Text>
      
      <DynamicText style={[styles.value, { minWidth: 175 }]}>{data?.displayName || '---'}</DynamicText>
    </View>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>પિતા/પતિનું નામ:</Text>
      <DynamicText style={[styles.value, { minWidth: 175 }]}>{data?.fatherName || '---'}</DynamicText>
    </View>
  </View>

  {/* Row 4 */}
  <View style={styles.row}>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>મોબાઇલ નંબર:</Text>
      <Text style={[styles.value, { minWidth: 165 }]}>{data?.phone || '---'}</Text>
    </View>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>જન્મ તારીખ:</Text>
      <Text style={[styles.value, { minWidth: 160 }]}>{data?.bobDate || '---'}</Text>
    </View>
  </View>

  <View style={styles.row}>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>ગામ/શહેરનું નામ:</Text>
      <DynamicText style={[styles.value, { minWidth: 90 }]}>{data?.village || '---'}</DynamicText>
    </View>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>જિલ્લો:</Text>
      <DynamicText style={[styles.value, { minWidth:100}]}>{data?.district || '---'}</DynamicText>
    </View>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>રાજ્ય:</Text>
      <DynamicText style={[styles.value, { minWidth: 105 }]}>{data?.state || '---'}</DynamicText>
    </View>
  </View>
    <View style={styles.row}>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>એજન્ટનું નામ:</Text>
      <Text style={[styles.value, { minWidth: 170 }]}>{data?.addedByName || '---'}</Text>
    </View>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>એજન્ટનુ મો.:</Text>
      <Text style={[styles.value, { minWidth: 160 }]}>{data?.agentPhone || '---'}</Text>
    </View>
  </View>

  {/* Row 6 */}
  <View style={styles.row}>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>વારસદાર:</Text>
      <DynamicText style={[styles.value, { minWidth: 160 }]}>{data?.guardian  || '---'}</DynamicText>
    </View>
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        દરેક {selectedProgram?.isSuraksha ? 'મૃત્યુ' : selectedProgram?.isMamera ? "માયરો" : 'લગ્ન'} પર સહાય રકમ:
      </Text>
      <Text style={[styles.value, { minWidth: 70}]}>
        {data?.payAmount || '0'}/-
      </Text>
      <Text style={styles.label}>રૂપીયા</Text>
    </View>
  </View>
</View>

          {/* Details Section */}
          {
            selectedProgram?.noteLine && <View style={styles.detailsSection}>
            <DynamicText style={{

            }}>
             {selectedProgram?.noteLine}
            </DynamicText>
          </View>
          }
       

          {/* Footer Section */}
      
        </View>
      </View>
    </Page>
  </Document>
);

export default CertificateServerSide;