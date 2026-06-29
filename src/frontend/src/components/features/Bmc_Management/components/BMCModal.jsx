import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon,
  ServerIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { Eye,EyeOff } from "lucide-react";

const BMCModal = ({
  show,
  onHide,
  onSuccess,
  isDarkMode = false,
  mode = "add",        // "add" | "edit"
  bmcData = null,      // existing BMC data for edit mode
  createBMC,           // RTK mutation — passed from parent
  updateBMC,           // RTK mutation — passed from parent
}) => {

  const [formData, setFormData] = useState({
    ip_address: "",
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  /* ---- Populate form in edit mode ---- */
  useEffect(() => {
    if (mode === "edit" && bmcData) {
      setFormData({
        ip_address: bmcData.ip_address || "",
        username: bmcData.username || "",
        password: "",   // never pre-fill password for security
      });
    } else {
      setFormData({ ip_address: "", username: "", password: "" });
    }
    setErrors({});
  }, [mode, bmcData, show]);

  /* ---- IP Validation ---- */
  const isValidIPAddress = (ip) => {
    const ipv4Pattern =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Pattern.test(ip.trim());
  };

  /* ---- Field enable logic (username & password unlock after valid IP) ---- */
  const isFieldEnabled = (fieldName) => {
    if (fieldName === "username" || fieldName === "password") {
      return (
        formData.ip_address.trim() !== "" &&
        isValidIPAddress(formData.ip_address)
      );
    }
    return true;
  };

  /* ---- Handle Input Change ---- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (!isFieldEnabled(name)) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  /* ---- Validation ---- */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.ip_address.trim()) {
      newErrors.ip_address = "IP Address is required";
    } else if (!isValidIPAddress(formData.ip_address)) {
      newErrors.ip_address = "Please enter a valid IPv4 address (e.g., 192.168.1.1)";
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.trim().length < 2) {
      newErrors.username = "Username must be at least 2 characters";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 4) {
      newErrors.password = "Password must be at least 4 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* ---- Submit ---- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      ip_address: formData.ip_address.trim(),
      username: formData.username.trim(),
      password: formData.password,
    };

    setLoading(true);
    try {
      let response;
      if (mode === "edit" && bmcData?.id) {
        response = await updateBMC({ uuid: bmcData.id, ...payload }).unwrap();
      } else {
        response = await createBMC(payload).unwrap();
      }

      setLoading(false);
      handleReset();
      onSuccess?.();
      onHide();

      setTimeout(() => {
        toast.success(
          response?.message ||
            `BMC device ${formData.ip_address} ${
              mode === "edit" ? "updated" : "added"
            } successfully!`
        );
      }, 300);

    } catch (error) {
      setLoading(false);
      console.error("BMC modal error:", error);

      // Field-specific backend errors
      if (error?.data) {
        const backendErrors = {};
        let hasFieldErrors = false;

        Object.keys(error.data).forEach((field) => {
          if (["message", "detail", "non_field_errors"].includes(field)) return;
          const val = error.data[field];
          if (Array.isArray(val) && val.length > 0) {
            backendErrors[field] = val[0];
            hasFieldErrors = true;
            toast.error(val[0]);
          } else if (typeof val === "string") {
            backendErrors[field] = val;
            hasFieldErrors = true;
            toast.error(val);
          }
        });

        if (hasFieldErrors) { setErrors(backendErrors); return; }
        if (error.data.message) { toast.error(error.data.message); return; }
        if (error.data.detail)  { toast.error(error.data.detail);  return; }
      }

      // HTTP status fallbacks
      if      (error?.status === "FETCH_ERROR") toast.error("Network error. Please check your connection.");
      else if (error?.status === 401)           toast.error("Unauthorized. Please log in again.");
      else if (error?.status === 403)           toast.error("You do not have permission to perform this action.");
      else if (error?.status === 404)           toast.error("Resource not found.");
      else if (error?.status === 500)           toast.error("Server error. Please try again later.");
      else toast.error(
        mode === "edit"
          ? "Failed to update BMC device. Please try again."
          : "Failed to add BMC device. Please try again."
      );
    }
  };

  /* ---- Reset & Close ---- */
  const handleReset = () => {
    if (mode === "edit" && bmcData) {
      setFormData({
        ip_address: bmcData.ip_address || "",
        username: bmcData.username || "",
        password: "",
      });
    } else {
      setFormData({ ip_address: "", username: "", password: "" });
    }
    setErrors({});
    setLoading(false);
    setShowPassword(false);
  };

  const handleClose = () => {
    handleReset();
    onHide();
  };

  /* ---- Has changes check (enables submit button) ---- */
  const hasChanges = () => {
    if (mode === "add") {
      return formData.ip_address || formData.username || formData.password;
    }
    return (
      formData.ip_address !== bmcData?.ip_address ||
      formData.username   !== bmcData?.username   ||
      formData.password   !== ""
    );
  };

  /* ---- Input styling (same pattern as IPModal) ---- */
  const getInputStyling = (fieldName) => {
    const isEnabled = isFieldEnabled(fieldName);

    if (!isEnabled) {
      return isDarkMode
        ? "border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed"
        : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed";
    }
    if (errors[fieldName]) {
      return isDarkMode
        ? "border-red-500 bg-gray-600 text-gray-300 placeholder-gray-400 focus:border-red-500 focus:ring-red-500"
        : "border-red-500 bg-gray-100 text-gray-700 placeholder-gray-500 focus:border-red-500 focus:ring-red-500";
    }
    if (fieldName === "ip_address" && isValidIPAddress(formData.ip_address)) {
      return isDarkMode
        ? "border-green-500 bg-gray-700 text-white placeholder-gray-400 focus:border-green-500 focus:ring-green-500"
        : "border-green-500 bg-white text-gray-900 focus:border-green-500 focus:ring-green-500";
    }
    return isDarkMode
      ? "border-gray-600 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500"
      : "border-gray-300 focus:border-blue-500 bg-white text-gray-900 focus:ring-blue-500";
  };

  if (!show) return null;

  /* ---- RENDER ---- */
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
      onClick={handleClose}
    >
      <div
        className="rounded-xl p-6 max-w-lg w-full relative shadow-2xl border mx-4"
        style={{
          background: isDarkMode ? "rgba(15, 23, 42, 0.95)" : "rgba(246, 245, 248, 1)",
          borderColor: isDarkMode ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.3)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Header */}
        <h3
          className="text-xl font-semibold mb-5 flex items-center"
          style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}
        >
          {mode === "edit" ? (
            <>
              <PencilSquareIcon className="w-5 h-5 mr-2" style={{ color: isDarkMode ? "#60A5FA" : "#2563EB" }} />
              Edit BMC Device
            </>
          ) : (
            <>
              <ServerIcon className="w-5 h-5 mr-2" style={{ color: isDarkMode ? "#60A5FA" : "#2563EB" }} />
              Add BMC Device
            </>
          )}
        </h3>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* IP Address */}
          <div>
            <label className="block text-sm font-medium mb-1"
              style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
              IP Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="ip_address"
              value={formData.ip_address}
              onChange={handleChange}
              placeholder="e.g., 192.168.1.100"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors font-mono ${getInputStyling("ip_address")}`}
            />
            {errors.ip_address ? (
              <p className="mt-1 text-xs text-red-600">{errors.ip_address}</p>
            ) : formData.ip_address && isValidIPAddress(formData.ip_address) ? (
              <p className="mt-1 text-xs text-green-600">✓ Valid IP address</p>
            ) : null}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1"
              style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="e.g., admin, root"
              disabled={!isFieldEnabled("username")}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors ${getInputStyling("username")}`}
            />
            {errors.username && (
              <p className="mt-1 text-xs text-red-600">{errors.username}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1"
              style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter BMC password"
                disabled={!isFieldEnabled("password")}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors pr-16 ${getInputStyling("password")}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={!isFieldEnabled("password")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 disabled:opacity-40"
              >
                {showPassword ? <EyeOff/> : <Eye/>}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password}</p>
            )}
          </div>

          {/* Info Box */}
          <div className={`p-3 rounded-lg border ${
            isDarkMode ? "bg-blue-900/20 border-blue-800/30" : "bg-blue-50 border-blue-200"
          }`}>
            <p className="text-xs" style={{ color: isDarkMode ? "#93C5FD" : "#1E40AF" }}>
              <strong>Note:</strong> Ensure BMC credentials are correct.
              Username and password are used to authenticate with the BMC interface.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-3 border-t"
            style={{ borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}>

            {hasChanges() && !loading && (
              <button type="button" onClick={handleReset}
                className={`inline-flex items-center px-4 py-2 font-medium rounded-lg transition-colors ${
                  isDarkMode
                    ? "text-gray-300 bg-gray-600 hover:bg-gray-500"
                    : "text-gray-700 bg-gray-200 hover:bg-gray-300"
                }`}>
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Reset
              </button>
            )}

            <button type="submit"
              disabled={loading || !hasChanges()}
              className="inline-flex items-center px-5 py-2 font-medium rounded-lg text-white
                bg-gradient-to-r from-blue-600 to-purple-600
                hover:from-blue-700 hover:to-purple-700
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === "edit" ? "Updating..." : "Adding..."}
                </>
              ) : mode === "edit" ? (
                <><PencilSquareIcon className="w-4 h-4 mr-2" />Update BMC Device</>
              ) : (
                <><PlusIcon className="w-4 h-4 mr-2" />Add BMC Device</>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default BMCModal;
