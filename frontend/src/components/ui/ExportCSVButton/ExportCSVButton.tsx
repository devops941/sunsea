import { FaFileCsv } from 'react-icons/fa';
import CustomButton from '../Button/Button';

export interface CSVColumn<T> {
    header: string;
    accessor: (item: T) => string | number | undefined | null;
}

export interface ExportCSVButtonProps<T> {
    data: T[];
    columns: CSVColumn<T>[];
    filename?: string;
    text?: string;
}

const ExportCSVButton = <T,>({
    data,
    columns,
    filename = 'export.csv',
    text = 'Export CSV'
}: ExportCSVButtonProps<T>) => {
    const handleExport = () => {
        if (!data || data.length === 0) return;

        // Escape CSV values to handle commas, quotes, and newlines safely
        const escapeCSVValue = (value: any) => {
            if (value === null || value === undefined) return '""';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };

        const headers = columns.map(col => escapeCSVValue(col.header)).join(',');

        const rows = data.map(item => {
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

    return (
        <CustomButton
            text={text}
            icon={FaFileCsv}
            onClick={handleExport}
            className="btn-outline-success"
        />
    );
};

export default ExportCSVButton;
