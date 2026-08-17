import { describe, expect, it } from "vitest";
import {
  emittedSlotClassNames,
  slotClassName,
  slotRecipeClassNames,
} from "../src/internal/slot-recipe-class.js";

// Mirrors the two-slot spike run against real Panda 1.12.0 (see the module comment for the
// verbatim selector list). Every expectation below is that measured output with the spike's
// `zui-x` renamed to `zui-fixture`, so a Panda behaviour change surfaces here, not in a
// component. No real component is registered for this: the conventions are what is under test.
const slotFixture = {
  className: "zui-fixture",
  slots: ["root", "input", "label"],
  base: {
    root: { display: "flex" },
    input: { borderWidth: "1px" },
    // `label` declares no base styles on purpose: Panda emits no `.zui-fixture__label` rule.
  },
  variants: {
    // Styles ONE slot only.
    size: {
      sm: { input: { padding: "2px" } },
      md: { input: { padding: "4px" } },
    },
    // Styles two of the three slots.
    visual: {
      solid: { root: { background: "red" }, label: { color: "white" } },
      subtle: { root: { background: "blue" }, label: { color: "black" } },
    },
    // Per-VALUE asymmetry: `on` styles `input`, `off` styles `label`.
    invalid: {
      on: { input: { borderColor: "red" } },
      off: { label: { fontStyle: "italic" } },
    },
  },
  defaultVariants: { size: "md", visual: "solid" },
};

// An empty per-slot style object emits no rule (measured), so it must emit no class either.
const emptyStyleFixture = {
  className: "zui-fixture",
  slots: ["root", "input"],
  base: { root: { display: "flex" }, input: { borderWidth: "1px" } },
  variants: {
    invalid: {
      on: { root: {}, input: { borderColor: "red" } },
    },
  },
};

describe("slotClassName", () => {
  it("joins base and slot with the Panda slot convention", () => {
    expect(slotClassName("zui-input", "label")).toBe("zui-input__label");
  });
});

describe("slotRecipeClassNames", () => {
  it("applies default variants only to the slots each value actually styles", () => {
    expect(slotRecipeClassNames(slotFixture, {})).toEqual({
      root: "zui-fixture__root zui-fixture__root--visual_solid",
      input: "zui-fixture__input zui-fixture__input--size_md",
      label: "zui-fixture__label zui-fixture__label--visual_solid",
    });
  });

  it("always returns the base class of every slot, including a slot with no styles at all", () => {
    const classNames = slotRecipeClassNames(slotFixture, {});
    for (const slot of slotFixture.slots) {
      expect(classNames[slot].split(" ")).toContain(`zui-fixture__${slot}`);
    }
  });

  it("lets an explicit selection override the default for that axis", () => {
    expect(slotRecipeClassNames(slotFixture, { visual: "subtle", size: "lg" })).toEqual({
      root: "zui-fixture__root zui-fixture__root--visual_subtle",
      // `lg` is not a declared value, so it emits no rule and must emit no class.
      input: "zui-fixture__input",
      label: "zui-fixture__label zui-fixture__label--visual_subtle",
    });
  });

  it("filters per value, not per axis: two values of one axis can style different slots", () => {
    expect(slotRecipeClassNames(slotFixture, { invalid: "on" }).input).toBe(
      "zui-fixture__input zui-fixture__input--size_md zui-fixture__input--invalid_on",
    );
    expect(slotRecipeClassNames(slotFixture, { invalid: "on" }).label).toBe(
      "zui-fixture__label zui-fixture__label--visual_solid",
    );
    expect(slotRecipeClassNames(slotFixture, { invalid: "off" }).label).toBe(
      "zui-fixture__label zui-fixture__label--visual_solid zui-fixture__label--invalid_off",
    );
    expect(slotRecipeClassNames(slotFixture, { invalid: "off" }).input).toBe(
      "zui-fixture__input zui-fixture__input--size_md",
    );
  });

  it("emits no class for a slot whose style object is declared but empty", () => {
    expect(slotRecipeClassNames(emptyStyleFixture, { invalid: "on" })).toEqual({
      root: "zui-fixture__root",
      input: "zui-fixture__input zui-fixture__input--invalid_on",
    });
  });

  it("orders class names by variant declaration order, not by selection insertion order", () => {
    const first = slotRecipeClassNames(slotFixture, { invalid: "on", size: "sm" });
    const second = slotRecipeClassNames(slotFixture, { size: "sm", invalid: "on" });
    expect(first).toEqual(second);
    expect(first.input).toBe(
      "zui-fixture__input zui-fixture__input--size_sm zui-fixture__input--invalid_on",
    );
  });
});

describe("emittedSlotClassNames", () => {
  it("lists exactly the class names Panda emits a rule for", () => {
    expect(emittedSlotClassNames(slotFixture)).toEqual([
      "zui-fixture__root",
      "zui-fixture__input",
      "zui-fixture__input--size_sm",
      "zui-fixture__input--size_md",
      "zui-fixture__root--visual_solid",
      "zui-fixture__label--visual_solid",
      "zui-fixture__root--visual_subtle",
      "zui-fixture__label--visual_subtle",
      "zui-fixture__input--invalid_on",
      "zui-fixture__label--invalid_off",
    ]);
  });

  it("omits the base class of a slot that declares no base styles", () => {
    expect(emittedSlotClassNames(slotFixture)).not.toContain("zui-fixture__label");
  });

  it("omits a per-slot style object that is declared but empty", () => {
    expect(emittedSlotClassNames(emptyStyleFixture)).toEqual([
      "zui-fixture__root",
      "zui-fixture__input",
      "zui-fixture__input--invalid_on",
    ]);
  });

  // The manifest advertises emitted selectors; the runtime additionally hands the DOM a stable
  // structural hook per slot. The difference is exactly the unstyled slots' base classes.
  it("is a subset of what the runtime renders, differing only by unstyled slot hooks", () => {
    const rendered = new Set(
      Object.values(slotRecipeClassNames(slotFixture, {})).flatMap((value) => value.split(" ")),
    );
    for (const className of emittedSlotClassNames(slotFixture)) {
      if (className.includes("--")) continue;
      expect(rendered.has(className)).toBe(true);
    }
    expect(rendered.has("zui-fixture__label")).toBe(true);
  });
});
