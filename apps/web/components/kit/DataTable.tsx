'use client';

import { useMemo, useState } from 'react';

export interface Column<Row> {
  key: string;
  label: string;
  value: (row: Row) => string | number;
  /** C-33: the search box matches the code and name columns. */
  searchable?: boolean;
  align?: 'start' | 'end';
}

export interface DataTableProps<Row> {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  onSelect?: (row: Row) => void;
  selectedKey?: string;
}

const matches = (value: string | number, needle: string) =>
  String(value).toLowerCase().includes(needle.trim().toLowerCase());

/** NFR-08, 7.2: one field per column, every column sortable and filterable; C-07 row selection; C-33 search. */
export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  onSelect,
  selectedKey,
}: DataTableProps<Row>) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; ascending: boolean } | null>(null);

  const visible = useMemo(() => {
    const searchable = columns.filter((column) => column.searchable);
    const filtered = rows.filter(
      (row) =>
        (search === '' || searchable.some((column) => matches(column.value(row), search))) &&
        columns.every(
          (column) => !filters[column.key] || matches(column.value(row), filters[column.key] ?? ''),
        ),
    );
    const column = columns.find((c) => c.key === sort?.key);
    if (!column || !sort) return filtered;
    const direction = sort.ascending ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = column.value(a);
      const right = column.value(b);
      const order =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), 'id');
      return order * direction;
    });
  }, [rows, columns, search, filters, sort]);

  const toggleSort = (key: string) =>
    setSort((current) =>
      current?.key === key ? { key, ascending: !current.ascending } : { key, ascending: true },
    );

  return (
    <div className="table-wrap">
      <input
        type="search"
        className="input search"
        placeholder="Search code or name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.align === 'end' ? 'num' : undefined}
                aria-sort={
                  sort?.key === column.key ? (sort.ascending ? 'ascending' : 'descending') : 'none'
                }
              >
                <button
                  type="button"
                  className="th-sort"
                  aria-label={`Sort by ${column.label}`}
                  onClick={() => toggleSort(column.key)}
                >
                  {column.label}
                </button>
                <input
                  className="input th-filter"
                  aria-label={`Filter ${column.label}`}
                  value={filters[column.key] ?? ''}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, [column.key]: event.target.value }))
                  }
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                aria-selected={key === selectedKey}
                className={key === selectedKey ? 'sel' : undefined}
                onClick={() => onSelect?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.align === 'end' ? 'num' : undefined}>
                    {column.value(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
