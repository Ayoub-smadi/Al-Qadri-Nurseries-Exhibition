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
  quantity?: number;
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
  mapEmbedUrl?: string;
  coordinates?: string; // "lat, lon" e.g. "31.9234, 35.9234"
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

export interface ShowcaseItem {
  id: string;
  imageUrl: string;
  captionAr: string;
  captionEn: string;
  locationUrl?: string;
}

export type AgriStoreCategory = 'tools' | 'seeds' | 'fertilizers' | 'pesticides' | 'irrigation';

export interface AgriStoreProduct {
  id: string;
  category: AgriStoreCategory;
  image: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number;
}

export interface ShippingZone {
  id: string;
  nameAr: string;
  nameEn: string;
  fee: number;
}

export interface AgriStoreContent {
  storeTitleAr: string;
  storeTitleEn: string;
  storeSubtitleAr: string;
  storeSubtitleEn: string;
  eyebrowAr: string;
  eyebrowEn: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface SiteData {
  titleAr: string;
  titleEn: string;
  galleryTitle: { ar: string; en: string };
  logo: { customUrl: string };
  announcement?: { imageUrl: string; enabled: boolean };
  newsTicker?: { enabled: boolean; logoUrl: string; text: string };
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
  shippingZones?: ShippingZone[];
  storeShowcase?: ShowcaseItem[];
  agriStoreProducts?: AgriStoreProduct[];
  agriStoreContent?: AgriStoreContent;
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
  galleryTitle: {
    ar: "معرض مشاتل القادري الزراعية",
    en: "Al-Qadri Nurseries Gallery",
  },
  logo: { customUrl: "" },
  announcement: { imageUrl: "", enabled: false },
  newsTicker: { enabled: false, logoUrl: "", text: "" },
  owner: { photo: "", bgImage: "", extraPhotos: [] },
  highlights: [
    { id: "h1", textAr: "نوفر أجود أنواع النباتات والأشجار المزهرة بأسعار منافسة لتجميل منزلك وحديقتك", textEn: "We provide the finest flowering plants and trees at competitive prices to beautify your home and garden" },
    { id: "h2", textAr: "خبرة تتجاوز عشرين عاماً في مجال تنسيق الحدائق وتوريد المنتجات الزراعية", textEn: "Over twenty years of expertise in landscape design and agricultural product supply" },
    { id: "h3", textAr: "نقدم خدمات الاستيراد والتصدير للنباتات والأشجار إلى مختلف دول المنطقة", textEn: "We offer import and export services for plants and trees across the region" },
  ],
  featuredImages: [],
  featuredVideo: null,
  featuredMode: 'images' as const,
  storeShowcase: [
    { id: 'sc1', imageUrl: '/store-1.jpg', captionAr: 'مستلزمات زراعية متكاملة', captionEn: 'Full Agricultural Supplies' },
    { id: 'sc2', imageUrl: '/store-2.jpg', captionAr: 'معرض القادري أون لاين', captionEn: 'Al-Kadri Online Showroom' },
    { id: 'sc3', imageUrl: '/store-3.jpg', captionAr: 'مشتل القادري — أبو عقاب', captionEn: 'Al-Qadri Nursery – Abu Aqab' },
  ],
  shippingZones: [
    { id: 'amman', nameAr: 'عمّان', nameEn: 'Amman', fee: 2 },
    { id: 'other', nameAr: 'المحافظات الأخرى', nameEn: 'Other governorates', fee: 3 },
  ],
  agriStoreProducts: [
    { id: 'tool-1', category: 'tools', image: '/store-1.jpg', nameAr: 'عدد وأدوات زراعية', nameEn: 'Agricultural Tools', descriptionAr: 'مجموعة مختارة من أدوات العمل والحدائق.', descriptionEn: 'A selected range of tools for gardening and agricultural work.', price: 0 },
    { id: 'seed-1', category: 'seeds', image: '/store-2.jpg', nameAr: 'بذور موسمية', nameEn: 'Seasonal Seeds', descriptionAr: 'بذور مختارة لموسم زراعي ناجح.', descriptionEn: 'Selected seeds for a successful growing season.', price: 0 },
    { id: 'fert-1', category: 'fertilizers', image: '/store-2.jpg', nameAr: 'أسمدة زراعية', nameEn: 'Agricultural Fertilizers', descriptionAr: 'أسمدة لتحسين نمو النباتات والأشجار.', descriptionEn: 'Fertilizers to support healthy plant and tree growth.', price: 0 },
    { id: 'pest-1', category: 'pesticides', image: '/store-3.jpg', nameAr: 'مبيدات زراعية', nameEn: 'Agricultural Pesticides', descriptionAr: 'حلول زراعية للعناية بالنباتات والمحاصيل.', descriptionEn: 'Agricultural solutions for plant and crop care.', price: 0 },
    { id: 'irrig-1', category: 'irrigation', image: '/store-1.jpg', nameAr: 'شبكات ري', nameEn: 'Irrigation Systems', descriptionAr: 'مستلزمات وشبكات ري للحدائق والمزارع.', descriptionEn: 'Irrigation supplies and systems for gardens and farms.', price: 0 },
  ],
  agriStoreContent: {
    storeTitleAr: 'متجر المواد الزراعية',
    storeTitleEn: 'Agricultural Supplies Store',
    storeSubtitleAr: 'مشاتل القادري الزراعية',
    storeSubtitleEn: 'Al-Qadri Agricultural Nurseries',
    eyebrowAr: 'كل ما تحتاجه لحديقتك ومزرعتك',
    eyebrowEn: 'Everything for your garden and farm',
    titleAr: 'تسوّق المواد الزراعية بسهولة',
    titleEn: 'Shop agricultural supplies with ease',
    descriptionAr: 'اختر المنتج، أضفه للسلة، وأرسل طلبك مع موقع التوصيل. رسوم الشحن 2 د.أ داخل عمّان و3 د.أ لجميع المحافظات.',
    descriptionEn: 'Choose your products, add them to your cart, and send your order with your delivery location.',
  },
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

// __REPLIT_DEV_DOMAIN__ is injected at build time by vite.config.ts `define`.
// When running inside the Replit canvas iframe (which may be served from a
// different origin), we bypass the Vite proxy entirely by calling the API
// through the known-working public URL for the main webview port (5000).
declare const __REPLIT_DEV_DOMAIN__: string;

const getApiBase = (): string => {
  try {
    const domain = __REPLIT_DEV_DOMAIN__;
    if (domain) return `https://${domain}/api`;
  } catch { /* not defined in production build */ }
  return '/api';
};

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

function fetchWithTimeout(input: RequestInfo, init?: RequestInit, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

export async function adminLogin(username: string, password: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${getApiBase()}/admin/login`, {
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
    const res = await fetchWithTimeout(`${getApiBase()}/admin/needs-setup`, undefined, 10000);
    if (res.ok) {
      const json = await res.json() as { needsSetup?: boolean };
      return json.needsSetup === true;
    }
  } catch { /* ignore */ }
  return false;
}

export async function adminSetup(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${getApiBase()}/admin/setup`, {
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
    const res = await fetch(`${getApiBase()}/site-data`);
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        const p = json.data as SiteData;
        return {
          titleAr: p.titleAr ?? DEFAULT_DATA.titleAr,
          titleEn: p.titleEn ?? DEFAULT_DATA.titleEn,
          galleryTitle: { ...DEFAULT_DATA.galleryTitle, ...p.galleryTitle },
          logo: { ...DEFAULT_DATA.logo, ...p.logo },
          announcement: p.announcement ?? DEFAULT_DATA.announcement,
          newsTicker: p.newsTicker ?? DEFAULT_DATA.newsTicker,
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
          shippingZones: p.shippingZones?.length ? p.shippingZones : DEFAULT_DATA.shippingZones,
          storeShowcase: p.storeShowcase ?? DEFAULT_DATA.storeShowcase,
          agriStoreContent: {
            storeTitleAr: p.agriStoreContent?.storeTitleAr ?? DEFAULT_DATA.agriStoreContent!.storeTitleAr,
            storeTitleEn: p.agriStoreContent?.storeTitleEn ?? DEFAULT_DATA.agriStoreContent!.storeTitleEn,
            storeSubtitleAr: p.agriStoreContent?.storeSubtitleAr ?? DEFAULT_DATA.agriStoreContent!.storeSubtitleAr,
            storeSubtitleEn: p.agriStoreContent?.storeSubtitleEn ?? DEFAULT_DATA.agriStoreContent!.storeSubtitleEn,
            eyebrowAr: p.agriStoreContent?.eyebrowAr ?? DEFAULT_DATA.agriStoreContent!.eyebrowAr,
            eyebrowEn: p.agriStoreContent?.eyebrowEn ?? DEFAULT_DATA.agriStoreContent!.eyebrowEn,
            titleAr: p.agriStoreContent?.titleAr ?? DEFAULT_DATA.agriStoreContent!.titleAr,
            titleEn: p.agriStoreContent?.titleEn ?? DEFAULT_DATA.agriStoreContent!.titleEn,
            descriptionAr: p.agriStoreContent?.descriptionAr ?? DEFAULT_DATA.agriStoreContent!.descriptionAr,
            descriptionEn: p.agriStoreContent?.descriptionEn ?? DEFAULT_DATA.agriStoreContent!.descriptionEn,
          },
          agriStoreProducts: (() => {
            const saved = Array.isArray(p.agriStoreProducts) ? p.agriStoreProducts : [];
            const missingDefaults = (DEFAULT_DATA.agriStoreProducts ?? []).filter(
              fallback => !saved.some(product => product.category === fallback.category),
            );
            return [...saved, ...missingDefaults];
          })(),
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
    const res = await fetch(`${getApiBase()}/admin/verify`, {
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
    const res = await fetch(`${getApiBase()}/site-data`, {
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

/**
 * Upload a base64 data-URL string to the server's /api/images endpoint.
 * Returns the persistent server URL (e.g. /api/images/img-xxx).
 * Throws if not authenticated or if the upload fails.
 */
export async function uploadImageBase64(dataUrl: string): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  // Extract mime type from data URL header (e.g. "data:image/jpeg;base64,...")
  const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const res = await fetch(`${getApiBase()}/images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ data: dataUrl, mimeType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }
  const json = await res.json() as { url?: string };
  if (!json.url) throw new Error("No URL returned");
  return json.url;
}

export async function uploadImageFromUrl(imageUrl: string): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${getApiBase()}/images/from-url`, {
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
      const dataUrl = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.55);
      try {
        const res = await fetch(`${getApiBase()}/images`, {
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
  sizeUnavailable?: boolean;
  availableSize?: string;
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
  deleted_at?: string | null;
  shipping_destination?: string;
  shipping_fee?: number;
  planting_fee?: number;
  shipping_method?: string;
  shipping_address?: string;
  order_type?: 'plant_quote' | 'agri_store';
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  number: string;
  customer_name: string;
  date: string;
  items: InvoiceItem[];
  notes: string;
  discount?: number;
  status: 'paid' | 'receivable' | 'online';
  created_at: string;
}

export async function submitQuote(data: { shippingMethod: 'pickup' | 'delivery' | 'plant_only' | 'delivery_plant'; shippingAddress: string; customerName: string; phone: string; items: QuoteItem[]; notes: string; shippingFee: number; orderType?: 'plant_quote' | 'agri_store' }): Promise<string | null> {
  // Product images are part of the order so the admin can identify each item.
  // Uploaded product images are server URLs, not large base64 payloads.
  const payload = { ...data, orderType: data.orderType ?? 'plant_quote' };
  console.log('[submitQuote] sending →', { shippingMethod: payload.shippingMethod, shippingAddress: payload.shippingAddress, customerName: payload.customerName, itemsCount: data.items.length });
  try {
    const res = await fetch(`${getApiBase()}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { const j = await res.json() as { id?: string }; return j.id ?? null; }
    const errText = await res.text().catch(() => '');
    console.error('[submitQuote] server error', res.status, errText);
  } catch (err) {
    console.error('[submitQuote] fetch error', err);
  }
  return null;
}

export async function fetchQuotes(opts?: { trash?: boolean; orderType?: 'plant_quote' | 'agri_store' }): Promise<QuoteRequest[] | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const params = new URLSearchParams();
    if (opts?.trash) params.set('trash', '1');
    params.set('orderType', opts?.orderType ?? 'plant_quote');
    const query = params.toString();
    const url = `${getApiBase()}/quotes${query ? `?${query}` : ''}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { const j = await res.json() as { quotes?: QuoteRequest[] }; return j.quotes ?? []; }
    if (res.status === 401) return null;
  } catch { /* ignore */ }
  return null;
}

export async function updateQuote(id: string, data: { items: QuoteItem[]; discount: number; tax: number; status: string; notes?: string; shippingFee?: number; plantingFee?: number; shippingMethod?: string; shippingAddress?: string }): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${getApiBase()}/quotes/${id}`, {
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
    const res = await fetch(`${getApiBase()}/quotes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    return res.ok;
  } catch { /* ignore */ }
  return false;
}

export async function restoreQuote(id: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${getApiBase()}/quotes/${id}/restore`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    return res.ok;
  } catch { /* ignore */ }
  return false;
}

export async function permanentDeleteQuote(id: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${getApiBase()}/quotes/${id}/permanent`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    return res.ok;
  } catch { /* ignore */ }
  return false;
}

export interface Receipt {
  id: string;
  number: string;
  received_from: string;
  name_prefix: string;
  amount: number;
  amount_text: string;
  description: string;
  payment_method: 'cash' | 'check' | 'transfer' | 'online';
  date: string;
  notes: string;
  created_at: string;
}

export async function fetchReceipts(): Promise<Receipt[] | 'unauthorized' | null> {
  const token = getToken();
  if (!token) return 'unauthorized';
  try {
    const res = await fetch(`${getApiBase()}/receipts`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { const j = await res.json() as { receipts?: Receipt[] }; return j.receipts ?? []; }
    if (res.status === 401 || res.status === 403) return 'unauthorized';
  } catch { /* ignore */ }
  return null;
}

export async function createReceipt(data: { receivedFrom: string; namePrefix?: string; amount: number; amountText: string; description: string; paymentMethod: string; date: string; notes: string; receiptNumber?: string }): Promise<{ id: string; number: string } | 'unauthorized' | { error: string } | null> {
  const token = getToken();
  if (!token) return 'unauthorized';
  try {
    const res = await fetch(`${getApiBase()}/receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json() as { id: string; number: string };
    if (res.status === 401 || res.status === 403) return 'unauthorized';
    const body = await res.json().catch(() => ({})) as { error?: string; detail?: string };
    return { error: body.detail ?? body.error ?? `HTTP ${res.status}` };
  } catch (e) { return { error: String(e) }; }
}

export async function updateReceipt(id: string, data: { receivedFrom?: string; namePrefix?: string; amount?: number; amountText?: string; description?: string; paymentMethod?: string; date?: string; notes?: string; number?: string }): Promise<boolean | 'unauthorized'> {
  const token = getToken();
  if (!token) return 'unauthorized';
  try {
    const res = await fetch(`${getApiBase()}/receipts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) return 'unauthorized';
    return res.ok;
  } catch { return false; }
}

export async function deleteReceipt(id: string): Promise<boolean | 'unauthorized'> {
  const token = getToken();
  if (!token) return 'unauthorized';
  try {
    const res = await fetch(`${getApiBase()}/receipts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) return 'unauthorized';
    return res.ok;
  } catch { return false; }
}

export interface Disbursement {
  id: string;
  number: string;
  paid_to: string;
  name_prefix: string;
  amount: number;
  amount_text: string;
  description: string;
  payment_method: 'cash' | 'check' | 'transfer' | 'online';
  date: string;
  notes: string;
  created_at: string;
}

export async function fetchDisbursements(): Promise<Disbursement[] | 'unauthorized' | null> {
  const token = getToken();
  if (!token) return 'unauthorized';
  try {
    const res = await fetch(`${getApiBase()}/disbursements`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { const j = await res.json() as { disbursements?: Disbursement[] }; return j.disbursements ?? []; }
    if (res.status === 401 || res.status === 403) return 'unauthorized';
  } catch { /* ignore */ }
  return null;
}

export async function createDisbursement(data: { paidTo: string; namePrefix?: string; amount: number; amountText: string; description: string; paymentMethod: string; date: string; notes: string; disbursementNumber?: string }): Promise<{ id: string; number: string } | 'unauthorized' | { error: string } | null> {
  const token = getToken();
  if (!token) return 'unauthorized';
  try {
    const res = await fetch(`${getApiBase()}/disbursements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json() as { id: string; number: string };
    if (res.status === 401 || res.status === 403) return 'unauthorized';
    const body = await res.json().catch(() => ({})) as { error?: string; detail?: string };
    return { error: body.detail ?? body.error ?? `HTTP ${res.status}` };
  } catch (e) { return { error: String(e) }; }
}

export async function updateDisbursement(id: string, data: { paidTo?: string; namePrefix?: string; amount?: number; amountText?: string; description?: string; paymentMethod?: string; date?: string; notes?: string; number?: string }): Promise<boolean | 'unauthorized'> {
  const token = getToken();
  if (!token) return 'unauthorized';
  try {
    const res = await fetch(`${getApiBase()}/disbursements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) return 'unauthorized';
    return res.ok;
  } catch { return false; }
}

export async function deleteDisbursement(id: string): Promise<boolean | 'unauthorized'> {
  const token = getToken();
  if (!token) return 'unauthorized';
  try {
    const res = await fetch(`${getApiBase()}/disbursements/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) return 'unauthorized';
    return res.ok;
  } catch { return false; }
}

export async function fetchInvoices(): Promise<Invoice[] | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getApiBase()}/invoices`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { const j = await res.json() as { invoices?: Invoice[] }; return j.invoices ?? []; }
  } catch { /* ignore */ }
  return null;
}

export async function createInvoice(data: { customerName: string; date: string; items: InvoiceItem[]; notes: string; status?: string; discount?: number; invoiceNumber?: string }): Promise<{ id: string; number: string } | null | 'unauthorized' | { error: string }> {
  const token = getToken();
  if (!token) return 'unauthorized';
  const tryOnce = async (): Promise<{ ok: true; value: { id: string; number: string } | null | 'unauthorized' | { error: string } } | { ok: false; reason: string }> => {
    try {
      const res = await fetch(`${getApiBase()}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (res.ok) return { ok: true, value: await res.json() as { id: string; number: string } };
      if (res.status === 403 || res.status === 401) return { ok: true, value: 'unauthorized' };
      const errText = await res.text().catch(() => '');
      console.error('[createInvoice] server error', res.status, errText);
      return { ok: true, value: { error: `HTTP ${res.status}: ${errText.slice(0, 80)}` } };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn('[createInvoice] network error, will retry in 2s:', reason);
      return { ok: false, reason };
    }
  };
  const first = await tryOnce();
  if (first.ok) return first.value;
  await new Promise(r => setTimeout(r, 2000));
  const second = await tryOnce();
  if (second.ok) return second.value;
  const lastReason = (second as { ok: false; reason: string }).reason;
  console.error('[createInvoice] failed after retry:', lastReason);
  return { error: `network: ${lastReason.slice(0, 100)}` };
}

export async function updateInvoiceStatus(id: string, status: 'paid' | 'receivable' | 'online'): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${getApiBase()}/invoices/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch { return false; }
}

export async function updateInvoice(id: string, data: { number?: string; discount?: number; customerName?: string; date?: string; items?: InvoiceItem[]; notes?: string; status?: string }): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${getApiBase()}/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch { return false; }
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${getApiBase()}/invoices/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    return res.ok;
  } catch { /* ignore */ }
  return false;
}

export async function adminCreateQuote(data: {
  shippingMethod: string;
  shippingAddress: string;
  customerName: string;
  phone: string;
  items: QuoteItem[];
  notes: string;
  shippingFee: number;
  plantingFee: number;
  discount: number;
  tax: number;
}): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  // Strip base64 images but keep URL references (e.g. /api/images/xxx)
  const itemsForApi = data.items.map(item => ({
    ...item,
    plantImage: item.plantImage?.startsWith('data:') ? '' : (item.plantImage || ''),
  }));
  try {
    const res = await fetch(`${getApiBase()}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, items: itemsForApi }),
    });
    if (res.ok) {
      const j = await res.json() as { id?: string };
      const id = j.id ?? null;
      if (id) {
        // Immediately update with pricing & status so it's saved as 'priced'
        await updateQuote(id, {
          items: itemsForApi,
          discount: data.discount,
          tax: data.tax,
          status: 'priced',
          notes: data.notes,
          shippingFee: data.shippingFee,
          plantingFee: data.plantingFee,
          shippingMethod: data.shippingMethod,
          shippingAddress: data.shippingAddress,
        });
      }
      return id;
    }
    const errText = await res.text().catch(() => '');
    console.error('[adminCreateQuote] server error', res.status, errText);
  } catch (err) {
    console.error('[adminCreateQuote] fetch error', err);
  }
  return null;
}

/* ── Qadri Old Quotations (server-synced) ───────────────── */

export async function fetchQadriOldQuotations(): Promise<any[] | null> {
  const token = getToken();
  if (!token) {
    console.warn('[qadri-old] fetchQadriOldQuotations: no token — user not logged in');
    return null;
  }
  try {
    const url = `${getApiBase()}/qadri-old-quotations`;
    console.log('[qadri-old] fetching', url);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[qadri-old] response status', res.status);
    if (res.ok) { const j = await res.json() as { records?: any[] }; return j.records ?? []; }
    if (res.status === 401 || res.status === 403) {
      console.warn('[qadri-old] auth failed — token invalid or expired');
      return null;
    }
    const errText = await res.text().catch(() => '');
    console.error('[qadri-old] server error', res.status, errText);
  } catch (e) {
    console.error('[qadri-old] network error', e);
  }
  return null;
}

export async function upsertQadriOldQuotation(data: Record<string, unknown>, id?: string): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const body = id ? { ...data, id } : data;
    const res = await fetch(`${getApiBase()}/qadri-old-quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) { const j = await res.json() as { id?: string }; return j.id ?? null; }
  } catch { /* ignore */ }
  return null;
}

export async function deleteQadriOldQuotation(id: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${getApiBase()}/qadri-old-quotations/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch { return false; }
}

export function resolveImageSrc(src: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("http") || src.startsWith("/api/storage") || src.startsWith("/")) {
    return src;
  }
  return src;
}
