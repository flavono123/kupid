import { Kbd } from './ui/kbd';

export type FocusedPanel = 'nav' | 'table' | null;

interface KeymapBarProps {
  focusedPanel: FocusedPanel;
  selectedFieldCount: number;
  isSearchFocused: boolean;
  hasTableData: boolean;
}

export function KeymapBar({
  focusedPanel,
  selectedFieldCount,
  isSearchFocused,
  hasTableData,
}: KeymapBarProps) {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-border flex gap-4 text-xs text-muted-foreground">
      {/* Common shortcuts */}
      <div className="flex items-center gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <span>Command</span>
      </div>

      {isSearchFocused ? (
        // Search focused shortcuts
        <>
          <div className="flex items-center gap-1">
            <Kbd>Esc</Kbd>
            <span>Close search</span>
          </div>
          <div className="flex items-center gap-1">
            <Kbd>Enter</Kbd>
            <span>Next match</span>
          </div>
        </>
      ) : focusedPanel === 'nav' ? (
        // Nav panel shortcuts
        <>
          <div className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>F</Kbd>
            <span>Search fields</span>
          </div>
          <div className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <Kbd>Space</Kbd>
            <span>Select / Toggle</span>
          </div>
          {selectedFieldCount > 0 && (
            <div className="flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>⇧</Kbd>
              <Kbd>A</Kbd>
              <span>Clear all</span>
            </div>
          )}
          {hasTableData && (
            <div className="flex items-center gap-1">
              <Kbd>Tab</Kbd>
              <span>Go to table</span>
            </div>
          )}
        </>
      ) : focusedPanel === 'table' ? (
        // Table shortcuts
        <>
          <div className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>F</Kbd>
            <span>Search rows</span>
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
            <span>Copy cell</span>
          </div>
          <div className="flex items-center gap-1">
            <Kbd>Tab</Kbd>
            <span>Go to fields</span>
          </div>
        </>
      ) : (
        // No focus - show hint
        <>
          <div className="flex items-center gap-1">
            <Kbd>Tab</Kbd>
            <span>Focus panel</span>
          </div>
        </>
      )}

      {/* Back to contexts */}
      <div className="flex items-center gap-1 ml-auto">
        <Kbd>⌘</Kbd>
        <Kbd>[</Kbd>
        <span>Back</span>
      </div>
    </div>
  );
}
