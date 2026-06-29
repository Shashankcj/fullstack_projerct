import React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

/**
 * Props:
 *  show                    – boolean
 *  onHide                  – () => void
 *  passwordResetData       – { email, newPassword, confirmPassword }
 *  onChange                – (field, value) => void
 *  onSubmit                – (e) => void
 *  passwordErrors          – { password?, confirmPassword? }
 *  showNewPassword         – boolean
 *  setShowNewPassword      – (bool) => void
 *  showConfirmPassword     – boolean
 *  setShowConfirmPassword  – (bool) => void
 *  confirmPasswordTouched  – boolean
 *  setConfirmPasswordTouched – (bool) => void
 *  isDarkMode              – boolean
 */
const PasswordResetModal = ({
  show,
  onHide,
  passwordResetData,
  onChange,
  onSubmit,
  passwordErrors,
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  confirmPasswordTouched,
  setConfirmPasswordTouched,
  isDarkMode,
}) => {
  if (!show) return null;

  const getInputStyling = (fieldName) => {
    const hasError = passwordErrors[fieldName] || passwordErrors.password;
    if (hasError) {
      return isDarkMode
        ? "bg-gray-700 border-red-500 text-white focus:ring-red-500 focus:border-red-500"
        : "bg-white border-red-500 text-gray-900 focus:ring-red-500 focus:border-red-500";
    }
    return isDarkMode
      ? "bg-gray-700 border-gray-600 text-white focus:ring-blue-500 focus:border-blue-500"
      : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500";
  };

  const passwordsMatch =
    passwordResetData.newPassword === passwordResetData.confirmPassword;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.1)" }}
      onClick={onHide}
    >
      <div
        className="rounded-xl p-6 max-w-md w-full relative shadow-2xl border mx-4"
        style={{
          background: isDarkMode ? "rgba(15, 23, 42, 0.8)" : "rgba(246, 245, 248, 1)",
          borderColor: isDarkMode ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.3)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <div className="absolute top-0 right-0 pt-4 pr-4">
          <button
            onClick={onHide}
            className={isDarkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="sm:flex sm:items-start">
          <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
            <h3
              className="text-lg leading-6 font-medium mb-4"
              style={{ color: isDarkMode ? "#FFF" : "#111827" }}
            >
              Reset Password
            </h3>

            <form onSubmit={onSubmit} className="space-y-4">
              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
                  User Email
                </label>
                <input
                  type="email"
                  value={passwordResetData.email}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg cursor-not-allowed opacity-70
                    ${isDarkMode ? "bg-gray-700 border-gray-600 text-gray-400" : "bg-gray-100 border-gray-300 text-gray-600"}`}
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordResetData.newPassword}
                    onChange={(e) => onChange("newPassword", e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 ${getInputStyling("newPassword")}`}
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                    tabIndex={-1}
                  >
                    {showNewPassword
                      ? <EyeSlashIcon className="w-5 h-5" style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }} />
                      : <EyeIcon className="w-5 h-5" style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }} />
                    }
                  </button>
                </div>
                {passwordErrors.password && (
                  <p className="text-xs mt-1 text-red-500">{passwordErrors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordResetData.confirmPassword}
                    onChange={(e) => onChange("confirmPassword", e.target.value)}
                    onBlur={() => setConfirmPasswordTouched(true)}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 ${getInputStyling("confirmPassword")}`}
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword
                      ? <EyeSlashIcon className="w-5 h-5" style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }} />
                      : <EyeIcon className="w-5 h-5" style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }} />
                    }
                  </button>
                </div>

                {/* Match indicator */}
                {confirmPasswordTouched &&
                  passwordResetData.newPassword &&
                  passwordResetData.confirmPassword && (
                    <p className="text-xs mt-1" style={{ color: passwordsMatch ? "#10B981" : "#EF4444" }}>
                      {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                    </p>
                  )}

                {passwordErrors.confirmPassword && (
                  <p className="text-xs mt-1 text-red-500">{passwordErrors.confirmPassword}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onHide}
                  className={`px-4 py-2 rounded-lg
                    ${isDarkMode ? "text-gray-300 bg-gray-600 hover:bg-gray-500" : "text-gray-700 bg-gray-200 hover:bg-gray-300"}`}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={
                    !passwordResetData.newPassword ||
                    !passwordResetData.confirmPassword ||
                    !passwordsMatch
                  }
                  className="px-4 py-2 bg-[#6366f1] text-white rounded-lg hover:bg-[#6366f1]/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetModal;