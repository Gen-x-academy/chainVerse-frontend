const ColumnFilter = ({ column, value, onChange }) => {
  return (
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(column, e.target.value)}
      placeholder={`Filter ${column}`}
      className="border p-1 rounded w-full"
    />
  );
};

export default ColumnFilter;