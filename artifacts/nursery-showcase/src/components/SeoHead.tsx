import { useEffect } from "react";
import { useApp } from "@/lib/context";

const BRAND = "مشاتل القادري";
const DEFAULT_SITE_URL = "https://www.alqadrinurseries.com";

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = url;
}

function absoluteUrl(siteUrl: string, value: string) {
  if (!value || value.startsWith("data:")) return undefined;
  try {
    return new URL(value, `${siteUrl}/`).toString();
  } catch {
    return undefined;
  }
}

export default function SeoHead() {
  const { lang, siteData, dataLoaded } = useApp();

  useEffect(() => {
    const path = window.location.pathname;
    const isInternalPage = path !== "/" && path !== "";
    const isArabic = lang === "ar";
    const siteUrl = (
      import.meta.env.VITE_SITE_URL ||
      (window.location.origin.includes(".replit.dev") ? DEFAULT_SITE_URL : window.location.origin)
    ).replace(/\/+$/, "");
    const canonicalUrl = `${siteUrl}${path || "/"}`;
    const title = isInternalPage
      ? isArabic
        ? `عروض أسعار زراعية | ${BRAND}`
        : `Agricultural Quotes | Al-Qadri Nurseries`
      : isArabic
        ? "معرض مشاتل القادري الإلكتروني | مشاتل الأردن"
        : "Al-Qadri Nurseries Online Showcase | Jordan";
    const description = isArabic
      ? "معرض مشاتل القادري الإلكتروني في الأردن: نباتات وأشجار زينة، حمضيات، مستلزمات زراعية، تنسيق حدائق وعطاءات زراعية مع طلب عرض سعر."
      : "Al-Qadri Nurseries online showcase in Jordan: ornamental trees, citrus, agricultural supplies, garden landscaping, and quote requests.";
    const robots = isInternalPage ? "noindex, nofollow" : "index, follow";

    document.title = title;
    document.documentElement.lang = isArabic ? "ar" : "en";
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", robots);
    upsertMeta("name", "author", "مشاتل القادري الزراعية");
    upsertMeta("name", "theme-color", "#255d3d");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:locale", isArabic ? "ar_JO" : "en_US");
    upsertMeta("property", "og:site_name", "معرض مشاتل القادري الإلكتروني");
    upsertMeta("property", "og:image", `${siteUrl}/opengraph.jpg`);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", `${siteUrl}/opengraph.jpg`);
    upsertCanonical(canonicalUrl);

    const existingSchema = document.head.querySelector<HTMLScriptElement>("#alqadri-seo-schema");
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          name: "معرض مشاتل القادري الإلكتروني",
          alternateName: "Al-Qadri Nurseries Online Showcase",
          url: siteUrl,
          inLanguage: ["ar", "en"],
        },
        {
          "@type": ["LocalBusiness", "Store"],
          "@id": `${siteUrl}/#business`,
          name: siteData.titleAr || "مشاتل القادري الزراعية",
          alternateName: siteData.titleEn || "Al-Qadri Agricultural Nurseries",
          description,
          url: siteUrl,
          image: `${siteUrl}/opengraph.jpg`,
          areaServed: {
            "@type": "Country",
            name: "Jordan",
          },
          knowsAbout: [
            "مشاتل الأردن",
            "نباتات الزينة",
            "الأشجار والحمضيات",
            "العطاءات الزراعية",
            "تنسيق الحدائق",
          ],
          ...(siteData.footer.phone && siteData.footer.phone !== "+966 50 123 4567"
            ? { telephone: siteData.footer.phone }
            : {}),
          ...(siteData.footer.email && siteData.footer.email !== "info@alqadrinurseries.com"
            ? { email: siteData.footer.email }
            : {}),
          ...(siteData.socialLinks?.length
            ? { sameAs: siteData.socialLinks.map((link) => link.url).filter(Boolean) }
            : {}),
          ...(siteData.branches?.length
            ? {
                department: siteData.branches.map((branch) => ({
                  "@type": "LocalBusiness",
                  name: branch.nameAr || branch.nameEn,
                  url: branch.locationUrl || siteUrl,
                  ...(branch.coordinates
                    ? {
                        geo: {
                          "@type": "GeoCoordinates",
                          ...(() => {
                            const [latitude, longitude] = branch.coordinates
                              .split(",")
                              .map((part) => Number(part.trim()));
                            return { latitude, longitude };
                          })(),
                        },
                      }
                    : {}),
                })),
              }
            : {}),
        },
        ...(siteData.sections?.length
          ? [
              {
                "@type": "ItemList",
                name: isArabic ? "نباتات وأشجار مشاتل القادري" : "Plants at Al-Qadri Nurseries",
                itemListElement: siteData.sections
                  .flatMap((section) =>
                    section.photos.slice(0, 20).map((photo) => ({
                      "@type": "ListItem",
                      position: 1,
                      name: isArabic ? photo.nameAr : photo.nameEn || photo.nameAr,
                      description: isArabic ? photo.descriptionAr : photo.descriptionEn || photo.descriptionAr,
                      image: absoluteUrl(siteUrl, photo.image),
                    })),
                  )
                  .map((item, index) => ({ ...item, position: index + 1 })),
              },
            ]
          : []),
      ],
    };
    if (existingSchema) {
      existingSchema.textContent = JSON.stringify(schema);
    } else {
      const script = document.createElement("script");
      script.id = "alqadri-seo-schema";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }, [lang, siteData, dataLoaded]);

  return null;
}