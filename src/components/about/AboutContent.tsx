import Image from "next/image";
import { Fragment } from "react";
import { TEAM_MEMBERS } from "@/lib/constants/about";

const LINK_BADGE_CLASS =
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold " +
  "leading-none tracking-[0.02em] text-accent no-underline transition-[background-color,border-color] duration-150 " +
  "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] " +
  "hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]";

export function AboutContent() {
  return (
    <div>
      <ul className="m-0 list-none p-0">
        {TEAM_MEMBERS.map((member, index) => (
          <Fragment key={member.name}>
            {index > 0 ? (
              <li
                className="my-[14px] h-px bg-editor-border"
                role="presentation"
              />
            ) : null}
            <li className="grid gap-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="size-11 flex-shrink-0 overflow-hidden rounded-full border border-editor-border bg-editor-bg-secondary">
                  <Image
                    src={member.imageSrc}
                    alt={member.name}
                    width={44}
                    height={44}
                    className="size-full object-cover object-top"
                    style={
                      member.imagePosition
                        ? { objectPosition: member.imagePosition }
                        : undefined
                    }
                  />
                </div>
                <div className="grid min-w-0 gap-0.5">
                  <h2 className="min-w-0 text-sm font-semibold leading-[1.2] tracking-[-0.02em] text-editor-fg-primary">
                    {member.name}
                  </h2>
                  <p className="text-xs font-medium leading-[1.2] text-accent">
                    {member.role}
                  </p>
                </div>
              </div>
              <div className="grid min-w-0 gap-0">
                <p className="mb-2 mt-1 font-mono text-[11px] leading-[1.45] text-editor-fg-tertiary">
                  {member.affiliation}
                </p>
                <p className="mb-2 text-xs leading-[1.55] text-editor-fg-secondary">
                  {member.bio}
                </p>
                {member.links.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {member.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className={LINK_BADGE_CLASS}
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
