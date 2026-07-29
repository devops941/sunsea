import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './hooks/reduxHooks';
import { initializeAuth } from './features/auth/authSlice';
import AppRoutes from './routes/AppRoutes';
import CommonLoader from './components/ui/Loader/CommonLoader';
import Logo from "../../frontend/public/loaderimage.png";
import { SocketProvider } from './providers/SocketProvider';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isInitialized } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  if (!isInitialized) {
    return (
      <CommonLoader text="Loading..." image={Logo} />
    );
  }

  return (
    <SocketProvider>
      <AppRoutes />
    </SocketProvider>
  );
};

export default App;