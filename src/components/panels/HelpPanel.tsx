"use client";

import { Compass, ExternalLink } from "lucide-react";
import { TEAM_MEMBERS } from "@/lib/constants/about";
import { requestGuide } from "@/lib/tour";
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
    <FloatingPanel label="Help">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              requestGuide();
            }}
          >
            <Compass />
            Show the guide
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a href={REPO_URL} target="_blank" rel="noreferrer noopener" />
            }
          >
            <ExternalLink />
            Source on GitHub
          </Button>
        </div>

        <Separator />

        {TEAM_MEMBERS.map((member) => (
          <Item key={member.name} size="sm">
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
        ))}
      </div>
    </FloatingPanel>
  );
}
