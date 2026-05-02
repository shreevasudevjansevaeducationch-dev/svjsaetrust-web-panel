"use client";
import React, { useState, useEffect } from 'react';
import { Button, Drawer, Select, Form, Input, DatePicker, Upload, Card, Row, Col, Divider, Space, Typography, App, Spin, Checkbox } from 'antd';
import {
  EditOutlined,
  UserOutlined,
  PhoneOutlined,
  IdcardOutlined,
  HomeOutlined,
  UploadOutlined,
  CameraOutlined,
  DeleteOutlined,
  TagOutlined,
  LoadingOutlined,
  PlusOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
// Services Imports
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { uploadFile } from '@/lib/services/storageService';
import { useAuth } from '@/lib/AuthProvider';
import { deleteObject, getStorage, ref } from 'firebase/storage';
import { districtsByState, gender, states } from '@/lib/staticData';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

const EditMember = ({ memberData, programId, onSuccess,setOpen,open }) => {
  const programList = useSelector((state) => state.data.programList || []);
  const agentsList = useSelector((state) => state.data.agentsList || []);
  const [form] = Form.useForm();
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const [addedBy, setAddedBy] = useState('admin');

  // Age and payment states
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [joinFees, setJoinFees] = useState(0);

  // Location group
  const [selectedLocationGroup, setSelectedLocationGroup] = useState(null);
  const { user } = useAuth();

  // File uploads - Store actual File objects and existing URLs
  const [photo, setPhoto] = useState([]);
  const [extraPhoto, setExtraPhoto] = useState([]);
  const [documentFront, setDocumentFront] = useState([]);
  const [documentBack, setDocumentBack] = useState([]);
  const [guardianDocument, setGuardianDocument] = useState([]);

  // Extra Dynamic Fields State
  const [extraFields, setExtraFields] = useState([]);


  const [districts, setDistricts] = useState([]);
const getDecimalAge = (birthDate, joinDate) => {
  return dayjs(joinDate)
    .diff(dayjs(birthDate), 'year', true);
};
const getJoinDate = (memberData) => {
  if (memberData?.dateJoin) {
    return dayjs(memberData.dateJoin, 'DD-MM-YYYY');
  }
  if (memberData?.requestCreatedAt?.seconds) {
    return dayjs(memberData.requestCreatedAt.seconds * 1000);
  }
  return dayjs();
};
  // Initialize form with existing member data
  useEffect(() => {
    if (open && memberData) {
      // Find the program
      const program = programList.find(p => p.id === memberData.programId);
      setSelectedProgram(program);

      // Set districts based on state
      if (memberData.state) {
        setDistricts(districtsByState[memberData.state] || []);
      }

   if (program && memberData.bobDate) {
  const birthDate = dayjs(memberData.bobDate, 'DD-MM-YYYY');
  const joinDate = getJoinDate(memberData);

  const decimalAge = getDecimalAge(birthDate, joinDate);
  const age = Math.floor(decimalAge);

  const matchingGroup = program.ageGroups?.find(group =>
    decimalAge >= group.startAge &&
    decimalAge < group.endAge   // 🔥 important
  );

  if (matchingGroup) {
    setSelectedAgeGroup(matchingGroup);
    setPayAmount(matchingGroup.payAmount || 0);
    setJoinFees(matchingGroup.joinFee || 0);

    form.setFieldsValue({
      ageGroup: matchingGroup.id
    });
  } else {
    setSelectedAgeGroup(null);
    setPayAmount(0);
    setJoinFees(0);
  }
}

      // Find location group
      if (program && memberData.locationGroup) {
        const locGroup = program.locationGroups?.find(g => 
          g.location === memberData.locationGroup || g.groupName === memberData.memberGroup
        );
        setSelectedLocationGroup(locGroup);
      }

      // Set extra fields
      if (memberData.extraDetails && Array.isArray(memberData.extraDetails)) {
        setExtraFields(memberData.extraDetails);
      }

      // Set existing images as file list items
      if (memberData.photoURL) {
        setPhoto([{
          uid: '-1',
          name: 'photo.jpg',
          status: 'done',
          url: memberData.photoURL,
        }]);
      }

      if (memberData.extraImageURL) {
        setExtraPhoto([{
          uid: '-2',
          name: 'extra.jpg',
          status: 'done',
          url: memberData.extraImageURL,
        }]);
      }

      if (memberData.documentFrontURL) {
        setDocumentFront([{
          uid: '-3',
          name: 'front.jpg',
          status: 'done',
          url: memberData.documentFrontURL,
        }]);
      }

      if (memberData.documentBackURL) {
        setDocumentBack([{
          uid: '-4',
          name: 'back.jpg',
          status: 'done',
          url: memberData.documentBackURL,
        }]);
      }

      if (memberData.guardianDocumentURL) {
        setGuardianDocument([{
          uid: '-5',
          name: 'guardian.jpg',
          status: 'done',
          url: memberData.guardianDocumentURL,
        }]);
      }
      setAddedBy(memberData.addedBy || 'admin');

const dateJoin = memberData.dateJoin?dayjs(memberData.dateJoin, 'DD-MM-YYYY'):dayjs(memberData.requestCreatedAt.seconds * 1000);
      // Set form values
      form.setFieldsValue({
        displayName: memberData.displayName,
        fatherName: memberData.fatherName,
        guardian: memberData.guardian,
        guardianRelation: memberData.guardianRelation,
        gender:memberData.gender,
        jati: memberData.jati,
        gotra: memberData.gotra || '',
        phone: memberData.phone,
        phoneAlt: memberData.phoneAlt || '',
        aadhaarNo: memberData.aadhaarNo,
        bobDate: dayjs(memberData.bobDate, 'DD-MM-YYYY'),
        dateJoin: dateJoin,
        currentAddress: memberData.currentAddress,
        village: memberData.village,
        state: memberData.state,
        district: memberData.district,
        pinCode: memberData.pinCode,
        program: memberData.programId,
        ageGroup: memberData.ageGroup,
        locationGroup: selectedLocationGroup?.id || undefined,
        addedBy: memberData.addedBy || 'admin',
        selectedAgent: memberData.agentId || undefined,
        joinFeesDone:memberData?.joinFeesDone || false
      });
    }
  }, [open, memberData, programList, form,selectedLocationGroup

  ]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setSelectedProgram(null);
      setPayAmount(0);
      setJoinFees(0);
      setSelectedAgeGroup(null);
      setSelectedLocationGroup(null);
      setPhoto([]);
      setExtraPhoto([]);
      setDocumentFront([]);
      setDocumentBack([]);
      setGuardianDocument([]);
      setExtraFields([]);
      setDistricts([]);
    }
  }, [open, form]);

  // Handle state selection to update districts
  const handleStateSelect = (stateName) => {
    setDistricts(districtsByState[stateName] || []);
    form.setFieldsValue({ district: undefined });
  };
