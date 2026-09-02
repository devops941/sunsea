import React, { useState } from 'react';
import { FaFileCsv, FaSpinner } from 'react-icons/fa';
import CustomButton from '../Button/Button';
import { toast } from 'react-toastify';

export interface CSVColumn<T> {
    header: string;
    accessor: (item: T) => string | number | undefined | null;
}

export interface ExportCSVButtonProps<T> {
    data?: T[];
    fetchData?: () => Promise<T[]>;
    columns: CSVColumn<T>[];
    filename?: string;
    text?: string;
    loadingText?: string;
}

const ExportCSVButton = <T,>({
    data,
    fetchData,
    columns,
    filename = 'export.csv',
    text = 'Export CSV',
    loadingText = 'Exporting...',
}: ExportCSVButtonProps<T>) => {
    const [isLoading, setIsLoading] = useState(false);

    const escapeCSVValue = (value: any) => {
        if (value === null || value === undefined) return '""';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    const downloadCSV = (items: T[]) => {
        if (!items || items.length === 0) {
            toast.info("No data available to export.");
            return;
        }

        const headers = columns.map(col => escapeCSVValue(col.header)).join(',');

        const rows = items.map(item => {
            return columns.map(col => escapeCSVValue(col.accessor(item))).join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);

        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExport = async () => {
        if (fetchData) {
            setIsLoading(true);
            try {
                const items = await fetchData();
                downloadCSV(items);
            } catch (err: any) {
                toast.error(err?.message || "Failed to fetch export data");
            } finally {
                setIsLoading(false);
            }
        } else if (data) {
            downloadCSV(data);
        }
    };

    return (
        <CustomButton
            text={isLoading ? loadingText : text}
            icon={isLoading ? FaSpinner : FaFileCsv}
            onClick={handleExport}
            disabled={isLoading}
            className={`btn-outline-success ${isLoading ? 'animate-pulse' : ''}`}
        />
    );
};

export default ExportCSVButton;

