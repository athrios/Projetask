import { supabase } from "@/integrations/supabase/client";

export type EntityType = "task" | "process" | "request" | "form" | "subtask";
export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "status_changed"
  | "completed"
  | "reopened"
  | "converted"
  | "published"
  | "unpublished"
  | "recurrence_generated";

export interface ActivityLog {
  id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  action: ActivityAction;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const logActivity = async (
  userId: string,
  entityType: EntityType,
  entityId: string,
  action: ActivityAction,
  description: string,
  metadata: Record<string, unknown> = {},
) => {
  // best-effort; never block UX
  try {
    // @ts-expect-error new table not yet in generated types
    await supabase.from("activity_logs").insert({
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      description,
      metadata,
    });
  } catch {
    /* ignore */
  }
};

export const fetchActivityLogs = async (
  entityType: EntityType,
  entityId: string,
): Promise<ActivityLog[]> => {
  // @ts-expect-error new table not yet in generated types
  const { data } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as ActivityLog[];
};
