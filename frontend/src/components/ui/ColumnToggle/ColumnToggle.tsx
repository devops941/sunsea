import React, { useState, useRef, useEffect } from "react";
import { FaCheck, FaFilter } from "react-icons/fa";
import CustomButton from "../Button/Button";

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
      <CustomButton
        text="Columns"
        icon={FaFilter}
        onClick={() => setIsOpen(!isOpen)}
        className="!bg-card !text-blue-600 !border !border-blue-600 hover:!bg-blue-50 shadow-sm"
      />

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-64 rounded-xl bg-card/95 backdrop-blur-md shadow-2xl ring-1 ring-slate-900/10 z-50 overflow-hidden border border-line-soft transform origin-top transition-all duration-200`}>
          <div className="p-3 flex justify-between items-center text-[11px] uppercase tracking-wider text-ink-subtle font-bold bg-card-2/80 border-b border-line-soft">
            <span>Show/Hide Columns</span>
            <div className="flex gap-2">
              <button className="text-blue-600 hover:text-blue-800 transition-colors" onClick={selectAll}>All</button>
              <span className="text-ink-subtle">|</span>
              <button className="text-ink-subtle hover:text-ink-muted transition-colors" onClick={deselectAll}>None</button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5 custom-scrollbar">
            {columns.map((col, index) => {
              const isVisible = visibleColumns.includes(col.header);
              return (
                <button
                  key={index}
                  onClick={() => toggleColumn(col.header)}
                  className="w-full text-left px-3 py-2 text-sm text-ink-muted hover:bg-blue-50/50 hover:text-blue-700 flex items-center gap-3 rounded-lg transition-all duration-150 group"
                >
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${isVisible ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-line bg-card group-hover:border-blue-400'}`}>
                    {isVisible && <FaCheck size={10} />}
                  </div>
                  <span className="truncate font-medium capitalize text-xs">
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
