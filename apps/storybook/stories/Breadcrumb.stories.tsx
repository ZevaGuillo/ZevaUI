import type { Meta, StoryObj } from "@storybook/react-vite";
import { Breadcrumb } from "@zevaui/components";
import { expect, within } from "storybook/test";

// Every story here ends in a crumb that is NOT a link, which is the whole point of the component's
// shape: the ancestors and the current page are separate props, so a trail that links to the page
// you are already on cannot be written. `CurrentPageIsNotALink` asserts it rather than showing it.
const meta = {
  title: "Breadcrumb",
  component: Breadcrumb,
  tags: ["visual"],
  args: {
    items: [
      { id: "home", label: "Home", href: "/" },
      { id: "projects", label: "Projects", href: "/projects" },
    ],
    current: "Alpha release",
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// A top-level page has a trail of exactly one crumb: itself. Still a landmark, still a list, still
// carrying `aria-current` — there is simply nothing above it, and no separator to draw.
export const TopLevelPage: Story = {
  args: { items: [], current: "Dashboard" },
};

export const DeepHierarchy: Story = {
  args: {
    items: [
      { id: "home", label: "Home", href: "/" },
      { id: "org", label: "Acme Inc", href: "/acme" },
      { id: "projects", label: "Projects", href: "/acme/projects" },
      { id: "alpha", label: "Alpha", href: "/acme/projects/alpha" },
      { id: "releases", label: "Releases", href: "/acme/projects/alpha/releases" },
    ],
    current: "v2.4.0",
  },
};

/**
 * The baseline that would catch the regression a default-width screenshot never can: a deep trail
 * in a narrow container has to WRAP, not push the page sideways. `flex-wrap: wrap` on the list is
 * the one declaration under test, and its absence makes a breadcrumb the thing that gives a layout
 * a horizontal scrollbar at exactly one viewport width.
 */
export const WrapsInANarrowColumn: Story = {
  args: {
    items: [
      { id: "home", label: "Home", href: "/" },
      { id: "org", label: "Acme Inc", href: "/acme" },
      { id: "projects", label: "Projects", href: "/acme/projects" },
      { id: "alpha", label: "Alpha release planning", href: "/acme/projects/alpha" },
    ],
    current: "Sprint 14 retrospective",
  },
  render: (args) => (
    <div style={{ inlineSize: "18rem" }}>
      <Breadcrumb {...args} />
    </div>
  ),
};

// The landmark can be renamed — to localise it, or to tell two trails on one page apart. It is the
// `<nav>`'s accessible name and is never drawn.
export const LocalisedLandmark: Story = {
  args: { label: "Ruta de navegación", current: "Versión Alpha" },
};

/**
 * THE GATE THIS COMPONENT'S API EXISTS FOR, asserted rather than illustrated.
 *
 * A hand-rolled trail almost always links its last crumb to the page the user is already on: a
 * screen reader announces it as a link, a sighted user clicks it to no effect. The conventional
 * single-`items` shape — which is how react-aria-components models it — permits exactly that.
 * Splitting the ancestors from the current page makes it unrepresentable, and this proves the
 * split reaches the DOM rather than stopping at the type.
 */
export const CurrentPageIsNotALink: Story = {
  tags: ["!visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Two ancestors, two links — never three.
    await expect(canvas.getAllByRole("link")).toHaveLength(2);
    await expect(canvas.queryByRole("link", { name: "Alpha release" })).toBeNull();

    const current = canvas.getByText("Alpha release");
    await expect(current).toHaveAttribute("aria-current", "page");

    // And the separators are drawn for the eye only: the trail reads "Home, Projects, Alpha
    // release", never "Home slash Projects slash Alpha release".
    const nav = canvas.getByRole("navigation", { name: "Breadcrumb" });
    await expect(nav.textContent).toContain("/");
    for (const separator of nav.querySelectorAll(".zui-breadcrumb__separator")) {
      await expect(separator).toHaveAttribute("aria-hidden", "true");
    }
  },
};
