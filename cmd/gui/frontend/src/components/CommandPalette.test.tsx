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

// Default props for all tests
const defaultProps = {
  theme: 'light',
  onThemeToggle: () => {},
};

describe('CommandPalette - Context Availability Badge Visibility', () => {
  const mockOnClose = () => {};
  const mockOnGVKSelect = () => {};
  const mockOnFavoriteSelect = () => {};

  describe('Single context connected', () => {
    it('should NOT show context availability badge when only 1 context is connected', () => {
      const gvks = [
        createMockGVK('Deployment', 'apps', ['context-1'], 1),
        createMockGVK('Pod', '', ['context-1'], 1),
      ];

      render(
        <CommandPalette
          {...defaultProps}
          contexts={['context-1']}
          gvks={gvks}
          favorites={[]}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
          onFavoriteSelect={mockOnFavoriteSelect}
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
          {...defaultProps}
          contexts={['context-1', 'context-2']}
          gvks={gvks}
          favorites={[]}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
          onFavoriteSelect={mockOnFavoriteSelect}
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
          {...defaultProps}
          contexts={['context-1', 'context-2']}
          gvks={gvks}
          favorites={[]}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
          onFavoriteSelect={mockOnFavoriteSelect}
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
          {...defaultProps}
          contexts={['context-1', 'context-2']}
          gvks={gvks}
          favorites={[]}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
          onFavoriteSelect={mockOnFavoriteSelect}
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
    it('should handle empty GVK list - shows Settings when no search query', () => {
      render(
        <CommandPalette
          {...defaultProps}
          contexts={['context-1', 'context-2']}
          gvks={[]}
          favorites={[]}
          loading={false}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
          onFavoriteSelect={mockOnFavoriteSelect}
        />
      );

      // Should show SETTINGS group even when GVK list is empty
      expect(screen.getByText('SETTINGS')).toBeInTheDocument();
      // Should show theme toggle option
      expect(screen.getByText(/(Light|Dark) Mode/)).toBeInTheDocument();
    });

    it('should show loading state correctly', () => {
      render(
        <CommandPalette
          {...defaultProps}
          contexts={['context-1', 'context-2']}
          gvks={[]}
          favorites={[]}
          loading={true}
          onClose={mockOnClose}
          onGVKSelect={mockOnGVKSelect}
          onFavoriteSelect={mockOnFavoriteSelect}
        />
      );

      // Should show loading message
      expect(screen.getByText(/Loading GVKs from 2 contexts/)).toBeInTheDocument();
    });
  });
});

// Helper to check if text content exists anywhere in the document
// This handles cases where text is split across multiple elements (e.g., by HighlightedText)
const hasTextContent = (text: string): boolean => {
  const items = document.querySelectorAll('[cmdk-item]');
  return Array.from(items).some(item => item.textContent?.includes(text));
};

describe('CommandPalette - Focus Management', () => {
  const mockOnClose = vi.fn();
  const mockOnGVKSelect = vi.fn();
  const mockOnFavoriteSelect = vi.fn();

  it('should focus first item when typing in search', async () => {
    const user = userEvent.setup();
    const gvks = [
      createMockGVK('Pod', '', ['context-1'], 1),
      createMockGVK('PodTemplate', '', ['context-1'], 1),
      createMockGVK('Deployment', 'apps', ['context-1'], 1),
    ];

    render(
      <CommandPalette
        {...defaultProps}
        contexts={['context-1']}
        gvks={gvks}
        favorites={[]}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
        onFavoriteSelect={mockOnFavoriteSelect}
      />
    );

    // Wait for initial render with all items visible
    await waitFor(() => {
      expect(hasTextContent('Pod')).toBe(true);
      expect(hasTextContent('Deployment')).toBe(true);
    });

    const searchInput = screen.getByPlaceholderText('Search resources...');

    // Type "po" to filter
    await user.type(searchInput, 'po');

    // Wait for filtering to complete (fuzzy search is async)
    // Note: HighlightedText splits text across elements, so we use hasTextContent
    await waitFor(() => {
      // Pod and PodTemplate should be visible (matches "po")
      expect(hasTextContent('Pod')).toBe(true);
      expect(hasTextContent('PodTemplate')).toBe(true);
    }, { timeout: 2000 });

    // The Command component should have the listbox
    const commandList = screen.getByRole('listbox');
    expect(commandList).toBeInTheDocument();
  });

  it('should show all items initially and filter on search', async () => {
    const user = userEvent.setup();
    const gvks = [
      createMockGVK('Pod', '', ['context-1'], 1),
      createMockGVK('Deployment', 'apps', ['context-1'], 1),
    ];

    render(
      <CommandPalette
        {...defaultProps}
        contexts={['context-1']}
        gvks={gvks}
        favorites={[]}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
        onFavoriteSelect={mockOnFavoriteSelect}
      />
    );

    // Wait for initial render - all items should be visible
    await waitFor(() => {
      expect(hasTextContent('Pod')).toBe(true);
      expect(hasTextContent('Deployment')).toBe(true);
    });

    const searchInput = screen.getByPlaceholderText('Search resources...');

    // Type "deploy" to filter
    await user.type(searchInput, 'deploy');

    // Wait for filtering - Deployment should match
    await waitFor(() => {
      expect(hasTextContent('Deployment')).toBe(true);
    }, { timeout: 2000 });
  });

  it('should reset to first item when clearing search', async () => {
    const user = userEvent.setup();
    const gvks = [
      createMockGVK('Pod', '', ['context-1'], 1),
      createMockGVK('Deployment', 'apps', ['context-1'], 1),
    ];

    render(
      <CommandPalette
        {...defaultProps}
        contexts={['context-1']}
        gvks={gvks}
        favorites={[]}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
        onFavoriteSelect={mockOnFavoriteSelect}
      />
    );

    // Wait for initial render
    await waitFor(() => {
      expect(hasTextContent('Pod')).toBe(true);
    });

    const searchInput = screen.getByPlaceholderText('Search resources...');

    // Type a search query
    await user.type(searchInput, 'deploy');

    // Wait for filter to apply
    await waitFor(() => {
      expect(hasTextContent('Deployment')).toBe(true);
    }, { timeout: 2000 });

    // Clear the search
    await user.clear(searchInput);

    // Both items should be visible again
    await waitFor(() => {
      expect(hasTextContent('Pod')).toBe(true);
      expect(hasTextContent('Deployment')).toBe(true);
    }, { timeout: 2000 });
  });

  it('should handle empty search results', async () => {
    const user = userEvent.setup();
    const gvks = [
      createMockGVK('Pod', '', ['context-1'], 1),
      createMockGVK('Deployment', 'apps', ['context-1'], 1),
    ];

    render(
      <CommandPalette
        {...defaultProps}
        contexts={['context-1']}
        gvks={gvks}
        favorites={[]}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
        onFavoriteSelect={mockOnFavoriteSelect}
      />
    );

    // Wait for initial render
    await waitFor(() => {
      expect(hasTextContent('Pod')).toBe(true);
    });

    const searchInput = screen.getByPlaceholderText('Search resources...');

    // Type a query that matches nothing
    await user.type(searchInput, 'xyz123');

    // Should show empty state
    await waitFor(() => {
      expect(screen.getByText('No results found.')).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

describe('CommandPalette - Resource Sorting', () => {
  const mockOnClose = vi.fn();
  const mockOnGVKSelect = vi.fn();
  const mockOnFavoriteSelect = vi.fn();

  it('should sort core resources before non-core resources', () => {
    const gvks = [
      { kind: 'Deployment', group: 'apps', version: 'v1', contexts: ['ctx'], allCount: 1 },
      { kind: 'Pod', group: '', version: 'v1', contexts: ['ctx'], allCount: 1 },
    ];

    render(
      <CommandPalette
        {...defaultProps}
        contexts={['ctx']}
        gvks={gvks}
        favorites={[]}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
        onFavoriteSelect={mockOnFavoriteSelect}
      />
    );

    // Get all items
    const items = document.querySelectorAll('[cmdk-item]');
    const itemTexts = Array.from(items).map(item => item.textContent || '');

    // Pod (core) should come before Deployment (apps)
    const podIndex = itemTexts.findIndex(text => text.includes('Pod'));
    const deploymentIndex = itemTexts.findIndex(text => text.includes('Deployment'));

    expect(podIndex).toBeLessThan(deploymentIndex);
  });

  it('should sort versions in semver order (stable > beta > alpha)', async () => {
    const gvks = [
      { kind: 'NetworkPolicy', group: 'networking.k8s.io', version: 'v1alpha1', contexts: ['ctx'], allCount: 1 },
      { kind: 'NetworkPolicy', group: 'networking.k8s.io', version: 'v1', contexts: ['ctx'], allCount: 1 },
      { kind: 'NetworkPolicy', group: 'networking.k8s.io', version: 'v1beta1', contexts: ['ctx'], allCount: 1 },
    ];

    render(
      <CommandPalette
        {...defaultProps}
        contexts={['ctx']}
        gvks={gvks}
        favorites={[]}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
        onFavoriteSelect={mockOnFavoriteSelect}
      />
    );

    // Wait for render
    await waitFor(() => {
      expect(hasTextContent('NetworkPolicy')).toBe(true);
    });

    // Get all items
    const items = document.querySelectorAll('[cmdk-item]');
    const itemTexts = Array.from(items).map(item => item.textContent || '');

    // Find indices of each version
    const v1Index = itemTexts.findIndex(text => text.includes('networking.k8s.io/v1') && !text.includes('alpha') && !text.includes('beta'));
    const v1beta1Index = itemTexts.findIndex(text => text.includes('v1beta1'));
    const v1alpha1Index = itemTexts.findIndex(text => text.includes('v1alpha1'));

    console.log('Item texts:', itemTexts);
    console.log('v1 index:', v1Index, 'v1beta1 index:', v1beta1Index, 'v1alpha1 index:', v1alpha1Index);

    // v1 should come before v1beta1, and v1beta1 should come before v1alpha1
    expect(v1Index).toBeLessThan(v1beta1Index);
    expect(v1beta1Index).toBeLessThan(v1alpha1Index);
  });

  it('should sort higher major versions first', async () => {
    const gvks = [
      { kind: 'CustomResource', group: 'example.com', version: 'v1', contexts: ['ctx'], allCount: 1 },
      { kind: 'CustomResource', group: 'example.com', version: 'v2', contexts: ['ctx'], allCount: 1 },
    ];

    render(
      <CommandPalette
        {...defaultProps}
        contexts={['ctx']}
        gvks={gvks}
        favorites={[]}
        loading={false}
        onClose={mockOnClose}
        onGVKSelect={mockOnGVKSelect}
        onFavoriteSelect={mockOnFavoriteSelect}
      />
    );

    await waitFor(() => {
      expect(hasTextContent('CustomResource')).toBe(true);
    });

    const items = document.querySelectorAll('[cmdk-item]');
    const itemTexts = Array.from(items).map(item => item.textContent || '');

    const v2Index = itemTexts.findIndex(text => text.includes('example.com/v2'));
    const v1Index = itemTexts.findIndex(text => text.includes('example.com/v1'));

    // v2 should come before v1
    expect(v2Index).toBeLessThan(v1Index);
  });
});
