import React, { useState, useRef, useEffect } from "react";
import { FaCheck, FaFilter } from "react-icons/fa";
import Button from "../Button/Button";

interface ColumnToggleProps {
  columns: { header: string; accessor?: any }[];
  visibleColumns: string[];
  setVisibleColumns: (columns: string[]) => void;
  align?: 'left' | 'right';
}

const ColumnToggle: React.FC<ColumnToggleProps> = ({ columns, visibleColumns, setVisibleColumns, align = 'left' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleColumn = (header: string) => {
    if (visibleColumns.includes(header)) {
      setVisibleColumns(visibleColumns.filter((c) => c !== header));
    } else {
      setVisibleColumns([...visibleColumns, header]);
    }
  };

  const selectAll = () => {
    setVisibleColumns(columns.map(c => c.header));
  };

  const deselectAll = () => {
    setVisibleColumns([]);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <Button
        text="Columns"
        icon={FaFilter}
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="!text-primary font-semibold"
      />

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-64 rounded-xl bg-card shadow-xl z-50 overflow-hidden border border-line-soft transition-all duration-200 text-ink`}>
          <div className="p-3 flex justify-between items-center text-[11px] uppercase tracking-wider text-ink-subtle font-bold bg-card-2 border-b border-line-soft">
            <span>Show / Hide Columns</span>
            <div className="flex gap-2 items-center">
              <button type="button" className="text-primary hover:underline font-bold transition-colors cursor-pointer" onClick={selectAll}>All</button>
              <span className="text-line-soft">|</span>
              <button type="button" className="text-ink-subtle hover:text-ink transition-colors font-bold cursor-pointer" onClick={deselectAll}>None</button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5 custom-scrollbar">
            {columns.map((col, index) => {
              const isVisible = visibleColumns.includes(col.header);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleColumn(col.header)}
                  className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-card-2 flex items-center gap-3 rounded-lg transition-colors group cursor-pointer"
                >
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${isVisible ? 'bg-primary border-primary text-white shadow-xs' : 'border-line-soft bg-card-2 group-hover:border-primary/50'}`}>
                    {isVisible && <FaCheck size={9} />}
                  </div>
                  <span className="truncate font-semibold capitalize">
                    {col.header.toLowerCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnToggle;
