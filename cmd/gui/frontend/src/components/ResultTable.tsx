import { useState, useMemo, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { rankItem } from '@tanstack/match-sorter-utils';
import { Input } from './ui/input';
import { Spinner } from './ui/spinner';
import { CellContent } from './CellContent';
import { useCellHighlight } from '../hooks/useCellHighlight';
import { GetResources } from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';

interface ResultTableProps {
  selectedFields: string[][];  // From NavigationPanel
  selectedGVK: main.MultiClusterGVK;
  connectedContexts: string[];
}

// Helper function to get nested value from object using path
function getNestedValue(obj: any, path: string[]): any {
  let value = obj;
  for (const key of path) {
    value = value?.[key];
    if (value === undefined) break;
  }
  return value;
}

// Fuzzy filter function for TanStack Table
const fuzzyFilter = (row: any, columnId: string, value: any, addMeta: any) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

export function ResultTable({
  selectedFields,
  selectedGVK,
  connectedContexts,
}: ResultTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Fetch resource data when GVK or contexts change
  useEffect(() => {
    if (!selectedGVK || connectedContexts.length === 0) {
      setData([]);
      return;
    }

    setLoading(true);
    GetResources(selectedGVK, connectedContexts)
      .then((resources) => {
        setData(resources || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load resources:', error);
        setData([]);
        setLoading(false);
      });
  }, [selectedGVK, connectedContexts]);

  // Get highlight function based on current search query
  const getHighlightIndices = useCellHighlight(globalFilter);

  // Calculate column width based on field name and data
  const calculateColumnWidth = (fieldName: string, values: any[]): number => {
    // Min width based on header name (8px per char + 32px padding)
    const headerWidth = fieldName.length * 8 + 32;

    // Sample first 100 values to estimate max width
    const sampleSize = Math.min(100, values.length);
    const samples = values.slice(0, sampleSize);

    let maxValueWidth = 0;
    for (const value of samples) {
      const text = typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value ?? '');
      const width = Math.min(text.length * 8 + 32, 300);  // Cap at 300px
      maxValueWidth = Math.max(maxValueWidth, width);
    }

    // Return max(header, value) but cap at 300px
    return Math.min(Math.max(headerWidth, maxValueWidth), 300);
  };

  // Create dynamic columns from selectedFields with default columns prepended
  const columns = useMemo<ColumnDef<any>[]>(() => {
    // Always add default columns at the beginning
    let fieldsToUse: string[][];

    if (connectedContexts.length === 1) {
      // Single context: name + selectedFields
      fieldsToUse = [['metadata', 'name'], ...selectedFields];
    } else {
      // Multiple contexts: context, name + selectedFields
      fieldsToUse = [['_context'], ['metadata', 'name'], ...selectedFields];
    }

    return fieldsToUse.map((fieldPath) => {
      const fieldName = fieldPath[fieldPath.length - 1];

      // Get all values for this column to calculate width
      const columnValues = data.map((row) => getNestedValue(row, fieldPath));
      const columnWidth = calculateColumnWidth(fieldName, columnValues);

      return {
        id: fieldPath.join('.'),
        header: fieldName === '_context' ? 'context' : fieldName,  // Rename _context to context
        accessorFn: (row) => getNestedValue(row, fieldPath),
        size: columnWidth,  // Set calculated width
        minSize: 80,  // Minimum column width
        maxSize: 300,  // Maximum column width
        cell: (info) => {
          const value = info.getValue();

          // For objects/arrays, get full text for highlighting
          const fullText = typeof value === 'object' && value !== null
            ? JSON.stringify(value)
            : String(value ?? '');

          // Get highlight indices based on full text
          const indices = getHighlightIndices(fullText);

          // Render with CellContent component (handles truncation + highlighting)
          return (
            <CellContent
              value={value}
              highlightIndices={indices}
            />
          );
        },
      };
    });
  }, [selectedFields, connectedContexts, data, getHighlightIndices]);

  // Create table instance
  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    globalFilterFn: fuzzyFilter,  // Use the function directly instead of string reference
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Get filtered rows for virtualization
  const { rows } = table.getRowModel();

  // Setup row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 35,  // Estimated row height in pixels
    overscan: 10,  // Render 10 extra rows above/below viewport
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b border-border">
        <Input
          placeholder="Search all fields..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        {globalFilter && (
          <p className="text-xs text-muted-foreground mt-2">
            Found {table.getFilteredRowModel().rows.length} / {data.length} rows
          </p>
        )}
      </div>

      {/* Table Content with Virtual Scrolling */}
      <div ref={tableContainerRef} className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Spinner className="w-8 h-8" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No resources found</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No matches for "{globalFilter}"
            </p>
          </div>
        ) : (
          <div>
            {/* Header (sticky) */}
            <div className="sticky top-0 bg-muted z-10 border-b border-border">
              {table.getHeaderGroups().map((headerGroup) => (
                <div key={headerGroup.id} className="flex">
                  {headerGroup.headers.map((header) => {
                    const headerText = typeof header.column.columnDef.header === 'string'
                      ? header.column.columnDef.header
                      : String(header.column.columnDef.header);

                    return (
                      <div
                        key={header.id}
                        className="px-4 py-2 text-left text-sm font-medium flex-shrink-0"
                        style={{
                          width: `${header.getSize()}px`,
                          minWidth: `${header.getSize()}px`,
                          maxWidth: `${header.getSize()}px`,
                        }}
                      >
                        <CellContent value={headerText} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Body (virtualized) */}
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    key={row.id}
                    className="flex border-b border-border hover:bg-accent transition-colors absolute top-0 left-0 w-full"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div
                        key={cell.id}
                        className="px-4 py-2 text-sm flex-shrink-0"
                        style={{
                          width: `${cell.column.getSize()}px`,
                          minWidth: `${cell.column.getSize()}px`,
                          maxWidth: `${cell.column.getSize()}px`,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
