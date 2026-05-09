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

export interface Branch {
  id: string;
  nameAr: string;
  nameEn: string;
  image: string;
  locationUrl: string;
}

export type SocialPlatform = 'facebook' | 'instagram' | 'whatsapp' | 'youtube' | 'website' | 'email' | 'catalog';

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  url: string;
}

export interface SiteData {
  titleAr: string;
  titleEn: string;
  logo: { customUrl: string };
  owner: { photo: string };
  sections: Section[];
  branches: Branch[];
  socialLinks: SocialLink[];
  footer: {
    email: string;
    phone: string;
    website: string;
    noteAr: string;
    noteEn: string;
  };
}

export const DEFAULT_DATA: SiteData = {
  titleAr: "مشاتل القادري الزراعية",
  titleEn: "Al-Qadri Agricultural Nurseries",
  logo: { customUrl: "" },
  owner: { photo: "" },
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
  branches: [],
  socialLinks: [],
  footer: {
    email: "info@alqadrinurseries.com",
    phone: "+966 50 123 4567",
    website: "www.alqadrinurseries.com",
    noteAr: "",
    noteEn: "",
  },
};

let _sessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  _sessionToken = token;
}

export async function adminLogin(password: string): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const json = await res.json() as { token?: string };
      return json.token ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

export async function fetchSiteData(): Promise<SiteData> {
  try {
    const res = await fetch("/api/site-data");
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        const p = json.data as SiteData;
        return {
          titleAr: p.titleAr ?? DEFAULT_DATA.titleAr,
          titleEn: p.titleEn ?? DEFAULT_DATA.titleEn,
          logo: { ...DEFAULT_DATA.logo, ...p.logo },
          owner: { ...DEFAULT_DATA.owner, ...p.owner },
          sections: p.sections?.length ? p.sections : DEFAULT_DATA.sections,
          branches: p.branches ?? DEFAULT_DATA.branches,
          socialLinks: p.socialLinks ?? DEFAULT_DATA.socialLinks,
          footer: { ...DEFAULT_DATA.footer, ...p.footer },
        };
      }
    }
  } catch { /* fall through */ }
  return DEFAULT_DATA;
}

export async function persistSiteData(data: SiteData): Promise<void> {
  if (!_sessionToken) return;
  try {
    await fetch("/api/site-data", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${_sessionToken}`,
      },
      body: JSON.stringify({ data }),
    });
  } catch { /* ignore */ }
}

export async function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Upload failed"));
    reader.readAsDataURL(file);
  });
}

export function resolveImageSrc(src: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("http") || src.startsWith("/api/storage") || src.startsWith("/")) {
    return src;
  }
  return src;
}
