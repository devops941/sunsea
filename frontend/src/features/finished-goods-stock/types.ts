export interface FinishedGoodsStock {
    storeId: string;
    productItemId: string;
    onHandQty: string | number;
    reservedQty?: string | number;
    store?: {
        storeId: string;
        storeName: string;
    };
    product?: {
        id: string;
        productName: string;
        productCode: string;
        colorType: string;
        category?: {
            id: string;
            categoryName: string;
        };
        uom?: {
            id: string;
            name: string;
        };
    };
    createdAt: string;
    updatedAt: string;
}

export interface CreateFinishedGoodsStockDto {
    storeId: string;
    productItemId: string;
    onHandQty: string | number;
}

export interface UpdateFinishedGoodsStockDto {
    onHandQty?: string | number;
    reservedQty?: string | number;
}

export interface FinishedGoodsStockState {
    data: FinishedGoodsStock[];
    loading: boolean;
    error: string | null;
}
