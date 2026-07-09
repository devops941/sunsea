import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './hooks/reduxHooks';
import { initializeAuth } from './features/auth/authSlice';
import AppRoutes from './routes/AppRoutes';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isInitialized } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  if (!isInitialized) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center min-vh-100" style={{ backgroundColor: '#f4f7f9' }}>
        <div className="custom-pulse-loader">S</div>
        <div className="custom-loader-text">SUNSEA ERP</div>
      </div>
    );
  }

  return <AppRoutes />;
};

export default App;