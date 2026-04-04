import { addDays, endOfMonth, format, parseISO, startOfDay } from "date-fns";

import type { MonthlyTarget, MonthlyTargetRecurrenceMode, MonthlyTargetType, Settings } from "@/types/finance";

export interface MonthlyTargetDraftInput {
  month_ref: string;
  title: string;
  type: MonthlyTargetType;
  amount: string | number;
  expected_date: string;
  applies_to_cashflow: boolean;
  offsets_monthly_bills: boolean;
  is_active: boolean;
  recurrence_mode: MonthlyTargetRecurrenceMode;
  recurrence_weekdays: number[];
  recurrence_occurrences: string | number | null;
  notes: string;
}

function clampDay(day: number) {
  return Math.min(28, Math.max(1, day || 1));
}

function defaultExpectedDate(monthValue: string, settings: Settings) {
  return `${monthValue}-${String(clampDay(settings.default_goal_day)).padStart(2, "0")}`;
}

const weekdayShortLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;

export function stripMonthlyTargetPersistedTitle(title: string) {
  return title.replace(/ - \d{2}\/\d{2} \((Dom|Seg|Ter|Qua|Qui|Sex|Sab)\)$/u, "").trim();
}

export function formatMonthlyTargetPersistedTitle(title: string, expectedDate: string | null | undefined) {
  const baseTitle = stripMonthlyTargetPersistedTitle(title);
  if (!expectedDate) {
    return baseTitle;
  }

  const parsedDate = parseISO(expectedDate);
  const weekdayLabel = weekdayShortLabels[parsedDate.getDay()];
  return `${baseTitle} - ${format(parsedDate, "dd/MM")} (${weekdayLabel})`;
}

export function materializeMonthlyTargetDraft(
  draft: MonthlyTargetDraftInput,
  settings: Settings,
  referenceDate = new Date(),
): Array<Omit<MonthlyTarget, "id" | "created_at" | "updated_at">> {
  const amount = Number(draft.amount) || 0;
  const monthRef = `${draft.month_ref}-01`;
  const baseTarget = {
    month_ref: monthRef,
    title: draft.title.trim(),
    type: draft.type,
    amount,
    applies_to_cashflow: draft.applies_to_cashflow,
    offsets_monthly_bills: draft.offsets_monthly_bills,
    is_active: draft.is_active,
    status: "pending" as const,
    completed_at: null,
    notes: draft.notes.trim(),
  };

  if (draft.recurrence_mode !== "weekly" || draft.recurrence_weekdays.length === 0) {
    const expectedDate = draft.expected_date || defaultExpectedDate(draft.month_ref, settings);
    return [
      {
        ...baseTarget,
        title: formatMonthlyTargetPersistedTitle(baseTarget.title, expectedDate),
        expected_date: expectedDate,
        recurrence_mode: "single",
        recurrence_weekdays: [],
        recurrence_occurrences: null,
      },
    ];
  }

  const monthStart = startOfDay(parseISO(monthRef));
  const monthEnd = endOfMonth(monthStart);
  const today = startOfDay(referenceDate);
  const firstEligibleDate = monthStart > today ? monthStart : today;
  if (firstEligibleDate > monthEnd) {
    return [];
  }

  const dates: string[] = [];
  for (let cursor = new Date(firstEligibleDate); cursor <= monthEnd; cursor = addDays(cursor, 1)) {
    if (draft.recurrence_weekdays.includes(cursor.getDay())) {
      dates.push(format(cursor, "yyyy-MM-dd"));
    }
  }

  const maxOccurrences = draft.recurrence_occurrences ? Number(draft.recurrence_occurrences) : null;
  const selectedDates =
    maxOccurrences && maxOccurrences > 0 ? dates.slice(0, maxOccurrences) : dates;

  return selectedDates.map((expectedDate) => ({
    ...baseTarget,
    title: formatMonthlyTargetPersistedTitle(baseTarget.title, expectedDate),
    expected_date: expectedDate,
    recurrence_mode: "single",
    recurrence_weekdays: [],
    recurrence_occurrences: null,
  }));
}