const calculateAge = (birthDate, joinDate) => {
  const join = dayjs(joinDate);
  const years = join.diff(birthDate, 'year');
  const nextBirthday = dayjs(birthDate).add(years + 1, 'year');
  
  // If join date is before the next birthday, then round up
  if (join.isBefore(nextBirthday)) {
    return years + 1;
  }
  
  return years;
};

  // Calculate age and set age group
const handleDateOfBirthChange = (date) => {
  if (!date || !selectedProgram) return;

 
   const joinDate = form.getFieldValue('dateJoin') || dayjs();
 console.log(joinDate,'joinDate')
   // 1️⃣ Get DECIMAL age (important)
   const decimalAge = getDecimalAge(date, joinDate);
 
   // 2️⃣ Display age (optional)
   const age = Math.floor(decimalAge);
 
   console.log(decimalAge, 'decimalAge');
   console.log(age, 'displayAge');
 
   // 3️⃣ Correct dynamic group matching
   const matchingGroup = selectedProgram.ageGroups?.find(group =>
     decimalAge >= group.startAge &&
     decimalAge < group.endAge   // 🔥 NOT <=
   );

  if (matchingGroup) {
    setSelectedAgeGroup(matchingGroup);
    setPayAmount(matchingGroup.payAmount || 0);
    setJoinFees(matchingGroup.joinFee || 0);
    form.setFieldsValue({ ageGroup: matchingGroup.id });
  } else {
    message.warning(`उम्र ${age} इस कार्यक्रम के लिए किसी भी पात्र आयु समूह में नहीं आती है।`);
    form.setFieldsValue({
      bobDate: null,
      ageGroup: undefined
    });
    setSelectedAgeGroup(null);
    setPayAmount(0);
    setJoinFees(0);
  }
};

  // Handle upload changes with cropping support
  const handleUploadChange = (setter) => ({ fileList }) => {
    const updatedFileList = fileList.map(file => {
      if (file.originFileObj instanceof File) {
        return {
          ...file,
          originFileObj: file.originFileObj,
          url: file.url || URL.createObjectURL(file.originFileObj)
        };
      }
      return file;
    });
    setter(updatedFileList.slice(-1));
  };

  // Preview uploaded files
  const onPreview = async (file) => {
    let src = file.url;
    if (!src && file.originFileObj) {
      src = await new Promise(resolve => {
        const reader = new FileReader();
        reader.readAsDataURL(file.originFileObj);
        reader.onload = () => resolve(reader.result);
      });
    }
    const imgWindow = window.open('', '_blank');
    if (imgWindow) {
      imgWindow.document.write(`<img src="${src}" style="max-width:100%; height:auto;">`);
    }
  };

  // Extra Dynamic Fields Handlers
  const handleAddExtraField = () => {
    setExtraFields([...extraFields, { label: '', value: '' }]);
  };

  const handleExtraFieldChange = (index, key, value) => {
    const newFields = [...extraFields];
    newFields[index][key] = value;
    setExtraFields(newFields);
  };

  const handleRemoveExtraField = (index) => {
    const newFields = extraFields.filter((_, i) => i !== index);
    setExtraFields(newFields);
  };
    const handleRemovePhoto = async (file) => {
    if (file.url && file.url.startsWith('https://firebasestorage.googleapis.com')) {
      try {
        const fileRef = ref(storage, file.url);
        await deleteObject(fileRef);
        message.success('File removed successfully');
      } catch (error) {
        console.error("Error removing file: ", error);
        message.error('Failed to remove file');
      }
    }
  };

  // Form submission
  const onFinish = async (values) => {
    setLoading(true);

    try {
      const updatedData = { ...memberData };

      // Handle file uploads - only upload new files
      const uploadPromises = [];

      // Photo
      if (photo.length && photo[0].originFileObj) {
        uploadPromises.push(
          uploadFile(`/users/${user.uid}/programs/${programId}/members`, photo[0].originFileObj)
            .then(result => { updatedData.photoURL = result.url; })
        );
      }

      // Extra Photo
      if (extraPhoto.length && extraPhoto[0].originFileObj) {
        uploadPromises.push(
          uploadFile(`/users/${user.uid}/programs/${programId}/members`, extraPhoto[0].originFileObj)
            .then(result => { updatedData.extraImageURL = result.url; })
        );
      } else if (!extraPhoto.length) {
        updatedData.extraImageURL = '';
      }

      // Document Front
      if (documentFront.length && documentFront[0].originFileObj) {
        uploadPromises.push(
          uploadFile(`/users/${user.uid}/programs/${programId}/members`, documentFront[0].originFileObj)
            .then(result => { updatedData.documentFrontURL = result.url; })
        );
      }

      // Document Back
      if (documentBack.length && documentBack[0].originFileObj) {
        uploadPromises.push(
          uploadFile(`/users/${user.uid}/programs/${programId}/members`, documentBack[0].originFileObj)
            .then(result => { updatedData.documentBackURL = result.url; })
        );
      } else if (!documentBack.length) {
        updatedData.documentBackURL = '';
      }

      // Guardian Document
      if (guardianDocument.length && guardianDocument[0].originFileObj) {
        uploadPromises.push(
          uploadFile(`/users/${user.uid}/programs/${programId}/members`, guardianDocument[0].originFileObj)
            .then(result => { updatedData.guardianDocumentURL = result.url; })
        );
      }

      // Wait for all uploads
      await Promise.all(uploadPromises);

      const agentName = values.addedBy === 'agent' 
        ? agentsList.find(agent => agent.id === values.selectedAgent)?.displayName || '' 
        : '';

      // Update member data
      const updatedMemberData = {
        ...updatedData,
        displayName: values.displayName,
        fatherName: values.fatherName,
        guardian: values.guardian,
        guardianRelation: values.guardianRelation,
        gender:values.gender,
        jati: values.jati,
        gotra: values.gotra || '',
        phone: values.phone,
        phoneAlt: values.phoneAlt || '',
        aadhaarNo: values.aadhaarNo,
        bobDate: values.bobDate.format('DD-MM-YYYY'),
        currentAddress: values.currentAddress,
        village: values.village,
        state: values.state,
        district: values.district,
        joinFeesDone:values.joinFeesDone,
        pinCode: values.pinCode,
        ageGroup: selectedAgeGroup?.id,
        ageGroupRange: `${selectedAgeGroup?.startAge}-${selectedAgeGroup?.endAge}`,
        memberGroup: selectedLocationGroup?.groupName || 'Group_A',
        locationGroup: selectedLocationGroup?.location || '',
        payAmount: payAmount,
        joinFees: joinFees,
        addedBy: values.addedBy,
        addedByName: values.addedBy === 'agent' ? agentName : 'Admin',
        agentId: values.addedBy === 'agent' ? values.selectedAgent : null,
        extraDetails: extraFields.filter(f => f.label && f.value),
        updatedAt: new Date(),
      };

      // Update in Firestore
      const memberDocRef = doc(db, `/users/${user.uid}/programs/${programId}/members/${memberData.id}`);
      await updateDoc(memberDocRef, updatedMemberData);

      message.success('सदस्य सफलतापूर्वक अपडेट किया गया!');
      setOpen(false);
      
      if (onSuccess) {
        onSuccess(updatedMemberData);
      }

    } catch (error) {
      console.error('सदस्य अपडेट करने में त्रुटि:', error);
      message.error('सदस्य अपडेट करने में विफल। कृपया पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  if (!memberData) return null;

  return (
    <>
   

      <Drawer
        title={<Title level={4} style={{ margin: 0 }}>सदस्य विवरण संपादित करें</Title>}
        width={800}
        placement="right"
        onClose={() => !loading && setOpen(false)}
        open={open}
        maskClosable={false}
        keyboard={false}
        closable={!loading}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setOpen(false)} size="large" disabled={loading}>
              रद्द करें
            </Button>
            <Button
              onClick={() => form.submit()}
              type="primary"
              loading={loading}
              disabled={loading}
              size="large"
              icon={loading ? <LoadingOutlined /> : null}
            >
              {loading ? 'अपडेट हो रहा है...' : 'अपडेट करें'}
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div className='min-h-[50vh] w-full flex flex-col items-center justify-center'>
            <Spin spinning={loading} size="large" />
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: 8 }}>
                सदस्य अपडेट हो रहा है...
              </Text>
              <Text type="secondary">कृपया प्रतीक्षा करें</Text>
            </div>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            scrollToFirstError
            disabled={loading}
          >
            {/* कार्यक्रम जानकारी (Read-only) */}
            <Card className="mb-4" size="small">
              <Form.Item label={<Text strong>कार्यक्रम</Text>}>
                <Input value={selectedProgram?.name} disabled />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="पंजीकरण संख्या">
                    <Input value={memberData.registrationNumber} disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="सदस्य संख्या">
                    <Input value={memberData.memberNumber} disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="जुड़ने की तारीख">
                    <Input value={memberData.dateJoin} disabled />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* व्यक्तिगत जानकारी */}
            <Divider orientation="left">व्यक्तिगत जानकारी</Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="displayName"
                  label="नाम"
                  rules={[{ required: true, message: 'आवश्यक' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="पूरा नाम" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="fatherName"
                  label="पिता का नाम"
                  rules={[{ required: true, message: 'आवश्यक' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="पिता का नाम" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="jati"
                  label="जाति (Jati)"
                  rules={[{ required: true, message: 'आवश्यक' }]}
                >
                  <Input placeholder="जाति" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="gotra" label="गोत्र (Gotra) (वैकल्पिक)">
                  <Input placeholder="गोत्र" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="guardian"
                  label="वारिसदार का नाम"
                  rules={[{ required: true, message: 'आवश्यक' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="वारिसदार का नाम" />
                </Form.Item>
              </Col>
              <Col span={8}>
              <div className='grid grid-cols-2 gap-1'>
                                    <Form.Item
                                      name="guardianRelation"
                                      label="वारि से संबंध"
                                      rules={[{ required: true, message: 'आवश्यक' }]}
                                    >
                                      <Input placeholder="उदाहरण: पिता, माता" />
                                    </Form.Item>
              
                                    <Form.Item
                                      name="gender"
                                      label="Gender(लिंग)"
                                      rules={[{ required: true, message: 'आवश्यक' }]}
                                    >
                                      <Select placeholder="लिंग चुनें" showSearch>
                                        {gender.map(state => (
                                          <Option key={state.value} value={state.value}>{state.label}</Option>
                                        ))}
                                      </Select>
                                    </Form.Item>
                                  </div>
                
              </Col>
            </Row>

            {/* संपर्क जानकारी */}
            <Divider orientation="left">संपर्क जानकारी</Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="phone"
                  label="प्राथमिक फ़ोन"
                  rules={[
                    { required: true, message: 'आवश्यक' },
                    { len: 10, message: '10 अंक होने चाहिए' },
                    { pattern: /^[0-9]{10}$/, message: 'अमान्य फ़ोन नंबर' }
                  ]}
                >
                  <Input prefix={<PhoneOutlined />} placeholder="10 अंकों का नंबर" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="phoneAlt"
                  label="वैकल्पिक फ़ोन"
                  rules={[
                    { len: 10, message: '10 अंक होने चाहिए' },
                    { pattern: /^[0-9]{10}$/, message: 'अमान्य फ़ोन नंबर' }
                  ]}
                >
                  <Input prefix={<PhoneOutlined />} placeholder="वैकल्पिक" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="aadhaarNo"
                  label="आधार संख्या"
                  rules={[
                    { required: true, message: 'आवश्यक' },
                    { len: 12, message: '12 अंक होने चाहिए' },
                    { pattern: /^[0-9]{12}$/, message: 'अमान्य आधार' }
                  ]}
                >
                  <Input prefix={<IdcardOutlined />} placeholder="12 अंकों का आधार" />
                </Form.Item>
              </Col>
            </Row>

            {/* आयु और कार्यक्रम विवरण */}
            <Divider orientation="left">आयु और कार्यक्रम विवरण</Divider>

            <Row gutter={16}>
                 <Col span={8}>
                    <Form.Item
                      name="dateJoin"
                      label="जुड़ने की तारीख"
                      rules={[{ required: true, message: 'आवश्यक' }]}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        format="DD-MM-YYYY"
                        prefix={<CalendarOutlined />}
                        disabledDate={(current) => current && current > dayjs()}
                      />
                    </Form.Item>
                  </Col>
              <Col span={8}>
                <Form.Item
                  name="bobDate"
                  label="जन्म तिथि"
                  rules={[{ required: true, message: 'आवश्यक' }]}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    format="DD-MM-YYYY"
                    onChange={handleDateOfBirthChange}
                    disabledDate={(current) => current && current > dayjs()}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="आयु समूह">
                  <Input
                    value={selectedAgeGroup ? `${selectedAgeGroup.startAge}-${selectedAgeGroup.endAge} वर्ष` : ''}
                    disabled
                    placeholder="स्वचालित रूप से गणना"
                  />
                </Form.Item>
              </Col>
            
            </Row>

            <Row gutter={16}>
                <Col span={8}>
                <Form.Item
                  name="locationGroup"
                  label="स्थान समूह"
                  rules={[{ required: true, message: 'आवश्यक' }]}
                >
                  <Select
                    placeholder="स्थान चुनें"
                    onChange={(value) => {
                      const group = selectedProgram?.locationGroups?.find(g => g.id === value);
                      setSelectedLocationGroup(group);
                    }}
                    value={selectedLocationGroup?.id}
                  >
                    {selectedProgram?.locationGroups?.map(group => (
                      <Option key={group.id} value={group.id}>
                        {group.location} - {group.groupName}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="वेतन राशि">
                  <Input
                    value={`₹${payAmount}`}
                    disabled
                    style={{ fontWeight: 'bold', color: '#52c41a' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="नामांकन शुल्क">
                  <Input
                    value={`₹${joinFees}`}
                    disabled
                    style={{ fontWeight: 'bold', color: '#1890ff' }}
                  />
                </Form.Item>
              </Col>
              {/* <Col span={8}>
                <Form.Item label="शुल्क स्थिति">
                  <Input 
                    value={memberData.joinFeesDone ? 'भुगतान किया' : 'लंबित'} 
                    disabled 
                    style={{ 
                      fontWeight: 'bold', 
                      color: memberData.joinFeesDone ? '#52c41a' : '#ff4d4f' 
                    }}
                  />
                </Form.Item>
              </Col> */}
            </Row>

            {/* पता जानकारी */}
            <Divider orientation="left">पता जानकारी</Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="state"
                  label="राज्य"
                  rules={[{ required: true, message: 'आवश्यक' }]}
                >
                  <Select placeholder="राज्य चुनें" showSearch onChange={handleStateSelect}>
                    {states.map(state => (
                      <Option key={state.value} value={state?.value}>{state?.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="district"
                  label="ज़िला (District)"
                  rules={[{ required: true, message: 'आवश्यक' }]}
                >
                  <Select placeholder="ज़िला चुनें" showSearch disabled={districts.length === 0}>
                    {districts.map(district => (
                      <Option key={district.value} value={district?.value}>{district?.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="village"
                  label="गाँव"
                  rules={[
                    { required: true, message: 'आवश्यक' },
                    { pattern: /^[a-zA-Z\s\u0900-\u097F]{2,50}$/, message: 'केवल अक्षर (2-50 अक्षर)' }
                  ]}
                >
                  <Input prefix={<HomeOutlined />} placeholder="गाँव का नाम" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="pinCode"
                  label="पिन कोड"
                  rules={[
                    { required: true, message: 'आवश्यक' },
                    { len: 6, message: '6 अंक होने चाहिए' }
                  ]}
                >
                  <Input placeholder="6 अंकों का पिनकोड" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="currentAddress"
              label="वर्तमान पता"
              rules={[{ required: true, message: 'आवश्यक' }]}
            >
              <TextArea rows={2} placeholder="पूरा पता" />
            </Form.Item>

            {/* दस्तावेज़ और फोटो अपलोड */}
            <Divider orientation="left">दस्तावेज़ और फोटो</Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="सदस्य का फोटो">
                  <ImgCrop 
                    rotate 
                    showGrid 
                    rotationSlider 
                    aspectSlider 
                    showReset
                    quality={0.9}
                  >
                    <Upload
                      listType="picture-card"
                      fileList={photo}
                      onChange={handleUploadChange(setPhoto)}
                      onPreview={onPreview}
                      onRemove={handleRemovePhoto}
                      maxCount={1}
                      accept="image/*"
                    >
                      {!photo.length && (
                        <div>
                          <CameraOutlined />
                          <div style={{ marginTop: 8 }}>फोटो</div>
                        </div>
                      )}
                    </Upload>
                  </ImgCrop>
                </Form.Item>
              </Col>

              <Col span={8}>
                <Form.Item label="अतिरिक्त फोटो">
                  <ImgCrop 
                    rotate 
                    showGrid 
                    rotationSlider 
                    aspectSlider 
                    showReset
                    quality={0.9}
                  >
                    <Upload
                      listType="picture-card"
                      fileList={extraPhoto}
                      onChange={handleUploadChange(setExtraPhoto)}
                      onPreview={onPreview}
                      onRemove={handleRemovePhoto}
                      maxCount={1}
                      accept="image/*"
                    >
                      {!extraPhoto.length && (
                        <div>
                          <UploadOutlined />
                          <div style={{ marginTop: 8 }}>अतिरिक्त</div>
                        </div>
                      )}
                    </Upload>
                  </ImgCrop>
                </Form.Item>
              </Col>

               <Col span={8}>
                  <Form.Item
                    label="दस्तावेज़ अग्र भाग (Front) *"
                    required
                    tooltip="आईडी दस्तावेज़ का अग्र भाग अपलोड करें"
                  >
                    <Upload
                      listType="picture-card"
                      fileList={documentFront}
                      onChange={handleUploadChange(setDocumentFront)}
                      onPreview={onPreview}
                      onRemove={handleRemovePhoto}
                      beforeUpload={() => false}
                      maxCount={1}
                    >
                      {!documentFront.length && (
                        <div>
                          <UploadOutlined />
                          <div style={{ marginTop: 8 }}>फ्रंट</div>
                        </div>
                      )}
                    </Upload>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="दस्तावेज़ पिछला भाग (Back) (Optional)"
                    tooltip="आईडी दस्तावेज़ का पिछला भाग अपलोड करें (वैकल्पिक)"
                  >
                    <Upload
                      listType="picture-card"
                      fileList={documentBack}
                      onChange={handleUploadChange(setDocumentBack)}
                      onPreview={onPreview}
                      onRemove={handleRemovePhoto}
                      beforeUpload={() => false}
                      maxCount={1}
                    >
                      {!documentBack.length && (
                        <div>
                          <UploadOutlined />
                          <div style={{ marginTop: 8 }}>बैक</div>
                        </div>
                      )}
                    </Upload>
                  </Form.Item>
                </Col>

                <Col span={8}>
                  <Form.Item
                    label="वारिसदार का दस्तावेज़ *"
                    required
                    tooltip="वारिसदार की आईडी अपलोड करें"
                  >
                    <Upload
                      listType="picture-card"
                      fileList={guardianDocument}
                      onChange={handleUploadChange(setGuardianDocument)}
                      onPreview={onPreview}
                      onRemove={handleRemovePhoto}

                      beforeUpload={() => false}
                      maxCount={1}
                    >
                      {!guardianDocument.length && (
                        <div>
                          <UploadOutlined />
                          <div style={{ marginTop: 8 }}>वारिसदार</div>
                        </div>
                      )}
                    </Upload>
                  </Form.Item>
                </Col>
              </Row>

              {/* अतिरिक्त जानकारी (Dynamic Fields) */}
              <Divider orientation="left">अतिरिक्त जानकारी (Optional)</Divider>
              <Card size="small">
                {extraFields.map((field, index) => (
                  <Row gutter={16} key={index} className="mb-2">
                    <Col span={8}>
                      <Input
                        prefix={<TagOutlined />}
                        placeholder="लेबल (उदाहरण: व्यवसाय)"
                        value={field.label}
                        onChange={(e) => handleExtraFieldChange(index, 'label', e.target.value)}
                      />
                    </Col>
                    <Col span={12}>
                      <Input
                        placeholder="मान (Value)"
                        value={field.value}
                        onChange={(e) => handleExtraFieldChange(index, 'value', e.target.value)}
                      />
                    </Col>
                    <Col span={4}>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveExtraField(index)}
                      >
                        हटाएँ
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  onClick={handleAddExtraField}
                  block
                  icon={<PlusOutlined />}
                  style={{ marginTop: extraFields.length > 0 ? 16 : 0 }}
                >
                  और फ़ील्ड जोड़ें
                </Button>
              </Card>

              {/* व्यवस्थापक/एजेंट चयन */}
              <Divider orientation="left">जोड़ा गया</Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="addedBy"
                    label="जोड़ा गया"
                    rules={[{ required: true }]}
                  >
                    <Select onChange={setAddedBy}>
                      <Option value="admin">व्यवस्थापक (Admin)</Option>
                      <Option value="agent">एजेंट</Option>
                    </Select>
                  </Form.Item>
                </Col>

                {addedBy === 'agent' && (
                  <Col span={12}>
                    <Form.Item
                      name="selectedAgent"
                      label="एजेंट चुनें"
                      rules={[{ required: true, message: 'कृपया एक एजेंट चुनें' }]}
                    >
                      <Select
                        placeholder="एजेंट चुनें"
                        showSearch
                        optionFilterProp="children"
                      >
                        {agentsList.map(agent => (
                          <Option key={agent.id} value={agent.id}>
                            {agent.displayName}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                )}
              </Row>

      <Form.Item name="joinFeesDone" valuePropName="checked" rules={[{ required: false, message: 'Please Join Fees Jama required' }]}>
                            <Checkbox>Join Fees Jama ?</Checkbox>
                          </Form.Item>
              {/* Hidden field for age group ID */}
              <Form.Item name="ageGroup" hidden>
                <Input />
              </Form.Item>
             </Form>
          )}
     
      
      </Drawer>
    </>
  );
}

export default EditMember;