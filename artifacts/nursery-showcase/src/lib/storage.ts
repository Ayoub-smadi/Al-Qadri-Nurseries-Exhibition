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
  descriptionAr?: string;
  descriptionEn?: string;
  extraImages?: string[];
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

export interface Highlight {
  id: string;
  textAr: string;
  textEn: string;
}

export interface FeaturedImage {
  id: string;
  image: string;
  titleAr: string;
  titleEn: string;
}

export interface SiteData {
  titleAr: string;
  titleEn: string;
  logo: { customUrl: string };
  owner: {
    photo: string;
    bgImage?: string;
    extraPhotos?: string[];
  };
  highlights: Highlight[];
  featuredImages: FeaturedImage[];
  featuredVideo: { url: string; titleAr: string; titleEn: string } | null;
  featuredMode: 'images' | 'video';
  searchNote: { ar: string; en: string };
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
  owner: { photo: "", bgImage: "", extraPhotos: [] },
  highlights: [
    { id: "h1", textAr: "نوفر أجود أنواع النباتات والأشجار المزهرة بأسعار منافسة لتجميل منزلك وحديقتك", textEn: "We provide the finest flowering plants and trees at competitive prices to beautify your home and garden" },
    { id: "h2", textAr: "خبرة تتجاوز عشرين عاماً في مجال تنسيق الحدائق وتوريد المنتجات الزراعية", textEn: "Over twenty years of expertise in landscape design and agricultural product supply" },
    { id: "h3", textAr: "نقدم خدمات الاستيراد والتصدير للنباتات والأشجار إلى مختلف دول المنطقة", textEn: "We offer import and export services for plants and trees across the region" },
  ],
  featuredImages: [],
  featuredVideo: null,
  featuredMode: 'images' as const,
  searchNote: { ar: '', en: '' },
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

const ADMIN_TOKEN_KEY = 'gallery_admin_token';

let _sessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  _sessionToken = token;
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch { /* ignore */ }
}

export function loadSavedToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch { return null; }
}

/** Always returns the best available token — memory first, then localStorage fallback. */
function getToken(): string | null {
  if (_sessionToken) return _sessionToken;
  const saved = loadSavedToken();
  if (saved) { _sessionToken = saved; }
  return saved;
}

export async function adminLogin(username: string, password: string): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      const json = await res.json() as { token?: string };
      return json.token ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

export async function checkNeedsSetup(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/needs-setup");
    if (res.ok) {
      const json = await res.json() as { needsSetup?: boolean };
      return json.needsSetup === true;
    }
  } catch { /* ignore */ }
  return false;
}

export async function adminSetup(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return res.ok;
  } catch { /* ignore */ }
  return false;
}

/**
 * Fetches site data from the API.
 * Returns null if no data exists in the DB yet (i.e., never been saved).
 * Returns SiteData if data exists.
 * This distinction is important: null means "keep local cache", not "use defaults".
 */
export async function fetchSiteData(): Promise<SiteData | null> {
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
          owner: {
            photo: p.owner?.photo ?? DEFAULT_DATA.owner.photo,
            bgImage: p.owner?.bgImage ?? '',
            extraPhotos: p.owner?.extraPhotos ?? [],
          },
          highlights: p.highlights ?? DEFAULT_DATA.highlights,
          featuredImages: p.featuredImages ?? DEFAULT_DATA.featuredImages,
          featuredVideo: p.featuredVideo ?? DEFAULT_DATA.featuredVideo,
          featuredMode: p.featuredMode ?? DEFAULT_DATA.featuredMode,
          searchNote: p.searchNote ?? DEFAULT_DATA.searchNote,
          sections: p.sections?.length ? p.sections : DEFAULT_DATA.sections,
          branches: p.branches ?? DEFAULT_DATA.branches,
          socialLinks: p.socialLinks ?? DEFAULT_DATA.socialLinks,
          footer: { ...DEFAULT_DATA.footer, ...p.footer },
        };
      }
      // API responded but no data in DB — return null to preserve cache
      return null;
    }
  } catch { /* fall through */ }
  // Network error or server down — return null to preserve cache
  return null;
}

