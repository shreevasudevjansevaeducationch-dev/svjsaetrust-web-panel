import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FiGrid, 
  FiUsers, 
  FiFileText, 
  FiBell, 
  FiSettings, 
  FiHelpCircle,
  FiShield,
  FiCreditCard,
  FiBarChart2,
  FiFolder,
  FiUser,
  FiMail
} from 'react-icons/fi';
import { useAuth } from '@/lib/AuthProvider';

const SideBar = ({ collapsed }) => {
  const pathname = usePathname();
  const { user } = useAuth();


  // Navigation items
  const navItems = [
    { 
      icon: <FiGrid size={20} />, 
      label: 'Dashboard', 
      link: '/', 
      description: 'Overview & analytics'
    },
    { 
      icon: <FiUsers size={20} />, 
      label: 'Members', 
      link: '/members', 
      description: 'Manage members'
    },
    { 
      icon: <FiUser size={20} />, 
      label: 'Agents', 
      link: '/agents', 
      description: 'Agent management'
    },
    { 
      icon: <FiBell size={20} />, 
      label: 'Yojna', 
      link: '/yojna', 
      description: 'Schemes & programs'
    },
       { 
      icon: <FiCreditCard size={20} />, 
      label: 'Closing Payments', 
      link: '/closingPayments', 
      description: 'Closing Payments '
    },
    // { 
    //   icon: <FiBarChart2 size={20} />, 
    //   label: 'Reports', 
    //   link: '/reports', 
    //   description: 'View reports'
    // },
    { 
      icon: <FiCreditCard size={20} />, 
      label: 'Payments', 
      link: '/transactions', 
      description: 'Payment history'
    },
  ];

  const systemItems = [
    { 
      icon: <FiSettings size={20} />, 
      label: 'Settings', 
      link: '/setting', 
      description: 'App configuration'
    },
    // { 
    //   icon: <FiHelpCircle size={20} />, 
    //   label: 'Help & Support', 
    //   link: '/support', 
    //   description: 'Get help'
    // },
  ];

  // Improved active link detection
  const isActive = (path) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  // Tooltip component for collapsed state
  const Tooltip = ({ children, label }) => (
    <div className="relative group">
      {children}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
          {label}
          <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
        </div>
      )}
    </div>
  );

  return (
    <aside 
      className={`bg-white shadow-lg transition-all duration-300 ease-in-out flex flex-col ${
        collapsed ? 'w-20' : 'w-80'
      } border-r border-gray-200 z-20`}
    >
      {/* Logo Area */}
      <div className="h-20 flex items-center px-6 border-b border-gray-200">
        <div className={`flex items-center transition-all duration-300 ${collapsed ? 'justify-center w-full' : ''}`}>
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-md">
            <FiFolder size={24} className="text-white" />
          </div>
          {!collapsed && (
            <div className="ml-4">
              <h2 className="font-bold text-xl text-gray-800">
                Trust Manager
              </h2>
              <p className="text-xs text-gray-500 mt-1">Admin Panel</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-grow py-6 overflow-y-auto">
        {/* Main Menu Section */}
        <div className="mb-8">
          <div className={`px-6 mb-4 ${collapsed ? 'hidden' : 'block'}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Main Menu</p>
          </div>
          
          <ul className="space-y-2 px-4">
            {navItems.map((item, index) => {
              const active = isActive(item.link);
              return (
                <li key={index}>
                  <Tooltip label={item.label}>
                    <Link 
                      href={item.link}
                      className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ease-in-out group relative
                        ${active 
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                        }
                        ${collapsed ? 'justify-center px-3' : ''}
                      `}
                    >
                      <span className={`flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                        {item.icon}
                      </span>
                      
                      {!collapsed && (
                        <div className="ml-4 flex-1 min-w-0">
                          <span className="text-sm font-semibold block">{item.label}</span>
                          <span className="text-xs text-gray-500 mt-0.5 block">{item.description}</span>
                        </div>
                      )}
                      
                      {active && !collapsed && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </div>

        {/* System Section */}
        <div>
          <div className={`px-6 mb-4 ${collapsed ? 'hidden' : 'block'}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">System</p>
          </div>
          
          <ul className="space-y-2 px-4">
            {systemItems.map((item, index) => {
              const active = isActive(item.link);
              return (
                <li key={index}>
                  <Tooltip label={item.label}>
                    <Link 
                      href={item.link}
                      className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ease-in-out group relative
                        ${active 
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                        }
                        ${collapsed ? 'justify-center px-3' : ''}
                      `}
                    >
                      <span className={`flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                        {item.icon}
                      </span>
                      
                      {!collapsed && (
                        <div className="ml-4 flex-1 min-w-0">
                          <span className="text-sm font-semibold block">{item.label}</span>
                          <span className="text-xs text-gray-500 mt-0.5 block">{item.description}</span>
                        </div>
                      )}
                      
                      {active && !collapsed && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* User Profile Section */}
      <div className={`border-t border-gray-200 ${collapsed ? 'p-4' : 'p-6'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white shadow-md flex-shrink-0">
            {user?.username ? (
              <span className="font-semibold text-sm">
                {user.username.charAt(0).toUpperCase()}
              </span>
            ) : (
              <FiUser size={18} />
            )}
          </div>
          
          {!collapsed && user && (
            <div className="ml-4 min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user.username || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {user.email || 'admin@trustmanager.com'}
              </p>
              <div className="flex items-center mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span className="text-xs text-gray-500">Online</span>
              </div>
            </div>
          )}

          {collapsed && (
            <Tooltip label={`${user?.username || 'User'} - ${user?.email || 'admin@trustmanager.com'}`}>
              <span className="sr-only">User profile</span>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
};

export default SideBar;