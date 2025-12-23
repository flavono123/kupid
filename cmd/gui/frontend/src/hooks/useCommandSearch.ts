import { useMemo } from "react";
import { main } from "../../wailsjs/go/models";
import { useFuzzySearch } from "./useFuzzySearch";
import { compareVersions } from "@/lib/version";

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

    const gvkItems: SearchItem[] = gvks.map((gvk) => ({
      type: 'gvk' as const,
      gvk,
      searchText: gvk.group ? `${gvk.group} ${gvk.kind}` : gvk.kind,
    }));

    return [...favItems, ...gvkItems];
  }, [favorites, gvks]);

  const { query, setQuery, results } = useFuzzySearch(searchItems, (item) => item.searchText);

  // Separate and sort results
  const { filteredFavorites, filteredGVKs } = useMemo(() => {
    const favoriteResults: FavoriteSearchResult[] = [];
    const gvkResults: Array<GVKSearchResult & { originalIndex: number }> = [];

    results.forEach((result, idx) => {
      if (result.item.type === 'favorite') {
        favoriteResults.push({
          favorite: result.item.favorite,
          indices: result.indices.length > 0 ? result.indices : null,
        });
      } else {
        gvkResults.push({
          gvk: result.item.gvk,
          indices: result.indices.length > 0 ? result.indices : null,
          originalIndex: idx,
        });
      }
    });

    // Sort GVKs: group (core first) -> kind -> version (semver desc)
    gvkResults.sort((a, b) => {
      // 1. Core group (empty string) comes first
      const aIsCore = a.gvk.group === "";
      const bIsCore = b.gvk.group === "";

      if (aIsCore && !bIsCore) return -1;
      if (!aIsCore && bIsCore) return 1;

      // 2. Compare groups alphabetically
      if (a.gvk.group !== b.gvk.group) {
        return a.gvk.group.localeCompare(b.gvk.group);
      }

      // 3. Compare kinds alphabetically
      if (a.gvk.kind !== b.gvk.kind) {
        return a.gvk.kind.localeCompare(b.gvk.kind);
      }

      // 4. Compare versions (semver descending)
      return compareVersions(a.gvk.version, b.gvk.version);
    });

    // Remove originalIndex from final results
    const sortedGVKs: GVKSearchResult[] = gvkResults.map(({ gvk, indices }) => ({
      gvk,
      indices,
    }));

    return { filteredFavorites: favoriteResults, filteredGVKs: sortedGVKs };
  }, [results]);

  return { query, setQuery, filteredFavorites, filteredGVKs };
}
