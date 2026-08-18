import { describe, expect, it } from "vitest";
import { budgetEntries, formatReport, verdict } from "../scripts/bundle-budget.js";

// A synthetic registry, not the real componentRegistry: this gate's pure logic is exercised
// against a small, stable fixture so the test never drifts when a real component is added or
// its clientOnly flag changes (see G8/G9 in manifest.test.ts for the contrast — those DO read
// the real registry because they verify the manifest mirrors it).
const registry = [
  { name: "Card", clientOnly: false },
  { name: "Alert", clientOnly: false },
  { name: "Button", clientOnly: true },
] as const;

describe("G10: the bundle-budget gate derives entries and enforces ceilings without a hand-maintained list", () => {
  describe("budgetEntries", () => {
    it("derives one entry per clientOnly:false registry component", () => {
      const budget = {
        entries: {
          Card: { maxGzipBytes: 838, measuredGzipBytes: 670 },
          Alert: { maxGzipBytes: 613, measuredGzipBytes: 490 },
        },
      };

      const entries = budgetEntries(registry, budget);

      expect(entries.map((entry) => entry.name)).toEqual(["Card", "Alert"]);
      expect(entries.every((entry) => entry.kind === "server")).toBe(true);
    });

    it("fails when a clientOnly:false component has no matching budget entry", () => {
      const budget = {
        entries: {
          Card: { maxGzipBytes: 838, measuredGzipBytes: 670 },
          // Alert is registered with clientOnly: false but has no budget entry.
        },
      };

      expect(() => budgetEntries(registry, budget)).toThrow(/Alert/);
    });

    it("resolves a declared entry carrying an explicit imports list, with no registry counterpart required", () => {
      const budget = {
        entries: {
          Card: { maxGzipBytes: 838, measuredGzipBytes: 670 },
          Alert: { maxGzipBytes: 613, measuredGzipBytes: 490 },
          Button: { imports: ["Button"], maxGzipBytes: 14_965, measuredGzipBytes: 13_604 },
          barrel: { imports: "*", maxGzipBytes: 62_534, measuredGzipBytes: 56_849 },
        },
      };

      const entries = budgetEntries(registry, budget);

      expect(entries.find((entry) => entry.name === "Button")?.kind).toBe("client");
      expect(entries.find((entry) => entry.name === "barrel")?.kind).toBe("barrel");
    });

    it("fails on a stale entry with no derived counterpart and no explicit imports", () => {
      const budget = {
        entries: {
          Card: { maxGzipBytes: 838, measuredGzipBytes: 670 },
          Alert: { maxGzipBytes: 613, measuredGzipBytes: 490 },
          Ghost: { maxGzipBytes: 1000, measuredGzipBytes: 900 },
        },
      };

      expect(() => budgetEntries(registry, budget)).toThrow(/Ghost/);
    });
  });

  describe("verdict", () => {
    // Card's ceiling at the +25% server multiplier (RF-QVB02): ceil(670 * 1.25) = 838.
    const cardEntry = { name: "Card", kind: "server", maxGzipBytes: 838, measuredGzipBytes: 670 };
    // Button's ceiling at the +10% client multiplier: ceil(13_604 * 1.10) = 14_965.
    const buttonEntry = {
      name: "Button",
      kind: "client",
      maxGzipBytes: 14_965,
      measuredGzipBytes: 13_604,
    };

    it("reports OK exactly at the +25% server ceiling", () => {
      const [row] = verdict([cardEntry], { Card: 838 });
      expect(row.status).toBe("OK");
      expect(row.deltaCeiling).toBe(0);
    });

    it("reports OVER one byte past the +25% server ceiling", () => {
      const [row] = verdict([cardEntry], { Card: 839 });
      expect(row.status).toBe("OVER");
      expect(row.deltaCeiling).toBe(1);
    });

    it("reports OK exactly at the +10% client ceiling", () => {
      const [row] = verdict([buttonEntry], { Button: 14_965 });
      expect(row.status).toBe("OK");
    });

    it("reports OVER one byte past the +10% client ceiling", () => {
      const [row] = verdict([buttonEntry], { Button: 14_966 });
      expect(row.status).toBe("OVER");
    });

    it("reports the delta against the recorded ledger, not only the ceiling", () => {
      const [row] = verdict([cardEntry], { Card: 700 });
      expect(row.deltaLedger).toBe(30);
      expect(row.deltaCeiling).toBe(-138);
    });
  });

  describe("formatReport", () => {
    it("renders one row per entry with entry, gzip, ceiling and status columns", () => {
      const rows = verdict(
        [
          { name: "Card", kind: "server", maxGzipBytes: 838, measuredGzipBytes: 670 },
          { name: "Button", kind: "client", maxGzipBytes: 14_965, measuredGzipBytes: 13_604 },
        ],
        { Card: 838, Button: 20_000 },
      );

      const report = formatReport(rows);
      const lines = report.split("\n");

      expect(lines[0]).toMatch(/entry/);
      expect(lines[0]).toMatch(/status/);
      expect(lines.some((line) => line.includes("Card") && line.includes("OK"))).toBe(true);
      expect(lines.some((line) => line.includes("Button") && line.includes("OVER"))).toBe(true);
    });
  });
});
