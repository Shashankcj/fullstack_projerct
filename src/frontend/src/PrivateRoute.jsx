import  { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import backendApi from './api/backendAxiosInstance';
import { useAuth } from './Contexts/AuthContext';


const PrivateRoute = ({ children }) => {
  const {
    authenticated,
    setAuthenticated,
    user,
    setUser,
    loading,
    setLoading
  } = useAuth();

  useEffect(() => {
    setLoading(true);
backendApi.get('/get/logged-in-user-details/', { withCredentials: true })
      .then(res => {
        if (res.status === 200) {
          setAuthenticated(true);
          setUser(res.data.user); 
        } else {
          setAuthenticated(false);
          setUser(null);
        }
      })
      .catch(() => {
        setAuthenticated(false);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [setLoading, setAuthenticated, setUser]);

  if (loading) return <div>Loading...</div>;

  return authenticated ? children : <Navigate to="/signin" />;
};

export default PrivateRoute;
