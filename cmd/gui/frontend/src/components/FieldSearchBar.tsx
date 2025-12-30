import { forwardRef, useImperativeHandle, useRef } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { X } from "lucide-react";

interface FieldSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  currentMatchIndex: number;
  totalMatches: number;
  hasMoreResults: boolean;
  onClose: () => void;
}

export interface FieldSearchBarHandle {
  isInputFocused: () => boolean;
  focus: () => void;
}

export const FieldSearchBar = forwardRef<FieldSearchBarHandle, FieldSearchBarProps>(({
  query,
  onQueryChange,
  currentMatchIndex,
  totalMatches,
  hasMoreResults,
  onClose,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    isInputFocused: () => document.activeElement === inputRef.current,
    focus: () => inputRef.current?.focus(),
  }), []);

  return (
    <div className="
      p-2 flex items-center gap-1.5
      border-b border-border
      md:absolute md:top-2 md:right-2 md:z-10
      md:w-64 md:border md:rounded-md md:shadow-lg
      md:bg-background/95 md:backdrop-blur-sm
      md:p-1.5
    ">
      <Input
        ref={inputRef}
        placeholder="Search ..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="flex-1 h-8 text-sm"
        autoFocus
      />
      {query && totalMatches > 0 && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {currentMatchIndex + 1}/{totalMatches}
          {hasMoreResults && '+'}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
});

FieldSearchBar.displayName = 'FieldSearchBar';
