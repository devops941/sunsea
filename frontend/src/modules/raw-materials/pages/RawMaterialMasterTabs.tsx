import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBoxes, FaTags } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import RawMaterialList from "../../raw-materials/pages/RawMaterialList";
import RawMaterialCategoryList from "../../raw-material-categories/pages/RawMaterialCategoryList";

const RawMaterialMasterTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/raw-materials": "materials",
        "/raw-material-categories": "categories"
    };

    const keyToPath: Record<string, string> = {
        "materials": "/raw-materials",
        "categories": "/raw-material-categories"
    };

    const activeTab = pathToKey[location.pathname] || "materials";

    const tabs: TabItem[] = [
        { key: "materials", label: "Raw Materials", icon: <FaBoxes />, content: <RawMaterialList /> },
        { key: "categories", label: "RM Categories", icon: <FaTags />, content: <RawMaterialCategoryList /> }
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

export default RawMaterialMasterTabs;
