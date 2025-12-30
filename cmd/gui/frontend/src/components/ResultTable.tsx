import { useState, useMemo, useRef, forwardRef, useImperativeHandle, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { rankItem } from '@tanstack/match-sorter-utils';
import { cn } from '../lib/utils';
import { Spinner } from './ui/spinner';
import { CellContent } from './CellContent';
import { ResultTableToolbar, ResultTableToolbarHandle } from './ResultTableToolbar';
import { useCellHighlight } from '../hooks/useCellHighlight';
import { useResourceData } from '../hooks/useResourceData';
import { useFlashingCells } from '../hooks/useFlashingCells';
import type { main } from '../../wailsjs/go/models';

interface ResultTableProps {
  selectedFields: string[][];  // From NavigationPanel
  selectedGVK: main.MultiClusterGVK;
  connectedContexts: string[];
}

export interface ResultTableHandle {
  focusSearch: () => void;
  isSearchFocused: () => boolean;
  navigateUp: () => void;
  navigateDown: () => void;
  navigateLeft: () => void;
  navigateRight: () => void;
  copyFocusedCell: () => void;
  exportToClipboard: () => void;
  exportToFile: () => void;
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

export const ResultTable = forwardRef<ResultTableHandle, ResultTableProps>(({
  selectedFields,
  selectedGVK,
  connectedContexts,
}, ref) => {
  // Use extracted hook for data fetching (watch enabled for real-time updates)
  const { data, loading, getRowId, changedCells } = useResourceData(
    selectedGVK,
    connectedContexts,
    { watch: true }
  );

  // Track flashing cells for real-time update visualization
  const { isFlashing } = useFlashingCells(changedCells);

  const [globalFilter, setGlobalFilter] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<ResultTableToolbarHandle>(null);

  // Unified focus state (keyboard navigation + mouse hover)
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [focusedColIndex, setFocusedColIndex] = useState<number | null>(null);
  // Track copied cell for "Copied" feedback
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);

  // Get highlight function based on current search query
  const getHighlightIndices = useCellHighlight(globalFilter);

  // Reset focus when data changes
  useEffect(() => {
    setFocusedRowIndex(null);
    setFocusedColIndex(null);
  }, [selectedGVK]);

  // Calculate column width based on field name and data
  // Returns { size: initial display width, maxSize: max possible width }
  const calculateColumnWidth = (fieldName: string, values: any[]): { size: number; maxSize: number } => {
    // Header is displayed in UPPERCASE, so use wider char width (10px per char)
    // Add 40px for padding (px-4 = 32px) + resize handle (8px)
    const headerWidth = fieldName.length * 10 + 40;

    // Sample first 100 values to estimate max width
    const sampleSize = Math.min(100, values.length);
    const samples = values.slice(0, sampleSize);

    let maxValueWidth = 0;
    for (const value of samples) {
      const text = typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value ?? '');
      const width = text.length * 8 + 32;
      maxValueWidth = Math.max(maxValueWidth, width);
    }

    // maxSize: actual max of header and values (no cap)
    const maxSize = Math.max(headerWidth, maxValueWidth, 80);
    // size: initial display width capped at 300px
    const size = Math.min(maxSize, 300);

    return { size, maxSize };
  };

  // Memoize column widths separately (only recalculate when fields or data change)
  const columnWidths = useMemo(() => {
    // Always add default columns at the beginning
    let fieldsToUse: string[][];

    if (connectedContexts.length === 1) {
      // Single context: name + selectedFields
      fieldsToUse = [['metadata', 'name'], ...selectedFields];
    } else {
      // Multiple contexts: context, name + selectedFields
      fieldsToUse = [['_context'], ['metadata', 'name'], ...selectedFields];
    }

    const widths: Record<string, { size: number; maxSize: number }> = {};
    fieldsToUse.forEach((fieldPath) => {
      const fieldName = fieldPath[fieldPath.length - 1];
      const columnValues = data.map((row) => getNestedValue(row, fieldPath));
      widths[fieldPath.join('.')] = calculateColumnWidth(fieldName, columnValues);
    });

    return widths;
  }, [selectedFields, connectedContexts, data]);

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
      const columnId = fieldPath.join('.');
      const widths = columnWidths[columnId] || { size: 100, maxSize: 300 };

      return {
        id: columnId,
        header: fieldName === '_context' ? 'context' : fieldName,  // Rename _context to context
        accessorFn: (row) => getNestedValue(row, fieldPath),
        size: widths.size,  // Use pre-calculated initial width
        minSize: 80,  // Minimum column width
        maxSize: widths.maxSize,  // Dynamic max based on header/values
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
  }, [selectedFields, connectedContexts, columnWidths, getHighlightIndices]);

  // Create table instance
  const table = useReactTable({
    data,
    columns,
    getRowId,  // Stable row identity for real-time updates
    columnResizeMode: 'onChange',  // Enable column resizing
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

  // Navigation callbacks (must be defined after rows and columns)
  const navigateUp = useCallback(() => {
    setFocusedRowIndex((prev) => {
      if (prev === null) return rows.length > 0 ? 0 : null;
      return Math.max(0, prev - 1);
    });
    if (focusedColIndex === null && columns.length > 0) {
      setFocusedColIndex(0);
    }
  }, [rows.length, focusedColIndex, columns.length]);

  const navigateDown = useCallback(() => {
    setFocusedRowIndex((prev) => {
      if (prev === null) return rows.length > 0 ? 0 : null;
      return Math.min(rows.length - 1, prev + 1);
    });
    if (focusedColIndex === null && columns.length > 0) {
      setFocusedColIndex(0);
    }
  }, [rows.length, focusedColIndex, columns.length]);

  const navigateLeft = useCallback(() => {
    setFocusedColIndex((prev) => {
      if (prev === null) return columns.length > 0 ? 0 : null;
      return Math.max(0, prev - 1);
    });
    if (focusedRowIndex === null && rows.length > 0) {
      setFocusedRowIndex(0);
    }
  }, [columns.length, focusedRowIndex, rows.length]);

  const navigateRight = useCallback(() => {
    setFocusedColIndex((prev) => {
      if (prev === null) return columns.length > 0 ? 0 : null;
      return Math.min(columns.length - 1, prev + 1);
    });
    if (focusedRowIndex === null && rows.length > 0) {
      setFocusedRowIndex(0);
    }
  }, [columns.length, focusedRowIndex, rows.length]);

  const copyFocusedCell = useCallback(() => {
    if (focusedRowIndex === null || focusedColIndex === null) return;
    const row = rows[focusedRowIndex];
    if (!row) return;
    const cell = row.getVisibleCells()[focusedColIndex];
    if (!cell) return;

    const value = cell.getValue();
    const text = typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value ?? '');

    navigator.clipboard.writeText(text).then(() => {
      // Set copied cell key to show "Copied" feedback
      const cellKey = `${row.id}-${cell.column.id}`;
      setCopiedCellKey(cellKey);
      // Clear after 1 second
      setTimeout(() => setCopiedCellKey(null), 1000);
    }).catch(console.error);
  }, [focusedRowIndex, focusedColIndex, rows]);

  // Expose handle methods
  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      toolbarRef.current?.focusSearch();
    },
    isSearchFocused: () => {
      return toolbarRef.current?.isSearchFocused() ?? false;
    },
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    copyFocusedCell,
    exportToClipboard: () => {
      toolbarRef.current?.exportToClipboard();
    },
    exportToFile: () => {
      toolbarRef.current?.exportToFile();
    },
  }), [navigateUp, navigateDown, navigateLeft, navigateRight, copyFocusedCell]);

  // Get total width from table state (updates on resize)
  const totalColumnsWidth = table.getTotalSize();

  // Setup row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 28,  // Estimated row height in pixels (reduced from 35)
    overscan: 10,  // Render 10 extra rows above/below viewport
  });

  // Auto-scroll to keep focused row visible
  useEffect(() => {
    if (focusedRowIndex !== null) {
      rowVirtualizer.scrollToIndex(focusedRowIndex, { align: 'auto' });
    }
  }, [focusedRowIndex, rowVirtualizer]);

  // Prepare export data (headers and rows for CSV)
  const exportData = useMemo(() => {
    const headers = table.getHeaderGroups()[0]?.headers.map((header) => {
      return typeof header.column.columnDef.header === 'string'
        ? header.column.columnDef.header
        : String(header.column.columnDef.header);
    }) || [];

    const exportRows = rows.map((row) => {
      return row.getVisibleCells().map((cell) => {
        const value = cell.getValue();
        // Handle objects/arrays - convert to JSON string for CSV
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value);
        }
        return value;
      });
    });

    console.log('Export data prepared:', { headers, rowCount: exportRows.length, sampleRow: exportRows[0] });
    return { headers, rows: exportRows };
  }, [table, rows]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar with Search and Export */}
      <ResultTableToolbar
        ref={toolbarRef}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        filteredRowCount={rows.length}
        totalRowCount={data.length}
        headers={exportData.headers}
        rows={exportData.rows}
        resourceKind={selectedGVK?.kind || 'resources'}
      />

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
          <div style={{ minWidth: `${totalColumnsWidth}px` }}>
            {/* Header (sticky) */}
            <div className="sticky top-0 bg-background z-10 border-b border-border">
              {table.getHeaderGroups().map((headerGroup) => (
                <div key={headerGroup.id} className="flex">
                  {headerGroup.headers.map((header) => {
                    const headerText = typeof header.column.columnDef.header === 'string'
                      ? header.column.columnDef.header
                      : String(header.column.columnDef.header);

                    return (
                      <div
                        key={header.id}
                        className="relative px-4 py-2 text-left text-sm font-semibold uppercase flex-shrink-0 text-muted-foreground"
                        style={{
                          width: `${header.getSize()}px`,
                          minWidth: `${header.column.columnDef.minSize || 80}px`,
                        }}
                      >
                        <CellContent value={headerText} />
                        {/* Column resize handle */}
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
                            "hover:bg-primary/50",
                            header.column.getIsResizing() && "bg-primary"
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Body (virtualized) */}
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                const isRowFocused = focusedRowIndex === virtualRow.index;
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "flex border-b border-border hover:bg-focus transition-colors absolute top-0 left-0",
                      isRowFocused && "bg-focus"
                    )}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: `max(${totalColumnsWidth}px, 100%)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => {
                      const isCellFocused = isRowFocused && focusedColIndex === cellIndex;
                      const cellKey = `${row.id}-${cell.column.id}`;
                      const showCopied = copiedCellKey === cellKey;

                      // Get cell value and highlight indices for direct rendering
                      const value = cell.getValue();
                      const fullText = typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value ?? '');
                      const highlightIndices = getHighlightIndices(fullText);

                      return (
                        <div
                          key={cell.id}
                          className={cn(
                            "px-4 py-1 text-sm flex-shrink-0",
                            isFlashing(row.id, cell.column.id) && "animate-cell-flash"
                          )}
                          style={{
                            width: `${cell.column.getSize()}px`,
                            minWidth: `${cell.column.columnDef.minSize || 80}px`,
                          }}
                          onMouseEnter={() => {
                            // Mouse hover moves focus to this cell
                            setFocusedRowIndex(virtualRow.index);
                            setFocusedColIndex(cellIndex);
                          }}
                        >
                          <CellContent
                            value={value}
                            highlightIndices={highlightIndices}
                            isFocused={isCellFocused}
                            showCopied={showCopied}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ResultTable.displayName = 'ResultTable';
