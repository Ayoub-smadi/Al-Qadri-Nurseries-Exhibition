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

export interface SiteData {
  hero: {
    titleAr: string;
    titleEn: string;
    subtitleAr: string;
    subtitleEn: string;
  };
  gallery: {
    titleAr: string;
    titleEn: string;
    subtitleAr: string;
    subtitleEn: string;
  };
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
  plants: Plant[];
}

const DEFAULT_DATA: SiteData = {
  hero: {
    titleAr: "معرض مشاتل القادري الزراعية",
    titleEn: "Al-Qadri Agricultural Nurseries",
    subtitleAr: "نباتات داخلية وخارجية مميزة لإضفاء الحيوية والجمال على مساحاتكم.",
    subtitleEn: "Premium indoor and outdoor plants to bring life and beauty to your spaces.",
  },
  gallery: {
    titleAr: "المجموعة النباتية",
    titleEn: "Botanical Collection",
    subtitleAr: "اكتشف مجموعتنا المختارة بعناية من النباتات الراقية",
    subtitleEn: "Discover our carefully curated selection of premium plants",
  },
  footer: {
    addressAr: "الرياض، المملكة العربية السعودية",
    addressEn: "Riyadh, Saudi Arabia",
    email: "info@alqadrinurseries.com",
    phone: "+966 50 123 4567",
    instagram: "https://instagram.com",
    whatsapp: "https://whatsapp.com",
    twitter: "https://twitter.com",
    facebook: "https://facebook.com",
  },
  plants: [
    {
      id: "1",
      nameAr: "مونستيرا ديليسيوزا",
      nameEn: "Monstera Deliciosa",
      descAr: "نبتة استوائية كلاسيكية بأوراق مميزة ومثقبة. مثالية للمساحات الداخلية الكبيرة.",
      descEn: "Classic tropical plant with iconic fenestrated leaves. Perfect for large indoor spaces.",
      image: plant1,
    },
    {
      id: "2",
      nameAr: "تين ليراتا",
      nameEn: "Fiddle Leaf Fig",
      descAr: "شجرة داخلية رائعة بأوراق عريضة تشبه الكمان. تضفي لمسة من الأناقة.",
      descEn: "Stunning indoor tree with broad, violin-shaped leaves. Adds a touch of elegance.",
      image: plant2,
    },
    {
      id: "3",
      nameAr: "عصفور الجنة",
      nameEn: "Bird of Paradise",
      descAr: "نبتة مذهلة بأوراق كبيرة تشبه أوراق الموز. تضيف لمسة استوائية فخمة.",
      descEn: "Striking plant with large, banana-like leaves. Adds a luxurious tropical feel.",
      image: plant3,
    },
    {
      id: "4",
      nameAr: "كالاتيا",
      nameEn: "Calathea",
      descAr: "نبتة داخلية جذابة بأوراق مزخرفة بأنماط فريدة. تتطلب عناية خاصة.",
      descEn: "Attractive indoor plant with uniquely patterned leaves. Requires special care.",
      image: plant4,
    },
    {
      id: "5",
      nameAr: "شجرة الزيتون",
      nameEn: "Olive Tree",
      descAr: "شجرة متوسطية كلاسيكية بأوراق فضية خضراء. مناسبة للبيئات المشمسة.",
      descEn: "Classic Mediterranean tree with silvery-green leaves. Suited for sunny environments.",
      image: plant5,
    },
    {
      id: "6",
      nameAr: "فيلوديندرون",
      nameEn: "Philodendron",
      descAr: "نبات متدلي بأوراق خضراء لامعة على شكل قلب. سهل العناية ومثالي للمبتدئين.",
      descEn: "Trailing plant with glossy green, heart-shaped leaves. Easy to care for and perfect for beginners.",
      image: plant6,
    },
    {
      id: "7",
      nameAr: "ألوكاسيا",
      nameEn: "Alocasia",
      descAr: "نبتة استوائية بأوراق كبيرة على شكل سهم. تضفي مظهراً درامياً للمساحات الداخلية.",
      descEn: "Tropical plant with large arrow-shaped leaves. Adds a dramatic look to indoor spaces.",
      image: plant7,
    },
    {
      id: "8",
      nameAr: "زاميوكولكاس",
      nameEn: "ZZ Plant",
      descAr: "نبتة قوية للغاية بأوراق خضراء داكنة ولامعة. تتحمل الإضاءة المنخفضة.",
      descEn: "Extremely resilient plant with dark, glossy green leaves. Tolerates low light.",
      image: plant8,
    }
  ]
};

const STORAGE_KEY = 'alqadri_site_data';

export function getSiteData(): SiteData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // Merge with default data to handle any schema updates
      return { ...DEFAULT_DATA, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to parse site data from localStorage", e);
  }
  return DEFAULT_DATA;
}

export function saveSiteData(data: SiteData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
