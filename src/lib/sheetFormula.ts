// Safe formula engine for the process table (mini-sheets).
// Supported: numbers, refs (A1, AB12), ranges (A1:A5), + - * /, parens, SOMA/SUM, MEDIA/AVERAGE.

export type ColumnId = string; // letter(s)
export type CellsByRef = Record<string, string>; // "A1" -> raw value

export const colLetter = (index0: number): string => {
  let n = index0;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

export const colIndex = (letter: string): number => {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

// Tokenizer
type Tok =
  | { t: "num"; v: number }
  | { t: "ref"; v: string }
  | { t: "range"; from: string; to: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" }
  | { t: "fn"; v: "SOMA" | "MEDIA" };

const FN_ALIAS: Record<string, "SOMA" | "MEDIA"> = {
  SOMA: "SOMA",
  SUM: "SOMA",
  MEDIA: "MEDIA",
  MÉDIA: "MEDIA",
  AVERAGE: "MEDIA",
  AVG: "MEDIA",
};

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src.trim();
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    if (c === ",") { out.push({ t: "comma" }); i++; continue; }
    if ("+-*/".includes(c)) { out.push({ t: "op", v: c as "+" }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const n = Number(s.slice(i, j).replace(",", "."));
      if (Number.isNaN(n)) throw new Error("número inválido");
      out.push({ t: "num", v: n });
      i = j;
      continue;
    }
    if (/[A-Za-zÀ-ú]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-zÀ-ú]/.test(s[j])) j++;
      const word = s.slice(i, j).toUpperCase();
      // ref or function
      if (j < s.length && /[0-9]/.test(s[j])) {
        // it's a ref
        let k = j;
        while (k < s.length && /[0-9]/.test(s[k])) k++;
        const ref = word + s.slice(j, k);
        // range?
        if (k < s.length && s[k] === ":") {
          let k2 = k + 1;
          while (k2 < s.length && /[A-Za-z]/.test(s[k2])) k2++;
          const colTo = s.slice(k + 1, k2).toUpperCase();
          let k3 = k2;
          while (k3 < s.length && /[0-9]/.test(s[k3])) k3++;
          const refTo = colTo + s.slice(k2, k3);
          if (!colTo || k3 === k2) throw new Error("intervalo inválido");
          out.push({ t: "range", from: ref, to: refTo });
          i = k3;
          continue;
        }
        out.push({ t: "ref", v: ref });
        i = k;
        continue;
      }
      // function
      const fn = FN_ALIAS[word];
      if (!fn) throw new Error(`função desconhecida: ${word}`);
      out.push({ t: "fn", v: fn });
      i = j;
      continue;
    }
    throw new Error(`caractere inválido: ${c}`);
  }
  return out;
}

// Recursive-descent parser -> evaluator
// expr := term (('+'|'-') term)*
// term := factor (('*'|'/') factor)*
// factor := number | ref | fn '(' args ')' | '(' expr ')' | '-' factor

export type Resolver = (ref: string) => number; // returns numeric value for ref, empty -> 0

