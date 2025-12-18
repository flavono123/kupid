import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Button } from "./ui/button";
import { ChevronLeft, PlugZap, Unplug } from "lucide-react";

interface ContextDisplayProps {
  selectedContexts: string[];
  connectedContexts: string[];
  onBackToContexts: () => void;
}

export function ContextDisplay({
  selectedContexts,
  connectedContexts,
  onBackToContexts,
}: ContextDisplayProps) {
  const isSingleContext = selectedContexts.length === 1;

  // Single context: just show hover-to-transform button (no portal needed)
  if (isSingleContext) {
    return (
      <div className="group relative">
        {/* Default state: context name */}
        <div className="flex items-center gap-2 px-3 py-2 min-w-0 group-hover:invisible overflow-hidden">
          <PlugZap className="w-4 h-4 text-primary flex-shrink-0" />
          <h2 className="text-sm text-foreground truncate">
            {connectedContexts[0]}
          </h2>
        </div>

        {/* Hover state: back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToContexts}
          className="absolute inset-0 w-full justify-start gap-2 invisible group-hover:visible overflow-hidden font-normal"
        >
          <ChevronLeft className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Back to contexts</span>
        </Button>
      </div>
    );
  }

  // Multiple contexts: hover-to-transform button + portal with context list
  return (
    <HoverCard openDelay={100} closeDelay={200}>
      <HoverCardTrigger asChild>
        <div className="group relative">
          {/* Default state: context count */}
          <div className="flex items-center gap-2 px-3 py-2 min-w-0 group-hover:invisible overflow-hidden">
            <PlugZap className="w-4 h-4 text-primary flex-shrink-0" />
            <h2 className="text-sm text-foreground truncate">
              Contexts ({
                connectedContexts.length === selectedContexts.length
                  ? selectedContexts.length
                  : `${connectedContexts.length}/${selectedContexts.length}`
              })
            </h2>
          </div>

          {/* Hover state: back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToContexts}
            className="absolute inset-0 w-full justify-start gap-2 invisible group-hover:visible overflow-hidden font-normal"
          >
            <ChevronLeft className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Back to contexts</span>
          </Button>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto min-w-48 max-w-md p-2" align="start">
        <div className="space-y-0.5 text-xs">
          {selectedContexts
            .slice()
            .sort((a, b) => {
              const aConnected = connectedContexts.includes(a) ? 1 : 0;
              const bConnected = connectedContexts.includes(b) ? 1 : 0;
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
                  className={`flex items-center gap-2 px-2 py-1 rounded ${
                    isConnected ? "" : "text-muted-foreground"
                  }`}
                >
                  {isConnected ? (
                    <PlugZap className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  ) : (
                    <Unplug className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="break-all">{ctx}</span>
                </div>
              );
            })}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
