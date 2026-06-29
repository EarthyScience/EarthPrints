import Image from "next/image";
import { Fragment } from "react";
import { TEAM_MEMBERS } from "@/lib/constants/about";

export function AboutContent() {
  return (
    <div className="editor-about-dropdown-content">
      <ul className="about-people-list">
        {TEAM_MEMBERS.map((member, index) => (
          <Fragment key={member.name}>
            {index > 0 ? (
              <li className="about-people-divider" role="presentation" />
            ) : null}
            <li className="about-person">
              <div className="about-person-top">
                <div className="about-person-avatar">
                  <Image
                    src={member.imageSrc}
                    alt={member.name}
                    width={44}
                    height={44}
                    className="about-person-avatar-image"
                    style={
                      member.imagePosition
                        ? { objectPosition: member.imagePosition }
                        : undefined
                    }
                  />
                </div>
                <div className="about-person-identity">
                  <h2 className="about-person-name">{member.name}</h2>
                  <p className="about-person-role">{member.role}</p>
                </div>
              </div>
              <div className="about-person-details">
                <p className="about-person-affiliation mono">{member.affiliation}</p>
                <p className="about-person-bio">{member.bio}</p>
                {member.links.length > 0 ? (
                  <div className="about-person-links">
                    {member.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="about-person-link-badge"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          </Fragment>
        ))}
      </ul>
    </div>
  );
}
