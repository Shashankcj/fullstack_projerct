import React from "react";
import { XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";

/**
 * Props:
 *  show         – boolean
 *  onHide       – () => void
 *  selectedUser – user object
 *  onConfirm    – () => void  (confirmDeleteUser)
 *  isDarkMode   – boolean
 */
const DeleteUserModal = ({ show, onHide, selectedUser, onConfirm, isDarkMode }) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.1)" }}
      onClick={onHide}
    >
      <div
        className="rounded-xl p-6 max-w-lg w-full relative shadow-2xl border mx-4"
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
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <TrashIcon className="h-6 w-6 text-red-600" />
          </div>

          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <h3
              className="text-lg leading-6 font-medium"
              style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}
            >
              Delete User
            </h3>
            <div className="mt-2">
              <p className="text-sm" style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}>
                Are you sure you want to delete user "{selectedUser?.username}"? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            onClick={onConfirm}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onHide}
            className={`mt-3 w-full inline-flex justify-center rounded-md border shadow-sm px-4 py-2 text-base font-medium focus:outline-none sm:mt-0 sm:w-auto sm:text-sm transition-colors
              ${isDarkMode
                ? "border-gray-600 bg-gray-600 text-gray-300 hover:bg-gray-500"
                : "border-gray-300 bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteUserModal;