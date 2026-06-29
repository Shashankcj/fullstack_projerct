import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';


const ConfirmationModal = ({
  show,
  title       = "Confirm Action",
  message,
  confirmText = "Yes, Remove",
  cancelText  = "Cancel",
  onConfirm,
  onCancel,
  isDarkMode  = true,
}) => {
  const [isConfirmHovered, setIsConfirmHovered] = useState(false);
  const [isCancelHovered,  setIsCancelHovered]  = useState(false);


  /* ================= EFFECTS ================= */

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);


  /* ================= UI ================= */

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="rounded-xl p-6 max-w-md w-full relative shadow-2xl border mx-4"
        style={{
          background:           isDarkMode ? 'rgba(15, 23, 42, 0.8)'       : 'rgba(246, 245, 248, 1)',
          borderColor:          isDarkMode ? 'rgba(51, 65, 85, 0.4)'       : 'rgba(203, 213, 225, 0.3)',
          backdropFilter:       'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="p-2 rounded-full"
            style={{
              background: isDarkMode
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(239, 68, 68, 0.1)',
            }}
          >
            <AlertTriangle
              className="w-5 h-5"
              style={{ color: isDarkMode ? '#F87171' : '#EF4444' }}
            />
          </div>
          <h3
            id="modal-title"
            className="text-xl font-semibold"
            style={{ color: isDarkMode ? '#F1F5F9' : '#1E293B' }}
          >
            {title}
          </h3>
        </div>

        {/* Message Body */}
        <div className="mb-6">
          <div
            className="p-4 rounded-lg"
            style={{
              color:      isDarkMode ? '#E2E8F0'             : '#334155',
              background: isDarkMode ? 'rgba(17,24,39,0.3)'  : 'rgba(248,250,252,0.8)',
            }}
          >
            <p className="leading-relaxed text-sm">{message}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">

          {/* Cancel */}
          <button
            onClick={onCancel}
            onMouseEnter={() => setIsCancelHovered(true)}
            onMouseLeave={() => setIsCancelHovered(false)}
            className="px-4 py-2 text-sm rounded-lg transition-all duration-200"
            style={{
              color:      isDarkMode ? '#94A3B8'                                          : '#64748B',
              background: isCancelHovered
                ? (isDarkMode ? 'rgba(71, 85, 105, 0.4)'  : 'rgba(241, 245, 249, 1)')
                : (isDarkMode ? 'rgba(51, 65, 85, 0.3)'   : 'rgba(248, 250, 252, 0.8)'),
              border: isDarkMode
                ? '1px solid rgba(71, 85, 105, 0.3)'
                : '1px solid rgba(203, 213, 225, 0.3)',
            }}
          >
            {cancelText}
          </button>

          {/* Confirm */}
          <button
            onClick={onConfirm}
            onMouseEnter={() => setIsConfirmHovered(true)}
            onMouseLeave={() => setIsConfirmHovered(false)}
            className="px-4 py-2 text-sm rounded-lg transition-all duration-200"
            style={{
              background: isConfirmHovered
                ? 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
                : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              color:     '#FFFFFF',
              border:    '1px solid rgba(220, 38, 38, 0.3)',
              transform: isConfirmHovered ? 'translateY(-1px)' : 'translateY(0)',
              boxShadow: isConfirmHovered
                ? (isDarkMode ? '0 6px 16px rgba(239, 68, 68, 0.3)'  : '0 6px 16px rgba(239, 68, 68, 0.25)')
                : (isDarkMode ? '0 4px 12px rgba(239, 68, 68, 0.2)'  : '0 4px 12px rgba(239, 68, 68, 0.15)'),
            }}
          >
            {confirmText}
          </button>

        </div>
      </div>
    </div>
  );
};


export default ConfirmationModal;