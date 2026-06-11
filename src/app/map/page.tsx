import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/layout/Nav";

export const metadata: Metadata = {
  title: "Map",
};

export default function MapPage() {
  return (
    <>
      <Nav />
      <main className="map-stub">
        <h1>Map</h1>
        <p>
          Interactive map view coming soon. This route replaces map.html from
          the original prototype.
        </p>
        <Link href="/" className="btn-outline">
          Back to overview
        </Link>
      </main>
    </>
  );
}
