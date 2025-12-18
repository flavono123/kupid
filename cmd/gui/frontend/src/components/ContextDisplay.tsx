import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { PlugZap, Unplug } from "lucide-react";

interface ContextDisplayProps {
  selectedContexts: string[];
  connectedContexts: string[];
}

export function ContextDisplay({ selectedContexts, connectedContexts }: ContextDisplayProps) {
  if (selectedContexts.length === 1) {
    // Single context: show icon + name only
    return (
      <div className="flex items-center gap-2 min-w-0 px-3 py-2">
        <PlugZap className="w-4 h-4 text-primary flex-shrink-0" />
        <h2 className="text-sm text-foreground overflow-hidden whitespace-nowrap">
          {connectedContexts[0]}
        </h2>
      </div>
    );
  }

  // Multiple contexts: show popover with count
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 px-3 py-2 rounded-md transition-colors min-w-0">
          <PlugZap className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="overflow-hidden">
            <h2 className="text-sm text-foreground whitespace-nowrap">
              Contexts ({
                connectedContexts.length === selectedContexts.length
                  ? selectedContexts.length
                  : `${connectedContexts.length}/${selectedContexts.length}`
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
  );
}
