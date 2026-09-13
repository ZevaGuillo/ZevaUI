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
    it("derives one entry per registry component, client and server alike", () => {
      const budget = {
        entries: {
          Card: { maxGzipBytes: 838, measuredGzipBytes: 670 },
          Alert: { maxGzipBytes: 613, measuredGzipBytes: 490 },
          Button: { maxGzipBytes: 14_965, measuredGzipBytes: 13_604 },
        },
      };

      const entries = budgetEntries(registry, budget);

      expect(entries.map((entry) => entry.name)).toEqual(["Card", "Alert", "Button"]);
      // `clientOnly` picks the KIND, which is what selects the ceiling multiplier. It does not
      // decide whether the component is measured at all — that is what this gate got wrong.
      expect(entries.map((entry) => entry.kind)).toEqual(["server", "server", "client"]);
      // Derived, so what each entry measures comes from the registry rather than from a
      // hand-written list that could name something else, or nothing.
      expect(entries.map((entry) => entry.imports)).toEqual([["Card"], ["Alert"], ["Button"]]);
    });

    it("fails when a clientOnly:false component has no matching budget entry", () => {
      const budget = {
        entries: {
          Card: { maxGzipBytes: 838, measuredGzipBytes: 670 },
          // Alert is registered with clientOnly: false but has no budget entry.
          Button: { maxGzipBytes: 14_965, measuredGzipBytes: 13_604 },
        },
      };

      expect(() => budgetEntries(registry, budget)).toThrow(/Alert/);
    });

    // The regression this gate did not have. A client component was measured only if someone
    // hand-listed it in bundle-budget.json, so FORGETTING the entry was a silent skip instead of
    // a failure — and `Select` reached a pushed branch and an open PR unmeasured through exactly
    // this gap, while a server component in the same state would have failed the build.
    it("fails when a clientOnly:true component has no matching budget entry", () => {
      const budget = {
        entries: {
          Card: { maxGzipBytes: 838, measuredGzipBytes: 670 },
          Alert: { maxGzipBytes: 613, measuredGzipBytes: 490 },
          // Button is registered with clientOnly: true but has no budget entry.
        },
      };

      expect(() => budgetEntries(registry, budget)).toThrow(/Button/);
    });

    it("resolves the barrel, the one entry with no registry counterpart to derive from", () => {
      const budget = {
        entries: {
          Card: { maxGzipBytes: 838, measuredGzipBytes: 670 },
          Alert: { maxGzipBytes: 613, measuredGzipBytes: 490 },
          Button: { maxGzipBytes: 14_965, measuredGzipBytes: 13_604 },
          barrel: { imports: "*", maxGzipBytes: 62_534, measuredGzipBytes: 56_849 },
        },
      };

      const entries = budgetEntries(registry, budget);

      expect(entries.find((entry) => entry.name === "barrel")?.kind).toBe("barrel");
      expect(entries.find((entry) => entry.name === "barrel")?.imports).toBe("*");
    });

    it("fails on a stale entry with no derived counterpart and no explicit imports", () => {
      const budget = {
        entries: {
          Card: { maxGzipBytes: 838, measuredGzipBytes: 670 },
          Alert: { maxGzipBytes: 613, measuredGzipBytes: 490 },
          Button: { maxGzipBytes: 14_965, measuredGzipBytes: 13_604 },
          // Which is also what a component DELETED from the registry leaves behind, now that a
          // client entry no longer carries an `imports` list of its own to keep it alive.
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
