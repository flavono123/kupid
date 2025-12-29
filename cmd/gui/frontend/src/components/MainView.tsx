import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CommandPalette } from "./CommandPalette";
import { NavigationPanel, NavigationPanelHandle } from "./NavigationPanel";
import { ResultTable } from "./ResultTable";
import { NavHeader } from "./NavHeader";
import { QuickAccessBar } from "./QuickAccessBar";
import { Button } from "./ui/button";
import { Kbd } from "./ui/kbd";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { PanelLeft } from "lucide-react";
import { GetGVKs } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";
import { ImperativePanelHandle } from "react-resizable-panels";
import { useFavoriteViews } from "@/hooks/useFavoriteViews";
import { useTheme } from "next-themes";
import { toggleThemeWithAnimation } from "@/lib/theme-animation";

interface MainViewProps {
  selectedContexts: string[];
  connectedContexts: string[];
  onBackToContexts: () => void;
}

// Path delimiter must match NavigationPanel's delimiter
const PATH_DELIMITER = '\x00';

export function MainView({ selectedContexts, connectedContexts, onBackToContexts }: MainViewProps) {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [gvks, setGVKs] = useState<main.MultiClusterGVK[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGVK, setSelectedGVK] = useState<main.MultiClusterGVK | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[][]>([]);
  // Pending favorite ID to apply after GVK switch (use ref to avoid stale closure)
  const pendingFavoriteIdRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const navigationPanelRef = useRef<NavigationPanelHandle>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  // Handle theme toggle with animation
  const handleThemeToggle = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    toggleThemeWithAnimation(event, resolvedTheme, setTheme);
  }, [resolvedTheme, setTheme]);

  // Convert selectedFields to Set<string> for favorite comparison
  const selectedPaths = useMemo(() => {
    return new Set(selectedFields.map((f) => JSON.stringify(f)));
  }, [selectedFields]);

  // Favorite views hook
  const {
    allFavorites,
    activeFavorite,
    saveFavorite,
    applyFavorite,
    clearFavorite,
    deleteFavorite,
    renameFavorite,
  } = useFavoriteViews({
    currentGVK: selectedGVK,
    selectedPaths,
  });

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

  const handleSearch = useCallback(() => {
    navigationPanelRef.current?.toggleSearch();
  }, []);

  const handleSaveFavorite = useCallback(async (name: string) => {
    await saveFavorite(name);
  }, [saveFavorite]);

  // Convert favorite fields to path set for NavigationPanel
  const fieldsToPathSet = useCallback((fields: string[][]) => {
    return new Set(fields.map((f) => f.join(PATH_DELIMITER)));
  }, []);

  // Apply favorite by ID (sets paths in NavigationPanel and activates)
  const applyFavoriteById = useCallback((id: string) => {
    const fields = applyFavorite(id);
    if (!fields || !navigationPanelRef.current) {
      return;
    }

    const pathSet = fieldsToPathSet(fields);
    navigationPanelRef.current.setSelectedPaths(pathSet);
  }, [applyFavorite, fieldsToPathSet]);

  // Called when NavigationPanel finishes loading - apply pending favorite if any
  const handleNavigationReady = useCallback(() => {
    if (pendingFavoriteIdRef.current) {
      applyFavoriteById(pendingFavoriteIdRef.current);
      pendingFavoriteIdRef.current = null;
    }
  }, [applyFavoriteById]);

  // Apply favorite (same logic as CommandPalette)
  const handleApplyFavorite = useCallback((favorite: main.FavoriteViewResponse) => {
    const matchingGVK = gvks.find(
      (g) =>
        g.group === favorite.gvk.group &&
        g.version === favorite.gvk.version &&
        g.kind === favorite.gvk.kind
    );
    if (!matchingGVK) return;

    // Check if same GVK is already selected
    const isSameGVK = selectedGVK &&
      selectedGVK.group === matchingGVK.group &&
      selectedGVK.version === matchingGVK.version &&
      selectedGVK.kind === matchingGVK.kind;

    if (isSameGVK) {
      // Same GVK - apply directly without waiting for onReady
      applyFavoriteById(favorite.id);
    } else {
      // Different GVK - need to wait for NavigationPanel to load
      pendingFavoriteIdRef.current = favorite.id;
      setSelectedGVK(matchingGVK);
    }
  }, [gvks, selectedGVK, applyFavoriteById]);

  const handleClearFavorite = useCallback(() => {
    clearFavorite();
    // Also clear nav panel selections
    navigationPanelRef.current?.clearSelections();
  }, [clearFavorite]);

  const gvkLabel = selectedGVK
    ? `${selectedGVK.kind.toLowerCase()} (${selectedGVK.group ? `${selectedGVK.group}/${selectedGVK.version}` : selectedGVK.version})`
    : "";

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
              onSearch={handleSearch}
            />

            {/* Quick Access Bar for Favorites - always visible */}
            <QuickAccessBar
              favorites={allFavorites}
              activeFavoriteId={activeFavorite?.id ?? null}
              selectedGVK={selectedGVK}
              gvkLabel={gvkLabel}
              fieldCount={selectedFields.length}
              isFavoriteSaved={activeFavorite !== null}
              onApply={handleApplyFavorite}
              onClear={handleClearFavorite}
              onRename={renameFavorite}
              onDelete={deleteFavorite}
              onSaveFavorite={handleSaveFavorite}
            />

            {/* Navigation Content */}
            <div className="flex-1 overflow-auto">
              {selectedGVK ? (
                <NavigationPanel
                  ref={navigationPanelRef}
                  selectedGVK={selectedGVK}
                  connectedContexts={connectedContexts}
                  onReady={handleNavigationReady}
                  onFieldsSelected={setSelectedFields}
                />
              ) : (
                <div className="h-full flex items-center justify-center px-4">
                  <Button
                    variant="ghost"
                    className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground"
                    onClick={() => setShowCommandPalette(true)}
                  >
                    Press <Kbd>⌘</Kbd><Kbd>K</Kbd> to select a resource
                  </Button>
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
                <Button
                  variant="ghost"
                  className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground"
                  onClick={() => setShowCommandPalette(true)}
                >
                  Press <Kbd>⌘</Kbd><Kbd>K</Kbd> to select a resource
                </Button>
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
          favorites={allFavorites}
          loading={loading}
          theme={resolvedTheme}
          onClose={() => setShowCommandPalette(false)}
          onGVKSelect={(gvk) => {
            setSelectedGVK(gvk);
            setShowCommandPalette(false);
          }}
          onFavoriteSelect={(favorite) => {
            handleApplyFavorite(favorite);
            setShowCommandPalette(false);
          }}
          onThemeToggle={handleThemeToggle}
        />
      )}
    </div>
  );
}
