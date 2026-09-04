import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

import { useAppSelector } from '../../hooks/reduxHooks';
import Navbar from '../common/Navbar';
import Sidebar from '../common/sidebar/Sidebar';
import HorizontalNav from '../common/sidebar/HorizontalNav';
import Footer from '../common/Footer';
import ShortcutPanel from '../ui/ShortcutPanel/ShortcutPanel';
import Calculator from '../ui/Calculator/Calculator';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';

const BaseLayout = () => {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);
  const { data: company } = useAppSelector((state) => state.company);

  // ── Shortcut panel: closed on /dashboard, open everywhere else ──
  const isDashboard = location.pathname === '/dashboard';
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('shortcut_panel_open');
      if (saved !== null) return saved === 'true';
    } catch (_) {}
    return !isDashboard;
  });

  // When route changes, apply the route-based default only if the user
  // hasn't explicitly toggled the panel in this session.
  const userToggledRef = { current: localStorage.getItem('shortcut_panel_open') !== null };
  useEffect(() => {
    if (!userToggledRef.current) {
      setPanelOpen(!isDashboard);
    }
  }, [isDashboard]);

  const handleTogglePanel = useCallback(() => {
    setPanelOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem('shortcut_panel_open', String(next)); } catch (_) {}
      return next;
    });
  }, []);

  // ── Calculator ──────────────────────────────────────────────────
  const [calcOpen, setCalcOpen] = useState(false);
  const handleOpenCalculator = useCallback(() => setCalcOpen(true), []);

  // ── Global keyboard shortcuts ───────────────────────────────────
  const handleToggleSidebar = useCallback(() => {
    if (window.innerWidth < 1024) {
      setShowSidebar((prev) => !prev);
    } else {
      handleTogglePanel();
    }
  }, [handleTogglePanel]);

  const { activeKey } = useGlobalShortcuts({
    onTogglePanel: handleTogglePanel,
    onToggleSidebar: handleToggleSidebar,
    onOpenCalculator: handleOpenCalculator,
  });

  // ── Company favicon ─────────────────────────────────────────────
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
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}
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

        {/* Horizontal Navigation (Large screens) */}
        <HorizontalNav />

        {/* Content row: main + shortcut panel side by side */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Main Content */}
          <main className="flex-1 w-full min-w-0 overflow-y-auto bg-page">
            <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 min-h-full flex flex-col">
              <Outlet />
            </div>
          </main>

          {/* Shortcut Panel — right side */}
          <ShortcutPanel
            activeKey={activeKey}
            isOpen={panelOpen}
            onToggle={handleTogglePanel}
            onOpenCalculator={handleOpenCalculator}
          />
        </div>

        <Footer />
      </div>

      {/* Floating Calculator (F10) */}
      {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}
    </div>
  );
};

export default BaseLayout;
