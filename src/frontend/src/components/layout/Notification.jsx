// ✅ Fix #1 — removed `import React`
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  useMarkAlertAsReadMutation,
  // ✅ Fix #2 — use consolidated mutation (no arg = global)
  useMarkAllAlertsAsReadMutation,
} from '../../redux/alertFilterApi';
import { useDispatch } from 'react-redux';
import {
  markAlertAsRead,
  markAllAsRead,
} from '../../redux/notificationSlice';
import '../../components/index.css';


/* ================= PURE HELPERS ================= */

const getDotColor = (alert) => {
  const severity  = alert.severity?.toLowerCase();
  const alertType = alert.alert_type?.toLowerCase();
  if (severity === 'critical' || severity === 'high')            return 'bg-red-500';
  if (severity === 'warning'  || alertType?.includes('warning')) return 'bg-yellow-400';
  if (severity === 'info'     || severity === 'low')             return 'bg-blue-400';
  return 'bg-red-500';
};

// ✅ Fix #4 — safe date formatter with null guard
const formatAlertTime = (dateString) => {
  if (!dateString) return 'Unknown time';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString('en-US', {
      month:  '2-digit',
      day:    '2-digit',
      year:   '2-digit',
      hour:   '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Invalid date';
  }
};


/* ================= COMPONENT ================= */

const NotificationDropdown = ({
  isDarkMode,
  openDropdown,
  toggleDropdown,
  buttonStyles,
  dropdownStyles,
  textColor,
  borderColor,
  alerts = [],
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [slidingOutId, setSlidingOutId] = useState(null);
  const [markAsRead]  = useMarkAlertAsReadMutation();
  // ✅ Fix #2 — consolidated mutation
  const [markAllApi]  = useMarkAllAlertsAsReadMutation();

  // ✅ Fix #3 — ref to track and clear setTimeout on unmount
  const slideTimerRef = useRef(null);

  // ✅ Fix #3 — cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    };
  }, []);


  /* -------------------- DERIVED STATE -------------------- */

  // ✅ Fix #6 — named boolean instead of repeating string comparison
  const isOpen = openDropdown === 'notifications';

  const unreadAlerts = useMemo(() => (
    alerts
      .filter((a) => !a.is_read)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  ), [alerts]);

  const unreadCount = unreadAlerts.length;

  // ✅ Fix #8 — removed redundant unreadCount from deps (unreadAlerts covers it)
  const badgeColor = useMemo(() => {
    if (unreadAlerts.length === 0) return 'bg-gray-400';
    const severities = unreadAlerts.map((a) => a.severity?.toLowerCase());
    if (severities.some((s) => ['critical', 'high'].includes(s))) return 'bg-red-500';
    if (severities.some((s) => s === 'warning'))                  return 'bg-yellow-400';
    if (severities.some((s) => ['info', 'low'].includes(s)))      return 'bg-blue-400';
    return 'bg-red-500';
  }, [unreadAlerts]);


  /* -------------------- HANDLERS -------------------- */

  const handleNotificationClick = useCallback(async (notification) => {
    setSlidingOutId(notification.uuid);
    dispatch(markAlertAsRead(notification.uuid));

    try {
      await markAsRead(notification.uuid).unwrap();
    } catch (err) {
      console.error('[NotificationDropdown] Failed to mark as read:', err);
    }

    // ✅ Fix #3 — store timer ref for cleanup
    slideTimerRef.current = setTimeout(() => {
      setSlidingOutId(null);
      navigate('/alerts', {
        state: {
          findAlertId:      notification.uuid,
          fromNotification: true,
        },
      });
      toggleDropdown(null);
    }, 200);
  }, [dispatch, navigate, toggleDropdown, markAsRead]);

  const handleMarkAll = useCallback(async () => {
    try {
      dispatch(markAllAsRead());
      // ✅ Fix #2 — no argument = global mark all
      await markAllApi().unwrap();
    } catch (err) {
      console.error('[NotificationDropdown] Failed to mark all as read:', err);
    }
  }, [dispatch, markAllApi]);

  const handleViewAll = useCallback(() => {
    navigate('/alerts');
    toggleDropdown(null);
  }, [navigate, toggleDropdown]);

  const handleBellClick = useCallback(() => {
    toggleDropdown(isOpen ? null : 'notifications');
  }, [toggleDropdown, isOpen]);


  /* -------------------- RENDER -------------------- */

  return (
    <div className="relative">

      {/* Bell Button */}
      <button
        onClick={handleBellClick}
        className="p-2 rounded-lg transition-all hover:opacity-80 active:scale-[0.97]"
        style={buttonStyles}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}   // ✅ Fix #6 — named boolean
        aria-haspopup="true"
      >
        {/* ✅ Fix #5 — animate-pulse on icon is subtle; bounce is distracting */}
        <Bell className={`w-5 h-5 ${unreadCount ? 'animate-pulse' : ''}`} />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 ${badgeColor} text-white text-xs
            min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center
            ring-2 ring-white`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (   // ✅ Fix #6
        <div
          className="absolute right-0 mt-2 w-96 rounded-xl shadow-xl border z-30"
          style={dropdownStyles}
          role="menu"
          aria-label="Notifications menu"
        >
          {/* Header */}
          <div
            className="p-4 font-semibold text-sm border-b flex justify-between items-center"
            style={{ color: textColor, borderColor }}
          >
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-gray-400">{unreadCount} new</span>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto custom-scroll">
            {unreadCount === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 mx-auto mb-3 text-green-500" />
                <p className="font-medium" style={{ color: textColor }}>
                  All caught up
                </p>
                <p className="text-xs text-gray-500 mt-1">No unread notifications</p>
              </div>
            ) : (
              unreadAlerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.uuid}
                  onClick={() => handleNotificationClick(alert)}
                  role="menuitem"
                  className={`p-3 cursor-pointer border-b transition-all duration-200
                    ${isDarkMode ? 'hover:bg-gray-700/40' : 'hover:bg-gray-50'}
                    ${slidingOutId === alert.uuid ? '-translate-x-full opacity-0' : ''}
                  `}
                  style={{ borderColor }}
                >
                  <div className="flex gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getDotColor(alert)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: textColor }}>
                        {alert.message}
                      </p>
                      {alert.device_name && (
                        <p className="text-xs text-gray-500 truncate">
                          {alert.device_name}
                        </p>
                      )}
                      {/* ✅ Fix #4 — safe formatter */}
                      <p className="text-[11px] text-gray-400 mt-1">
                        {formatAlertTime(alert.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {unreadCount > 0 && (
            <div
              className="flex justify-between items-center p-3 border-t"
              style={{ borderColor }}
            >
              <button
                onClick={handleMarkAll}
                className="text-xs font-medium text-red-500 bg-red-500/20 px-2 py-1
                  rounded hover:bg-red-500/30 transition-colors cursor-pointer"
              >
                Mark all as read
              </button>
              <button
                onClick={handleViewAll}
                className="text-xs font-medium text-indigo-500 bg-indigo-500/20 px-2 py-1
                  rounded hover:bg-indigo-500/30 transition-colors cursor-pointer"
              >
                View all
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
};


/* ================= PROP TYPES ================= */
NotificationDropdown.propTypes = {
  isDarkMode:         PropTypes.bool.isRequired,
  openDropdown:       PropTypes.string,
  toggleDropdown:     PropTypes.func.isRequired,
  buttonStyles:       PropTypes.object.isRequired,
  dropdownStyles:     PropTypes.object.isRequired,
  textColor:          PropTypes.string.isRequired,
  borderColor:        PropTypes.string.isRequired,
  alerts:             PropTypes.array.isRequired,
};

export default NotificationDropdown;