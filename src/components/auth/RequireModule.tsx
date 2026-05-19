import { ReactNode, useEffect } from "react";
import { useWorkspace, type ModuleKey } from "@/hooks/useWorkspace";
import { toast } from "sonner";

interface Props {
  module: ModuleKey;
  children: ReactNode;
  onDenied?: () => void;
}

/**
 * Hides children when the active workspace doesn't allow viewing the module.
 * Calls onDenied (typically to redirect to "today") and toasts once.
 */
export const RequireModule = ({ module, children, onDenied }: Props) => {
  const { canViewModule, loading } = useWorkspace();
  const allowed = canViewModule(module);

  useEffect(() => {
    if (loading) return;
    if (!allowed) {
      toast.error("Você não tem permissão para acessar esse módulo neste ambiente.");
      onDenied?.();
    }
  }, [allowed, loading, onDenied]);

  if (loading || !allowed) return null;
  return <>{children}</>;
};

interface OwnerProps {
  children: ReactNode;
  onDenied?: () => void;
}

export const RequireOwner = ({ children, onDenied }: OwnerProps) => {
  const { isOwnerOfAny, loading } = useWorkspace();
  useEffect(() => {
    if (loading) return;
    if (!isOwnerOfAny) {
      toast.error("Apenas administradores podem acessar esta área.");
      onDenied?.();
    }
  }, [isOwnerOfAny, loading, onDenied]);
  if (loading || !isOwnerOfAny) return null;
  return <>{children}</>;
};
