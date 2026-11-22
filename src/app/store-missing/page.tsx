import type { Metadata } from "next";
import { MissingStore } from "@/components/MissingStore";

// Shown (with a real 404 status) by src/proxy.ts when a /s/<slug> store does not exist.
export const metadata: Metadata = { title: "Store not found | First Store", robots: { index: false } };

export default function Page() {
  return <MissingStore />;
}
