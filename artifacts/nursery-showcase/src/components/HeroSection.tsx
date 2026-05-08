import React from 'react';
import { useApp } from '@/lib/context';

export function HeroSection() {
  const { lang, isAdmin, siteData, updateSiteData } = useApp();

  const title = lang === 'ar' ? siteData.hero.titleAr : siteData.hero.titleEn;
  const subtitle = lang === 'ar' ? siteData.hero.subtitleAr : siteData.hero.subtitleEn;

  const updateField = (field: keyof typeof siteData.hero, value: string) => {
    updateSiteData({ hero: { ...siteData.hero, [field]: value } });
  };

  return (
    <section className="relative min-h-[82vh] flex items-center justify-center overflow-hidden">

      {/* Floating organic shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <svg
          className="absolute top-[12%] left-[6%] animate-float-1 opacity-[0.12] dark:opacity-[0.07] text-primary w-72 h-72"
          viewBox="0 0 200 200" fill="currentColor"
        >
          <path d="M100 10C130 10 175 40 180 80C185 120 160 170 120 185C80 200 30 180 15 140C0 100 20 50 55 25C70 16 85 10 100 10Z" />
        </svg>
        <svg
          className="absolute bottom-[14%] right-[8%] animate-float-2 opacity-[0.10] dark:opacity-[0.06] text-primary w-56 h-56"
          viewBox="0 0 200 200" fill="currentColor"
        >
          <path d="M100 5C145 5 190 45 195 90C200 135 175 185 130 195C85 205 30 185 10 140C-10 95 10 40 50 18C65 10 82 5 100 5Z" />
        </svg>
        <svg
          className="absolute top-[50%] left-[40%] animate-float-3 opacity-[0.07] dark:opacity-[0.04] text-foreground w-40 h-40"
          viewBox="0 0 100 100" fill="currentColor"
        >
          <path d="M50 2C70 2 95 22 98 45C101 68 85 92 62 98C39 104 12 90 5 67C-2 44 12 18 32 8C38 5 44 2 50 2Z" />
        </svg>
        <svg
          className="absolute top-[20%] right-[25%] animate-float-4 opacity-[0.08] dark:opacity-[0.05] text-primary w-28 h-28"
          viewBox="0 0 100 100" fill="currentColor"
        >
          <ellipse cx="50" cy="50" rx="40" ry="48" />
        </svg>
        {/* Thin ornamental lines */}
        <div className="absolute top-[35%] left-0 w-32 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="absolute top-[65%] right-0 w-32 h-px bg-gradient-to-l from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center max-w-4xl">

        {/* Small label */}
        <div className="mb-6 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/8 text-primary text-sm font-medium tracking-widest uppercase animate-in fade-in slide-in-from-bottom-4 duration-700">
          {lang === 'ar' ? 'مرحباً بكم' : 'Welcome'}
        </div>

        {/* Main title */}
        <h1
          className={`text-5xl md:text-7xl lg:text-8xl font-bold mb-5 leading-[1.12] text-foreground animate-in fade-in slide-in-from-bottom-6 duration-900 delay-100 ${isAdmin ? 'admin-editable' : ''}`}
          contentEditable={isAdmin}
          suppressContentEditableWarning
          onBlur={e => updateField(lang === 'ar' ? 'titleAr' : 'titleEn', e.currentTarget.textContent || '')}
          data-testid="hero-title"
          style={{ fontFamily: lang === 'ar' ? 'var(--app-font-arabic)' : 'var(--app-font-serif)' }}
        >
          {title}
        </h1>

        {/* Ornamental divider */}
        <div className="flex items-center gap-4 mb-7 animate-in fade-in duration-700 delay-200">
          <div className="w-16 h-px bg-gradient-to-r from-transparent to-primary/60" />
          <div className="w-2 h-2 rounded-full bg-primary/60" />
          <div className="w-16 h-px bg-gradient-to-l from-transparent to-primary/60" />
        </div>

        {/* Subtitle */}
        <p
          className={`text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl animate-in fade-in slide-in-from-bottom-6 duration-900 delay-300 ${isAdmin ? 'admin-editable' : ''}`}
          contentEditable={isAdmin}
          suppressContentEditableWarning
          onBlur={e => updateField(lang === 'ar' ? 'subtitleAr' : 'subtitleEn', e.currentTarget.textContent || '')}
          data-testid="hero-subtitle"
        >
          {subtitle}
        </p>

        {/* Scroll cue */}
        <div className="mt-14 animate-bounce opacity-40">
          <svg className="w-5 h-5 text-primary mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </section>
  );
}
