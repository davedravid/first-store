import type { Metadata } from "next";
import { Suspense } from "react";
import ClientApp from "@/components/ClientApp";

// The private edit link. The token sits after the # so it never reaches a server or a log.
export const metadata: Metadata = { title: "Edit your store | First Store", robots: { index: false, follow: false } };

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={null}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ClientApp editSlug={slug} />;
}
