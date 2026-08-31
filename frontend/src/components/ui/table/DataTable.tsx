import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import CommonLoader from "../Loader/CommonLoader";

export interface DataTableColumn<T> {
  header: string;
  /**
   * Optional JSX to render in the column header instead of the plain `header` string.
   * Use this when you need multi-line or styled header content (e.g. "PRESENT / 7d").
   * `header` is still required for ColumnToggle / CSV export.
   */
  headerNode?: React.ReactNode;
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
  /** Optional override for the default max-height (scroll cap) classes */
  maxHeightClassName?: string;
  /** Reduce cell/header padding for dense tables */
  density?: "default" | "compact";
}

const alignClass: Record<NonNullable<DataTableColumn<any>["align"]>, string> = {
  left: "text-left justify-start",
  center: "text-center justify-center",
  right: "text-right justify-end",
};

// Sizing for the table region.
//
// MIN is applied *only* in the loading / empty states, where there is no
// content to give the panel height — without it the card would collapse to a
// sliver and leave dead space under it. Once real rows are present the panel
// sizes to its content instead, so a full page of rows ends flush against the
// bottom of the card with no leftover white strip beneath the last row.
//
// MAX always applies, capping the panel so an unusually long page scrolls
// internally (keeping the sticky header in view) rather than pushing the
// footer off-screen. The offset covers the horizontal nav, page padding, card
// header and footer that surround the table in BaseLayout.
const TABLE_MIN_HEIGHT_CLASS = "min-h-[calc(100vh-16rem)]";
const TABLE_MAX_HEIGHT_CLASS = "";

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
  maxHeightClassName = TABLE_MAX_HEIGHT_CLASS,
  density = "compact",
}: DataTableProps<T>) {
  const cellPaddingClass = density === "compact"
    ? "px-2 py-1 sm:px-3 sm:py-1.5"
    : "px-3 py-1.5 sm:px-4 sm:py-2";

  // Header keeps slightly more vertical room than the (now denser) body rows
  // so it still reads as a distinct band above the data.
  const headerPaddingClass = density === "compact"
    ? "px-2 py-1.5 sm:px-3 sm:py-2"
    : "px-3 py-2 sm:px-4 sm:py-2.5";

  // Every row is held to the same minimum height so different tables line up
  // with each other regardless of what their cells contain. Without this a row
  // is only as tall as its tallest child, so a table with 40px action buttons
  // renders ~56px rows while a text-only table renders ~37px ones.
  const rowMinHeightClass = density === "compact" ? "min-h-[36px]" : "min-h-[48px]";

  // By using `minmax(max-content, 1fr)`:
  // 1. `max-content` ensures the column is always wide enough for its content without squishing/wrapping text.
  // 2. `1fr` ensures any leftover table space is distributed equally, so the table stretches to fill 100% width.
  // 3. If the total max-content exceeds the screen, it naturally forces the responsive horizontal scrollbar!
  const gridTemplateColumns = columns.map((col) => col.width ?? "minmax(0, 1fr)").join(" ");

  // True while the table is showing the loader or the empty message instead of
  // real rows. In that case the grid holds only the header and the message is
  // rendered as a flexible sibling beneath it (see below).
  const showingPlaceholder = loading || data.length === 0;

  const hasPager = Boolean(pagination && pagination.totalPages > 1);

  // On the outer grid, using 1fr tracks allows leftover width to stretch the
  // flexible columns themselves, so headers and content fill the space equally.
  const outerGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns,
    width: "100%",
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
    <div className={`w-full border border-line-soft rounded-xl overflow-hidden ${className}`}>
      {/*
        Flex column holding the scroll area and — when paginating — the pager
        beneath it. The minimum height applies in every state, so a table
        holding one row is the same size as one holding a full page and the
        card never collapses. The scroll area is `flex-1 min-h-0` so it absorbs
        whatever height is going, which pins the pager to the bottom edge and
        gives the sticky header a container to stick to once rows overflow.
      */}
      <div className={`flex flex-col ${minHeightClassName} ${maxHeightClassName}`}>
        <div
          className="w-full flex-1 min-h-0 overflow-auto overscroll-contain flex flex-col"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div role="table" className="w-full text-sm" style={outerGridStyle}>
            {/* Header row — cells are individually sticky (rather than the row)
                because a `subgrid` row is not a reliable sticky containing box
                across browsers. Each carries its own background so the header
                band stays solid while rows scroll underneath it. */}
            <div role="row" style={rowStyle}>
              {columns.map((col, i) => (
                <div
                  key={i}
                  role="columnheader"
                  className={`sticky top-0 z-10 bg-head flex items-center ${headerPaddingClass} font-bold text-[10px] sm:text-[11px] tracking-[1.5px] uppercase text-ink-muted whitespace-nowrap border-b border-line-soft ${alignClass[col.align ?? "left"]}`}
                >
                  {col.headerNode ?? col.header}
                </div>
              ))}
            </div>

            {/* Body */}
            {!showingPlaceholder &&
              data.map((row, index) => {
                const subRow = renderSubRow ? renderSubRow(row, index) : null;
                const extraClassName = rowClassName ? rowClassName(row, index) : "";
                const extraStyle = getRowStyle ? getRowStyle(row, index) : {};
                return (
                  <React.Fragment key={rowKey(row)}>
                    <div
                      role="row"
                      style={{ ...rowStyle, ...extraStyle }}
                      className={`${rowMinHeightClass} border-b border-line-soft/50 hover:bg-card-2/70 transition-all duration-200 ${onRowClick ? "cursor-pointer" : ""} ${extraClassName}`}
                      onClick={() => onRowClick && onRowClick(row, index)}
                    >
                      {columns.map((col, ci) => (
                        <div
                          key={ci}
                          role="cell"
                          className={`flex items-center ${cellPaddingClass} text-ink text-[13px] font-medium min-w-0 ${alignClass[col.align ?? "left"]}`}
                        >
                          {col.render
                            ? col.render(row, index)
                            : col.accessor
                              ? <span className="block truncate" title={String(row[col.accessor] ?? "")}>{String(row[col.accessor] ?? "")}</span>
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
              })}
          </div>

          {/*
            The loader / empty message is a flexible sibling of the grid rather
            than a row inside it. A grid row cannot be stretched reliably here:
            a percentage height on the grid resolves against the scroll area's
            `height: auto`, so it collapsed and the message hugged the header.
            As a `flex-1` sibling it simply absorbs the remaining height and
            centres itself in the middle of the panel.
          */}
          {showingPlaceholder && (
            <div className="flex-1 flex items-center justify-center min-w-full px-6 py-8 text-center text-base sm:text-lg text-ink-subtle">
              {loading ? (
                <CommonLoader text="Loading data..." fullScreen={false} />
              ) : (
                emptyMessage
              )}
            </div>
          )}
        </div>

        {/* Pager lives inside the panel and never shrinks, so it stays put at
            the foot of the rows and rides along if the scroll area is capped
            by the max-height. */}
        {hasPager && pagination && (
          <div className="shrink-0 flex items-center justify-center gap-3 sm:gap-4 py-3 sm:py-4 border-t border-line-soft bg-head/50">
            <button
              type="button"
              disabled={pagination.currentPage === 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-line-soft
                            text-ink-subtle hover:text-accent hover:border-accent/30 hover:bg-accent/10
                            disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent
                            transition-all duration-200"
            >
              <FaChevronLeft size={11} />
            </button>
            <div className="text-xs sm:text-sm text-ink-muted font-semibold">
              Page <span className="text-ink">{pagination.currentPage}</span> of <span className="text-ink">{pagination.totalPages}</span>
            </div>
            <button
              type="button"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-line-soft
                            text-ink-subtle hover:text-accent hover:border-accent/30 hover:bg-accent/10
                            disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent
                            transition-all duration-200"
            >
              <FaChevronRight size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataTable;