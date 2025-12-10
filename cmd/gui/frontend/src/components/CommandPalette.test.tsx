/**
 * Tests for CommandPalette component
 *
 * HOW TO RUN:
 * -----------
 * Prerequisites:
 *   npm install -D vitest @vitest/ui @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
 *
 * Add to package.json scripts:
 *   "test": "vitest",
 *   "test:ui": "vitest --ui",
 *   "test:run": "vitest run"
 *
 * Run tests:
 *   npm test                    # Watch mode
 *   npm run test:run           # Run once
 *   npm run test:ui            # UI mode
 *
 * TODO: Add to CI/CD pipeline
 * ---------------------------
 * - [ ] Add test script to GitHub Actions workflow
 * - [ ] Run tests on every PR
 * - [ ] Add coverage reporting (vitest --coverage)
 * - [ ] Set minimum coverage threshold (e.g., 80%)
 *
 * Example CI config (.github/workflows/test.yml):
 *   - name: Run tests
 *     run: npm run test:run
 *   - name: Check coverage
 *     run: npm run test:run -- --coverage
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from './CommandPalette';
import { main } from '../../wailsjs/go/models';

// Mock GVK data for testing
const createMockGVK = (
  kind: string,
  group: string = '',
  contexts: string[] = [],
  allCount: number = 2
): main.MultiClusterGVK => ({
  kind,
  group,
  version: 'v1',
  contexts,
  allCount,
});

describe('CommandPalette - Context Availability Badge Visibility', () => {
  const mockOnClose = () => {};
  const mockOnGVKSelect = () => {};

  describe('Single context connected', () => {
    it('should NOT show context availability badge when only 1 context is connected', () => {
      const gvks = [
        createMockGVK('Deployment', 'apps', ['context-1'], 1),
        createMockGVK('Pod', '', ['context-1'], 1),
      ];

      render(
        <CommandPalette
          contexts={['context-1']}
          gvks={gvks}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
        />
      );

      // Context availability badges should not be rendered
      const badges = screen.queryAllByText('1');
      expect(badges.length).toBe(0);
    });
  });

  describe('Multiple contexts connected', () => {
    it('should show context availability badge when multiple contexts are connected', () => {
      const gvks = [
        createMockGVK('Deployment', 'apps', ['context-1', 'context-2'], 2),
      ];

      render(
        <CommandPalette
          contexts={['context-1', 'context-2']}
          gvks={gvks}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
        />
      );

      // Should show availability count "2"
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should show "1" when GVK is available in only 1 context out of multiple', () => {
      const gvks = [
        createMockGVK('Deployment', 'apps', ['context-1'], 2), // Only in context-1
      ];

      render(
        <CommandPalette
          contexts={['context-1', 'context-2']}
          gvks={gvks}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
        />
      );

      // Should show "1" (available in 1 out of 2 contexts)
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should show correct availability count for each GVK', () => {
      const gvks = [
        createMockGVK('Deployment', 'apps', ['context-1', 'context-2'], 2),
        createMockGVK('Pod', '', ['context-1'], 2),
        createMockGVK('Service', '', ['context-2'], 2),
      ];

      render(
        <CommandPalette
          contexts={['context-1', 'context-2']}
          gvks={gvks}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
        />
      );

      // Should have one "2" and two "1"s
      const allCounts = screen.getAllByText(/^[12]$/);
      expect(allCounts.length).toBe(3);

      const twos = screen.getAllByText('2');
      expect(twos.length).toBe(1);

      const ones = screen.getAllByText('1');
      expect(ones.length).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty GVK list', () => {
      render(
        <CommandPalette
          contexts={['context-1', 'context-2']}
          gvks={[]}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
        />
      );

      // Should show "No GVKs found" message
      expect(screen.getByText('No GVKs found.')).toBeInTheDocument();
    });

    it('should show loading state correctly', () => {
      render(
        <CommandPalette
          contexts={['context-1', 'context-2']}
          gvks={[]}
          loading={true}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
        />
      );

      // Should show loading message
      expect(screen.getByText(/Loading GVKs from 2 contexts/)).toBeInTheDocument();
    });
  });
});

describe('CommandPalette - Focus Management', () => {
  const mockOnClose = vi.fn();
  const mockOnGVKSelect = vi.fn();

  it('should focus first item when typing in search', async () => {
    const user = userEvent.setup();
    const gvks = [
      createMockGVK('Pod', '', ['context-1'], 1),
      createMockGVK('PodTemplate', '', ['context-1'], 1),
      createMockGVK('Deployment', 'apps', ['context-1'], 1),
    ];

    render(
      <CommandPalette
        contexts={['context-1']}
        gvks={gvks}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search resources...');

    // Type "po" to filter
    await user.type(searchInput, 'po');

    // Wait for filtering to complete
    await waitFor(() => {
      // Pod should be visible (first match)
      expect(screen.getByText('Pod')).toBeInTheDocument();
      // PodTemplate should be visible (second match)
      expect(screen.getByText('PodTemplate')).toBeInTheDocument();
      // Deployment should not be visible (no match)
      expect(screen.queryByText('Deployment')).not.toBeInTheDocument();
    });

    // The Command component should have value set to first item's kind
    const commandList = screen.getByRole('listbox');
    expect(commandList).toBeInTheDocument();
  });

  it('should disable pointer events temporarily when query changes', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });

    const gvks = [
      createMockGVK('Pod', '', ['context-1'], 1),
      createMockGVK('Deployment', 'apps', ['context-1'], 1),
    ];

    render(
      <CommandPalette
        contexts={['context-1']}
        gvks={gvks}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search resources...');
    const commandList = screen.getByRole('listbox');

    // Initially, pointer-events should be disabled (disablePointer starts as true)
    expect(commandList.className).toContain('pointer-events-none');

    // Wait for initial timeout (100ms)
    vi.advanceTimersByTime(100);
    await waitFor(() => {
      expect(commandList.className).not.toContain('pointer-events-none');
    });

    // Type to change query
    await user.type(searchInput, 'p');

    // Pointer events should be disabled again
    await waitFor(() => {
      expect(commandList.className).toContain('pointer-events-none');
    });

    // After 100ms, pointer events should be re-enabled
    vi.advanceTimersByTime(100);
    await waitFor(() => {
      expect(commandList.className).not.toContain('pointer-events-none');
    });

    vi.useRealTimers();
  });

  it('should reset to first item when clearing search', async () => {
    const user = userEvent.setup();
    const gvks = [
      createMockGVK('Pod', '', ['context-1'], 1),
      createMockGVK('Deployment', 'apps', ['context-1'], 1),
    ];

    render(
      <CommandPalette
        contexts={['context-1']}
        gvks={gvks}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search resources...');

    // Type a search query
    await user.type(searchInput, 'deploy');

    // Clear the search
    await user.clear(searchInput);

    // Both items should be visible again
    await waitFor(() => {
      expect(screen.getByText('Pod')).toBeInTheDocument();
      expect(screen.getByText('Deployment')).toBeInTheDocument();
    });
  });

  it('should handle empty search results', async () => {
    const user = userEvent.setup();
    const gvks = [
      createMockGVK('Pod', '', ['context-1'], 1),
      createMockGVK('Deployment', 'apps', ['context-1'], 1),
    ];

    render(
      <CommandPalette
        contexts={['context-1']}
        gvks={gvks}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search resources...');

    // Type a query that matches nothing
    await user.type(searchInput, 'xyz123');

    // Should show empty state
    await waitFor(() => {
      expect(screen.getByText('No GVKs found.')).toBeInTheDocument();
    });
  });
});
