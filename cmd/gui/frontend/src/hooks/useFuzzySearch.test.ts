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
import { indexesToRanges } from './useFuzzySearch';

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
