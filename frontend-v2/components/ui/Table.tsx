import { useState, useMemo, useCallback, type ReactNode, type KeyboardEvent } from "react";
import ColumnFilter from "./ColumnFilter";

export type TableRow = Record<string, unknown>;

export type SortDirection = "ascending" | "descending" | "none";

export interface TableColumn<T extends TableRow = TableRow> {
  /** Unique key for the column; also used as the row field accessor by default. */
  key: string;
  /** Human-readable header label. Defaults to the key. */
  header?: string;
  /** Whether the column is sortable via header click. */
  sortable?: boolean;
  /** Whether the column exposes a text filter. Defaults to true. */
  filterable?: boolean;
  /** Custom cell renderer for the column. */
  renderCell?: (row: T, rowIndex: number) => ReactNode;
}

export interface TableProps<T extends TableRow = TableRow> {
  data: T[];
  /** Optional explicit column definitions. Derived from the first row when omitted. */
  columns?: TableColumn<T>[];
  /** Accessible caption rendered inside the table element. */
  caption?: string;
  /** Accessible caption rendered visually (defaults to screen-reader only). */
  captionVisible?: boolean;
  /** Slot rendered inside the table region when there are no rows to display. */
  emptyState?: ReactNode;
  /** Called when a row is activated via click, Enter, or Space. */
  onRowActivate?: (row: T, rowIndex: number) => void;
  /** Accessible label for the table region. */
  ariaLabel?: string;
  /** Optional className override for the table element. */
  className?: string;
}

const DEFAULT_CLASS_NAME = "w-full border";

function deriveColumns<T extends TableRow>(data: T[]): TableColumn<T>[] {
  const first = data[0];
  if (!first) return [];
  return Object.keys(first).map((key) => ({ key }));
}

function getCellValue(row: TableRow, key: string): unknown {
  return row[key];
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

const Table = <T extends TableRow = TableRow>({
  data,
  columns,
  caption,
  captionVisible = false,
  emptyState,
  onRowActivate,
  ariaLabel,
  className = DEFAULT_CLASS_NAME,
}: TableProps<T>) => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: "",
    direction: "none",
  });

  const resolvedColumns = useMemo<TableColumn<T>[]>(
    () => (columns && columns.length > 0 ? columns : deriveColumns(data)),
    [columns, data]
  );

  const handleFilterChange = useCallback((column: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [column]: value,
    }));
  }, []);

  const handleSortToggle = useCallback((column: string) => {
    setSort((prev) => {
      if (prev.key !== column) {
        return { key: column, direction: "ascending" };
      }
      if (prev.direction === "ascending") {
        return { key: column, direction: "descending" };
      }
      if (prev.direction === "descending") {
        return { key: column, direction: "none" };
      }
      return { key: column, direction: "ascending" };
    });
  }, []);

  const handleSortKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, column: string) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleSortToggle(column);
      }
    },
    [handleSortToggle]
  );

  const processedData = useMemo(() => {
    const filtered = data.filter((row) =>
      Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        return String(getCellValue(row, key) ?? "")
          .toLowerCase()
          .includes(value.toLowerCase());
      })
    );

    if (sort.direction === "none" || !sort.key) {
      return filtered;
    }

    const sorted = [...filtered].sort((a, b) =>
      compareValues(getCellValue(a, sort.key), getCellValue(b, sort.key))
    );

    return sort.direction === "descending" ? sorted.reverse() : sorted;
  }, [data, filters, sort]);

  const handleRowActivate = useCallback(
    (row: T, rowIndex: number) => {
      if (onRowActivate) {
        onRowActivate(row, rowIndex);
      }
    },
    [onRowActivate]
  );

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>, row: T, rowIndex: number) => {
      if (!onRowActivate) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleRowActivate(row, rowIndex);
      }
    },
    [handleRowActivate, onRowActivate]
  );

  const ariaSortFor = (column: TableColumn<T>): SortDirection | undefined => {
    if (!column.sortable) return undefined;
    if (sort.key !== column.key) return "none";
    return sort.direction;
  };

  const showEmptyState = processedData.length === 0;
  const columnCount = resolvedColumns.length || 1;

  return (
    <div className="overflow-x-auto" role="region" aria-label={ariaLabel}>
      <table className={className}>
        {caption ? (
          <caption
            className={
              captionVisible
                ? "p-2 text-left text-sm font-medium"
                : "sr-only"
            }
          >
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr>
            {resolvedColumns.map((column) => {
              const ariaSort = ariaSortFor(column);
              const headerLabel = column.header ?? column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className="border p-2 text-left align-top"
                  aria-sort={ariaSort}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      onClick={() => handleSortToggle(column.key)}
                      onKeyDown={(event) => handleSortKeyDown(event, column.key)}
                      aria-label={`Sort by ${headerLabel}`}
                    >
                      <span>{headerLabel}</span>
                      <span aria-hidden="true">
                        {ariaSort === "ascending"
                          ? "▲"
                          : ariaSort === "descending"
                          ? "▼"
                          : "↕"}
                      </span>
                    </button>
                  ) : (
                    <span className="font-semibold">{headerLabel}</span>
                  )}
                  {column.filterable !== false ? (
                    <ColumnFilter
                      column={column.key}
                      value={filters[column.key]}
                      onChange={handleFilterChange}
                    />
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {showEmptyState ? (
            <tr>
              <td colSpan={columnCount} className="border p-4 text-center">
                {emptyState ?? <span>No results</span>}
              </td>
            </tr>
          ) : (
            processedData.map((row, rowIndex) => {
              const interactive = Boolean(onRowActivate);
              return (
                <tr
                  key={rowIndex}
                  tabIndex={interactive ? 0 : undefined}
                  role={interactive ? "button" : undefined}
                  onClick={
                    interactive ? () => handleRowActivate(row, rowIndex) : undefined
                  }
                  onKeyDown={
                    interactive
                      ? (event) => handleRowKeyDown(event, row, rowIndex)
                      : undefined
                  }
                  className={
                    interactive
                      ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      : undefined
                  }
                >
                  {resolvedColumns.map((column) => (
                    <td key={column.key} className="border p-2">
                      {column.renderCell
                        ? column.renderCell(row, rowIndex)
                        : (getCellValue(row, column.key) as ReactNode)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;