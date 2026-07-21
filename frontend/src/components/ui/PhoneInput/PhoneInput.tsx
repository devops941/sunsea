import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { X, ChevronDown, Check } from 'lucide-react';

export const validatePhoneNumber = (value: string | undefined, required: boolean = true): string | null => {
    if (!value || value.trim() === '') {
        return required ? 'Mobile Number is required' : null;
    }
    const digitsOnly = value.replace('+91', '').replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
        return 'Enter a valid 10-digit mobile number';
    }
    if (!isValidPhoneNumber(value)) {
        return 'Enter a valid Indian mobile number';
    }
    return null;
};

/** Fixed set of phone-number types available in multi mode */
export const PHONE_ENTRY_TYPES = ['Primary Mobile Number', 'Alternative Number', 'WhatsApp Number'] as const;
export type PhoneEntryType = typeof PHONE_ENTRY_TYPES[number];

/**
 * Validates a list of named phone entries (multi mode).
 * - "Primary Mobile Number" is always required and must be a valid 10-digit Indian number.
 * - Any other entries present must also be valid 10-digit Indian numbers.
 */
export const validatePhoneEntries = (
    entries: { label: string; number: string }[] | undefined,
    required: boolean = true
): string | null => {
    const list = entries || [];
    const primary = list.find((e) => e.label === 'Primary Mobile Number');

    if (required && !primary) {
        return 'Primary Mobile Number is required';
    }

    for (const entry of list) {
        const err = validatePhoneNumber(entry.number, true);
        if (err) return `${entry.label}: ${err}`;
    }

    return null;
};

/* ---------- Single field (internal, reused by both modes) ---------- */

interface SinglePhoneFieldProps {
    name: string;
    value: string;
    placeholder?: string;
    required?: boolean;
    error?: string | null;
    onChange: (val: string) => void;
    onBlur: () => void;
    onRemove?: () => void;
    showRemove?: boolean;
}

const SinglePhoneField: React.FC<SinglePhoneFieldProps> = ({
    name,
    value,
    placeholder,
    required = true,
    error,
    onChange,
    onBlur,
    onRemove,
    showRemove,
}) => {
    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <PhoneInput
                        international={false}
                        countryCallingCodeEditable={false}
                        defaultCountry="IN"
                        countries={["IN"]}
                        addInternationalOption={false}
                        placeholder={placeholder}
                        value={value || ''}
                        onChange={(val) => onChange(val || '')}
                        onBlur={onBlur}
                        className={`
                            w-full h-10 px-4 flex items-center
                            border rounded-[10px] outline-none
                            text-[15px] font-medium
                            transition-all duration-250 bg-white
                            ${error
                                ? "border-red-500 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/15"
                                : "border-slate-300 hover:border-slate-400 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15"
                            }
                        `}
                    />
                </div>

                {showRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        aria-label="Remove phone number"
                        className="
                            flex items-center justify-center
                            w-9 h-9 rounded-[10px] shrink-0
                            border border-slate-300 text-slate-500
                            hover:border-red-400 hover:text-red-500 hover:bg-red-50
                            transition-colors duration-200
                        "
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {error && (
                <div className="text-[#dc3545] text-sm font-medium mt-1">
                    {error}
                </div>
            )}
        </div>
    );
};

/* ---------- Shared phone-input CSS override (mount once) ---------- */

const PhoneInputStyles = () => (
    <style>{`
        .PhoneInputInput, .PhoneInput input {
            border: none !important;
            outline: none !important;
            background: transparent !important;
            height: 100% !important;
            color: #1f2937 !important;
            font-weight: 500 !important;
            box-shadow: none !important;
        }
        .PhoneInputInput::placeholder, .PhoneInput input::placeholder {
            color: #9ca3af !important;
        }
        .PhoneInputInput:focus, .PhoneInput input:focus {
            border: none !important;
            box-shadow: none !important;
            outline: none !important;
        }
    `}</style>
);

/* ---------- Public props ---------- */

interface IndiaPhoneInputSingleProps {
    multi?: false;
    label?: string;
    name: string;
    value: string;
    placeholder?: string;
    required?: boolean;
    error?: string;
    onChange: (e: { target: { name: string; value: string } }) => void;
}

/** A single named phone entry used in multi mode */
export interface PhoneEntry {
    /** e.g. "Home", "Office", "Emergency Contact" */
    label: string;
    /** stored as +91XXXXXXXXXX */
    number: string;
}

interface IndiaPhoneInputMultiProps {
    multi: true;
    label?: string;
    name: string;
    /** array of named phone entries */
    value: PhoneEntry[];
    placeholder?: string;
    required?: boolean;
    /** shown below the field, e.g. from form-level validation */
    error?: string;
    /** returns updated array */
    onChange: (e: { target: { name: string; value: PhoneEntry[] } }) => void;
    maxNumbers?: number;
}

type IndiaPhoneInputProps = IndiaPhoneInputSingleProps | IndiaPhoneInputMultiProps;

