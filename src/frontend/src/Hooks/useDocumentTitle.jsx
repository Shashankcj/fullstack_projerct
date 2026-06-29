
import { useEffect } from 'react';

export const useDocumentTitle = (title) => {
  useEffect(() => {
    const prev = document.title;
    document.title =`Genesis | ${title}`;
    return () => { document.title = prev; };  
  }, [title]);
};
