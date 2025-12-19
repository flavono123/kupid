import { Star } from "lucide-react";
import { Badge } from "./ui/badge";
import { main } from "../../wailsjs/go/models";

interface QuickAccessBarProps {
  favorites: main.FavoriteViewResponse[];
  activeFavoriteId: string | null;
  onApply: (favorite: main.FavoriteViewResponse) => void;
  onClear: () => void;
}

export function QuickAccessBar({
  favorites,
  activeFavoriteId,
  onApply,
  onClear,
}: QuickAccessBarProps) {
  if (favorites.length === 0) return null;

  return (
    <div className="px-4 py-2 border-b border-border">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        {favorites.map((fav) => (
          <Badge
            key={fav.id}
            variant={fav.id === activeFavoriteId ? "default" : "outline"}
            className="cursor-pointer hover:bg-accent"
            onClick={() => {
              if (fav.id === activeFavoriteId) {
                onClear();
              } else {
                onApply(fav);
              }
            }}
          >
            {fav.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
