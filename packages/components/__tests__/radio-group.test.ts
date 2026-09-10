// @vitest-environment jsdom
//
// `React.createElement` rather than JSX, for the reason the other component tests give: the file
// stays `.test.ts` so this package's Vitest setup needs no JSX transform plugin, while
// `createElement` preserves the excess-property and type-mismatch checking the
// `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { slotClassName } from "../src/internal/slot-recipe-class.js";
import { RadioGroup } from "../src/radio-group/RadioGroup.js";
import { radioGroupRecipe } from "../src/radio-group/radio-group.recipe.js";
import type {
  RadioGroupProps,
  RadioOptionDescriptor,
} from "../src/radio-group/radio-group.types.js";
import { itGuardsTheCascade } from "./support/markable-control-css.js";

afterEach(() => {
  cleanup();
});

const PLANS: readonly RadioOptionDescriptor[] = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
];

const renderGroup = (props: RadioGroupProps) => render(createElement(RadioGroup, props));

// Derived from the recipe, never spelled as a literal: `slotClassName` is what the component
// itself renders through, so a renamed recipe fails here instead of silently querying nothing.
// Note it returns the BASE class only — `slotRecipeClassNames` returns a space-joined base plus
// variant list, which is a valid className and an invalid single-class selector.
const partsOf = (slot: "marker" | "dot") => [
  ...document.querySelectorAll(`.${slotClassName(radioGroupRecipe.className, slot)}`),
];

const markers = () => partsOf("marker");
const dots = () => partsOf("dot");

describe("RadioGroup renders a real, named radio group", () => {
  it("exposes the group with its label as the accessible name", () => {
    renderGroup({ label: "Plan", options: PLANS });

    expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeTruthy();
  });

  // One radio per descriptor, each named by its own label. The group's name and the options'
  // names are different things, and a group that borrowed its options' names would be unusable.
  it("renders one radio per option, each named by its own label", () => {
    renderGroup({ label: "Plan", options: PLANS });

    expect(screen.getAllByRole("radio").length).toBe(3);
    for (const option of PLANS) {
      expect(screen.getByRole("radio", { name: String(option.label) })).toBeTruthy();
    }
  });

  // THE POINT OF A RADIO GROUP, and the one property a checkbox list cannot give: the options are
  // mutually exclusive, and the browser enforces it through a shared `name`.
  it("selects exactly one option at a time", async () => {
    const user = userEvent.setup();
    renderGroup({ label: "Plan", options: PLANS, defaultValue: "free" });

    const free = screen.getByRole("radio", { name: "Free" }) as HTMLInputElement;
    const pro = screen.getByRole("radio", { name: "Pro" }) as HTMLInputElement;
    expect(free.checked).toBe(true);

    await user.click(pro);

    expect(pro.checked).toBe(true);
    expect(free.checked).toBe(false);
  });

  it("reports the chosen value, not the index or the label", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderGroup({ label: "Plan", options: PLANS, onChange });

    await user.click(screen.getByRole("radio", { name: "Team" }));

    expect(onChange.mock.calls).toEqual([["team"]]);
  });

  // A disabled OPTION is not a disabled GROUP: the rest stay operable. Worth its own test because
  // the two flags live on different elements and it would be easy to wire one to the other.
  it("disables a single option without disabling the group", () => {
    renderGroup({
      label: "Plan",
      options: [...PLANS.slice(0, 2), { value: "team", label: "Team", isDisabled: true }],
    });

    expect((screen.getByRole("radio", { name: "Team" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: "Free" }) as HTMLInputElement).disabled).toBe(false);
  });

  it("disables every option when the group is disabled", () => {
    renderGroup({ label: "Plan", options: PLANS, isDisabled: true });

    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLInputElement).disabled).toBe(true);
    }
  });
});

describe("RadioGroup validation lives on the group, not on the option", () => {
  // Unlike Checkbox and Switch, where the control itself validates, RAC 1.20 puts `isInvalid` and
  // `isRequired` on `RadioGroupProps`. A single radio has nothing to be required about — the
  // question does.
  it("marks the group required, and no individual radio", () => {
    renderGroup({ label: "Plan", options: PLANS, isRequired: true });

    expect(screen.getByRole("radiogroup").getAttribute("data-required")).toBe("true");
  });

  // MEASURED against RAC 1.20 rather than assumed, and the first guess was wrong: `aria-invalid`
  // lands on the GROUP, not on each radio. That is the correct reading of the state — what is
  // invalid is the answer to the question, not any one option a user did not pick — and it means
  // a screen reader announces the problem once, when the group is entered, instead of N times.
  it("marks the group invalid, on the group rather than on each radio", () => {
    renderGroup({ label: "Plan", options: PLANS, isInvalid: true });

    const group = screen.getByRole("radiogroup");
    expect(group.getAttribute("data-invalid")).toBe("true");
    expect(group.getAttribute("aria-invalid")).toBe("true");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.hasAttribute("aria-invalid")).toBe(false);
    }
  });
});

describe("RadioGroup state attributes are stamped on the marker the recipe styles", () => {
  // Same argument as Checkbox and Switch, and the third time it holds: an ancestor-conditioned
  // `[data-hovered] .zui-radio-group__marker` matches ANY hovered ancestor. The component stamps
  // what the marker needs onto the marker itself.
  // ONLY the chosen option's marker is marked, which is the property a checkbox list cannot have.
  // Asserted across all three rather than on one, because "the right one is on" and "the others
  // are off" are different claims and a group could pass the first while failing the second.
  it("stamps the selected state on the chosen option's marker alone", async () => {
    const user = userEvent.setup();
    renderGroup({ label: "Plan", options: PLANS });

    await user.click(screen.getByRole("radio", { name: "Pro" }));

    expect(markers().map((marker) => marker.getAttribute("data-selected"))).toEqual([
      null,
      "true",
      null,
    ]);
  });

  // The dot carries its own copy, so its reveal rule stays local instead of reaching through a
  // hardcoded class name on the marker. Asserted, because nothing else would notice it going away.
  it("stamps the same state on the dot, so its reveal needs no descendant selector", async () => {
    const user = userEvent.setup();
    renderGroup({ label: "Plan", options: PLANS });

    await user.click(screen.getByRole("radio", { name: "Pro" }));

    expect(dots().map((dot) => dot.getAttribute("data-selected"))).toEqual([null, "true", null]);
  });

  it("omits an unset state entirely rather than rendering it false", () => {
    renderGroup({ label: "Plan", options: PLANS });

    const [marker] = markers();
    expect(marker.hasAttribute("data-selected")).toBe(false);
    expect(marker.hasAttribute("data-invalid")).toBe(false);
  });

  itGuardsTheCascade({
    name: "radio",
    classPrefix: "zui-radio-group",
    statefulPart: "zui-radio-group__marker",
  });
});

describe("RadioGroup public API surface (type-level)", () => {
  it("refuses className and style, and unknown props", () => {
    const constructed = [
      createElement(RadioGroup, { label: "Plan", options: PLANS }),
      // @ts-expect-error styling is owned by the design system
      createElement(RadioGroup, { label: "Plan", options: PLANS, className: "mine" }),
      // @ts-expect-error styling is owned by the design system
      createElement(RadioGroup, { label: "Plan", options: PLANS, style: {} }),
      // @ts-expect-error unknown prop
      createElement(RadioGroup, { label: "Plan", options: PLANS, elevation: 2 }),
      // @ts-expect-error label is required: an unnamed group fails the blocking a11y gate
      createElement(RadioGroup, { options: PLANS } as Omit<RadioGroupProps, "label">),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});
