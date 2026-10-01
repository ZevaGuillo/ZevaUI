// D5/D3: renders BOTH the computed deprecated-in-use (always known -- see
// panel/deprecated-logic.ts) and the report's own self-reported
// `deprecatedComponents` as a provenance cross-check. `null` (unknown) and
// `[]` (known-none) render as visibly different states, distinguished by
// text AND a `data-provenance` attribute -- never collapsed together (D3
// provenance honesty). Every consumer-supplied name renders through React's
// own `{value}` auto-escaping, never as markup (Threat Matrix: poisoned
// report XSS).
//
// NO "use client" HERE, AND THAT IS WORTH CONTRASTING WITH `versions-view.tsx`.
// That file is a client component for one specific reason: `Table` is
// `clientOnly` and its column descriptors carry `cell` FUNCTIONS, which cannot
// cross the RSC boundary. `Card` is `clientOnly: false` and carries no directive
// of its own (see packages/components/src/card/Card.tsx), so composing it keeps
// this a server component that ships no JavaScript at all.
//
// NOT A TABLE, AND THAT IS THE DESIGN'S CALL RATHER THAN A SHORTCUT. Two facts
// per app with three possible geometries on one side is not a grid of cells; the
// design gives each app its own grouped panel so the two sources can sit side by
// side under their own headings. A `<table>` would also have to answer what the
// hatch state means in a cell, and the answer is "nothing a cell can carry".
import { Card } from "@zevaui/components";
import { crossCheckDeprecated, type DeprecatedCrossCheck } from "./deprecated-logic";

/**
 * The self-reported side, and the reason this component exists at all.
 *
 * THREE STATES, THREE GEOMETRIES -- a filled area, an empty line, and a plain
 * list. Not three colours and not three greys: a shape survives greyscale, a
 * colour-blind reader and a black-and-white printout, and the geometry itself
 * lives in globals.css keyed off the same `data-provenance` attribute the tests
 * assert, so what the eye reads and what the test checks are one thing.
 *
 * The hatch for `null` is the only texture in the design, and it is deliberately
 * not a grey box: a grey box reads as "empty", which is precisely the collapse of
 * "unknown" into "none" that ADR-0011 D5 exists to prevent.
 */
type ReportedFieldProps = { readonly value: readonly string[] | null };

