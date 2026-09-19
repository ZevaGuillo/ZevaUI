"use client";

import {
  Dialog as AriaDialog,
  Popover as AriaPopover,
  DialogTrigger,
  Heading,
} from "react-aria-components";
import { Button } from "../button/Button.js";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { popoverRecipe } from "./popover.recipe.js";
import type { PopoverProps } from "./popover.types.js";

/**
 * The trigger is part of the component, not something the consumer supplies — the same call
 * `Menu.tsx` makes and for the same mechanical reason: `DialogTrigger` wires the button and the
 * panel together through context, so leaving the button to the consumer would put the DOM shape
 * back in their hands. RF-07 says it stays here.
 *
 * A `role="dialog"` INSIDE A POPOVER IS NOT A MODAL, AND THE DIFFERENCE IS WHAT THIS COMPONENT IS
 * FOR. `Dialog` goes through `ModalOverlay`, which takes the page out of the accessibility tree
 * and traps focus until it closes. This goes through `Popover`, which does neither: the page stays
 * readable and clickable behind the panel, Escape and an outside click dismiss it, and focus
 * returns to the trigger. Use `Dialog` when the answer is required before anything else can
 * happen; use this when it is not.
 *
 * `Heading slot="title"` is not decoration. react-aria's `Dialog` derives `aria-labelledby` from
 * whatever it finds in that slot, so a bare `<h2>` — or a title rendered anywhere else in the tree
 * — would leave the panel with a dangling reference and no accessible name at all, which is the
 * same trap `Menu.tsx` documents for `Text slot="label"`.
 */
export function Popover({
  label,
  title,
  children,
  size,
  placement,
  isDisabled,
  ...behaviour
}: PopoverProps) {
  const slots = slotRecipeClassNames(popoverRecipe, { size });

  return (
    <DialogTrigger {...behaviour}>
      <Button visual="subtle" isDisabled={isDisabled}>
        {label}
      </Button>
      <AriaPopover placement={placement} className={slots.popover}>
        <AriaDialog className={slots.dialog}>
          <Heading slot="title" className={slots.title}>
            {title}
          </Heading>
          <div className={slots.body}>{children}</div>
        </AriaDialog>
      </AriaPopover>
    </DialogTrigger>
  );
}
