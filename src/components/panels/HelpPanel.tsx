"use client";

import { Fragment } from "react";
import { Compass } from "lucide-react";
import { TEAM_MEMBERS } from "@/lib/constants/about";
import { requestGuide } from "@/lib/tour";
import { SiteMark } from "@/components/layout/MapToolbar";
import { FloatingPanel } from "@/components/panels/FloatingPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";

const REPO_URL = "https://github.com/EarthyScience/EarthPrints";

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter((part) => /^[A-Z]/.test(part) && !part.endsWith("."))
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <FloatingPanel label="Help" onClose={onClose}>
      <div className="grid gap-4">
        <div className="flex items-center gap-2 md:grid md:grid-cols-2">
          <div className="mr-auto md:hidden [&_img]:size-7 [&_[data-slot=card-title]]:text-xl">
            <SiteMark />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              requestGuide();
            }}
          >
            <Compass />
            Guide
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a href={REPO_URL} target="_blank" rel="noreferrer noopener" />
            }
          >
            <GitHubMark />
            Source
          </Button>
        </div>

        <Separator />

        {TEAM_MEMBERS.map((member, index) => (
          <Fragment key={member.name}>
            {index > 0 && <Separator />}
            <Item size="sm">
              <ItemMedia>
                <Avatar size="lg">
                  <AvatarImage
                    src={member.imageSrc}
                    alt={member.name}
                    style={
                      member.imagePosition
                        ? { objectPosition: member.imagePosition }
                        : undefined
                    }
                  />
                  <AvatarFallback>{initials(member.name)}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{member.name}</ItemTitle>
                <ItemDescription className="text-brand">
                  {member.role}
                </ItemDescription>
              </ItemContent>
              <ItemFooter className="grid gap-2">
                <p className="text-muted-foreground">{member.affiliation}</p>
                <p>{member.bio}</p>
                <div className="flex flex-wrap gap-2">
                  {member.links.map((link) => (
                    <Button
                      key={link.href}
                      variant="outline"
                      size="xs"
                      nativeButton={false}
                      render={
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      {link.label}
                    </Button>
                  ))}
                </div>
              </ItemFooter>
            </Item>
          </Fragment>
        ))}
      </div>
    </FloatingPanel>
  );
}
