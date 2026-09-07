import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronDown } from 'react-icons/fa';
import { Edit2, Trash2, Check, X, Plus } from 'lucide-react';

interface CreatableSelectInputProps {
  label: string;
  name: string;
  value: number | string | null;
  options: { label: string; value: number | string }[];
  onChange: (value: number | string | null) => void;
  onCreateOption?: (inputValue: string) => void;
  onEditOption?: (value: number | string, newLabel: string) => void;
  onDeleteOption?: (value: number | string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  isLoading?: boolean;
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({
  item,
  onSave,
  onClose,
}: {
  item: { value: number | string; label: string };
  onSave: (value: number | string, newLabel: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(item.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    if (text.trim()) {
      onSave(item.value, text.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs">
      <div className="bg-card border border-line-soft rounded-2xl shadow-xl w-full max-w-sm p-6 text-ink">
        <h5 className="text-sm font-extrabold text-ink mb-4 uppercase tracking-wider">Edit Item</h5>
        <input
          ref={inputRef}
          className="w-full px-3 py-2 border border-line-soft bg-card-2 text-ink font-semibold rounded-xl text-[15px] outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 mb-4 transition-all"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl border border-line-soft text-ink-subtle bg-card-2 hover:bg-card transition-colors"
          >
            <X size={14} /> Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            <Check size={14} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CreatableSelectInput({
  label,
  name,
  value,
  options,
  onChange,
  onCreateOption,
  onEditOption,
  onDeleteOption,
  error,
  disabled,
  required,
  isLoading,
}: CreatableSelectInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [createInputValue, setCreateInputValue] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [editItem, setEditItem] = useState<{ value: number | string; label: string } | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value == value) || null;

  // While open: filter by typed text. While closed: show selected label.
  const filteredOptions = isOpen
    ? options.filter((opt) =>
        opt.label.toString().toLowerCase().includes(inputText.toLowerCase())
      )
    : options;

  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownEstHeight = 280;

      let style: React.CSSProperties = {
        position: 'fixed',
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 100000,
      };

      if (spaceBelow < dropdownEstHeight && spaceAbove > spaceBelow) {
        const maxH = Math.min(280, spaceAbove - 16);
        style = { ...style, bottom: `${viewportHeight - rect.top + 4}px`, maxHeight: `${Math.max(120, maxH)}px` };
      } else {
        const maxH = Math.min(280, spaceBelow - 16);
        style = { ...style, top: `${rect.bottom + 4}px`, maxHeight: `${Math.max(120, maxH)}px` };
      }
      setDropdownStyle(style);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideWrapper = wrapperRef.current && !wrapperRef.current.contains(target);
      const isOutsidePortal = portalRef.current && !portalRef.current.contains(target);
      if (isOutsideWrapper && isOutsidePortal) {
        closeDropdown();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  // Focus create input when shown
  useEffect(() => {
    if (showCreateInput) createInputRef.current?.focus();
  }, [showCreateInput]);

  const openDropdown = () => {
    if (disabled || isLoading) return;
    setInputText('');
    setShowCreateInput(false);
    setCreateInputValue('');
    const currentIdx = options.findIndex((o) => o.value == value);
    setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
    updateDropdownPosition();
    setIsOpen(true);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setInputText('');
    setShowCreateInput(false);
    setCreateInputValue('');
  };

  const handleSelect = (optValue: number | string) => {
    onChange(optValue);
    closeDropdown();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setInputText('');
    inputRef.current?.focus();
  };

  const handleCreate = () => {
    if (createInputValue.trim() && onCreateOption) {
      onCreateOption(createInputValue.trim());
      setCreateInputValue('');
      setShowCreateInput(false);
      closeDropdown();
    }
  };

  // Display value in the input box
  const inputDisplayValue = isOpen ? inputText : (selectedOption?.label.toString() ?? '');

  return (
    <div className="mb-0.5 group flex flex-col w-full" ref={wrapperRef}>
      {/* Label */}
      {label && (
        <label
          className={`flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-[0.5px] transition-colors duration-250 ${
            error ? 'text-red-400' : 'text-ink-subtle font-extrabold'
          } group-focus-within:text-primary`}
        >
          <span>{label}</span>
          {required && <span className="text-[#e53935] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Input box (acts as both trigger and search) */}
        <input
          ref={inputRef}
          type="text"
          name={name}
          autoComplete="off"
          data-nav
          disabled={disabled || isLoading}
          placeholder={isLoading ? 'Loading...' : 'Select or create...'}
          value={inputDisplayValue}
          onClick={() => { if (!isOpen) openDropdown(); }}
          onBlur={() => {
            // Options use onMouseDown+preventDefault so blur won't fire on option click.
            // This fires only when focus truly leaves (Tab, click outside).
            closeDropdown();
          }}
          onChange={(e) => {
            if (!isOpen) openDropdown();
            setInputText(e.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { closeDropdown(); return; }
            if (e.key === 'Tab') { closeDropdown(); return; }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!isOpen) { openDropdown(); return; }
              setHighlightedIndex((prev) => (prev + 1 < filteredOptions.length ? prev + 1 : prev));
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (!isOpen) { openDropdown(); return; }
              setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                handleSelect(filteredOptions[highlightedIndex].value);
                return;
              }
              if (onCreateOption) {
                const trimmed = inputText.trim();
                const exactMatch = options.find(
                  (opt) => opt.label.toString().toLowerCase() === trimmed.toLowerCase()
                );
                if (trimmed && !exactMatch) {
                  onCreateOption(trimmed);
                  closeDropdown();
                } else if (exactMatch) {
                  handleSelect(exactMatch.value);
                }
              }
            }
          }}
          className={`
            w-full h-10 pl-4 pr-10
            border rounded-xl outline-none
            text-[15px] font-bold text-ink
            transition-all duration-250
            placeholder:text-ink-subtle/80 placeholder:font-medium
            ${
              error
                ? 'border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15'
                : 'border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15'
            }
            ${isOpen ? (error ? 'border-red-500 ring-4 ring-red-500/15' : 'border-primary ring-4 ring-primary/15') : ''}
            ${disabled || isLoading ? 'bg-card-2/50 cursor-not-allowed text-ink-subtle opacity-70' : ''}
          `}
        />

        {/* Right icons */}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-ink-subtle pointer-events-none">
          {selectedOption && !disabled && (
            <span
              role="button"
              className="hover:text-red-400 text-ink-subtle p-0.5 rounded transition-colors cursor-pointer pointer-events-auto"
              title="Clear"
              onMouseDown={(e) => { e.preventDefault(); handleClear(e); }}
            >
              <X size={12} />
            </span>
          )}
          <FaChevronDown
            className={`text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </span>

        {/* Dropdown Portal */}
        {isOpen &&
          createPortal(
            <div
              ref={portalRef}
              data-select-portal="true"
              className="bg-card border border-line-soft rounded-xl shadow-xl flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100 overflow-hidden text-ink"
              style={dropdownStyle}
            >
              {/* Options list */}
              <div className="overflow-y-auto min-h-0 flex-1">
                {/* Create hint when no results */}
                {filteredOptions.length === 0 && onCreateOption && inputText.trim() && (
                  <div className="px-4 py-2.5 text-sm text-primary font-bold flex items-center gap-2">
                    <Plus size={13} />
                    <span>Press <kbd className="px-1.5 py-0.5 text-xs bg-card-2 border border-line-soft rounded text-ink font-mono">Enter</kbd> to create &ldquo;{inputText.trim()}&rdquo;</span>
                  </div>
                )}
                {filteredOptions.length === 0 && !onCreateOption && (
                  <div className="px-4 py-3 text-sm text-ink-subtle font-semibold text-center">No results found</div>
                )}
                {filteredOptions.map((option, index) => (
                  <div
                    key={option.value}
                    className={`
                      group/item px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between
                      transition-colors duration-150
                      ${index === highlightedIndex
                        ? 'bg-primary/20 text-primary font-bold'
                        : value == option.value
                          ? 'bg-primary/15 text-primary font-bold'
                          : 'text-ink font-semibold hover:bg-card-2'}
                    `}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(option.value); }}
                  >
                    <span className="truncate">{option.label}</span>
                    <span className="flex items-center gap-0.5 ml-2 shrink-0">
                      {onEditOption && (
                        <button
                          type="button"
                          title="Edit"
                          className="opacity-0 group-hover/item:opacity-100 text-ink-subtle hover:text-blue-400 p-1 rounded transition-all"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditItem({ value: option.value, label: option.label.toString() });
                            closeDropdown();
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {onDeleteOption && (
                        <button
                          type="button"
                          title="Delete"
                          className="opacity-0 group-hover/item:opacity-100 text-ink-subtle hover:text-red-400 p-1 rounded transition-all"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDeleteOption(option.value);
                            closeDropdown();
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>


            </div>,
            document.body
          )}
      </div>

      {/* Error */}
      {error && <div className="text-[#dc3545] text-sm font-semibold mt-1">{error}</div>}

      {/* Edit Modal */}
      {editItem && onEditOption && (
        <EditModal
          item={editItem}
          onSave={onEditOption}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
}
