import React from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { CategoryGallery } from '@/components/CategoryGallery';
import { Footer } from '@/components/Footer';
import { EditToolbar } from '@/components/EditToolbar';

export default function Home() {
  return (
    <main className="min-h-screen w-full flex flex-col relative">
      <Navbar />
      <div className="pt-16">
        <HeroSection />
        <CategoryGallery />
        <Footer />
      </div>
      <EditToolbar />
    </main>
  );
}
