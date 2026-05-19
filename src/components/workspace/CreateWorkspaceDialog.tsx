import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TEMPLATE_COLORS, type TemplateColor } from "@/components/processes/templateColors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { workspaceNameSchema } from "@/lib/validation";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export const CreateWorkspaceDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const { reload, setWorkspaceId } = useWorkspace();
  const [name, setName] = useState("");
  const [color, setColor] = useState<TemplateColor>("blue");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = workspaceNameSchema.safeParse(name);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Nome inválido");
    if (!user) return toast.error("Sessão expirada");
    setSaving(true);
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ owner_id: user.id, name: parsed.data, color })
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ambiente criado");
    await reload();
    if (data) setWorkspaceId(data.id);
    onOpenChange(false);
    setName(""); setDesc(""); setColor("blue");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo ambiente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Departamento Fiscal" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Cor</label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setColor(c.key)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition",
                    c.swatch,
                    color === c.key ? "border-foreground scale-110" : "border-transparent hover:scale-105",
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Descrição (opcional)</label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-[60px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Criando…" : "Criar ambiente"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
