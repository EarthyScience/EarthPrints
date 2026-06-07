import type { TeamMember } from "@/types/about";

export const ABOUT_INTRO = {
  chip: "Team",
  label: "EarthPrints",
  title: "Built at the intersection of climate science and the web.",
  description:
    "EarthPrints is a browser-native tool for exploring environmental fingerprints and flux-tower footprints. Click any pixel on a global map to inspect climate variables over time, alongside the spatial footprint of nearby eddy-covariance towers.",
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Anastasiia Ivanchenko",
    role: "Front-End Engineer",
    affiliation:
      "Hostinger, Kaunas, Lithuania. Bachelor's in Information Technology, Kaunas University of Technology.",
    imageSrc: "/team/anastasiia-ivanchenko.jpg",
    bio: "Front-End Engineer at Hostinger in Kaunas, building customer-facing web products with TypeScript and React for a global hosting platform. Focused on scalable UI, clean architecture, and polished user experiences. Applies the same approach to EarthPrints, from design system to map-ready interface.",
    links: [
      { label: "GitHub", href: "https://github.com/aivanchenk" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/a-ivanchenko/" },
    ],
  },
  {
    name: "Dr. Lazaro Alonso Silva",
    role: "Scientist",
    affiliation:
      "Max Planck Institute for Biogeochemistry, Jena. Project Group Modelling Interactions in Soil Systems, Department Biogeochemical Integration. Project Group EarthNet.",
    imageSrc: "/team/lazaro-alonso-silva.jpg",
    imagePosition: "center 50%",
    bio: "Physicist working on soil-system modelling and Earth system science. Previously guest scientist at the Max Planck Institute for the Physics of Complex Systems, postdoctoral fellow at IFUAP (BUAP, Puebla), and PhD in physics at the University of Guadalajara.",
    links: [
      { label: "Website", href: "https://lazarusa.github.io/" },
      {
        label: "MPI Profile",
        href: "https://www.bgc-jena.mpg.de/person/lalonso/2206",
      },
    ],
  },
];
