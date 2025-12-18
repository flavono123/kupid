import { useState, useEffect, useMemo, useCallback, memo, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "./ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Spinner } from "./ui/spinner";
import { FieldSearchBar } from "./FieldSearchBar";
import { GetNodeTree } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { HighlightedText } from "./HighlightedText";

// Use null character as path delimiter to avoid conflicts with field names containing '/'
// (e.g., Kubernetes annotations like "karpenter.sh/node-hash-version")
const PATH_DELIMITER = '\x00';

interface NavigationPanelProps {
  selectedGVK: main.MultiClusterGVK;
  connectedContexts: string[];
  onFieldsSelected?: (fields: string[][]) => void;
}

export interface NavigationPanelHandle {
  clearSelections: () => void;
  getSelectedCount: () => number;
  toggleSearch: () => void;
}

interface TreeNode {
  name: string;
  type: string;
  fullPath: string[];
  level: number;
  children: TreeNode[];
}

interface TreeNodeItemProps {
  node: TreeNode;
  expandedPaths: Set<string>;
  selectedPaths: Set<string>;
  onToggleExpand: (path: string[]) => void;
  onToggleSelect: (path: string[]) => void;
  searchResultsMap: Map<string, readonly [number, number][] | null>;
  focusedPath?: string;
}

// Memoized TreeNode component to prevent unnecessary re-renders
const TreeNodeItem = memo(({
  node,
  expandedPaths,
  selectedPaths,
  onToggleExpand,
  onToggleSelect,
  searchResultsMap,
  focusedPath,
}: TreeNodeItemProps) => {
  const hasChildren = node.children && node.children.length > 0;
  const isArrayOrMap = node.type && (node.type.startsWith('[]') || node.type.startsWith('map['));
  const isLeaf = !hasChildren && !isArrayOrMap;
  const pathKey = node.fullPath.join(PATH_DELIMITER);
  const expanded = expandedPaths.has(pathKey);
  const selected = selectedPaths.has(pathKey);
  const matchIndices = searchResultsMap.get(pathKey);
  const hasHighlight = matchIndices !== undefined && matchIndices !== null && matchIndices.length > 0;
  const isFocused = focusedPath === pathKey;
  const nodeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to focused node
  useEffect(() => {
    if (isFocused && nodeRef.current) {
      nodeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [isFocused]);

  const handleExpandClick = useCallback(() => {
    onToggleExpand(node.fullPath);
  }, [node.fullPath, onToggleExpand]);

  const handleSelectChange = useCallback(() => {
    onToggleSelect(node.fullPath);
  }, [node.fullPath, onToggleSelect]);

  return (
    <div className="relative">
      {/* Indent guide lines - with higher z-index to stay visible on hover */}
      {node.level > 0 && (
        <>
          {Array.from({ length: node.level }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-border/40 pointer-events-none z-10"
              style={{ left: `${i * 12}px` }}
            />
          ))}
        </>
      )}

      <div
        ref={nodeRef}
        className={`flex items-center py-0.5 pr-2 rounded-sm relative ${
          isFocused ? 'bg-primary/20' : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: `${node.level * 12 + 2}px` }}
      >

        {/* Expand/Collapse button OR Checkbox (mutually exclusive) */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 mr-1.5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleExpandClick}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ) : isLeaf ? (
          <Checkbox
            checked={selected}
            onCheckedChange={handleSelectChange}
            className="mr-1.5 h-3.5 w-3.5 shrink-0"
          />
        ) : (
          <span className="w-4 mr-1.5 shrink-0" />
        )}

        {/* Field name */}
        <span className="text-sm text-foreground font-mono">
          {hasHighlight && matchIndices ? (
            <HighlightedText text={node.name} indices={matchIndices} />
          ) : (
            node.name
          )}
        </span>

        {/* Type - styled with color, no angle brackets */}
        {node.type && (
          <span className="text-xs text-primary/70 ml-2 font-mono">
            {node.type}
          </span>
        )}
      </div>

      {/* Children (if expanded) */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <TreeNodeItem
              key={`${child.fullPath.join(PATH_DELIMITER)}-${idx}`}
              node={child}
              expandedPaths={expandedPaths}
              selectedPaths={selectedPaths}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
              searchResultsMap={searchResultsMap}
              focusedPath={focusedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
});

TreeNodeItem.displayName = 'TreeNodeItem';

export const NavigationPanel = forwardRef<NavigationPanelHandle, NavigationPanelProps>(({
  selectedGVK,
  connectedContexts,
  onFieldsSelected,
}, ref) => {
  const [nodeTree, setNodeTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualExpandedPaths, setManualExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchVisible, setSearchVisible] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Use ref for stable callback access to avoid stale closures
  const searchVisibleRef = useRef(searchVisible);
  searchVisibleRef.current = searchVisible;

  // Reset state when GVK changes
  useEffect(() => {
    setNodeTree([]);
    setLoading(true);
    setManualExpandedPaths(new Set());
    setSelectedPaths(new Set());
    setSearchVisible(false);
    setCurrentMatchIndex(0);
    setDebouncedQuery('');
  }, [selectedGVK]);

  // Fetch node tree
  useEffect(() => {
    if (!selectedGVK || connectedContexts.length === 0) {
      setNodeTree([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    GetNodeTree(selectedGVK, connectedContexts)
      .then((nodes) => {
        setNodeTree(nodes || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load node tree:", error);
        setNodeTree([]);
        setLoading(false);
      });
  }, [selectedGVK, connectedContexts]);

  // Flatten tree for search - create a Map for O(1) lookup
  const flatNodesMap = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const flatten = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        const pathKey = node.fullPath.join(PATH_DELIMITER);
        map.set(pathKey, node);
        if (node.children && node.children.length > 0) {
          flatten(node.children);
        }
      }
    };
    flatten(nodeTree);
    return map;
  }, [nodeTree]);

  // Prepare searchable items with index tracking
  const searchableItems = useMemo(() => {
    const items: Array<{ text: string; pathKey: string; node: TreeNode; index: number }> = [];
    let index = 0;
    flatNodesMap.forEach((node, pathKey) => {
      items.push({
        text: `${node.name} ${node.type}`,
        pathKey,
        node,
        index: index++,
      });
    });
    return items;
  }, [flatNodesMap]);

  // Use fuzzy search hook with generic type (using debounced query)
  const { query, setQuery, results: allSearchResults } = useFuzzySearch(
    searchableItems,
    (item) => item.text,
    0.3
  );

  // Debounce query to avoid searching on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150); // 150ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Limit search results to prevent performance issues
  const MAX_RESULTS = 200;
  const searchResults = useMemo(() => {
    // Only apply debounce and limiting when there's a query
    if (!debouncedQuery) {
      return allSearchResults;
    }
    return allSearchResults.slice(0, MAX_RESULTS);
  }, [allSearchResults, debouncedQuery]);

  const hasMoreResults = Boolean(debouncedQuery) && allSearchResults.length > MAX_RESULTS;

  // Get all matched paths sorted by tree order (for auto-expand and Enter navigation)
  const matchedPaths = useMemo(() => {
    return [...searchResults]
      .sort((a, b) => a.item.index - b.item.index) // Tree order: top to bottom
      .map((result) => result.item.pathKey);
  }, [searchResults]);

  // Create a Map of search results for O(1) lookup (for highlighting only)
  const searchResultsMap = useMemo(() => {
    const map = new Map<string, readonly [number, number][] | null>();
    searchResults.forEach((result) => {
      // Filter indices to only include those within node.name
      // This handles cases where the match is in node.type
      const nameLength = result.item.node.name.length;
      const filteredIndices = result.indices
        .filter(([start]) => start < nameLength)
        .map(([start, end]): [number, number] => [start, Math.min(end, nameLength - 1)]);

      // Add to map with filtered indices (null if no match in name)
      map.set(result.item.pathKey, filteredIndices.length > 0 ? filteredIndices : null);
    });
    return map;
  }, [searchResults]);

  // Navigate to next/previous match
  const navigateMatches = useCallback((direction: 'next' | 'prev') => {
    if (matchedPaths.length === 0) return;

    setCurrentMatchIndex((prevIndex) => {
      let newIndex: number;
      if (direction === 'next') {
        newIndex = (prevIndex + 1) % matchedPaths.length;
      } else {
        newIndex = (prevIndex - 1 + matchedPaths.length) % matchedPaths.length;
      }
      return newIndex;
    });
  }, [matchedPaths.length]);

  // Toggle search
  const toggleSearch = useCallback(() => {
    if (searchVisibleRef.current) {
      setSearchVisible(false);
      setQuery('');
    } else {
      setSearchVisible(true);
    }
  }, []);

  // Close search
  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setQuery('');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F / Ctrl+F: Toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearch();
        return;
      }

      if (!searchVisible) return;

      // Esc: Close search
      if (e.key === 'Escape') {
        closeSearch();
        return;
      }

      // Enter: Next match, Shift+Enter: Previous match
      if (e.key === 'Enter' && query) {
        e.preventDefault();
        navigateMatches(e.shiftKey ? 'prev' : 'next');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible, query, navigateMatches, toggleSearch, closeSearch]);

  // Reset match index when search results change
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [matchedPaths.length]);

  // Compute parent paths of selected fields (to auto-expand)
  const selectedParentPaths = useMemo(() => {
    const paths = new Set<string>();
    selectedPaths.forEach((pathKey) => {
      const pathParts = pathKey.split(PATH_DELIMITER);
      // Add all parent paths (not the selected path itself)
      for (let i = 1; i < pathParts.length; i++) {
        const parentPath = pathParts.slice(0, i).join(PATH_DELIMITER);
        paths.add(parentPath);
      }
    });
    return paths;
  }, [selectedPaths]);

  // Compute paths to expand based on search results
  const searchExpandedPaths = useMemo(() => {
    if (!debouncedQuery || matchedPaths.length === 0) {
      return new Set<string>();
    }

    const paths = new Set<string>();
    matchedPaths.forEach((pathKey) => {
      const pathParts = pathKey.split(PATH_DELIMITER);
      // Add all parent paths
      for (let i = 1; i < pathParts.length; i++) {
        const parentPath = pathParts.slice(0, i).join(PATH_DELIMITER);
        paths.add(parentPath);
      }
    });
    return paths;
  }, [debouncedQuery, matchedPaths]);

  // Final expanded paths = manual + search + selected parents
  const expandedPaths = useMemo(() => {
    const paths = new Set<string>(manualExpandedPaths);

    // Add search-expanded paths when searching
    if (debouncedQuery) {
      searchExpandedPaths.forEach((path) => paths.add(path));
    }

    // Always add selected parent paths
    selectedParentPaths.forEach((path) => paths.add(path));

    return paths;
  }, [manualExpandedPaths, debouncedQuery, searchExpandedPaths, selectedParentPaths]);


  // Filter tree to only show matched nodes and their parents when searching
  const filteredNodeTree = useMemo(() => {
    if (!debouncedQuery || matchedPaths.length === 0) {
      return nodeTree;
    }

    // Create a Set of all paths to show (matched nodes + their ancestors)
    const pathsToShow = new Set<string>();
    matchedPaths.forEach((pathKey) => {
      const pathParts = pathKey.split(PATH_DELIMITER);
      // Add the node itself and all its ancestors
      for (let i = 1; i <= pathParts.length; i++) {
        pathsToShow.add(pathParts.slice(0, i).join(PATH_DELIMITER));
      }
    });

    // Recursively filter the tree
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .filter((node) => pathsToShow.has(node.fullPath.join(PATH_DELIMITER)))
        .map((node) => ({
          ...node,
          children: node.children ? filterNodes(node.children) : [],
        }));
    };

    return filterNodes(nodeTree);
  }, [debouncedQuery, matchedPaths, nodeTree]);

  // Memoized toggle functions
  const toggleExpand = useCallback((path: string[]) => {
    const pathKey = path.join(PATH_DELIMITER);
    setManualExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  }, []);

  const toggleSelect = useCallback((path: string[]) => {
    const pathKey = path.join(PATH_DELIMITER);

    // Check if path contains wildcard '*'
    const wildcardIndex = path.findIndex(p => p === '*');

    if (wildcardIndex === -1) {
      // No wildcard, handle normally
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(pathKey)) {
          next.delete(pathKey);
        } else {
          next.add(pathKey);

          // Auto-expand parent paths when selecting a field
          setManualExpandedPaths((prevExpanded) => {
            const nextExpanded = new Set(prevExpanded);
            for (let i = 1; i < path.length; i++) {
              const parentPath = path.slice(0, i).join(PATH_DELIMITER);
              nextExpanded.add(parentPath);
            }
            return nextExpanded;
          });
        }

        if (onFieldsSelected) {
          const selectedFields = Array.from(next)
            .filter((p) => !p.includes('*')) // Filter out wildcard paths (UI only)
            .map((p) => p.split(PATH_DELIMITER));
          onFieldsSelected(selectedFields);
        }

        return next;
      });
    } else {
      // Wildcard found - toggle all index nodes
      const arrayPath = path.slice(0, wildcardIndex);
      const pathAfterWildcard = path.slice(wildcardIndex + 1);

      // Find array node
      const arrayPathKey = arrayPath.join(PATH_DELIMITER);
      const arrayNode = flatNodesMap.get(arrayPathKey);

      if (!arrayNode || !arrayNode.children) {
        return;
      }

      setSelectedPaths((prev) => {
        const next = new Set(prev);

        // Find all index nodes (numeric children)
        const indexNodes = arrayNode.children.filter((child) => {
          return child.name !== '*' && !isNaN(Number(child.name));
        });

        // Check if all index nodes with the same path are selected
        const allSelected = indexNodes.every((indexNode) => {
          const targetPath = [...arrayPath, indexNode.name, ...pathAfterWildcard];
          return next.has(targetPath.join(PATH_DELIMITER));
        });

        // Toggle all
        const toSelect = !allSelected;
        indexNodes.forEach((indexNode) => {
          const targetPath = [...arrayPath, indexNode.name, ...pathAfterWildcard];
          const targetPathKey = targetPath.join(PATH_DELIMITER);

          if (toSelect) {
            next.add(targetPathKey);
          } else {
            next.delete(targetPathKey);
          }
        });

        // Also toggle the wildcard path for UI display
        if (toSelect) {
          next.add(pathKey);
        } else {
          next.delete(pathKey);
        }

        // Auto-expand parent paths if selecting
        if (toSelect) {
          setManualExpandedPaths((prevExpanded) => {
            const nextExpanded = new Set(prevExpanded);
            // Expand parents of all selected paths
            indexNodes.forEach((indexNode) => {
              const targetPath = [...arrayPath, indexNode.name, ...pathAfterWildcard];
              for (let i = 1; i < targetPath.length; i++) {
                const parentPath = targetPath.slice(0, i).join(PATH_DELIMITER);
                nextExpanded.add(parentPath);
              }
            });
            return nextExpanded;
          });
        }

        if (onFieldsSelected) {
          const selectedFields = Array.from(next)
            .filter((p) => !p.includes('*')) // Filter out wildcard paths (UI only)
            .map((p) => p.split(PATH_DELIMITER));
          onFieldsSelected(selectedFields);
        }

        return next;
      });
    }
  }, [onFieldsSelected, flatNodesMap]);

  const clearAllSelections = useCallback(() => {
    setSelectedPaths(new Set());
    if (onFieldsSelected) {
      onFieldsSelected([]);
    }
  }, [onFieldsSelected]);

  useImperativeHandle(ref, () => ({
    clearSelections: clearAllSelections,
    getSelectedCount: () => selectedPaths.size,
    toggleSearch,
  }), [clearAllSelections, selectedPaths.size, toggleSearch]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Search Bar (conditional) */}
      {/* TODO: Add slide-down/slide-up animation when showing/hiding */}
      {searchVisible && (
        <FieldSearchBar
          query={query}
          onQueryChange={setQuery}
          currentMatchIndex={currentMatchIndex}
          totalMatches={matchedPaths.length}
          hasMoreResults={hasMoreResults}
          onClose={closeSearch}
        />
      )}

      {/* Tree View */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Spinner className="w-8 h-8" />
            <p className="text-sm text-muted-foreground">Loading schema...</p>
          </div>
        ) : filteredNodeTree.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {debouncedQuery ? 'No matching fields found' : 'No schema available'}
            </p>
          </div>
        ) : (
          <div className="p-2" style={{ minWidth: 'max-content' }}>
            {filteredNodeTree.map((node, idx) => (
              <TreeNodeItem
                key={`${node.fullPath.join(PATH_DELIMITER)}-${idx}`}
                node={node}
                expandedPaths={expandedPaths}
                selectedPaths={selectedPaths}
                onToggleExpand={toggleExpand}
                onToggleSelect={toggleSelect}
                searchResultsMap={searchResultsMap}
                focusedPath={debouncedQuery && matchedPaths.length > 0 ? matchedPaths[currentMatchIndex] : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

NavigationPanel.displayName = 'NavigationPanel';
