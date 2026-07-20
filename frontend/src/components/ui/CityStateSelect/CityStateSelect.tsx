import React, { useState, useEffect } from "react";
import { GetState, GetCity } from "react-country-state-city";
import SelectInput from "../../form/SelectInput/SelectInput";
import TextInput from "../../form/TextInput/TextInput";

const INDIA_COUNTRY_ID = 101;

export interface StateCityOption {
    id: number;
    name: string;
    state_code?: string;
    [key: string]: any;
}

interface CityStateSelectProps {
    countryLabel?: string;
    stateLabel?: string;
    cityLabel?: string;
    countryValue?: string;
    stateValue: string;
    cityValue: string;
    onCountryChange?: (country: StateCityOption) => void;
    onStateChange: (state: StateCityOption) => void;
    onCityChange: (city: StateCityOption) => void;
    countryError?: string;
    stateError?: string;
    cityError?: string;
    required?: boolean;
    disabled?: boolean;
    resetKey?: number;
}

const CityStateSelect: React.FC<CityStateSelectProps> = ({
    countryLabel = "Country",
    stateLabel = "State",
    cityLabel = "City",
    countryValue = "India",
    stateValue,
    cityValue,
    onCountryChange,
    onStateChange,
    onCityChange,
    countryError,
    stateError,
    cityError,
    required = false,
    disabled = false,
}) => {
    const [states, setStates] = useState<StateCityOption[]>([]);
    const [cities, setCities] = useState<StateCityOption[]>([]);

    // On mount, auto-select India if countryValue is empty, and load India states
    useEffect(() => {
        if (!countryValue && onCountryChange) {
            onCountryChange({ id: INDIA_COUNTRY_ID, name: "India" });
        }

        GetState(INDIA_COUNTRY_ID)
            .then((result: StateCityOption[]) => {
                setStates(result);
            })
            .catch((err) => {
                console.error("Failed to load states:", err);
                setStates([]);
            });
    }, []);

    // When stateValue changes (or states load), load cities for selected state
    useEffect(() => {
        if (!stateValue || states.length === 0) {
            setCities([]);
            return;
        }

        const matchedState = states.find(
            (s) => s.name.toLowerCase() === stateValue.toLowerCase()
        );

        if (matchedState) {
            GetCity(INDIA_COUNTRY_ID, matchedState.id)
                .then((result: StateCityOption[]) => {
                    setCities(result);
                })
                .catch((err) => {
                    console.error("Failed to load cities:", err);
                    setCities([]);
                });
        } else {
            setCities([]);
        }
    }, [stateValue, states]);

    const stateOptions = [
        { value: "", label: `-- Select ${stateLabel} --` },
        ...states.map((s) => ({ value: s.name, label: s.name })),
    ];

    const cityOptions = [
        { value: "", label: `-- Select ${cityLabel} --` },
        ...cities.map((c) => ({ value: c.name, label: c.name })),
    ];

    const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedName = e.target.value;
        const matched = states.find((s) => s.name === selectedName);
        onStateChange(matched || { id: 0, name: "" });
        onCityChange({ id: 0, name: "" });
    };

    const handleCitySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedName = e.target.value;
        const matched = cities.find((c) => c.name === selectedName);
        onCityChange(matched || { id: 0, name: "" });
    };

    if (disabled) {
        return (
            <>
                <div className="w-full">
                    <TextInput label={stateLabel} name="stateDisplay" value={stateValue} onChange={() => { }} disabled />
                </div>
                <div className="w-full">
                    <TextInput label={cityLabel} name="cityDisplay" value={cityValue} onChange={() => { }} disabled />
                </div>
                <div className="w-full">
                    <TextInput label={countryLabel} name="countryDisplay" value={countryValue || "India"} onChange={() => { }} disabled />
                </div>
            </>
        );
    }

    return (
        <>
            <div className="w-full">
                <SelectInput
                    label={stateLabel}
                    name="state"
                    value={stateValue}
                    options={stateOptions}
                    onChange={handleStateSelect}
                    required={required}
                    searchable={true}
                />
                {stateError && <div className="text-red-500 text-sm mt-1">{stateError}</div>}
            </div>

            <div className="w-full">
                <SelectInput
                    label={cityLabel}
                    name="city"
                    value={cityValue}
                    options={cityOptions}
                    onChange={handleCitySelect}
                    disabled={!stateValue}
                    required={required}
                    searchable={true}
                />
                {cityError && <div className="text-red-500 text-sm mt-1">{cityError}</div>}
            </div>

            {/* Country field defaulting to India after City */}
            <div className="w-full">
                <TextInput
                    label={countryLabel}
                    name="country"
                    value={countryValue || "India"}
                    onChange={() => { }}
                    disabled={true}
                />
                {countryError && <div className="text-red-500 text-sm mt-1">{countryError}</div>}
            </div>
        </>
    );
};

export default CityStateSelect;