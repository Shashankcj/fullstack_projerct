import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  XMarkIcon,
  UserGroupIcon,
  TrashIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { ChevronDown } from 'lucide-react';
import '../index.css';

const BulkActionDropdown = ({
  options,
  selectedValue,
  setSelectedValue,
  isDarkMode,
  disabled = false,
  isLoading = false,
  placeholder = 'Select an option',
}) => {
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
    setSelectedValue(value);
    setIsOpen(false);
  };

  const getSelectedLabel = () => {
    const selectedOption = options.find((opt) => opt.value === selectedValue);
    return selectedOption ? selectedOption.label : placeholder;
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
        <span className={selectedValue ? '' : 'text-gray-500 dark:text-gray-400'}>
          {isLoading ? 'Loading...' : getSelectedLabel()}
        </span>
        <ChevronDown
          className={`w-4 h-4 ml-1 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          } ${disabled || isLoading ? 'opacity-50' : ''}`}
        />
      </button>

      <div
        className={`absolute top-full mt-1 w-full rounded-lg shadow-lg border z-[99999] transition-all duration-200 origin-top
          ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}
          ${isOpen && !disabled && !isLoading
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          }
        `}
      >
        <div className="py-0.5 max-h-36 overflow-y-auto custom-scroll">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
          ) : options.length > 0 ? (
            // CHANGE TO:
options.map((option) => (
  <button
    key={option.value}
    type="button"
    disabled={option.disabled}   // ✅ ADD THIS
    className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150
      ${option.disabled
        ? isDarkMode
          ? 'text-gray-400 cursor-not-allowed opacity-70' 
          : 'text-gray-400 cursor-not-allowed opacity-50'
        : selectedValue === option.value
          ? 'bg-blue-500 text-white'
          : isDarkMode
            ? 'text-gray-200 hover:bg-gray-600'
            : 'text-gray-900 hover:bg-gray-100'
      }`}
    onClick={() => !option.disabled && handleSelect(option.value)}  // ✅ guard click too
  >
    {option.label}
    {option.disabled && (
      <span className="ml-2 text-[10px] opacity-60">(current)</span>  // ✅ helpful hint
    )}
  </button>
))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No options available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export const BULK_ACTION_TYPES = {
  EDIT_ROLES: 'edit_roles',
  ENABLE_EMAIL: 'enable_email',
  TOGGLE_STATUS: 'toggle_status',
  DELETE_USERS: 'delete_users',
  PRIORITY_CSV: 'priority_csv',
};

const BulkActionModal = ({
  show,
  onHide,
  selectedItems = [],
  isDarkMode = false,
  config,
  onSuccess,
  onPriorityCSVImport,
}) => {
  const [selectedValue, setSelectedValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backendErrors, setBackendErrors] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationValue, setDurationValue] = useState('');      
  const [durationUnit, setDurationUnit] = useState('hours');

useEffect(() => {
  if (!show) {
    setSelectedValue('');
    setStartDate('');
    setEndDate('');
    setDurationValue('');       
    setDurationUnit('hours');    
    handleReset();
  }
}, [show]);

  const handleReset = () => {
    setFile(null);
    setBackendErrors(null);
    setFileError(null);
    setUploadSummary(null);
    setLoading(false);
    const fileInput = document.getElementById('priority-csv-file-input');
    if (fileInput) fileInput.value = '';
  };

  if (!show || !config) return null;

  const toISO = (val) => val ? new Date(val).toISOString() : null;

  const {
    title = 'Bulk Action',
    message = 'Please confirm this bulk action.',
    icon: Icon = UserGroupIcon,
    iconColor = isDarkMode ? '#60A5FA' : '#2563EB',
    itemLabel = 'Selected Items',
    itemUnit = 'item(s)',
    dropdownLabel,
    dropdownPlaceholder = 'Select an option',
    options = [],
    showDropdown = false,
    showRadioOptions = false, 
    radioOptions = [],
    requireSelection = false,
    cancelValue,
    buttonText = 'Apply',
    buttonColor = 'blue',
    processingText = 'Applying...',
    isLoading = false,
    onAction,
    actionType = '',
    uploadType = 'ip', // 'ip' | 'priority' - NEW
  } = config;

 const handleClose = () => {
  setSelectedValue('');
  setStartDate('');
  setEndDate('');
  setDurationValue('');          
  setDurationUnit('hours');    
  setFile(null);
  setBackendErrors(null);
  setFileError(null);
  setUploadSummary(null);
  setLoading(false);
  onHide();
};

  const getButtonColorClasses = () => {
  switch (buttonColor) {
    case 'red':
      return 'bg-red-600 hover:bg-red-700';

    case 'green':
      return 'bg-green-600 hover:bg-green-700';

    case 'yellow':
      return 'bg-yellow-600 hover:bg-yellow-700';

    case 'blue':
    default:
      return 'bg-blue-600 hover:bg-blue-700';
  }
};

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (
      selectedFile.type !== 'text/csv' &&
      !selectedFile.name.toLowerCase().endsWith('.csv')
    ) {
      setFileError('Please upload a valid CSV file');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setFileError(null);
    setBackendErrors(null);
    setUploadSummary(null);
  };

 const handleSubmit = async (e) => {
  e.preventDefault();

  // ── PRIORITY CSV ────────────────────────────────────────────────────
  if (actionType === 'priority_csv') {
    if (!file) {
      setFileError('Please select a CSV file to upload');
      return;
    }

    setLoading(true);
    setBackendErrors(null);
    setUploadSummary(null);

    try {
      const formData = new FormData();
      formData.append('csv_file', file);

      if (typeof onPriorityCSVImport === 'function') {
        const response = await onPriorityCSVImport(formData, selectedItems, uploadType);

        const hasUpdated = (response.updated || 0) > 0;
        const hasErrors  = (response.errors || 0) > 0 || (response.invalid_ips || 0) > 0;

        setUploadSummary({
          total_rows  : response.total_rows || 0,
          updated     : response.updated || 0,
          errors_count: (response.errors || 0) + (response.invalid_ips || 0),
        });

        const errors = {};
        if (response.invalid_ips_details) {
          errors.invalid_ips = response.invalid_ips_details.map(err =>
            `Row ${err.row}: IP "${err.ip_uuid}" - ${err.priority || 'invalid priority'}`
          );
        }
        if (response.validation_errors && Array.isArray(response.validation_errors)) {
          errors.validation = response.validation_errors;
        }

        if (hasErrors) {
          setBackendErrors(errors);
          if (hasUpdated) {
            toast.warning(
              `${response.updated} device(s) priority updated. ${(response.errors || 0) + (response.invalid_ips || 0)} error(s) skipped.`,
              { autoClose: 6000 }
            );
          } else {
            toast.error(response.message || 'No priorities were updated.');
          }
          setLoading(false);
          return;
        }

        handleReset();
        if (onSuccess) onSuccess();
        handleClose();
      }
    } catch (error) {
      console.error('Priority assignment error:', error);
      setLoading(false);

      if (error?.data) {
        const errorData = error.data;
        const errors = {};

        if (errorData.csv_file) {
          const csvError = Array.isArray(errorData.csv_file)
            ? errorData.csv_file[0]
            : errorData.csv_file;
          setFileError(csvError);
          toast.error(csvError);
          return;
        }

        if (errorData.validation_errors && Array.isArray(errorData.validation_errors)) {
          errors.validation = errorData.validation_errors;
        }
        if (errorData.invalid_ips_details && Array.isArray(errorData.invalid_ips_details)) {
          errors.invalid_ips = errorData.invalid_ips_details.map(err =>
            `Row ${err.row}: ${err.message || 'Invalid IP/priority'}`
          );
        }

        if (Object.keys(errors).length > 0) setBackendErrors(errors);

        if (errorData.message)     toast.error(errorData.message);
        else if (errorData.detail) toast.error(errorData.detail);
      } else {
        setBackendErrors({ validation: ['Failed to assign priorities. Please try again.'] });
        toast.error('Failed to assign priorities. Please try again.');
      }
    }
    return;
  }

  // ── REGULAR BULK ACTIONS ─────────────────────────────────────────────
  if (requireSelection && !selectedValue) {
    toast.error('Please select an option');
    return;
  }

  //Immediate
  if (selectedValue === 'immediate') {
    if (!durationValue || Number(durationValue) <= 0) {
      toast.error('Please enter a valid duration');
      return;
    }
  }

  // Scheduled 
  if (selectedValue === 'scheduled') {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('End date must be after start date');
      return;
    }
    const diffMinutes = (new Date(endDate) - new Date(startDate)) / 1000 / 60;
    if (diffMinutes < 5) {
      toast.error('Maintenance window must be at least 5 minutes');
      return;
    }
  }

  if (cancelValue && selectedValue === cancelValue) {
    handleClose();
    return;
  }

  try {
    setIsProcessing(true);

    if (typeof onAction === 'function') {
      // ✅ Compute maintenanceEnd for immediate
      const maintenanceEnd = selectedValue === 'immediate' && durationValue
        ? (() => {
            const ms = durationUnit === 'hours'
              ? Number(durationValue) * 60 * 60 * 1000
              : Number(durationValue) * 60 * 1000;
            return new Date(Date.now() + ms).toISOString();
          })()
        : null;

      await onAction(
        selectedItems,
        selectedValue,
        toISO(startDate),    // ISO for Django
        toISO(endDate),      // ISO for Django
        maintenanceEnd       // already ISO
      );
    }

    handleClose();
    if (onSuccess) onSuccess();
  } catch (error) {
    console.error('Bulk action error:', error);
    toast.error(error?.data?.message || 'Action failed');
  } finally {
    setIsProcessing(false);
  }
};


  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
      onClick={handleClose}
    >
      <div
        className="rounded-xl p-6 max-w-lg w-full relative shadow-2xl border mx-4 max-h-[90vh]"
        style={{
          background: isDarkMode
            ? 'rgba(15, 23, 42, 0.95)'
            : 'rgba(255, 255, 255, 0.95)',
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
          disabled={isProcessing || isLoading || loading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <h3
          className="text-xl font-semibold mb-5 flex items-center"
          style={{ color: isDarkMode ? '#F1F5F9' : '#1E293B' }}
        >
          {Icon && (
            <Icon
              className="w-5 h-5 mr-2"
              style={{ color: iconColor }}
            />
          )}
          {title}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className={`p-3 rounded-lg border ${
              isDarkMode
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <p
              className="text-sm"
              style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
            >
              {message}
            </p>
          </div>

          {/* Selected Items Count - HIDE FOR PRIORITY CSV */}
          {actionType !== 'priority_csv' && (
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-medium"
                style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
              >
                {itemLabel}:
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isDarkMode
                    ? 'bg-blue-900/30 text-blue-300'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {selectedItems.length} {itemUnit}
              </span>
            </div>
          )}
{/* DEVICE LIST/SUMMARY - SMART CONDITION */}
{actionType === 'maintenance' && selectedItems.length > 0 && (
  <div className="space-y-3">

    {!selectedValue ? (
      // FULL LIST — before user picks anything
      <div className="max-h-32 sm:max-h-48 overflow-y-auto custom-scroll space-y-2 p-4 rounded-xl border"
           style={{
             backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 1)',
             borderColor: isDarkMode ? '#374151' : '#E5E7EB'
           }}>
        {selectedItems.map((device, index) => {
          const isActive = device.status?.label?.toLowerCase() === 'active' ||
                           device.isActive?.toLowerCase() === 'active';
          return (
            <div key={device.id || index}
                 className="flex items-center justify-between py-2 px-4 hover:bg-opacity-20 rounded-lg transition-all">
              <div className="flex items-center space-x-3 truncate">
                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium truncate"
                      style={{ color: isDarkMode ? '#F1F5F9' : '#1E293B' }}>
                  {device.device_name || device.hostname || 'Unknown Device'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  isActive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                }`}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <span className="text-xs opacity-75 font-mono"
                    style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                {device.ip || device.device?.ip_address || 'N/A'}
              </span>
            </div>
          );
        })}
      </div>

    ) : (
      // COMPACT SUMMARY — once Immediate OR Scheduled is selected
      <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl border"
           style={{
             backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 1)',
             borderColor: isDarkMode ? '#374151' : '#E5E7EB'
           }}>
        <div className="flex items-center justify-center space-x-4 mb-1">
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0" />
            <span className="text-xs font-medium" style={{ color: isDarkMode ? '#10B981' : '#059669' }}>
              {selectedItems.filter(item =>
                item.status?.label?.toLowerCase() === 'active' ||
                item.isActive?.toLowerCase() === 'active'
              ).length} Active
            </span>
          </div>
          <span className="text-sm font-semibold px-3 py-1 bg-blue-500/20 rounded-full flex-shrink-0"
                style={{ color: isDarkMode ? '#60A5FA' : '#2563EB' }}>
            {selectedItems.length} Total
          </span>
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0" />
            <span className="text-xs font-medium text-red-500">
              {selectedItems.filter(item =>
                item.status?.label?.toLowerCase() !== 'active' &&
                item.isActive?.toLowerCase() !== 'active'
              ).length} Inactive
            </span>
          </div>
        </div>
      </div>
    )}

  </div>
)}

           {/* RADIO BUTTON OPTIONS */}
{showRadioOptions && radioOptions.length > 0 && (
  <div className="space-y-2">
    <label className="block text-sm font-medium" style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}>
      Select Mode:
    </label>
    <div className="flex items-center space-x-6 p-3 rounded-lg border bg-opacity-20" 
         style={{ 
           backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 1)',
           borderColor: isDarkMode ? '#374151' : '#E5E7EB' 
         }}>
      {radioOptions.map((opt) => (
        <label key={opt.value} className="flex items-center cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input
              type="radio"
              name="bulk-radio-option"
              value={opt.value}
              checked={selectedValue === opt.value}
              onChange={(e) => setSelectedValue(e.target.value)}
              className="sr-only" // Hide default radio
            />
            {/* Custom Radio Circle */}
            <div className={`w-5 h-5 rounded-full border-2 transition-all ${
              selectedValue === opt.value 
                ? 'border-blue-500 bg-blue-500' 
                : isDarkMode ? 'border-gray-500' : 'border-gray-300'
            }`}>
              {selectedValue === opt.value && (
                <div className="w-2 h-2 bg-white rounded-full m-auto mt-1" />
              )}
            </div>
          </div>
          <span className="ml-2 text-sm" style={{ color: isDarkMode ? '#F1F5F9' : '#1E293B' }}>
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  </div>
)}
{/* IMMEDIATE DURATION — number input + unit dropdown */}
{showRadioOptions && selectedValue === 'immediate' && (
  <div className="space-y-3">

    <label className="block text-sm font-medium"
           style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}>
      Auto-disable after:
    </label>

    {/*  Input + Dropdown side by side */}
    <div className="flex items-center gap-2">

      {/* Number Input */}
      <input
        type="number"
        min={durationUnit === 'minutes' ? 5 : 1} //5
        max={durationUnit === 'hours' ? 24 : 1440}
        value={durationValue}
        onChange={(e) => setDurationValue(e.target.value)}
        placeholder="Enter duration"
        className={`
          flex-1 px-4 py-1.5 rounded-xl border-2 text-sm font-medium
          transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-opacity-50
          ${isDarkMode
            ? 'bg-gray-800/80 border-gray-600 text-white placeholder-gray-400 hover:border-gray-500 focus:border-blue-500 focus:ring-blue-500/30'
            : 'bg-white/80 border-gray-200 text-gray-900 placeholder-gray-500 hover:border-gray-300 focus:border-blue-500 focus:ring-blue-500/30'
          }
        `}
      />

      {/* Unit Dropdown */}
      <select
        value={durationUnit}
        onChange={(e) => setDurationUnit(e.target.value)}
        className={`
          px-3 py-1.5 rounded-xl border-2 text-sm font-medium cursor-pointer
          transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-opacity-50
          ${isDarkMode
            ? 'bg-gray-800/80 border-gray-600 text-white hover:border-gray-500 focus:border-blue-500 focus:ring-blue-500/30'
            : 'bg-white/80 border-gray-200 text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:ring-blue-500/30'
          }
        `}
      >
        <option value="hours">Hours</option>
        <option value="minutes">Minutes</option>
      </select>

    </div>

    {/* Note */}
    <div className={`flex items-start gap-2 p-1.5 rounded-lg border ${
      isDarkMode
        ? 'bg-amber-900/20 border-amber-700/40'
        : 'bg-amber-50 border-amber-200'
    }`}>
      <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
      <p className="text-xs leading-relaxed"
         style={{ color: isDarkMode ? '#FCD34D' : '#92400E' }}>
        <strong>Note:</strong> Maintenance will auto-disable after{' '}
        <strong>
          {durationValue
            ? `${durationValue} ${durationUnit}`
            : 'the entered duration'}
        </strong>.
        {' '}For a specific time window, select{' '}
        <button
          type="button"
          className="underline font-semibold hover:opacity-80"
          onClick={() => {
            setSelectedValue('scheduled');
            setDurationValue('');
            setDurationUnit('hours');
          }}
        >
          Scheduled
        </button>{' '}option.
      </p>
    </div>
  </div>
)}


{/* CALENDAR - RESPONSIVE FIXED */}
{config.showDateRange && selectedValue === 'scheduled' && (
  <div className="space-y-2 p-4">
    <label className="block text-sm font-semibold tracking-wide" 
           style={{ color: isDarkMode ? '#F1F5F9' : '#1E293B' }}>
      Maintenance Window
    </label>
    
    {/* SIDE-BY-SIDE DATE PICKERS */}
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* START DATE */}
      <div className="flex flex-col space-y-1.5">
        <label className="text-xs font-medium" 
               style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
          Start Date & Time
        </label>
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          className={`
            w-full px-4 py-2.5 rounded-xl border-2 text-sm font-medium
            transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-1 focus:ring-opacity-50
            ${isDarkMode 
              ? 'bg-gray-800/80 border-gray-600 text-white placeholder-gray-400 hover:border-gray-500 focus:border-emerald-500 focus:ring-emerald-500/30 shadow-lg'
              : 'bg-white/80 border-gray-200 text-gray-900 placeholder-gray-500 hover:border-gray-300 focus:border-emerald-500 focus:ring-emerald-500/30 shadow-lg'
            }
          `}
        />
      </div>

      {/* END DATE */}
      <div className="flex flex-col space-y-1.5">
        <label className="text-xs font-medium" 
               style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
          End Date & Time
        </label>
        <input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          min={startDate || new Date().toISOString().slice(0, 16)}
          className={`
            w-full px-4 py-2.5 rounded-xl border-2 text-sm font-medium
            transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-1 focus:ring-opacity-50
            ${isDarkMode 
              ? 'bg-gray-800/80 border-gray-600 text-white placeholder-gray-400 hover:border-gray-500 focus:border-emerald-500 focus:ring-emerald-500/30 shadow-lg'
              : 'bg-white/80 border-gray-200 text-gray-900 placeholder-gray-500 hover:border-gray-300 focus:border-emerald-500 focus:ring-emerald-500/30 shadow-lg'
            }
          `}
        />
      </div>
    </div>
  </div>
)}


          {/* Regular dropdown (non-CSV) */}
          {actionType !== 'priority_csv' && showDropdown && (
             <div className="relative" style={{ zIndex: 9999 }}>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
              >
                {dropdownLabel}
              </label>
              <BulkActionDropdown
                options={options}
                selectedValue={selectedValue}
                setSelectedValue={setSelectedValue}
                isDarkMode={isDarkMode}
                isLoading={isLoading}
                placeholder={dropdownPlaceholder}
              />
            </div>
          )}

          {/* PRIORITY CSV UPLOAD - DYNAMIC */}
          {actionType === 'priority_csv' && (
            <>
              {/* Import CSV Button */}
              <div className="mb-6">
                <label
                  htmlFor="priority-csv-file-input"
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                    isDarkMode
                      ? 'bg-[#6366f1] text-white hover:bg-[#6366f1]/90'
                      : 'bg-[#6366f1] text-white hover:bg-[#6366f1]/90'
                  }`}
                >
                  <CloudArrowUpIcon className="w-4 h-4 mr-2" />
                  Select CSV File
                </label>
                <input
                  id="priority-csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p
                  className="text-xs mt-2"
                  style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                >
                  Upload CSV with columns: <strong>
                    {uploadType === 'priority' 
                      ? 'hostname, ip_address, priority (p1,p2,p3,p4,np)' 
                      : 'hostname, ip_address'
                    }
                  </strong>
                </p>
              </div>

              {/* Selected File Info */}
              {file && !fileError && !uploadSummary && (
                <div className="mb-6">
                  <div
                    className={`p-4 rounded-lg border ${
                      isDarkMode
                        ? 'bg-blue-900/20 border-blue-800/30'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <CloudArrowUpIcon
                          className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5"
                          style={{ color: isDarkMode ? '#60A5FA' : '#2563EB' }}
                        />
                        <div>
                          <p
                            className="text-sm font-medium mb-1"
                            style={{ color: isDarkMode ? '#93C5FD' : '#1E40AF' }}
                          >
                            Selected File
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: isDarkMode ? '#93C5FD' : '#1E40AF' }}
                          >
                            {file.name} ({(file.size / 1024).toFixed(2)} KB)
                          </p>
                        </div>
                      </div>
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          backgroundColor: isDarkMode ? '#064E3B' : '#D1FAE5',
                          color: isDarkMode ? '#6EE7B7' : '#065F46',
                        }}
                      >
                        Ready to upload
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Summary - DYNAMIC LABELS */}
              {uploadSummary && (
                <div className="mb-6">
                  <div
                    className={`p-4 rounded-lg border ${
                      isDarkMode
                        ? 'bg-blue-900/20 border-blue-800/30'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <h4
                      className="text-sm font-semibold mb-3 flex items-center"
                      style={{ color: isDarkMode ? '#93C5FD' : '#1E40AF' }}
                    >
                      <CloudArrowUpIcon className="w-4 h-4 mr-2" />
                      Upload Summary
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>Total Rows</p>
                        <p className="text-lg font-bold" style={{ color: isDarkMode ? '#93C5FD' : '#1E40AF' }}>
                          {uploadSummary.total_rows}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                          {uploadType === 'priority' ? 'Updated' : 'Created'}
                        </p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          {uploadSummary.updated || uploadSummary.created || 0}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                          {uploadType === 'priority' ? 'Errors' : 'Duplicates'}
                        </p>
                        <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                          {uploadSummary.errors_count || uploadSummary.duplicates_count || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* File Error */}
              {fileError && (
                <div className="mb-6">
                  <div
                    className={`p-4 rounded-lg border ${
                      isDarkMode
                        ? 'bg-red-900/20 border-red-800/30'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start">
                      <ExclamationCircleIcon
                        className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5"
                        style={{ color: isDarkMode ? '#FCA5A5' : '#DC2626' }}
                      />
                      <div>
                        <p
                          className="text-sm font-medium mb-1"
                          style={{ color: isDarkMode ? '#FCA5A5' : '#DC2626' }}
                        >
                          Invalid File
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: isDarkMode ? '#FCA5A5' : '#DC2626' }}
                        >
                          {fileError}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Backend Error Section - DYNAMIC */}
              {backendErrors && (
                <div className="mb-6 space-y-3">
                  {backendErrors.validation && backendErrors.validation.length > 0 && (
                    <div
                      className={`p-3 rounded-lg border ${
                        isDarkMode
                          ? 'bg-red-900/20 border-red-800/30'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start mb-2">
                        <ExclamationCircleIcon
                          className="w-5 h-5 mr-2 flex-shrink-0"
                          style={{ color: isDarkMode ? '#FCA5A5' : '#DC2626' }}
                        />
                        <p
                          className="text-sm font-medium"
                          style={{ color: isDarkMode ? '#FCA5A5' : '#DC2626' }}
                        >
                          Validation Errors ({backendErrors.validation.length})
                        </p>
                      </div>
                      <ul className="ml-7 space-y-1 max-h-40 overflow-y-auto custom-scroll">
                        {backendErrors.validation.map((error, index) => (
                          <li
                            key={index}
                            className="text-xs"
                            style={{ color: isDarkMode ? '#FCA5A5' : '#DC2626' }}
                          >
                            • {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {backendErrors.invalid_ips && backendErrors.invalid_ips.length > 0 && (
                    <div
                      className={`p-3 rounded-lg border ${
                        isDarkMode
                          ? 'bg-yellow-900/20 border-yellow-800/30'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-start mb-2">
                        <ExclamationCircleIcon
                          className="w-5 h-5 mr-2 flex-shrink-0"
                          style={{ color: isDarkMode ? '#FCD34D' : '#D97706' }}
                        />
                        <p
                          className="text-sm font-medium"
                          style={{ color: isDarkMode ? '#FCD34D' : '#D97706' }}
                        >
                          Invalid IPs ({backendErrors.invalid_ips.length})
                        </p>
                      </div>
                      <ul className="ml-7 space-y-1 max-h-40 overflow-y-auto custom-scroll">
                        {backendErrors.invalid_ips.map((error, index) => (
                          <li
                            key={index}
                            className="text-xs"
                            style={{ color: isDarkMode ? '#FCD34D' : '#D97706' }}
                          >
                            • {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Info Box */}
              <div
                className={`p-3 rounded-lg border mb-6 ${
                  isDarkMode
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <p
                  className="text-xs"
                  style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                >
                  <strong>Note:</strong> The CSV file will be validated by the server. Selected devices will be matched by IP address.
                </p>
              </div>
            </>
          )}

          <div
            className="flex justify-end space-x-3 pt-3 border-t"
            style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
          >
            {(file || fileError || backendErrors) && !loading && (
              <button
                type="button"
                onClick={handleReset}
                className={`inline-flex items-center px-4 py-1.5 font-medium rounded-lg transition-colors ${
                  isDarkMode
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
              disabled={
                isProcessing ||
                isLoading ||
                loading ||
                (requireSelection && !selectedValue) ||
                (selectedValue === 'immediate' && (!durationValue || Number(durationValue) <= 0))||
                (selectedValue === 'scheduled' && (!startDate || !endDate)) ||
                (actionType === 'priority_csv' && (!file || loading))
              }
              className={`inline-flex items-center px-5 py-1.5 font-medium rounded-lg text-white focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${getButtonColorClasses()}`}
            >
              {isProcessing || loading ? (
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {processingText}
                </>
              ) : (
                buttonText
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkActionModal;