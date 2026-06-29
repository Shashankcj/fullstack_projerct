import React, { createContext, useState, useCallback, useContext, useRef } from 'react';

const SidebarContext = createContext();

export const SidebarProvider = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return localStorage.getItem('sidebarOpen') === 'true';
  });

  // ✅ Use useRef instead of state to avoid re-renders
  const ignoreNextOverlayClickRef = useRef(false);

  // ✅ Toggle sidebar with no dependencies
  const toggleSidebar = useCallback((source = 'unknown') => {
    
    // Set ignore flag
    ignoreNextOverlayClickRef.current = true;
    setTimeout(() => {
      ignoreNextOverlayClickRef.current = false;
    }, 300);

    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarOpen', next);
      return next;
    });
  }, []); 

  // ✅ Close sidebar with no dependencies
  const closeSidebar = useCallback(() => {
    if (ignoreNextOverlayClickRef.current) {
      return;
    }
    
    setIsSidebarOpen(false);
    localStorage.setItem('sidebarOpen', 'false');
  }, []); // ✅ No dependencies - avoids stale closures

  return (
    <SidebarContext.Provider
      value={{
        isSidebarOpen,
        toggleSidebar,
        closeSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
