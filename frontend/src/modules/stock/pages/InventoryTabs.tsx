import React, { useState, useEffect, useMemo } from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FaBoxes, FaBoxOpen, FaSlidersH, FaHistory } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";
import { usePermission } from "../../../hooks/usePermission";
import { storeService } from "../../../services/storeService";

import StockList from "../../stock/pages/StockList";
import FinishedStockList from "../../finished-stock/pages/FinishedStockList";
import StockAdjustmentList from "../../stock-adjustments/pages/StockAdjustmentList";
import EodStockList from "../../Eodstock/pages/EodStockList";

const InventoryTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { can } = usePermission();

    const [stores, setStores] = useState<any[]>([]);

    useEffect(() => {
        if (!can("raw_material_stocks.view") && !can("finished_goods_stocks.view")) return;
        const fetchStores = async () => {
            try {
                const res = await storeService.fetchAll();
                const allStores = res?.stores || res || [];
                setStores(allStores.filter((s: any) => s.isActive));
            } catch (err) {
                console.error("Failed to fetch stores for tabs", err);
            }
        };
        fetchStores();
    }, [can]);

    const pathToKey: Record<string, string> = {
        "/inventory/stock-adjustments": "adjustments",
        "/inventory/eod-stock": "eod-stock",
    };

    const keyToPath: Record<string, string> = {
        "adjustments": "/inventory/stock-adjustments",
        "eod-stock": "/inventory/eod-stock",
    };

    const dynamicStoreTabs = useMemo(() => {
        const canViewRaw = can("raw_material_stocks.view");
        const canViewFG = can("finished_goods_stocks.view");
        if (!canViewRaw && !canViewFG) return [];

        return stores.map((store) => {
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

            if (isFinishedGoods && !canViewFG) return null;
            if (!isFinishedGoods && !canViewRaw) return null;

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
        }).filter((t) => t !== null) as TabItem[];
    }, [stores, can]);

    const staticTabs = useMemo<TabItem[]>(() => {
        const result: TabItem[] = [];
        if (can("stock-adjustments.view")) {
            result.push({ key: "adjustments", label: "Stock Adjustment", icon: <FaSlidersH />, content: <StockAdjustmentList /> });
        }
        if (can("eod-stock.view")) {
            result.push({ key: "eod-stock", label: "EOD Stock", icon: <FaHistory />, content: <EodStockList /> });
        }
        return result;
    }, [can]);

    const tabs: TabItem[] = [...dynamicStoreTabs, ...staticTabs];

    const urlStoreId = searchParams.get("storeId");
    let activeTab = urlStoreId ? `store_${urlStoreId}` : pathToKey[location.pathname];
    if (!activeTab || !tabs.some(t => t.key === activeTab)) {
        activeTab = tabs[0]?.key || "adjustments";
    }

    const handleTabChange = (key: string) => {
        if (key.startsWith("store_")) {
            const storeId = key.replace("store_", "");
            navigate(`/stock?storeId=${storeId}`);
        } else {
            const targetPath = keyToPath[key];
            if (targetPath) navigate(targetPath);
        }
    };

    if (tabs.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                You don't have permission to view any Inventory sections.
            </div>
        );
    }

    return (
        <div className="inner-container">
            <Container fluid>
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} align="left" />
            </Container>
        </div>
    );
};

export default InventoryTabs;
