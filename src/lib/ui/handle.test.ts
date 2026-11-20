import { describe, expect, it } from "vitest";
import { normalizeHandle } from "./handle";

describe("normalizeHandle", () => {
  it("accepts @name, name and instagram links", () => {
    expect(normalizeHandle("@Rahul.Lifts")).toBe("@rahul.lifts");
    expect(normalizeHandle("bakewithanu")).toBe("@bakewithanu");
    expect(normalizeHandle("https://www.instagram.com/bakewithanu/?hl=en")).toBe("@bakewithanu");
    expect(normalizeHandle("instagram.com/finance_with_priya")).toBe("@finance_with_priya");
    expect(normalizeHandle("  @@ my handle ")).toBe("@myhandle");
  });
  it("returns empty for blanks and post links", () => {
    expect(normalizeHandle("")).toBe("");
    expect(normalizeHandle("@")).toBe("");
    expect(normalizeHandle("https://instagram.com/p/Cx12ab/")).toBe("");
  });
});
