import { useState, useEffect, useRef, useCallback } from "react";
import { CommandPalette } from "./CommandPalette";
import { NavigationPanel, NavigationPanelHandle } from "./NavigationPanel";
import { ResultTable } from "./ResultTable";
import { NavHeader } from "./NavHeader";
import { Button } from "./ui/button";
import { Kbd } from "./ui/kbd";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { PanelLeft } from "lucide-react";
import { GetGVKs } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";
import { ImperativePanelHandle } from "react-resizable-panels";

interface MainViewProps {
  selectedContexts: string[];
  connectedContexts: string[];
  onBackToContexts: () => void;
}

export function MainView({ selectedContexts, connectedContexts, onBackToContexts }: MainViewProps) {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [gvks, setGVKs] = useState<main.MultiClusterGVK[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGVK, setSelectedGVK] = useState<main.MultiClusterGVK | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[][]>([]);
  const loadedRef = useRef(false);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const navigationPanelRef = useRef<NavigationPanelHandle>(null);
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

  const handleClearAllFields = useCallback(() => {
    navigationPanelRef.current?.clearSelections();
  }, []);

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
            {/* Nav Header */}
            <NavHeader
              selectedContexts={selectedContexts}
              connectedContexts={connectedContexts}
              selectedGVK={selectedGVK}
              selectedFieldCount={selectedFields.length}
              onCollapse={toggleSidebar}
              onBackToContexts={onBackToContexts}
              onClearAllFields={handleClearAllFields}
            />

            {/* Navigation Content */}
            <div className="flex-1 overflow-auto">
              {selectedGVK ? (
                <NavigationPanel
                  ref={navigationPanelRef}
                  selectedGVK={selectedGVK}
                  connectedContexts={connectedContexts}
                  onFieldsSelected={(fields) => {
                    console.log("Selected fields:", fields);
                    setSelectedFields(fields);
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center px-4">
                  <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                    Press <Kbd>⌘</Kbd><Kbd>K</Kbd> to select a resource
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
                <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                  Press <Kbd>⌘</Kbd><Kbd>K</Kbd> to select a resource
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
