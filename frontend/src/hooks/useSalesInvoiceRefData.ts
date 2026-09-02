import { useCallback } from "react";
import { useDetailCache } from "./useDetailCache";
import { customerService } from "../services/customerService";
import { productService } from "../services/productService";
import { invoiceSettingsService } from "../services/invoiceSettingsService";
import { salesInvoiceService } from "../services/salesInvoiceService";
import { salesOrderService } from "../services/salesOrderService";
import { salesProductService } from "../services/salesProductService";
import { finishedGoodsStockService } from "../services/finishedGoodsStockService";

export interface SalesInvoiceRefData {
  customersRaw: any[];
  customers: { id: string; name: string }[];
  items: { id: string; name: string; defaultRate: number; gstRate: number }[];
  invoiceSettings: any;
  allOrders: any[];
  salesOrders: any[];
  salesProducts: any[];
  stockMap: Map<string, number>;
}

const CACHE_KEY = "salesInvoice:refData";

export function useSalesInvoiceRefData() {
  const fetcher = useCallback(async (_signal: AbortSignal): Promise<SalesInvoiceRefData> => {
    const [customerList, productList, settings, ordersResponse, salesOrdersResponse, fgStockResponse, salesProductsData] =
      await Promise.all([
        customerService.fetchAll({ limit: 1000 } as any).catch(() => ({ customers: [] })),
        productService.fetchAll().catch(() => []),
        invoiceSettingsService.getConfig().catch(() => null),
        salesInvoiceService.fetchAll({ pageSize: 100 }).catch(() => ({ data: [] } as any)),
        salesOrderService.fetchAll({ pageSize: 100 }).catch(() => ({ data: [] } as any)),
        finishedGoodsStockService.fetchAll().catch(() => []),
        salesProductService.fetchAll().catch(() => []),
      ]);

    const customersArray = Array.isArray(customerList)
      ? customerList
      : (customerList as any)?.customers || (customerList as any)?.data || [];

    const customers = customersArray.map((c: any) => ({
      id: c.id,
      name: c.firmName || c.displayName || c.customerCode || "Unknown Customer",
    }));

    const items = (productList || [])
      .filter((p: any) => p.productType === "SALES_PRODUCTION")
      .map((p: any) => ({
        id: String(p.id),
        name: p.productName,
        defaultRate: Number(p.mrp) || Number(p.b2b) || 0,
        gstRate: Number(p.gstRate) || 0,
      }));

    const ordersList = ordersResponse?.data || (ordersResponse as any)?.orders || [];

    const rawSalesOrdersList: any[] = salesOrdersResponse?.data || (salesOrdersResponse as any)?.orders || [];
    const salesOrders = rawSalesOrdersList.filter((so: any) => so && ["CONFIRMED", "QUOTED"].includes(so.status));

    const fgList: any[] = Array.isArray(fgStockResponse) ? fgStockResponse : (fgStockResponse as any).data || [];
    const stockMap = new Map<string, number>();
    fgList.forEach((fg: any) => {
      const prodId = (fg.productItemId || fg.productId)?.toString();
      if (prodId) stockMap.set(prodId, (stockMap.get(prodId) || 0) + Number(fg.onHandQty || 0));
    });

    const spList = Array.isArray(salesProductsData) ? salesProductsData.filter((sp: any) => sp.isActive !== false) : [];

    return {
      customersRaw: customersArray,
      customers,
      items,
      invoiceSettings: settings,
      allOrders: ordersList,
      salesOrders,
      salesProducts: spList,
      stockMap,
    };
  }, []);

  const { data, loading, refreshing, refresh } = useDetailCache<SalesInvoiceRefData>({
    cacheKey: CACHE_KEY,
    socketModule: "salesInvoice",
    fetcher,
    ttl: 120_000,
  });

  return { data, loading, refreshing, refresh };
}
