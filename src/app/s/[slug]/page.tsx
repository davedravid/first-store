import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicStore } from "@/components/PublicStore";
import { getPublicStore } from "@/lib/public-store";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicStore(slug);
  if (!s) return { title: "Store not found | First Store" };
  const c = s.storefront.creator;
  const title = `${c.display_name} | ${c.tagline}`;
  return {
    title,
    description: c.bio.slice(0, 160),
    openGraph: { title, description: c.tagline, type: "website" },
    twitter: { card: "summary_large_image", title, description: c.tagline },
  };
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto min-h-dvh max-w-[480px] bg-[#f6f7f9]" aria-busy="true" />}>
      <Store params={params} />
    </Suspense>
  );
}

async function Store({ params }: Props) {
  const { slug } = await params;
  const s = await getPublicStore(slug);
  if (!s) notFound();
  return <PublicStore slug={s.slug} store={s.storefront} />;
}
