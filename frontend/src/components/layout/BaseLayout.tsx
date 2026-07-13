import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { useAppSelector } from '../../hooks/reduxHooks';
import Navbar from '../common/Navbar';
import Sidebar from '../common/sidebar/Sidebar';
import Footer from '../common/Footer';

const BaseLayout = () => {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        ></div>
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${showSidebar ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        <Navbar
          onMenuClick={() => setShowSidebar(true)}
          user={user}
          onProfileClick={() => navigate('/profile')}
        />

        <main className="flex-1 p-2 min-w-0 overflow-y-auto">
          <Outlet />
        </main>

        <Footer />

      </div>

    </div>
  );
};

export default BaseLayout;