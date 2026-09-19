import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "@zevaui/components";
import { expect, within } from "storybook/test";

// EVERY STORY THAT DRAWS INITIALS IS LOAD-BEARING RATHER THAN ILLUSTRATIVE, the same way
// Badge.stories.tsx is. The initials are `text.default` on `bg.muted`, and `@zevaui/constraints`
// deliberately does not gate that pair — `contract.test.ts` asserts by name that no text pair
// references `color-bg-muted`, because widening it would constrain tokens ADR-0020 depends on
// being free. So the only contrast evidence this component has is axe's `color-contrast` rule
// running over these stories in real Chromium, in all three themes.
//
// The images are data URIs, not remote URLs: a visual baseline that depends on a network fetch is
// a baseline that fails on a bad connection, and `BrokenImage` below needs a source that is
// reliably broken rather than merely slow.
const PORTRAIT =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MCA4MCI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjMjU2M2ViIi8+PGNpcmNsZSBjeD0iNDAiIGN5PSIzMCIgcj0iMTQiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMTAgODBjMC0xNyAxMy0yNiAzMC0yNnMzMCA5IDMwIDI2eiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==";

const meta = {
  title: "Avatar",
  component: Avatar,
  tags: ["visual"],
  args: { name: "Ana Beltrán" },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

// The normal appearance, not the degraded one: most people in most systems have no photo, so the
// initials are what this component usually looks like and the photograph is the enhancement.
export const Initials: Story = {};

export const WithPhoto: Story = {
  args: { src: PORTRAIT },
};

export const Small: Story = {
  args: { size: "sm" },
};

export const Large: Story = {
  args: { size: "lg" },
};

// Conventionally people are circles and organisations are squared off. Nothing enforces that —
// it is a convention rather than a rule, and not the same convention everywhere.
export const Rounded: Story = {
  args: { shape: "rounded", name: "Acme Inc" },
};

/**
 * THE BASELINE THAT HOLDS THE ONE MEASUREMENT THIS COMPONENT'S DESIGN RESTS ON — AND THE ONE THAT
 * ALREADY CAUGHT IT BEING WRONG ONCE.
 *
 * Every other design system swaps a broken avatar for its initials in an `onError` handler, which
 * makes the component stateful and therefore client-only — in the component that appears in
 * server-rendered lists of people more than anything else in this package. This one instead layers
 * the photograph over an always-present fallback, so a source that does not resolve reveals the
 * monogram with no state change.
 *
 * The first implementation did that with an `<img alt="">`, on the claim that a failed source
 * paints nothing. This story was written to hold that claim and the very first baseline it
 * produced refuted it: Chromium drew its broken-image glyph in the top-left of the circle, on top
 * of the monogram. `alt=""` suppresses the alt TEXT, not the indicator.
 *
 * The photograph is now a `background-image` on a `<span>`, which has no failure rendering at all —
 * not as an engine behaviour that could change, but because there is no replaced element for a
 * user agent to draw a placeholder for. This baseline is what would catch a regression back to the
 * refuted shape, and the `play` function asserts the accessible name independently of anything
 * that is drawn.
 */
export const BrokenImage: Story = {
  args: { name: "Bruno Castro", src: "data:image/png;base64,not-a-real-image" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const avatar = canvas.getByRole("img", { name: "Bruno Castro" });

    // The name survives whatever happened to the pixels.
    await expect(avatar).toHaveAttribute("aria-label", "Bruno Castro");
    // And the fallback was in the DOM the whole time, never swapped in after a failure.
    await expect(avatar.textContent).toBe("BC");
  },
};

// The row that would catch a `flex-shrink` regression: a circle that shrinks is an ellipse, and an
// avatar in a crowded flex row is the first thing squashed. That defect appears only under
// pressure, which is why the container here is narrower than its contents want.
export const InACrowdedRow: Story = {
  args: { size: "sm" },
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", inlineSize: "14rem" }}>
      <Avatar size="sm" name="Ana Beltrán" src={PORTRAIT} />
      <Avatar size="sm" name="Bruno Castro" />
      <Avatar size="sm" name="Carla Díaz" />
      <span style={{ minInlineSize: 0, overflow: "hidden" }}>
        and eleven other people on this thread
      </span>
    </div>
  ),
};

// No baseline: nothing new is drawn. This is the monogram's edge cases in one place, where a
// reviewer can see what each name reduces to.
export const NameEdgeCases: Story = {
  tags: ["!visual"],
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <Avatar name="Prince" />
      <Avatar name="Ana María Beltrán Ruiz" />
      <Avatar name="  Ana   Beltrán  " />
      <Avatar name="李 明" />
    </div>
  ),
};
