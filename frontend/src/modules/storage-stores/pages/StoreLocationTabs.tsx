import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaWarehouse, FaMapMarkerAlt, FaCogs } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import StoreTypeList from "../../store-types/pages/StoreTypeList";
import StorageStoreList from "../../storage-stores/pages/StorageStoreList";
import LocationList from "../../locations/pages/LocationList";

const StoreLocationTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/store-types": "types",
        "/storage-stores": "stores",
        "/locations": "locations"
    };

    const keyToPath: Record<string, string> = {
        "types": "/store-types",
        "stores": "/storage-stores",
        "locations": "/locations"
    };

    const activeTab = pathToKey[location.pathname] || "types";

    const tabs: TabItem[] = [
        { key: "stores", label: "Storage Stores", icon: <FaWarehouse />, content: <StorageStoreList /> },
        { key: "types", label: "Store Types", icon: <FaCogs />, content: <StoreTypeList /> },
        { key: "locations", label: "Locations", icon: <FaMapMarkerAlt />, content: <LocationList /> }
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

export default StoreLocationTabs;
