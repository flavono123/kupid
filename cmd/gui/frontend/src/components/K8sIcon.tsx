import { cn } from "@/lib/utils";
import k8sLogo from "@/assets/k8s-logo.svg";

interface K8sIconProps {
  className?: string;
}

export function K8sIcon({ className }: K8sIconProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-[#326CE5] to-[#5B8FF9] rounded-lg flex items-center justify-center",
        className
      )}
    >
      <img src={k8sLogo} alt="Kubernetes" className="w-full h-full p-2" />
    </div>
  );
}
