import { describe, expect, it, vi } from "vitest";

// D4/task 4.0: GET /api/v1/reports/{owner}/{repo} -- direct function invocation,
// no live DB. Both db/client.js and db/queries.js are mocked so this test proves
// the route handler's own wiring (params -> repository string -> serialize),
// not the query builder or getDb() themselves (those are covered elsewhere).
const rows = [
  {
    repository: "acme/web",
    appLabel: "web",
    dsVersion: "1.4.0",
    dsVersionSource: "installed",
    components: ["Button"],
    deprecatedComponents: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
  },
];

vi.mock("../src/db/client.js", () => ({ getDb: () => "db-marker" }));
vi.mock("../src/db/queries.js", () => ({
  reportsForRepoQuery: vi.fn((db, repository) => {
    expect(db).toBe("db-marker");
    return Promise.resolve(repository === "acme/web" ? rows : []);
  }),
}));

const { GET } = await import("../src/app/api/v1/reports/[owner]/[repo]/route.js");

describe("GET /api/v1/reports/{owner}/{repo} (D4, task 4.0)", () => {
  it("serializes only the matching repository's latest reports", async () => {
    const response = await GET(new Request("http://localhost/api/v1/reports/acme/web"), {
      params: Promise.resolve({ owner: "acme", repo: "web" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        repository: "acme/web",
        app: "web",
        dsVersion: "1.4.0",
        dsVersionSource: "installed",
        components: ["Button"],
        deprecatedComponents: [],
        generatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("returns an empty array for a repository with no matching reports", async () => {
    const response = await GET(new Request("http://localhost/api/v1/reports/acme/none"), {
      params: Promise.resolve({ owner: "acme", repo: "none" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
