export interface ClientConfig {
  slug: string;
  name: string;
  business_id: string;
  ad_accounts: string[];
}

export const CLIENTS: ClientConfig[] = [
  {
    slug: "putrama",
    name: "Putrama Packaging",
    business_id: "561995191381892",
    ad_accounts: [
      "act_945056839291976",   // Putrama Packaging (campaign aktif)
      "act_280674244430186",   // Cetak Kemasan Rotogravure
      "act_246961581368835",   // Cetak Kemasan Custom
      "act_279492587793168",   // Kemasan Rotogravure
      "act_1000890034428855",  // Kemasan Custom Flexible Packaging
    ],
  },
  {
    slug: "jogja",
    name: "Kemasan Jogja",
    business_id: "4497214590556381",
    ad_accounts: [
      "act_1408788309399040",  // Kemasan Jogja (aktif, IDR)
    ],
  },
  {
    slug: "aneka",
    name: "Aneka Kemasan",
    business_id: "TODO_ANEKA_BUSINESS_ID",
    ad_accounts: [],
  },
  {
    slug: "brownpaper",
    name: "Kemasan Brown Paper Series",
    business_id: "TODO_BROWNPAPER_BUSINESS_ID",
    ad_accounts: [],
  },
];
