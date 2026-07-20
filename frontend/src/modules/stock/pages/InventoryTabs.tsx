import React, { useState, useEffect } from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FaBoxes, FaBoxOpen, FaSlidersH, FaHistory } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";
import { storeService } from "../../../services/storeService";

import StockList from "../../stock/pages/StockList";
import FinishedStockList from "../../finished-stock/pages/FinishedStockList";
import StockAdjustmentList from "../../stock-adjustments/pages/StockAdjustmentList";
import EodStockList from "../../Eodstock/pages/EodStockList";

const InventoryTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [stores, setStores] = useState<any[]>([]);

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await storeService.fetchAll();
                const allStores = res?.stores || res || [];
                // Only show active stores in the tabs
                setStores(allStores.filter((s: any) => s.isActive));
            } catch (err) {
                console.error("Failed to fetch stores for tabs", err);
            }
        };
        fetchStores();
    }, []);

    // Map pathnames to tab keys for static tabs
    const pathToKey: Record<string, string> = {
        "/inventory/stock-adjustments": "adjustments",
        "/inventory/eod-stock": "eod-stock",
    };

    const keyToPath: Record<string, string> = {
        "adjustments": "/inventory/stock-adjustments",
        "eod-stock": "/inventory/eod-stock",
    };

    let activeTab = pathToKey[location.pathname];

    // If we have a storeId query param, the active tab is that store.
    const urlStoreId = searchParams.get("storeId");
    if (urlStoreId) {
        activeTab = `store_${urlStoreId}`;
    }

    // If no active tab is determined, default to the first store if available
    if (!activeTab && stores.length > 0) {
        activeTab = `store_${stores[0].storeId}`;
    }

    const dynamicStoreTabs: TabItem[] = stores.map((store) => {
        const storeTypeCode = store.storeTypeRef?.code?.toLowerCase() || "";
        const storeTypeName = store.storeTypeRef?.name?.toLowerCase() || "";
        const storeName = (store.storeName || "").toLowerCase();

        const isFinishedGoods =
            String(store.storeTypeId) === "2" ||
            storeTypeCode === "fg" ||
            storeTypeCode === "finished" ||
            storeTypeCode === "finished_goods" ||
            storeTypeName.includes("finished") ||
            storeName.includes("finished");

        return {
            key: `store_${store.storeId}`,
            label: store.storeName,
            icon: isFinishedGoods ? <FaBoxOpen /> : <FaBoxes />,
            content: isFinishedGoods ? (
                <FinishedStockList storeId={store.storeId} />
            ) : (
                <StockList storeId={store.storeId} />
            )
        };
    });

    const tabs: TabItem[] = [
        ...dynamicStoreTabs,
        { key: "adjustments", label: "Stock Adjustment", icon: <FaSlidersH />, content: <StockAdjustmentList /> },
        { key: "eod-stock", label: "EOD Stock", icon: <FaHistory />, content: <EodStockList /> }
    ];

    const handleTabChange = (key: string) => {
        if (key.startsWith("store_")) {
            const storeId = key.replace("store_", "");
            // Use /stock as the base path for all dynamic store tabs
            navigate(`/stock?storeId=${storeId}`);
        } else {
            const targetPath = keyToPath[key];
            if (targetPath) {
                navigate(targetPath);
            }
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} align="left" />
            </Container>
        </div>
    );
};

export default InventoryTabs;
