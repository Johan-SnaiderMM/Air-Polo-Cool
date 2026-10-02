import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  it("bloquea todo el sitio a todos los rastreadores (es una aplicación privada)", () => {
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });
});
