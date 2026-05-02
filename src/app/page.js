"use client";
import { useAuth } from "@/lib/AuthProvider";
import { getDeviceInfo, sendEmail } from "@/lib/commonFun";
import { App, Button, Drawer, Card, Row, Col, Typography, Table, Tag, Spin } from "antd";
import { UserOutlined, TeamOutlined, CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useSelector } from "react-redux";
import ClosingCom from "@/components/screen/home/ClosingCom";
import { useState, useEffect } from "react";
import { getData } from "@/lib/services/firebaseService";

const { Title, Text } = Typography;

export default function Home() {
  const { user, loading } = useAuth();
  const { message } = App.useApp();
  const selectedProgram = useSelector((state) => state.data.selectedProgram);
  const agentList = useSelector((state) => state.data.agentsList);
  
  // State for closing count
  const [closingCount, setClosingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch closing count from your collection
  const getClosingCount = async () => {
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
          { field: 'status', operator: 'in', value: ['closed', 'accepted'] }
        ]
      );
      setClosingCount(memberData?.length || 0);
    } catch (error) {
      console.error("Error fetching closing count:", error);
      message.error("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProgram) {
      getClosingCount();
    }
  }, [selectedProgram]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Title level={3}>Loading...</Title>
      </div>
    );
  }

  // Get active and inactive counts
  const activeMemberCount = selectedProgram?.memberCount || 0;
  const inactiveMemberCount = selectedProgram?.inactivemembercount || 0;
  const totalMembers = activeMemberCount + inactiveMemberCount;

  // Simple stat cards
  const stats = [
    {
      title: "Total Members",
      value: totalMembers,
      icon: <UserOutlined className="text-2xl" />,
      description: `Active: ${activeMemberCount} | Inactive: ${inactiveMemberCount}`,
    },
    {
      title: "Closing Members",
      value: closingCount,
      icon: <CheckCircleOutlined className="text-2xl" />,
      description: "Closed Members",
    },
    {
      title: "Total Agents",
      value: agentList?.length || 0,
      icon: <TeamOutlined className="text-2xl" />,
      description: "Agents",
    },
  ];

  return (
    <div className="p-4">
      {/* Stat Cards - Simple */}
      <Row gutter={[16, 16]} className="mb-6">
        {stats.map((stat) => (
          <Col key={stat.title} xs={24} sm={12} lg={8}>
            <Card className="shadow border-0">
              <div className="flex items-center">
                <div className="mr-4 p-3 bg-blue-50 rounded-full">
                  {stat.icon}
                </div>
                <div>
                  <Text className="text-gray-500 text-sm">{stat.title}</Text>
                  <Title level={3} className="!my-1">{stat.value}</Title>
                  <Text type="secondary" className="text-xs">{stat.description}</Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Closing Members Section */}
    <div className="w-full">

          <ClosingCom 
            selectedProgram={selectedProgram} 
            user={user}
            closingCount={closingCount}
            isLoading={isLoading}
            onRefresh={getClosingCount}
          />
    </div>
     
    </div>
  );
}