/* ---------- Main component ---------- */

const IndiaPhoneInput: React.FC<IndiaPhoneInputProps> = (props) => {
    const { label, name, placeholder, required = true } = props;

    // ---- local validation error state ----
    const [singleLocalError, setSingleLocalError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [draftName, setDraftName] = useState<string>(PHONE_ENTRY_TYPES[0]);
    const [draftValue, setDraftValue] = useState('');
    const [draftError, setDraftError] = useState<string | null>(null);
    const [requiredError, setRequiredError] = useState<string | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // multi mode: validate (required + 10-digit Indian number) whenever the dropdown closes
    useEffect(() => {
        if (!isOpen && props.multi) {
            setRequiredError(validatePhoneEntries(props.value, props.required ?? true));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // multi mode: keep selected draft type valid as entries change
    useEffect(() => {
        if (!props.multi) return;
        const usedTypes = (props.value || []).map((e) => e.label);
        const available = PHONE_ENTRY_TYPES.filter((t) => !usedTypes.includes(t));
        if (available.length > 0 && !available.includes(draftName as PhoneEntryType)) {
            setDraftName(available[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.multi ? props.value.length : 0]);

    /* ============ MULTI MODE — dropdown multiselect pattern ============ */
    if (props.multi) {
        const { value, onChange, error, maxNumbers } = props;
        const entries = value || [];
        const atMax = !!maxNumbers && entries.length >= maxNumbers;
        const usedTypes = entries.map((e) => e.label);
        const availableTypes = PHONE_ENTRY_TYPES.filter((t) => !usedTypes.includes(t));

        const formatNumber = (num: string) => {
            const digits = num.replace('+91', '').replace(/\D/g, '');
            return digits.length === 10
                ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
                : num;
        };

        const commitDraft = () => {
            const rawName = draftName || availableTypes[0];
            const raw = draftValue.trim();

            if (!rawName) {
                setDraftError('All number types have been added');
                return;
            }
            if (!raw) {
                setDraftError('Enter a mobile number');
                return;
            }

            const digits = raw.replace(/\D/g, '');
            if (digits.length !== 10) {
                setDraftError('Enter a valid 10-digit mobile number');
                return;
            }
            const formatted = `+91${digits}`;

            if (entries.some((e) => e.number === formatted)) {
                setDraftError('This number is already added');
                return;
            }
            if (!isValidPhoneNumber(formatted)) {
                setDraftError('Enter a valid Indian mobile number');
                return;
            }

            onChange({ target: { name, value: [...entries, { label: rawName, number: formatted }] } });
            setDraftValue('');
            setDraftError(null);
        };

        const handleRemove = (idx: number) => {
            const updated = entries.filter((_, i) => i !== idx);
            onChange({ target: { name, value: updated } });
        };

        const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
            } else if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        const handleNameChange = (raw: string) => {
            setDraftName(raw);
            if (draftError) setDraftError(null);
        };

        const handleDraftChange = (raw: string) => {
            const digits = raw.replace(/\D/g, '').slice(0, 10);
            setDraftValue(digits);
            if (draftError) setDraftError(null);
        };

        const displayError = error || draftError || (isOpen ? null : requiredError);

        return (
            <div className="mb-[18px] group w-full" ref={wrapperRef}>
                {label && (
                    <label className="flex items-center gap-[6px] mb-2 text-xs font-bold uppercase tracking-[0.5px] text-slate-500">
                        <span>{label}</span>
                        {required && <span className="text-[#e53935] ml-0.5">*</span>}
                    </label>
                )}

                <div className="relative">
                    {/* ---- Closed field / trigger ---- */}
                    <button
                        type="button"
                        onClick={() => setIsOpen((prev) => !prev)}
                        className={`
                            w-full min-h-10 px-3 py-1.5
                            flex items-center justify-between gap-2
                            border rounded-[10px] bg-white
                            transition-all duration-250
                            ${displayError
                                ? "border-red-500"
                                : isOpen
                                    ? "border-primary ring-4 ring-primary/15"
                                    : "border-slate-300 hover:border-slate-400"
                            }
                        `}
                    >
                        <div className="flex flex-wrap items-center gap-1.5 flex-1 text-left">
                            {entries.length === 0 && (
                                <span className="text-[15px] font-medium text-slate-400">
                                    {placeholder || 'Select mobile numbers'}
                                </span>
                            )}
                            {entries.map((entry, idx) => (
                                <span
                                    key={`${entry.number}-${idx}`}
                                    className="
                                        flex items-center gap-1
                                        pl-2.5 pr-1.5 py-1 rounded-full
                                        bg-primary/10 text-primary
                                        text-[13px] font-semibold
                                        whitespace-nowrap
                                    "
                                >
                                    <span className="font-bold">{entry.label}:</span>
                                    {formatNumber(entry.number)}
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemove(idx);
                                        }}
                                        aria-label={`Remove ${entry.label}`}
                                        className="
                                            flex items-center justify-center
                                            w-4 h-4 rounded-full shrink-0
                                            hover:bg-primary/20 transition-colors
                                        "
                                    >
                                        <X size={11} />
                                    </span>
                                </span>
                            ))}
                        </div>
                        <ChevronDown
                            size={18}
                            className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* ---- Dropdown panel ---- */}
                    {isOpen && (
                        <div
                            className="
                                absolute z-20 top-[calc(100%+6px)] left-0 right-0
                                bg-white border border-slate-200 rounded-[10px]
                                shadow-lg overflow-hidden
                            "
                        >
                            {/* add-entry row */}
                            {!atMax && availableTypes.length > 0 && (
                                <div className="p-2.5 border-b border-slate-100 flex flex-col gap-2">
                                    <select
                                        value={draftName}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        className="
                                            h-9 px-3 rounded-[8px] border border-slate-200 bg-slate-50
                                            text-[14px] font-medium text-slate-800
                                            outline-none appearance-none
                                            focus:border-primary transition-colors duration-200
                                        "
                                    >
                                        {availableTypes.map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>

                                    <div
                                        className={`
                                            flex items-center gap-2
                                            h-10 px-3 rounded-[8px] border bg-slate-50
                                            transition-colors duration-200
                                            ${draftError
                                                ? "border-red-400"
                                                : "border-slate-200 focus-within:border-primary"
                                            }
                                        `}
                                    >
                                        <span className="text-[15px] font-medium text-slate-500 select-none">+91</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            value={draftValue}
                                            placeholder="Enter mobile number"
                                            onChange={(e) => handleDraftChange(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className="
                                                flex-1 h-full border-none outline-none bg-transparent
                                                text-[15px] font-medium text-slate-800
                                                placeholder:text-slate-400
                                            "
                                        />
                                        <button
                                            type="button"
                                            onClick={commitDraft}
                                            className="
                                                shrink-0 text-xs font-bold uppercase tracking-wide
                                                text-primary hover:opacity-70 transition-opacity
                                            "
                                        >
                                            Add
                                        </button>
                                    </div>

                                    {draftError && (
                                        <div className="text-[#dc3545] text-xs font-medium">
                                            {draftError}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* selected entries list */}
                            <div className="max-h-48 overflow-y-auto py-1">
                                {entries.length === 0 ? (
                                    <div className="px-3 py-2.5 text-sm text-slate-400">
                                        No numbers added yet
                                    </div>
                                ) : (
                                    entries.map((entry, idx) => (
                                        <div
                                            key={`${entry.number}-${idx}`}
                                            className="
                                                flex items-center justify-between gap-2
                                                px-3 py-2 hover:bg-slate-50
                                                transition-colors duration-150
                                            "
                                        >
                                            <span className="flex items-center gap-2 text-[14px] font-medium text-slate-700 min-w-0">
                                                <Check size={14} className="text-primary shrink-0" />
                                                <span className="truncate">
                                                    <span className="font-bold text-slate-800">{entry.label}</span>
                                                    <span className="text-slate-400 mx-1">·</span>
                                                    {formatNumber(entry.number)}
                                                </span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(idx)}
                                                aria-label={`Remove ${entry.label}`}
                                                className="
                                                    flex items-center justify-center
                                                    w-6 h-6 rounded-full shrink-0
                                                    text-slate-400 hover:text-red-500 hover:bg-red-50
                                                    transition-colors duration-150
                                                "
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {atMax && (
                                <div className="px-3 py-2 text-xs font-medium text-slate-400 border-t border-slate-100">
                                    Maximum {maxNumbers} numbers added
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {displayError && !isOpen && (
                    <div className="text-[#dc3545] text-sm font-medium mt-1">
                        {displayError}
                    </div>
                )}
            </div>
        );
    }

    /* ============ SINGLE MODE (original behavior) ============ */
    const { value, error, onChange } = props;

    const handleBlur = () => {
        setSingleLocalError(validatePhoneNumber(value, required));
    };

    const handleOnChange = (val: string) => {
        onChange({ target: { name, value: val } });
        if (singleLocalError) {
            setSingleLocalError(validatePhoneNumber(val, required));
        }
    };

    const displayError = error || singleLocalError;

    return (
        <div className="mb-[18px] group w-full">
            {label && (
                <label
                    htmlFor={name}
                    className={`
                        flex items-center gap-[6px] mb-2
                        text-xs font-bold uppercase
                        tracking-[0.5px]
                        transition-colors duration-250
                        ${displayError ? "text-red-500" : "text-slate-500"}
                        group-focus-within:text-primary
                    `}
                >
                    <span>{label}</span>
                    {required && <span className="text-[#e53935] ml-0.5">*</span>}
                </label>
            )}

            <SinglePhoneField
                name={name}
                value={value}
                placeholder={placeholder}
                required={required}
                error={displayError}
                onChange={handleOnChange}
                onBlur={handleBlur}
            />

            <PhoneInputStyles />
        </div>
    );
};

export default IndiaPhoneInput;