import React, { useState, useEffect } from "react";
import { GetState, GetCity } from "react-country-state-city";
import SelectInput from "../../form/SelectInput/SelectInput";
import TextInput from "../../form/TextInput/TextInput";
// import { FaMapMarkerAlt } from "react-icons/fa";

const INDIA_COUNTRY_ID = 101;

export interface StateCityOption {
    id: number;
    name: string;
    state_code?: string;
    [key: string]: any;
}

interface CityStateSelectProps {
    stateLabel?: string;
    cityLabel?: string;
    stateValue: string;
    cityValue: string;
    onStateChange: (state: StateCityOption) => void;
    onCityChange: (city: StateCityOption) => void;
    stateError?: string;
    cityError?: string;
    required?: boolean;
    disabled?: boolean;
    resetKey?: number;
}

const CityStateSelect: React.FC<CityStateSelectProps> = ({
    stateLabel = "State",
    cityLabel = "City",
    stateValue,
    cityValue,
    onStateChange,
    onCityChange,
    stateError,
    cityError,
    required = false,
    disabled = false,
}) => {
    const [states, setStates] = useState<StateCityOption[]>([]);
    const [cities, setCities] = useState<StateCityOption[]>([]);

    // Load all India states once
    useEffect(() => {
        GetState(INDIA_COUNTRY_ID)
            .then((result: StateCityOption[]) => {
                setStates(result);
            })
            .catch((err) => {
                console.error("Failed to load states:", err);
            });
    }, []);

    // When stateValue changes (or states load), resolve matching id and load its cities
    useEffect(() => {
        if (!stateValue || states.length === 0) {
            setCities([]);
            return;
        }
        const matched = states.find((s) => s.name === stateValue);
        if (matched) {
            GetCity(INDIA_COUNTRY_ID, matched.id)
                .then((result: StateCityOption[]) => {
                    setCities(result);
                })
                .catch((err) => {
                    console.error("Failed to load cities:", err);
                });
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
                // icon={<FaMapMarkerAlt />}
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
                // icon={<FaMapMarkerAlt />}
                />
                {cityError && <div className="text-red-500 text-sm mt-1">{cityError}</div>}
            </div>
        </>
    );
};

export default CityStateSelect;