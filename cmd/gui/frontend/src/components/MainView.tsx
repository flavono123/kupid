import { useState, useEffect, useRef } from "react";
import { CommandPalette } from "./CommandPalette";
import { NavigationPanel } from "./NavigationPanel";
import { ResultTable } from "./ResultTable";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { PlugZap, Unplug, PanelLeftClose, PanelLeft } from "lucide-react";
import { GetGVKs } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";
import { ImperativePanelHandle } from "react-resizable-panels";

interface MainViewProps {
  selectedContexts: string[];
  connectedContexts: string[];
}

export function MainView({ selectedContexts, connectedContexts }: MainViewProps) {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [gvks, setGVKs] = useState<main.MultiClusterGVK[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGVK, setSelectedGVK] = useState<main.MultiClusterGVK | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[][]>([]);
  const loadedRef = useRef(false);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

  // Reset selectedFields when GVK changes
  useEffect(() => {
    setSelectedFields([]);
  }, [selectedGVK]);

  const toggleSidebar = () => {
    const panel = sidebarPanelRef.current;
    if (panel) {
      if (isSidebarCollapsed) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

  return (
    <div className="h-screen bg-background">
      <ResizablePanelGroup direction="horizontal">
        {/* Left Sidebar Navigation */}
        <ResizablePanel
          ref={sidebarPanelRef}
          defaultSize={20}
          minSize={15}
          maxSize={40}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsSidebarCollapsed(true)}
          onExpand={() => setIsSidebarCollapsed(false)}
        >
          <div className="flex flex-col h-full">
            {/* Context Header */}
            <div className="p-4 border-b border-border relative">
              {/* Collapse Button - positioned absolutely at top-right */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="absolute top-4 right-4"
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>

              <div className="pr-10 overflow-hidden">
                {selectedContexts.length === 1 ? (
                  // Single context: show icon + name only, no popover
                  <div className="flex flex-col gap-2 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <PlugZap className="w-4 h-4 text-primary flex-shrink-0" />
                      <h2 className="text-sm text-foreground overflow-hidden whitespace-nowrap">
                        {connectedContexts[0]}
                      </h2>
                    </div>
                    {selectedGVK ? (
                      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                        <h3 className="text-sm font-medium text-foreground whitespace-nowrap">
                          {selectedGVK.kind}
                        </h3>
                        {selectedGVK.group && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {selectedGVK.group}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic truncate">
                        Select a resource
                      </div>
                    )}
                  </div>
                ) : (
                  // Multiple contexts: show popover with count
                  <div className="flex flex-col gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 px-3 py-2 rounded-md transition-colors min-w-0">
                          <PlugZap className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="overflow-hidden">
                            <h2 className="text-sm text-foreground whitespace-nowrap">
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
                                    <PlugZap className="w-4 h-4 text-primary flex-shrink-0" />
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
                    {selectedGVK ? (
                      <div className="flex items-center gap-2 px-3 min-w-0 overflow-hidden">
                        <h3 className="text-sm font-medium text-foreground whitespace-nowrap">
                          {selectedGVK.kind}
                        </h3>
                        {selectedGVK.group && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {selectedGVK.group}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic px-3 truncate">
                        Select a resource
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Content */}
            <div className="flex-1 overflow-auto">
              {selectedGVK ? (
                <NavigationPanel
                  selectedGVK={selectedGVK}
                  connectedContexts={connectedContexts}
                  onFieldsSelected={(fields) => {
                    console.log("Selected fields:", fields);
                    setSelectedFields(fields);
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center px-4">
                  <p className="text-sm text-muted-foreground truncate">
                    Press <kbd className="px-2 py-1 text-xs rounded border bg-muted">⌘K</kbd> to select a resource
                  </p>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right Panel - Main Content */}
        <ResizablePanel defaultSize={80}>
          <div className="h-full relative">
            {/* Floating Expand Button (only when collapsed) */}
            {isSidebarCollapsed && (
              <Button
                variant="outline"
                size="icon"
                onClick={toggleSidebar}
                className="absolute top-4 left-4 z-10 shadow-md"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            )}

            {/* Table or Empty State */}
            {selectedGVK ? (
              <ResultTable
                selectedFields={selectedFields}
                selectedGVK={selectedGVK}
                connectedContexts={connectedContexts}
              />
            ) : (
              <div className="h-full flex items-center justify-center px-4">
                <p className="text-sm text-muted-foreground truncate">
                  Press <kbd className="px-2 py-1 text-xs rounded border bg-muted">⌘K</kbd> to select a resource
                </p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* CommandPalette Modal */}
      {showCommandPalette && (
        <CommandPalette
          contexts={connectedContexts}
          gvks={gvks}
          loading={loading}
          onClose={() => setShowCommandPalette(false)}
          onGVKSelect={(gvk) => {
            setSelectedGVK(gvk);
            setShowCommandPalette(false);
          }}
        />
      )}
    </div>
  );
}
