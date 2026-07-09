import "./data-table.css";

export interface Column<T> {
  key: keyof T;
  title: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
}

const DataTable = <T extends { id: number | string }>({
  columns,
  data,
}: DataTableProps<T>) => {
  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)}>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={String(column.key)}>
                  {String(row[column.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;