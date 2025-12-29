import { useCallback } from 'react';
import fuzzysort from 'fuzzysort';

/**
 * Function that takes text and returns highlight indices for matching characters
 */
type HighlightFunction = (text: string) => [number, number][] | null;

/**
 * Hook for highlighting search matches in table cells
 * Returns a function that takes text and returns highlight indices
 */
export function useCellHighlight(query: string): HighlightFunction {
  return useCallback(
    (text: string): [number, number][] | null => {
      if (!query || !text) return null;

      const result = fuzzysort.single(query, String(text));
      if (!result) return null;

      // Convert fuzzysort.indexes to HighlightedText format
      // fuzzysort.indexes is an array of character indices that matched
      // HighlightedText expects an array of [start, end] tuples
      return result.indexes.map((i) => [i, i] as [number, number]);
    },
    [query]
  );
}
