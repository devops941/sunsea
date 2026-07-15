import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaUsers, FaClock, FaUserTie, FaTruck, FaCogs, FaBox, FaTags, FaWeightHanging, FaPalette, FaRulerCombined, FaBoxes, FaLayerGroup } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import Employeelist from "../../employee/pages/EmployeeList";
import ShiftList from "../../shifts/pages/ShiftList";
import CustomerListPage from "../../customers/pages/CustomerListPage";
import SupplierListPage from "../../supplier/pages/SupplierList";
import MachineList from "../../machines/pages/MachineList";
import ProductList from "../../product/pages/ProductList";
import CategoryList from "../../product/pages/CategoryList";
import UomList from "../../product/pages/UOMList";
import ColourList from "../../product/pages/ColorList";
import SizeList from "../../product/pages/SizeList";
import RawMaterialList from "../../raw-materials/pages/RawMaterialList";
import RawMaterialCategoryList from "../../raw-material-categories/pages/RawMaterialCategoryList";

const HROrganizationTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/employees": "employees",
        "/shifts": "shifts",
        "/customers": "customers",
        "/suppliers": "suppliers",
        "/machines": "machines",
        "/raw-materials": "raw_materials",
        "/raw-material-categories": "raw_material_categories",

        "/products": "products",
        "/categories": "categories",
        "/uoms": "uoms",
        "/colours": "colours",
        "/sizes": "sizes",
        
    };

    const keyToPath: Record<string, string> = {
        "employees": "/employees",
        "shifts": "/shifts",
        "customers": "/customers",
        "suppliers": "/suppliers",
        "machines": "/machines",
        "products": "/products",
        "categories": "/categories",
        "uoms": "/uoms",
        "colours": "/colours",
        "sizes": "/sizes",
        "raw_materials": "/raw-materials",
        "raw_material_categories": "/raw-material-categories"
    };

    const activeTab = pathToKey[location.pathname] || "employees";

    const tabs: TabItem[] = [
        { key: "employees", label: "Employees", icon: <FaUsers />, content: <Employeelist /> },
        { key: "customers", label: "Customers", icon: <FaUserTie />, content: <CustomerListPage /> },
        { key: "suppliers", label: "Suppliers", icon: <FaTruck />, content: <SupplierListPage /> },
        { key: "shifts", label: "Shift Management", icon: <FaClock />, content: <ShiftList /> },
        { key: "machines", label: "Machines", icon: <FaCogs />, content: <MachineList /> },
        { key: "raw_materials", label: "Raw Materials", icon: <FaBoxes />, content: <RawMaterialList /> },

        { key: "products", label: "Products", icon: <FaBox />, content: <ProductList /> },
        { key: "categories", label: "Categories", icon: <FaTags />, content: <CategoryList /> },
        { key: "uoms", label: "UOM", icon: <FaWeightHanging />, content: <UomList /> },
        { key: "colours", label: "Colors", icon: <FaPalette />, content: <ColourList /> },
        { key: "sizes", label: "Sizes", icon: <FaRulerCombined />, content: <SizeList /> },
        { key: "raw_material_categories", label: "RM Categories", icon: <FaLayerGroup />, content: <RawMaterialCategoryList /> }
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
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} />
            </Container>
        </div>
    );
};

export default HROrganizationTabs;
