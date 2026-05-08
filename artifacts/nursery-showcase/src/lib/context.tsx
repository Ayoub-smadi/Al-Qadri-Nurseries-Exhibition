import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSiteData, saveSiteData, SiteData } from '@/lib/storage';

export type Language = 'ar' | 'en';

interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  siteData: SiteData;
  updateSiteData: (data: Partial<SiteData>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar');
  const [isAdmin, setIsAdmin] = useState(false);
  const [siteData, setSiteData] = useState<SiteData>(getSiteData());

  useEffect(() => {
    const l = localStorage.getItem('gallery_lang') as Language;
    if (l === 'ar' || l === 'en') setLangState(l);
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Language) => { setLangState(l); localStorage.setItem('gallery_lang', l); };

  const updateSiteData = (data: Partial<SiteData>) => {
    const next = { ...siteData, ...data };
    setSiteData(next);
    saveSiteData(next);
  };

  return (
    <AppContext.Provider value={{ lang, setLang, isAdmin, setIsAdmin, siteData, updateSiteData }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be within AppProvider');
  return ctx;
}
