export type TeamMemberLink = {
  label: string;
  href: string;
};

export type TeamMember = {
  name: string;
  role: string;
  affiliation: string;
  bio: string;
  imageSrc: string;
  imagePosition?: string;
  links: TeamMemberLink[];
};
