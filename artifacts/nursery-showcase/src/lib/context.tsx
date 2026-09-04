import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchSiteData, persistSiteData, setSessionToken, loadSavedToken, validateToken, SiteData, DEFAULT_DATA, migrateSiteDataImages, migrateAllLegacyImages, mergeSiteDataPreservingImages } from '@/lib/storage';
import { toast } from 'sonner';

export type Language = 'ar' | 'en';

interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  isDark: boolean;
  toggleDark: () => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  siteData: SiteData;
  updateSiteData: (data: Partial<SiteData> | ((current: SiteData) => Partial<SiteData>)) => void;
  dataLoaded: boolean;
  sessionExpired: boolean;
  setSessionExpired: (v: boolean) => void;
}

const CACHE_KEY = 'gallery_site_data_cache';

function loadCache(): SiteData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as SiteData;
  } catch { /* ignore */ }
  return null;
}

function saveCache(data: SiteData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* ignore – storage full */ }
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar');
  const [isDark, setIsDark] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const cached = loadCache();
  const [siteData, setSiteData] = useState<SiteData>(cached ?? DEFAULT_DATA);
  const [dataLoaded, setDataLoaded] = useState(cached !== null);
  const siteDataRef = useRef<SiteData>(cached ?? DEFAULT_DATA);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const l = localStorage.getItem('gallery_lang') as Language;
    if (l === 'ar' || l === 'en') setLangState(l);
    const d = localStorage.getItem('gallery_dark');
    if (d === '1') { setIsDark(true); document.documentElement.classList.add('dark'); }

    async function init() {
      // Restore admin session from saved token (survives page refreshes)
      const savedToken = loadSavedToken();
      let sessionRestored = false;
      if (savedToken) {
        setSessionToken(savedToken);
        sessionRestored = await validateToken();
        if (sessionRestored) {
          setIsAdmin(true);
        } else {
          setSessionToken(null);
        }
      }
      if (sessionRestored) {
        // Backfill any legacy image rows in the background without delaying
        // the first render.
        void migrateAllLegacyImages();
      }

      const syncData = async (source: SiteData, cachedSource: SiteData | null = null) => {
        const imageSafeSource = mergeSiteDataPreservingImages(source, cachedSource);
        const restoredDataChanged = JSON.stringify(imageSafeSource) !== JSON.stringify(source);
        const migrated = sessionRestored ? await migrateSiteDataImages(imageSafeSource) : { data: imageSafeSource, changed: false };
        siteDataRef.current = migrated.data;
        setSiteData(migrated.data);
        saveCache(migrated.data);
        if (sessionRestored && (migrated.changed || restoredDataChanged)) {
          const result = await persistSiteData(migrated.data);
          if (result.ok) {
            console.log('[sync] image references migrated to Neon storage');
          } else {
            console.warn('[sync] image migration could not be persisted');
          }
        }
      };

      const serverData = await fetchSiteData();
      if (serverData !== null) {
        // Server has real saved data — use it and update cache
        await syncData(serverData, cached);
      } else if (sessionRestored) {
        // Admin session valid but server has no data — sync localStorage cache to DB
        const localData = loadCache();
        if (localData) await syncData(localData);
      }
      setDataLoaded(true);
    }

    init();
  }, []);

  useEffect(() => {
    if (!isAdmin || !dataLoaded) return;
    let active = true;
    void (async () => {
      const migrated = await migrateSiteDataImages(siteData);
      if (!active || !migrated.changed) return;
      siteDataRef.current = migrated.data;
      setSiteData(migrated.data);
      saveCache(migrated.data);
      const result = await persistSiteData(migrated.data);
      if (result.ok) {
        console.log('[sync] image references migrated to Neon storage');
      } else {
        console.warn('[sync] image migration could not be persisted');
      }
    })();
    return () => {
      active = false;
    };
  }, [isAdmin, dataLoaded]); // siteData intentionally captured once per admin session

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

  const updateSiteData = (data: Partial<SiteData> | ((current: SiteData) => Partial<SiteData>)) => {
    // Image uploads resolve asynchronously, so compose from the latest ref
    // rather than a potentially stale render closure.
    const patch = typeof data === 'function' ? data(siteDataRef.current) : data;
    const next = { ...siteDataRef.current, ...patch };
    siteDataRef.current = next;
    setSiteData(next);
    saveCache(next);
    // Serialize full-document writes so a slower earlier upload cannot land
    // after a newer edit and restore old image references.
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const result = await persistSiteData(next);
        if (result.ok) {
          toast.success(lang === 'ar' ? '✓ تم الحفظ' : '✓ Saved', { duration: 2000 });
        } else if (result.unauthorized) {
          setSessionToken(null);
          setIsAdmin(false);
          setSessionExpired(true);
        } else if (result.tooBig) {
          toast.error(
            lang === 'ar'
              ? 'حجم البيانات كبير جداً — حاول تقليل عدد الصور أو حجمها'
              : 'Data too large — try reducing the number or size of images',
            { duration: 8000 }
          );
        } else {
          toast.error(
            lang === 'ar'
              ? 'فشل حفظ البيانات — تحقق من الاتصال بالإنترنت'
              : 'Failed to save — check your internet connection',
            { duration: 5000 }
          );
        }
      });
  };

  return (
    <AppContext.Provider value={{ lang, setLang, isDark, toggleDark, isAdmin, setIsAdmin, siteData, updateSiteData, dataLoaded, sessionExpired, setSessionExpired }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be within AppProvider');
  return ctx;
}
