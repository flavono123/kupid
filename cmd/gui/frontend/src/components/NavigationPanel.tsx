import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { Card } from "./ui/card";
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
        className={`flex items-center py-1 px-2 rounded-sm ${
          isFocused ? 'bg-primary/20 border-l-2 border-primary' : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: `${node.level * 16 + 8}px` }}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0"
            onClick={handleExpandClick}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <span className="w-5" />
        )}

        {/* Selection checkbox (for leaf nodes only) */}
        {isLeaf && (
          <Checkbox
            checked={selected}
            onCheckedChange={handleSelectChange}
            className="ml-1 mr-2"
          />
        )}
        {!isLeaf && <span className="w-5 ml-1 mr-2" />}

        {/* Field name */}
        <span className="text-sm text-foreground">
          {matchIndices ? (
            <HighlightedText text={node.name} indices={matchIndices} />
          ) : (
            node.name
          )}
        </span>

        {/* Type */}
        {node.type && (
          <span className="text-xs text-muted-foreground ml-2">
            {`<${node.type}>`}
          </span>
        )}
      </div>

      {/* Children (if expanded) */}
      {expanded && (
        <div>
          {hasChildren ? (
            node.children.map((child, idx) => (
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
            ))
          ) : (
            <div
              className="text-xs text-muted-foreground italic"
              style={{ paddingLeft: `${(node.level + 1) * 16 + 8}px` }}
            >
              (empty)
            </div>
          )}
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
    <div className="flex flex-col h-full">
      {/* Search Bar (conditional) */}
      {searchVisible && (
        <div className="p-2 border-b border-border flex items-center gap-2">
          <Input
            placeholder="Search fields and types..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
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
