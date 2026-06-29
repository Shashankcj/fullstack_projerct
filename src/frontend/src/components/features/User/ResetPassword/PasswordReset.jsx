import React, { useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import backendApi from "../../../../api/backendAxiosInstance";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";
import GenesisLogoCard from "../GenesisLogoCard";

const PasswordReset = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = location.state?.email || "";
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  console.log("Password reset token:", token);

  // Form data state
  const [formData, setFormData] = useState({
    email: emailFromState,
    password: "",
    confirm_password: "",
  });

  // Error state
  const [errors, setErrors] = useState({});

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Touched state for confirm password
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear errors when user types - handle both frontend and backend error keys
    setErrors(prev => {
      const newErrors = { ...prev };

      if (name === 'password') {
        delete newErrors.password;
        delete newErrors[name];
      } else if (name === 'confirm_password') {
        delete newErrors.confirm_password;
      } else {
        delete newErrors[name];
      }

      return newErrors;
    });
  };

  // Password match validation
  const passwordsMatch = formData.password && formData.confirm_password &&
    formData.password === formData.confirm_password;

  const passwordsDontMatch = formData.password && formData.confirm_password &&
    formData.password !== formData.confirm_password;

  // Input styling helper - updated to handle both password field errors
  const getInputStyling = (fieldName) => {
    // For password field, check both 'password' and fieldName
    if (fieldName === 'password' && errors.password) {
      return 'border-red-500 focus:ring-red-500 focus:border-red-500';
    }

    if (errors[fieldName]) {
      return 'border-red-500 focus:ring-red-500 focus:border-red-500';
    }

    return 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500';
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    // Basic validation - only check if passwords match
    if (!formData.email) {
      setErrors({ email: 'Email is required' });
      return;
    }

    if (!formData.password) {
      setErrors({ password: 'Password is required' });
      return;
    }

    if (!formData.confirm_password) {
      setErrors({ confirm_password: 'Please re-enter your password' });
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setErrors({ confirm_password: 'Passwords must match' });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await backendApi.patch(`/password-reset/`, {
        email: formData.email,
        password: formData.password,
        confirm_password: formData.confirm_password,
      });

      console.log("Password reset response:", res);

      if (res.status === 200 || res.status === 201) {
        toast.success(res.data.message || "Password updated successfully!");
        navigate("/signin");
      }
    } catch (error) {
      console.error("Password reset error:", error);

      const errorData = error.response?.data;

      if (!errorData) {
        toast.error("Failed to reset password.");
        return;
      }

      let fieldErrors = {};

      // Handle bulk update format (same as UserProfile)
      if (errorData.failed_updates && Array.isArray(errorData.failed_updates)) {
        const failedUpdate = errorData.failed_updates[0];

        if (failedUpdate?.errors) {
          Object.keys(failedUpdate.errors).forEach(field => {
            if (Array.isArray(failedUpdate.errors[field])) {
              const errorMessage = failedUpdate.errors[field].join(' ');
              fieldErrors[field] = errorMessage;
            }
          });

          if (Object.keys(fieldErrors).length > 0) {
            console.log("Setting validation errors from bulk format:", fieldErrors);
            setErrors(fieldErrors);
            return;
          }
        }
      }

      // Handle VALIDATION_ERROR format
      if (errorData.code === "VALIDATION_ERROR" && errorData.errors) {
        Object.keys(errorData.errors).forEach(field => {
          if (Array.isArray(errorData.errors[field])) {
            fieldErrors[field] = errorData.errors[field].join(' ');
          }
        });

        if (Object.keys(fieldErrors).length > 0) {
          console.log("Setting validation errors from VALIDATION_ERROR:", fieldErrors);
          setErrors(fieldErrors);
          return;
        }
      }

      // Handle plain object errors (fallback)
      if (typeof errorData === 'object') {
        Object.keys(errorData).forEach(field => {
          if (Array.isArray(errorData[field])) {
            fieldErrors[field] = errorData[field].join(' ');
          } else if (typeof errorData[field] === 'string') {
            fieldErrors[field] = errorData[field];
          }
        });

        if (Object.keys(fieldErrors).length > 0) {
          console.log("Setting field errors (fallback):", fieldErrors);
          setErrors(fieldErrors);
          return;
        }
      }

      // Fallback generic error
      if (errorData.error) {
        toast.error(errorData.error);
      } else if (errorData.message) {
        toast.error(errorData.message);
      } else {
        toast.error("Failed to reset password.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Genesis split */}
      <div className="w-[30%] flex items-center justify-center bg-blue-700">
        <GenesisLogoCard />
      </div>

      {/* Right side - Password Reset Form */}
      <div className="w-[70%] flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {/* Title */}
          <h2 className="text-2xl font-semibold text-center text-gray-800 dark:text-gray-100 mb-2">
            Change Your Password
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Enter a new password below to change your password.
          </p>

          {/* Form */}
          <form onSubmit={onSubmit}>
            {/* Email Field */}
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email<span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                id="email"
                value={formData.email}
                onChange={handleChange}
                disabled
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 
                  dark:bg-gray-700 dark:text-white dark:border-gray-600 bg-gray-100 cursor-not-allowed 
                  ${errors.email ? "border-red-500" : "border-gray-300"}`}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* New Password */}
            <div className="mb-4">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                New Password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  id="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 
                    dark:bg-gray-700 dark:text-white ${getInputStyling('password')}`}
                  placeholder="Enter new password"
                />
                {/* 👁️ Eye Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 
                    dark:text-gray-300 hover:text-gray-700 dark:hover:text-white focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Display backend validation errors for password field */}
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Re-enter Password */}
            <div className="mb-4">
              <label
                htmlFor="confirm_password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Re-enter New Password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirm_password"
                  id="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  onBlur={() => setConfirmPasswordTouched(true)}
                  className={`w-full px-4 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 
                    dark:bg-gray-700 dark:text-white ${getInputStyling('confirm_password')}`}
                  placeholder="Confirm new password"
                />
                {/* 👁️ Eye Toggle */}
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 
                    dark:text-gray-300 hover:text-gray-700 dark:hover:text-white focus:outline-none"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Match Indicator */}
              {confirmPasswordTouched && formData.password && formData.confirm_password && (
                <p
                  className="text-xs mt-1"
                  style={{
                    color: passwordsMatch ? "#10B981" : "#EF4444",
                  }}
                >
                  {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                </p>
              )}

              {errors.confirm_password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.confirm_password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !passwordsMatch}
              className={`w-full bg-[#6366f1] hover:bg-[#6366f1]/80 text-white font-semibold py-3 rounded-md transition-colors 
                ${isSubmitting || !passwordsMatch ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordReset;
