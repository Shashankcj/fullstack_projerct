import { useState, useCallback } from 'react';

const usePersistedTheme = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      const savedTheme = localStorage.getItem('app-theme-preference');
      return savedTheme ? JSON.parse(savedTheme) : false;
    } catch (error) {
      console.warn('Failed to load theme preference:', error);
      return false;
    }
  });

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      
      try {
        localStorage.setItem('app-theme-preference', JSON.stringify(newTheme));
      } catch (error) {
        console.warn('Failed to save theme preference:', error);
      }
      
      return newTheme;
    });
  }, []);

  return { isDarkMode, toggleTheme };
};

export default usePersistedTheme;











