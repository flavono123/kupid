import { useMemo, useState } from "react";
import fuzzysort from "fuzzysort";
import { main } from "../../wailsjs/go/models";
import { useFuzzySearch, indexesToRanges } from "./useFuzzySearch";
import { compareVersions } from "@/lib/version";

/**
 * Get the first short name from a GVK's shortNames array.
 * Returns undefined if no short names are available.
 */
function getFirstShortName(shortNames: string[] | undefined): string | undefined {
  return shortNames && shortNames.length > 0 ? shortNames[0] : undefined;
}

export interface FavoriteSearchResult {
  favorite: main.FavoriteViewResponse;
  indices: readonly [number, number][] | null;
}

/**
 * GVK search result with field-specific highlight indices.
 *
 * The search uses multi-key fuzzy matching with field boosting:
 * - abbreviation: Highest priority (exact match gets maximum score)
 * - kind: Medium priority
 * - group: Lowest priority (to prevent group matches from overshadowing abbr matches)
 */
export interface GVKSearchResult {
  gvk: main.MultiClusterGVK;
  /** Highlight indices for abbreviation field */
  abbrIndices: readonly [number, number][] | null;
  /** Highlight indices for kind field */
  kindIndices: readonly [number, number][] | null;
  /** Highlight indices for group field */
  groupIndices: readonly [number, number][] | null;
  /** First short name (abbreviation) for display */
  abbreviation: string | undefined;
  /** Combined search score (closer to 0 is better) */
  score: number;
}

interface UseCommandSearchResult {
  query: string;
  setQuery: (query: string) => void;
  filteredFavorites: FavoriteSearchResult[];
  filteredGVKs: GVKSearchResult[];
}

/**
 * Prepared GVK item for fuzzysort multi-key search.
 * Pre-computing search fields improves performance.
 */
interface PreparedGVKItem {
  gvk: main.MultiClusterGVK;
  abbr: string;
  kind: string;
  group: string;
}

/**
 * Score bonuses and penalties for different match types.
 * Higher score = better (closer to 0 or positive).
 *
 * Scoring Strategy (Priority Order):
 * 1. Abbreviation exact match: +1000 (best)
 * 2. Abbreviation prefix match: +500
 * 3. Kind prefix match: +100
 * 4. Abbreviation fuzzy match: raw score
 * 5. Kind fuzzy match: -1000 penalty
 * 6. Group match: -5000 penalty (lowest priority)
 *
 * This ensures "cert" → Certificate (abbr=cert) ranks first,
 * not ClusterWorkflowTemplate (abbr contains c...e...r...t fuzzy).
 */
const SCORE_ADJUSTMENTS = {
  ABBR_EXACT: 1000,      // abbr === query
  ABBR_PREFIX: 500,      // abbr.startsWith(query)
  KIND_PREFIX: 100,      // kind.startsWith(query)
  ABBR_FUZZY: 0,         // fuzzy match on abbr
  KIND_FUZZY: -1000,     // fuzzy match on kind
  GROUP_FUZZY: -5000,    // fuzzy match on group
} as const;

/**
 * Calculate combined score from multi-key search results with field boosting.
 *
 * Prioritizes exact/prefix matches over fuzzy matches to ensure
 * abbreviation searches like "po" return Pod first, not random fuzzy matches.
 *
 * @param abbrResult - Fuzzysort result for abbreviation field
 * @param kindResult - Fuzzysort result for kind field
 * @param groupResult - Fuzzysort result for group field
 * @param query - Original search query
 * @param abbr - Original abbreviation value
 * @param kind - Original kind value
 * @returns Combined score where higher is better
 */
