import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("fa-mentoring auth and routing", () => {
  it("returns service metadata for root", async () => {
    const response = await worker.fetch(new Request("https://example.com/"), {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("fa-mentoring-api");
  });

  it("protects secured routes when static bearer auth is enabled", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/regulations"), {
      AUTH_PROVIDER: "static-bearer",
      AUTH_STATIC_TOKENS_JSON: JSON.stringify([
        { token: "mentor-token", subject: "mentor-1", roles: ["faculty"] }
      ])
    });
    expect(response.status).toBe(401);
  });

  it("returns principal for valid bearer token", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/api/auth/me", {
        headers: {
          authorization: "Bearer admin-token"
        }
      }),
      {
        AUTH_PROVIDER: "static-bearer",
        AUTH_STATIC_TOKENS_JSON: JSON.stringify([
          { token: "admin-token", subject: "admin-1", roles: ["admin"], permissions: ["*"] }
        ])
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      principal: { subject: string; roles: string[]; provider: string };
    };
    expect(body.ok).toBe(true);
    expect(body.principal.subject).toBe("admin-1");
    expect(body.principal.roles).toContain("admin");
  });
});
