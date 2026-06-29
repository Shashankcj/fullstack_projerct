import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, LogOut, UserCircle, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import NotificationDropdown from './Notification';
import StorageFlag from '../shared/Flag';
import GenesisLogo from '../../assets/genesis_logo.png';
import '../index.css';


/* ================= PURE HELPERS ================= */

const generateUserColor = (identifier) => {
  if (!identifier) return 'linear-gradient(135deg, #4c5270 0%, #3d4466 100%)';
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue        = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 30);
  const lightness  = 25 + (Math.abs(hash) % 15);
  const hue2       = (hue + 30) % 360;
  return `linear-gradient(135deg, hsl(${hue}, ${saturation}%, ${lightness}%) 0%, hsl(${hue2}, ${saturation - 10}%, ${lightness - 5}%) 100%)`;
};

const getUserInitials = (name) => {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};


/* ================= COMPONENT ================= */

const Header = ({
  isDarkMode = false,
  toggleTheme,
  searchQuery = '',
  setSearchQuery,
  setShowNotificationModal,
  alerts = [],
  userEmail,
  userName,
  onLogout,
  toggleSidebar,
  className = '',
}) => {
  const dropdownRef = useRef(null);
  const [openDropdown,     setOpenDropdown]     = useState(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const navigate = useNavigate();


  /* ================= MEMOIZED STYLES ================= */

  const headerStyles = useMemo(() => ({
    backgroundColor:      isDarkMode ? 'rgba(17, 25, 40, 0.55)'    : 'rgba(255, 255, 255, 0.45)',
    backdropFilter:       'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    borderColor:          isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(209, 213, 219, 0.4)',
    boxShadow:            isDarkMode ? '4px 0 24px rgba(0, 0, 0, 0.4)' : '4px 0 24px rgba(0, 0, 0, 0.08)',
  }), [isDarkMode]);

  const inputStyles = useMemo(() => ({
    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
    borderColor:     isDarkMode ? '#4B5563' : '#D1D5DB',
    color:           isDarkMode ? '#FFFFFF' : '#1F2937',
  }), [isDarkMode]);

  const buttonStyles = useMemo(() => ({
    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
    color:           isDarkMode ? '#D1D5DB' : '#6B7280',
  }), [isDarkMode]);

  const dropdownStyles = useMemo(() => ({
    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
    borderColor:     isDarkMode ? '#374151' : '#E5E7EB',
  }), [isDarkMode]);

  const textColor          = isDarkMode ? '#FFFFFF' : '#1F2937';
  const secondaryTextColor = isDarkMode ? '#D1D5DB' : '#374151';
  const borderColor        = isDarkMode ? '#374151' : '#E5E7EB';


  /* ================= HANDLERS ================= */

  const toggleDropdown = useCallback((name) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  }, []);

  const handleSearchChange = useCallback(
    (e) => setSearchQuery(e.target.value),
    [setSearchQuery]
  );

  const handleUserAction = useCallback(
    (action) => {
      setOpenDropdown(null);
      if (action === 'logout' && onLogout) {
        onLogout();
      } else if (action === 'profile') {
        navigate('/profile');
      }
    },
    [onLogout, navigate]
  );

  const handleLogoClick = useCallback(() => {
    navigate('/dashboard/p1');
  }, [navigate]);


  /* ================= EFFECTS ================= */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
        setShowMobileSearch(false);
      }
    };
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, []);


  /* ================= UI ================= */

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[200] px-3 sm:px-6 py-2 sm:py-2.5 border-b backdrop-blur-md bg-opacity-70 transition-colors duration-300 ${className}`}
        style={headerStyles}
      >
        <div className="flex items-center justify-between gap-2 sm:gap-4">

          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSidebar('header-button');
              }}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Toggle navigation menu"
              style={buttonStyles}
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: textColor }} />
            </button>

            <img
  src={GenesisLogo}
  alt="Genesis Logo"
  className="w-8 h-8 sm:w-8 sm:h-8 object-contain"
  onClick={handleLogoClick}
/>

            <button
              className="text-base sm:text-lg lg:text-xl font-bold cursor-pointer whitespace-nowrap"
              style={{ color: textColor }}
              aria-label="Genesis Application"
              onClick={handleLogoClick}
            >
              GENESIS
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2" ref={dropdownRef}>

            {/* Flag Component */}
            <StorageFlag
              isDarkMode={isDarkMode}
              buttonStyles={buttonStyles}
              dropdownStyles={dropdownStyles}
              textColor={textColor}
              secondaryTextColor={secondaryTextColor}
              borderColor={borderColor}
              openDropdown={openDropdown}
              toggleDropdown={toggleDropdown}
            />

            {/* Notifications */}
            <NotificationDropdown
              isDarkMode={isDarkMode}
              alerts={alerts}
              setShowNotificationModal={setShowNotificationModal}
              openDropdown={openDropdown}
              toggleDropdown={toggleDropdown}
              buttonStyles={buttonStyles}
              dropdownStyles={dropdownStyles}
              textColor={textColor}
              secondaryTextColor={secondaryTextColor}
              borderColor={borderColor}
            />

            {/* User Profile */}
            <div className="relative">
              <div
                onClick={() => toggleDropdown('user')}
                className="cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95"
                aria-label="User menu"
                aria-expanded={openDropdown === 'user'}
                aria-haspopup="true"
              >
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold shadow-sm border-2 border-white/20 hover:shadow-md transition-all duration-200"
                  style={{
                    background: generateUserColor(userEmail || userName),
                    color: '#FFFFFF',
                  }}
                  title={`${userName || 'User'} - Click to open menu`}
                >
                  {getUserInitials(userName)}
                </div>
              </div>

              {openDropdown === 'user' && (
                <div
                  className="absolute right-0 mt-2 w-56 sm:w-64 rounded-xl shadow-lg border z-30 overflow-hidden"
                  style={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    borderColor:     isDarkMode ? '#374151' : '#E5E7EB',
                  }}
                  role="menu"
                  aria-label="User menu"
                >
                  <div className="p-3 sm:p-4 border-b" style={{ borderColor }}>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold shadow-sm flex-shrink-0"
                        style={{
                          background: generateUserColor(userEmail || userName),
                          color: '#FFFFFF',
                        }}
                      >
                        {getUserInitials(userName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-sm sm:text-base font-semibold truncate"
                          style={{ color: textColor }}
                          title={userName}
                        >
                          {userName || 'User Name'}
                        </h3>
                        <p
                          className="text-xs sm:text-sm truncate mt-0.5"
                          style={{ color: secondaryTextColor }}
                          title={userEmail}
                        >
                          {userEmail || 'user@example.com'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={() => handleUserAction('profile')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer rounded-lg transition-colors duration-200 ${
                        isDarkMode ? 'hover:bg-gray-300/20' : 'hover:bg-gray-50'
                      }`}
                      style={{ color: secondaryTextColor }}
                      role="menuitem"
                    >
                      <UserCircle className="w-4 h-4" />
                      <span className="font-medium">My Profile</span>
                    </button>
                    <button
                      onClick={() => handleUserAction('logout')}
                      className="w-full flex items-center cursor-pointer gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-300/20 transition-colors duration-200 text-red-600 dark:text-red-400 mt-1"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="font-medium">Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search Bar */}
      {showMobileSearch && (
        <div
          className="fixed top-14 sm:top-16 left-0 right-0 z-10 px-3 py-2 border-b backdrop-blur-md md:hidden"
          style={headerStyles}
        >
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search devices, alerts..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              style={inputStyles}
              aria-label="Mobile search"
              autoFocus
            />
            <button
              onClick={() => setShowMobileSearch(false)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Close search"
            >
              <X className="w-4 h-4" style={{ color: secondaryTextColor }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};


/* ================= PROP TYPES ================= */

Header.propTypes = {
  isDarkMode:               PropTypes.bool,
  toggleTheme:              PropTypes.func,
  searchQuery:              PropTypes.string,
  setSearchQuery:           PropTypes.func.isRequired,
  setShowNotificationModal: PropTypes.func.isRequired,
  alerts:                   PropTypes.array,
  userEmail:                PropTypes.string,
  userName:                 PropTypes.string,
  onLogout:                 PropTypes.func,
  toggleSidebar:            PropTypes.func,
  className:                PropTypes.string,
};

export default Header;