function calculateBoostedScore(
  abbrResult: Fuzzysort.Result | null,
  kindResult: Fuzzysort.Result | null,
  groupResult: Fuzzysort.Result | null,
  query: string,
  abbr: string,
  kind: string
): number {
  const queryLower = query.toLowerCase();
  const abbrLower = abbr.toLowerCase();
  const kindLower = kind.toLowerCase();

  // Priority 1: Exact abbreviation match (e.g., "cert" === "cert")
  if (abbrLower && abbrLower === queryLower) {
    return SCORE_ADJUSTMENTS.ABBR_EXACT;
  }

  // Priority 2: Abbreviation prefix match (e.g., "po" matches "pod" abbreviation if it existed)
  if (abbrLower && abbrLower.startsWith(queryLower)) {
    return SCORE_ADJUSTMENTS.ABBR_PREFIX;
  }

  // Priority 3: Kind prefix match (e.g., "Pod" starts with "po")
  if (kindLower.startsWith(queryLower)) {
    return SCORE_ADJUSTMENTS.KIND_PREFIX;
  }

  // Priority 4-6: Fuzzy matches with penalties
  const scores: number[] = [];

  if (abbrResult) {
    scores.push(abbrResult.score + SCORE_ADJUSTMENTS.ABBR_FUZZY);
  }
  if (kindResult) {
    scores.push(kindResult.score + SCORE_ADJUSTMENTS.KIND_FUZZY);
  }
  if (groupResult) {
    scores.push(groupResult.score + SCORE_ADJUSTMENTS.GROUP_FUZZY);
  }

  // Return best score, or -Infinity if no matches
  return scores.length > 0 ? Math.max(...scores) : -Infinity;
}

/**
 * Custom hook for CommandPalette search functionality.
 *
 * ## Search Strategy
 *
 * ### Favorites
 * Uses single-key fuzzy search on combined text (name + GVK info).
 *
 * ### GVKs (Kubernetes Resources)
 * Uses multi-key fuzzy search with prioritized matching:
 *
 * | Priority | Match Type | Score Bonus | Example |
 * |----------|------------|-------------|---------|
 * | 1 | Abbr exact | +1000 | "cert" === "cert" (Certificate) |
 * | 2 | Abbr prefix | +500 | "de" starts "deploy" |
 * | 3 | Kind prefix | +100 | "Pod" starts with "po" |
 * | 4 | Abbr fuzzy | 0 | fuzzy match on abbreviation |
 * | 5 | Kind fuzzy | -1000 | fuzzy match on kind |
 * | 6 | Group fuzzy | -5000 | fuzzy match on group |
 *
 * This ensures exact/prefix matches rank above fuzzy matches,
 * so "po" → Pod, "cert" → Certificate (not fuzzy matches in other fields).
 *
 * ## Sorting
 * Results are sorted by:
 * 1. Score (higher is better)
 * 2. Core group first (empty string)
 * 3. Group alphabetically
 * 4. Kind alphabetically
 * 5. Version (semver descending)
 */
