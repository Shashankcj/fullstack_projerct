
import  { useEffect } from 'react';

const BootStrapLayout = ({ children }) => {
  useEffect(() => {
    import('bootstrap/dist/css/bootstrap.min.css');
    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []);

  return <div>{children}</div>;
};

export default BootStrapLayout;
