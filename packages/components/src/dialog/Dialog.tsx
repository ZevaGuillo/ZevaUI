"use client";

import { useId } from "react";
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Button } from "../button/Button.js";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { dialogRecipe } from "./dialog.recipe.js";
import type { DialogProps } from "./dialog.types.js";

/**
 * `useDialog` only derives `aria-describedby` for `role="alertdialog"`, so a plain dialog has to
 * wire its own description. The id is generated rather than derived from content so it stays
 * stable across renders and unique across several dialogs on one page.
 */
export function Dialog({
  size,
  placement,
  title,
  description,
  footer,
  children,
  closeLabel = "Close",
  ...behaviour
}: DialogProps) {
  const slots = slotRecipeClassNames(dialogRecipe, { size, placement });
  const descriptionId = useId();

  return (
    <ModalOverlay {...behaviour} className={slots.overlay}>
      <Modal className={slots.modal}>
        <AriaDialog
          className={slots.content}
          aria-describedby={description === undefined ? undefined : descriptionId}
        >
          {({ close }) => (
            <>
              <div className={slots.header}>
                <Heading slot="title" className={slots.title}>
                  {title}
                </Heading>
                <Button visual="subtle" size="sm" onPress={close}>
                  {closeLabel}
                </Button>
                {description === undefined ? null : (
                  <p id={descriptionId} className={slots.description}>
                    {description}
                  </p>
                )}
              </div>
              <div className={slots.body}>{children}</div>
              {footer === undefined ? null : <div className={slots.footer}>{footer}</div>}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
