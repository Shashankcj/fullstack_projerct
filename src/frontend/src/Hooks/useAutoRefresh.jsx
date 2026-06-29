import { useEffect, useRef } from 'react';

export const useAutoRefresh = (intervalMinutes, onRefresh) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    console.log('useAutoRefresh effect triggered:', { 
      intervalMinutes, 
      hasOnRefresh: !!onRefresh,
      currentIntervalId: intervalRef.current 
    });
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      console.log('Cleared previous interval:', intervalRef.current);
      intervalRef.current = null;
    }

    // Set up new interval if conditions are met
    if (intervalMinutes > 0 && onRefresh) {
      const intervalMs = intervalMinutes * 60 * 1000;
      console.log(`Setting up auto-refresh: ${intervalMinutes} minutes = ${intervalMs}ms`);
      
      intervalRef.current = setInterval(() => {
        console.log(`AUTO-REFRESH TRIGGERED at ${new Date().toLocaleTimeString()}`);
        onRefresh();
      }, intervalMs);
      
      console.log('Auto-refresh interval set with ID:', intervalRef.current);
    } else {
      console.log('Auto-refresh NOT set:', { 
        intervalMinutes: intervalMinutes || 'falsy', 
        hasOnRefresh: !!onRefresh 
      });
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        console.log('Cleaning up interval on unmount/change:', intervalRef.current);
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [intervalMinutes, onRefresh]);

  // Return cleanup function for manual clearing if needed
  return () => {
    if (intervalRef.current) {
      console.log('Manual cleanup called for interval:', intervalRef.current);
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
};
