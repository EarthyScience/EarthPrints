import type { Metadata } from "next";
import { AboutContent } from "@/components/about/AboutContent";
import { Nav } from "@/components/layout/Nav";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <>
      <Nav />
      <AboutContent />
    </>
  );
}