export function useCommandSearch(
  favorites: main.FavoriteViewResponse[],
  gvks: main.MultiClusterGVK[]
): UseCommandSearchResult {
  const [query, setQuery] = useState('');

  // Prepare favorite items for search
  const favoriteItems = useMemo(() => {
    return favorites.map((fav) => {
      const gvkText = fav.gvk.group ? `${fav.gvk.group} ${fav.gvk.kind}` : fav.gvk.kind;
      return {
        favorite: fav,
        searchText: `${fav.name} ${gvkText}`,
      };
    });
  }, [favorites]);

  // Prepare GVK items for multi-key search
  const preparedGVKs = useMemo((): PreparedGVKItem[] => {
    return gvks.map((gvk) => ({
      gvk,
      abbr: getFirstShortName(gvk.shortNames) ?? '',
      kind: gvk.kind,
      group: gvk.group,
    }));
  }, [gvks]);

  // Search favorites using existing fuzzy search
  const { results: favoriteResults } = useFuzzySearch(
    favoriteItems,
    (item) => item.searchText
  );

  // Filter favorites based on query
  const filteredFavorites = useMemo((): FavoriteSearchResult[] => {
    if (!query) {
      // No query: return all favorites
      return favorites.map((fav) => ({
        favorite: fav,
        indices: null,
      }));
    }

    return favoriteResults
      .filter((result) => result.item.favorite)
      .map((result) => ({
        favorite: result.item.favorite,
        indices: result.indices.length > 0 ? result.indices : null,
      }));
  }, [query, favorites, favoriteResults]);

  // Search GVKs using multi-key fuzzysort with field boosting
  const filteredGVKs = useMemo((): GVKSearchResult[] => {
    if (!query) {
      // No query: return all GVKs sorted by group/kind/version
      return preparedGVKs
        .map((item) => ({
          gvk: item.gvk,
          abbrIndices: null,
          kindIndices: null,
          groupIndices: null,
          abbreviation: item.abbr || undefined,
          score: 0,
        }))
        .sort((a, b) => {
          // Core group first
          const aIsCore = a.gvk.group === "";
          const bIsCore = b.gvk.group === "";
          if (aIsCore && !bIsCore) return -1;
          if (!aIsCore && bIsCore) return 1;

          // Group alphabetically
          if (a.gvk.group !== b.gvk.group) {
            return a.gvk.group.localeCompare(b.gvk.group);
          }

          // Kind alphabetically
          if (a.gvk.kind !== b.gvk.kind) {
            return a.gvk.kind.localeCompare(b.gvk.kind);
          }

          // Version (semver descending)
          return compareVersions(a.gvk.version, b.gvk.version);
        });
    }

    // Perform multi-key search on each field separately
    const abbrResults = fuzzysort.go(query, preparedGVKs, { key: 'abbr', threshold: -10000 });
    const kindResults = fuzzysort.go(query, preparedGVKs, { key: 'kind', threshold: -10000 });
    const groupResults = fuzzysort.go(query, preparedGVKs, { key: 'group', threshold: -10000 });

    // Create lookup maps for results
    const abbrMap = new Map(abbrResults.map((r) => [r.obj, r]));
    const kindMap = new Map(kindResults.map((r) => [r.obj, r]));
    const groupMap = new Map(groupResults.map((r) => [r.obj, r]));

    // Find all GVKs that matched in any field
    const matchedItems = new Set<PreparedGVKItem>();
    abbrResults.forEach((r) => matchedItems.add(r.obj));
    kindResults.forEach((r) => matchedItems.add(r.obj));
    groupResults.forEach((r) => matchedItems.add(r.obj));

    // Build results with boosted scores
    const results: GVKSearchResult[] = [];
    matchedItems.forEach((item) => {
      const abbrResult = abbrMap.get(item) ?? null;
      const kindResult = kindMap.get(item) ?? null;
      const groupResult = groupMap.get(item) ?? null;

      const score = calculateBoostedScore(
        abbrResult,
        kindResult,
        groupResult,
        query,
        item.abbr,
        item.kind
      );

      results.push({
        gvk: item.gvk,
        abbrIndices: abbrResult ? indexesToRanges(abbrResult.indexes) : null,
        kindIndices: kindResult ? indexesToRanges(kindResult.indexes) : null,
        groupIndices: groupResult ? indexesToRanges(groupResult.indexes) : null,
        abbreviation: item.abbr || undefined,
        score,
      });
    });

    // Sort by score (desc) -> group (core first) -> kind -> version
    results.sort((a, b) => {
      // 1. Score first (closer to 0 is better)
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      // 2. Core group (empty string) comes first
      const aIsCore = a.gvk.group === "";
      const bIsCore = b.gvk.group === "";
      if (aIsCore && !bIsCore) return -1;
      if (!aIsCore && bIsCore) return 1;

      // 3. Compare groups alphabetically
      if (a.gvk.group !== b.gvk.group) {
        return a.gvk.group.localeCompare(b.gvk.group);
      }

      // 4. Compare kinds alphabetically
      if (a.gvk.kind !== b.gvk.kind) {
        return a.gvk.kind.localeCompare(b.gvk.kind);
      }

      // 5. Compare versions (semver descending)
      return compareVersions(a.gvk.version, b.gvk.version);
    });

    return results;
  }, [query, preparedGVKs]);

  return { query, setQuery, filteredFavorites, filteredGVKs };
}
