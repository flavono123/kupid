import { useState, useEffect, useRef, useCallback } from "react";
import { ListContexts, RefreshContexts, ConnectToContexts } from "../../wailsjs/go/main/App";
import { K8sIcon } from "./K8sIcon";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Search, X, Loader2, RefreshCw } from "lucide-react";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { HighlightedText } from "./HighlightedText";
import { Kbd } from "./ui/kbd";
import { ResourceSelector } from "./ResourceSelector";
import { toast } from "sonner";

export function ContextGallery() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContexts, setSelectedContexts] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedContexts, setConnectedContexts] = useState<string[]>([]);
  const [showResourceSelector, setShowResourceSelector] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    // Load contexts on mount
    ListContexts().then(setContexts);
  }, []);

  // Fuzzy search hook with fuzzysort
  const { query: searchQuery, setQuery: setSearchQuery, results } = useFuzzySearch(contexts);

  // Results are already processed by useFuzzySearch
  const filteredContexts = results;

  const handleCardClick = useCallback((context: string) => {
    setSelectedContexts((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(context)) {
        newSelected.delete(context);
      } else {
        newSelected.add(context);
      }
      return newSelected;
    });
  }, []);

  const handleConnect = useCallback(async () => {
    console.log("handleConnect called, selectedContexts:", selectedContexts);
    if (selectedContexts.size === 0) {
      console.log("No contexts selected");
      return;
    }

    setIsConnecting(true);
    const contextsArray = Array.from(selectedContexts);

    try {
      const results = await ConnectToContexts(contextsArray);

      // Filter successful connections
      const successful = results
        .filter((r) => r.success)
        .map((r) => r.context);

      const failed = results.filter((r) => !r.success);

      // Show toast notifications
      if (successful.length > 0) {
        toast.success(`Connected to ${successful.length} context${successful.length > 1 ? 's' : ''}`, {
          description: successful.join(', '),
        });
      }

      if (failed.length > 0) {
        failed.forEach((f) => {
          toast.error(`Failed to connect to ${f.context}`, {
            description: f.error,
          });
        });
      }

      // If at least one context connected successfully, show resource selector
      if (successful.length > 0) {
        setConnectedContexts(successful);
        setShowResourceSelector(true);
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Connection failed", {
        description: String(error),
      });
    } finally {
      setIsConnecting(false);
    }
  }, [selectedContexts]);

  const handleBackToGallery = useCallback(() => {
    setShowResourceSelector(false);
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedContexts(new Set());
  }, []);

  const handleRefresh = useCallback(async () => {
    const newContexts = await RefreshContexts();
    setContexts(newContexts);
    toast.success("Contexts refreshed");
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+R / Ctrl+R: Refresh contexts
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        handleRefresh();
        return;
      }

      // Cmd+F / Ctrl+F: Focus search input
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Tab: Toggle focus between search and contexts
      if (e.key === 'Tab') {
        e.preventDefault();
        if (isSearchFocused) {
          // Focus first context
          searchInputRef.current?.blur();
          if (filteredContexts.length > 0) {
            setFocusedIndex(0);
          }
        } else {
          // Focus search
          setFocusedIndex(null);
          searchInputRef.current?.focus();
        }
        return;
      }

      // Esc: Clear all selections
      if (e.key === 'Escape') {
        if (selectedContexts.size > 0) {
          handleClearAll();
        }
        return;
      }

      // Don't handle other keys if search input is focused
      if (isSearchFocused) {
        return;
      }

      // Arrow keys: Navigate grid
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();

        if (filteredContexts.length === 0) return;

        let newIndex: number;

        if (focusedIndex === null) {
          // Start at first item
          newIndex = 0;
        } else {
          const cols = 3;

          switch (e.key) {
            case 'ArrowUp':
              newIndex = focusedIndex - cols;
              if (newIndex < 0) newIndex = focusedIndex; // Stay at current position
              break;
            case 'ArrowDown':
              newIndex = focusedIndex + cols;
              if (newIndex >= filteredContexts.length) newIndex = focusedIndex; // Stay at current position
              break;
            case 'ArrowLeft':
              newIndex = focusedIndex - 1;
              if (newIndex < 0) newIndex = 0;
              break;
            case 'ArrowRight':
              newIndex = focusedIndex + 1;
              if (newIndex >= filteredContexts.length) newIndex = filteredContexts.length - 1;
              break;
            default:
              newIndex = focusedIndex;
          }
        }

        setFocusedIndex(newIndex);
        return;
      }

      // Space: Toggle selection of focused item
      if (e.key === ' ' && focusedIndex !== null) {
        e.preventDefault();
        const focusedContext = filteredContexts[focusedIndex];
        if (focusedContext) {
          handleCardClick(focusedContext.item);
        }
        return;
      }

      // Enter: Connect to selected contexts
      if (e.key === 'Enter' && selectedContexts.size > 0) {
        e.preventDefault();
        handleConnect();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, filteredContexts, selectedContexts, isSearchFocused, handleCardClick, handleConnect, handleClearAll, handleRefresh]);

  // Reset focused index when filtered contexts change
  useEffect(() => {
    if (focusedIndex !== null && focusedIndex >= filteredContexts.length) {
      setFocusedIndex(filteredContexts.length > 0 ? 0 : null);
    }
  }, [filteredContexts, focusedIndex]);

  // Scroll focused card into view
  useEffect(() => {
    if (focusedIndex !== null) {
      const card = cardRefs.current.get(focusedIndex);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  // Show resource selector if user clicked Connect
  if (showResourceSelector) {
    console.log("Rendering ResourceSelector with contexts:", connectedContexts);
    return (
      <ResourceSelector
        contexts={connectedContexts}
        onBack={handleBackToGallery}
      />
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full px-8">
        {/* Top Spacer - 1/3 */}
        <div className="flex-1 flex flex-col justify-end pb-8">
          {/* Fixed Header */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-3 mb-6">
              {/* Kupid Logo Placeholder */}
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
                  <path
                    d="M12 2L21 7v10l-9 5-9-5V7l9-5z"
                    fill="white"
                    fillOpacity="0.9"
                  />
                  <circle cx="12" cy="12" r="2.5" fill="hsl(var(--primary))" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    Contexts{" "}
                    <span className="text-muted-foreground">
                      ({selectedContexts.size > 0 ? `${selectedContexts.size}/` : ""}{filteredContexts.length})
                    </span>
                  </h1>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select one or more contexts to get started
                </p>
              </div>
            </div>
          </div>

          {/* Fixed Search Bar */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search contexts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="pl-9"
                />
              </div>
              {selectedContexts.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Middle Content - 1/3 */}
        <div className="flex-1 overflow-y-auto py-8">
          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            {filteredContexts.map(({ item, indices }, index) => {
              const isSelected = selectedContexts.has(item);
              const isFocused = focusedIndex === index;

              return (
                <div
                  key={item}
                  ref={(el) => {
                    if (el) {
                      cardRefs.current.set(index, el);
                    } else {
                      cardRefs.current.delete(index);
                    }
                  }}
                >
                  <Card
                    onClick={() => handleCardClick(item)}
                    className={`
                      p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5
                      border-l-4
                      ${isSelected
                        ? "border-l-green-500 bg-accent"
                        : "border-l-transparent"
                      }
                      ${isFocused
                        ? "ring-2 ring-ring ring-offset-2"
                        : ""
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <K8sIcon className="w-10 h-10 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">
                          <HighlightedText text={item} indices={indices} />
                        </h3>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Spacer - 1/3 */}
        <div className="flex-1 flex flex-col justify-between pt-8">
          <div className="flex-shrink-0 flex justify-center border-t pt-6">
            <Button
              onClick={handleConnect}
              disabled={selectedContexts.size === 0 || isConnecting}
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect →"
              )}
            </Button>
          </div>

          {/* Keyboard shortcuts guide */}
          <div className="flex-shrink-0 pb-4 flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>R</Kbd>
              <span>Refresh</span>
            </div>
            <div className="flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>F</Kbd>
              <span>Search</span>
            </div>

            {isSearchFocused ? (
              // Search focused shortcuts
              <>
                <div className="flex items-center gap-1">
                  <Kbd>Tab</Kbd>
                  <span>Focus contexts</span>
                </div>
              </>
            ) : (
              // Context focused shortcuts
              <>
                <div className="flex items-center gap-1">
                  <Kbd>Tab</Kbd>
                  <span>Focus search</span>
                </div>
                <div className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <Kbd>←</Kbd>
                  <Kbd>→</Kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <Kbd>Space</Kbd>
                  <span>Select</span>
                </div>
              </>
            )}

            {/* Common shortcuts */}
            {selectedContexts.size > 0 && (
              <div className="flex items-center gap-1">
                <Kbd>Enter</Kbd>
                <span>Connect</span>
              </div>
            )}

            {selectedContexts.size > 0 && (
              <div className="flex items-center gap-1">
                <Kbd>Esc</Kbd>
                <span>Clear</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
