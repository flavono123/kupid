import { useState, useEffect } from "react";
import { ListContexts, GetCurrentContext } from "../../wailsjs/go/main/App";
import { K8sIcon } from "./K8sIcon";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Search, Grid3X3 } from "lucide-react";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { HighlightedText } from "./HighlightedText";

export function ContextGallery() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContexts, setSelectedContexts] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load contexts on mount
    ListContexts().then(setContexts);
  }, []);

  // Fuzzy search hook with fuzzysort
  const { query: searchQuery, setQuery: setSearchQuery, results } = useFuzzySearch(contexts);

  // Results are already processed by useFuzzySearch
  const filteredContexts = results;

  const handleCardClick = (context: string) => {
    const newSelected = new Set(selectedContexts);
    if (newSelected.has(context)) {
      newSelected.delete(context);
    } else {
      newSelected.add(context);
    }
    setSelectedContexts(newSelected);
  };

  const handleConnect = () => {
    if (selectedContexts.size > 0) {
      console.log("Connecting to:", Array.from(selectedContexts));
      // TODO: Navigate to main view
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full px-8">
        {/* Fixed Header */}
        <div className="flex-shrink-0 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
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
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Contexts{" "}
                <span className="text-muted-foreground">
                  ({selectedContexts.size > 0 ? `${selectedContexts.size}/` : ""}{filteredContexts.length})
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Select one or more contexts to get started
              </p>
            </div>
          </div>
        </div>

        {/* Fixed Search Bar */}
        <div className="flex-shrink-0 pb-6">
          <div className="flex justify-between items-center">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search contexts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <button className="p-2 rounded hover:bg-accent">
                <Grid3X3 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Context Cards Grid */}
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContexts.map(({ item, indices }) => {
              const isSelected = selectedContexts.has(item);

              return (
                <Card
                  key={item}
                  onClick={() => handleCardClick(item)}
                  className={`
                    p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5
                    border-l-4
                    ${isSelected
                      ? "border-l-green-500 bg-accent"
                      : "border-l-transparent"
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
              );
            })}
          </div>
        </div>

        {/* Fixed Connect Button */}
        <div className="flex-shrink-0 py-6 flex justify-center border-t">
          <Button
            onClick={handleConnect}
            disabled={selectedContexts.size === 0}
            size="lg"
          >
            Connect →
          </Button>
        </div>
      </div>
    </div>
  );
}
