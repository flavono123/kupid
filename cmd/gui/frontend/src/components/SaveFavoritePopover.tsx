import { useState, useRef, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

interface SaveFavoritePopoverProps {
  gvkLabel: string;
  fieldCount: number;
  isSaved: boolean;
  onSave: (name: string) => Promise<void>;
  disabled?: boolean;
}

export function SaveFavoritePopover({
  gvkLabel,
  fieldCount,
  isSaved,
  onSave,
  disabled,
}: SaveFavoritePopoverProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      // Focus input after popover opens
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(newOpen) => {
      // Don't open popover if already saved as favorite
      if (newOpen && isSaved) return;
      setOpen(newOpen);
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled || fieldCount === 0}
          className="h-6 w-6"
          title={isSaved ? "Saved as favorite" : "Save as favorite"}
        >
          <Star
            className={`h-3.5 w-3.5 ${isSaved ? "fill-current text-accent" : ""}`}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Save as favorite</h4>
          <Input
            ref={inputRef}
            placeholder="Enter name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            {gvkLabel} &middot; {fieldCount} field{fieldCount !== 1 ? "s" : ""}
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
