import { describe, expect, it } from "vitest";
import fx from "../../tests/ui/fixture.json";
import type { Storefront } from "./ai/schema";
import { cleanContact, PublishBodySchema, slugBase, SLUG_RE, toPublic, type StoredStore } from "./stores";

describe("publishing", () => {
  it("makes readable slugs from the display name", () => {
    expect(slugBase("@bakewithanu")).toBe("bakewithanu");
    expect(slugBase("Priya Sharma")).toBe("priya-sharma");
    expect(slugBase("Finance Basics for First-Salary Freshers!")).toBe("finance-basics-for-first");
    expect(slugBase("ॐ")).toBe("store");
    expect(SLUG_RE.test(`${slugBase("@rahul.lifts")}-a1b2`)).toBe(true);
  });

  it("accepts Indian mobile numbers and emails, nothing else", () => {
    expect(cleanContact("98765 43210")).toBe("+919876543210");
    expect(cleanContact("+91-98765-43210")).toBe("+919876543210");
    expect(cleanContact("09876543210")).toBe("+919876543210");
    expect(cleanContact("Anu@Example.com")).toBe("anu@example.com");
    expect(cleanContact("12345")).toBeNull();
    expect(cleanContact("5876543210")).toBeNull();
    expect(cleanContact("not an email")).toBeNull();
  });

  it("never sends the creator's input, token hash or 'why this price' to the public page", () => {
    const rec: StoredStore = { v: 1, slug: "priya-ab12", input: fx.input as StoredStore["input"], storefront: fx.storefront as Storefront, tokenHash: "x".repeat(64), createdAt: 0, updatedAt: 0 };
    const pub = toPublic(rec);
    const text = JSON.stringify(pub);
    expect(text).not.toContain("tokenHash");
    expect(text).not.toContain("certified yoga teacher in Bangalore. I post"); // the raw input
    expect(pub.storefront.products.every((p) => p.price_rationale === "")).toBe(true);
  });

  it("rejects oversized or malformed stores", () => {
    const ok = PublishBodySchema.safeParse({ input: fx.input, storefront: fx.storefront });
    expect(ok.success).toBe(true);
    const big = structuredClone(fx.storefront);
    big.creator.bio = "x".repeat(5000);
    expect(PublishBodySchema.safeParse({ input: fx.input, storefront: big }).success).toBe(false);
    const neg = structuredClone(fx.storefront);
    neg.products[0].price_inr = -5;
    expect(PublishBodySchema.safeParse({ input: fx.input, storefront: neg }).success).toBe(false);
  });
});
