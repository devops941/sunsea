import React, { useState } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

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

interface IndiaPhoneInputProps {
    label?: string;
    name: string;
    value: string;
    placeholder?: string;
    required?: boolean;
    error?: string;
    onChange: (e: { target: { name: string; value: string } }) => void;
}

const IndiaPhoneInput: React.FC<IndiaPhoneInputProps> = ({
    label,
    name,
    value,
    placeholder,
    required = true,
    error,
    onChange,
}) => {
    const [localError, setLocalError] = useState<string | null>(null);

    const handleBlur = () => {
        const validationError = validatePhoneNumber(value, required);
        setLocalError(validationError);
    };

    const handleOnChange = (val: string | undefined) => {
        const newValue = val || '';
        onChange({
            target: {
                name,
                value: newValue,
            },
        });

        if (localError) {
            const validationError = validatePhoneNumber(newValue, required);
            setLocalError(validationError);
        }
    };

    const displayError = error || localError;

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

            <div className="relative">
                <PhoneInput
                    international={false}
                    countryCallingCodeEditable={false}
                    defaultCountry="IN"
                    countries={["IN"]}
                    addInternationalOption={false}
                    placeholder={placeholder}
                    value={value || ''}
                    onChange={handleOnChange}
                    onBlur={handleBlur}
                    className={`
                        w-full h-10 px-4 flex items-center
                        border rounded-[10px] outline-none
                        text-[15px] font-medium
                        transition-all duration-250 bg-white
                        ${displayError
                            ? "border-red-500 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/15"
                            : "border-slate-300  hover:border-slate-400 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15"
                        }
                    `}
                />
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
            </div>

            {displayError && (
                <div className="text-[#dc3545] text-sm font-medium mt-1">
                    {displayError}
                </div>
            )}
        </div>
    );
};

export default IndiaPhoneInput;