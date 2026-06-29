import React from 'react';
import { Monitor, TrendingUp, Activity } from 'lucide-react';
import { useGetDeviceDetailsByIdQuery } from '../../redux/apiSlice';

const IOHeader = ({ 
  deviceId, 
  isDarkMode, 
  onDeviceClick, 
  selectedGraphType, 
  onGraphTypeChange 
}) => {
  // Fetch device data via API hook
  const { data: deviceData, isLoading, error } = useGetDeviceDetailsByIdQuery(deviceId);

  const graphTypes = [
    { id: 'line', label: 'Line', icon: TrendingUp },
    { id: 'area', label: 'Area', icon: Activity }
  ];

  return (
    <>
      {/* Device header */}
      <div className={`rounded-lg shadow-md p-4 h-20 flex items-center justify-between ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
        <div className="flex items-center space-x-4 cursor-pointer" onClick={onDeviceClick}>
          <div className="w-12 h-12 rounded-lg flex items-center justify-center mr-2 bg-[#6366f1]">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {deviceData?.device?.hostname || 'Device Monitor'}
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {deviceData?.device?.device?.nic?.[0]?.port?.[0]?.ip?.[0]?.address || 'Unknown IP'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {graphTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => onGraphTypeChange(type.id)}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedGraphType === type.id
                    ? 'bg-[#6366f1] text-white'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default IOHeader;
