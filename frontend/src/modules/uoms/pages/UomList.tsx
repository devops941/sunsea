import React, { useState } from "react";
import { FaSearch } from "react-icons/fa";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import { useUOM } from "../../../hooks/useUOM";

const ITEMS_PER_PAGE = 10;

const UOMList: React.FC = () => {
    const { units, loading, error } = useUOM();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reset to first page on search
    };

    // Filter units based on the search term
    const filteredUnits = units.filter(u => {
        const searchLower = searchTerm.toLowerCase();
        return (u.code || '').toLowerCase().includes(searchLower) || 
               (u.label || '').toLowerCase().includes(searchLower) ||
               (u.category || '').toLowerCase().includes(searchLower);
    });

    const totalPages = Math.ceil(filteredUnits.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedUOMs = filteredUnits.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        { header: "Category", accessor: "category", render: (uom) => <span style={{ textTransform: 'capitalize' }}>{uom.category}</span> },
        { header: "Code", accessor: "code" },
        { header: "Label / Name", accessor: "label" }
    ];

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">UOM Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            <div className="relative w-full md:w-72">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search by code, name, or category..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                        </div>
                    </div>

                    {/* UOMs Table */}
                    {loading && units.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center p-5 text-red-500">
                            {error}
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={paginatedUOMs}
                            rowKey={(row) => `${row.category}-${row.code}`}
                            emptyMessage="No UOMs found."
                            pagination={totalPages > 1 ? {
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage
                            } : undefined}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default UOMList;
