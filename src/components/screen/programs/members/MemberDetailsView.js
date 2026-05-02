'use client'
import { Button, Card, Descriptions, Modal, Typography, Tabs, Table, Tooltip, App,Tag ,Space} from 'antd'
import React, { useState, useEffect } from 'react'
import { EyeOutlined,DeleteOutlined } from '@ant-design/icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import moment from 'moment';
import { useDispatch, useSelector } from 'react-redux';
import { db } from '@/lib/firebase';
import { toggleMemberBlockStatus } from '@/lib/helper';
import { useAuth } from '@/lib/AuthProvider';
import { setgetMemberDataChange } from '@/redux/slices/commonSlice';
import { getData } from '@/lib/services/firebaseService';
import dayjs from "dayjs";

const { Title } = Typography;
const { TabPane } = Tabs;
const dummyImg = "https://cdn2.iconfinder.com/data/icons/business-and-finance-related-hand-gestures/256/face_female_blank_user_avatar_mannequin-512.png";

function MemberDetailsView({isModalVisible, handleCloseModal, showDeleteConfirm, selectedMember}) {
  const [memberTransactions, setMemberTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  
  const { user } = useAuth();
  const dispatch = useDispatch();
  const selectedProgram = useSelector((state) => state.data.selectedProgram);
  const { message } = App.useApp();

  // Fetch member transactions when modal opens
  useEffect(() => {
    if (isModalVisible && selectedMember?.id && selectedProgram?.id && user?.uid) {
      fetchMemberTransactions();
    }
  }, [isModalVisible, selectedMember, selectedProgram, user]);

  const fetchMemberTransactions = async () => {
    if (!user?.uid || !selectedProgram?.id || !selectedMember?.id) return;

    setLoadingTransactions(true);
    try {
           const data = await getData(
             `/users/${user.uid}/programs/${selectedProgram.id}/transactions`,
             [
    
              { field: 'payerId', operator: '==', value: selectedMember.id },
               { field: 'active_flag', operator: '==', value: true },
               { field: 'delete_flag', operator: '==', value: false }
             ],
             { field: 'createdAt', direction: 'desc' }
           );
           console.log(data,'data')
      setMemberTransactions(data);
    } catch (error) {
      console.error('Error fetching member transactions:', error);
      message.error('Failed to load transaction history');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return moment(date).format('DD/MM/YYYY');
  };


const columns = [
  {
    title: "TRX ID",
    dataIndex: "transactionNumber",
    key: "transactionNumber",
    width: 140,
    sorter: (a, b) =>
      (a.transactionNumber || "").localeCompare(b.transactionNumber || ""),
    render: (value, record) => (
      <Button
        type="link"
        onClick={() => handleView(record)}
        className="p-0 text-xs text-blue-600"
      >
        {value}
      </Button>
    ),
  },
  {
    title: "Date",
    dataIndex: "paymentDate",
    key: "paymentDate",
    width: 100,
    sorter: (a, b) =>
      dayjs(a.paymentDate).unix() - dayjs(b.paymentDate).unix(),
    render: (value) =>
      value ? dayjs(value).format("DD/MM/YY") : "-",
  },
  {
    title: "Payer",
    key: "payer",
    width: 140,
    sorter: (a, b) =>
      (a.payerName || "").localeCompare(b.payerName || ""),
    render: (_, record) => (
      <div className="text-xs">
        <div className="font-medium truncate">
          {record.payerName || "-"}
        </div>
        <div className="text-gray-500 truncate">
          {record.payerRegistrationNumber || "-"}
        </div>
      </div>
    ),
  },
  {
    title: "Beneficiary",
    key: "beneficiary",
    width: 140,
    sorter: (a, b) =>
      (a.marriageMemberName || "").localeCompare(b.marriageMemberName || ""),
    render: (_, record) => (
      <div className="text-xs">
        <div className="font-medium truncate">
          {record.marriageMemberName || "-"}
        </div>
        <div className="text-gray-500 truncate">
          {record.marriageRegistrationNumber || "-"}
        </div>
      </div>
    ),
  },
  {
    title: "Amount",
    dataIndex: "amount",
    key: "amount",
    width: 100,
    align: "right",
    sorter: (a, b) => (a.amount || 0) - (b.amount || 0),
    render: (value) => (
      <span style={{ fontWeight: "bold", color: "#52c41a" }}>
        ₹{value?.toLocaleString("en-IN") || "0"}
      </span>
    ),
  },
  {
    title: "Method",
    dataIndex: "paymentMethod",
    key: "paymentMethod",
    width: 100,
    filters: [
      { text: "Cash", value: "cash" },
      { text: "Online", value: "online" },
    ],
    onFilter: (value, record) =>
      record.paymentMethod === value,
    render: (method) => {
      const color = method === "cash" ? "green" : "blue";
      return (
        <Tag color={color} className="capitalize text-xs">
          {method === "cash" ? "Cash" : "Online"}
        </Tag>
      );
    },
  },
  {
    title: "Reference",
    dataIndex: "onlineReference",
    key: "onlineReference",
    width: 140,
    render: (value) => {
      if (!value) return "-";
      return (
        <Tooltip title={value}>
          <div className="text-xs font-mono truncate">
            {value.length > 15
              ? `${value.substring(0, 12)}...`
              : value}
          </div>
        </Tooltip>
      );
    },
  }
];

  // Calculate total amount
  const calculateTotalAmount = () => {
    return memberTransactions.reduce((total, t) => total + (t.amount || 0), 0);
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return 'N/A';
    const [day, month, year] = birthDate.split('-').map(Number);
    const dob = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const blockMember = async () => {
    setIsBlocking(true);
    try {
      await toggleMemberBlockStatus(user.uid, selectedProgram.id, selectedMember.id, selectedMember?.agentId, message);
      setIsBlocking(false);
      dispatch(setgetMemberDataChange(true));
      handleCloseModal();
    } catch (error) {
      console.log(error);
      message.error("Failed to block/unblock member");
    }
  };

  return (
    <Modal
      title={<Title level={3}>Member Details</Title>}
      open={isModalVisible}
      onCancel={handleCloseModal}
      footer={[
        <Button key="close" onClick={handleCloseModal} className="rounded-md mr-2">
          Close
        </Button>,
        <Button 
          loading={isBlocking} 
          onClick={blockMember} 
          type='primary'  
          className={selectedMember?.active_flag === false && selectedMember?.status == 'blocked' ? "!bg-green-700" : "!bg-red-700"}
        >
          {selectedMember?.active_flag == false && selectedMember?.status == 'blocked' 
            ? "Unblock Member" 
            : "Block Member"}
        </Button>
      ]}
      width={1200}
      className="rounded-lg"
    >
      {selectedMember && (
        <Tabs defaultActiveKey="1" animated>
          <TabPane tab="Basic Info" key="1">
            <Card className="rounded-lg mb-4">
              <div className="flex items-center space-x-4">
                <div className='flex flex-col gap-2'>
                  <img
                    src={selectedMember.photoURL || dummyImg}
                    alt={selectedMember.displayName}
                    className="rounded-lg w-[150px] h-[160px] object-cover"
                  />
                  {selectedMember.extraImageURL && (
                    <div>
                      <img
                        src={selectedMember.extraImageURL}
                        alt="Guardian"
                        className="rounded-lg w-[150px] h-[160px] object-cover"
                      />
                      <h3 className='text-[12px] font-semibold text-center'>Guardian Image</h3>
                    </div>
                  )}
                </div>
               
                <div className='flex-grow'>
                  <Descriptions layout="vertical" bordered column={2} size='small'>
                    <Descriptions.Item label="Name">{selectedMember.displayName}</Descriptions.Item>
                    <Descriptions.Item label="Father Name">{selectedMember.fatherName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Surname">{selectedMember.jati || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Religion">{selectedMember.religion || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Phone">{selectedMember.phone}</Descriptions.Item>
                    <Descriptions.Item label="Registration Number">{selectedMember.registrationNumber}</Descriptions.Item>
                    <Descriptions.Item label="Pay Amount & Join Fees">
                      Pay Amount: {selectedMember.payAmount} - Join Fees: {selectedMember?.joinFees || ''}
                    </Descriptions.Item>
                    <Descriptions.Item label="Age">
                      {calculateAge(selectedMember.bobDate)} - {selectedMember?.ageGroupRange}
                    </Descriptions.Item>
                    <Descriptions.Item label="Aadhaar Number">{selectedMember.aadhaarNo || '-'}</Descriptions.Item>
                  </Descriptions>
                </div>
              </div>
            </Card>
          </TabPane>
          
          <TabPane tab="Additional Details" key="2">
            <Descriptions layout="vertical" bordered column={3} size='small'>
              <Descriptions.Item label="Added By">{selectedMember.addedBy}</Descriptions.Item>
              <Descriptions.Item label="Date Of Birth">{selectedMember.bobDate}</Descriptions.Item>
              <Descriptions.Item label="Created By">{selectedMember.addedByName}</Descriptions.Item>
              <Descriptions.Item label="Date Joined">{selectedMember.dateJoin}</Descriptions.Item>
              <Descriptions.Item label="Guardian">{selectedMember.guardian}</Descriptions.Item>
              <Descriptions.Item label="Guardian Relation">{selectedMember.guardianRelation}</Descriptions.Item>
              <Descriptions.Item label="Alternative Phone">{selectedMember.alternativePhone || '-'}</Descriptions.Item>
              <Descriptions.Item label="Village">{selectedMember.village || '-'}</Descriptions.Item>
              <Descriptions.Item label="Current Address">{selectedMember.currentAddress}</Descriptions.Item>
              <Descriptions.Item label="Permanent Address">{selectedMember?.permanentAddress}</Descriptions.Item>
              <Descriptions.Item label="Agent ID">
                {selectedMember.agentId ? selectedMember.agentId : 
                  selectedMember.addedBy === 'self' ? "Self Joined" : 'Admin'}
              </Descriptions.Item>
              <Descriptions.Item label="Created At">
                {selectedMember.createdAt?.toDate?.()?.toLocaleString() || '-'}
              </Descriptions.Item>
            </Descriptions>
          </TabPane>
          
          <TabPane tab="Documents" key="3">
            <div className="grid grid-cols-3 gap-2 h-[300px]">
              {selectedMember.documentFrontURL && (
                <div className="relative">
                  <Title level={5}>Front Document</Title>
                  <img src={selectedMember.documentFrontURL} alt="Front" className="rounded-lg object-fill h-[200px] w-full" />
                  <Tooltip title="Full View" className='absolute top-8 right-2'>
                    <Button icon={<EyeOutlined />} onClick={() => window.open(selectedMember.documentFrontURL, '_blank')} />
                  </Tooltip>
                </div>
              )}
              {selectedMember.documentBackURL && (
                <div className="relative">
                  <Title level={5}>Back Document</Title>
                  <img src={selectedMember.documentBackURL} alt="Back" className="rounded-lg object-fill h-[200px] w-full" />
                  <Tooltip title="Full View" className='absolute top-8 right-2'>
                    <Button icon={<EyeOutlined />} onClick={() => window.open(selectedMember.documentBackURL, '_blank')} />
                  </Tooltip>
                </div>
              )}
              {selectedMember.guardianDocumentURL && (
                <div className="relative">
                  <Title level={5}>Guardian Document</Title>
                  <img src={selectedMember.guardianDocumentURL} alt="Guardian" className="rounded-lg object-fill h-[200px] w-full" />
                  <Tooltip title="Full View" className='absolute top-8 right-2'>
                    <Button icon={<EyeOutlined />} onClick={() => window.open(selectedMember.guardianDocumentURL, '_blank')} />
                  </Tooltip>
                </div>
              )}
            </div>
          </TabPane>
          
          <TabPane tab="Transactions" key="4">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <Title level={5}>Transaction History</Title>
                <div className="text-lg">
                  <span className="font-semibold">Total Paid: </span>
                  <span className="text-green-600 font-bold">₹{calculateTotalAmount().toFixed(2)}</span>
                </div>
              </div>
              
              <Table
                columns={columns}
                dataSource={memberTransactions}
                rowKey="id"
                loading={loadingTransactions}
                pagination={{ pageSize: 5 }}
                className="rounded-lg"
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'No transactions found for this member' }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={2} className="text-right font-bold">
                        Total Amount:
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} className="font-bold text-green-600">
                        ₹{calculateTotalAmount().toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} colSpan={3}></Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </div>
          </TabPane>
        </Tabs>
      )}
      
      {showDeleteConfirm && (
        <div className="flex justify-end mt-4">
          <Button
            onClick={() => showDeleteConfirm(selectedMember)}
            className="rounded-md bg-red-600 text-white"
          >
            Delete Member
          </Button>
        </div>
      )}
    </Modal>
  )
}

export default MemberDetailsView;