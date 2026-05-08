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

export interface SiteData {
  logo: { customUrl: string };
  photos: Photo[];
  footer: {
    email: string;
    phone: string;
    website: string;
  };
}

const DEFAULT_DATA: SiteData = {
  logo: { customUrl: "" },
  photos: [
    { id: "p1", image: plant1, nameAr: "مونستيرا", nameEn: "Monstera" },
    { id: "p2", image: plant2, nameAr: "برتقال", nameEn: "Orange Tree" },
    { id: "p3", image: plant3, nameAr: "عصفور الجنة", nameEn: "Bird of Paradise" },
    { id: "p4", image: plant4, nameAr: "كالاتيا", nameEn: "Calathea" },
    { id: "p5", image: plant5, nameAr: "زيتون", nameEn: "Olive Tree" },
    { id: "p6", image: plant6, nameAr: "فيلوديندرون", nameEn: "Philodendron" },
    { id: "p7", image: plant7, nameAr: "ألوكاسيا", nameEn: "Alocasia" },
    { id: "p8", image: plant8, nameAr: "زاميوكولكاس", nameEn: "ZZ Plant" },
  ],
  footer: {
    email: "info@alqadrinurseries.com",
    phone: "+966 50 123 4567",
    website: "www.alqadrinurseries.com",
  },
};

const KEY = "alqadri_gallery_v1";

export function getSiteData(): SiteData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as SiteData;
      return {
        logo: { ...DEFAULT_DATA.logo, ...p.logo },
        photos: p.photos?.length ? p.photos : DEFAULT_DATA.photos,
        footer: { ...DEFAULT_DATA.footer, ...p.footer },
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_DATA;
}

export function saveSiteData(data: SiteData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}
