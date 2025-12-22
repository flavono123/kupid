import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KattleLogo } from "./KattleLogo";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import {
  APP_NAME,
  APP_VERSION,
  APP_TAGLINE,
  APP_DESCRIPTION,
  GITHUB_URL,
} from "@/lib/constants";

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  const handleOpenGitHub = () => {
    BrowserOpenURL(GITHUB_URL);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mb-4">
            <KattleLogo size="xl" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {APP_NAME}
          </DialogTitle>
          <DialogDescription className="text-base">
            {APP_TAGLINE}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Version info */}
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              {APP_DESCRIPTION}
            </p>
            <p className="text-xs text-muted-foreground/70">
              Version {APP_VERSION}
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenGitHub}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              GitHub
            </Button>
          </div>

          {/* Credits */}
          <div className="pt-4 border-t w-full text-center">
            <p className="text-xs text-muted-foreground">
              Made with care for the Kubernetes community
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
