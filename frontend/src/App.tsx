import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './hooks/reduxHooks';
import { initializeAuth } from './features/auth/authSlice';
import AppRoutes from './routes/AppRoutes';
import CommonLoader from './components/ui/Loader/CommonLoader';
import { SocketProvider } from './providers/SocketProvider';
// import ErrorBoundary from './components/common/ErrorBoundary';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isInitialized } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  if (!isInitialized) {
    return (
      <CommonLoader text="Loading..." />
    );
  }

  return (
    // <ErrorBoundary>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    // </ErrorBoundary>
  );
};

export default App;