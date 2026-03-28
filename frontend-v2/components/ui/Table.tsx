import { useState, useMemo } from "react";
import ColumnFilter from "./ColumnFilter";

const Table = ({ data }) => {
  const [filters, setFilters] = useState({});

  const handleFilterChange = (column, value) => {
    setFilters((prev) => ({
      ...prev,
      [column]: value,
    }));
  };

  const filteredData = useMemo(() => {
    return data.filter((row) =>
      Object.entries(filters).every(([key, value]) =>
        String(row[key] || "")
          .toLowerCase()
          .includes(value.toLowerCase())
      )
    );
  }, [data, filters]);

  return (
    <table className="w-full border">
      <thead>
        <tr>
          {Object.keys(data[0] || {}).map((key) => (
            <th key={key} className="border p-2">
              {key}
              <ColumnFilter
                column={key}
                value={filters[key]}
                onChange={handleFilterChange}
              />
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {filteredData.map((row, i) => (
          <tr key={i}>
            {Object.values(row).map((val, j) => (
              <td key={j} className="border p-2">
                {val}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Table;