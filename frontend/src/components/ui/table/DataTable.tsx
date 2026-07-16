import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export interface DataTableColumn<T> {
  header: string;
  /** Simple key lookup on the row object */
  accessor?: keyof T;
  /** Custom cell renderer — receives the row and its index. Overrides `accessor` if both given. */
  render?: (row: T, index: number) => React.ReactNode;
  /** Optional explicit width (e.g. "50px"). If omitted, common columns
   *  (#, STATUS, ACTIONS, PRIORITY, etc.) get a sensible default width
   *  automatically based on their header text — see AUTO_WIDTH_BY_HEADER.
   *  Anything else stays tight around its own content (no stretching);
   *  leftover space becomes even gaps between columns instead. */
  width?: string;
  /** Optional alignment for this column's header and cells. Defaults to "left" if not set. */
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
  emptyMessage?: React.ReactNode;
  pagination?: DataTablePagination;
  className?: string;
  /** Optional row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Optional function to render a full-width sub-row underneath a row */
  renderSubRow?: (row: T, index: number) => React.ReactNode;
  /** Optional custom class names for the row */
  rowClassName?: (row: T, index: number) => string;
  /** Optional inline styles for the row */
  getRowStyle?: (row: T, index: number) => React.CSSProperties;
  /** Optional override for the default min-height classes */
  minHeightClassName?: string;
}

const alignClass: Record<NonNullable<DataTableColumn<any>["align"]>, string> = {
  left: "text-left justify-start",
  center: "text-center justify-center",
  right: "text-right justify-end",
};

// Shared minimum height for the table region — applied identically whether
// the table is loading, has data, or is empty, so the surrounding layout
// never jumps as the state changes.
const TABLE_MIN_HEIGHT_CLASS = "min-h-[200px] sm:min-h-[280px] md:min-h-[calc(100vh-370px)]";

function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = "No records found.",
  pagination,
  className = "",
  onRowClick,
  renderSubRow,
  rowClassName,
  getRowStyle,
  minHeightClassName = TABLE_MIN_HEIGHT_CLASS,
}: DataTableProps<T>) {
  // By using `minmax(max-content, 1fr)`:
  // 1. `max-content` ensures the column is always wide enough for its content without squishing/wrapping text.
  // 2. `1fr` ensures any leftover table space is distributed equally, so the table stretches to fill 100% width.
  // 3. If the total max-content exceeds the screen, it naturally forces the responsive horizontal scrollbar!
  const gridTemplateColumns = columns.map((col) => col.width ?? "minmax(max-content, 1fr)").join(" ");

  // On the outer grid, using 1fr tracks allows leftover width to stretch the
  // flexible columns themselves, so headers and content fill the space equally.
  const outerGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns,
    minWidth: "100%",
  };

  // Each row spans every column and uses `subgrid` so it inherits the exact
  // same track sizes/positions computed by the outer grid above.
  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridColumn: "1 / -1",
    gridTemplateColumns: "subgrid",
  };

  const fullSpanStyle: React.CSSProperties = { gridColumn: "1 / -1" };

  return (
    <div className={`w-full  border border-gray-100 overflow-hidden ${className}`}>
      {/*
        This outer region is a flex column with a fixed min-height, shared by
        every state (loading / data / empty). The scrollable table sits on
        top; a flexible filler div below it grows to soak up any leftover
        vertical space, so short tables (or the empty/loading placeholder)
        still occupy the full min-height instead of collapsing to their own
        content size. If real data ever exceeds the min-height, the filler
        just shrinks to 0 and the table grows past it naturally.
      */}
      <div className={`flex flex-col ${minHeightClassName}`}>
        <div
          className="w-full overflow-x-auto overscroll-x-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div role="table" className="text-sm" style={outerGridStyle}>
            {/* Header row */}
            <div role="row" style={rowStyle} className="bg-[#E5EAEF]">
              {columns.map((col, i) => (
                <div
                  key={i}
                  role="columnheader"
                  className={`flex items-center px-3 py-3 sm:px-4 sm:py-3.5 font-semibold text-[11px] sm:text-xs tracking-wide uppercase text-[#2A3547] whitespace-nowrap ${alignClass[col.align ?? "left"]}`}
                >
                  {col.header}
                </div>
              ))}
            </div>

            {/* Body */}
            {loading ? (
              <div role="row" style={rowStyle}>
                <div style={fullSpanStyle} className="text-center p-6 text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-red-600 animate-spin" />
                    Loading...
                  </span>
                </div>
              </div>
            ) : data.length > 0 ? (
              data.map((row, index) => {
                const subRow = renderSubRow ? renderSubRow(row, index) : null;
                const extraClassName = rowClassName ? rowClassName(row, index) : "";
                const extraStyle = getRowStyle ? getRowStyle(row, index) : {};
                return (
                  <React.Fragment key={rowKey(row)}>
                    <div
                      role="row"
                      style={{ ...rowStyle, ...extraStyle }}
                      className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${onRowClick ? "cursor-pointer" : ""} ${extraClassName}`}
                      onClick={() => onRowClick && onRowClick(row, index)}
                    >
                      {columns.map((col, ci) => (
                        <div
                          key={ci}
                          role="cell"
                          className={`flex items-center px-3 py-3 sm:px-4 sm:py-3.5 text-gray-700 min-w-0 ${alignClass[col.align ?? "left"]}`}
                        >
                          {col.render
                            ? col.render(row, index)
                            : col.accessor
                              ? String(row[col.accessor] ?? "")
                              : null}
                        </div>
                      ))}
                    </div>
                    {subRow && (
                      <div role="row" style={rowStyle}>
                        <div style={fullSpanStyle} onClick={(e) => e.stopPropagation()}>
                          {subRow}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <div role="row" style={rowStyle}>
                <div
                  style={fullSpanStyle}
                  className="text-center p-6 text-base sm:text-lg text-gray-500"
                >
                  {emptyMessage}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filler: grows to fill any leftover vertical space so every state
            reaches the same overall min-height. Purely visual, no content. */}
        <div className="flex-1" aria-hidden="true" />
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 sm:gap-4 py-3 sm:py-4 border-t border-gray-100">
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
          <div className="text-xs sm:text-sm text-gray-600 font-medium">
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