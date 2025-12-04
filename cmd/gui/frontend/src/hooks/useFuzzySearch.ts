import { useMemo, useState } from 'react';
import fuzzysort from 'fuzzysort';

export interface FuzzySearchResult {
  item: string;
  indices: readonly [number, number][]; // Range format for highlighting
  score: number;
}

/**
 * Convert fuzzysort indexes to ranges for highlighting
 *
 * Example: [0, 1, 2, 5, 6, 7] → [[0, 2], [5, 7]]
 *
 * @param indexes - Array of character positions from fuzzysort
 * @returns Array of [start, end] tuples representing continuous ranges
 */
export function indexesToRanges(indexes: readonly number[]): [number, number][] {
  if (indexes.length === 0) return [];

  const ranges: [number, number][] = [];
  let start = indexes[0];
  let end = indexes[0];

  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] === end + 1) {
      // Continuous sequence
      end = indexes[i];
    } else {
      // Gap found, save current range and start new one
      ranges.push([start, end]);
      start = indexes[i];
      end = indexes[i];
    }
  }

  // Add the last range
  ranges.push([start, end]);
  return ranges;
}

export function useFuzzySearch(items: string[]) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query) {
      // No search query: return all items sorted alphabetically
      const sorted = [...items].sort((a, b) => a.localeCompare(b));
      return sorted.map(item => ({
        item,
        indices: [] as [number, number][],
        score: 0,
      }));
    }

    // Use fuzzysort for subsequence matching
    const searchResults = fuzzysort.go(query, items);

    return searchResults.map(result => ({
      item: result.target,
      indices: indexesToRanges(result.indexes),
      score: result.score,
    }));
  }, [query, items]);

  return { query, setQuery, results };
}
