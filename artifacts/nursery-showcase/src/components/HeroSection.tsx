import React from 'react';
import { EditableText } from './EditableText';
import { useApp } from '@/lib/context';

export function HeroSection() {
  const { lang } = useApp();

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
        <svg className="absolute top-[20%] left-[10%] animate-float-1 w-64 h-64 text-primary" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 0 C50 0 80 20 80 50 C80 80 50 100 50 100 C50 100 20 80 20 50 C20 20 50 0 50 0 Z" />
        </svg>
        <svg className="absolute top-[60%] right-[15%] animate-float-2 w-48 h-48 text-accent" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 0 C80 0 100 20 100 50 C100 80 80 100 50 100 C20 100 0 80 0 50 C0 20 20 0 50 0 Z" />
        </svg>
        <svg className="absolute top-[30%] right-[30%] animate-float-3 w-32 h-32 text-primary" viewBox="0 0 100 100" fill="currentColor">
          <path d="M0 50 C0 50 40 0 50 0 C60 0 100 50 100 50 C100 50 60 100 50 100 C40 100 0 50 0 50 Z" />
        </svg>
      </div>

      <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center">
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
          <EditableText 
            as="h1"
            section="hero"
            field={lang === 'ar' ? 'titleAr' : 'titleEn'}
            textKey="title"
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight text-foreground font-serif leading-tight"
          />
        </div>
        
        <div className="w-24 h-1 bg-primary mx-auto mb-8 animate-in fade-in slide-in-from-left-8 duration-1000 delay-300 rounded-full" />
        
        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
          <EditableText 
            as="p"
            section="hero"
            field={lang === 'ar' ? 'subtitleAr' : 'subtitleEn'}
            textKey="subtitle"
            multiline
            className="text-lg md:text-2xl text-muted-foreground leading-relaxed font-sans"
          />
        </div>
      </div>
    </section>
  );
}
