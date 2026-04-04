import { AlertTriangle, RefreshCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface StatePanelProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "empty" | "error";
}

export default function StatePanel({
  title,
  description,
  actionLabel,
  onAction,
  variant = "empty",
}: StatePanelProps) {
  const Icon = variant === "error" ? AlertTriangle : Search;

  return (
    <Card className={variant === "error" ? "border-destructive/40" : undefined}>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div
          className={`rounded-full p-3 ${
            variant === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        {actionLabel && onAction && (
          <Button variant={variant === "error" ? "destructive" : "outline"} onClick={onAction}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
