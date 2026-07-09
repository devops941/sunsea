import React, { useState } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import { Form } from 'react-bootstrap';
import 'react-phone-number-input/style.css';
import './PhoneInput.css';

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
        <Form.Group className="text-input-group mb-0">
            {label && (
                <Form.Label className="text-input-label">
                    <span>{label}</span>
                    {required && <span className="required-star">*</span>}
                </Form.Label>
            )}

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
                className={displayError ? 'PhoneInput--error' : ''}
            />

            {displayError && <div className="text-danger mt-2">{displayError}</div>}
        </Form.Group>
    );
};

export default IndiaPhoneInput;