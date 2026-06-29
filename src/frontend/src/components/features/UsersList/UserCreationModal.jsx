import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  XMarkIcon,
  UserPlusIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { ChevronDown } from 'lucide-react';
import { useCreateUserMutation } from '../../../redux/userApiSlice';
import { useGetRolesQuery } from '../../../redux/roleApiSlice';

// Role Dropdown Component for Creation Modal
const CreateRoleDropdown = ({ roleChoices, selectedRole, setSelectedRole, isDarkMode, disabled = false, isLoading = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!disabled && !isLoading) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (value) => {
    setSelectedRole(value);
    setIsOpen(false);
  };

  const getSelectedLabel = () => {
    const selectedOption = roleChoices.find(r => r.value === selectedRole);
    return selectedOption ? selectedOption.label : 'Select Role';
  };

  const getDropdownStyling = () => {
    if (disabled || isLoading) {
      return isDarkMode
        ? 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed';
    }

    return isDarkMode
      ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-650 hover:border-gray-500'
      : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400';
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || isLoading}
        className={`flex items-center justify-between w-full px-3 py-1.5 text-sm border rounded-lg cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-blue-500 ${getDropdownStyling()}
          ${isOpen ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
        `}
      >
        <span className={selectedRole ? '' : 'text-gray-500 dark:text-gray-400'}>
          {isLoading ? 'Loading roles...' : getSelectedLabel()}
        </span>
        <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'} ${disabled || isLoading ? 'opacity-50' : ''}`} />
      </button>

      <div
        className={`absolute top-full mt-1 w-full rounded-lg shadow-lg border z-50 transition-all duration-200 origin-top
          ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}
          ${isOpen && !disabled && !isLoading
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          }
        `}
      >
        <div className="py-0.5 max-h-36 overflow-y-auto custom-scroll">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Loading roles...</div>
          ) : roleChoices.length > 0 ? (
            roleChoices.map((role) => (
              <button
                key={role.value}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150
                  ${selectedRole === role.value
                    ? 'bg-blue-500 text-white'
                    : isDarkMode
                      ? 'text-gray-200 hover:bg-gray-600'
                      : 'text-gray-900 hover:bg-gray-100'
                  }`}
                onClick={() => handleSelect(role.value)}
              >
                {role.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No roles available</div>
          )}
        </div>
      </div>
    </div>
  );
};


const UserCreationModal = ({ userId, show, onHide, onUserCreated, isDarkMode = false }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    role: '',
  });

  // EMAIL VERIFICATION CHECKBOX STATE
  const [emailOverrideEnabled, setEmailOverrideEnabled] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  // Fetch roles from backend
  const { data: rolesData = [], isLoading: rolesLoading, error: rolesError } = useGetRolesQuery();

  const [createUser, { isLoading }] = useCreateUserMutation();

  // Transform roles data to match dropdown format
  const roleChoices = React.useMemo(() => {
    if (!Array.isArray(rolesData) || rolesData.length === 0) {
      return [];
    }

    return rolesData.map(role => ({
      value: role.uuid,
      label: role.role_name || role.name || 'Unknown Role'
    }));
  }, [rolesData]);

  const isFieldEnabled = (fieldName) => {
    switch (fieldName) {
      case 'username':
        return true;
      case 'email':
        return formData.username.trim() !== '';
      case 'password':
        return formData.username.trim() !== '' &&
          formData.email.trim() !== '' &&
          /\S+@\S+\.\S+/.test(formData.email);
      case 'confirm_password':
        return formData.username.trim() !== '' &&
          formData.email.trim() !== '' &&
          formData.password !== '';
      case 'role':
        return formData.username.trim() !== '' &&
          formData.email.trim() !== '' &&
          formData.password !== '' &&
          formData.confirm_password !== '' &&
          formData.password === formData.confirm_password;
      default:
        return true;
    }
  };

  const passwordsMatch = formData.password && formData.confirm_password &&
    formData.password === formData.confirm_password;

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (!isFieldEnabled(name)) return;

    setFormData({
      ...formData,
      [name]: value,
    });

    if (name === 'confirm_password' && !confirmPasswordTouched) {
      setConfirmPasswordTouched(true);
    }

    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }
  };

  const handleRoleChange = (value) => {
    setFormData({
      ...formData,
      role: value,
    });

    if (errors.role) {
      setErrors({
        ...errors,
        role: '',
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (!formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    } else if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

 const handleBackendError = (error) => {
  let fieldErrors = {};

  if (error?.data) {
    const errorData = error.data;

    if (errorData.code === "VALIDATION_ERROR" && errorData.errors) {
      Object.keys(errorData.errors).forEach(field => {
        if (Array.isArray(errorData.errors[field])) {
          fieldErrors[field] = errorData.errors[field].join(' ');
        }
      });

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(prev => ({ ...prev, ...fieldErrors }));
        return;
      }
    }

    // Handle other error formats
    if (typeof errorData === 'object' && !errorData.code) {
      Object.keys(errorData).forEach(field => {
        if (Array.isArray(errorData[field])) {
          fieldErrors[field] = errorData[field].join(' ');
        } else if (typeof errorData[field] === 'string') {
          fieldErrors[field] = errorData[field];
        }
      });

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(prev => ({ ...prev, ...fieldErrors }));
        return;
      }
    }
  }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const userData = {
      username: formData.username,
      email: formData.email,
      password: formData.password,
      confirm_password: formData.confirm_password,
      role: formData.role,
      is_email_override: emailOverrideEnabled,
    };

    setLoading(true);

    try {
      const res = await createUser(userData).unwrap();

      // Extract backend data safely
      const createdUsername = res?.user?.username ?? userData.username;
      const createdEmail = res?.user?.email ?? userData.email;
      const createdRole = res?.user?.role?.role_name ?? "Unknown Role";

      setLoading(false);
      handleReset();
      onUserCreated();
      onHide();

      setTimeout(() => {
        toast.success(
          `User "${createdUsername}" created successfully with role "${createdRole}"!`,
          {
            position: "top-right",
            autoClose: 4000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );
      }, 300);

    } catch (error) {
      console.error('User creation error:', error);
      setLoading(false);
      handleBackendError(error);
    }
  };

  const handleReset = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      confirm_password: '',
      role: '',
    });
    setEmailOverrideEnabled(false);
    setErrors({});
    setConfirmPasswordTouched(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setLoading(false);
  };

  const handleClose = () => {
    handleReset();
    onHide();
  };

  const getInputStyling = (fieldName) => {
    const isEnabled = isFieldEnabled(fieldName);

    if (!isEnabled) {
      return isDarkMode
        ? 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed';
    }

    if (errors[fieldName]) {
      return isDarkMode
        ? 'border-red-500 bg-gray-600 text-gray-300 placeholder-gray-400 focus:border-red-500 focus:ring-red-500'
        : 'border-red-500 bg-gray-100 text-gray-700 placeholder-gray-500 focus:border-red-500 focus:ring-red-500';
    }

    return isDarkMode
      ? 'border-gray-600 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500'
      : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900 focus:ring-blue-500';
  };

  const getPasswordInputStyling = () => {
    const isEnabled = isFieldEnabled('password');

    if (!isEnabled) {
      return isDarkMode
        ? 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed';
    }

    if (errors.password) {
      return isDarkMode
        ? 'border-red-500 bg-gray-600 text-gray-300 placeholder-gray-400 focus:border-red-500 focus:ring-red-500'
        : 'border-red-500 bg-gray-100 text-gray-700 placeholder-gray-500 focus:border-red-500 focus:ring-red-500';
    }

    return isDarkMode
      ? 'border-gray-600 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500'
      : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900 focus:ring-blue-500';
  };

  const getConfirmPasswordInputStyling = () => {
    const isEnabled = isFieldEnabled('confirm_password');

    if (!isEnabled) {
      return isDarkMode
        ? 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed';
    }

    if (errors.confirm_password) {
      return isDarkMode
        ? 'border-red-500 bg-gray-600 text-gray-300 placeholder-gray-400 focus:border-red-500 focus:ring-red-500'
        : 'border-red-500 bg-gray-100 text-gray-700 placeholder-gray-500 focus:border-red-500 focus:ring-red-500';
    }

    if (confirmPasswordTouched && formData.confirm_password) {
      if (passwordsMatch) {
        return isDarkMode
          ? 'border-green-500 bg-gray-700 text-white focus:border-green-500 focus:ring-green-500'
          : 'border-green-500 bg-white text-gray-900 focus:border-green-500 focus:ring-green-500';
      } else {
        return isDarkMode
          ? 'border-red-500 bg-gray-600 text-gray-300 placeholder-gray-400 focus:border-red-500 focus:ring-red-500'
          : 'border-red-500 bg-gray-100 text-gray-700 placeholder-gray-500 focus:border-red-500 focus:ring-red-500';
      }
    }

    return isDarkMode
      ? 'border-gray-600 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500'
      : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900 focus:ring-blue-500';
  };

  const hasFormData = () => {
    return formData.username || formData.email || formData.password || formData.confirm_password || formData.role;
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
      onClick={handleClose}
    >
      <div
        className="rounded-xl p-6 max-w-2xl w-full relative shadow-2xl border mx-4"
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
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <h3
          className="text-xl font-semibold mb-5 flex items-center"
          style={{ color: isDarkMode ? '#F1F5F9' : '#1E293B' }}
        >
          <UserPlusIcon
            className="w-5 h-5 mr-2"
            style={{ color: isDarkMode ? '#60A5FA' : '#2563EB' }}
          />
          Create New User
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium mb-1"
                style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
              >
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username"
                disabled={!isFieldEnabled('username')}
                className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 transition-colors ${getInputStyling('username')}`}
              />
              {errors.username && (
                <p className="mt-0.5 text-xs text-red-600">{errors.username}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1"
                style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
              >
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
                disabled={!isFieldEnabled('email')}
                className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 transition-colors ${getInputStyling('email')}`}
              />
              {errors.email && (
                <p className="mt-0.5 text-xs text-red-600">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1"
                style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  disabled={!isFieldEnabled('password')}
                  className={`w-full px-3 py-1.5 pr-10 border rounded-lg focus:ring-2 transition-colors ${getPasswordInputStyling()}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!isFieldEnabled('password')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeSlashIcon
                      className="h-4 w-4"
                      style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                    />
                  ) : (
                    <EyeIcon
                      className="h-4 w-4"
                      style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                    />
                  )}
                </button>
              </div>

              {errors.password && (
                <p className="mt-0.5 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirm_password"
                className="block text-sm font-medium mb-1"
                style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  onBlur={() => setConfirmPasswordTouched(true)}
                  placeholder="Confirm password"
                  disabled={!isFieldEnabled('confirm_password')}
                  className={`w-full px-3 py-1.5 pr-10 border rounded-lg focus:ring-2 transition-colors ${getConfirmPasswordInputStyling()}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={!isFieldEnabled('confirm_password')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center disabled:opacity-50"
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon
                      className="h-4 w-4"
                      style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                    />
                  ) : (
                    <EyeIcon
                      className="h-4 w-4"
                      style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                    />
                  )}
                </button>
              </div>

              {confirmPasswordTouched && formData.confirm_password && (
                <div className="mt-0.5">
                  {passwordsMatch ? (
                    <p className="text-xs text-green-600">
                      ✓ Passwords match
                    </p>
                  ) : (
                    <p className="text-xs text-red-600">
                      ❌ Passwords don't match
                    </p>
                  )}
                </div>
              )}

              {errors.confirm_password && (
                <p className="mt-0.5 text-xs text-red-600">{errors.confirm_password}</p>
              )}
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label
              htmlFor="role"
              className="block text_sm font-medium mb-1"
              style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
            >
              User Role
            </label>

            <CreateRoleDropdown
              roleChoices={roleChoices}
              selectedRole={formData.role}
              setSelectedRole={handleRoleChange}
              isDarkMode={isDarkMode}
              disabled={!isFieldEnabled('role')}
              isLoading={rolesLoading}
            />

            {rolesError && (
              <p className="mt-0.5 text-xs text-red-600">
                Error loading roles. Please try again.
              </p>
            )}

            {errors.role && (
              <p className="mt-0.5 text-xs text-red-600">{errors.role}</p>
            )}
          </div>

          {/*EMAIL VERIFICATION CHECKBOX */}
          <div className={`p-3 rounded-lg border ${isDarkMode
            ? 'bg-gray-700/50 border-gray-600'
            : 'bg-gray-50 border-gray-200'
            }`}>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="email_override"
                checked={emailOverrideEnabled}
                onChange={(e) => setEmailOverrideEnabled(e.target.checked)}
                className={`w-4 h-4 rounded border transition-colors cursor-pointer ${isDarkMode
                  ? 'border-gray-500 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-700'
                  : 'border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-white'
                  }`}
              />
              <label
                htmlFor="email_override"
                className="ml-2 text-sm font-medium cursor-pointer"
                style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
              >
                Override email verification
              </label>
            </div>
            <p
              className="mt-1 ml-6 text-xs"
              style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
            >
              If enabled, the user can access their account without needing to verify their email address.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
            {hasFormData() && !(isLoading || loading) && (
              <button
                type="button"
                onClick={handleReset}
                className={`inline-flex items-center px-4 py-1.5 font-medium rounded-lg transition-colors ${isDarkMode
                  ? 'text-gray-300 bg-gray-600 hover:bg-gray-500'
                  : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                  }`}
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Reset
              </button>
            )}

            <button
  type="submit"
  disabled={isLoading || loading || rolesLoading}
  className={`inline-flex items-center px-5 py-1.5 font-medium rounded-lg
    bg-[#6366F1] hover:bg-[#5558e6] text-white
    focus:outline-none focus:ring-2 focus:ring-[#6366F1]/40
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors
    ${
      isDarkMode
        ? "focus:ring-offset-gray-800"
        : "focus:ring-offset-2"
    }`}
>
  {(isLoading || loading) ? (
    <>
      <svg
        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 914 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      Creating...
    </>
  ) : (
    <>
      <UserPlusIcon className="w-4 h-4 mr-2" />
      Create User
    </>
  )}
</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserCreationModal;
