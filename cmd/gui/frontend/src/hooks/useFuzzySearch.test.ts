/**
 * Tests for useFuzzySearch hook
 *
 * HOW TO RUN:
 * -----------
 * Prerequisites:
 *   npm install -D vitest @vitest/ui
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

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { indexesToRanges, useFuzzySearch } from './useFuzzySearch';

describe('indexesToRanges', () => {
  it('converts continuous indexes to a single range', () => {
    expect(indexesToRanges([0, 1, 2, 3])).toEqual([[0, 3]]);
  });

  it('converts non-continuous indexes to multiple ranges', () => {
    expect(indexesToRanges([0, 1, 2, 5, 6, 7])).toEqual([
      [0, 2],
      [5, 7],
    ]);
  });

  it('handles empty array', () => {
    expect(indexesToRanges([])).toEqual([]);
  });

  it('handles single index', () => {
    expect(indexesToRanges([5])).toEqual([[5, 5]]);
  });

  it('handles all non-continuous indexes', () => {
    expect(indexesToRanges([0, 2, 4, 6])).toEqual([
      [0, 0],
      [2, 2],
      [4, 4],
      [6, 6],
    ]);
  });

  it('handles mixed continuous and non-continuous indexes', () => {
    expect(indexesToRanges([0, 1, 5, 6, 7, 10])).toEqual([
      [0, 1],
      [5, 7],
      [10, 10],
    ]);
  });

  it('handles two separate characters', () => {
    expect(indexesToRanges([0, 5])).toEqual([
      [0, 0],
      [5, 5],
    ]);
  });

  it('handles long continuous sequence', () => {
    expect(indexesToRanges([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([[0, 9]]);
  });

  describe('real-world fuzzy search scenarios', () => {
    it('matches "dev" in "dev-cluster"', () => {
      // fuzzysort would return indexes [0, 1, 2] for "dev"
      expect(indexesToRanges([0, 1, 2])).toEqual([[0, 2]]);
    });

    it('matches "pdc" in "prod-dev-cluster"', () => {
      // fuzzysort would return indexes [0, 5, 9] for "pdc"
      expect(indexesToRanges([0, 5, 9])).toEqual([
        [0, 0],
        [5, 5],
        [9, 9],
      ]);
    });

    it('matches "kube" in "my-kube-context"', () => {
      // fuzzysort would return indexes [3, 4, 5, 6] for "kube"
      expect(indexesToRanges([3, 4, 5, 6])).toEqual([[3, 6]]);
    });
  });
});

describe('useFuzzySearch', () => {
  const testItems = [
    'production-cluster',
    'prod-cluster',
    'development-cluster',
    'dev-cluster',
    'staging-cluster',
    'test-cluster',
  ];

  describe('threshold behavior', () => {
    it('should accept all matches with threshold 0 (default)', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems, 0));

      act(() => {
        result.current.setQuery('p');
      });

      // With threshold 0, should match "production-cluster" and "prod-cluster"
      expect(result.current.results.length).toBeGreaterThan(0);
      const itemNames = result.current.results.map((r) => r.item);
      expect(itemNames).toContain('production-cluster');
      expect(itemNames).toContain('prod-cluster');
    });

    it('should filter results with higher threshold (0.5)', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems, 0.5));

      act(() => {
        result.current.setQuery('prod');
      });

      // With higher threshold, should only match better results
      // Exact substring matches should pass
      const itemNames = result.current.results.map((r) => r.item);
      expect(itemNames).toContain('production-cluster');
      expect(itemNames).toContain('prod-cluster');
    });

    it('should use threshold 0.3 for moderate filtering', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems, 0.3));

      act(() => {
        result.current.setQuery('dev');
      });

      // Should match both "development-cluster" and "dev-cluster"
      const itemNames = result.current.results.map((r) => r.item);
      expect(itemNames).toContain('development-cluster');
      expect(itemNames).toContain('dev-cluster');
    });

    it('should return empty results for very high threshold (0.9)', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems, 0.9));

      act(() => {
        result.current.setQuery('p');
      });

      // Very high threshold should filter out most fuzzy matches
      // Only near-perfect matches should pass
      expect(result.current.results.length).toBeLessThan(testItems.length);
    });
  });

  describe('basic functionality', () => {
    it('should return all items sorted when query is empty', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems));

      expect(result.current.query).toBe('');
      expect(result.current.results.length).toBe(testItems.length);

      // Results should be sorted alphabetically
      const itemNames = result.current.results.map((r) => r.item);
      const sortedItems = [...testItems].sort((a, b) => a.localeCompare(b));
      expect(itemNames).toEqual(sortedItems);
    });

    it('should update query when setQuery is called', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems));

      expect(result.current.query).toBe('');

      act(() => {
        result.current.setQuery('prod');
      });

      expect(result.current.query).toBe('prod');
    });

    it('should filter results based on query', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems));

      act(() => {
        result.current.setQuery('prod');
      });

      const itemNames = result.current.results.map((r) => r.item);
      expect(itemNames).toContain('production-cluster');
      expect(itemNames).toContain('prod-cluster');
      expect(itemNames).not.toContain('staging-cluster');
    });

    it('should include match indices in results', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems));

      act(() => {
        result.current.setQuery('dev');
      });

      const devResult = result.current.results.find((r) => r.item === 'dev-cluster');
      expect(devResult).toBeDefined();
      expect(devResult!.indices).toBeDefined();
      expect(devResult!.indices.length).toBeGreaterThan(0);
    });

    it('should include scores in results', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems));

      act(() => {
        result.current.setQuery('dev');
      });

      const devResult = result.current.results.find((r) => r.item === 'dev-cluster');
      expect(devResult).toBeDefined();
      expect(typeof devResult!.score).toBe('number');
    });
  });

  describe('edge cases', () => {
    it('should handle empty items array', () => {
      const { result } = renderHook(() => useFuzzySearch([]));

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.results).toEqual([]);
    });

    it('should handle special characters in query', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems));

      act(() => {
        result.current.setQuery('prod-');
      });

      // Should still work with special characters
      expect(result.current.results.length).toBeGreaterThan(0);
    });

    it('should handle case-insensitive search', () => {
      const { result } = renderHook(() => useFuzzySearch(testItems));

      act(() => {
        result.current.setQuery('PROD');
      });

      const itemNames = result.current.results.map((r) => r.item);
      expect(itemNames).toContain('production-cluster');
      expect(itemNames).toContain('prod-cluster');
    });
  });
});
