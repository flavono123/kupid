import { useEffect, useState, useMemo, useRef } from "react";
import { main } from "../../wailsjs/go/models";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "./ui/command";
import { Badge } from "./ui/badge";
import { Kbd } from "./ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Check, X, Loader2 } from "lucide-react";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { HighlightedText } from "./HighlightedText";
import { K8sIcon } from "./K8sIcon";

interface ResourceSelectorProps {
  contexts: string[];
  resources: main.ResourceInfo[];
  loading: boolean;
  onClose: () => void;
}

export function ResourceSelector({ contexts, resources, loading, onClose }: ResourceSelectorProps) {
  console.log("ResourceSelector rendered with contexts:", contexts);
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  const contextsRef = useRef(contexts);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus search input when modal opens
  useEffect(() => {
    // Small delay to ensure modal is rendered
    const timeoutId = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F / Ctrl+F: Focus search input
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Cmd+K / Ctrl+K: Close modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
        return;
      }

      // Escape: Close modal
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Extract searchable text (group + kind) for fuzzy search
  const searchableTexts = useMemo(() => {
    return resources.map((r) => {
      // Combine group and kind for searching (e.g., "apps Deployment" or "Deployment" for core)
      return r.group ? `${r.group} ${r.kind}` : r.kind;
    });
  }, [resources]);

  const { query, setQuery, results } = useFuzzySearch(searchableTexts);

  // Reset scroll to top when query changes (including when cleared)
  useEffect(() => {
    if (listRef.current) {
      // Use setTimeout to ensure scroll happens after DOM update
      const timeoutId = setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = 0;
        }
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [query]);

  // Map fuzzy search results back to full resource info
  const filteredResources = useMemo(() => {
    if (query === "") {
      // No search query: sort by group -> kind
      return resources
        .slice()
        .sort((a, b) => {
          // Sort by group first (empty group comes first)
          const groupCompare = a.group.localeCompare(b.group);
          if (groupCompare !== 0) return groupCompare;
          // Then by kind
          return a.kind.localeCompare(b.kind);
        })
        .map((r, index) => ({
          resource: r,
          indices: null,
          originalIndex: index,
        }));
    }

    // With search query: use fuzzy search results
    return results
      .map((result) => {
        const resourceIndex = searchableTexts.indexOf(result.item);
        if (resourceIndex === -1) {
          return null;
        }
        return {
          resource: resources[resourceIndex],
          indices: result.indices,
          originalIndex: resourceIndex,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [resources, results, query, searchableTexts]);

  const handleSelect = (resource: main.ResourceInfo) => {
    console.log("Selected resource:", resource);
    // TODO: Navigate to resource view
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative w-full max-w-2xl p-8">
        {/*
          NOTE: `loop` prop removed due to buggy behavior with scroll position.
          When enabled, causes unexpected upward scrolling (set 0 jumps incorrectly).
          TODO: Re-enable once cmdk fixes the loop + scroll interaction bug.
        */}
        <Command className="rounded-lg border shadow-lg" shouldFilter={false}>
          <CommandInput
            ref={searchInputRef}
            placeholder="Search resources..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList ref={listRef} className="max-h-96">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading resources from {contextsRef.current.length} context
                  {contextsRef.current.length > 1 ? "s" : ""}...
                </p>
              </div>
            ) : (
              <>
                <CommandEmpty>No resources found.</CommandEmpty>
                {filteredResources.map(({ resource, indices }, index) => {
                  const isCore = resource.group === "";
                  const availableCount = resource.contexts?.length || 0;
                  const totalCount = resource.allCount;

                  // Calculate indices for group and kind separately
                  // indices is in range format: [number, number][]
                  let groupIndices: readonly [number, number][] = [];
                  let kindIndices: readonly [number, number][] = [];

                  if (indices && indices.length > 0) {
                    if (resource.group) {
                      // searchableText is "group kind" format (e.g., "apps Deployment")
                      const groupLength = resource.group.length;
                      const kindStart = groupLength + 1; // +1 for space

                      // Process each range
                      const groupRanges: [number, number][] = [];
                      const kindRanges: [number, number][] = [];

                      indices.forEach(([start, end]) => {
                        // Check if range overlaps with group (0 to groupLength-1)
                        if (end < groupLength) {
                          groupRanges.push([start, end]);
                        }
                        // Check if range overlaps with kind (kindStart onwards)
                        else if (start >= kindStart) {
                          // Adjust to be relative to kind start
                          kindRanges.push([start - kindStart, end - kindStart]);
                        }
                        // Range spans across group and kind (rare but possible)
                        else {
                          if (start < groupLength) {
                            groupRanges.push([start, groupLength - 1]);
                          }
                          if (end >= kindStart) {
                            kindRanges.push([0, end - kindStart]);
                          }
                        }
                      });

                      groupIndices = groupRanges;
                      kindIndices = kindRanges;
                    } else {
                      // Core resources: searchableText is just "kind"
                      kindIndices = indices;
                    }
                  }

                  return (
                    <CommandItem
                      key={`${resource.group}-${resource.version}-${resource.kind}-${index}`}
                      value={resource.kind}
                      onSelect={() => handleSelect(resource)}
                      className="flex items-center justify-between py-3"
                    >
                      {/* Left side: Kind name and Group badge */}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold ml-2">
                          {kindIndices.length > 0 ? (
                            <HighlightedText
                              text={resource.kind}
                              indices={kindIndices}
                            />
                          ) : (
                            resource.kind
                          )}
                        </span>

                        {/* Group badge (only for non-core) - positioned next to kind name */}
                        {!isCore && (
                          <Badge
                            variant="secondary"
                            className="text-muted-foreground"
                          >
                            {groupIndices.length > 0 ? (
                              <HighlightedText
                                text={resource.group}
                                indices={groupIndices}
                              />
                            ) : (
                              resource.group
                            )}
                          </Badge>
                        )}
                      </div>

                      {/* Right side: Context availability badge */}
                      <Popover
                        open={openPopoverIndex === index}
                        onOpenChange={(open) => {
                          setOpenPopoverIndex(open ? index : null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className="flex items-center gap-2 px-2 py-1 rounded-md bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                            onMouseEnter={() => setOpenPopoverIndex(index)}
                            onMouseLeave={() => setOpenPopoverIndex(null)}
                          >
                            <K8sIcon className="w-10 h-10" />
                            <span className="text-xs font-semibold text-blue-700">
                              {availableCount}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto max-w-md p-3"
                          align="end"
                          side="top"
                          sideOffset={8}
                          onMouseEnter={() => setOpenPopoverIndex(index)}
                          onMouseLeave={() => setOpenPopoverIndex(null)}
                        >
                          <div className="space-y-1 text-xs">
                            {contextsRef.current
                              .slice()
                              .sort((a, b) => {
                                const aAvailable = resource.contexts?.includes(a) ? 1 : 0;
                                const bAvailable = resource.contexts?.includes(b) ? 1 : 0;
                                // Sort by availability (checked first), then alphabetically
                                if (aAvailable !== bAvailable) {
                                  return bAvailable - aAvailable;
                                }
                                return a.localeCompare(b);
                              })
                              .map((ctx) => {
                                const isAvailable = resource.contexts?.includes(ctx);
                                return (
                                  <div
                                    key={ctx}
                                    className={`flex items-center gap-2 ${
                                      isAvailable ? "" : "text-muted-foreground"
                                    }`}
                                  >
                                    {isAvailable ? (
                                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <X className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <span className="break-all">{ctx}</span>
                                  </div>
                                );
                              })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </CommandItem>
                  );
                })}
              </>
            )}
          </CommandList>

          {/* Footer */}
          <div className="border-t px-4 py-3 flex gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
              <span>or</span>
              <Kbd>Esc</Kbd>
              <span>Close</span>
            </div>
            <div className="flex items-center gap-2">
              <Kbd>⌘</Kbd>
              <Kbd>F</Kbd>
              <span>Search</span>
            </div>
            <div className="flex items-center gap-2">
              <Kbd>↑↓</Kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-2">
              <Kbd>Enter</Kbd>
              <span>Select</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
