import React from 'react';
import { X } from 'lucide-react';

const timeAgo = (dateString) => {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};

const AuditLogModal = ({ isOpen, onClose, log, isDarkMode }) => {
  if (!isOpen || !log) return null;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical':
        return isDarkMode ? '#F87171' : '#DC2626';
      case 'Delete':
        return isDarkMode ? '#F87171' : '#DC2626';
      case 'Warning':
        return isDarkMode ? '#FBBF24' : '#CA8A04';
      case 'Update':
        return isDarkMode ? '#FBBF24' : '#CA8A04';
      case 'Create':
        return isDarkMode ? '#34D399' : '#059669';
      case 'Success':
        return isDarkMode ? '#34D399' : '#059669';
      case 'Info':
        return isDarkMode ? '#60A5FA' : '#2563EB';
      default:
        return isDarkMode ? '#CBD5E1' : '#64748B';
    }
  };

 const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};


  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 max-w-2xl w-full relative shadow-2xl border"
        style={{
          background: isDarkMode
            ? 'rgba(15, 23, 42, 0.8)'
            : 'rgba(246, 245, 248, 1)',
          borderColor: isDarkMode
            ? 'rgba(51, 65, 85, 0.4)'
            : 'rgba(203, 213, 225, 0.3)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <h2
          className="text-xl font-semibold mb-5"
          style={{ color: isDarkMode ? '#F1F5F9' : '#1E293B' }}
        >
          Audit Log Details
        </h2>

        {/* Log content */}
        <div
          className="max-h-96 overflow-y-auto space-y-2 no-scrollbar"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* User & Severity Card */}
          <div
            className="p-3 rounded-md"
            style={{
              color: isDarkMode ? '#E2E8F0' : '#334155',
              background: isDarkMode
                ? 'rgba(17,24,39,0.3)'
                : 'rgba(248,250,252,0.8)',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div
                  className="text-xs uppercase mb-1"
                  style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}
                >
                  User
                </div>
                <div className="font-medium text-base">{log.user || 'N/A'}</div>
              </div>
              <div className="flex-1">
                <div
                  className="text-xs uppercase mb-1"
                  style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}
                >
                  Action
                </div>
                <div className="font-medium text-base">{log.action || 'N/A'}</div>
              </div>
              <div className="flex-1 flex justify-end">
                <div>
                  <div
                    className="text-xs uppercase mb-1 text-right"
                    style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}
                  >
                    Severity
                  </div>
                  <span
                    className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: getSeverityColor(log.severity_display || log.severity) + '22',
                      color: getSeverityColor(log.severity_display || log.severity),
                      border: `1px solid ${getSeverityColor(log.severity_display || log.severity)}44`,
                    }}
                  >
                    {log.severity_display || log.severity}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            className="h-px my-2"
            style={{
              background: isDarkMode
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.05)',
            }}
          />

          {/* Resource & IP Card */}
          <div
            className="p-3 rounded-md"
            style={{
              color: isDarkMode ? '#E2E8F0' : '#334155',
              background: isDarkMode
                ? 'rgba(17,24,39,0.3)'
                : 'rgba(248,250,252,0.8)',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div
                  className="text-xs uppercase mb-1"
                  style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}
                >
                  Resource
                </div>
                <div className="font-medium text-base">{log.model_name || 'N/A'}</div>
              </div>
              <div className="flex-1">
                <div
                  className="text-xs uppercase mb-1"
                  style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}
                >
                  IP Address
                </div>
                <div className="font-medium text-base font-mono">{log.ip || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            className="h-px my-2"
            style={{
              background: isDarkMode
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.05)',
            }}
          />

          {/* Time Info Card */}
          <div
            className="p-3 rounded-md"
            style={{
              color: isDarkMode ? '#E2E8F0' : '#334155',
              background: isDarkMode
                ? 'rgba(17,24,39,0.3)'
                : 'rgba(248,250,252,0.8)',
            }}
          >
            <div
              className="text-xs uppercase mb-1"
              style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}
            >
              Timestamp
            </div>
            <div className="font-medium">
              {formatTimestamp(log.timestamp)}
              <span
                className="ml-2 text-xs font-normal"
                style={{ color: '#94A3B8' }}
              >
                &middot; {timeAgo(log.timestamp)}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div
            className="h-px my-2"
            style={{
              background: isDarkMode
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.05)',
            }}
          />

          {/* Description Card */}
          <div
            className="p-3 rounded-md"
            style={{
              color: isDarkMode ? '#E2E8F0' : '#334155',
              background: isDarkMode
                ? 'rgba(17,24,39,0.3)'
                : 'rgba(248,250,252,0.8)',
            }}
          >
            <div
              className="text-xs uppercase mb-2"
              style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}
            >
              Description
            </div>
            <p className="font-medium leading-relaxed">
              {log.description || 'No description available'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogModal;
