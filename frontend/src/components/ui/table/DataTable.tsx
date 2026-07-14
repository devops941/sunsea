import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";



export interface DataTableColumn<T> {
  header: string;
  /** Simple key lookup on the row object */
  accessor?: keyof T;
  /** Custom cell renderer — receives the row and its index. Overrides `accessor` if both given. */
  render?: (row: T, index: number) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface DataTablePagination {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  pagination?: DataTablePagination;
  className?: string;
}

const alignClass: Record<NonNullable<DataTableColumn<any>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = "No records found.",
  pagination,
  className = "",
}: DataTableProps<T>) {
  return (
    <div className={`w-full overflow-x-auto rounded-lg border border-gray-100 ${className}`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-blue-50">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-4 py-3.5 font-semibold text-xs tracking-wide uppercase text-primary
                                    ${col.width ? `w-[${col.width}]` : ""}
                                    ${alignClass[col.align ?? "left"]}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="text-center p-6 text-gray-500">
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-red-600 animate-spin" />
                  Loading...
                </span>
              </td>
            </tr>
          ) : data.length > 0 ? (
            data.map((row, index) => (
              <tr
                key={rowKey(row)}
                className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-3.5 text-gray-700 ${alignClass[col.align ?? "left"]}`}
                  >
                    {col.render
                      ? col.render(row, index)
                      : col.accessor
                        ? String(row[col.accessor] ?? "")
                        : null}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="text-center p-6 text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-100">
          <button
            type="button"
            disabled={pagination.currentPage === 1}
            onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
            className="flex items-center justify-center h-8 w-8 rounded-md border border-gray-200
                            text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50
                            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
                            transition-colors"
          >
            <FaChevronLeft size={12} />
          </button>
          <div className="text-sm text-gray-600 font-medium">
            Page {pagination.currentPage} of {pagination.totalPages}
          </div>
          <button
            type="button"
            disabled={pagination.currentPage === pagination.totalPages}
            onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
            className="flex items-center justify-center h-8 w-8 rounded-md border border-gray-200
                            text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50
                            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
                            transition-colors"
          >
            <FaChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

export default DataTable;