import { useState, useRef, useEffect } from "react";
import { Star, ChevronRight, ChevronDown, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import { main } from "../../wailsjs/go/models";
import { cn } from "@/lib/utils";

interface QuickAccessBarProps {
  favorites: main.FavoriteViewResponse[];
  activeFavoriteId: string | null;
  onApply: (favorite: main.FavoriteViewResponse) => void;
  onClear: () => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function QuickAccessBar({
  favorites,
  activeFavoriteId,
  onApply,
  onClear,
  onRename,
  onDelete,
}: QuickAccessBarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<main.FavoriteViewResponse | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  if (favorites.length === 0) return null;

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

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border">
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-2 flex items-center justify-between hover:bg-focus transition-colors">
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="text-xs font-medium text-foreground">Favorites</span>
              <span className="text-xs text-muted-foreground">({favorites.length})</span>
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border">
            {favorites.map((fav) => {
              const isActive = fav.id === activeFavoriteId;
              const isEditing = fav.id === editingId;

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

              return (
                <div
                  key={fav.id}
                  className={cn(
                    "group px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors",
                    isActive
                      ? "bg-focus-active hover:bg-focus-active"
                      : "hover:bg-focus"
                  )}
                  onClick={() => {
                    if (isActive) {
                      onClear();
                    } else {
                      onApply(fav);
                    }
                  }}
                >
                  <Star
                    className={cn(
                      "h-3 w-3 shrink-0",
                      isActive ? "text-accent fill-accent" : "text-accent/60"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm flex-1 truncate",
                      isActive ? "text-foreground font-medium" : "text-muted-foreground"
                    )}
                  >
                    {fav.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {fav.fields.length}
                  </span>

                  {/* Action buttons - visible on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleStartEdit(fav, e)}
                      title="Rename"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
        </CollapsibleContent>
      </Collapsible>

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
}
