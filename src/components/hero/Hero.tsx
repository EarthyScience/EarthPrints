import { HeroCanvas } from "@/components/hero/HeroCanvas";
import { HeroContent } from "@/components/hero/HeroContent";
import { HeroOverlays } from "@/components/hero/HeroOverlays";
import { HeroReadout } from "@/components/hero/HeroReadout";

export function Hero() {
  return (
    <section className="hero">
      <HeroCanvas />
      <HeroOverlays />
      <HeroContent />
      <HeroReadout />
    </section>
  );
}
