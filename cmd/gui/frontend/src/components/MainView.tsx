import { useState, useEffect, useRef } from "react";
import { Card } from "./ui/card";
import { CommandPalette } from "./CommandPalette";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Plug, Unplug } from "lucide-react";
import { GetGVKs } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";

interface MainViewProps {
  selectedContexts: string[];
  connectedContexts: string[];
}

export function MainView({ selectedContexts, connectedContexts }: MainViewProps) {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [gvks, setGVKs] = useState<main.MultiClusterGVK[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  // Load GVKs once when MainView mounts
  useEffect(() => {
    // Prevent multiple loads
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadGVKs = async () => {
      console.log("MainView: Loading GVKs for contexts:", connectedContexts);
      setLoading(true);
      try {
        const gvkList = await GetGVKs(connectedContexts);
        console.log("MainView: Loaded GVKs:", gvkList.length, "items");
        setGVKs(gvkList);
      } catch (error) {
        console.error("MainView: Failed to load GVKs:", error);
      } finally {
        setLoading(false);
        console.log("MainView: Loading complete");
      }
    };

    loadGVKs();
  }, [connectedContexts]);

  useEffect(() => {
    // cmd+k to toggle CommandPalette
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Connected Contexts Header */}
      <div className="border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedContexts.length === 1 ? (
              // Single context: show icon + name only, no popover
              <div className="flex items-center gap-2 px-3 py-2">
                <Plug className="w-4 h-4 text-green-500 flex-shrink-0" />
                <h2 className="text-sm text-foreground">
                  {connectedContexts[0]}
                </h2>
              </div>
            ) : (
              // Multiple contexts: show popover with count
              <Popover>
                <PopoverTrigger asChild>
                  <div className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 px-3 py-2 rounded-md transition-colors">
                    <Plug className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div>
                      <h2 className="text-sm text-foreground">
                        Contexts ({
                          connectedContexts.length === selectedContexts.length
                            ? selectedContexts.length  // All succeeded: "3"
                            : `${connectedContexts.length}/${selectedContexts.length}`  // Some failed: "2/3"
                        })
                      </h2>
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto max-w-md p-3" align="start">
                  <div className="space-y-1 text-xs">
                    {selectedContexts
                      .slice()
                      .sort((a, b) => {
                        const aConnected = connectedContexts.includes(a) ? 1 : 0;
                        const bConnected = connectedContexts.includes(b) ? 1 : 0;
                        // Sort by connection status (connected first), then alphabetically
                        if (aConnected !== bConnected) {
                          return bConnected - aConnected;
                        }
                        return a.localeCompare(b);
                      })
                      .map((ctx) => {
                        const isConnected = connectedContexts.includes(ctx);
                        return (
                          <div
                            key={ctx}
                            className={`flex items-center gap-2 ${
                              isConnected ? "" : "text-muted-foreground"
                            }`}
                          >
                            {isConnected ? (
                              <Plug className="w-4 h-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <Unplug className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="break-all">{ctx}</span>
                          </div>
                        );
                      })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Placeholder */}
        <div className="flex-1 border-r border-border p-8 overflow-auto">
          <Card className="h-full flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <h3 className="text-lg text-foreground mb-2">
                Left Panel
              </h3>
              <p className="text-sm text-muted-foreground">
                Resource tree or navigation will go here
              </p>
            </div>
          </Card>
        </div>

        {/* Right Panel - Placeholder */}
        <div className="flex-1 p-8 overflow-auto">
          <Card className="h-full flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <h3 className="text-lg text-foreground mb-2">
                Right Panel
              </h3>
              <p className="text-sm text-muted-foreground">
                Resource details or editor will go here
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* CommandPalette Modal */}
      {showCommandPalette && (
        <CommandPalette
          contexts={connectedContexts}
          gvks={gvks}
          loading={loading}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
    </div>
  );
}
