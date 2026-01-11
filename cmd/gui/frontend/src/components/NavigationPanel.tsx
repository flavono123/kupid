import { memo, useRef, forwardRef, useImperativeHandle, useEffect, useCallback, useMemo } from 'react';
import { Button } from './ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Spinner } from './ui/spinner';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card';
import { FieldSearchBar, FieldSearchBarHandle } from './FieldSearchBar';
import { main } from '../../wailsjs/go/models';
import { useTree, TreeNode, PATH_DELIMITER } from '@/hooks/useTree';
import { HighlightedText } from './HighlightedText';
import { DEFAULT_SCHEMA_FIELDS } from '@/lib/constants';

interface NavigationPanelProps {
  selectedGVK: main.MultiClusterGVK;
  connectedContexts: string[];
  onFieldsSelected?: (fields: string[][]) => void;
  /** Called when schema loading completes and component is ready */
  onReady?: () => void;
  /** Called when a field is focused (for sync with ResultTable) */
  onFieldFocus?: (path: string[] | null) => void;
  /** Field path to highlight (from ResultTable hover) */
  highlightedFieldPath?: string[];
}

export interface NavigationPanelHandle {
  clearSelections: () => void;
  getSelectedCount: () => number;
  getSelectedPaths: () => Set<string>;
  setSelectedPaths: (paths: Set<string>) => void;
  toggleSearch: () => void;
  // Keyboard navigation
  navigateUp: () => void;
  navigateDown: () => void;
  toggleFocused: () => void;
  isSearchFocused: () => boolean;
}

