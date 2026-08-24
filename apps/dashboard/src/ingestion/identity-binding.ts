// D1 IB rule + owner allowlist. `app` is a client-supplied label, never an
// identity; `repository`/`repositoryOwner` come from the verified OIDC
// claims. `app` is accepted only when it matches the authenticated repo's
// short name or its full "owner/repo" string -- any other value (including
// a DIFFERENT owner/repo-shaped string) is a spoofing attempt.
function repoShortName(repository: string): string {
  const slash = repository.lastIndexOf("/");
  return slash === -1 ? repository : repository.slice(slash + 1);
}

export type IdentityBindingOptions = {
  readonly app: string;
  readonly repository: string;
  readonly repositoryOwner: string;
  readonly allowedOwners: ReadonlySet<string>;
};

export type IdentityBindingResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: string;
      readonly message: string;
    };

export function checkIdentityBinding({
  app,
  repository,
  repositoryOwner,
  allowedOwners,
}: IdentityBindingOptions): IdentityBindingResult {
  if (!allowedOwners.has(repositoryOwner)) {
    return {
      ok: false,
      status: 403,
      code: "owner_not_allowed",
      message: `owner "${repositoryOwner}" is not in the allowlist`,
    };
  }
  if (app === repository || app === repoShortName(repository)) return { ok: true };
  return {
    ok: false,
    status: 403,
    code: "identity_mismatch",
    message: `app "${app}" does not match authenticated repository "${repository}"`,
  };
}
