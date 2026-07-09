import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Offcanvas } from 'react-bootstrap';

import { useAppSelector } from '../../hooks/reduxHooks';
import Navbar from '../common/Navbar';
import Sidebar from '../common/sidebar/Sidebar';
import Footer from '../common/Footer';

const BaseLayout = () => {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const searchCategories = [
    { value: 'all', label: 'All Modules' },
    { value: 'sales-order', label: 'Sales Orders' },
    { value: 'products', label: 'Products' },
    { value: 'customers', label: 'Customers' },
    { value: 'suppliers', label: 'Suppliers' },
  ];

  const handleGlobalSearch = (query: string, category: string) => {
    if (!query.trim()) return;
    
    // Navigate to the specific module with search query
    if (category === 'all') {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    } else {
      navigate(`/${category}?search=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="layout">

      {/* Desktop Sidebar */}
      <div className="layout-sidebar">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <Offcanvas
        show={showSidebar}
        onHide={() => setShowSidebar(false)}
        placement="start"
        className="mobile-sidebar"
      >
        <Offcanvas.Body className="p-0">
          <Sidebar />
        </Offcanvas.Body>
      </Offcanvas>

      <div className="layout-content">

        <Navbar
          onMenuClick={() => setShowSidebar(true)}
          user={user}
          onProfileClick={() => navigate('/profile')}
          searchPlaceholder="Enter keyword to search..."
          searchCategories={searchCategories}
          onSearch={handleGlobalSearch}
          notificationsCount={3}
          showLiveStatus={true}
          liveStatusText="Live"
        />

        <main className="main-content">
          <Outlet />
        </main>

        <Footer />

      </div>

    </div>
  );
};

export default BaseLayout;