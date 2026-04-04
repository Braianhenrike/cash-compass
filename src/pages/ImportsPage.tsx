import { useMemo, useState } from "react";
import { FileSpreadsheet, History, Upload } from "lucide-react";

import StatePanel from "@/components/app/StatePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { parseBudgetTemplateFile } from "@/lib/importers/excelBudgetImport";
import { formatCurrency } from "@/lib/calculations";
import { useFinanceStore } from "@/stores/financeStore";
import type { ImportExecutionOptions, ImportPreview, ImportedTemplateEntry } from "@/types/finance";

const defaultOptions: ImportExecutionOptions = {
  replace_existing_imports: true,
  update_current_cash_from_sheet: true,
};

function groupedEntries(entries: ImportedTemplateEntry[], kind: ImportedTemplateEntry["kind"]) {
  return entries.filter((entry) => entry.kind === kind);
}

export default function ImportsPage() {
  const { settings, importTemplate, auditEvents, isSyncing } = useFinanceStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [baseYear, setBaseYear] = useState(new Date().getFullYear());
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [options, setOptions] = useState<ImportExecutionOptions>(defaultOptions);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const importHistory = useMemo(
    () => auditEvents.filter((event) => event.entity_type === "import").slice(0, 12),
    [auditEvents],
  );
  const incomeEntries = useMemo(() => groupedEntries(preview?.entries ?? [], "income"), [preview?.entries]);
  const billEntries = useMemo(() => groupedEntries(preview?.entries ?? [], "bill"), [preview?.entries]);
  const investmentEntries = useMemo(
    () => groupedEntries(preview?.entries ?? [], "planned_investment"),
    [preview?.entries],
  );

  async function handlePreview() {
    if (!selectedFile) {
      setErrorMessage("Selecione um arquivo Excel antes de gerar a pre-visualizacao.");
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);

    try {
      const nextPreview = await parseBudgetTemplateFile(selectedFile, baseYear);
      setPreview(nextPreview);
    } catch (error) {
      setPreview(null);
      setErrorMessage(
        getFriendlyErrorMessage(error, "Nao foi possivel ler a planilha. Confira o template e tente novamente."),
      );
    } finally {
      setIsParsing(false);
    }
  }

  async function handleImport() {
    if (!preview) {
      setErrorMessage("Gere a pre-visualizacao antes de importar.");
      return;
    }

    setErrorMessage(null);

    try {
      await importTemplate(preview, options);
    } catch (error) {
      setErrorMessage(
        getFriendlyErrorMessage(error, "A importacao falhou. Revise o preview e tente novamente."),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Importacao de planilha</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Envie a planilha no template do seu controle mensal. O CashCompass vai transformar as linhas em entradas,
            contas e aportes planejados antes de gravar no banco.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          Excel .xlsx / .xls
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Enviar arquivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div>
                <Label htmlFor="budget-file">Arquivo</Label>
                <Input
                  id="budget-file"
                  className="mt-2"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label htmlFor="base-year">Ano base</Label>
                <Input
                  id="base-year"
                  className="mt-2"
                  type="number"
                  value={baseYear}
                  onChange={(event) => setBaseYear(Number(event.target.value) || new Date().getFullYear())}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                <div>
                  <p className="text-sm font-medium">Substituir importacoes anteriores</p>
                  <p className="text-xs text-muted-foreground">Apaga registros antigos marcados como importados.</p>
                </div>
                <Switch
                  checked={options.replace_existing_imports}
                  onCheckedChange={(checked) =>
                    setOptions((current) => ({ ...current, replace_existing_imports: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                <div>
                  <p className="text-sm font-medium">Atualizar valor em maos</p>
                  <p className="text-xs text-muted-foreground">
                    Usa o ultimo SALDO EM DINHEIRO da planilha como caixa atual.
                  </p>
                </div>
                <Switch
                  checked={options.update_current_cash_from_sheet}
                  onCheckedChange={(checked) =>
                    setOptions((current) => ({ ...current, update_current_cash_from_sheet: checked }))
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Como o template e lido</p>
              <ul className="mt-2 space-y-1">
                <li>Linhas acima de `Total de Entradas` viram entradas.</li>
                <li>Linhas abaixo de `Total de Entradas` viram contas a pagar.</li>
                <li>`Investir` vira aporte planejado em brick.</li>
                <li>`SALDO MENSAL` e `SALDO EM DINHEIRO` entram no preview para conferencia.</li>
                <li>A coluna `DATA` e usada como dia de vencimento quando existir.</li>
              </ul>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handlePreview()} disabled={!selectedFile || isParsing}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {isParsing ? "Lendo planilha..." : "Gerar pre-visualizacao"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleImport()}
                disabled={!preview || isSyncing || isParsing}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isSyncing ? "Importando..." : "Confirmar importacao"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumo rapido</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Caixa atual</p>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrency(settings.current_cash_balance, settings.currency)}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ultimo saldo da planilha</p>
              <p className="mt-2 text-xl font-semibold">
                {preview
                  ? preview.summary.last_cash_balance === null
                    ? "Nao identificado"
                    : formatCurrency(preview.summary.last_cash_balance, settings.currency)
                  : "Sem preview"}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Entradas mapeadas</p>
              <p className="mt-2 text-xl font-semibold">
                {preview ? preview.summary.income_count : 0}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Contas mapeadas</p>
              <p className="mt-2 text-xl font-semibold">
                {preview ? preview.summary.bill_count : 0}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Aportes mapeados</p>
              <p className="mt-2 text-xl font-semibold">
                {preview ? preview.summary.planned_investment_count : 0}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Impacto previsto</p>
              <p className="mt-2 text-xl font-semibold">
                {preview
                  ? formatCurrency(
                      preview.summary.total_income - preview.summary.total_bills - preview.summary.total_planned_investment,
                      settings.currency,
                    )
                  : "Sem preview"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!preview && !errorMessage && (
        <StatePanel
          title="Nenhuma planilha analisada ainda"
          description="Escolha o arquivo, ajuste o ano base se preciso e gere a pre-visualizacao antes de importar."
        />
      )}

      {preview && (
        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conferencia mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead>Saldo mensal</TableHead>
                    <TableHead>Saldo em dinheiro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.monthly_balances.map((item) => (
                    <TableRow key={item.month_label}>
                      <TableCell className="font-medium">{item.month_label}</TableCell>
                      <TableCell>
                        {item.monthly_result === null ? "-" : formatCurrency(item.monthly_result, settings.currency)}
                      </TableCell>
                      <TableCell>
                        {item.cash_balance === null ? "-" : formatCurrency(item.cash_balance, settings.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {preview.monthly_balances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        Nenhum saldo mensal identificado no arquivo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            <ImportEntriesCard
              title="Entradas importadas"
              entries={incomeEntries}
              currency={settings.currency}
              accentClassName="text-positive"
            />
            <ImportEntriesCard
              title="Contas importadas"
              entries={billEntries}
              currency={settings.currency}
              accentClassName="text-negative"
            />
            <ImportEntriesCard
              title="Aportes planejados"
              entries={investmentEntries}
              currency={settings.currency}
              accentClassName="text-warning-custom"
            />
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Historico recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {importHistory.length === 0 ? (
            <StatePanel
              title="Sem historico de importacao"
              description="Quando voce importar uma planilha, o resumo vai aparecer aqui."
            />
          ) : (
            <ScrollArea className="h-[320px] pr-4">
              <div className="space-y-3">
                {importHistory.map((event) => (
                  <div key={event.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{event.summary}</p>
                      <Badge variant="outline">{event.action}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{event.created_at}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ImportEntriesCard({
  title,
  entries,
  currency,
  accentClassName,
}: {
  title: string;
  entries: ImportedTemplateEntry[];
  currency: string;
  accentClassName: string;
}) {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total</p>
          <p className={`mt-2 text-xl font-semibold ${accentClassName}`}>{formatCurrency(total, currency)}</p>
        </div>
        <ScrollArea className="h-[280px] pr-4">
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{entry.label.replace(/__.+$/, "")}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.month_label}/{entry.date.slice(0, 4)} · {entry.date}
                    </p>
                  </div>
                  <span className={`font-semibold ${accentClassName}`}>{formatCurrency(entry.amount, currency)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p>
              </div>
            ))}
            {entries.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum item deste tipo foi encontrado.</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
