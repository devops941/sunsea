import React, { useState } from "react";
import { FaSearch } from "react-icons/fa";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import { useUOM } from "../../../hooks/useUOM";

const ITEMS_PER_PAGE = 15;

const UOMList: React.FC = () => {
    const { units, loading, error } = useUOM();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    usePageShortcuts({});

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
        <div>
            <div>
                <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                        <div>
                            <h2 className="text-2xl font-bold text-ink">UOM Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            <div className="relative w-full md:w-72">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-card border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search by code, name, or category..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                    data-search-input
                                />
                            </div>
                        </div>
                    </div>

                    {/* UOMs Table */}
                    {error ? (
                        <div className="text-center p-5 text-red-500">
                            {error}
                        </div>
                    ) : (
                        <div className="p-0">
                            <DataTable
                                columns={columns}
                                data={paginatedUOMs}
                                rowKey={(row) => `${row.category}-${row.code}`}
                                loading={loading}
                                emptyMessage="No UOMs found."
                                pagination={totalPages > 1 ? {
                                    currentPage,
                                    totalPages,
                                    onPageChange: setCurrentPage
                                } : undefined}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UOMList;
