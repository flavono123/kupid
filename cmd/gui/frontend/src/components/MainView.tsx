import { useState, useEffect, useRef } from "react";
import { Card } from "./ui/card";
import { ResourceSelector } from "./ResourceSelector";
import { Kbd } from "./ui/kbd";
import { Button } from "./ui/button";
import { ArrowLeft } from "lucide-react";
import { GetResourcesForContexts } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";

interface MainViewProps {
  contexts: string[];
  onBackToContexts: () => void;
}

export function MainView({ contexts, onBackToContexts }: MainViewProps) {
  const [showResourceSelector, setShowResourceSelector] = useState(false);
  const [resources, setResources] = useState<main.ResourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  // Load resources once when MainView mounts
  useEffect(() => {
    // Prevent multiple loads
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadResources = async () => {
      console.log("MainView: Loading resources for contexts:", contexts);
      setLoading(true);
      try {
        const resourceList = await GetResourcesForContexts(contexts);
        console.log("MainView: Loaded resources:", resourceList.length, "items");
        setResources(resourceList);
      } catch (error) {
        console.error("MainView: Failed to load resources:", error);
      } finally {
        setLoading(false);
        console.log("MainView: Loading complete");
      }
    };

    loadResources();
  }, [contexts]);

  useEffect(() => {
    // cmd+k to toggle ResourceSelector
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowResourceSelector((prev) => !prev);
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToContexts}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Contexts
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Connected Contexts ({contexts.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                {contexts.join(', ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            <span>Open Resource Selector</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Placeholder */}
        <div className="flex-1 border-r border-border p-8 overflow-auto">
          <Card className="h-full flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">
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
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Right Panel
              </h3>
              <p className="text-sm text-muted-foreground">
                Resource details or editor will go here
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* ResourceSelector Modal */}
      {showResourceSelector && (
        <ResourceSelector
          contexts={contexts}
          resources={resources}
          loading={loading}
          onClose={() => setShowResourceSelector(false)}
        />
      )}
    </div>
  );
}
