import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaUserFriends, FaHandshake, FaDatabase, FaBoxes, FaWarehouse, FaIndustry, FaUsersCog } from "react-icons/fa";
import Tabs from "../ui/tab/Tabs";
import type { TabItem } from "../ui/tab/Tabs";

import CustomerListPage from "../../modules/customers/pages/CustomerListPage";
import SupplierListPage from "../../modules/supplier/pages/SupplierList";
import ProductMasterTabs from "../../modules/product/pages/ProductMasterTabs";
import RawMaterialMasterTabs from "../../modules/raw-materials/pages/RawMaterialMasterTabs";
import StoreLocationTabs from "../../modules/storage-stores/pages/StoreLocationTabs";
import MachineList from "../../modules/machines/pages/MachineList";
import HROrganizationTabs from "../../modules/employee/pages/HROrganizationTabs";

const MasterTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/customers": "customers",
        "/suppliers": "suppliers",

        "/products": "products",
        "/categories": "products",
        "/uoms": "products",
        "/colours": "products",
        "/sizes": "products",

        "/raw-materials": "raw_materials",
        "/raw-material-categories": "raw_materials",

        "/store-types": "stores",
        "/storage-stores": "stores",
        "/locations": "stores",

        "/machines": "machines",

        "/employees": "hr",
        "/departments": "hr",
        "/shifts": "hr"
    };

    const keyToPath: Record<string, string> = {
        "customers": "/customers",
        "suppliers": "/suppliers",
        "products": "/products",
        "raw_materials": "/raw-materials",
        "stores": "/store-types",
        "machines": "/machines",
        "hr": "/employees"
    };

    const activeTab = pathToKey[location.pathname] || "customers";

    const tabs: TabItem[] = [
        { key: "customers", label: "Customers", icon: <FaUserFriends />, content: <CustomerListPage /> },
        { key: "suppliers", label: "Suppliers", icon: <FaHandshake />, content: <SupplierListPage /> },
        { key: "products", label: "Product Masters", icon: <FaDatabase />, content: <ProductMasterTabs /> },
        { key: "raw_materials", label: "Raw Material Masters", icon: <FaBoxes />, content: <RawMaterialMasterTabs /> },
        { key: "stores", label: "Store & Locations", icon: <FaWarehouse />, content: <StoreLocationTabs /> },
        { key: "machines", label: "Machines", icon: <FaIndustry />, content: <MachineList /> },
        { key: "hr", label: "HR & Organization", icon: <FaUsersCog />, content: <HROrganizationTabs /> }
    ];

    const handleTabChange = (key: string) => {
        const targetPath = keyToPath[key];
        if (targetPath) {
            navigate(targetPath);
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} align="center" />
            </Container>
        </div>
    );
};

export default MasterTabs;
