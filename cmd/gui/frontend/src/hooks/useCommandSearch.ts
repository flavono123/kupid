import { useMemo } from "react";
import { main } from "../../wailsjs/go/models";
import { useFuzzySearch } from "./useFuzzySearch";
import { compareVersions } from "@/lib/version";

/**
 * Get the first short name from a GVK's shortNames array.
 * Returns undefined if no short names are available.
 */
function getFirstShortName(shortNames: string[] | undefined): string | undefined {
  return shortNames && shortNames.length > 0 ? shortNames[0] : undefined;
}

/**
 * Internal search item type for unified fuzzy search.
 * This union allows searching across both favorites and GVKs with a single query.
 */
type SearchItem =
  | { type: 'favorite'; favorite: main.FavoriteViewResponse; searchText: string }
  | { type: 'gvk'; gvk: main.MultiClusterGVK; searchText: string };

export interface FavoriteSearchResult {
  favorite: main.FavoriteViewResponse;
  indices: readonly [number, number][] | null;
}

export interface GVKSearchResult {
  gvk: main.MultiClusterGVK;
  indices: readonly [number, number][] | null;
  abbreviation: string | undefined;
  score: number;
}

interface UseCommandSearchResult {
  query: string;
  setQuery: (query: string) => void;
  filteredFavorites: FavoriteSearchResult[];
  filteredGVKs: GVKSearchResult[];
}

/**
 * Custom hook for CommandPalette search functionality.
 * Provides unified fuzzy search across favorites and GVKs,
 * with results separated and sorted appropriately.
 */
export function useCommandSearch(
  favorites: main.FavoriteViewResponse[],
  gvks: main.MultiClusterGVK[]
): UseCommandSearchResult {
  // Build searchable items from favorites and GVKs
  const searchItems = useMemo((): SearchItem[] => {
    const favItems: SearchItem[] = favorites.map((fav) => {
      const gvkText = fav.gvk.group ? `${fav.gvk.group} ${fav.gvk.kind}` : fav.gvk.kind;
      return {
        type: 'favorite' as const,
        favorite: fav,
        searchText: `${fav.name} ${gvkText}`,
      };
    });

    const gvkItems: SearchItem[] = gvks.map((gvk) => {
      const abbr = getFirstShortName(gvk.shortNames);
      // Include abbreviation at the beginning for priority matching
      // Format: "abbr kind group" or "kind group" if no abbreviation
      const searchText = abbr
        ? `${abbr} ${gvk.kind} ${gvk.group}`.trim()
        : `${gvk.kind} ${gvk.group}`.trim();
      return {
        type: 'gvk' as const,
        gvk,
        searchText,
      };
    });

    return [...favItems, ...gvkItems];
  }, [favorites, gvks]);

  const { query, setQuery, results } = useFuzzySearch(searchItems, (item) => item.searchText);

  // Separate and sort results
  const { filteredFavorites, filteredGVKs } = useMemo(() => {
    const favoriteResults: FavoriteSearchResult[] = [];
    const gvkResults: GVKSearchResult[] = [];

    results.forEach((result) => {
      if (result.item.type === 'favorite') {
        favoriteResults.push({
          favorite: result.item.favorite,
          indices: result.indices.length > 0 ? result.indices : null,
        });
      } else {
        gvkResults.push({
          gvk: result.item.gvk,
          indices: result.indices.length > 0 ? result.indices : null,
          abbreviation: getFirstShortName(result.item.gvk.shortNames),
          score: result.score,
        });
      }
    });

    // Sort GVKs: score (desc) -> group (core first) -> kind -> version (semver desc)
    gvkResults.sort((a, b) => {
      // 1. Score first (higher is better, fuzzysort returns negative scores where closer to 0 is better)
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

    return { filteredFavorites: favoriteResults, filteredGVKs: gvkResults };
  }, [results]);

  return { query, setQuery, filteredFavorites, filteredGVKs };
}
