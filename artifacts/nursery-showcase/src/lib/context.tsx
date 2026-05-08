import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSiteData, saveSiteData, SiteData } from '@/lib/storage';

export type Language = 'ar' | 'en';

interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  isDark: boolean;
  toggleDark: () => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  siteData: SiteData;
  updateSiteData: (data: Partial<SiteData>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar');
  const [isDark, setIsDark] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [siteData, setSiteData] = useState<SiteData>(getSiteData());

  useEffect(() => {
    const l = localStorage.getItem('gallery_lang') as Language;
    if (l === 'ar' || l === 'en') setLangState(l);
    const d = localStorage.getItem('gallery_dark');
    if (d === '1') { setIsDark(true); document.documentElement.classList.add('dark'); }
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Language) => { setLangState(l); localStorage.setItem('gallery_lang', l); };

  const toggleDark = () => {
    setIsDark(prev => {
      const next = !prev;
      if (next) { document.documentElement.classList.add('dark'); localStorage.setItem('gallery_dark', '1'); }
      else { document.documentElement.classList.remove('dark'); localStorage.setItem('gallery_dark', '0'); }
      return next;
    });
  };

  const updateSiteData = (data: Partial<SiteData>) => {
    const next = { ...siteData, ...data };
    setSiteData(next);
    saveSiteData(next);
  };

  return (
    <AppContext.Provider value={{ lang, setLang, isDark, toggleDark, isAdmin, setIsAdmin, siteData, updateSiteData }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be within AppProvider');
  return ctx;
}