interface TreeNodeItemProps {
  node: TreeNode;
  expandedPaths: Set<string>;
  selectedPaths: Set<string>;
  onToggleExpand: (path: string[]) => void;
  onToggleSelect: (path: string[]) => void;
  searchResultsMap: Map<string, readonly [number, number][] | null>;
  focusedPath?: string;
  onFocus?: (pathKey: string) => void;
  /** Whether to auto-scroll when focused (only for keyboard/search navigation) */
  shouldAutoScroll?: boolean;
  /** Path highlighted from ResultTable hover */
  highlightedFieldPathKey?: string;
  /** Paths of wildcard child fields that are in indeterminate state */
  wildcardIndeterminatePaths: Set<string>;
  /** Paths of wildcard child fields where all indexed siblings are selected */
  wildcardSelectedPaths: Set<string>;
  /** Fields to ignore (disabled for expand/select) - maps field name to reason */
  ignoredFields: Map<string, string>;
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
  onFocus,
  shouldAutoScroll = false,
  highlightedFieldPathKey,
  wildcardIndeterminatePaths,
  wildcardSelectedPaths,
  ignoredFields,
}: TreeNodeItemProps) => {
  const hasChildren = node.children && node.children.length > 0;
  const isArrayOrMap = node.type && (node.type.startsWith('[]') || node.type.startsWith('map['));
  const isLeaf = !hasChildren && !isArrayOrMap;
  const pathKey = node.fullPath.join(PATH_DELIMITER);
  // Default columns (always shown in ResultTable) - disable selection
  const isDefaultColumn = DEFAULT_SCHEMA_FIELDS.includes(node.fullPath.join('.') as typeof DEFAULT_SCHEMA_FIELDS[number]);
  // Check if this field is in the ignored list (disabled for expand/select)
  const isIgnored = ignoredFields.has(node.name);
  const ignoredReason = ignoredFields.get(node.name);
  const expanded = expandedPaths.has(pathKey);
  const selected = selectedPaths.has(pathKey);
  // For wildcard child fields: check if all indexed siblings are selected or partially selected
  const isWildcardSelected = wildcardSelectedPaths.has(pathKey);
  const isWildcardIndeterminate = wildcardIndeterminatePaths.has(pathKey);
  const matchIndices = searchResultsMap.get(pathKey);
  const hasHighlight = matchIndices !== undefined && matchIndices !== null && matchIndices.length > 0;
  const isFocused = focusedPath === pathKey;
  const isHighlightedFromRT = highlightedFieldPathKey === pathKey;
  const nodeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to focused node (only for keyboard/search navigation, not mouse hover)
  useEffect(() => {
    if (isFocused && shouldAutoScroll && nodeRef.current) {
      nodeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [isFocused, shouldAutoScroll]);

  const handleExpandClick = useCallback(() => {
    onToggleExpand(node.fullPath);
  }, [node.fullPath, onToggleExpand]);

  const handleSelectChange = useCallback(() => {
    onToggleSelect(node.fullPath);
  }, [node.fullPath, onToggleSelect]);

  const handleMouseEnter = useCallback(() => {
    // Only update internal focus - onFieldFocus is handled via useEffect
    // This ensures debounce protection from setFocusedPath is respected
    onFocus?.(pathKey);
  }, [onFocus, pathKey]);

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
          isHighlightedFromRT || isFocused ? 'bg-focus' : ''
        }`}
        style={{ paddingLeft: `${node.level * 12 + 2}px` }}
        onMouseEnter={handleMouseEnter}
      >

        {/* Expand/Collapse button OR Checkbox (mutually exclusive) */}
        {/* Ignored fields: show empty spacer (no expand/checkbox) */}
        {/* Map wildcard (*) node: leaf-like, shows checkbox for selecting all siblings */}
        {isIgnored ? (
          <span className="w-4 mr-1.5 shrink-0" />
        ) : node.name === '*' && !hasChildren ? (
          <Checkbox
            checked={isWildcardIndeterminate ? 'indeterminate' : (selected || isWildcardSelected)}
            onCheckedChange={handleSelectChange}
            className="mr-1.5 h-3.5 w-3.5 shrink-0"
          />
        ) : hasChildren ? (
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
            checked={
              isDefaultColumn ? true :
              isWildcardIndeterminate ? 'indeterminate' :
              (selected || isWildcardSelected)
            }
            onCheckedChange={handleSelectChange}
            disabled={isDefaultColumn}
            className="mr-1.5 h-3.5 w-3.5 shrink-0"
            title={isDefaultColumn ? 'Default column (always visible)' : undefined}
          />
        ) : (
          <span className="w-4 mr-1.5 shrink-0" />
        )}

        {/* Field name and type - wrapped in HoverCard for ignored fields */}
        {isIgnored ? (
          <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
              <span className="flex items-center cursor-help">
                <span className="text-sm font-mono text-muted-foreground/50">
                  {node.name}
                </span>
                {node.type && (
                  <span className="text-xs text-muted-foreground/30 ml-2 font-mono">
                    {node.type}
                  </span>
                )}
              </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-72 text-sm" side="right">
              <p className="font-medium mb-1">Structure tracking disabled</p>
              <p className="text-muted-foreground text-xs">
                {ignoredReason}
              </p>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <>
            <span className="text-sm font-mono text-foreground">
              {hasHighlight && matchIndices ? (
                <HighlightedText text={node.name} indices={matchIndices} />
              ) : (
                node.name
              )}
            </span>
            {node.type && (
              <span className="text-xs text-primary/70 ml-2 font-mono">
                {node.type}
              </span>
            )}
          </>
        )}
      </div>

      {/* Children (if expanded and not ignored) */}
      {expanded && hasChildren && !isIgnored && (
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
              onFocus={onFocus}
              shouldAutoScroll={shouldAutoScroll}
              highlightedFieldPathKey={highlightedFieldPathKey}
              wildcardIndeterminatePaths={wildcardIndeterminatePaths}
              wildcardSelectedPaths={wildcardSelectedPaths}
              ignoredFields={ignoredFields}
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
  onReady,
  onFieldFocus,
  highlightedFieldPath,
}, ref) => {
  const {
    // State
    loading,
    flatNodesMap,

    // Search
    query,
    setQuery,
    searchVisible,
    toggleSearch,
    closeSearch,
    matchedPaths,
    searchResultsMap,
    currentMatchIndex,
    hasMoreResults,
    debouncedQuery,

    // Expansion
    expandedPaths,
    toggleExpand,

    // Selection
    selectedPaths,
    toggleSelect,
    clearAllSelections,
    setSelectionsFromPaths,
    wildcardIndeterminatePaths,
    wildcardSelectedPaths,

    // Keyboard navigation
    focusedPathKey,
    focusTrigger,
    setFocusedPath,
    navigateFocus,
    toggleFocused,

    // Filtered view
    filteredNodeTree,

    // Ignored fields (disabled in tree UI)
    ignoredFields,
  } = useTree({
    selectedGVK,
    connectedContexts,
    onFieldsSelected,
    onReady,
    watch: true,  // Enable real-time tree updates
  });

  const fieldSearchBarRef = useRef<FieldSearchBarHandle>(null);

  // Convert highlightedFieldPath to pathKey for comparison
  const highlightedFieldPathKey = useMemo(() => {
    return highlightedFieldPath?.join(PATH_DELIMITER);
  }, [highlightedFieldPath]);

  // Sync focus to parent's focusedFieldPath for preview (unified for keyboard & mouse)
  // This ensures debounce protection from setFocusedPath is respected for both triggers
  useEffect(() => {
    if (!onFieldFocus) return;

    if (!focusedPathKey) {
      onFieldFocus(null);
      return;
    }

    const node = flatNodesMap.get(focusedPathKey);
    if (!node) {
      onFieldFocus(null);
      return;
    }

    // Check if leaf node (same logic as TreeNodeItem)
    const hasChildren = node.children && node.children.length > 0;
    const isArrayOrMap = node.type && (node.type.startsWith('[]') || node.type.startsWith('map['));
    const isLeaf = !hasChildren && !isArrayOrMap;

    // For leaf nodes, notify for preview; for non-leaf, clear preview
    onFieldFocus(isLeaf ? node.fullPath : null);
  }, [focusedPathKey, flatNodesMap, onFieldFocus]);

  useImperativeHandle(ref, () => ({
    clearSelections: clearAllSelections,
    getSelectedCount: () => selectedPaths.size,
    getSelectedPaths: () => new Set(selectedPaths),
    setSelectedPaths: setSelectionsFromPaths,
    toggleSearch,
    navigateUp: () => navigateFocus('up'),
    navigateDown: () => navigateFocus('down'),
    toggleFocused,
    isSearchFocused: () => fieldSearchBarRef.current?.isInputFocused() ?? false,
  }), [clearAllSelections, selectedPaths, setSelectionsFromPaths, toggleSearch, navigateFocus, toggleFocused]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Search Bar (conditional) */}
      {/* TODO: Add slide-down/slide-up animation when showing/hiding */}
      {searchVisible && (
        <FieldSearchBar
          ref={fieldSearchBarRef}
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
                focusedPath={
                  // Priority: search match focus > keyboard focus
                  debouncedQuery && matchedPaths.length > 0
                    ? matchedPaths[currentMatchIndex]
                    : focusedPathKey ?? undefined
                }
                // Only enable mouse hover focus when not searching
                onFocus={!debouncedQuery ? setFocusedPath : undefined}
                // Auto-scroll only for keyboard navigation or search navigation
                shouldAutoScroll={
                  focusTrigger === 'keyboard' ||
                  (Boolean(debouncedQuery) && matchedPaths.length > 0)
                }
                highlightedFieldPathKey={highlightedFieldPathKey}
                wildcardIndeterminatePaths={wildcardIndeterminatePaths}
                wildcardSelectedPaths={wildcardSelectedPaths}
                ignoredFields={ignoredFields}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

NavigationPanel.displayName = 'NavigationPanel';
