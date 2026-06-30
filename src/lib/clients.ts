export interface ClientConfig {
  slug: string;
  name: string;
  shortName: string;
  business_id: string;
}

export const CLIENTS: ClientConfig[] = [
  {
    slug:        "putrama",
    name:        "Putrama Packaging",
    shortName:   "Putrama",
    business_id: "561995191381892",
  },
  {
    slug:        "aneka",
    name:        "Aneka Kemasan",
    shortName:   "Aneka",
    business_id: "TODO_ANEKA",
  },
  {
    slug:        "brownpaper",
    name:        "Kemasan Brown Paper Series",
    shortName:   "Brown Paper",
    business_id: "TODO_BROWNPAPER",
  },
  {
    slug:        "jogja",
    name:        "Kemasan Jogja",
    shortName:   "Jogja",
    business_id: "4497214590556381",
  },
];

export function getClient(slug: string): ClientConfig | undefined {
  return CLIENTS.find((c) => c.slug === slug);
}

export const CLIENT_SLUGS = CLIENTS.map((c) => c.slug);
