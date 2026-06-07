import { TeamCard } from "@/components/about/TeamCard";
import { Chip } from "@/components/ui/Chip";
import { ABOUT_INTRO, TEAM_MEMBERS } from "@/lib/constants/about";

export function AboutContent() {
  return (
    <main className="about-page">
      <div className="about-inner">
        <header className="about-header">
          <div className="meta">
            <Chip>{ABOUT_INTRO.chip}</Chip>
            <span className="sep">•</span>
            <span className="mono">{ABOUT_INTRO.label}</span>
          </div>
          <h1>{ABOUT_INTRO.title}</h1>
          <p className="about-lead">{ABOUT_INTRO.description}</p>
        </header>

        <section className="about-team">
          <h2 className="about-section-title mono">People</h2>
          <div className="about-grid">
            {TEAM_MEMBERS.map((member) => (
              <TeamCard key={member.name} member={member} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
