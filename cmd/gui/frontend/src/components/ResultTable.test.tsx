/**
 * Tests for ResultTable component
 *
 * Focus on:
 * - Cell focus cleared when isTableFocused becomes false (Tab to nav panel)
 * - Cell focus cleared when mouse leaves table area
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResultTable } from './ResultTable';

// Mock data
const mockData = [
  { _context: 'ctx1', metadata: { name: 'pod-1', namespace: 'default' } },
  { _context: 'ctx1', metadata: { name: 'pod-2', namespace: 'kube-system' } },
  { _context: 'ctx1', metadata: { name: 'pod-3', namespace: 'default' } },
];

// Mock useResourceData hook
vi.mock('../hooks/useResourceData', () => ({
  useResourceData: vi.fn(() => ({
    data: mockData,
    loading: false,
    error: null,
    refresh: vi.fn(),
    watchStatus: 'connected',
    getRowId: (row: any) => `${row._context}/${row.metadata.namespace}/${row.metadata.name}`,
    changedCells: [],
  })),
}));

// Mock useFlashingCells hook
vi.mock('../hooks/useFlashingCells', () => ({
  useFlashingCells: vi.fn(() => ({
    isFlashing: () => false,
  })),
}));

// Mock useVirtualizer to render all rows (bypass virtualization in tests)
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 28,
        size: 28,
        key: i,
      })),
    getTotalSize: () => count * 28,
    scrollToIndex: vi.fn(),
  })),
}));

// Mock Wails SaveFile function
vi.mock('../../wailsjs/go/main/App', () => ({
  SaveFile: vi.fn(),
}));

const defaultGVK = {
  group: '',
  version: 'v1',
  kind: 'Pod',
  contexts: ['ctx1'],
  allCount: 1,
};

const defaultProps = {
  selectedFields: [['metadata', 'namespace']],
  selectedGVK: defaultGVK,
  connectedContexts: ['ctx1'],
  isTableFocused: true,
};

// Helper to find focused cells (CellContent uses underline class when focused)
const getFocusedCellCount = () => {
  // CellContent with isFocused=true has "underline bg-accent/50" class
  return document.querySelectorAll('[class*="underline"][class*="bg-accent"]').length;
};

// Helper to find open popovers (CellContent popover opens when isFocused=true)
const getOpenPopoverCount = () => {
  return document.querySelectorAll('[data-state="open"]').length;
};

describe('ResultTable - Cell Focus Clear on Panel Switch', () => {
  it('should clear cell focus when isTableFocused becomes false', async () => {
    const { rerender } = render(<ResultTable {...defaultProps} isTableFocused={true} />);

    // Wait for table to render
    await waitFor(() => {
      expect(screen.getByText('pod-1')).toBeInTheDocument();
    });

    // Hover over a cell to create focus
    const cell = screen.getByText('pod-1');
    fireEvent.mouseEnter(cell.closest('div[class*="px-4"]')!);

    // The cell should show focused state (underline class)
    expect(getFocusedCellCount()).toBeGreaterThan(0);

    // Now simulate Tab to nav panel by changing isTableFocused to false
    rerender(<ResultTable {...defaultProps} isTableFocused={false} />);

    // After isTableFocused becomes false, cell focus should be cleared
    expect(getFocusedCellCount()).toBe(0);
  });

  it('should not show cell focus when table panel is not focused', async () => {
    render(<ResultTable {...defaultProps} isTableFocused={false} />);

    await waitFor(() => {
      expect(screen.getByText('pod-1')).toBeInTheDocument();
    });

    // Initially no cells should be focused
    expect(getFocusedCellCount()).toBe(0);
  });
});

describe('ResultTable - Cell Focus Clear on Mouse Leave', () => {
  it('should clear cell focus when mouse leaves table area', async () => {
    render(<ResultTable {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('pod-1')).toBeInTheDocument();
    });

    // Find the table container (has overflow-auto class)
    const tableContainer = document.querySelector('.overflow-auto');
    expect(tableContainer).not.toBeNull();

    // Hover over a cell to create focus
    const cell = screen.getByText('pod-1');
    fireEvent.mouseEnter(cell.closest('div[class*="px-4"]')!);

    // Verify cell is focused
    expect(getFocusedCellCount()).toBeGreaterThan(0);

    // Mouse leave from table container
    fireEvent.mouseLeave(tableContainer!);

    // After mouse leave, cell focus should be cleared
    expect(getFocusedCellCount()).toBe(0);
  });
});

describe('ResultTable - Search Focus Clear', () => {
  it('should clear cell focus when search input is focused', async () => {
    render(<ResultTable {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('pod-1')).toBeInTheDocument();
    });

    // Hover over a cell to create focus
    const cell = screen.getByText('pod-1');
    fireEvent.mouseEnter(cell.closest('div[class*="px-4"]')!);

    // Verify cell is focused
    expect(getFocusedCellCount()).toBeGreaterThan(0);

    // Focus the search input
    const searchInput = screen.getByPlaceholderText('Search ...');
    fireEvent.focus(searchInput);

    // After search focus, cell focus should be cleared
    expect(getFocusedCellCount()).toBe(0);
  });
});

describe('ResultTable - Basic Rendering', () => {
  it('should render table with data', async () => {
    render(<ResultTable {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('pod-1')).toBeInTheDocument();
      expect(screen.getByText('pod-2')).toBeInTheDocument();
      expect(screen.getByText('pod-3')).toBeInTheDocument();
    });
  });

  it('should render column headers', async () => {
    render(<ResultTable {...defaultProps} />);

    await waitFor(() => {
      // Headers are uppercase
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('namespace')).toBeInTheDocument();
    });
  });

  it('should render search toolbar', () => {
    render(<ResultTable {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search ...')).toBeInTheDocument();
  });
});
