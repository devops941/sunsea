const config = {
    auth: {
        login: "/auth/login",
        getCurrentUser: "/auth/me",
        logout: "/auth/logout",
        sessions: "/auth/sessions",
        logoutAllSessions: "/auth/logout-all-sessions",
    },
    department: {
        base: "/departments",
    },
    customer: {
        base: "/customers",
    },
    supplier: {
        base: "/suppliers",
    },
    employee: {
        base: "/employees",
        nextCode: "/employees/next-code",
        me: "/employees/me",
    },
    designation: {
        base: "/designations",
    },
    shift: {
        base: "/shifts",
        nextId: "/shifts/next-id",
    },
    role: {
        base: "/roles",
    },
    permission: {
        base: "/permissions",
        rolePermissions: "/role-permissions/role",
        assignRolePermissions: "/role-permissions/assign",
        removeRolePermissions: "/role-permissions/remove",
    },
    user: {
        base: "/users",
    },
    product: {
        base: "/products",
        productNextId: "/products/next-id",
        uom: "/product/uoms",
        uomNextId: "/product/uoms/next-id",
        getActiveUom: "/product/uoms/active",
    },
    store: {
        base: "/stores",
        nextId: "/stores/next-id",
    },
    storeType: {
        base: "/store-types",
        nextId: "/store-types/next-id",
    },
    rawMaterial: {
        base: "/raw-materials",
        nextId: "/raw-materials/next-id",
    },
    rawMaterialStock: {
        base: "/raw-material-stocks",
    },
    machine: {
        base: "/machines",
        nextId: "/machines/next-id",
    },
    productionOrder: {
        base: "/production-orders",
        nextId: "/production-orders/next-id",
    },
    hourlyProduction: {
        base: "/hourly-productions",
    },
    productionWastage: {
        base: "/production-wastages",
    },
    productPricing: {
        base: "/product-pricing",
    },
    salesOrder: {
        addSalesOrder: "/sales-orders",
        getAllSalesOrder: "/sales-orders",
        updateSalesOrder: "/sales-orders",
        deleteSalesOrder: "/sales-orders",
        getNextOrderNo: "/sales-orders/next-code",
        getById: "/sales-orders",              // ← new (base; service appends /:id)
        getStatus: "/sales-orders",            // ← new (base; service appends /:id/status)
        updateDiscounts: "/sales-orders",      // ← new (base; service appends /:id/discounts)
        submitMdApproval: "/sales-orders",     // ← new (base; service appends /:id/submit-md-approval)
        reopen: "/sales-orders",               // ← new (base; service appends /:id/reopen)
        mdApprove: "/sales-orders",            // ← new (base; service appends /:id/md-approve)
        customerApprove: "/sales-orders",

    },
    billOfMaterial: {
        base: "/bill-of-materials",
    },
    salesProduct: {
        base: "/sales-products",
        nextId: "/sales-products/next-id",
    },
    purchaseOrder: {
        base: "/purchase-orders",
        nextId: "/purchase-orders/next-id",
    }, suppliermaterialprice: {
        base: "/supplier-material-prices",
        nextId: "/supplier-material-prices/next-id",
    },
    company: {
        base: "/companies",
    },
    grnInvoice: {
        base: "/grn-invoices",
        nextCode: "/grn-invoices/next-code",
    },
    invoiceSettings: {
        base: "/invoice-settings",
    },
    salesInvoice: {
        base: "/sales-invoices",
    },
    goodsDispatch: {
        base: "/goods-dispatches",
        nextNumber: "/goods-dispatches/next-number",
        eligibleOrders: "/goods-dispatches/eligible-orders",
    },

    productShiftRecord: {
        base: "/product-shift-records",
    },

    productCapacityHistory: {
        base: "/product-capacity-history",
    },

    email: {
        base: "/email-config"
    },
    category: {
        base: "/categories",
        nextCode: "/categories/next-code",
    },
    inventory: {
        eodStock: "/inventory/eod-stock",
    },
    routes: {
        base: "/routes",
    },
}
export default config;