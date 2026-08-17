// Order matters: `@zevaui/components/styles.css` is a chain of
// `var(--zui-*)` pointers (see ADR-0004 D2) that only resolve once the
// token layer's custom properties exist. Reversing this import order ships
// components with unresolved CSS variables.
import "@zevaui/tokens/styles.css";
import "@zevaui/components/styles.css";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    // Any axe violation fails the story's test — this is the gate G-A11Y
    // relies on. See apps/storybook/scripts/assert-gate-fails.js.
    a11y: { test: "error" },
  },
};

export default preview;
