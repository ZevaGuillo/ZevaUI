"use client";

import { Menu as AriaMenu, MenuItem, MenuTrigger, Popover, Text } from "react-aria-components";
import { Button } from "../button/Button.js";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { menuRecipe } from "./menu.recipe.js";
import type { MenuItemDescriptor, MenuProps } from "./menu.types.js";

/**
 * The trigger is part of the component, not something the consumer supplies. `MenuTrigger` wires
 * the button and the popover together through context, so leaving the button to the consumer
 * would put the DOM shape — and the menu's accessible name, which react-aria derives from the
 * trigger — back in their hands. RF-07 says it stays here.
 *
 * Disabled rows are declared through the menu's `disabledKeys` rather than each `MenuItem`'s own
 * `isDisabled`. Measured on react-aria 3.51.0: `useMenuItem` reads `props.isDisabled ??
 * selectionManager.isDisabled(key)`, so the per-item prop paints the row but only the collection
 * -level `disabledKeys` also makes arrow-key navigation skip it.
 */
export function Menu({ label, items, onAction, size, width, isDisabled, ...behaviour }: MenuProps) {
  const slots = slotRecipeClassNames(menuRecipe, { size, width });
  const disabledKeys = items.filter((item) => item.isDisabled === true).map((item) => item.id);

  return (
    <MenuTrigger {...behaviour}>
      <Button visual="subtle" isDisabled={isDisabled}>
        {label}
      </Button>
      <Popover className={slots.popover}>
        <AriaMenu
          className={slots.menu}
          items={items}
          disabledKeys={disabledKeys}
          onAction={(key) => onAction?.(String(key))}
        >
          {(item: MenuItemDescriptor) => (
            <MenuItem id={item.id} className={slots.item} textValue={item.label}>
              {/*
                `Text slot="label"` is not decoration: `useMenuItem` always points the row's
                `aria-labelledby` at the id it hands to that slot, so a bare string child would
                leave the row with a dangling reference and no accessible name at all.
              */}
              <Text slot="label" className={slots.itemLabel}>
                {item.label}
              </Text>
              {item.description === undefined ? null : (
                <Text slot="description" className={slots.itemDescription}>
                  {item.description}
                </Text>
              )}
            </MenuItem>
          )}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}
