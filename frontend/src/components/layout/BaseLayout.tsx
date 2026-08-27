import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { useAppSelector } from '../../hooks/reduxHooks';
import Navbar from '../common/Navbar';
import Sidebar from '../common/sidebar/Sidebar';
import HorizontalNav from '../common/sidebar/HorizontalNav';
import Footer from '../common/Footer';

const BaseLayout = () => {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { data: company } = useAppSelector((state) => state.company);

  useEffect(() => {
    if (company?.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = company.faviconUrl;
    }
  }, [company?.faviconUrl]);

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        ></div>
      )}

      {/* Mobile Sidebar Drawer (Only on small screens < lg) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${showSidebar ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Top Navbar (Mobile only) */}
        <div className="lg:hidden">
          <Navbar
            onMenuClick={() => setShowSidebar(true)}
            user={user}
            onProfileClick={() => navigate('/company/view')}
          />
        </div>

        {/* Horizontal Navigation (Large screens and up) */}
        <HorizontalNav />

        {/* Main Content */}
        <main className="flex-1 w-full min-w-0 overflow-y-auto bg-page">
          <div className="w-full max-w-[1920px]">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default BaseLayout;