class Parser {
  i = 0;
  constructor(private toks: Tok[], private resolve: Resolver, private resolveRange: (from: string, to: string) => number[]) {}
  peek() { return this.toks[this.i]; }
  eat<T extends Tok["t"]>(t: T): Extract<Tok, { t: T }> {
    const k = this.toks[this.i];
    if (!k || k.t !== t) throw new Error("sintaxe inválida");
    this.i++;
    return k as Extract<Tok, { t: T }>;
  }
  parseExpr(): number {
    let v = this.parseTerm();
    while (this.peek()?.t === "op" && ((this.peek() as { v: string }).v === "+" || (this.peek() as { v: string }).v === "-")) {
      const op = (this.eat("op")).v;
      const rhs = this.parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  parseTerm(): number {
    let v = this.parseFactor();
    while (this.peek()?.t === "op" && ((this.peek() as { v: string }).v === "*" || (this.peek() as { v: string }).v === "/")) {
      const op = (this.eat("op")).v;
      const rhs = this.parseFactor();
      if (op === "*") v *= rhs;
      else {
        if (rhs === 0) throw new Error("divisão por zero");
        v /= rhs;
      }
    }
    return v;
  }
  parseFactor(): number {
    const k = this.peek();
    if (!k) throw new Error("expressão incompleta");
    if (k.t === "op" && k.v === "-") { this.i++; return -this.parseFactor(); }
    if (k.t === "op" && k.v === "+") { this.i++; return this.parseFactor(); }
    if (k.t === "num") { this.i++; return k.v; }
    if (k.t === "ref") { this.i++; return this.resolve(k.v); }
    if (k.t === "lp") { this.i++; const v = this.parseExpr(); this.eat("rp"); return v; }
    if (k.t === "fn") {
      this.i++;
      this.eat("lp");
      const args: number[] = [];
      // collect first arg (can be a range or expr)
      while (this.peek() && this.peek()!.t !== "rp") {
        const p = this.peek()!;
        if (p.t === "range") {
          this.i++;
          args.push(...this.resolveRange(p.from, p.to));
        } else {
          args.push(this.parseExpr());
        }
        if (this.peek()?.t === "comma") this.i++;
      }
      this.eat("rp");
      if (k.v === "SOMA") return args.reduce((a, b) => a + b, 0);
      if (k.v === "MEDIA") return args.length ? args.reduce((a, b) => a + b, 0) / args.length : 0;
      throw new Error("função inválida");
    }
    if (k.t === "range") throw new Error("intervalo fora de função");
    throw new Error("sintaxe inválida");
  }
}

export interface EvalResult {
  display: string;
  error?: string;
  isFormula: boolean;
  numeric?: number;
}

const numericFromRaw = (raw: string): number => {
  if (raw == null || raw === "") return 0;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const formatNum = (n: number): string => {
  if (!Number.isFinite(n)) return "#ERRO";
  // Up to 4 decimals, strip trailing zeros
  return Math.abs(n - Math.round(n)) < 1e-9
    ? String(Math.round(n))
    : String(Number(n.toFixed(4)));
};

export function evaluateCell(
  raw: string,
  cells: CellsByRef,
  evaluating: Set<string> = new Set(),
  selfRef?: string,
): EvalResult {
  if (raw == null) return { display: "", isFormula: false };
  const s = String(raw);
  if (!s.startsWith("=")) {
    return { display: s, isFormula: false, numeric: numericFromRaw(s) };
  }
  if (selfRef && evaluating.has(selfRef)) {
    return { display: "#CICLO", error: "Referência circular", isFormula: true };
  }
  if (selfRef) evaluating.add(selfRef);
  try {
    const toks = tokenize(s.slice(1));
    const resolve: Resolver = (ref) => {
      const v = cells[ref];
      if (v == null || v === "") return 0;
      if (String(v).startsWith("=")) {
        const sub = evaluateCell(v, cells, evaluating, ref);
        if (sub.error) throw new Error(sub.error);
        return sub.numeric ?? 0;
      }
      return numericFromRaw(v);
    };
    const resolveRange = (from: string, to: string) => {
      const mFrom = /^([A-Z]+)(\d+)$/.exec(from);
      const mTo = /^([A-Z]+)(\d+)$/.exec(to);
      if (!mFrom || !mTo) throw new Error("intervalo inválido");
      const c1 = colIndex(mFrom[1]); const r1 = Number(mFrom[2]);
      const c2 = colIndex(mTo[1]);   const r2 = Number(mTo[2]);
      const cA = Math.min(c1, c2), cB = Math.max(c1, c2);
      const rA = Math.min(r1, r2), rB = Math.max(r1, r2);
      const out: number[] = [];
      for (let c = cA; c <= cB; c++) {
        for (let r = rA; r <= rB; r++) {
          out.push(resolve(colLetter(c) + r));
        }
      }
      return out;
    };
    const p = new Parser(toks, resolve, resolveRange);
    const v = p.parseExpr();
    if (p.i !== toks.length) throw new Error("tokens restantes");
    return { display: formatNum(v), numeric: v, isFormula: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { display: "#ERRO", error: msg, isFormula: true };
  } finally {
    if (selfRef) evaluating.delete(selfRef);
  }
}

// Build a flat CellsByRef map from columns + rows (1-based row index).
export interface TableColumn { id: string; label: string; kind?: "text" | "number" }
export interface TableRow { id: string; cells: Record<string, string> }
export interface TableData { columns: TableColumn[]; rows: TableRow[] }

export function buildCellMap(data: TableData): CellsByRef {
  const m: CellsByRef = {};
  data.rows.forEach((row, r) => {
    data.columns.forEach((col, c) => {
      const ref = colLetter(c) + (r + 1);
      m[ref] = row.cells[col.id] ?? "";
    });
  });
  return m;
}
