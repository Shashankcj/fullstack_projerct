import React from 'react';
import { Calendar, CalendarDays, ChevronDown, Clock, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from 'react-router-dom';
import { debounce, set } from "lodash";
import { convert_DateObj_to_input_strformat } from '../device/utils.jsx';
import { useClickOutside } from "../../Hooks/useClickOutside.jsx";



const datetime_inputstr_to_ISO_String = (dt) => {
    // Date object to ISO Datetime String
    dt = new Date(dt);
    return dt.toISOString();
}

const validate_from_to_datetime = (fromDT, toDT, validation_state) => {
    // Validation logic for fromDT and toDT
    fromDT = new Date(fromDT);
    toDT = new Date(toDT);
   
    if (fromDT == ' ' || toDT == ' ' || isNaN(fromDT) || isNaN(toDT)) {
        validation_state({ status: null, message: '' });
        return;
    }

    if (fromDT >= toDT) {
        validation_state({ status: "ERROR", message: "'From' date/time cannot be later than or equal to 'To' date/time." });
    } else {
        validation_state({ status: "OK", message: "Valid date/time range." });
    }

}

const DataGranularityPreset = (props) => {
    const { isDarkMode } = props;
    const { setFromDT, setToDT } = props.states;
    const preset = {
        minutes: [
            { label: "Last 10 Min", value: 10 },
            { label: "Last 15 Min", value: 15 },
            { label: "Last 30 Min", value: 30 }
        ],
        hours: [
            { label: "Last 1 Hour", value: 60 },
            { label: "Last 12 Hours", value: 720 },
            { label: "Last 24 Hours", value: 1440 }
        ],
        days: [
            { label: "Last 7 Days", value: 10080 },
            { label: "Last 14 Days", value: 20160 },
            { label: "Last 30 Days", value: 43200 }
        ],
        weeks: [
            { label: "Last 8 Weeks", value: 80640 },
            { label: "Last 12 Weeks", value: 120960 },
            { label: "Last 24 Weeks", value: 241920 }
        ]
    };
    const [isSelfActive, setSelfActive] = useState(null);

    const handleSeletedPreset = (minutes) => {
        setToDT(convert_DateObj_to_input_strformat(new Date()));
        setFromDT(convert_DateObj_to_input_strformat(new Date(Date.now() - minutes * 60000)));
    }

    return (
        <div className="grid grid-cols-3 gap-2 mb-4">
            {
                preset[props.presetType].map((preset, index) => {
                    return (
                        <button
                            key={preset.label}
                            onClick={() => { setSelfActive(preset.label); handleSeletedPreset(preset.value); }}
                            className={`px-2 py-1.5 text-xs rounded transition-all hover:scale-105 font-medium border ${isSelfActive === preset.label
                                    ? isDarkMode
                                        ? 'bg-[#6366f1] text-white shadow-lg border-blue-400 ring-2 ring-blue-300'
                                        : 'bg-[#6366f1] text-white shadow-lg border-blue-500 ring-2 ring-blue-200'
                                    : isDarkMode
                                        ? 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600 hover:border-gray-500'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300 hover:border-gray-400'
                                }`}

                        >
                            {preset.label}
                        </button>
                    );
                })
            }
        </div>
    );

}

export const DTFilterButton = (props) => {
    const [showCustomDropdown, setShowCustomDropdown] = useState(false);
    const { isDarkMode } = props;
    const [isActive, setIsActive] = useState(false);
    const dropdownRef = useRef();
    const [searchParams, setSearchParams] = useSearchParams();
    const [fromDT, setFromDT] = useState('');
    const [toDT, setToDT] = useState('');
    const [preset, setPreset] = useState({
        activePreset: "minutes",
        component: <DataGranularityPreset presetType="minutes" isDarkMode={isDarkMode} states={{ setToDT, setFromDT }} />
    });
    const [dtPairValidation, setDtPairValidation] = useState({ status: null, message: '' });

    const toggleCustomDropdown = () => {
        setIsActive(!isActive);
        setShowCustomDropdown(!showCustomDropdown);
    }

    // Close dropdown when clicking outside
    const closeDropdown = () => {
        setShowCustomDropdown(false);
        setIsActive(false);
        };
    useClickOutside(dropdownRef, closeDropdown);

    const handleDTChange = (newFromDT, newToDT) => {
        setFromDT(newFromDT);
        setToDT(newToDT);
    }

    useEffect(() => {
        validate_from_to_datetime(fromDT, toDT, setDtPairValidation);
    }, [fromDT, toDT]);

    const setSearchParams_on_Apply = () => {
        // Function to set search params on Apply
        setSearchParams((prevParams) => {
            const newParams = new URLSearchParams(prevParams.toString());
            newParams.set('fromDT', datetime_inputstr_to_ISO_String(fromDT));
            newParams.set('toDT', datetime_inputstr_to_ISO_String(toDT));
            return newParams;
        });
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Enhanced Custom Date Button with Granularity Support */}
            <button
                onClick={toggleCustomDropdown}
                className={`flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${isActive ? 'bg-[#6366f1] text-white'
                        : isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>

                <Calendar className="w-4 h-4 mr-2" />
                Custom Range
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showCustomDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Custom Date Dropdown */}
            {showCustomDropdown && (
                <div className={`absolute top-right right-0 mt-2 p-4 rounded-lg shadow-xl border z-20 min-w-[400px] ${isDarkMode
                        ? 'bg-gray-800 border-gray-600 shadow-gray-900/50'
                        : 'bg-white border-gray-200 shadow-black/10'
                    }`}>
                    <div className="space-y-4">
                        <div className="flex items-center mb-3">
                            <CalendarDays className={`w-4 h-4 mr-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                Select Date Range & Granularity
                            </span>
                        </div>

                        {/* Granularity Selection */}
                        <div className="mb-4">
                            <label className={`block text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                Data Granularity
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { value: 'minutes', label: 'Minutes', icon: Clock },
                                    { value: 'hours', label: 'Hours', icon: Calendar },
                                    { value: 'days', label: 'Days', icon: CalendarDays },
                                    { value: 'weeks', label: 'Weeks', icon: Calendar }
                                ].map(option => {
                                    const Icon = option.icon;
                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => { setPreset({ activePreset: option.value, component: <DataGranularityPreset presetType={option.value} isDarkMode={isDarkMode} states={{ setToDT, setFromDT }} /> }); }}
                                            className={`px-2 py-1.5 text-xs rounded transition-all font-medium flex items-center justify-center ${preset.activePreset === option.value
                                                    ? isDarkMode
                                                        ? 'bg-[#6366f1] text-white shadow-md'
                                                        : 'bg-[#6366f1] text-white shadow-md'
                                                    : isDarkMode
                                                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                                }`}
                                        >
                                            <Icon className="w-3 h-3 mr-1" />
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {preset.component}


                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    From Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={fromDT}
                                    onChange={(e) => { handleDTChange(e.target.value, toDT); }}
                                    max={new Date().toISOString().slice(0, 16)}
                                    className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                                        // dateError && (dateError.includes('start') || dateError.includes('Start')) 
                                        // ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                                        isDarkMode
                                            ? 'bg-gray-700 border-gray-600 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    To Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={toDT}
                                    onChange={(e) => { handleDTChange(fromDT, e.target.value); }}
                                    max={new Date().toISOString().slice(0, 16)}
                                    className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                                        // dateError && (dateError.includes('end') || dateError.includes('End')) 
                                        // ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                                        isDarkMode
                                            ? 'bg-gray-700 border-gray-600 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                />
                            </div>
                        </div>

                        {/* Enhanced error display */}
                        {dtPairValidation.status == "ERROR" && (
                            <div className="flex items-start space-x-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span className="font-medium">{dtPairValidation.message}</span>
                            </div>
                        )}

                        {/* Enhanced action buttons */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={setSearchParams_on_Apply}
                                disabled={dtPairValidation.status == null || dtPairValidation.status === 'ERROR'}
                                className={`flex-1 px-3 py-2 text-sm rounded transition-all flex items-center justify-center font-medium ${dtPairValidation.status == null || dtPairValidation.status === 'ERROR'
                                        ? 'bg-gray-400 cursor-not-allowed text-gray-200' :
                                        isDarkMode
                                            ? 'bg-[#6366f1] hover:bg-[#6366f1]/80 text-white hover:shadow-lg'
                                            : 'bg-[#6366f1] hover:bg-[#6366f1]/80 text-white hover:shadow-lg'
                                    }`}
                            >
                                Apply Range
                            </button>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}