import { NextResponse } from "next/server";

// D4: public liveness check. Deliberately touches no DB -- a dead database
// must not also make the health probe itself hang or 500.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
