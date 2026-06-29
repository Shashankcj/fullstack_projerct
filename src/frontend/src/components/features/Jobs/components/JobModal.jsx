import React from "react";
import { X, Upload, AlertTriangle } from "lucide-react";
import { formatDateTime } from "../../../Utilities/formatDateTime";

const JobModal = ({ isOpen, onClose, job, isDarkMode }) => {
  if (!isOpen || !job) return null;

  // EXACT SAME STYLE - Updated for your backend data
  const stats = {
    total: job.total_rows || 0,
    created: job.created_count || 0,
    duplicates: job.duplicate_count || 0,
    errors: job.error_count || 0,
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.1)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 max-w-2xl w-full relative shadow-2xl border mx-4 max-h-[90vh] overflow-y-auto custom-scroll"
        style={{
          background: isDarkMode ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
          borderColor: isDarkMode ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.3)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - SAME STYLE */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header - SAME STYLE, Updated fields */}
        <h2
          className="text-xl font-semibold mb-6 flex items-center"
          style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}
        >
          <Upload
            className="w-5 h-5 mr-2"
            style={{ color: isDarkMode ? "#60A5FA" : "#2563EB" }}
          />
          Job #{job.uuid?.slice(0, 8)}... - {job.job_type}
        </h2>

        {/* Upload Summary Card - EXACT SAME STYLE */}
        <div className="mb-8">
          <div
            className={`p-4 rounded-lg border ${
              isDarkMode
                ? "bg-blue-900/20 border-blue-800/30"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            <h4
              className="text-sm font-semibold mb-3 flex items-center"
              style={{ color: isDarkMode ? "#93C5FD" : "#1E40AF" }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Summary
            </h4>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>Total Rows</p>
                <p 
                  className="text-lg font-bold" 
                  style={{ color: isDarkMode ? "#93C5FD" : "#1E40AF" }}
                >
                  {stats.total}
                </p>
              </div>
              <div>
                <p style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>Created</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {stats.created}
                </p>
              </div>
              <div>
                <p style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>Duplicates</p>
                <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.duplicates}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Errors Card (if any) - SAME STYLE */}
        {stats.errors > 0 && (
          <div className="mb-6">
            <div
              className={`p-4 rounded-lg border ${
                isDarkMode
                  ? "bg-red-900/20 border-red-800/30"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start">
                <AlertTriangle
                  className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5"
                  style={{ color: isDarkMode ? "#FCA5A5" : "#DC2626" }}
                />
                <div>
                  <p
                    className="text-sm font-medium mb-1"
                    style={{ color: isDarkMode ? "#FCA5A5" : "#DC2626" }}
                  >
                    Errors ({stats.errors})
                  </p>
                  <p className="text-xs" style={{ color: isDarkMode ? "#FCA5A5" : "#DC2626" }}>
                    Check logs for detailed error information
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Divider - SAME STYLE */}
        <div
          className="h-px my-6"
          style={{ background: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
        />

        {/* Job Details - SAME EXACT STYLE */}
        <div className="space-y-4 text-sm">
          <div className="flex justify-between">
            <span style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>Job Type</span>
            <span className="font-medium" style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}>
              {job.job_type}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>User</span>
            <span className="font-medium" style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}>
              {job.user}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>Started</span>
            <span className="font-medium" style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}>
              {formatDateTime(job.created_at)}
            </span>
          </div>
          
          <div className="pt-4 border-t" style={{ borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}>
            <p style={{ color: isDarkMode ? "#E2E8F0" : "#334155", marginBottom: "0.5rem" }}>
              <strong style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}>Summary:</strong>
            </p>
            <p style={{ color: isDarkMode ? "#E2E8F0" : "#334155" }}>
              {job.result || 'Job completed successfully'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobModal;
