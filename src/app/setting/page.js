"use client";

import React, { useState, useEffect } from 'react';
import Contact from '@/components/screen/settings/Contact';
import Organization from '@/components/screen/settings/organization';
import TeamMembers from '@/components/screen/settings/TeamMembers';
import {
  BsBank2,
  BsShieldLock,
  BsHeadset,
  BsPeople,
  BsGear,
  BsChevronRight,
  BsChevronLeft
} from 'react-icons/bs';
import { collection, getDocs, query, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import Sessions from '@/components/screen/settings/Sessions';
import PasswordChange from '@/components/screen/settings/PasswordChange';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('organization');
  const [activeSubTab, setActiveSubTab] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const menuItems = [
    {
      key: 'organization',
      icon: <BsBank2 size={18} />,
      label: 'Organization',
      description: 'Manage trust details and profile',
    },
    {
      key: 'teams',
      icon: <BsPeople size={18} />,
      label: 'Team Members',
      description: 'Manage your organization members',
    },
    {
      key: 'security',
      icon: <BsShieldLock size={18} />,
      label: 'Security',
      description: 'Secure your account and data',
      subItems: [
        { key: 'security-password', label: 'Password' },
        { key: 'security-sessions', label: 'Active Sessions' },
      ]
    },
    {
      key: 'contact',
      icon: <BsHeadset size={18} />,
      label: 'Contact Support',
      description: 'Get help from our team',
    },
  ];

  const handleTabClick = (key) => {
    setActiveTab(key);
    setActiveSubTab(null);
  };

  const handleSubTabClick = (key) => {
    setActiveSubTab(key);
  };

  const getTabTitle = () => {
    const activeMenuItem = menuItems.find(item => item.key === activeTab);

    if (activeSubTab && activeMenuItem?.subItems) {
      const activeSubItem = activeMenuItem.subItems.find(item => item.key === activeSubTab);
      return activeSubItem ? activeSubItem.label : activeMenuItem.label;
    }

    return activeMenuItem ? activeMenuItem.label : '';
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'organization':
        return <Organization />;
      case 'contact':
        return <Contact />;
      case 'teams':
        return <TeamMembers />;
      case 'security':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Security Settings</h3>
            <p className="text-gray-500">Configure your account security options and privacy settings.</p>

            {activeSubTab === 'security-password' && (
              <PasswordChange />
            )}

   

            {activeSubTab === 'security-sessions' && (
              <Sessions activeTab={activeTab} activeSubTab={activeSubTab} />
            )}

            {!activeSubTab && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {menuItems.find(item => item.key === 'security')?.subItems.map((subItem) => (
                  <div
                    key={subItem.key}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleSubTabClick(subItem.key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
                          <BsShieldLock size={16} />
                        </div>
                        <div className="ml-3">
                          <h5 className="text-base font-medium text-gray-800">{subItem.label}</h5>
                        </div>
                      </div>
                      <BsChevronRight className="text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center h-[calc(100vh-240px)]">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 mb-4">
              {menuItems.find(item => item.key === activeTab)?.icon}
            </div>
            <h3 className="text-xl font-medium text-gray-700 mb-2">
              {getTabTitle()}
            </h3>
            <p className="text-gray-500 text-center max-w-md">
              This section is under development. Please check back soon for updates.
            </p>
          </div>
        );
    }
  };

  // Fetch sessions when security-sessions tab is active
  useEffect(() => {
    const fetchSessions = async () => {
      if (activeTab === 'security' && activeSubTab === 'security-sessions' && user?.uid) {
        setSessionsLoading(true);
        try {
          const sessionsRef = collection(db, "users", user.uid, "sessions");
          const q = query(sessionsRef);
          const snapshot = await getDocs(q);
          const data = [];
          snapshot.forEach(docSnap => {
            data.push({ id: docSnap.id, ...docSnap.data() });
          });
          setSessions(data);
        } catch (e) {
          setSessions([]);
        }
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, [activeTab, activeSubTab, user]);

  const handleRevokeSession = async (sessionId) => {
    if (!user?.uid || !sessionId) return;
    await deleteDoc(doc(db, "users", user.uid, "sessions", sessionId));
    setSessions(sessions.filter(s => s.id !== sessionId));
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div
        className={`transition-all duration-200 bg-white border-r border-gray-200 flex flex-col h-[calc(100vh-64px)] ${sidebarCollapsed ? 'w-20' : 'w-80'}`}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className={`flex items-center transition-all duration-200 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
            <BsGear className="text-blue-500 mr-2" size={20} />
            {!sidebarCollapsed && (
              <span className="text-lg font-bold text-gray-800">Settings</span>
            )}
          </div>
          <button
            className="ml-2 p-1 rounded hover:bg-gray-100 transition"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <BsChevronRight size={18} /> : <BsChevronLeft size={18} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-2">
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <div key={item.key} className="mb-1">
                <button
                  onClick={() => handleTabClick(item.key)}
                  className={`w-full flex items-center px-2 py-3 rounded-lg text-left transition-colors ${
                    activeTab === item.key
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`mr-3 flex-shrink-0 ${activeTab === item.key ? 'text-blue-600' : 'text-gray-500'}`}
                  >
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <div className="flex-1">
                      <span className="block font-medium">{item.label}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {item.description}
                      </span>
                    </div>
                  )}
                  {item.subItems && !sidebarCollapsed && (
                    <BsChevronRight
                      size={14}
                      className={`transition-transform ${
                        activeTab === item.key ? 'rotate-90 text-blue-600' : 'text-gray-400'
                      }`}
                    />
                  )}
                </button>

                {item.subItems && activeTab === item.key && !sidebarCollapsed && (
                  <div className="ml-10 mt-1 space-y-1 border-l-2 border-gray-100 pl-3">
                    {item.subItems.map((subItem) => (
                      <button
                        key={subItem.key}
                        onClick={() => handleSubTabClick(subItem.key)}
                        className={`w-full text-left py-2 px-3 rounded-md text-sm transition-colors ${
                          activeSubTab === subItem.key
                            ? 'text-blue-700 bg-blue-50 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {subItem.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className=" bg-gray-50 p-4 overflow-y-auto">
        <div className="mb-2">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <span>Settings</span>
            <BsChevronRight size={12} className="mx-2" />
            <span>{getTabTitle()}</span>
            {activeSubTab && (
              <>
                <BsChevronRight size={12} className="mx-2" />
                <span>
                  {menuItems.find(item => item.key === activeTab)?.subItems?.find(subItem => subItem.key === activeSubTab)?.label}
                </span>
              </>
            )}
          </div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default SettingsPage;