import { HERO_READOUT } from "@/lib/constants/hero";

export function HeroReadout() {
  return (
    <div className="readout">
      <div>
        <b>PROJ</b> {HERO_READOUT.proj} <span className="pip" />
      </div>
      <div>
        <b>VAR</b> {HERO_READOUT.var}
      </div>
      <div>
        <b>EPOCH</b> {HERO_READOUT.epoch}
      </div>
    </div>
  );
}
