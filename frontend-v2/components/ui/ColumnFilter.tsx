import { useId } from "react";

interface ColumnFilterProps {
  column: string;
  value?: string;
  onChange: (column: string, value: string) => void;
  label?: string;
}

const ColumnFilter = ({ column, value, onChange, label }: ColumnFilterProps) => {
  const generatedId = useId();
  const inputId = `column-filter-${column}-${generatedId}`;
  const accessibleLabel = label || `Filter ${column}`;
  const currentValue = value || "";

  const handleClear = () => {
    onChange(column, "");
  };

  return (
    <div className="flex items-center gap-1 w-full">
      <label htmlFor={inputId} className="sr-only">
        {accessibleLabel}
      </label>
      <input
        id={inputId}
        type="text"
        value={currentValue}
        onChange={(e) => onChange(column, e.target.value)}
        placeholder={accessibleLabel}
        aria-label={accessibleLabel}
        autoComplete="off"
        className="border p-1 rounded w-full"
      />
      {currentValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={`Clear ${accessibleLabel}`}
          className="border p-1 rounded text-sm leading-none"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
};

export default ColumnFilter;