"use client";
import React, { useEffect, useState } from 'react';
import { Table, Modal, Tabs, Button, Tag, Space, Avatar, Image, Popconfirm, message, Input } from 'antd';
import { UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined, FileTextOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import AgentManagement from './EditAgents';
import AgentDetails from './agentDetails';
import { sendFirebaseNotification } from '@/lib/helper';

const AgentPage = () => {
  // Mock data - replace with useSelector in your actual implementation

const {agentsList}= useSelector((state) => state.data);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filteredData, setFilteredData] = useState(agentsList);
  const [isAgentDrawerVisible, setIsAgentDrawerVisible] = useState(false);

  // Filter agents based on search text
  const handleSearch = (value) => {
    setSearchText(value);
    const filtered = agentsList.filter(agent =>
      agent.displayName.toLowerCase().includes(value.toLowerCase()) ||
      agent.email.toLowerCase().includes(value.toLowerCase()) ||
      agent.phone.includes(value) ||
      agent.city.toLowerCase().includes(value.toLowerCase()) ||
      agent.state.toLowerCase().includes(value.toLowerCase()) ||
      agent.pinCode.includes(value)
    );
    setFilteredData(filtered);
  };

  useEffect(()=>{
    setFilteredData(agentsList)
  },[agentsList])

  const handleView = (record) => {
    setSelectedAgent(record);
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedAgent(record)
    setIsAgentDrawerVisible(true)
    message.info(`Edit agent: ${record.displayName}`);
    // Add your edit logic here
  };

  const handleDelete = (record) => {
    message.success(`Agent ${record.displayName} deleted successfully`);
    // Add your delete logic here
  };

  const columns = [
    {
      title: 'Photo',
      dataIndex: 'photoURL',
      key: 'photoURL',
      width: 80,
      render: (url) => (
        <Avatar size={50} src={url} icon={<UserOutlined />} />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'displayName',
      key: 'displayName',
      sorter: (a, b) => a.displayName.localeCompare(b.displayName),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Tag color={record.active_flags ? 'green' : 'red'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Date Joined',
      dataIndex: 'dateJoin',
      key: 'dateJoin',
      sorter: (a, b) => new Date(a.dateJoin) - new Date(b.dateJoin),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="primary" 
            icon={<EyeOutlined />} 
            onClick={() => handleView(record)}
            size="small"
          >
            View
          </Button>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
            size="small"
          >
            Edit
          </Button>
          {/* <Popconfirm
            title="Delete Agent"
            description="Are you sure you want to delete this agent?"
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              danger 
              icon={<DeleteOutlined />}
              size="small"
            >
              Delete
            </Button>
          </Popconfirm> */}
        </Space>
      ),
    },
  ];

  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return 'N/A';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const tabItems = [
    {
      key: '1',
      label: 'Personal Information',
      children: (
        <div className="space-y-4">
          <div className="flex items-center justify-center mb-6">
            <Avatar size={120} src={selectedAgent?.photoURL} icon={<UserOutlined />} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">Full Name</p>
              <p className="font-semibold text-lg">{selectedAgent?.displayName}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">Role</p>
              <Tag color="blue" className="mt-1">{selectedAgent?.role?.toUpperCase()}</Tag>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1"><MailOutlined /> Email</p>
              <p className="font-medium">{selectedAgent?.email}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1"><PhoneOutlined /> Phone</p>
              <p className="font-medium">{selectedAgent?.phone}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg col-span-2">
              <p className="text-gray-500 text-sm mb-1"><HomeOutlined /> Address</p>
              <p className="font-medium">{selectedAgent?.address}</p>
              <p className="text-sm text-gray-600 mt-2">
                {selectedAgent?.city}, {selectedAgent?.state} - {selectedAgent?.pinCode}
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">Date Joined</p>
              <p className="font-medium">{selectedAgent?.dateJoin}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">Status</p>
              <Tag color={selectedAgent?.active_flags ? 'green' : 'red'} className="mt-1">
                {selectedAgent?.status?.toUpperCase()}
              </Tag>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: '2',
      label: 'Signature',
      children: (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-gray-600 mb-4 text-sm">Agent Signature</p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
            <Image
              src={selectedAgent?.signatureURL}
              alt="Signature"
              width={300}
              height={150}
              className="object-contain"
              fallback="data:image/png;base64,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"
            />
          </div>
        </div>
      ),
    },
    {
      key: '3',
      label: 'Documents',
      children: (
        <div className="space-y-3">
          <p className="text-gray-600 mb-4"><FileTextOutlined /> Uploaded Documents</p>
          {selectedAgent?.documentURLs && selectedAgent.documentURLs.length > 0 ? (
            selectedAgent.documentURLs.map((url, index) => {
              const fileName = url.split('/').pop().split('?')[0];
              return (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <FileTextOutlined className="text-2xl text-blue-500" />
                    <div>
                      <p className="font-medium">Document {index + 1}</p>
                      <p className="text-xs text-gray-500">{decodeURIComponent(fileName)}</p>
                    </div>
                  </div>
                  <Button 
                    type="primary" 
                    size="small"
                    onClick={() => window.open(url, '_blank')}
                  >
                    View
                  </Button>
                </div>
              );
            })
          ) : (
            <p className="text-gray-400 text-center py-8">No documents uploaded</p>
          )}
        </div>
      ),
    },
    {
      key: '4',
      label: 'System Information',
      children: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">User ID</p>
              <p className="font-mono text-xs break-all">{selectedAgent?.uid}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">Created By</p>
              <p className="font-mono text-xs break-all">{selectedAgent?.createdBy}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">Created At</p>
              <p className="font-medium">{formatDate(selectedAgent?.createdAt)}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">Active Status</p>
              <Tag color={selectedAgent?.active_flags ? 'green' : 'red'}>
                {selectedAgent?.active_flags ? 'ACTIVE' : 'INACTIVE'}
              </Tag>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">Delete Flag</p>
              <Tag color={selectedAgent?.delete_flags ? 'red' : 'green'}>
                {selectedAgent?.delete_flags ? 'MARKED FOR DELETION' : 'NORMAL'}
              </Tag>
            </div>
          </div>
        </div>
      ),
    },
  ];
const onClickSendMsg=async()=>{
    await sendFirebaseNotification(
      "ck_L8rx0S8-gtFe0aJghyu:APA91bHXrWE8pQTng9b-OmxyVZ0gEbtJlQbLeRJUOG7Fu0DPOKqnOvPwRVWUAked5To2uiKsCh1lCxQm-AMbB2QCvQm4KZEMi5lcNnZBrodXOaYWL3tvCfw",
      'नया सदस्य जोड़ दिया गया',
      `Lalit kumar को नया सदस्य बना दिया गया है।`);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2" >Agent Management</h1>
              <p className="text-gray-600">Manage and view all registered agents</p>
            </div>
            <div className="flex items-center gap-3">
              <Input.Search
                placeholder="Search by name, email, phone, city, state..."
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                value={searchText}
                onChange={(e) => handleSearch(e.target.value)}
                onSearch={handleSearch}
                style={{ width: 400 }}
                className="shadow-sm"
              />
            </div>
          </div>
          {searchText && (
            <div className="mt-4">
              <Tag color="blue" closable onClose={() => handleSearch('')}>
                Search: {searchText} ({filteredData.length} results)
              </Tag>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="uid"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} agents`,
            }}
            scroll={{ x: 1200 }}
            className="agent-table"
          />
        </div>

       
        <AgentManagement isAgentDrawerVisible={isAgentDrawerVisible} setIsAgentDrawerVisible={setIsAgentDrawerVisible} agentData={selectedAgent} mode='edit' onSuccess={()=>{}}/>
          <AgentDetails isViewModalVisible={isModalVisible} setIsViewModalVisible={setIsModalVisible} selectedAgent={selectedAgent} />
      </div>

      <style jsx global>{`
        .agent-table .ant-table-thead > tr > th {
          background-color: #f8fafc;
          font-weight: 600;
          color: #1e293b;
        }
        
        .agent-table .ant-table-tbody > tr:hover > td {
          background-color: #f1f5f9;
        }
      `}</style>
    </div>
  );
};

export default AgentPage;