function ReportedField({ value }: ReportedFieldProps) {
  if (value === null) {
    return <span data-provenance="unknown">unknown &middot; not reported</span>;
  }
  if (value.length === 0) {
    return <span data-provenance="known-none">none reported &middot; measured zero</span>;
  }
  return (
    <ul className="debt__names" data-provenance="known">
      {value.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}

/**
 * What the cross-check found, as a sentence rather than a chip.
 *
 * A chip cannot hold a claim about two sources, and this is a claim: it names
 * which source saw what. `text-danger` only when they actually disagree --
 * "cannot be cross-checked" is an absence, not a failure, so it stays muted.
 * ADR-0014 risk 3 predicts the disagreement, so naming it is the feature.
 */
function Verdict({ check }: { readonly check: DeprecatedCrossCheck }) {
  if (check.kind === "unavailable") {
    return (
      <p className="debt__verdict" data-verdict="unavailable">
        Computed and self-report cannot be cross-checked here &mdash; the self-report is absent, not
        empty.
      </p>
    );
  }
  if (check.kind === "agrees") {
    return (
      <p className="debt__verdict" data-verdict="agrees">
        Self-report agrees with the computed set.
      </p>
    );
  }
  return (
    <p className="debt__verdict" data-verdict="diverges">
      The two sources disagree.
      {check.computedOnly.length > 0
        ? ` The manifest computes ${check.computedOnly.join(", ")}, which the app did not report.`
        : ""}
      {check.reportedOnly.length > 0
        ? ` The app reports ${check.reportedOnly.join(", ")}, which the manifest does not mark deprecated.`
        : ""}
    </p>
  );
}

// `reportedDeprecated: readonly string[] | null` is load-bearing (D3): null
// means "unknown", [] means "known-none". Never collapse this to
// `readonly string[]` with a default -- the whole point of ReportedField
// above is rendering these two states distinctly.
export type DeprecatedEntry = {
  readonly repository: string;
  readonly app: string;
  readonly deprecatedInUse: readonly string[];
  readonly reportedDeprecated: readonly string[] | null;
};

export type DeprecatedViewProps = { readonly entries: readonly DeprecatedEntry[] };

/**
 * NO EXPIRY COUNTDOWN, NO "OVERDUE", NO REPLACEMENT NAME, and that is a data
 * gap rather than an omission. The design's panel shows "expires in 67d",
 * "overdue 12d" and "use Menu instead" beside each computed name. None of the
 * three has a source: the build-time manifest carries `name`, `className`,
 * `clientOnly`, `import`, `slots`, `variants`, `classNames` and `tokens` and no
 * deprecation metadata at all, so `deprecatedNamesFromManifest` has nothing to
 * read a date or a replacement from. Rendering any of them would mean inventing
 * arithmetic, which is worse than a screen that shows less. It goes in the ADR
 * beside the `Table` grouping gap.
 */
export function DeprecatedView({ entries }: DeprecatedViewProps) {
  if (entries.length === 0) {
    return <p>No reports yet.</p>;
  }
  return (
    <div className="group-stack">
      {entries.map((entry) => (
        /* `surface="outlined"`, AND THE LIBRARY MAKES THIS AN EITHER/OR.
           `Card`'s `surface` axis is one-of: `elevated` adds `shadow.card` and no
           edge, `outlined` adds a 1px `border.default` edge and no shadow
           (packages/components/src/card/card.recipe.ts). The design's E1 group
           wants BOTH -- a boundary with additive depth on top of it -- and no
           combination of the two values expresses that. `outlined` wins because
           the design's own principle is that the boundary is load-bearing and the
           shadow is decoration: with only one available, keep the boundary. The
           missing depth goes in the ADR beside the `Badge` border gap, and is NOT
           faked with a wrapper div -- `Card` is sealed (`className: never`,
           `style: never`) and a hand-rolled surface around it is exactly the
           replica this change deleted.

           Two smaller things taken from the library rather than fought: the radius
           is `radius.card` (8px) where the replica used `radius-xl` (12px), and the
           root is a `<div>` rather than the `<section>` this used to be -- a
           `<section>` with no accessible name is a generic element to assistive
           technology, so nothing is lost but the source's shape. */
        <Card key={`${entry.repository}:${entry.app}`} surface="outlined">
          {/* Repository and app together, because neither identifies an entry
              alone: one repository reports many apps, and the same app label
              appears across repositories. */}
          <Card.Header>
            <h2 className="group-title">
              {entry.repository} / {entry.app}
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="debt__columns">
              {/* `data-computed`, NOT `data-provenance`, and the distinction is
                  the contract rather than naming taste. `data-provenance` answers
                  "how much do we know about this value", and the computed side has
                  no such question: it is intersected from the manifest and a
                  report's own component list, both always present, so it is
                  ALWAYS known. Marking it `data-provenance` too would make the
                  attribute mean "a source" instead of "a provenance state" -- and
                  it did: an earlier spelling of this file carried
                  `data-provenance="computed-none"` here, which made
                  `querySelector("[data-provenance]")` return the computed side and
                  collapsed the null-vs-[] test into comparing "none" with itself.
                  The test caught it. The attribute belongs to the self-report. */}
              <div className="debt__source">
                <p className="debt__source-label">Computed &mdash; from manifest</p>
                {entry.deprecatedInUse.length === 0 ? (
                  <span data-computed="none">none</span>
                ) : (
                  <ul className="debt__names" data-computed="known">
                    {entry.deprecatedInUse.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="debt__source">
                <p className="debt__source-label">Self-reported</p>
                <ReportedField value={entry.reportedDeprecated} />
              </div>
            </div>
            <Verdict
              check={crossCheckDeprecated(entry.deprecatedInUse, entry.reportedDeprecated)}
            />
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}
