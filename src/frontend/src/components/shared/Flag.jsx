import React, { useState } from 'react';
import {
  Flag as FlagIcon,
  AlertTriangle,
  HardDrive,
  Layers3,
  Network,
  X,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  useGetFlaggedStorageDevicesQuery,
  useMarkStorageViewedMutation
} from '../../redux/storageFlagApi';
import {
  useGetFlaggedPortDevicesQuery,
  useMarkPortViewedMutation
} from '../../redux/networkFlagApi';
import "../index.css";


/* ================= CONSTANTS ================= */

const GROUP_LABELS = {
  disk:      'New Flagged Disks',
  partition: 'New Flagged Partitions',
  port:      'New Flagged Ports',
};


/* ================= PURE HELPERS ================= */

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month:  'short',
      day:    'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid Date';
  }
};

const getEntityIcon = (entityType, textColor) => {
  switch (entityType) {
    case 'port':
      return <Network  className="w-4 h-4 flex-shrink-0" style={{ color: textColor }} />;
    case 'partition':
      return <Layers3  className="w-4 h-4 flex-shrink-0" style={{ color: textColor }} />;
    case 'disk':
    default:
      return <HardDrive className="w-4 h-4 flex-shrink-0" style={{ color: textColor }} />;
  }
};

const getDisplayInfo = (device) => {
  if (device.entity_type === 'port') {
    return {
      title:    device.interface_name || 'Network Port',
      subtitle: `${device.is_physical_logical} ${device.logical_type ? `(${device.logical_type})` : ''}`,
      details: [
        { label: 'Operating Speed', value: device.operating_speed      || 'Unknown' },
        { label: 'Type',            value: device.is_physical_logical  || 'Unknown' },
        { label: 'Logical Type',    value: device.logical_type         || 'N/A'     },
        { label: 'NIC UUID',        value: device.nic_uuid ? device.nic_uuid.substring(0, 8) + '...' : 'Unknown' },
      ],
    };
  } else if (device.entity_type === 'partition') {
    return {
      title:    device.partition_name || 'Partition',
      subtitle: device.mount_point    || 'Unknown mount',
      details: [
        { label: 'File System',  value: device.fs_type            || 'Unknown' },
        { label: 'Total Size',   value: device.total_size         || 'Unknown' },
        { label: 'Free Space',   value: device.free_space         || 'Unknown' },
        { label: 'Used Space',   value: device.used_space         || 'Unknown' },
        { label: 'Parent Disk',  value: device.disk_serial_number || 'Unknown' },
      ],
    };
  } else {
    return {
      title:    `${device.make || 'Unknown'} ${device.model || 'Model'}`,
      subtitle: `S/N: ${device.serial_number || 'Unknown'}`,
      details: [
        { label: 'Type',       value: device.hw_disk_type    || 'Unknown' },
        { label: 'Total Size', value: device.total_disk_size || 'Unknown' },
        { label: 'Usage',      value: device.total_disk_usage || 'Unknown' },
        { label: 'Free Space', value: device.free_space      || 'Unknown' },
        { label: 'Usage %',    value: device.usage_percentage ? `${device.usage_percentage}%` : 'Unknown' },
      ],
    };
  }
};


/* ================= COMPONENT ================= */

