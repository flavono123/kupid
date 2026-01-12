/**
 * Tests for DIYTableToolbar component
 *
 * Focus on:
 * - Search input focus/blur triggers onSearchFocusChange callback
 * - Keyboard events in search input don't propagate to parent
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DIYTableToolbar } from './DIYTableToolbar';

// Mock Wails SaveFile function
vi.mock('../../wailsjs/go/main/App', () => ({
  SaveFile: vi.fn(),
}));

const defaultProps = {
  globalFilter: '',
  onGlobalFilterChange: vi.fn(),
  filteredRowCount: 10,
  totalRowCount: 100,
  headers: ['name', 'namespace'],
  rows: [['pod-1', 'default'], ['pod-2', 'kube-system']],
  resourceKind: 'Pod',
};

describe('DIYTableToolbar - Search Focus Management', () => {
  it('should call onSearchFocusChange(true) when search input is focused', async () => {
    const onSearchFocusChange = vi.fn();

    render(
      <DIYTableToolbar
        {...defaultProps}
        onSearchFocusChange={onSearchFocusChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search ...');
    fireEvent.focus(searchInput);

    expect(onSearchFocusChange).toHaveBeenCalledWith(true);
  });

  it('should call onSearchFocusChange(false) when search input loses focus', async () => {
    const onSearchFocusChange = vi.fn();

    render(
      <DIYTableToolbar
        {...defaultProps}
        onSearchFocusChange={onSearchFocusChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search ...');
    fireEvent.focus(searchInput);
    fireEvent.blur(searchInput);

    expect(onSearchFocusChange).toHaveBeenCalledWith(false);
  });

  it('should not throw when onSearchFocusChange is not provided', () => {
    render(<DIYTableToolbar {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search ...');

    // Should not throw
    expect(() => {
      fireEvent.focus(searchInput);
      fireEvent.blur(searchInput);
    }).not.toThrow();
  });
});

describe('DIYTableToolbar - Keyboard Event Propagation', () => {
  it('should stop keydown event propagation from search input', async () => {
    const parentKeydownHandler = vi.fn();

    render(
      <div onKeyDown={parentKeydownHandler}>
        <DIYTableToolbar {...defaultProps} />
      </div>
    );

    const searchInput = screen.getByPlaceholderText('Search ...');

    // Type in the search input
    fireEvent.keyDown(searchInput, { key: 'a' });
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'ArrowUp' });
    fireEvent.keyDown(searchInput, { key: 'Backspace' });

    // Parent should NOT receive any keydown events
    expect(parentKeydownHandler).not.toHaveBeenCalled();
  });

  it('should allow typing in search input without interference', async () => {
    const user = userEvent.setup();
    const onGlobalFilterChange = vi.fn();

    render(
      <DIYTableToolbar
        {...defaultProps}
        onGlobalFilterChange={onGlobalFilterChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search ...');

    await user.type(searchInput, 'test');

    // Each character should trigger onChange (controlled component)
    expect(onGlobalFilterChange).toHaveBeenCalledTimes(4);
    // Last call receives single character 't' because input value is controlled
    expect(onGlobalFilterChange).toHaveBeenNthCalledWith(1, 't');
    expect(onGlobalFilterChange).toHaveBeenNthCalledWith(2, 'e');
    expect(onGlobalFilterChange).toHaveBeenNthCalledWith(3, 's');
    expect(onGlobalFilterChange).toHaveBeenNthCalledWith(4, 't');
  });
});

describe('DIYTableToolbar - Resource Count Display', () => {
  it('should show filtered count when search query is present', () => {
    render(
      <DIYTableToolbar
        {...defaultProps}
        globalFilter="pod"
        filteredRowCount={5}
        totalRowCount={100}
      />
    );

    expect(screen.getByText('5/100 Pods')).toBeInTheDocument();
  });

  it('should show total count when search query is empty', () => {
    render(
      <DIYTableToolbar
        {...defaultProps}
        globalFilter=""
        filteredRowCount={100}
        totalRowCount={100}
      />
    );

    expect(screen.getByText('100 Pods')).toBeInTheDocument();
  });
});

describe('DIYTableToolbar - Export Button', () => {
  it('should disable export button when rows are empty', () => {
    render(
      <DIYTableToolbar
        {...defaultProps}
        rows={[]}
      />
    );

    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(exportButton).toBeDisabled();
  });

  it('should enable export button when rows are present', () => {
    render(<DIYTableToolbar {...defaultProps} />);

    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(exportButton).not.toBeDisabled();
  });
});
