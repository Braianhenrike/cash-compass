import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { AuditAction, AuditEntityType, AuditEvent } from "@/types/finance";

type AuditRow = Tables<"audit_events">;

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function mapAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    user_id: row.user_id,
    entity_type: row.entity_type as AuditEntityType,
    entity_id: row.entity_id,
    action: row.action as AuditAction,
    summary: row.summary,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    created_at: row.created_at,
  };
}

export async function fetchAuditEvents(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  throwIfError(error);
  return (data ?? []).map(mapAudit);
}

export async function createAuditEvent(input: {
  user_id: string;
  entity_type: AuditEntityType;
  entity_id?: string | null;
  action: AuditAction;
  summary: string;
  payload?: Record<string, unknown> | null;
}) {
  const payload: TablesInsert<"audit_events"> = {
    user_id: input.user_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    action: input.action,
    summary: input.summary,
    payload: input.payload ?? null,
  };

  const { error } = await supabase.from("audit_events").insert(payload);
  throwIfError(error);
}

export async function safeCreateAuditEvent(input: Parameters<typeof createAuditEvent>[0]) {
  try {
    await createAuditEvent(input);
  } catch (error) {
    console.warn("Nao foi possivel registrar auditoria:", error);
  }
}
