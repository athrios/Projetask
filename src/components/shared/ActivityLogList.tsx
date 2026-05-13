import { useEffect, useState } from "react";
import {
  fetchActivityLogs,
  type EntityType,
  type ActivityLog,
} from "@/lib/activityLog";
import { Activity } from "lucide-react";

interface Props {
  entityType: EntityType;
  entityId: string;
  refreshKey?: number;
}

export const ActivityLogList = ({ entityType, entityId, refreshKey }: Props) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchActivityLogs(entityType, entityId)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [entityType, entityId, refreshKey]);

  if (loading) {
    return <p className="text-xs text-muted-foreground">Carregando histórico...</p>;
  }

  if (!logs.length) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Activity className="h-3.5 w-3.5" />
        Sem atividades registradas.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {logs.map((l) => (
        <li key={l.id} className="flex items-start gap-2 text-xs">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-foreground/90">{l.description}</p>
            <p className="text-muted-foreground text-[11px]">
              {new Date(l.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
};
