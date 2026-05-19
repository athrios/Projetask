import { describe, it, expect } from "vitest";
import { evaluateCell, buildCellMap, colLetter, colIndex } from "@/lib/sheetFormula";

describe("sheetFormula", () => {
  it("colLetter / colIndex", () => {
    expect(colLetter(0)).toBe("A");
    expect(colLetter(25)).toBe("Z");
    expect(colLetter(26)).toBe("AA");
    expect(colIndex("A")).toBe(0);
    expect(colIndex("AA")).toBe(26);
  });

  it("literal text", () => {
    expect(evaluateCell("hello", {}).display).toBe("hello");
  });

  it("arithmetic", () => {
    const c = { A1: "10", B1: "3" };
    expect(evaluateCell("=A1+B1", c).display).toBe("13");
    expect(evaluateCell("=A1-B1", c).display).toBe("7");
    expect(evaluateCell("=A1*B1", c).display).toBe("30");
    expect(evaluateCell("=A1/B1", c).display).toBe("3.3333");
  });

  it("SOMA / MEDIA range and aliases", () => {
    const c = { A1: "1", A2: "2", A3: "3" };
    expect(evaluateCell("=SOMA(A1:A3)", c).display).toBe("6");
    expect(evaluateCell("=SUM(A1:A3)", c).display).toBe("6");
    expect(evaluateCell("=MEDIA(A1:A3)", c).display).toBe("2");
    expect(evaluateCell("=AVERAGE(A1:A3)", c).display).toBe("2");
  });

  it("empty cell as zero", () => {
    expect(evaluateCell("=A1+5", {}).display).toBe("5");
  });

  it("cycle detection", () => {
    const c = { A1: "=A1+1" };
    const r = evaluateCell(c.A1, c, new Set(), "A1");
    expect(r.error).toBeTruthy();
  });

  it("invalid formula", () => {
    const r = evaluateCell("=SOMA(", {});
    expect(r.display).toBe("#ERRO");
  });

  it("buildCellMap", () => {
    const m = buildCellMap({
      columns: [{ id: "c1", label: "A" }, { id: "c2", label: "B" }],
      rows: [{ id: "r1", cells: { c1: "1", c2: "2" } }],
    });
    expect(m.A1).toBe("1");
    expect(m.B1).toBe("2");
  });
});
