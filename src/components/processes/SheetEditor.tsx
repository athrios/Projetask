import { useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildCellMap,
  colLetter,
  evaluateCell,
  type TableColumn,
  type TableData,
  type TableRow,
} from "@/lib/sheetFormula";

interface Props {
  value: TableData;
  onChange: (v: TableData) => void;
  /** When true, columns/rows can still be added but UI is compact (used inside process detail). */
  editable?: boolean;
  readOnly?: boolean;
}

const makeId = () => Math.random().toString(36).slice(2, 10);

export const emptyTable = (): TableData => ({ columns: [], rows: [] });

export const SheetEditor = ({ value, onChange, readOnly = false }: Props) => {
  const cellMap = useMemo(() => buildCellMap(value), [value]);

  const addColumn = () => {
    const col: TableColumn = {
      id: makeId(),
      label: `Coluna ${value.columns.length + 1}`,
      kind: "text",
    };
    onChange({
      ...value,
      columns: [...value.columns, col],
      rows: value.rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: "" } })),
    });
  };

  const renameColumn = (id: string, label: string) => {
    onChange({
      ...value,
      columns: value.columns.map((c) => (c.id === id ? { ...c, label } : c)),
    });
  };

  const removeColumn = (id: string) => {
    onChange({
      ...value,
      columns: value.columns.filter((c) => c.id !== id),
      rows: value.rows.map((r) => {
        const { [id]: _, ...rest } = r.cells;
        return { ...r, cells: rest };
      }),
    });
  };

  const addRow = () => {
    const cells: Record<string, string> = {};
    value.columns.forEach((c) => (cells[c.id] = ""));
    onChange({ ...value, rows: [...value.rows, { id: makeId(), cells }] });
  };

  const removeRow = (id: string) => {
    onChange({ ...value, rows: value.rows.filter((r) => r.id !== id) });
  };

  const setCell = (rowId: string, colId: string, v: string) => {
    onChange({
      ...value,
      rows: value.rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: v } } : r,
      ),
    });
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="w-10 px-2 py-1.5 text-[11px] font-medium text-muted-foreground text-center">#</th>
              {value.columns.map((c, idx) => (
                <th key={c.id} className="px-2 py-1.5 border-l min-w-[140px]">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-mono w-4">
                      {colLetter(idx)}
                    </span>
                    {readOnly ? (
                      <span className="text-xs font-medium truncate">{c.label}</span>
                    ) : (
                      <Input
                        value={c.label}
                        onChange={(e) => renameColumn(c.id, e.target.value)}
                        className="h-7 text-xs border-none shadow-none px-1 font-medium"
                      />
                    )}
                    {!readOnly && (
                      <button
                        onClick={() => removeColumn(c.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remover coluna"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {!readOnly && (
                <th className="w-10 px-1 py-1.5 border-l">
                  <button
                    onClick={addColumn}
                    className="text-muted-foreground hover:text-foreground"
                    title="Adicionar coluna"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, rIdx) => (
              <tr key={row.id} className="border-b group">
                <td className="px-2 py-1 text-[11px] text-muted-foreground text-center tabular-nums bg-muted/20">
                  {rIdx + 1}
                </td>
                {value.columns.map((col) => {
                  const raw = row.cells[col.id] ?? "";
                  const result = evaluateCell(raw, cellMap);
                  const isFormula = raw.startsWith("=");
                  return (
                    <td key={col.id} className="border-l p-0 align-top">
                      <CellInput
                        raw={raw}
                        display={result.display}
                        error={result.error}
                        isFormula={isFormula}
                        readOnly={readOnly}
                        kind={col.kind}
                        onCommit={(v) => setCell(row.id, col.id, v)}
                      />
                    </td>
                  );
                })}
                {!readOnly && (
                  <td className="border-l text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 p-1"
                      title="Remover linha"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {value.rows.length === 0 && (
              <tr>
                <td
                  colSpan={value.columns.length + 2}
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  Nenhuma linha. {!readOnly && "Use \"Adicionar linha\" para começar."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addRow} disabled={value.columns.length === 0}>
            <Plus className="h-3.5 w-3.5" /> Linha
          </Button>
          <Button size="sm" variant="outline" onClick={addColumn}>
            <Plus className="h-3.5 w-3.5" /> Coluna
          </Button>
        </div>
      )}
    </div>
  );
};

const CellInput = ({
  raw,
  display,
  error,
  isFormula,
  readOnly,
  kind,
  onCommit,
}: {
  raw: string;
  display: string;
  error?: string;
  isFormula: boolean;
  readOnly: boolean;
  kind?: "text" | "number";
  onCommit: (v: string) => void;
}) => {
  if (readOnly) {
    return (
      <div
        className={cn(
          "px-2 py-1.5 text-sm",
          kind === "number" && "text-right tabular-nums",
          error && "text-destructive",
        )}
        title={error || (isFormula ? raw : undefined)}
      >
        {display}
      </div>
    );
  }
  return <EditableCell raw={raw} display={display} error={error} isFormula={isFormula} kind={kind} onCommit={onCommit} />;
};

import { useState, useRef, useEffect } from "react";

const EditableCell = ({
  raw, display, error, isFormula, kind, onCommit,
}: {
  raw: string; display: string; error?: string; isFormula: boolean;
  kind?: "text" | "number"; onCommit: (v: string) => void;
}) => {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(raw);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!focused) setDraft(raw); }, [raw, focused]);
  const shown = focused ? draft : (isFormula ? display : raw);
  return (
    <input
      ref={inputRef}
      type="text"
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => { setDraft(raw); setFocused(true); }}
      onBlur={() => {
        setFocused(false);
        if (draft !== raw) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") inputRef.current?.blur();
        if (e.key === "Escape") { setDraft(raw); inputRef.current?.blur(); }
      }}
      className={cn(
        "w-full px-2 py-1.5 text-sm bg-transparent outline-none focus:bg-accent/30 focus:ring-1 focus:ring-ring",
        kind === "number" && "text-right tabular-nums",
        !focused && isFormula && "text-primary",
        error && "text-destructive",
      )}
      title={error || (isFormula ? `Fórmula: ${raw} = ${display}` : undefined)}
    />
  );
};
