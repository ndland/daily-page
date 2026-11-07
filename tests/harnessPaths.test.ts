import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isAllowedHost, isCrossSite, resolveRequest } from "../harness/paths.mjs";

const ROOT = resolve("some", "daily-page");

describe("resolveRequest", () => {
  it("serves the harness page and the plugin stylesheet", () => {
    expect(resolveRequest(ROOT, "/harness/index.html")).toBe(join(ROOT, "harness", "index.html"));
    expect(resolveRequest(ROOT, "/styles/daily-page.css")).toBe(join(ROOT, "styles", "daily-page.css"));
    expect(resolveRequest(ROOT, "/harness/dist/harness.js")).toBe(join(ROOT, "harness", "dist", "harness.js"));
  });

  it("refuses folders other than the harness and styles, such as source and git metadata", () => {
    expect(resolveRequest(ROOT, "/src/main.ts")).toBeNull();
    expect(resolveRequest(ROOT, "/.git/config")).toBeNull();
    expect(resolveRequest(ROOT, "/package-lock.json")).toBeNull();
  });

  it("refuses dotfiles and dot-folders inside a served folder", () => {
    expect(resolveRequest(ROOT, "/harness/.env")).toBeNull();
    expect(resolveRequest(ROOT, "/styles/.git/HEAD")).toBeNull();
  });

  it("refuses paths that climb out of the served folders, including into a sibling folder", () => {
    expect(resolveRequest(ROOT, "/harness/../../daily-page-old/secret.txt")).toBeNull();
    expect(resolveRequest(ROOT, "/styles/../../secret.txt")).toBeNull();
  });
});

describe("isAllowedHost", () => {
  it("accepts localhost and 127.0.0.1 on the server's port", () => {
    expect(isAllowedHost("127.0.0.1:5173", 5173)).toBe(true);
    expect(isAllowedHost("localhost:5173", 5173)).toBe(true);
  });

  it("refuses other host names, other ports, and a missing header, which rebinding relies on", () => {
    expect(isAllowedHost("attacker.example:5173", 5173)).toBe(false);
    expect(isAllowedHost("127.0.0.1:8080", 5173)).toBe(false);
    expect(isAllowedHost(undefined, 5173)).toBe(false);
  });
});

describe("isCrossSite", () => {
  it("refuses requests another site made, and allows the harness own pages and direct visits", () => {
    expect(isCrossSite("cross-site")).toBe(true);
    expect(isCrossSite("same-origin")).toBe(false);
    expect(isCrossSite("none")).toBe(false);
    expect(isCrossSite(undefined)).toBe(false);
  });
});
