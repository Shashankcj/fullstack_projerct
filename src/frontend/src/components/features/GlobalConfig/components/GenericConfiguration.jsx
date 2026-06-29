import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useSelector } from 'react-redux';
import {
  useGetGlobalConfigQuery,
  useSaveGlobalConfigMutation,
  useTestGlobalConfigMutation,
  useSaveLicenseConfigMutation,
} from '../../../../redux/globalApiSlice';
import RenderIfAllowed from '../../../shared/RenderIfAllowed';
import TestConfigModal from './TestConfigModal';
import { useAuth } from '../../../../Contexts/AuthContext';

const GenericConfiguration = ({
  isDarkMode,
  configType,
  sections,
}) => {
  const { data: existingConfig, isLoading: isLoadingConfig, isError } =
    useGetGlobalConfigQuery();

    console.log(existingConfig);
    

  const [saveGlobalConfig, { isLoading: isSavingGlobal }] =
    useSaveGlobalConfigMutation();
  const [saveLicenseConfig, { isLoading: isSavingLicense }] =
    useSaveLicenseConfigMutation();
  const [testSmtpConfig, { isLoading: isTesting }] =
    useTestGlobalConfigMutation();

  const saveConfig =
    configType === 'license' ? saveLicenseConfig : saveGlobalConfig;
  const isSaving =
    configType === 'license' ? isSavingLicense : isSavingGlobal;

  const hasLicenseDetails = useMemo(() => {
    if (configType !== 'license') return false;

    const licenseKeys = [
      'license.key',
      'license.name',
      'license.email',
      'license.organization',
    ];
    return licenseKeys.some((key) => existingConfig?.[key]);
  }, [configType, existingConfig]);

  const saveButtonLabel =
    configType === 'license'
      ? hasLicenseDetails
        ? 'Update Configuration'
        : 'Save Configuration'
      : 'Save Configuration';

  const { user } = useAuth();
  const permissions = useSelector(
    (state) => state.userModPerm?.global_configuration
  );
  const hasUpdatePermission = permissions?.update || false;

  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState({});
  const [dropdownStates, setDropdownStates] = useState({});
  const [showTestModal, setShowTestModal] = useState(false);
  const [isPasswordModified, setIsPasswordModified] = useState({});

  const dropdownRefs = useRef({});

  // Initialize form data from sections
  useEffect(() => {
    const initialData = {};
    const initialPasswords = {};
    const initialDropdowns = {};
    const initialPasswordModified = {};

    sections.forEach((section) => {
      section.fields.forEach((field) => {
        // default to empty string or false for toggles
        initialData[field.key] =
          field.type === 'toggle' || field.type === 'checkbox'
            ? false
            : '';
        if (field.type === 'password') {
          initialPasswords[field.key] = false;
          initialPasswordModified[field.key] = false;
        }
        if (field.type === 'dropdown') {
          initialDropdowns[field.key] = false;
        }
      });
    });

    setFormData(initialData);
    setOriginalData(initialData);
    setShowPassword(initialPasswords);
    setDropdownStates(initialDropdowns);
    setIsPasswordModified(initialPasswordModified);
  }, [sections]);

  // Populate form with fetched data
  useEffect(() => {
    if (!existingConfig) return;
    if (!sections || sections.length === 0) return;

    try {
      const updatedData = {};

      sections.forEach((section) => {
        section.fields.forEach((field) => {
          const value = existingConfig[field.apiKey];

          if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
              updatedData[field.key] = value.join(', ');
            } else if (
              field.type === 'dropdown' &&
              field.transform === 'uppercase'
            ) {
              updatedData[field.key] = String(value).toLowerCase();
            } else if (field.type === 'toggle' || field.type === 'checkbox') {
              // Convert string to boolean
              updatedData[field.key] = String(value).toLowerCase() === 'true';
            } else {
              updatedData[field.key] = String(value);
            }
          }
        });
      });

      if (Object.keys(updatedData).length > 0) {
        setFormData((prev) => ({ ...prev, ...updatedData }));
        setOriginalData((prev) => ({ ...prev, ...updatedData }));
      }

      const resetPasswordFlags = {};
      sections.forEach((section) => {
        section.fields.forEach((field) => {
          if (field.type === 'password') {
            resetPasswordFlags[field.key] = false;
          }
        });
      });
      setIsPasswordModified(resetPasswordFlags);
    } catch (error) {
      toast.error('Failed to load configuration');
    }
  }, [existingConfig, sections, configType]);


  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(dropdownRefs.current).forEach((key) => {
        if (
          dropdownRefs.current[key] &&
          !dropdownRefs.current[key].contains(event.target)
        ) {
          setDropdownStates((prev) => ({ ...prev, [key]: false }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (key, value, fieldType) => {
    if (!hasUpdatePermission) return;

    if (fieldType === 'password') {
      setIsPasswordModified((prev) => ({ ...prev, [key]: true }));
    }

    // store toggle/checkbox as boolean
    const finalValue =
      fieldType === 'toggle' || fieldType === 'checkbox'
        ? Boolean(value)
        : value;

    setFormData((prev) => ({ ...prev, [key]: finalValue }));

    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const parseEmailString = (emailString) => {
    if (Array.isArray(emailString)) {
      return emailString.filter((email) => email && email.trim().length > 0);
    }
    if (typeof emailString === 'string' && emailString.trim()) {
      return emailString
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0);
    }
    return [];
  };

  const validateFields = () => {
    const newErrors = {};
    let isValid = true;

    sections.forEach((section) => {
      section.fields.forEach((field) => {
        const value = formData[field.key];

        if (field.type === 'password') {
          if (
            (isPasswordModified[field.key] ||
              !existingConfig?.[field.apiKey]) &&
            field.required &&
            (!value || value.trim() === '')
          ) {
            newErrors[field.key] = `${field.label} is required`;
            isValid = false;
            return;
          }
        } else if (field.required && (!value || value.trim() === '')) {
          newErrors[field.key] = `${field.label} is required`;
          isValid = false;
          return;
        }

        if (!value || (typeof value === 'string' && value.trim() === '')) return;

        switch (field.validation) {
          case 'email':
            if (!validateEmail(value)) {
              newErrors[field.key] = 'Invalid email format';
              isValid = false;
            }
            break;

          case 'emails': {
            const emails = parseEmailString(value);
            const invalidEmails = emails.filter((email) => !validateEmail(email));
            if (invalidEmails.length > 0) {
              newErrors[field.key] = `Invalid email(s): ${invalidEmails.join(
                ', '
              )}`;
              isValid = false;
            }
            break;
          }

          case 'number':
            if (isNaN(value) || isNaN(parseFloat(value))) {
              newErrors[field.key] = 'Must be a valid number';
              isValid = false;
            } else if (!Number.isInteger(Number(value))) {
              newErrors[field.key] = 'Must be a whole number';
              isValid = false;
            } else {
              const numValue = parseInt(value, 10);
              if (field.min !== undefined && numValue < field.min) {
                newErrors[field.key] = `Must be at least ${field.min}`;
                isValid = false;
              }
              if (field.max !== undefined && numValue > field.max) {
                newErrors[field.key] = `Must not exceed ${field.max}`;
                isValid = false;
              }
            }
            break;

          case 'port':
            if (
              isNaN(value) ||
              parseInt(value, 10) <= 0 ||
              parseInt(value, 10) > 65535
            ) {
              newErrors[field.key] = 'Must be a valid port number (1-65535)';
              isValid = false;
            }
            break;

          default:
            break;
        }
      });
    });

    setErrors(newErrors);
    return isValid;
  };

  const hasValueChanged = (field, currentValue, originalValue) => {
    if (field.type === 'password') {
      return isPasswordModified[field.key];
    }

    // handle toggle/checkbox as boolean
    if (field.type === 'toggle' || field.type === 'checkbox') {
      const currentBool = !!currentValue;
      const originalBool = !!originalValue;
      return currentBool !== originalBool;
    }

    const current = currentValue || '';
    const original = originalValue || '';

    if (field.validation === 'emails') {
      const currentEmails = parseEmailString(current).sort().join(',');
      const originalEmails = parseEmailString(original).sort().join(',');
      return currentEmails !== originalEmails;
    }

    if (field.validation === 'number' || field.validation === 'port') {
      return parseInt(current, 10) !== parseInt(original, 10);
    }

    if (field.transform === 'uppercase') {
      return current.toUpperCase() !== original.toUpperCase();
    }

    return current.trim() !== original.trim();
  };



  const handleSave = async () => {
    if (!hasUpdatePermission) return;

    if (!validateFields()) {
      toast.error('Please fix the validation errors before saving');
      return;
    }

    try {
      const payload = {};
      let changedFieldsCount = 0;

      sections.forEach((section) => {
        section.fields.forEach((field) => {
          const currentValue = formData[field.key];
          const originalValue = originalData[field.key];

          if (hasValueChanged(field, currentValue, originalValue)) {
            changedFieldsCount++;

            if (field.key === 'enableEmailAlerts') {
              payload[field.apiKey] = !!currentValue; // always boolean
            }
            // support_email → string, not array
            else if (field.key === 'support_email') {
              let clean = String(currentValue).trim();

              if (clean.startsWith('[')) clean = clean.slice(1);
              if (clean.endsWith(']')) clean = clean.slice(0, -1);
              if (clean.startsWith("'")) clean = clean.slice(1);
              if (clean.endsWith("'")) clean = clean.slice(0, -1);
              if (clean.startsWith('"')) clean = clean.slice(1);
              if (clean.endsWith('"')) clean = clean.slice(0, -1);

              payload[field.apiKey] = clean;
            }
            // other email fields (toEmails, ccEmails) → array
            else if (field.validation === 'emails') {
              payload[field.apiKey] = parseEmailString(currentValue);
            } else if (field.validation === 'number' || field.validation === 'port') {
              payload[field.apiKey] = parseInt(currentValue, 10);
            } else if (field.transform === 'uppercase') {
              payload[field.apiKey] = currentValue.toUpperCase();
            } else {
              payload[field.apiKey] = currentValue;
            }
          }
        });
      });

      if (changedFieldsCount === 0) {
        toast.info('No changes detected');
        return;
      }

      // Determine if this is an update
      let isUpdate = false;

      if (configType === 'license') {
        // Check if ANY license field has existing value in originalData
        isUpdate = sections.some((section) =>
          section.fields.some((field) => {
            const origValue = originalData[field.key];
            return origValue && origValue.toString().trim() !== '';
          })
        );
      } else {
        // For global config
        isUpdate = !!existingConfig && Object.keys(existingConfig).length > 0;
      }
      // Pass _isUpdate flag for license, clean payload for global config
      const apiPayload = configType === 'license'
        ? { ...payload, _isUpdate: isUpdate }
        : payload;

      const response = await saveConfig(apiPayload).unwrap();

      toast.success(
        response?.message ||
        (isUpdate
          ? 'Configuration updated successfully'
          : 'Configuration saved successfully')
      );

      // Update original data after successful save
      setOriginalData({ ...formData });

      // Reset password modification flags
      const resetPasswordFlags = {};
      sections.forEach((section) => {
        section.fields.forEach((field) => {
          if (field.type === 'password') {
            resetPasswordFlags[field.key] = false;
          }
        });
      });
      setIsPasswordModified(resetPasswordFlags);
    } catch (error) {
      if (error?.status === 409) {
        toast.error('License already exists. Please refresh and try again.');
      } else if (error?.data?.errors && Array.isArray(error.data.errors)) {
        const errorMessages = error.data.errors
          .map((err) => err.error)
          .join(', ');
        toast.error(errorMessages);

        const backendErrors = {};
        error.data.errors.forEach((err) => {
          if (err.key) {
            sections.forEach((section) => {
              section.fields.forEach((field) => {
                if (field.apiKey === err.key) {
                  backendErrors[field.key] = err.error;
                }
              });
            });
          }
        });
        setErrors((prev) => ({ ...prev, ...backendErrors }));
      } else {
        toast.error(error?.data?.message || 'Failed to save configuration');
      }
    }
  };

  const handleSendTestEmail = async ({ type, email }) => {
    let payload = { type };

    switch (type) {
      case 'specific_email': {
        const emailList = parseEmailString(email);
        if (emailList.length === 0) {
          toast.error('Please enter valid email(s)');
          return;
        }
        payload.test_email = emailList;
        break;
      }

      case 'alert_config': {
        const toEmailsValue = formData.toEmails;

        if (!toEmailsValue?.trim()) {
          toast.error('Please configure the "To Email" before testing');
          return;
        }
        payload.test_email = parseEmailString(toEmailsValue);
        break;
      }

      case 'logged_user':
        if (user?.email) {
          payload.test_email = [user.email];
        }
        break;

      default:
        toast.error('Invalid email test type');
        return;
    }

    try {
      const response = await testSmtpConfig(payload).unwrap();
      toast.success(response?.message);
      setShowTestModal(false);
    } catch (error) {
      toast.error(error?.data?.message);
    }
  };

  const renderField = (field) => {
    const value = formData[field.key];
    const hasError = errors[field.key];
    const isReadOnlyField = !!field.readOnly;

    const inputClasses = `w-full px-3 py-2 rounded-lg border ${hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-0 focus:ring-offset-0'
      : isDarkMode
        ? 'border-gray-600 focus:border-blue-500 focus:ring-0 focus:ring-offset-0'
        : 'border-gray-300 focus:border-blue-500 focus:ring-0 focus:ring-offset-0'
      } ${isDarkMode
        ? 'bg-gray-700 text-white placeholder-gray-400'
        : 'bg-white text-gray-900 placeholder-gray-400'
      } focus:outline-none focus:ring-0 focus:ring-offset-0 ${!hasUpdatePermission && !isReadOnlyField ? 'opacity-60 cursor-not-allowed' : ''
      }`;


    const labelClasses = `block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
      }`;

    const errorClasses = 'text-xs mt-1 text-red-500';
    const helpTextClasses = `text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
      }`;

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.key}>
            <label className={labelClasses}>{field.label}</label>
            <textarea
              value={value}
              onChange={(e) =>
                !isReadOnlyField &&
                handleChange(field.key, e.target.value, field.type)
              }
              className={`${inputClasses} resize-none`}
              placeholder={field.placeholder}
              rows={field.rows || 2}
              readOnly={isReadOnlyField}
              disabled={!hasUpdatePermission && !isReadOnlyField}
            />
            {hasError ? (
              <p className={errorClasses}>{hasError}</p>
            ) : field.helpText ? (
              <p className={helpTextClasses}>{field.helpText}</p>
            ) : null}
          </div>
        );

      case 'text':
      case 'email':
        return (
          <div key={field.key}>
            <label className={labelClasses}>{field.label}</label>
            <input
              type={field.type}
              value={value}
              onChange={(e) =>
                !isReadOnlyField &&
                handleChange(field.key, e.target.value, field.type)
              }
              className={inputClasses}
              placeholder={field.placeholder}
              readOnly={isReadOnlyField}
              disabled={!hasUpdatePermission && !isReadOnlyField}
            />
            {hasError ? (
              <p className={errorClasses}>{hasError}</p>
            ) : field.helpText ? (
              <p className={helpTextClasses}>{field.helpText}</p>
            ) : null}
          </div>
        );

      case 'password':
        return (
          <div key={field.key}>
            <label className={labelClasses}>{field.label}</label>
            <div className="relative">
              <input
                type={showPassword[field.key] ? 'text' : 'password'}
                value={value}
                onChange={(e) =>
                  !isReadOnlyField &&
                  handleChange(field.key, e.target.value, field.type)
                }
                className={`${inputClasses} pr-10`}
                placeholder={field.placeholder}
                readOnly={isReadOnlyField}
                disabled={!hasUpdatePermission && !isReadOnlyField}
              />
              {!isReadOnlyField && (
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      [field.key]: !prev[field.key],
                    }))
                  }
                  disabled={!hasUpdatePermission}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword[field.key] ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
            {hasError ? (
              <p className={errorClasses}>{hasError}</p>
            ) : isPasswordModified[field.key] ? (
              <p
                className={`text-xs mt-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                  }`}
              >
                Password will be updated when you save
              </p>
            ) : field.helpText ? (
              <p className={helpTextClasses}>{field.helpText}</p>
            ) : null}
          </div>
        );

      case 'number':
        return (
          <div key={field.key}>
            <label className={labelClasses}>{field.label}</label>
            <input
              type="number"
              value={value}
              onChange={(e) =>
                !isReadOnlyField &&
                handleChange(field.key, e.target.value, field.type)
              }
              className={inputClasses}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              readOnly={isReadOnlyField}
              disabled={!hasUpdatePermission && !isReadOnlyField}
            />
            {hasError ? (
              <p className={errorClasses}>{hasError}</p>
            ) : field.helpText ? (
              <p className={helpTextClasses}>{field.helpText}</p>
            ) : null}
          </div>
        );
  

      case 'dropdown': {
        const selectedOption =
          field.options.find((opt) => opt.value === value) || field.options[0];

        return (
          <div key={field.key}>
            <label className={labelClasses}>{field.label}</label>
            <div
              className="relative"
              ref={(el) => (dropdownRefs.current[field.key] = el)}
            >
              <button
                type="button"
                onClick={() =>
                  hasUpdatePermission &&
                  !isReadOnlyField &&
                  setDropdownStates((prev) => ({
                    ...prev,
                    [field.key]: !prev[field.key],
                  }))
                }
                disabled={!hasUpdatePermission || isReadOnlyField}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border transition-all duration-200 ${hasError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : isDarkMode
                    ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-650 hover:border-gray-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  } ${dropdownStates[field.key]
                    ? 'ring-2 ring-blue-500 ring-opacity-50'
                    : ''
                  } ${!value
                    ? isDarkMode
                      ? 'text-gray-400'
                      : 'text-gray-500'
                    : ''
                  } ${!hasUpdatePermission || isReadOnlyField
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:shadow-md'
                  }`}
              >
                <span className="text-sm">{selectedOption.label}</span>
                <ChevronDown
                  className={`w-4 h-4 ml-2 transition-transform duration-200 ${dropdownStates[field.key] ? 'rotate-180' : 'rotate-0'
                    }`}
                />
              </button>

              {hasUpdatePermission && !isReadOnlyField && (
                <div
                  className={`absolute left-0 right-0 top-full mt-1 rounded-lg shadow-lg border z-50 transition-all duration-200 origin-top ${isDarkMode
                    ? 'bg-gray-700 border-gray-600'
                    : 'bg-white border-gray-200'
                    } ${dropdownStates[field.key]
                      ? 'opacity-100 scale-100 translate-y-0'
                      : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                    }`}
                >
                  <div className="py-1 max-h-48 overflow-y-auto">
                    {field.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          handleChange(
                            field.key,
                            option.value,
                            field.type
                          );
                          setDropdownStates((prev) => ({
                            ...prev,
                            [field.key]: false,
                          }));
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 ${value === option.value
                          ? 'bg-[#6366f1] text-white'
                          : isDarkMode
                            ? 'text-gray-200 hover:bg-gray-600'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {hasError ? (
              <p className={errorClasses}>{hasError}</p>
            ) : field.helpText ? (
              <p className={helpTextClasses}>{field.helpText}</p>
            ) : null}
          </div>
        );
      }

      case 'toggle':
      case 'checkbox': {
        const isChecked = value === true;

        return (
          <div key={field.key} className="flex items-center gap-3">
            <label
              className={`inline-flex items-center cursor-pointer ${!hasUpdatePermission ? 'opacity-60 cursor-not-allowed' : ''
                }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) =>
                  !isReadOnlyField &&
                  handleChange(field.key, e.target.checked, field.type)
                }
                disabled={!hasUpdatePermission || isReadOnlyField}
                className="sr-only"
              />
              <div
                className={`relative w-10 h-5 rounded-full transition-colors ${isChecked
                  ? 'bg-blue-500'
                  : isDarkMode
                    ? 'bg-gray-600'
                    : 'bg-gray-300'
                  }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${isChecked ? 'translate-x-5' : ''
                    }`}
                />
              </div>
            </label>
            <span
              className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
            >
              {field.label}
            </span>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span
          className={`ml-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}
        >
          Loading configuration...
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={`p-4 rounded-lg ${isDarkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
          }`}
      >
        <p className="font-medium">Failed to load configuration</p>
        <p className="text-sm mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  const hasTestButton = configType === 'smtp';

  return (
    <>
      <div className="space-y-4">
        {(() => {
  const leftSection  = sections.find((s) => s.splitLayout === 'left');
  const rightSection = sections.find((s) => s.splitLayout === 'right');
  const normalSections = sections.filter((s) => !s.splitLayout);

  return (
    <>
      {/* ── Split row: Critical (left) | divider | Warning (right) ── */}
      {leftSection && rightSection && (
        <div className="flex gap-0">

          {/* Left — Critical */}
<div className="flex-1 pr-4 space-y-3">
  <div>
    <h2 className={`text-xs font-semibold uppercase tracking-wide ${
      isDarkMode ? 'text-red-400' : 'text-red-600'
    }`}>
      {leftSection.title}
    </h2>
    {/* ✅ Section note */}
    {leftSection.note && (
      <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        {leftSection.note}
      </p>
    )}
  </div>
  <div className={`grid grid-cols-1 ${leftSection.columns || 'md:grid-cols-2'} gap-3`}>
    {leftSection.fields.map((field) => renderField(field))}
  </div>
</div>

{/* Vertical divider */}
<div className={`w-px self-stretch ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />

{/* Right — Warning */}
<div className="flex-1 pl-4 space-y-3">
  <div>
    <h2 className={`text-xs font-semibold uppercase tracking-wide ${
      isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
    }`}>
      {rightSection.title}
    </h2>

    {/* ✅ Dynamic warning note */}
    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
      {(() => {
        const warnCpu  = formData['cpuWarningThreshold'];
        const critCpu  = formData['cpuThreshold'];

        // If both values are set, show dynamic message
        if (warnCpu && critCpu) {
          return `Warning alerts fire when metrics exceed the warning threshold (e.g. CPU: above ${warnCpu}% and below ${critCpu}%).`;
        }

        // Fallback static note
        return 'Warning alerts fire when metrics exceed the warning value but stay below the critical threshold.';
      })()}
    </p>
  </div>

  <div className={`grid grid-cols-1 ${rightSection.columns || 'md:grid-cols-2'} gap-3`}>
    {rightSection.fields.map((field) => renderField(field))}
  </div>
</div>

        </div>
      )}

      {/* ── Normal sections (Alert & Ping etc.) stacked below ── */}
      {normalSections.map((section, idx) => (
        <React.Fragment key={idx}>

          {/* Separator before every normal section */}
          <div className={`border-t ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`} />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {section.title && (
                <h2 className={`text-lg font-semibold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {section.title}
                </h2>
              )}
              {/* Keep existing toggle-in-header logic */}
              {section.title === 'Alert Configuration' &&
                section.fields.some((f) => f.key === 'enableEmailAlerts') && (
                  <div className="shrink-0">
                    {renderField(section.fields.find((f) => f.key === 'enableEmailAlerts'))}
                  </div>
                )}
            </div>
            <div className={`grid grid-cols-1 ${section.columns || 'md:grid-cols-2'} gap-4`}>
              {section.fields
                .filter((field) => field.key !== 'enableEmailAlerts')
                .map((field) => renderField(field))}
            </div>
          </div>

        </React.Fragment>
      ))}
    </>
  );
})()}

        <RenderIfAllowed module="global_configuration" action="update">
          <div className="flex justify-end gap-4 pt-4">
            {hasTestButton && (
              <button
  onClick={() => setShowTestModal(true)}
  disabled={isTesting}
  className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors
    bg-[#6366F1] hover:bg-[#6366F1]/80 text-white
    disabled:opacity-50 disabled:cursor-not-allowed`}
>
  {isTesting ? "Testing..." : "Test Configuration"}
</button>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${isDarkMode
                ? 'bg-[#6366F1] hover:bg-[#6366F1]/80 text-white'
                : 'bg-[#6366F1] hover:bg-[#6366F1]/80 text-white'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSaving ? 'Saving...' : saveButtonLabel}
            </button>
          </div>
        </RenderIfAllowed>
      </div>

      {hasTestButton && (
        <TestConfigModal
          show={showTestModal}
          onHide={() => setShowTestModal(false)}
          onSend={handleSendTestEmail}
          isDarkMode={isDarkMode}
          isTesting={isTesting}
        />
      )}
    </>
  );
};

export default GenericConfiguration;
