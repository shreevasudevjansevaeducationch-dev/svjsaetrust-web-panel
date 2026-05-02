"use client";
import { getData, updateData } from '@/lib/services/firebaseService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { 
  Avatar, Button, Card, Col, Space, Table, Typography, Modal, 
  Form, Input, DatePicker, Tag, Divider, Image, 
  Upload, Row, Col as AntCol,
  App, Progress,
  Drawer, Select, Badge, Alert
} from 'antd'
import React, { use, useEffect, useState } from 'react'
import { 
  EyeOutlined, EditOutlined, CheckCircleOutlined, 
  UserOutlined, UploadOutlined, CalendarOutlined,
  FileTextOutlined, PictureOutlined, DeleteOutlined,
  FilePdfOutlined, TeamOutlined, SwapOutlined, PlusOutlined,
  RollbackOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { db, storage } from '@/lib/firebase';
import ClosingPendingPayment from './ClosingMember/ClosingPendingPayment';
import AllClosingPendingPayment from './ClosingMember/AllClosingPendingPayment';
import ClosingFormPdfDraver from './ClosingMember/ClosingFormPdfDraver';
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion, arrayRemove, getDoc, addDoc } from 'firebase/firestore';
import ClosingBannerImageDrawer from './ClosingMember/ClosingBannerImageDrawer';
import EditPdfDataForm from './ClosingMember/EditPdfDataForm';
import { getAuth } from 'firebase/auth';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ClosingCom = ({user, selectedProgram}) => {
  const [allMembersData, setAllMembersData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isOpenDrawer, setIsOpenDrawer] = useState(false);
  const[isOpen,setIsOpen]=useState(false);
  const [editForm] = Form.useForm();


  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const {message,modal}=App.useApp();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isOpenBanner, setIsOpenBanner] = useState(false);
  const [isEditPdfDataOpen, setIsEditPdfDataOpen] = useState(false);
  
  // Group related states
  const [closingGroups, setClosingGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [previousGroupId, setPreviousGroupId] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [changingGroup, setChangingGroup] = useState(false);
  const [revertingId, setRevertingId] = useState(null);

  // Fetch closing groups
  const fetchClosingGroups = async () => {
    if (!user || !selectedProgram) return;
    
    try {
      const groupsRef = collection(
        db,
        `users/${user.uid}/programs/${selectedProgram.id}/closing_groups`
      );
      const groupsSnapshot = await getDocs(groupsRef);
      const groups = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClosingGroups(groups);
    } catch (error) {
      console.error('Error fetching closing groups:', error);
    }
  };

  // Create new group
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      message.error('Please enter a group name');
      return;
    }
    
    try {
      setCreatingGroup(true);
      
      const groupsRef = collection(
        db,
        `users/${user.uid}/programs/${selectedProgram.id}/closing_groups`
      );
      
      const newGroup = {
        name: newGroupName.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        memberCount: 0,
        members: [],
        programId: selectedProgram.id,
        status: 'active'
      };
      
      const docRef = await addDoc(groupsRef, newGroup);
      
      const createdGroup = {
        id: docRef.id,
        ...newGroup
      };
      
      setClosingGroups([...closingGroups, createdGroup]);
      setSelectedGroupId(docRef.id);
      setNewGroupName('');
      setGroupModalVisible(false);
      message.success('Group created!');
      
    } catch (error) {
      console.error('Error creating group:', error);
      message.error('Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Add member to group
  const addMemberToGroup = async (groupId, marriageDate) => {
    try {
      const groupRef = doc(
        db,
        `users/${user.uid}/programs/${selectedProgram.id}/closing_groups`,
        groupId
      );
      
      const groupSnap = await getDoc(groupRef);
      
      if (groupSnap.exists()) {
        const groupData = groupSnap.data();
        const currentMembers = groupData.members || [];
        
        const memberExists = currentMembers.some(m => m.memberId === selectedRecord.id);
        
        if (!memberExists) {
          const newMember = {
            memberId: selectedRecord.id,
            name: selectedRecord.displayName || selectedRecord.name,
            registrationNumber: selectedRecord.registrationNumber,
            fatherName: selectedRecord.fatherName,
            village: selectedRecord.village,
            district: selectedRecord.district,
            phone: selectedRecord.phone || selectedRecord.phoneNo,
            marriageDate: marriageDate ? marriageDate.format('DD-MM-YYYY') : selectedRecord.closing_date,
            closedAt: dayjs().format('DD-MM-YYYY HH:mm:ss'),
            status: 'closed'
          };
          
          await updateDoc(groupRef, {
            members: arrayUnion(newMember),
            memberCount: currentMembers.length + 1,
            updatedAt: new Date().toISOString()
          });
          
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error adding member to group:', error);
      return false;
    }
  };

  // Remove member from group
  const removeMemberFromGroup = async (groupId) => {
    try {
      const groupRef = doc(
        db,
        `users/${user.uid}/programs/${selectedProgram.id}/closing_groups`,
        groupId
      );
      
      const groupSnap = await getDoc(groupRef);
      
      if (groupSnap.exists()) {
        const groupData = groupSnap.data();
        const currentMembers = groupData.members || [];
        
        const memberToRemove = currentMembers.find(m => m.memberId === selectedRecord.id);
        
        if (memberToRemove) {
          await updateDoc(groupRef, {
            members: arrayRemove(memberToRemove),
            memberCount: currentMembers.length - 1,
            updatedAt: new Date().toISOString()
          });
          
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error removing member from group:', error);
      return false;
    }
  };

  // Handle Pay Status
  const handlePayStatus = async (record) => {
    try {
      setSelectedRecord(record);
      setIsDrawerOpen(true);
    } catch (error) {
      console.error(error);
    }
  };

  // Handle View
  const handleView = (record) => {
    setSelectedRecord(record);
    setViewModalVisible(true);
  };

  // Handle Edit - Include group selection
  const handleEdit = async (record) => {
    setSelectedRecord(record);
    
    // Fetch latest groups
    await fetchClosingGroups();
    
    // Set selected group if exists
    const currentGroupId = record.closingGroupId || null;
    setSelectedGroupId(currentGroupId);
    setPreviousGroupId(currentGroupId);
    
    editForm.setFieldsValue({
      marriage_date: record.closing_date ? dayjs(record.closing_date, 'DD-MM-YYYY') : null,
      closing_date: record.closing_date ? dayjs(record.closing_date, 'DD-MM-YYYY') : null,
      closingNotes: record.closingNotes || '',
    });
    
    setEditModalVisible(true);
    setSelectedFile(null);
    setFilePreview(null);
  };

  // Handle Edit PDF Data
  const handleEditPdfData = (record) => {
    setSelectedRecord(record);
    setIsEditPdfDataOpen(true);
  };

  // Handle saving PDF data
  const handleSavePdfData = async (updatedData) => {
    try {
      const formattedValues = {
        ...updatedData,
        updatedAt: new Date().toISOString(),
      };

      await updateData(
        `/users/${user.uid}/programs/${selectedProgram?.id}/members`,
        selectedRecord.id,
        { pdfData: formattedValues }
      );

      message.success('PDF data updated successfully!');
      getClosingData();
      setIsEditPdfDataOpen(false);
      
    } catch (error) {
      console.error('Error saving PDF data:', error);
      message.error('Failed to save PDF data. Please try again.');
    }
  };

  // Handle Edit Submit - Update closing details and group
  const handleEditSubmit = async (values) => {
    try {
      setChangingGroup(true);
      
      const formattedValues = {
        marriage_date: values.closing_date ? values.closing_date.format('DD-MM-YYYY') : null,
        closing_date: values.closing_date ? values.closing_date.format('DD-MM-YYYY') : null,
        closingNotes: values.closingNotes,
        updatedAt: new Date().toISOString(),
      };

      // Handle group changes
      let groupUpdated = false;
      
      if (selectedGroupId !== previousGroupId) {
        // Remove from old group
        if (previousGroupId) {
          await removeMemberFromGroup(previousGroupId);
          message.info(`Removed from previous group`);
        }
        
        // Add to new group
        if (selectedGroupId) {
          const added = await addMemberToGroup(selectedGroupId, values.closing_date);
          if (added) {
            const newGroup = closingGroups.find(g => g.id === selectedGroupId);
            message.success(`Added to group: ${newGroup?.name}`);
            groupUpdated = true;
          }
        }
        
        // Update group info in member document
        if (selectedGroupId) {
          const selectedGroup = closingGroups.find(g => g.id === selectedGroupId);
          formattedValues.closingGroupId = selectedGroupId;
          formattedValues.closingGroupName = selectedGroup?.name || '';
        } else {
          formattedValues.closingGroupId = null;
          formattedValues.closingGroupName = null;
        }
      }

      // If there's a new file selected, upload it first
      if (selectedFile) {
        try {
          const downloadURL = await uploadInvitationCard(selectedFile);
          formattedValues.invitationCardURL = downloadURL;
          message.success('Invitation card uploaded successfully');
        } catch (error) {
          message.error('Failed to upload invitation card');
          return;
        }
      }

      await updateData(
        `/users/${user.uid}/programs/${selectedProgram?.id}/members`,
        selectedRecord.id,
        formattedValues
      );

      if (groupUpdated) {
        message.success('Closing details and group updated successfully!');
      } else {
        message.success('Closing details updated successfully');
      }
      
      setEditModalVisible(false);
      setSelectedFile(null);
      setFilePreview(null);
      setSelectedGroupId(null);
      setPreviousGroupId(null);
      getClosingData();
      fetchClosingGroups(); // Refresh groups list
      
    } catch (error) {
      message.error('Failed to update closing details');
      console.error(error);
    } finally {
      setChangingGroup(false);
    }
  };

  // File upload handler
  const handleFileSelect = (file) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      message.error('Invalid file type. Please upload JPG, PNG, or PDF files.');
      return false;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      message.error('File size too large. Maximum size is 5MB.');
      return false;
    }

    setSelectedFile(file);
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }

    return false;
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };
    const handleRevertClosing = (record) => {
  modal.confirm({
    title: 'Revert Closing Case?',
    icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
    content: (
      <div>
        <p>
          This will permanently <strong>delete all payment entries</strong> created
          for <strong>{record.displayName}</strong>'s marriage case and reset the
          member back to <em>accepted</em> status.
        </p>
        <p style={{ marginTop: 8, color: '#ff4d4f', fontSize: 13 }}>
          ⚠️ This action cannot be undone.
        </p>
      </div>
    ),
    okText: 'Yes, Revert',
    okButtonProps: { danger: true },
    cancelText: 'Cancel',
    onOk: () => doRevert(record),
  });
};
    const doRevert = async (record) => {
  try {
    setRevertingId(record.id);
 
    // Get current user's ID token
    const auth = getAuth();
    const token = await auth.currentUser.getIdToken();
 
    const res = await fetch(
      process.env.NEXT_PUBLIC_REVERT_CLOSING_MEMBERS_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.uid,
          programId: selectedProgram?.id,
          memberId: record.id,
        }),
      }
    );
 
    const data = await res.json();
 
    if (!res.ok) {
      throw new Error(data.message || "Failed to revert");
    }
 
    message.success(data.message || "Closing reverted successfully!");
    getClosingData();
  } catch (error) {
    console.error("Revert error:", error);
    message.error(error.message || "Failed to revert closing. Please try again.");
  } finally {
    setRevertingId(null);
  }
};

  // Upload function
  const uploadInvitationCard = async (file) => {
    try {
      setUploading(true);
      
      const fileExtension = file.name.split('.').pop();
      const fileName = `invitation_${selectedRecord.id}_${uuidv4()}.${fileExtension}`;
      
      const storageRef = ref(
        storage, 
        `users/${user.uid}/programs/${selectedProgram?.id}/members/${selectedRecord.id}/invitation_cards/${fileName}`
      );
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
      
    } catch (error) {
      console.error('Error uploading invitation card:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const columns = [
    {
      title: 'Member Name',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text, record) => (
        <div className='flex items-center gap-2'>
          <Avatar 
            src={record.photoURL} 
            icon={<UserOutlined />} 
            size="small"
          />
          <div>
            <Text strong>{text}</Text>
            <div className="text-xs text-gray-500">
              {record.fatherName}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Reg No',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
    },
    {
      title: 'Closing Date',
      dataIndex: 'closing_date',
      key: 'closing_date',
      render: (text) => text || 'N/A',
    },
    {
      title: 'Closing Group',
      key: 'closingGroup',
      render: (_, record) => (
        record.closingGroupName ? (
          <Tag color="green" icon={<TeamOutlined />}>
            {record.closingGroupName}
          </Tag>
        ) : (
          <Tag color="default">No Group</Tag>
        )
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
            title="View Details"
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            title="Edit Closing Details"
          />
          <Button
            type="text"
            size="small"
            icon={<FilePdfOutlined />}
            onClick={() => handleEditPdfData(record)}
            title="Edit PDF Data"
          />
          <Button
            type="text"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handlePayStatus(record)}
            title={'Member Pay Status'}
          />
           <Button
          type="text"
          size="small"
          danger
          icon={
            revertingId === record.id
              ? <span className="anticon anticon-loading"><span className="ant-spin-dot-item" /></span>
              : <RollbackOutlined />
          }
          loading={revertingId === record.id}
          onClick={() => handleRevertClosing(record)}
          title="Revert Closing (Delete all payments)"
        />
        </Space>
      ),
    },
  ];

  const getClosingData = async () => {
    setIsLoading(true);
    if (!user || !selectedProgram) {
      setIsLoading(false);
      return;
    }
    try {
      const memberData = await getData(
        `/users/${user.uid}/programs/${selectedProgram?.id}/members`,
        [
          { field: 'active_flag', operator: '==', value: true },
          { field: 'delete_flag', operator: '==', value: false },
          { field: 'marriage_flag', operator: '==', value: true },
          { field: 'status', operator: 'in', value: ['closed','accepted'] }
        ],
        { field: 'closingAt', direction: 'desc' }
      );
      setAllMembersData(memberData);
    } catch (error) {
      console.error("Error fetching closing data:", error);
      message.error("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && selectedProgram) {
      getClosingData();
      fetchClosingGroups();
    }
  }, [user, selectedProgram]);

  // View Modal Content
  const renderViewModalContent = () => {
    if (!selectedRecord) return null;

    return (
      <div className="p-4">
        {/* Header with Basic Info */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar 
            src={selectedRecord.photoURL} 
            size={80} 
            icon={<UserOutlined />}
          />
          <div>
            <Title level={4} className="!mb-1">{selectedRecord.displayName}</Title>
            <Text type="secondary">Registration: {selectedRecord.registrationNumber}</Text>
            <div className="mt-1">
              <Tag color="blue">{selectedRecord.gender}</Tag>
              <Tag color="green">{selectedRecord.ageGroupRange}</Tag>
              <Tag color={selectedRecord.joinFeesDone ? 'success' : 'error'}>
                {selectedRecord.joinFeesDone ? 'Paid' : 'Pending'}
              </Tag>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Button type='primary' onClick={() => setIsOpen(true)}>
              Closing Form PDF
            </Button>
            <Button 
              type='default' 
              icon={<FilePdfOutlined />}
              onClick={() => handleEditPdfData(selectedRecord)}
            >
              Banner Image 
            </Button>
          </div>
        </div>

        <Divider />

        {/* PDF Data Summary */}
        {selectedRecord.pdfData && (
          <div className="mb-6 border rounded-lg p-4 bg-gray-50">
            <Title level={5} className="!mb-3">
              <FilePdfOutlined className="mr-2" />
              PDF Data Summary
            </Title>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text strong className="block mb-1">Document No:</Text>
                <Text>{selectedRecord.pdfData.documentNumber}</Text>
              </div>
              <div>
                <Text strong className="block mb-1">Date:</Text>
                <Text>{selectedRecord.pdfData.date}</Text>
              </div>
              <div>
                <Text strong className="block mb-1">Total Donation:</Text>
                <Text>₹{selectedRecord.pdfData?.donationCalculations?.totalBeforeDeduction?.toLocaleString('en-IN') || '0'}</Text>
              </div>
              <div>
                <Text strong className="block mb-1">Final Amount:</Text>
                <Text>₹{selectedRecord.pdfData?.donationCalculations?.finalAmount?.toLocaleString('en-IN') || '0'}</Text>
              </div>
            </div>
          </div>
        )}

        {/* Closing Group Info */}
        {selectedRecord.closingGroupName && (
          <div className="mb-6 border rounded-lg p-4 bg-blue-50">
            <Title level={5} className="!mb-3">
              <TeamOutlined className="mr-2" />
              Closing Group
            </Title>
            <Tag color="green" icon={<TeamOutlined />} style={{ fontSize: '14px', padding: '4px 12px' }}>
              {selectedRecord.closingGroupName}
            </Tag>
          </div>
        )}

        {/* Closing Details Section */}
        <div className="mb-6">
          <Title level={5} className="!mb-4">
            <CalendarOutlined className="mr-2" />
            Closing Details
          </Title>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border rounded-lg p-4">
              <Text strong className="block mb-2">Marriage Date:</Text>
              <Text className="text-lg">
                {selectedRecord.closing_date || 'Not set'}
              </Text>
            </div>
            
            <div className="border rounded-lg p-4">
              <Text strong className="block mb-2">Closing Date:</Text>
              <Text className="text-lg">
                {selectedRecord.closing_date || 'Not set'}
              </Text>
            </div>
          </div>

          <div className="border rounded-lg p-4 mb-6">
            <Text strong className="block mb-2">
              <FileTextOutlined className="mr-2" />
              Closing Notes:
            </Text>
            <Text className="whitespace-pre-line">
              {selectedRecord.closingNotes || 'No closing notes provided'}
            </Text>
          </div>

          {/* Invitation Card */}
          <div className="border rounded-lg p-4">
            <Text strong className="block mb-3">
              <PictureOutlined className="mr-2" />
              Invitation Card
            </Text>
            
            {selectedRecord.invitationCardURL ? (
              <div className="flex flex-col items-center">
                <Image
                  src={selectedRecord.invitationCardURL}
                  alt="Invitation Card"
                  className="rounded-lg shadow-md mb-3 max-w-[300px]"
                  preview={{
                    mask: 'View Larger',
                  }}
                />
                <Button 
                  type="link" 
                  href={selectedRecord.invitationCardURL} 
                  target="_blank"
                  className="mt-2"
                >
                  Open in New Tab
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <PictureOutlined className="text-4xl text-gray-400 mb-2" />
                <Text type="secondary" className="block">
                  No invitation card uploaded
                </Text>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Col className='w-full'>
      <Card
        title={<Title level={4} className="!mb-0">✅ Closed Cases</Title>}
        className="shadow-md h-full"
        extra={
          <Space>
            <Button onClick={() => setIsOpenDrawer(true)}>Pay Status</Button>
            <Button onClick={getClosingData}>Refresh</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={allMembersData}
          rowKey="id"
          pagination={{ 
            pageSize: 5,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} members`
          }}
          scroll={{ x: 900 }}
          loading={isLoading}
          locale={{
            emptyText: 'No closed cases found'
          }}
        />

        <Drawer
          title="Member Pay Status"
          placement="right"
          onClose={() => setIsDrawerOpen(false)}
          open={isDrawerOpen}
          width={1200}
          className="bg-gray-50"
        >
          {isDrawerOpen && <ClosingPendingPayment selectedRecord={selectedRecord} />}
        </Drawer>
        
        <AllClosingPendingPayment open={isOpenDrawer} setOpen={setIsOpenDrawer} closingMemberList={allMembersData} />
        
        {/* Edit PDF Data Form Drawer */}
        {selectedRecord && (
          <EditPdfDataForm
            open={isEditPdfDataOpen}
            onClose={() => {
              setIsEditPdfDataOpen(false);
              setSelectedRecord(null);
            }}
            memberData={selectedRecord}
            selectedProgram={selectedProgram}
            onSave={handleSavePdfData}
            user={user}
          />
        )}

        {/* View Modal */}
        <Modal
          title="Closing Details"
          open={viewModalVisible}
          onCancel={() => setViewModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setViewModalVisible(false)}>
              Close
            </Button>,
            <Button 
              key="edit" 
              type="primary" 
              onClick={() => {
                setViewModalVisible(false);
                handleEdit(selectedRecord);
              }}
            >
              Edit Closing Details
            </Button>
          ]}
          width={700}
        >
          {renderViewModalContent()}
        </Modal>

        {/* Edit Modal - With Group Selection */}
        <Modal
          title="Edit Closing Details & Group"
          open={editModalVisible}
          onCancel={() => {
            setEditModalVisible(false);
            setSelectedFile(null);
            setFilePreview(null);
            setSelectedGroupId(null);
            setPreviousGroupId(null);
          }}
          onOk={() => editForm.submit()}
          confirmLoading={uploading || changingGroup}
          width={700}
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleEditSubmit}
          >
            {/* Basic Member Info */}
            {selectedRecord && (
              <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar src={selectedRecord.photoURL} icon={<UserOutlined />} />
                  <div>
                    <Text strong className="block">{selectedRecord.displayName}</Text>
                    <Text type="secondary">{selectedRecord.registrationNumber}</Text>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Text>Father: {selectedRecord.fatherName}</Text>
                  <Text>Gender: {selectedRecord.gender}</Text>
                </div>
              </div>
            )}

            {/* Group Selection Section */}
         

            <Row gutter={16}>
              <AntCol span={12}>
                 <div className="">
              <div className="mb-2">
                <TeamOutlined className="mr-2" />
                <Text strong>Closing Group</Text>
                <Text type="secondary" className="ml-2 text-xs">(Changeable)</Text>
              </div>
              
              <Select
                placeholder="Select or create group"
                allowClear
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                style={{ width: '100%' }}
                dropdownRender={(menu) => (
                  <div>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={() => setGroupModalVisible(true)}
                      style={{ width: '100%', textAlign: 'center' }}
                    >
                      Create New Group
                    </Button>
                  </div>
                )}
              >
                {closingGroups.map(group => (
                  <Option key={group.id} value={group.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{group.name}</span>
                      <Badge count={group.memberCount} showZero style={{ backgroundColor: '#52c41a' }} />
                    </div>
                  </Option>
                ))}
              </Select>

              {/* Group Change Indicator */}
              {selectedGroupId !== previousGroupId && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '8px 12px', 
                  background: '#fff7e6', 
                  borderRadius: '6px',
                  border: '1px solid #ffd591'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SwapOutlined style={{ color: '#fa8c16' }} />
                    <Text style={{ fontSize: '12px' }}>
                      {previousGroupId ? `Changing from previous group` : `Adding to new group`}
                    </Text>
                  </div>
                </div>
              )}
            </div>
              </AntCol>
              <AntCol span={12}>
                <Form.Item
                  label="Closing Date"
                  name="closing_date"
                >
                  <DatePicker 
                    format="DD-MM-YYYY" 
                    style={{ width: '100%' }}
                    placeholder="Select closing date"
                    allowClear
                  />
                </Form.Item>
              </AntCol>
            </Row>

            <Form.Item
              label="Closing Notes"
              name="closingNotes"
            >
              <TextArea 
                rows={4} 
                placeholder="Enter closing notes, observations, or any important information..."
                showCount
                maxLength={500}
              />
            </Form.Item>

            <Divider>Invitation Card</Divider>
            
            {/* Current invitation card preview */}
            {selectedRecord?.invitationCardURL && !selectedFile && (
              <div className="mb-4 p-3 border rounded-lg">
                <Text strong className="block mb-2">Current Invitation Card:</Text>
                <div className="flex items-center justify-center">
                  <Image
                    src={selectedRecord.invitationCardURL}
                    alt="Current Invitation"
                    width={150}
                    height={150}
                    className="object-cover rounded"
                    preview={{
                      mask: 'Preview',
                    }}
                  />
                </div>
              </div>
            )}

            {/* New file preview */}
            {filePreview && (
              <div className="mb-4 p-3 border rounded-lg">
                <Text strong className="block mb-2">New File Preview:</Text>
                <div className="flex items-center justify-center">
                  {selectedFile.type.startsWith('image/') ? (
                    <Image
                      src={filePreview}
                      alt="File Preview"
                      width={150}
                      height={150}
                      className="object-cover rounded"
                    />
                  ) : (
                    <div className="text-center p-4 border rounded">
                      <FileTextOutlined className="text-3xl text-blue-500 mb-2" />
                      <Text strong className="block">{selectedFile.name}</Text>
                      <Text type="secondary">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </Text>
                    </div>
                  )}
                </div>
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={handleRemoveFile}
                  className="mt-2"
                >
                  Remove File
                </Button>
              </div>
            )}

            <Form.Item label="Upload New Invitation Card">
              <Upload
                accept=".jpg,.jpeg,.png,.pdf"
                beforeUpload={handleFileSelect}
                showUploadList={false}
                maxCount={1}
              >
                <Button 
                  icon={<UploadOutlined />} 
                  block
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Select File'}
                </Button>
              </Upload>
              <Text type="secondary" className="block mt-2 text-xs">
                Supported formats: JPG, PNG, PDF (Max: 5MB)
              </Text>
              {selectedFile && (
                <div className="mt-2 p-2 bg-blue-50 rounded">
                  <Text className="text-sm">
                    Selected: {selectedFile.name} 
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </Text>
                </div>
              )}
            </Form.Item>
          </Form>
        </Modal>
      </Card>
      
      <ClosingFormPdfDraver 
        closingMembers={allMembersData} 
        user={user} 
        open={isOpen} 
        setOpen={setIsOpen} 
        memberData={selectedRecord} 
        selectedProgram={selectedProgram}
      />

      <ClosingBannerImageDrawer 
        open={isOpenBanner} 
        onClose={() => setIsOpenBanner(false)} 
        memberData={selectedRecord} 
        selectedProgram={selectedProgram} 
        user={user}
      />

      {/* Create Group Modal */}
      <Modal
        title="Create New Closing Group"
        open={groupModalVisible}
        onOk={handleCreateGroup}
        onCancel={() => {
          setGroupModalVisible(false);
          setNewGroupName('');
        }}
        confirmLoading={creatingGroup}
        okText="Create Group"
        cancelText="Cancel"
        width={400}
      >
        <Form layout="vertical">
          <Form.Item label="Group Name" required>
            <Input
              placeholder="e.g., December Weddings, Family Group"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              maxLength={40}
              showCount
              autoFocus
            />
          </Form.Item>
          <Alert
            message="Member will be moved to this group"
            type="info"
            showIcon
            style={{ fontSize: '12px' }}
          />
        </Form>
      </Modal>
    </Col>
  );
}

export default ClosingCom;