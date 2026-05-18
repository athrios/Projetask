import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, Settings2, Check } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { asColor, TEMPLATE_COLORS } from "@/components/processes/templateColors";
import { cn } from "@/lib/utils";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";

const swatchOf = (c: string) =>
  TEMPLATE_COLORS.find((x) => x.key === asColor(c))?.swatch ?? "bg-slate-400";

interface Props {
  onManage: () => void;
}

export const WorkspaceSwitcher = ({ onManage }: Props) => {
  const { workspaces, workspace, setWorkspaceId } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/50 mb-1">
          Ambiente atual
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent/70 text-left transition"
          >
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", swatchOf(workspace?.color ?? "gray"))} />
            <span className="flex-1 text-sm truncate">{workspace?.name ?? "—"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onSelect={() => setWorkspaceId(w.id)}
                className="gap-2"
              >
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", swatchOf(w.color))} />
                <span className="flex-1 truncate text-sm">{w.name}</span>
                {workspace?.id === w.id && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="gap-2 text-sm">
              <Plus className="h-3.5 w-3.5" /> Novo ambiente
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onManage} className="gap-2 text-sm">
              <Settings2 className="h-3.5 w-3.5" /> Gerenciar ambientes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
};
