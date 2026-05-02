"use client";
import React, { useEffect, useState } from 'react';
import { Popover, Modal, Tooltip, Select } from 'antd';
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { usePathname, useRouter } from 'next/navigation';
import { 
  FiMenu, 
  FiX, 
  FiBell, 
  FiSearch, 
  FiUser, 
  FiSettings, 
  FiLogOut, 
  FiChevronRight,
  FiHelpCircle,
  FiMail
} from 'react-icons/fi';
import RequestSection from '../common/requestSection';
import AddProgram from '../common/program';
import { useAuth } from '@/lib/AuthProvider';
import { doc, onSnapshot,deleteDoc } from 'firebase/firestore';
import AddAgent from '../screen/agents/AddAgents';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedProgram } from '@/redux/slices/commonSlice';
import AddMember from '../screen/programs/members/AddMember';
import AddPaymentModal from '../common/addPayment/AddPaymentModal';
const { Option } = Select;

const TopBar = ({ 
  sidebarCollapsed, 
  toggleSidebar, 
  showNotifications, 
  toggleNotifications,
  showUserMenu, 
  toggleUserMenu 
}) => {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const {user}=useAuth()
  const programList = useSelector((state) => state.data.programList);
  const selectedProgram = useSelector((state) => state.data.selectedProgram);
  // Add logout handler
  const logout=async()=>{
    await signOut(auth);
    router.replace('/auth/login');
  }
  const handleLogout = async () => {
    try {
      // Remove session from Firestore before logout
      const userId = user?.uid;
      const sessionToken = localStorage.getItem("session_token");
      if (userId && sessionToken) {
        await deleteDoc(doc(db, "users", userId, "sessions", sessionToken));
      }
      logout()
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
   const handleProgramSelect = (programId) => {
    dispatch(setSelectedProgram(programList.find(program => program.id === programId)));
  };
  const notificationItems = [
    { 
      id: 1, 
      title: 'New trust document uploaded', 
      description: 'Smith Family Trust document requires your review',
      time: '10 minutes ago',
      unread: true
    },
    { 
      id: 2, 
      title: 'Meeting scheduled', 
      description: 'Trust advisory meeting tomorrow at 10 AM',
      time: '1 hour ago',
      unread: true
    },
    { 
      id: 3, 
      title: 'Trust update requires approval', 
      description: 'Johnson Trust amendment is pending your approval',
      time: '3 hours ago',
      unread: false
    }
  ];

  const unreadCount = notificationItems.filter(item => item.unread).length;

  const NotificationContent = () => (
    <div className="w-96 max-h-[450px] overflow-y-auto notification-content">
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Notifications</h3>
        <button className="text-xs text-primary-blue hover:text-primary-dark transition-colors font-medium">
          Mark all as read
        </button>
      </div>
      
      {notificationItems.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {notificationItems.map(item => (
            <div 
              key={item.id} 
              className={`p-4 hover:bg-blue-50 transition-colors cursor-pointer flex ${item.unread ? 'bg-blue-50/30' : ''}`}
            >
              <div className="mr-3 mt-1">
                <div className={`w-2 h-2 rounded-full ${item.unread ? 'bg-primary-blue' : 'bg-gray-200'}`}></div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                <span className="text-xs text-gray-400 mt-2 block">{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <div className="text-gray-400 mb-2">
            <FiBell size={24} className="mx-auto opacity-50" />
          </div>
          <p className="text-gray-500">No new notifications</p>
        </div>
      )}
      
      <div className="px-4 py-3 border-t border-gray-200">
        <button className="w-full text-center text-primary-blue hover:text-primary-dark text-sm font-medium">
          View all notifications
        </button>
      </div>
    </div>
  );

  const UserMenu = () => (
    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg py-2 border border-gray-200 user-menu-content z-10">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="font-medium text-gray-800">{user?.username|| "User"}</p>
        <p className="text-xs text-gray-500">{user?.email || "Email"}</p>
      </div>
      
     {/* <div className="py-2">
        <button className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center gap-3">
          <FiUser size={16} className="text-gray-500" />
          <span className="text-sm text-gray-700">My Profile</span>
        </button>
        <button className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center gap-3">
          <FiSettings size={16} className="text-gray-500" />
          <span className="text-sm text-gray-700">Account Settings</span>
        </button>
        <button className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center gap-3">
          <FiHelpCircle size={16} className="text-gray-500" />
          <span className="text-sm text-gray-700">Help & Support</span>
        </button>
      </div>
     */}
      <div className="h-px bg-gray-200 my-1" />
      
      <button 
        onClick={() => setIsLogoutModalOpen(true)}
        className="w-full px-4 py-2.5 text-left hover:bg-red-50 transition-colors flex items-center gap-3"
      >
        <FiLogOut size={16} className="text-error" />
        <span className="text-sm text-error">Logout</span>
      </button>
    </div>
  );


  useEffect(() => {
    const userId = user?.uid;
    const sessionToken = localStorage.getItem("session_token");
    const sessionRef = doc(db, "users", userId, "sessions", sessionToken);
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      if (!doc.exists()) {
        logout()
      }
    });
  
    return unsubscribe;
  }, []);
const getNamepage =()=>{
    const path = usePathname();
    console.log(path,"path")
    const segments = path.split('/');
    const pageName = segments[segments.length - 1];
    return pageName.charAt(0).toUpperCase() + pageName.slice(1);
}
  return (
    <>
      <header className="bg-white h-16 px-6 flex items-center justify-between border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Tooltip title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"} placement="right">
            <button 
              onClick={toggleSidebar}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-primary-blue"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? 
                <FiMenu size={22} /> : 
                <FiX size={22} />
              }
            </button>
          </Tooltip>

          <nav className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-gray-400">Home</span>
            <FiChevronRight size={14} className="text-gray-300" />
            <span className="text-gray-800 font-medium">{getNamepage()}</span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* <div className={`relative hidden md:block transition-all duration-200 ${searchFocused ? 'w-72' : 'w-64'}`}>
            <input
              type="text"
              placeholder="Search..."
              className="w-full h-10 px-4 py-2 pl-10 rounded-lg border border-gray-200 focus:outline-none focus:border-primary-blue focus:ring-2 focus:ring-primary-light focus:ring-opacity-20 transition-all text-sm"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          </div> */}
           <Select
                            placeholder="Select Program/Yojana"
                            size="large"
                            className="w-[200px]"
                            onChange={handleProgramSelect}
                            value={selectedProgram ? selectedProgram.id : undefined}
                          >
                            {programList.map(program => (
                              <Option key={program.id} value={program.id}>
                                {program.name}
                              </Option>
                            ))}
                          </Select>
          <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
          <AddPaymentModal/>
          <AddAgent/>
          
          {/* <AddProgram />  */}
            <AddMember/>
          <RequestSection />
          {/* <Tooltip title="Messages">
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-primary-blue">
              <FiMail size={20} />
            </button>
          </Tooltip>
          
          <Popover
            content={<NotificationContent />}
            trigger="click"
            placement="bottomRight"
            open={showNotifications}
            onOpenChange={toggleNotifications}
            overlayClassName="notification-popover"
          >
            <button 
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-primary-blue notification-trigger"
              aria-label="Notifications"
            >
              <FiBell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-error text-white text-xs flex items-center justify-center rounded-full font-medium">
                  {unreadCount}
                </span>
              )}
            </button>
          </Popover> */}
  
          <div className="relative">
            <button
              onClick={toggleUserMenu}
              className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors user-menu-trigger"
            >
              <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center text-white shadow-sm">
                <FiUser size={16} />
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700">
              {user?.username || "User"}
              </span>
              <svg 
                className="w-4 h-4 text-gray-500 hidden md:block" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showUserMenu && <UserMenu />}
          </div>
        </div>
      </header>
      
      <Modal
        title={<div className="flex items-center gap-2 text-error"><FiLogOut size={18} /> <span>Confirm Logout</span></div>}
        open={isLogoutModalOpen}
        onOk={handleLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
        okText="Logout"
        cancelText="Cancel"
        centered
        maskClosable={true}
        okButtonProps={{
          danger: true,
          className: 'bg-error hover:bg-error/90 text-white border-error'
        }}
      >
        <p className="py-2">Are you sure you want to logout from the Trust Management System?</p>
      </Modal>
    </>
  );
};

export default TopBar;