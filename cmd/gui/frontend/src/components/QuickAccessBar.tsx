import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Star, Book, BookOpen, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Kbd } from "./ui/kbd";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { main } from "../../wailsjs/go/models";
import { cn } from "@/lib/utils";

interface QuickAccessBarProps {
  favorites: main.FavoriteViewResponse[];
  activeFavoriteId: string | null;
  selectedGVK: main.MultiClusterGVK | null;
  gvkLabel: string;
  fieldCount: number;
  isFavoriteSaved: boolean;
  onApply: (favorite: main.FavoriteViewResponse) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveFavorite: (name: string) => Promise<void>;
}

export interface QuickAccessBarHandle {
  openSavePopover: () => void;
}

export const QuickAccessBar = forwardRef<QuickAccessBarHandle, QuickAccessBarProps>(({
  favorites,
  activeFavoriteId,
  selectedGVK,
  gvkLabel,
  fieldCount,
  isFavoriteSaved,
  onApply,
  onRename,
  onDelete,
  onSaveFavorite,
}, ref) => {
  const [listPopoverOpen, setListPopoverOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<main.FavoriteViewResponse | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [savePopoverOpen, setSavePopoverOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarHovered, setIsStarHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Expose methods via ref
  const canSave = selectedGVK && fieldCount > 0 && !isFavoriteSaved;
  useImperativeHandle(ref, () => ({
    openSavePopover: () => {
      if (canSave) {
        setSavePopoverOpen(true);
      }
    },
  }), [canSave]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Reset confirm text when delete dialog opens/closes
  useEffect(() => {
    if (!deleteTarget) {
      setConfirmText("");
    }
  }, [deleteTarget]);

  // Focus save input when popover opens
  useEffect(() => {
    if (savePopoverOpen) {
      setSaveName("");
      setSaveError(null);
      setTimeout(() => saveInputRef.current?.focus(), 0);
    }
  }, [savePopoverOpen]);

  const handleSaveFavorite = async () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      setSaveError("Name is required");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveFavorite(trimmed);
      setSavePopoverOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveFavorite();
    }
    if (e.key === "Escape") {
      setSavePopoverOpen(false);
    }
  };

  const handleStartEdit = (fav: main.FavoriteViewResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(fav.id);
    setEditingName(fav.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim() || isRenaming) return;

    setIsRenaming(true);
    try {
      await onRename(editingId, editingName.trim());
      setEditingId(null);
      setEditingName("");
    } catch (err) {
      console.error("Failed to rename:", err);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfirmValid = confirmText.toLowerCase() === "confirm";
  const hasFavorites = favorites.length > 0;

  // Save popover content - reusable
  const SavePopoverContent = (
    <div className="space-y-3">
      <h4 className="font-medium text-sm">Save as favorite</h4>
      <Input
        ref={saveInputRef}
        placeholder="Enter name..."
        value={saveName}
        onChange={(e) => setSaveName(e.target.value)}
        onKeyDown={handleSaveKeyDown}
        disabled={isSaving}
      />
      <p className="text-xs text-muted-foreground">
        {gvkLabel} &middot; {fieldCount} field{fieldCount !== 1 ? "s" : ""}
      </p>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSavePopoverOpen(false)}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={handleSaveFavorite} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );

  // Favorites list content - reusable
  const FavoritesListContent = (
    <div className="py-1">
      {favorites.map((fav, index) => {
        const isActive = fav.id === activeFavoriteId;
        const isEditing = fav.id === editingId;
        const shortcutNumber = index < 9 ? index + 1 : null;

        if (isEditing) {
          return (
            <div
              key={fav.id}
              className="px-3 py-1.5 flex items-center gap-2 bg-muted/50"
            >
              <Star className="h-3 w-3 text-accent shrink-0" />
              <Input
                ref={inputRef}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-7 text-sm flex-1"
                disabled={isRenaming}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
                onClick={handleSaveEdit}
                disabled={!editingName.trim() || isRenaming}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCancelEdit}
                disabled={isRenaming}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }

        // Check if current GVK matches this favorite's GVK
        const isSameGVK = selectedGVK &&
          selectedGVK.group === fav.gvk.group &&
          selectedGVK.version === fav.gvk.version &&
          selectedGVK.kind === fav.gvk.kind;

        return (
          <div
            key={fav.id}
            className={cn(
              "group px-3 py-2 flex items-center gap-2 transition-colors min-w-0",
              isActive
                ? "bg-focus-active cursor-not-allowed"
                : "cursor-pointer hover:bg-focus"
            )}
            onClick={() => {
              // Selected item click is disabled - only allow clicking unselected items
              if (!isActive) {
                onApply(fav);
                setListPopoverOpen(false);
              }
            }}
          >
            {shortcutNumber ? (
              <Kbd className="text-[10px] w-4 h-4 flex items-center justify-center shrink-0">
                {shortcutNumber}
              </Kbd>
            ) : (
              <Star
                className={cn(
                  "h-3 w-3 shrink-0",
                  isActive ? "text-accent fill-accent" : "text-accent/60"
                )}
              />
            )}

            {/* Name with minimum width guarantee */}
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
              <span
                className={cn(
                  "text-sm truncate min-w-[80px]",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {fav.name}
              </span>

              {/* GVK info - only show when different GVK, can truncate */}
              {!isSameGVK && (
                <span className="text-xs flex items-center gap-1 truncate min-w-0 text-muted-foreground/60">
                  <span className="truncate">
                    {fav.gvk.kind} ({fav.gvk.group ? `${fav.gvk.group}/${fav.gvk.version}` : fav.gvk.version})
                  </span>
                </span>
              )}
            </div>

            {/* Field count - always visible */}
            <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
              {!isSameGVK && <span>&middot;</span>}
              <span>{fav.fields.length} {fav.fields.length === 1 ? 'field' : 'fields'}</span>
            </span>

            {/* Action buttons - visible on hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={(e) => handleStartEdit(fav, e)}
                title="Rename"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(fav);
                }}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Single unified render
  return (
    <>
      <div className="h-8 border-b border-border flex items-center">
        {/* Save as favorite button */}
        <Popover
          open={savePopoverOpen}
          onOpenChange={(newOpen) => {
            if (newOpen && (isFavoriteSaved || !canSave)) return;
            setSavePopoverOpen(newOpen);
          }}
        >
          <PopoverTrigger asChild>
            <button
              className="px-3 py-2 hover:bg-focus transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSave}
              onMouseEnter={() => setIsStarHovered(true)}
              onMouseLeave={() => setIsStarHovered(false)}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  activeFavoriteId ? "text-accent fill-accent" : "text-accent"
                )}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start" side="bottom">
            {SavePopoverContent}
          </PopoverContent>
        </Popover>

        {/* Favorites list popover */}
        {hasFavorites ? (
          <Popover open={listPopoverOpen} onOpenChange={setListPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex-1 px-1 py-2 flex items-center gap-2 hover:bg-focus transition-colors min-w-0">
                {isStarHovered && canSave ? (
                  <span className="text-xs font-medium text-accent truncate">Save as favorite</span>
                ) : (
                  <>
                    {/* Spacer to push content to right */}
                    <span className="flex-1" />
                    <span className="text-xs font-medium text-foreground shrink-0">Favorites</span>
                    <span className="text-xs text-muted-foreground shrink-0">({favorites.length})</span>
                    {listPopoverOpen ? (
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <Book className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start" side="bottom">
              {FavoritesListContent}
            </PopoverContent>
          </Popover>
        ) : (
          <div className="flex-1 px-1 py-2 flex items-center gap-2 min-w-0">
            {canSave ? (
              <span className="text-xs font-medium text-accent truncate">Save as favorite</span>
            ) : (
              <span className="text-xs text-muted-foreground truncate">
                {!selectedGVK ? "No saved views" : "Select fields to save"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-destructive" />
              </div>
              Delete "{deleteTarget?.name}"
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Type <span className="font-mono text-destructive bg-destructive/10 px-1 rounded">confirm</span> to delete:
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="confirm"
              className={cn(
                "focus-visible:ring-destructive",
                isConfirmValid && "border-destructive"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isConfirmValid) {
                  handleDelete();
                }
              }}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmValid || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

QuickAccessBar.displayName = 'QuickAccessBar';
