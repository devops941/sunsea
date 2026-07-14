import React from "react";
import TextInput from "../TextInput/TextInput";
import CityStateSelect from "../../ui/CityStateSelect/CityStateSelect";


interface AddressFormProps {
    // Address Line
    addressValue: string;
    onAddressChange: (value: string) => void;
    addressError?: string;

    // State
    stateValue: string;
    onStateChange: (value: string) => void;
    stateError?: string;

    // City
    cityValue: string;
    onCityChange: (value: string) => void;
    cityError?: string;

    // Pincode
    pincodeValue: string;
    onPincodeChange: (value: string) => void;
    pincodeError?: string;

    // Configuration
    required?: boolean;
    disabled?: boolean;
    resetKey?: number;
    stateLabel?: string;
    cityLabel?: string;
    pincodeLabel?: string;
    addressLabel?: string;
}

const AddressForm: React.FC<AddressFormProps> = ({
    addressValue,
    onAddressChange,
    addressError,
    stateValue,
    onStateChange,
    stateError,
    cityValue,
    onCityChange,
    cityError,
    pincodeValue,
    onPincodeChange,
    pincodeError,
    required = false,
    disabled = false,
    resetKey,
    stateLabel = "State",
    cityLabel = "City",
    pincodeLabel = "Pincode",
    addressLabel = "Address Line",
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 w-full [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0">
            {/* Address Line */}
            <div className="w-full md:col-span-2">
                <TextInput
                    name="addressLine"
                    label={addressLabel}
                    value={addressValue}
                    onChange={(e) => onAddressChange(e.target.value)}
                    placeholder="Street / Building / Area"
                    required={required}
                    error={addressError}
                    disabled={disabled}
                />
            </div>

            {/* State & City (2 columns) */}
            <CityStateSelect
                stateLabel={stateLabel}
                cityLabel={cityLabel}
                stateValue={stateValue}
                cityValue={cityValue}
                onStateChange={(state) => onStateChange(state.name)}
                onCityChange={(city) => onCityChange(city.name)}
                stateError={stateError}
                cityError={cityError}
                required={required}
                disabled={disabled}
                resetKey={resetKey}
            />

            {/* Pincode */}
            <div className="w-full">
                <TextInput
                    name="pincode"
                    label={pincodeLabel}
                    value={pincodeValue}
                    onChange={(e) => onPincodeChange(e.target.value)}
                    placeholder="6-digit pincode"
                    required={required}
                    error={pincodeError}
                    disabled={disabled}
                />
            </div>
        </div>
    );
};

export default AddressForm;