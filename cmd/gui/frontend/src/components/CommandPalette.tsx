import { useEffect, useState, useRef } from "react";
import { main } from "../../wailsjs/go/models";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from "./ui/command";
import { Badge } from "./ui/badge";
import { Kbd } from "./ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Spinner } from "./ui/spinner";
import { Check, X, Star, Sun, Moon } from "lucide-react";
import { useCommandSearch } from "@/hooks/useCommandSearch";
import { HighlightedText } from "./HighlightedText";
import { K8sIcon } from "./K8sIcon";

interface CommandPaletteProps {
  contexts: string[];
  gvks: main.MultiClusterGVK[];
  favorites: main.FavoriteViewResponse[];
  loading: boolean;
  theme: string | undefined;
  onClose: () => void;
  onGVKSelect: (gvk: main.MultiClusterGVK) => void;
  onFavoriteSelect: (favorite: main.FavoriteViewResponse) => void;
  onThemeToggle: (event: React.MouseEvent | React.KeyboardEvent) => void;
}

export function CommandPalette({ contexts, gvks, favorites, loading, theme, onClose, onGVKSelect, onFavoriteSelect, onThemeToggle }: CommandPaletteProps) {
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [disablePointer, setDisablePointer] = useState(true);
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

  const { query, setQuery, filteredFavorites, filteredGVKs } = useCommandSearch(favorites, gvks);

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

  // Reset selected value to first item when query changes
  // This ensures keyboard input always focuses the top result, ignoring mouse position
  useEffect(() => {
    // Set to first available item (favorites first, then GVKs)
    if (filteredFavorites.length > 0) {
      setSelectedValue(`fav-${filteredFavorites[0].favorite.id}`);
    } else if (filteredGVKs.length > 0) {
      setSelectedValue(filteredGVKs[0].gvk.kind);
    } else {
      setSelectedValue("");
    }

    // Disable pointer events briefly to prevent mouse hover from affecting focus
    setDisablePointer(true);
    const timeoutId = setTimeout(() => {
      setDisablePointer(false);
    }, 100);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSelect = (gvk: main.MultiClusterGVK) => {
    onGVKSelect(gvk);
  };

  const handleFavoriteSelect = (favorite: main.FavoriteViewResponse) => {
    onFavoriteSelect(favorite);
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
        <Command
          className="rounded-lg border shadow-lg"
          shouldFilter={false}
          value={selectedValue}
          onValueChange={setSelectedValue}
        >
          <CommandInput
            ref={searchInputRef}
            placeholder="Search ..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList
            ref={listRef}
            className={`max-h-96 ${disablePointer ? "pointer-events-none" : ""}`}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Spinner className="w-8 h-8 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading GVKs from {contextsRef.current.length} context
                  {contextsRef.current.length > 1 ? "s" : ""}...
                </p>
              </div>
            ) : (
              <>
                <CommandEmpty>No results found.</CommandEmpty>

                {/* FAVORITES Group */}
                {filteredFavorites.length > 0 && (
                  <CommandGroup heading="FAVORITES">
                    {filteredFavorites.map(({ favorite, indices }) => {
                      // Calculate highlight indices for name (indices are for "name group kind" format)
                      const nameLength = favorite.name.length;
                      const nameIndices: [number, number][] = [];

                      if (indices) {
                        indices.forEach(([start, end]) => {
                          if (start < nameLength) {
                            nameIndices.push([start, Math.min(end, nameLength - 1)]);
                          }
                        });
                      }

                      const gvkLabel = favorite.gvk.group
                        ? `${favorite.gvk.kind} (${favorite.gvk.group}/${favorite.gvk.version})`
                        : `${favorite.gvk.kind} (${favorite.gvk.version})`;

                      return (
                        <CommandItem
                          key={`fav-${favorite.id}`}
                          value={`fav-${favorite.id}`}
                          onSelect={() => handleFavoriteSelect(favorite)}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Star className="h-3.5 w-3.5 text-accent fill-current ml-2" />
                            <span>
                              {nameIndices.length > 0 ? (
                                <HighlightedText text={favorite.name} indices={nameIndices} />
                              ) : (
                                favorite.name
                              )}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {gvkLabel} &middot; {favorite.fields.length} fields
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {/* SETTINGS Group - always visible when not searching */}
                {!query && (
                  <CommandGroup heading="SETTINGS">
                    <CommandItem
                      value="theme-toggle"
                      onSelect={() => {
                        // onSelect doesn't provide event - find the item element and use its center
                        const item = document.querySelector('[data-value="theme-toggle"]');
                        if (item) {
                          const rect = item.getBoundingClientRect();
                          const syntheticEvent = {
                            clientX: rect.left + rect.width / 2,
                            clientY: rect.top + rect.height / 2,
                          } as React.MouseEvent;
                          onThemeToggle(syntheticEvent);
                        } else {
                          const syntheticEvent = {
                            clientX: window.innerWidth / 2,
                            clientY: window.innerHeight / 2,
                          } as React.MouseEvent;
                          onThemeToggle(syntheticEvent);
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onThemeToggle(e);
                      }}
                      className="flex items-center gap-2 py-2"
                    >
                      {theme === "dark" ? (
                        <Sun className="h-4 w-4 ml-2" />
                      ) : (
                        <Moon className="h-4 w-4 ml-2" />
                      )}
                      <span>
                        {theme === "dark" ? "Light Mode" : "Dark Mode"}
                      </span>
                    </CommandItem>
                  </CommandGroup>
                )}

                {/* RESOURCES Group */}
                {filteredGVKs.length > 0 && (
                  <CommandGroup heading="RESOURCES">
                {filteredGVKs.map(({ gvk, indices }, index) => {
                  const isCore = gvk.group === "";
                  const availableCount = gvk.contexts?.length || 0;

                  // Calculate indices for group and kind separately
                  // indices is in range format: [number, number][]
                  let groupIndices: readonly [number, number][] = [];
                  let kindIndices: readonly [number, number][] = [];

                  if (indices && indices.length > 0) {
                    if (gvk.group) {
                      // searchableText is "group kind" format (e.g., "apps Deployment")
                      const groupLength = gvk.group.length;
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
                      key={`${gvk.group}-${gvk.version}-${gvk.kind}-${index}`}
                      value={gvk.kind}
                      onSelect={() => handleSelect(gvk)}
                      className="flex items-center justify-between py-2"
                    >
                      {/* Left side: Kind name and Group badge */}
                      <div className="flex items-center gap-2">
                        <span className="ml-2">
                          {kindIndices.length > 0 ? (
                            <HighlightedText
                              text={gvk.kind}
                              indices={kindIndices}
                            />
                          ) : (
                            gvk.kind
                          )}
                        </span>

                        {/* Group/Version badge - positioned next to kind name */}
                        <Badge
                          variant="secondary"
                          className="text-muted-foreground"
                        >
                          {isCore ? (
                            gvk.version
                          ) : groupIndices.length > 0 ? (
                            <>
                              <HighlightedText
                                text={gvk.group}
                                indices={groupIndices}
                              />
                              /{gvk.version}
                            </>
                          ) : (
                            `${gvk.group}/${gvk.version}`
                          )}
                        </Badge>
                      </div>

                      {/* Right side: Context availability badge */}
                      {contexts.length > 1 && (
                        <Popover
                          open={openPopoverIndex === index}
                          onOpenChange={(open) => {
                            setOpenPopoverIndex(open ? index : null);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <div
                              className="flex items-center gap-1 px-1 py-0.5 rounded-md bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors"
                              onMouseEnter={() => setOpenPopoverIndex(index)}
                              onMouseLeave={() => setOpenPopoverIndex(null)}
                            >
                              <K8sIcon className="w-9 h-9" />
                              <span className="text-xs text-accent-foreground">
                                {availableCount}
                              </span>
                            </div>
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
                                  const aAvailable = gvk.contexts?.includes(a) ? 1 : 0;
                                  const bAvailable = gvk.contexts?.includes(b) ? 1 : 0;
                                  // Sort by availability (checked first), then alphabetically
                                  if (aAvailable !== bAvailable) {
                                    return bAvailable - aAvailable;
                                  }
                                  return a.localeCompare(b);
                                })
                                .map((ctx) => {
                                  const isAvailable = gvk.contexts?.includes(ctx);
                                  return (
                                    <div
                                      key={ctx}
                                      className={`flex items-center gap-2 ${isAvailable ? "" : "text-muted-foreground"
                                        }`}
                                    >
                                      {isAvailable ? (
                                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
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
                      )}
                    </CommandItem>
                  );
                })}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>

          {/* Footer */}
          <div className="border-t px-4 py-2 flex gap-6 text-xs text-muted-foreground">
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
