import Image from "next/image";
import type { TeamMember } from "@/types/about";

type TeamCardProps = {
  member: TeamMember;
};

export function TeamCard({ member }: TeamCardProps) {
  return (
    <article className="about-card">
      <div className="about-card-top">
        <div className="about-avatar">
          <Image
            src={member.imageSrc}
            alt={member.name}
            width={80}
            height={80}
            className="about-avatar-image"
            style={
              member.imagePosition
                ? { objectPosition: member.imagePosition }
                : undefined
            }
          />
        </div>
        <div className="about-card-header">
          <h2>{member.name}</h2>
          <p className="about-card-role">{member.role}</p>
        </div>
      </div>
      <p className="about-card-affiliation mono">{member.affiliation}</p>
      <p className="about-card-bio">{member.bio}</p>
      <div className="about-card-links">
        {member.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="btn-outline about-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </a>
        ))}
      </div>
    </article>
  );
}
