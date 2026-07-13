import React, { useState, useRef, useEffect, ReactNode } from "react";
import { FaFilter, FaTimes } from "react-icons/fa";
import CustomButton from "../Button/Button";

interface FilterPopoverProps {
  activeFilterCount: number;
  onApply: () => void;
  onClear: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  children: ReactNode;
  hasActiveFilters: boolean;
}

const FilterPopover: React.FC<FilterPopoverProps> = ({
  activeFilterCount,
  onApply,
  onClear,
  onClose,
  onOpen,
  children,
  hasActiveFilters,
}) => {
  const [show, setShow] = useState(false);
  const filterBtnRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target as Node)
      ) {
        setShow(false);
        if (onClose) onClose();
      }
    };
    if (show) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [show, onClose]);

  const handleToggle = () => {
    if (!show) {
      if (onOpen) onOpen();
    } else {
      if (onClose) onClose();
    }
    setShow(!show);
  };

  const handleApply = () => {
    onApply();
    setShow(false);
  };

  const handleClear = () => {
    onClear();
    setShow(false);
  };

  return (
    <div ref={filterBtnRef} className="relative">
      <CustomButton
        text={activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
        icon={FaFilter}
        onClick={handleToggle}
        className={hasActiveFilters ? "!bg-green-600 hover:!bg-green-700 !text-white !border-green-600" : ""}
      />

      {show && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-2 w-[300px] bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-primary text-sm">Filter</span>
            <button
              type="button"
              onClick={() => {
                setShow(false);
                if (onClose) onClose();
              }}
              className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
            >
              <FaTimes />
            </button>
          </div>

          <div className="mb-4">{children}</div>

          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <div className="flex-1">
              <CustomButton
                text="Clear"
                onClick={handleClear}
                className="w-full flex justify-center !bg-gray-100 !text-gray-700 hover:!bg-gray-200 !border-transparent"
              />
            </div>
            <div className="flex-1">
              <CustomButton
                text="Apply"
                onClick={handleApply}
                className="w-full flex justify-center !bg-primary hover:!bg-primary/90 !text-white !border-primary"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPopover;
