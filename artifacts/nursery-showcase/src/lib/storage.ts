import plant1 from "@/assets/images/plant-1.png";
import plant2 from "@/assets/images/plant-2.png";
import plant3 from "@/assets/images/plant-3.png";
import plant4 from "@/assets/images/plant-4.png";
import plant5 from "@/assets/images/plant-5.png";
import plant6 from "@/assets/images/plant-6.png";
import plant7 from "@/assets/images/plant-7.png";
import plant8 from "@/assets/images/plant-8.png";

export interface Plant {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  image: string;
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  image: string;
  plants: Plant[];
}

export interface SiteData {
  hero: {
    titleAr: string;
    titleEn: string;
    subtitleAr: string;
    subtitleEn: string;
  };
  logo: {
    customUrl: string;
  };
  categories: Category[];
  footer: {
    addressAr: string;
    addressEn: string;
    email: string;
    phone: string;
    instagram: string;
    whatsapp: string;
    twitter: string;
    facebook: string;
  };
}

const DEFAULT_DATA: SiteData = {
  hero: {
    titleAr: "معرض مشاتل القادري الزراعية",
    titleEn: "Al-Qadri Agricultural Nurseries",
    subtitleAr: "نباتات مختارة بعناية لتزيين مساحاتكم وإضفاء الحياة عليها",
    subtitleEn: "Carefully selected plants to beautify your spaces and bring them to life",
  },
  logo: {
    customUrl: "",
  },
  categories: [
    {
      id: "citrus",
      nameAr: "الحمضيات",
      nameEn: "Citrus Trees",
      descAr: "أشجار حمضيات طازجة — برتقال وليمون ويوسفندي وغيرها",
      descEn: "Fresh citrus trees — oranges, lemons, mandarins and more",
      image: plant1,
      plants: [
        {
          id: "citrus-1",
          nameAr: "برتقال",
          nameEn: "Orange Tree",
          descAr: "شجرة برتقال مثمرة بثمار حلوة العصير، تزدهر في المناخ الدافئ",
          descEn: "Fruitful orange tree with sweet juicy fruits, thrives in warm climates",
          image: plant2,
        },
        {
          id: "citrus-2",
          nameAr: "ليمون",
          nameEn: "Lemon Tree",
          descAr: "شجرة ليمون عطرية بثمار حامضة مميزة، مثالية للحدائق والأوعية",
          descEn: "Aromatic lemon tree with distinctive tart fruits, ideal for gardens and pots",
          image: plant3,
        },
        {
          id: "citrus-3",
          nameAr: "يوسفندي",
          nameEn: "Mandarin Tree",
          descAr: "شجرة يوسفندي بثمار صغيرة حلوة سهلة التقشير، مناسبة لجميع المساحات",
          descEn: "Mandarin tree with small sweet easy-to-peel fruits, suitable for all spaces",
          image: plant4,
        },
        {
          id: "citrus-4",
          nameAr: "كريفون",
          nameEn: "Grapefruit Tree",
          descAr: "شجرة جريب فروت بثمار كبيرة منعشة غنية بالفيتامينات",
          descEn: "Grapefruit tree with large refreshing vitamin-rich fruits",
          image: plant5,
        },
      ],
    },
    {
      id: "indoor",
      nameAr: "نباتات الداخل",
      nameEn: "Indoor Plants",
      descAr: "نباتات داخلية راقية تضفي جمالاً وحيوية على كل مساحة",
      descEn: "Premium indoor plants that add elegance and vitality to every space",
      image: plant5,
      plants: [
        {
          id: "indoor-1",
          nameAr: "مونستيرا",
          nameEn: "Monstera Deliciosa",
          descAr: "نبتة استوائية كلاسيكية بأوراق مميزة ومثقبة، مثالية للمساحات الكبيرة",
          descEn: "Classic tropical plant with iconic fenestrated leaves, perfect for large spaces",
          image: plant1,
        },
        {
          id: "indoor-2",
          nameAr: "كالاتيا",
          nameEn: "Calathea",
          descAr: "نبتة داخلية جذابة بأوراق مزخرفة بأنماط فريدة ورسومات طبيعية",
          descEn: "Attractive indoor plant with uniquely patterned leaves and natural artwork",
          image: plant4,
        },
        {
          id: "indoor-3",
          nameAr: "فيلوديندرون",
          nameEn: "Philodendron",
          descAr: "نبات متدلٍّ بأوراق خضراء لامعة على شكل قلب، سهل العناية",
          descEn: "Trailing plant with glossy heart-shaped leaves, easy to care for",
          image: plant6,
        },
        {
          id: "indoor-4",
          nameAr: "زاميوكولكاس",
          nameEn: "ZZ Plant",
          descAr: "نبتة قوية للغاية بأوراق داكنة لامعة، تتحمل الإضاءة المنخفضة",
          descEn: "Extremely resilient dark glossy plant that tolerates low light",
          image: plant8,
        },
      ],
    },
    {
      id: "ornamental",
      nameAr: "أشجار الزينة",
      nameEn: "Ornamental Trees",
      descAr: "أشجار زينة فاخرة تمنح حدائقكم طابعاً استثنائياً",
      descEn: "Luxury ornamental trees that give your gardens an exceptional character",
      image: plant6,
      plants: [
        {
          id: "orn-1",
          nameAr: "عصفور الجنة",
          nameEn: "Bird of Paradise",
          descAr: "نبتة مذهلة بأوراق كبيرة استوائية تضيف لمسة فخمة ودرامية",
          descEn: "Stunning plant with large tropical leaves adding a luxurious dramatic touch",
          image: plant3,
        },
        {
          id: "orn-2",
          nameAr: "شجرة الزيتون",
          nameEn: "Olive Tree",
          descAr: "شجرة متوسطية كلاسيكية بأوراق فضية خضراء للبيئات المشمسة",
          descEn: "Classic Mediterranean tree with silvery-green leaves for sunny environments",
          image: plant5,
        },
        {
          id: "orn-3",
          nameAr: "ألوكاسيا",
          nameEn: "Alocasia",
          descAr: "نبتة استوائية بأوراق كبيرة على شكل سهم تضفي مظهراً درامياً رائعاً",
          descEn: "Tropical plant with large arrow-shaped leaves for a dramatic appearance",
          image: plant7,
        },
        {
          id: "orn-4",
          nameAr: "تين ليراتا",
          nameEn: "Fiddle Leaf Fig",
          descAr: "شجرة داخلية راقية بأوراق عريضة على شكل كمان، لمسة أناقة حقيقية",
          descEn: "Elegant indoor tree with broad violin-shaped leaves for true sophistication",
          image: plant2,
        },
      ],
    },
    {
      id: "outdoor",
      nameAr: "نباتات خارجية",
      nameEn: "Outdoor Plants",
      descAr: "نباتات خارجية متينة لتزيين الحدائق والمداخل والمساحات المفتوحة",
      descEn: "Resilient outdoor plants for beautifying gardens, entrances and open spaces",
      image: plant7,
      plants: [
        {
          id: "out-1",
          nameAr: "ألوكاسيا خارجية",
          nameEn: "Outdoor Alocasia",
          descAr: "نبتة قوية تتحمل الظروف الخارجية وتزدهر في الحدائق المشمسة",
          descEn: "Tough plant that withstands outdoor conditions, thrives in sunny gardens",
          image: plant7,
        },
        {
          id: "out-2",
          nameAr: "زاميوكولكاس خارجي",
          nameEn: "Outdoor ZZ",
          descAr: "نبتة خارجية متحملة للجفاف وقليلة الاحتياجات، مثالية للمناخ الحار",
          descEn: "Drought-tolerant outdoor plant with minimal needs, ideal for hot climates",
          image: plant8,
        },
        {
          id: "out-3",
          nameAr: "مونستيرا خارجية",
          nameEn: "Outdoor Monstera",
          descAr: "نبتة مونستيرا كبيرة مناسبة للفضاءات الخارجية المظللة والدافئة",
          descEn: "Large monstera suited to shaded warm outdoor spaces",
          image: plant1,
        },
        {
          id: "out-4",
          nameAr: "فيلوديندرون خارجي",
          nameEn: "Outdoor Philodendron",
          descAr: "نبات متدلٍّ مناسب للشرفات والمداخل، ينمو بسرعة ويكسو الجدران بالخضار",
          descEn: "Trailing plant for balconies and entrances, grows fast and covers walls in green",
          image: plant6,
        },
      ],
    },
  ],
  footer: {
    addressAr: "الرياض، المملكة العربية السعودية",
    addressEn: "Riyadh, Saudi Arabia",
    email: "info@alqadrinurseries.com",
    phone: "+966 50 123 4567",
    instagram: "https://instagram.com",
    whatsapp: "https://wa.me/966501234567",
    twitter: "https://twitter.com",
    facebook: "https://facebook.com",
  },
};

const STORAGE_KEY = "alqadri_v2_site_data";

export function getSiteData(): SiteData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as SiteData;
      return {
        ...DEFAULT_DATA,
        ...parsed,
        hero: { ...DEFAULT_DATA.hero, ...parsed.hero },
        logo: { ...DEFAULT_DATA.logo, ...parsed.logo },
        footer: { ...DEFAULT_DATA.footer, ...parsed.footer },
        categories: parsed.categories?.length ? parsed.categories : DEFAULT_DATA.categories,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_DATA;
}

export function saveSiteData(data: SiteData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
