import type { PropsWithChildren } from "react";

import { Label } from "@/components/ui/label";

interface FormFieldProps extends PropsWithChildren {
  label: string;
  hint?: string;
}

export default function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
