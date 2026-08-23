import { describe, expect, it } from "vitest";
import { checkIdentityBinding } from "../src/ingestion/identity-binding.js";

// D1 IB rule + owner allowlist. `app` is a client-supplied label, never an
// identity; `repository`/`repositoryOwner` come from the verified OIDC claims.
const allowedOwners = new Set(["octo-org"]);

describe("checkIdentityBinding (D1)", () => {
  it.each([
    ["the repo's short name", "web", "octo-org/web", "octo-org"],
    ["the full owner/repo string", "octo-org/web", "octo-org/web", "octo-org"],
  ])("accepts app matching %s", (_label, app, repository, repositoryOwner) => {
    expect(checkIdentityBinding({ app, repository, repositoryOwner, allowedOwners })).toEqual({
      ok: true,
    });
  });

  it("rejects app mismatch as identity_mismatch (RF-AR02 scenario 1)", () => {
    const result = checkIdentityBinding({
      app: "mobile",
      repository: "octo-org/web",
      repositoryOwner: "octo-org",
      allowedOwners,
    });
    expect(result).toMatchObject({ ok: false, status: 403, code: "identity_mismatch" });
  });

  it("rejects a different owner/repo-shaped app as identity_mismatch (spoofing)", () => {
    const result = checkIdentityBinding({
      app: "octo-org/other-repo",
      repository: "octo-org/web",
      repositoryOwner: "octo-org",
      allowedOwners,
    });
    expect(result).toMatchObject({ ok: false, status: 403, code: "identity_mismatch" });
  });

  it("rejects an owner outside the allowlist as owner_not_allowed", () => {
    const result = checkIdentityBinding({
      app: "web",
      repository: "foreign-org/web",
      repositoryOwner: "foreign-org",
      allowedOwners,
    });
    expect(result).toMatchObject({ ok: false, status: 403, code: "owner_not_allowed" });
  });
});
