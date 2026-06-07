import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { HERO_COPY } from "@/lib/constants/hero";

export function HeroContent() {
  return (
    <div className="hero-content">
      <div className="meta">
        <Chip>{HERO_COPY.chip}</Chip>
        <span className="sep">•</span>
        <span className="mono">{HERO_COPY.meta}</span>
      </div>
      <h1>
        {HERO_COPY.titleLine1}
        <br />
        {HERO_COPY.titleLine2}&nbsp;
        <span className="accent">{HERO_COPY.accentWord}</span>
      </h1>
      <p className="sub">{HERO_COPY.subtitle}</p>
      <div className="hero-cta">
        <Button href="/map" size="lg" showArrow>
          Open Map
        </Button>
        <Button href="#" variant="outline">
          Learn more
        </Button>
      </div>
    </div>
  );
}
