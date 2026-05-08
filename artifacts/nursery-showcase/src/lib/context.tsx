import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '@/lib/translations';
import { getSiteData, saveSiteData, SiteData } from '@/lib/storage';

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: typeof translations.en;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  siteData: SiteData;
  updateSiteData: (data: Partial<SiteData>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar');
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [isAdmin, setIsAdmin] = useState(false);
  const [siteData, setSiteData] = useState<SiteData>(getSiteData());

  // Initialize from localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem('app_lang') as Language;
    if (savedLang && (savedLang === 'ar' || savedLang === 'en')) {
      setLangState(savedLang);
    }
    
    const savedTheme = localStorage.getItem('app_theme') as 'light' | 'dark';
    if (savedTheme) {
      setThemeState(savedTheme);
    }
  }, []);

  // Update document direction and theme class
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [lang, theme]);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('app_theme', newTheme);
  };

  const updateSiteData = (data: Partial<SiteData>) => {
    const newData = { ...siteData, ...data };
    setSiteData(newData);
    saveSiteData(newData);
  };

  const t = translations[lang];

  return (
    <AppContext.Provider value={{ 
      lang, setLang, t, 
      theme, setTheme, 
      isAdmin, setIsAdmin,
      siteData, updateSiteData
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
