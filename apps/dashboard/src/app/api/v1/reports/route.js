import { NextResponse } from "next/server";
import { getDb } from "../../../../db/client.js";
import { allLatestReportsQuery } from "../../../../db/queries.js";
import { serializeReport } from "../../../../reports/serialize.js";

// D4: GET /api/v1/reports -- public. Thin wiring; query/response shapes
// are unit-covered in db/queries.test.ts and reports/serialize.test.ts.
export async function GET() {
  const rows = await allLatestReportsQuery(getDb());
  return NextResponse.json(rows.map(serializeReport));
}