/**
 * Validates the current session token against the server.
 * Returns true if valid, false if expired or invalid.
 */
export async function validateToken(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/admin/verify", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

const BODY_LIMIT = 20 * 1024 * 1024; // 20MB — matches Replit/Express server limit

/**
 * Persists site data to the API.
 * Returns { ok, unauthorized, tooBig } where tooBig means payload exceeded server limit.
 */
export async function persistSiteData(data: SiteData): Promise<{ ok: boolean; unauthorized: boolean; tooBig: boolean }> {
  const token = getToken();
  if (!token) return { ok: false, unauthorized: true, tooBig: false };
  const body = JSON.stringify({ data });
  if (body.length > BODY_LIMIT) {
    return { ok: false, unauthorized: false, tooBig: true };
  }
  try {
    const res = await fetch("/api/site-data", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body,
    });
    if (res.ok) return { ok: true, unauthorized: false, tooBig: false };
    if (res.status === 413) return { ok: false, unauthorized: false, tooBig: true };
    if (res.status === 401 || res.status === 403) return { ok: false, unauthorized: true, tooBig: false };
    return { ok: false, unauthorized: false, tooBig: false };
  } catch {
    return { ok: false, unauthorized: false, tooBig: false };
  }
}

export async function uploadImageFromUrl(imageUrl: string): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch("/api/images/from-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ url: imageUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Failed to import image from URL");
  }
  const json = await res.json() as { url?: string };
  if (!json.url) throw new Error("No URL returned");
  return json.url;
}

export async function uploadImage(file: File): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated — please log in");
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const isPng = file.type === "image/png";
      // PNGs keep transparency — larger max size, no JPEG conversion
      const MAX = isPng ? 900 : 600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      if (!isPng) {
        // Fill white background for JPEGs to avoid black fill
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      // PNG → keep as PNG to preserve transparency; JPEG → compress normally
      const mimeType = isPng ? "image/png" : "image/jpeg";
      const dataUrl = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.75);
      try {
        const res = await fetch("/api/images", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ data: dataUrl, mimeType }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(errJson.error ?? `Server error ${res.status}`);
        }
        const json = await res.json() as { url?: string };
        if (!json.url) throw new Error("No URL returned");
        resolve(json.url);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image file")); };
    img.src = url;
  });
}

export interface QuoteItem {
  plantId: string;
  plantNameAr: string;
  plantNameEn: string;
  plantImage: string;
  sectionNameAr: string;
  sectionNameEn: string;
  quantity: number;
  size: string;
  price: number;
  unavailable?: boolean;
}

export interface QuoteRequest {
  id: string;
  customer_name: string;
  phone: string;
  items: QuoteItem[];
  notes: string;
  discount: number;
  tax: number;
  status: string;
  created_at: string;
}

export async function submitQuote(data: { customerName: string; phone: string; items: QuoteItem[]; notes: string }): Promise<string | null> {
  try {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) { const j = await res.json() as { id?: string }; return j.id ?? null; }
  } catch { /* ignore */ }
  return null;
}

export async function fetchQuotes(): Promise<QuoteRequest[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch('/api/quotes', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { const j = await res.json() as { quotes?: QuoteRequest[] }; return j.quotes ?? []; }
  } catch { /* ignore */ }
  return [];
}

export async function updateQuote(id: string, data: { items: QuoteItem[]; discount: number; tax: number; status: string; notes?: string }): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`/api/quotes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch { /* ignore */ }
  return false;
}

export async function deleteQuote(id: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    return res.ok;
  } catch { /* ignore */ }
  return false;
}

export function resolveImageSrc(src: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("http") || src.startsWith("/api/storage") || src.startsWith("/")) {
    return src;
  }
  return src;
}