const UnifiedFlag = ({
  isDarkMode = false,
  buttonStyles = {},
  dropdownStyles = {},
  textColor = '#1F2937',
  secondaryTextColor = '#374151',
  borderColor = '#E5E7EB',
  openDropdown,
  toggleDropdown,
}) => {
  const navigate = useNavigate();

  const {
    data: flaggedStorageResponse,
    isLoading: isStorageLoading,
    isError: isStorageError,
    error: storageError,
    isFetching: isStorageFetching,
  } = useGetFlaggedStorageDevicesQuery({ unviewed_only: true }, {
    refetchOnMountOrArgChange: true,
  });

  const {
    data: flaggedPortResponse,
    isLoading: isPortLoading,
    isError: isPortError,
    error: portError,
    isFetching: isPortFetching,
  } = useGetFlaggedPortDevicesQuery({ unviewed_only: true }, {
    refetchOnMountOrArgChange: true,
  });

  const [markStorageViewed] = useMarkStorageViewedMutation();
  const [markPortViewed]    = useMarkPortViewedMutation();

  const [dismissedItems, setDismissedItems] = useState(() => new Set());

  const flaggedStorageDevices = (flaggedStorageResponse?.data || []).filter(d => !d.is_viewed);
  const flaggedPortDevices    = (flaggedPortResponse?.data    || []).filter(d => !d.is_viewed);
  const allFlaggedDevices     = [...flaggedStorageDevices, ...flaggedPortDevices];

  const visibleDevices = allFlaggedDevices.filter(
    (device) => !dismissedItems.has(`${device.uuid}-${device.agent_uuid}`)
  );

  const isActuallyLoading =
    (isStorageLoading || isPortLoading) ||
    ((isStorageFetching && !flaggedStorageResponse) || (isPortFetching && !flaggedPortResponse));

  const flaggedCount  = visibleDevices.length;
  const storageCount  = visibleDevices.filter(d => d.entity_type !== 'port').length;
  const portCount     = visibleDevices.filter(d => d.entity_type === 'port').length;
  const errorMessage  = (isStorageError || isPortError)
    ? (storageError?.data?.error || portError?.data?.error || 'Failed to load data')
    : null;

  const groupedDevices = visibleDevices.reduce((acc, device) => {
    const type = device.entity_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(device);
    return acc;
  }, {});


  /* ================= HANDLERS ================= */

  const handleFlagClick = (device) => {
    const deviceUuid = device.agent_uuid;
    if (!deviceUuid || deviceUuid === 'unknown') return;

    const targetRoute = `devices/${deviceUuid}/inventory`;
    const stateConfig = device.entity_type === 'port'
      ? {
          flaggedPortUuid:    device.uuid,
          flaggedEntityType:  device.entity_type,
          highlightNetwork:   true,
          scrollTo:           'nics',
          deviceName:         device.device_name,
          fromFlag:           true,
          timestamp:          Date.now(),
        }
      : {
          flaggedStorageUuid: device.uuid,
          flaggedEntityType:  device.entity_type,
          highlightStorage:   true,
          scrollTo:           'storage',
          deviceName:         device.device_name,
          fromFlag:           true,
          timestamp:          Date.now(),
        };

    navigate(targetRoute, { state: stateConfig });
    toggleDropdown(null);
  };

  const handleDismissDevice = async (uuid, agent_uuid, event, device) => {
    event.stopPropagation();
    try {
      if (device.entity_type === 'port') {
        await markPortViewed({ uuid, action: 'mark_viewed' }).unwrap();
      } else {
        await markStorageViewed({ uuid, action: 'mark_viewed' }).unwrap();
      }
      setDismissedItems((prev) => new Set([...prev, `${uuid}-${agent_uuid}`]));
    } catch (error) {
      console.error('Error marking as viewed:', error);
      // Still dismiss locally even if API call fails
      setDismissedItems((prev) => new Set([...prev, `${uuid}-${agent_uuid}`]));
    }
  };


  /* ================= UI ================= */

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => toggleDropdown('flag')}
        className="p-2 rounded-lg transition-colors duration-300 hover:opacity-80 active:scale-[0.98] relative"
        style={buttonStyles}
        aria-label={`Component flags (${flaggedCount} flagged)`}
        aria-expanded={openDropdown === 'flag'}
        aria-haspopup="true"
      >
        <FlagIcon className="w-5 h-5" />
        {flaggedCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-xs font-semibold flex items-center justify-center text-white"
            style={{ backgroundColor: '#EF4444', fontSize: '11px' }}
          >
            {flaggedCount > 99 ? '99+' : flaggedCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {openDropdown === 'flag' && (
        <div
          className="absolute right-0 mt-2 w-96 rounded-lg shadow-lg border z-30 transition-all duration-200 max-h-96 overflow-hidden"
          style={dropdownStyles}
          role="menu"
          aria-label="Flagged components"
        >
          {/* Header */}
          <div className="p-4 border-b" style={{ borderColor }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: textColor }}>
                {flaggedCount > 0 ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    New Flagged Components
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Flagged Components
                  </>
                )}
              </h3>
              {flaggedCount > 0 && (
                <div className="flex items-center gap-2">
                  {storageCount > 0 && (
                    <span
                      className="text-xs px-2 py-1 rounded-full flex items-center gap-1"
                      style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6', color: secondaryTextColor }}
                    >
                      <HardDrive className="w-3 h-3" />
                      {storageCount}
                    </span>
                  )}
                  {portCount > 0 && (
                    <span
                      className="text-xs px-2 py-1 rounded-full flex items-center gap-1"
                      style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6', color: secondaryTextColor }}
                    >
                      <Network className="w-3 h-3" />
                      {portCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto custom-scroll">
            {isActuallyLoading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
                <p style={{ color: secondaryTextColor }}>Loading flagged components...</p>
              </div>

            ) : errorMessage ? (
              <div className="p-6 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-red-500 text-sm">{errorMessage}</p>
              </div>

            ) : flaggedCount === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p style={{ color: textColor }}>All flags reviewed!</p>
                <p className="text-sm mt-1" style={{ color: secondaryTextColor }}>
                  No new flagged components to review
                </p>
              </div>

            ) : (
              <div className="p-2">
                {['disk', 'partition', 'port'].map((groupType) => {
                  const devices = groupedDevices[groupType];
                  if (!devices || devices.length === 0) return null;

                  return (
                    <div key={groupType} className="mb-3">
                      <div
                        className="px-2 py-1 text-xs font-medium uppercase tracking-wider"
                        style={{ color: secondaryTextColor }}
                      >
                        {GROUP_LABELS[groupType]} ({devices.length})
                      </div>

                      {devices.map((device) => {
                        const displayInfo  = getDisplayInfo(device);
                        const severityColor = isDarkMode ? '#EF4444' : '#DC2626';
                        const bgColor       = isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(220,38,38,0.1)';

                        return (
                          <div
                            key={`${device.uuid}-${device.agent_uuid}`}
                            onClick={() => handleFlagClick(device)}
                            className="p-3 rounded-lg border mb-2 transition-colors duration-200 cursor-pointer"
                            style={{
                              borderColor:     severityColor,
                              borderLeftWidth: '4px',
                              backgroundColor: bgColor,
                            }}
                            title={`Click to investigate ${device.device_name || 'device'} ${device.entity_type === 'port' ? 'network interfaces' : 'inventory'}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {getEntityIcon(device.entity_type, textColor)}
                                  <span className="text-sm font-medium truncate" style={{ color: textColor }}>
                                    {displayInfo.title}
                                  </span>
                                  <span
                                    className="text-xs px-1.5 py-0.5 rounded capitalize"
                                    style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6', color: secondaryTextColor }}
                                  >
                                    {device.entity_type}
                                  </span>
                                  <span
                                    className="text-xs px-1.5 py-0.5 rounded font-bold"
                                    style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
                                  >
                                    NEW
                                  </span>
                                </div>

                                <p className="text-xs mb-2" style={{ color: secondaryTextColor }}>
                                  {displayInfo.subtitle}
                                </p>

                                {device.device_name && (
                                  <p className="text-xs mb-2 font-medium" style={{ color: textColor }}>
                                    {device.device_name}
                                  </p>
                                )}

                                <div className="text-xs space-y-1" style={{ color: secondaryTextColor }}>
                                  <div className="flex justify-between">
                                    <span>Flagged Duration:</span>
                                    <span className="font-medium" style={{ color: severityColor }}>
                                      {device.missing_duration || 'Unknown'}
                                    </span>
                                  </div>

                                  {displayInfo.details.slice(0, 3).map((detail, idx) => (
                                    <div key={idx} className="flex justify-between">
                                      <span>{detail.label}:</span>
                                      <span>{detail.value}</span>
                                    </div>
                                  ))}

                                  <div className="flex items-center gap-1 mt-2 pt-1 border-t" style={{ borderColor }}>
                                    <Clock className="w-3 h-3" />
                                    <span>Flagged: {formatDate(device.flagged_at)}</span>
                                  </div>

                                  {device.flagged_reason && (
                                    <div className="mt-1 pt-1 border-t" style={{ borderColor }}>
                                      <p className="text-xs italic" title={device.flagged_reason}>
                                        {device.flagged_reason.length > 60
                                          ? `${device.flagged_reason.substring(0, 60)}...`
                                          : device.flagged_reason}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={(e) => handleDismissDevice(device.uuid, device.agent_uuid, e, device)}
                                className="ml-2 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors duration-200"
                                title="Mark as reviewed"
                                aria-label="Mark as reviewed and dismiss flag for this component"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


UnifiedFlag.propTypes = {
  isDarkMode:         PropTypes.bool,
  buttonStyles:       PropTypes.object,
  dropdownStyles:     PropTypes.object,
  textColor:          PropTypes.string,
  secondaryTextColor: PropTypes.string,
  borderColor:        PropTypes.string,
  openDropdown:       PropTypes.string,
  toggleDropdown:     PropTypes.func.isRequired,
};


export default UnifiedFlag;