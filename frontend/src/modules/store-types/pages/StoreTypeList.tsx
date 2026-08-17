import React from "react";
import { FaBoxes, FaBoxOpen, FaTrashAlt } from "react-icons/fa";

const STORE_CATEGORIES = [
    {
        code: "RAW_MATERIAL",
        name: "Raw Material Store",
        description: "Stores that hold raw materials used in production",
        icon: <FaBoxes className="text-blue-500 text-2xl" />,
        color: "blue",
    },
    {
        code: "FINISHED_GOODS",
        name: "Finished Goods Store",
        description: "Stores that hold completed finished products ready for dispatch",
        icon: <FaBoxOpen className="text-green-500 text-2xl" />,
        color: "green",
    },
    {
        code: "WASTAGE",
        name: "Wastage Store",
        description: "Stores that hold production wastage, scrap, and rejected items",
        icon: <FaTrashAlt className="text-orange-500 text-2xl" />,
        color: "orange",
    },
];

const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
};

const StoreTypeList: React.FC = () => {
    return (
        <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
            <div className="p-6 border-b border-line">
                <h2 className="text-2xl font-bold text-ink">Store Categories</h2>
                <p className="text-sm text-ink-subtle mt-1">
                    Store categories are fixed system-defined types. All stores must belong to one of the following categories.
                </p>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {STORE_CATEGORIES.map((cat) => (
                        <div
                            key={cat.code}
                            className="border border-line rounded-xl p-5 flex flex-col gap-3"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[cat.color].split(' ')[0]}`}>
                                    {cat.icon}
                                </div>
                                <div>
                                    <p className="font-semibold text-ink text-sm">{cat.name}</p>
                                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${colorMap[cat.color]}`}>
                                        {cat.code}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-ink-subtle">{cat.description}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-700 font-medium">
                        System-defined categories — cannot be added, edited, or deleted.
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                        When creating a store, select the appropriate category. Each category controls which forms and modules that store appears in.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StoreTypeList;
