import type { Metadata } from "next";
import { Nav } from "@/components/layout/Nav";
import { MapExperience } from "@/components/map/MapExperience";

export const metadata: Metadata = {
  title: "Map",
};

export default function MapPage() {
  return (
    <>
      <Nav />
      <MapExperience />
    </>
  );
}
