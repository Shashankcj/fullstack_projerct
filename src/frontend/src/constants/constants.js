
export const PRIORITY_LEVELS = [
  { 
    value: 'P1', 
    label: 'Critical Priority', 
    color: '#EF4444', 
    bgColor: '#FEF2F2' 
  },
  { 
    value: 'P2', 
    label: 'High Priority', 
    color: '#F97316', 
    bgColor: '#FFF7ED' 
  },
  { 
    value: 'P3', 
    label: 'Medium Priority', 
    color: '#EAB308', 
    bgColor: '#FEFCE8' 
  },
  { 
    value: 'P4', 
    label: 'Low Priority', 
    color: '#22C55E', 
    bgColor: '#F0FDF4' 
  }
];

export const getPriorityConfig = (priority) => {
  return PRIORITY_LEVELS.find(level => level.value === priority);
};

export const ERROR_MESSAGES = {
  DEVICE_LOAD_FAILED: 'Failed to load devices. Please try again.',
  GROUP_CREATE_FAILED: 'Failed to create group. Please try again.',
  ASSIGNMENT_FAILED: 'Failed to assign devices. Please try again.'
};

export const DEVICE_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  OFFLINE: 'Offline'
};

export const CHART_DP_SIZES = {
  FW: 20,
  SMALL: 10
};