import { NextResponse } from "next/server";
import { getDb } from "../../../../../../db/client";
import { reportsForRepoQuery } from "../../../../../../db/queries";
import { serializeReport } from "../../../../../../reports/serialize";

// D4: GET /api/v1/reports/{owner}/{repo} -- public, one repository's apps
// (task 4.0, deferred from PR2 since the Panel is its first real consumer).
// Thin wiring; the query shape is unit-covered in db/queries.test.ts and
// serialization in reports/serialize.test.ts. This route's own test
// (__tests__/reports-by-repo-route.test.ts) calls GET directly.
type RouteContext = { readonly params: Promise<{ readonly owner: string; readonly repo: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { owner, repo } = await context.params;
  const rows = await reportsForRepoQuery(getDb(), `${owner}/${repo}`);
  return NextResponse.json(rows.map(serializeReport));
}
