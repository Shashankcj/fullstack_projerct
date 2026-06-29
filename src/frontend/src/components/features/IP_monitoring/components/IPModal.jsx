import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import {
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";


/* ================= CONSTANTS ================= */

const PRIORITY_OPTIONS = [
  { value: "p1", label: "Priority 1 (Critical)" },
  { value: "p2", label: "Priority 2 (High)"     },
  { value: "p3", label: "Priority 3 (Medium)"   },
  { value: "p4", label: "Priority 4 (Low)"      },
  { value: "np", label: "No Priority (Default)" },
];

const DEFAULT_FORM = {
  name:       "",
  ip_address: "",
  priority:   "default",
};


/* ================= PURE HELPERS ================= */

const isValidIPAddress = (ip) => {
  const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Pattern.test(ip.trim());
};


/* ================= COMPONENT ================= */

const IPModal = ({
  show,
  onHide,
  onSuccess,
  isDarkMode     = false,
  mode           = "add",
  ipData         = null,
  createIP,
  updateIPs,
  assignPriority,
}) => {
  const [formData, setFormData]             = useState(DEFAULT_FORM);
  const [loading, setLoading]               = useState(false);
  const [errors, setErrors]                 = useState({});
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);

  const priorityRef = useRef(null);


  /* ================= DERIVED VALUES ================= */

  const isFieldEnabled = useCallback((fieldName) => {
    switch (fieldName) {
      case "ip_address": return true;
      case "name":       return formData.ip_address.trim() !== "" && isValidIPAddress(formData.ip_address);
      default:           return true;
    }
  }, [formData.ip_address]);

  const getInputStyling = useCallback((fieldName) => {
    if (!isFieldEnabled(fieldName)) {
      return isDarkMode
        ? "border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed"
        : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed";
    }
    if (errors[fieldName]) {
      return isDarkMode
        ? "border-red-500 bg-gray-600 text-gray-300 placeholder-gray-400 focus:border-red-500 focus:ring-red-500"
        : "border-red-500 bg-gray-100 text-gray-700 placeholder-gray-500 focus:border-red-500 focus:ring-red-500";
    }
    if (fieldName === "ip_address" && formData.ip_address && isValidIPAddress(formData.ip_address)) {
      return isDarkMode
        ? "border-green-500 bg-gray-700 text-white placeholder-gray-400 focus:border-green-500 focus:ring-green-500"
        : "border-green-500 bg-white text-gray-900 focus:border-green-500 focus:ring-green-500";
    }
    return isDarkMode
      ? "border-gray-600 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500"
      : "border-gray-300 focus:border-blue-500 bg-white text-gray-900 focus:ring-blue-500";
  }, [isDarkMode, errors, formData.ip_address, isFieldEnabled]);

  const hasFormData = useMemo(
    () => Boolean(formData.ip_address || formData.name),
    [formData.ip_address, formData.name]
  );

  const hasChanges = useMemo(() => {
    if (mode === "add") return hasFormData;
    if (!ipData) return false;
    return (
      formData.ip_address !== ipData.ip_address ||
      formData.name       !== ipData.name       ||
      formData.priority   !== ipData.priorityValue
    );
  }, [mode, ipData, formData, hasFormData]);


  /* ================= HANDLERS ================= */

  const handleReset = useCallback(() => {
    if (mode === "edit" && ipData) {
      setFormData({
        name:       ipData.name          || "",
        ip_address: ipData.ip_address    || "",
        priority:   ipData.priorityValue || "default",
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
    setErrors({});
    setLoading(false);
  }, [mode, ipData]);

  const handleClose = useCallback(() => {
    handleReset();
    onHide();
  }, [handleReset, onHide]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (!isFieldEnabled(name)) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }, [isFieldEnabled, errors]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.ip_address.trim()) {
      newErrors.ip_address = "IP Address is required";
    } else if (!isValidIPAddress(formData.ip_address)) {
      newErrors.ip_address = "Please enter a valid IPv4 address (e.g., 192.168.1.1)";
    }
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    } else if (formData.name.trim().length > 50) {
      newErrors.name = "Name must be less than 50 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      name:       formData.name.trim(),
      ip_address: formData.ip_address.trim(),
    };

    setLoading(true);

    try {
      let response;
      if (mode === "edit" && ipData?.id) {
        response = await updateIPs({ uuid: ipData.id, ...payload }).unwrap();
      } else {
        response = await createIP(payload).unwrap();
      }

      if (mode === "edit") {
        await assignPriority({ uuid: ipData?.id, priority: formData.priority }).unwrap();
      }

      setLoading(false);
      handleReset();
      if (onSuccess) onSuccess();
      onHide();

      if (response?.message) {
        toast.success(response.message);
      } else if (response?.detail) {
        toast.success(response.detail);
      } else {
        toast.success(
          mode === "edit"
            ? `IP Address "${payload.name}" updated successfully!`
            : `IP Address "${payload.name}" added successfully!`
        );
      }

    } catch (error) {
      setLoading(false);

      if (error?.data) {
        const backendErrors = {};
        let hasFieldErrors  = false;

        Object.keys(error.data).forEach((field) => {
          if (["message", "detail", "non_field_errors"].includes(field)) return;
          const errorValue = error.data[field];
          if (Array.isArray(errorValue) && errorValue.length > 0) {
            backendErrors[field] = errorValue[0];
            hasFieldErrors       = true;
            toast.error(errorValue[0]);
          } else if (typeof errorValue === "string") {
            backendErrors[field] = errorValue;
            hasFieldErrors       = true;
            toast.error(errorValue);
          }
        });

        if (hasFieldErrors)              { setErrors(backendErrors); return; }
        if (error.data.message)          { toast.error(error.data.message); return; }
        if (error.data.detail)           { toast.error(error.data.detail); return; }
        if (error.data.non_field_errors) {
          toast.error(
            Array.isArray(error.data.non_field_errors)
              ? error.data.non_field_errors[0]
              : error.data.non_field_errors
          );
          return;
        }
      }

      if      (error?.status === "FETCH_ERROR") toast.error("Network error. Please check your connection.");
      else if (error?.status === 401)           toast.error("Unauthorized. Please log in again.");
      else if (error?.status === 403)           toast.error("You do not have permission to perform this action.");
      else if (error?.status === 404)           toast.error("Resource not found.");
      else if (error?.status === 500)           toast.error("Server error. Please try again later.");
      else toast.error(
        mode === "edit"
          ? "Failed to update IP address. Please try again."
          : "Failed to add IP address. Please try again."
      );
    }
  }, [validateForm, formData, mode, ipData, updateIPs, createIP, assignPriority, handleReset, onSuccess, onHide]);


  /* ================= EFFECTS ================= */
  // ✅ All effects AFTER handlers — no TDZ risk

  // Initialize form when modal opens or ipData changes
  useEffect(() => {
    if (mode === "edit" && ipData) {
      setFormData({
        name:       ipData.name          || "",
        ip_address: ipData.ip_address    || "",
        priority:   (ipData.priorityValue || "default").toLowerCase(),
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
    setErrors({});
  }, [mode, ipData]);

  // Escape key — handleClose is safely defined above
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  // Priority dropdown click-outside
  useEffect(() => {
    const handler = (e) => {
      if (priorityRef.current && !priorityRef.current.contains(e.target))
        setIsPriorityOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);


  /* ================= UI ================= */

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.1)" }}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ip-modal-title"
        className="rounded-xl p-6 max-w-lg w-full relative shadow-2xl border mx-4"
        style={{
          background:           isDarkMode ? "rgba(15, 23, 42, 0.8)"      : "rgba(246, 245, 248, 1)",
          borderColor:          isDarkMode ? "rgba(51, 65, 85, 0.4)"      : "rgba(203, 213, 225, 0.3)",
          backdropFilter:       "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Header */}
        <h3
          id="ip-modal-title"
          className="text-xl font-semibold mb-5 flex items-center"
          style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}
        >
          {mode === "edit" ? (
            <>
              <PencilSquareIcon className="w-5 h-5 mr-2" style={{ color: isDarkMode ? "#60A5FA" : "#2563EB" }} />
              Edit IP Address
            </>
          ) : (
            <>
              <GlobeAltIcon className="w-5 h-5 mr-2" style={{ color: isDarkMode ? "#60A5FA" : "#2563EB" }} />
              Add New IP Address
            </>
          )}
        </h3>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* IP Address */}
          <div>
            <label htmlFor="ip_address" className="block text-sm font-medium mb-1"
              style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
              IP Address <span className="text-red-500">*</span>
            </label>
            <input
              id="ip_address"
              type="text"
              name="ip_address"
              value={formData.ip_address}
              onChange={handleChange}
              placeholder="e.g., 192.168.1.100"
              disabled={!isFieldEnabled("ip_address")}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors font-mono ${getInputStyling("ip_address")}`}
            />
            {errors.ip_address ? (
              <p className="mt-1 text-xs text-red-600">{errors.ip_address}</p>
            ) : formData.ip_address && isValidIPAddress(formData.ip_address) ? (
              <p className="mt-1 text-xs text-green-600">✓ Valid IP address</p>
            ) : null}
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1"
              style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Production Server, Office Router"
              disabled={!isFieldEnabled("name")}
              maxLength={50}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors ${getInputStyling("name")}`}
            />
            <div className="flex justify-between items-center mt-1">
              <div>{errors.name && <p className="text-xs text-red-600">{errors.name}</p>}</div>
              <p className="text-xs" style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                {formData.name.length}/50
              </p>
            </div>
          </div>

          {/* Priority — edit mode only */}
          {mode === "edit" && (
            <div>
              <label htmlFor="priority" className="block text-sm font-medium mb-1"
                style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
                Priority
              </label>
              <div ref={priorityRef} className="relative w-full">
                <button
                  type="button"
                  onClick={() => setIsPriorityOpen((prev) => !prev)}
                  className={`flex items-center justify-between w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors ${
                    isDarkMode
                      ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 hover:border-gray-500"
                      : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  <span>
                    {PRIORITY_OPTIONS.find((opt) => opt.value === formData.priority)?.label || "Select priority"}
                  </span>
                  <svg
                    className={`w-4 h-4 ml-1 transition-transform duration-200 ${isPriorityOpen ? "rotate-180" : "rotate-0"}`}
                    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div className={`absolute top-full mt-1 w-full rounded-lg shadow-lg border z-50 transition-all duration-200 origin-top
                  ${isDarkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"}
                  ${isPriorityOpen
                    ? "opacity-100 scale-100 translate-y-0"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
                  }`}
                >
                  <div className="py-0.5 max-h-36 overflow-y-auto custom-scroll">
                    {PRIORITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 ${
                          formData.priority === option.value
                            ? "bg-blue-500 text-white"
                            : isDarkMode
                              ? "text-gray-200 hover:bg-gray-600"
                              : "text-gray-900 hover:bg-gray-100"
                        }`}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, priority: option.value }));
                          setIsPriorityOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className={`p-3 rounded-lg border ${
            isDarkMode ? "bg-blue-900/20 border-blue-800/30" : "bg-blue-50 border-blue-200"
          }`}>
            <p className="text-xs" style={{ color: isDarkMode ? "#93C5FD" : "#1E40AF" }}>
              <strong>Note:</strong> The IP address will be monitored for connectivity and response time.
              Make sure the IP is accessible from your network.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-3 border-t"
            style={{ borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}>

            {hasChanges && !loading && (
              <button type="button" onClick={handleReset}
                className={`inline-flex items-center px-4 py-2 font-medium rounded-lg transition-colors ${
                  isDarkMode
                    ? "text-gray-300 bg-gray-600 hover:bg-gray-500"
                    : "text-gray-700 bg-gray-200 hover:bg-gray-300"
                }`}
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Reset
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !hasChanges}
              className={`inline-flex items-center px-5 py-2 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
                isDarkMode
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:ring-offset-gray-800"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:ring-offset-2"
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === "edit" ? "Updating..." : "Adding..."}
                </>
              ) : (
                <>
                  {mode === "edit"
                    ? <><PencilSquareIcon className="w-4 h-4 mr-2" />Update IP Address</>
                    : <><PlusIcon className="w-4 h-4 mr-2" />Add IP Address</>
                  }
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


export default IPModal;