import React from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { PlantGallery } from '@/components/PlantGallery';
import { Footer } from '@/components/Footer';
import { EditToolbar } from '@/components/EditToolbar';

export default function Home() {
  return (
    <main className="min-h-screen w-full flex flex-col relative selection:bg-primary selection:text-white">
      <Navbar />
      <HeroSection />
      <PlantGallery />
      <Footer />
      <EditToolbar />
    </main>
  );
}
