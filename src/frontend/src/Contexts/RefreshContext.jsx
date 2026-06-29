import React, { createContext, useContext, useEffect, useState } from 'react';

const RefreshContext = createContext();

const LOCAL_STORAGE_KEY = 'app_refresh_interval';

export const RefreshProvider = ({ children, defaultInterval = null }) => {
  const getStoredInterval = () => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored === null || stored === 'null') {
    return null; 
  }
  const parsed = parseInt(stored, 10);
  return isNaN(parsed) ? null : parsed; 
};

  const [refreshInterval, setRefreshInterval] = useState(getStoredInterval);

  // Sync across multiple tabs
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === LOCAL_STORAGE_KEY) {
        if (event.newValue === null || event.newValue === 'null') {
          setRefreshInterval(null);
          console.log('[RefreshContext] Synced: refresh disabled');
        } else {
          const newInterval = parseInt(event.newValue, 10);
          if (!isNaN(newInterval)) {
            setRefreshInterval(newInterval);
            console.log('[RefreshContext] Synced interval from another tab:', newInterval);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateInterval = (newInterval) => {
    if (newInterval === null) {
      localStorage.setItem(LOCAL_STORAGE_KEY, 'null');
      setRefreshInterval(null);
      console.log('[RefreshContext] Refresh disabled');
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(newInterval));
      setRefreshInterval(newInterval);
      console.log('[RefreshContext] Interval updated to:', newInterval);
    }
  };

  return (
    <RefreshContext.Provider value={{ refreshInterval, setRefreshInterval: updateInterval }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefreshSettings = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefreshSettings must be used within RefreshProvider');
  }
  return context;
};
