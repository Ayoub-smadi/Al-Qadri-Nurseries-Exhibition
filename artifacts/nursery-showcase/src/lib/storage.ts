import plant1 from "@/assets/images/plant-1.png";
import plant2 from "@/assets/images/plant-2.png";
import plant3 from "@/assets/images/plant-3.png";
import plant4 from "@/assets/images/plant-4.png";
import plant5 from "@/assets/images/plant-5.png";
import plant6 from "@/assets/images/plant-6.png";
import plant7 from "@/assets/images/plant-7.png";
import plant8 from "@/assets/images/plant-8.png";

export interface Photo {
  id: string;
  image: string;
  nameAr: string;
  nameEn: string;
}

export interface Section {
  id: string;
  nameAr: string;
  nameEn: string;
  photos: Photo[];
}

export interface SiteData {
  titleAr: string;
  titleEn: string;
  logo: { customUrl: string };
  sections: Section[];
  footer: {
    email: string;
    phone: string;
    website: string;
    noteAr: string;
    noteEn: string;
  };
}

const DEFAULT_DATA: SiteData = {
  titleAr: "مشاتل القادري الزراعية",
  titleEn: "Al-Qadri Agricultural Nurseries",
  logo: { customUrl: "" },
  sections: [
    {
      id: "sec-ornamental",
      nameAr: "أشجار الزينة",
      nameEn: "Ornamental Trees",
      photos: [
        { id: "p1", image: plant1, nameAr: "كالاتيا", nameEn: "Calathea" },
        { id: "p2", image: plant3, nameAr: "عصفور الجنة", nameEn: "Bird of Paradise" },
        { id: "p6", image: plant6, nameAr: "فيلوديندرون", nameEn: "Philodendron" },
        { id: "p7", image: plant7, nameAr: "ألوكاسيا", nameEn: "Alocasia" },
      ],
    },
    {
      id: "sec-citrus",
      nameAr: "الحمضيات",
      nameEn: "Citrus",
      photos: [
        { id: "p3", image: plant2, nameAr: "برتقال", nameEn: "Orange Tree" },
        { id: "p8", image: plant8, nameAr: "زاميوكولكاس", nameEn: "ZZ Plant" },
        { id: "p4", image: plant4, nameAr: "مونستيرا", nameEn: "Monstera" },
        { id: "p5", image: plant5, nameAr: "زيتون", nameEn: "Olive Tree" },
      ],
    },
  ],
  footer: {
    email: "info@alqadrinurseries.com",
    phone: "+966 50 123 4567",
    website: "www.alqadrinurseries.com",
    noteAr: "",
    noteEn: "",
  },
};

const KEY = "alqadri_gallery_v2";

export function getSiteData(): SiteData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as SiteData;
      return {
        titleAr: p.titleAr ?? DEFAULT_DATA.titleAr,
        titleEn: p.titleEn ?? DEFAULT_DATA.titleEn,
        logo: { ...DEFAULT_DATA.logo, ...p.logo },
        sections: p.sections?.length ? p.sections : DEFAULT_DATA.sections,
        footer: { ...DEFAULT_DATA.footer, ...p.footer },
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_DATA;
}

export function saveSiteData(data: SiteData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}
