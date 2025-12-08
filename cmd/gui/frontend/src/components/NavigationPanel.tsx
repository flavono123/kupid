import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { GetNodeTree } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { HighlightedText } from "./HighlightedText";

interface NavigationPanelProps {
  selectedGVK: main.MultiClusterGVK;
  connectedContexts: string[];
  onFieldsSelected?: (fields: string[][]) => void;
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
  const pathKey = node.fullPath.join('/');
  const expanded = expandedPaths.has(pathKey);
  const selected = selectedPaths.has(pathKey);
  const matchIndices = searchResultsMap.get(pathKey) || null;
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
    <div>
      <div
        ref={nodeRef}
        className={`flex items-center py-0.5 px-2 rounded-sm relative ${
          isFocused ? 'bg-primary/20 border-l-2 border-primary' : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: `${node.level * 12}px` }}
      >
        {/* Indent guide lines */}
        {node.level > 0 && (
          <div className="absolute left-0 top-0 bottom-0 flex">
            {Array.from({ length: node.level }).map((_, i) => (
              <div
                key={i}
                className="border-l border-border/40"
                style={{ marginLeft: `${i * 12}px` }}
              />
            ))}
          </div>
        )}

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
          {matchIndices ? (
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
              key={`${child.fullPath.join('/')}-${idx}`}
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

export function NavigationPanel({
  selectedGVK,
  connectedContexts,
  onFieldsSelected,
}: NavigationPanelProps) {
  const [nodeTree, setNodeTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchVisible, setSearchVisible] = useState(false);
  const [savedExpandedPaths, setSavedExpandedPaths] = useState<Set<string> | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

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
        const pathKey = node.fullPath.join('/');
        map.set(pathKey, node);
        if (node.children && node.children.length > 0) {
          flatten(node.children);
        }
      }
    };
    flatten(nodeTree);
    return map;
  }, [nodeTree]);

  // Prepare searchable texts - use same order as Map
  const { searchableTexts, pathKeys } = useMemo(() => {
    const texts: string[] = [];
    const keys: string[] = [];
    flatNodesMap.forEach((node, pathKey) => {
      texts.push(`${node.name} ${node.type}`);
      keys.push(pathKey);
    });
    return { searchableTexts: texts, pathKeys: keys };
  }, [flatNodesMap]);

  // Use stricter threshold for navigation panel (0.3 instead of default 0)
  const { query, setQuery, results } = useFuzzySearch(searchableTexts, 0.3);

  // Create a Map of search results for O(1) lookup
  const searchResultsMap = useMemo(() => {
    const map = new Map<string, readonly [number, number][] | null>();
    results.forEach((result) => {
      const index = searchableTexts.indexOf(result.item);
      if (index !== -1) {
        const pathKey = pathKeys[index];
        map.set(pathKey, result.indices);
      }
    });
    return map;
  }, [results, searchableTexts, pathKeys]);

  // Get list of matched paths for navigation
  const matchedPaths = useMemo(() => {
    return Array.from(searchResultsMap.keys());
  }, [searchResultsMap]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F / Ctrl+F: Toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchVisible((prev) => !prev);
        return;
      }

      if (!searchVisible) return;

      // Esc: Close search
      if (e.key === 'Escape') {
        setSearchVisible(false);
        setQuery('');
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
  }, [searchVisible, query, navigateMatches]);

  // Reset match index when search results change
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [matchedPaths.length]);

  // Auto-expand parent nodes when search has results
  useEffect(() => {
    if (query && searchResultsMap.size > 0) {
      // Save current expanded state before first search
      if (!savedExpandedPaths) {
        setSavedExpandedPaths(new Set(expandedPaths));
      }

      // Collect all parent paths of matched nodes
      // Start with empty set - only expand parents of matched nodes
      const pathsToExpand = new Set<string>();

      searchResultsMap.forEach((_, pathKey) => {
        const pathParts = pathKey.split('/');
        // Add all parent paths
        for (let i = 1; i < pathParts.length; i++) {
          const parentPath = pathParts.slice(0, i).join('/');
          pathsToExpand.add(parentPath);
        }
      });

      setExpandedPaths(pathsToExpand);
    } else if (!query && savedExpandedPaths) {
      // Restore saved state when search is cleared
      setExpandedPaths(savedExpandedPaths);
      setSavedExpandedPaths(null);
    }
  }, [query, searchResultsMap]);

  // Memoized toggle functions
  const toggleExpand = useCallback((path: string[]) => {
    const pathKey = path.join('/');
    setExpandedPaths((prev) => {
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
    const pathKey = path.join('/');
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }

      // Notify parent
      if (onFieldsSelected) {
        const selectedFields = Array.from(next).map((p) => p.split('/'));
        onFieldsSelected(selectedFields);
      }

      return next;
    });
  }, [onFieldsSelected]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Search Bar (conditional) - Float on wide screens, full width on narrow */}
      {searchVisible && (
        <div className="
          p-2 flex items-center gap-1.5
          border-b border-border
          md:absolute md:top-2 md:right-2 md:z-10
          md:w-64 md:border md:rounded-md md:shadow-lg
          md:bg-background/95 md:backdrop-blur-sm
          md:p-1.5
        ">
          <Input
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 h-8 text-sm"
            autoFocus
          />
          {query && matchedPaths.length > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {currentMatchIndex + 1}/{matchedPaths.length}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchVisible(false);
              setQuery('');
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Tree View */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Loading schema...</p>
          </div>
        ) : nodeTree.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No schema available</p>
          </div>
        ) : (
          <div className="p-2" style={{ minWidth: 'max-content' }}>
            {nodeTree.map((node, idx) => (
              <TreeNodeItem
                key={`${node.fullPath.join('/')}-${idx}`}
                node={node}
                expandedPaths={expandedPaths}
                selectedPaths={selectedPaths}
                onToggleExpand={toggleExpand}
                onToggleSelect={toggleSelect}
                searchResultsMap={searchResultsMap}
                focusedPath={query && matchedPaths.length > 0 ? matchedPaths[currentMatchIndex] : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
