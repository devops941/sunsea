import React from "react";
import { FaSearch } from "react-icons/fa";

interface SearchInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    /** Set false if this search box should always take full width (e.g. inside a modal) */
    fullWidthOnMobileOnly?: boolean;
}

const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = "Search...",
    className = "",
    fullWidthOnMobileOnly = true,
}) => {
    return (
        <div
            className={`relative flex-grow ${fullWidthOnMobileOnly ? "lg:flex-grow-0" : ""
                } ${className}`}
        >
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
                type="text"
                className={`w-full ${fullWidthOnMobileOnly ? "lg:w-64" : ""
                    } pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
            />
        </div>
    );
};

export default SearchInput;