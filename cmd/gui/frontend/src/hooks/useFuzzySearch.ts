import { useMemo, useState } from 'react';
import fuzzysort from 'fuzzysort';

export interface FuzzySearchResult<T = string> {
  item: T;
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

// Overload 1: For string arrays (backward compatibility)
export function useFuzzySearch(
  items: string[],
  threshold?: number
): { query: string; setQuery: (query: string) => void; results: FuzzySearchResult<string>[] };

// Overload 2: For object arrays with getSearchText
export function useFuzzySearch<T>(
  items: T[],
  getSearchText: (item: T) => string,
  threshold?: number
): { query: string; setQuery: (query: string) => void; results: FuzzySearchResult<T>[] };

// Implementation
export function useFuzzySearch<T = string>(
  items: T[],
  getSearchTextOrThreshold?: ((item: T) => string) | number,
  thresholdParam?: number
) {
  const [query, setQuery] = useState('');

  // Parse parameters
  const getSearchText: (item: T) => string =
    typeof getSearchTextOrThreshold === 'function'
      ? getSearchTextOrThreshold
      : (item) => String(item);

  const threshold =
    typeof getSearchTextOrThreshold === 'number'
      ? getSearchTextOrThreshold
      : thresholdParam ?? 0;

  const results = useMemo<FuzzySearchResult<T>[]>(() => {
    if (!query) {
      // No search query: return all items sorted alphabetically
      const sorted = [...items].sort((a, b) => {
        const textA = getSearchText(a);
        const textB = getSearchText(b);
        return textA.localeCompare(textB);
      });
      const emptyIndices: [number, number][] = [];
      return sorted.map((item): FuzzySearchResult<T> => ({
        item,
        indices: emptyIndices,
        score: 0,
      }));
    }

    // Use fuzzysort for subsequence matching with threshold
    // Threshold range: 0 (accept all) to 1 (perfect match only)
    // Higher threshold = stricter matching (fewer results)
    // Default 0 accepts all matches, 0.3-0.4 is moderately strict

    // Handle string arrays vs object arrays differently
    if (typeof getSearchTextOrThreshold === 'function') {
      // Object array with custom getSearchText
      const searchResults = fuzzysort.go(query, items, {
        key: getSearchText,
        threshold: threshold,
      });

      return searchResults.map((result): FuzzySearchResult<T> => ({
        item: result.obj,
        indices: indexesToRanges(result.indexes),
        score: result.score,
      }));
    } else {
      // String array (T is string)
      // Create a map from string representation to original item
      const stringToItem = new Map<string, T>();
      items.forEach((item) => {
        stringToItem.set(String(item), item);
      });

      const searchResults = fuzzysort.go(query, items.map(String), {
        threshold: threshold,
      });

      return searchResults.map((result): FuzzySearchResult<T> => {
        const item = stringToItem.get(result.target);
        // item will always exist because result.target comes from items.map(String)
        return {
          item: item ?? items[0], // Fallback should never be needed
          indices: indexesToRanges(result.indexes),
          score: result.score,
        };
      }).filter((r): r is FuzzySearchResult<T> => r.item !== undefined);
    }
  }, [query, items, threshold, getSearchText]);

  return { query, setQuery, results };
}
