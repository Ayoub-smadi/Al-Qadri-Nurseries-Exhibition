import React from 'react';
import { useApp } from '@/lib/context';
import { EditableText } from './EditableText';
import { Instagram, Twitter, Facebook, Phone, Mail, MapPin } from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';

export function Footer() {
  const { siteData, lang } = useApp();

  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          
          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                <path d="M12 2C12 2 5 6 5 13C5 17.5 8 22 12 22C16 22 19 17.5 19 13C19 6 12 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 22V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 17C12 17 9 16 9 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-bold text-2xl font-serif">
                {lang === 'ar' ? 'مشاتل القادري' : 'Al-Qadri Nurseries'}
              </span>
            </div>
            <p className="text-background/70 leading-relaxed max-w-xs">
              {lang === 'ar' 
                ? 'نقدم لكم أجمل النباتات وأفضل طرق العناية بها لنجعل مساحاتكم تنبض بالحياة.'
                : 'Providing you with the most beautiful plants and expert care to bring your spaces to life.'}
            </p>
          </div>

          {/* Contact */}
          <div className="space-y-6">
            <h4 className="text-lg font-bold font-serif">{lang === 'ar' ? 'تواصل معنا' : 'Contact Us'}</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-background/80">
                <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
                <EditableText section="footer" field={lang === 'ar' ? 'addressAr' : 'addressEn'} textKey="" />
              </li>
              <li className="flex items-center gap-3 text-background/80">
                <Phone className="w-5 h-5 shrink-0 text-primary" />
                <EditableText section="footer" field="phone" textKey="" dir="ltr" />
              </li>
              <li className="flex items-center gap-3 text-background/80">
                <Mail className="w-5 h-5 shrink-0 text-primary" />
                <EditableText section="footer" field="email" textKey="" />
              </li>
            </ul>
          </div>

          {/* Social */}
          <div className="space-y-6">
            <h4 className="text-lg font-bold font-serif">{lang === 'ar' ? 'تابعنا' : 'Follow Us'}</h4>
            <div className="flex flex-col gap-4">
              <EditableSocialLink icon={<Instagram className="w-5 h-5" />} field="instagram" label="Instagram" />
              <EditableSocialLink icon={<SiWhatsapp className="w-5 h-5" />} field="whatsapp" label="WhatsApp" />
              <EditableSocialLink icon={<Twitter className="w-5 h-5" />} field="twitter" label="Twitter" />
              <EditableSocialLink icon={<Facebook className="w-5 h-5" />} field="facebook" label="Facebook" />
            </div>
          </div>
          
        </div>
        
        <div className="mt-16 pt-8 border-t border-background/10 text-center text-background/50 text-sm">
          <p>© {new Date().getFullYear()} {lang === 'ar' ? 'معرض مشاتل القادري الزراعية. جميع الحقوق محفوظة.' : 'Al-Qadri Agricultural Nurseries. All rights reserved.'}</p>
        </div>
      </div>
    </footer>
  );
}

function EditableSocialLink({ icon, field, label }: { icon: React.ReactNode, field: string, label: string }) {
  const { siteData, updateSiteData, isAdmin } = useApp();
  
  const value = (siteData.footer as any)[field] || '';

  const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
    if (!isAdmin) return;
    const newData = JSON.parse(JSON.stringify(siteData));
    newData.footer[field] = e.currentTarget.textContent;
    updateSiteData(newData);
  };

  return (
    <div className="flex items-center gap-3 group">
      <a href={isAdmin ? '#' : value} target={isAdmin ? '_self' : '_blank'} rel="noreferrer" className="text-background/80 hover:text-primary transition-colors flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-background/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          {icon}
        </div>
      </a>
      {isAdmin ? (
        <span 
          className="admin-editable text-background/60 text-sm p-1 max-w-[200px] truncate block"
          contentEditable
          suppressContentEditableWarning
          onBlur={handleInput}
          dir="ltr"
        >
          {value || label}
        </span>
      ) : (
        <span className="text-background/80">{label}</span>
      )}
    </div>
  );
}
