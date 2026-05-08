import React from 'react';
import { useApp } from '@/lib/context';
import { Instagram, Twitter, Facebook, Phone, Mail, MapPin } from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';

export function Footer() {
  const { siteData, updateSiteData, lang, isAdmin } = useApp();
  const f = siteData.footer;

  const updateFooter = (field: keyof typeof f, value: string) => {
    updateSiteData({ footer: { ...f, [field]: value } });
  };

  const EditField = ({
    field,
    dir = 'auto',
    className = '',
  }: {
    field: keyof typeof f;
    dir?: 'ltr' | 'rtl' | 'auto';
    className?: string;
  }) => (
    <span
      className={`${className} ${isAdmin ? 'admin-editable' : ''}`}
      contentEditable={isAdmin}
      suppressContentEditableWarning
      onBlur={e => updateFooter(field, e.currentTarget.textContent || '')}
      dir={dir}
    >
      {f[field]}
    </span>
  );

  return (
    <footer className="bg-foreground text-background pt-16 pb-8">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-14">

          {/* Brand column */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <LeafIcon className="w-5 h-5 text-primary" />
              </div>
              <span className="font-bold text-xl" style={{ fontFamily: lang === 'ar' ? 'var(--app-font-arabic)' : 'var(--app-font-serif)' }}>
                {lang === 'ar' ? 'مشاتل القادري' : 'Al-Qadri Nurseries'}
              </span>
            </div>
            <p className="text-background/65 text-sm leading-relaxed max-w-xs">
              {lang === 'ar'
                ? 'نقدم لكم أجمل النباتات وأفضل طرق العناية بها لنجعل مساحاتكم تنبض بالحياة.'
                : 'Providing you the most beautiful plants and expert care to bring your spaces to life.'}
            </p>
          </div>

          {/* Contact column */}
          <div className="space-y-5">
            <h4 className="text-base font-bold tracking-wide" style={{ fontFamily: lang === 'ar' ? 'var(--app-font-arabic)' : 'var(--app-font-serif)' }}>
              {lang === 'ar' ? 'تواصل معنا' : 'Contact Us'}
            </h4>
            <ul className="space-y-3.5">
              <li className="flex items-start gap-3 text-background/70 text-sm">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <EditField field={lang === 'ar' ? 'addressAr' : 'addressEn'} />
              </li>
              <li className="flex items-center gap-3 text-background/70 text-sm">
                <Phone className="w-4 h-4 shrink-0 text-primary" />
                <EditField field="phone" dir="ltr" />
              </li>
              <li className="flex items-center gap-3 text-background/70 text-sm">
                <Mail className="w-4 h-4 shrink-0 text-primary" />
                <EditField field="email" dir="ltr" />
              </li>
            </ul>
          </div>

          {/* Social column */}
          <div className="space-y-5">
            <h4 className="text-base font-bold tracking-wide" style={{ fontFamily: lang === 'ar' ? 'var(--app-font-arabic)' : 'var(--app-font-serif)' }}>
              {lang === 'ar' ? 'تابعنا' : 'Follow Us'}
            </h4>
            <div className="flex gap-3">
              {[
                { icon: <Instagram className="w-4 h-4" />, field: 'instagram' as const },
                { icon: <SiWhatsapp className="w-4 h-4" />, field: 'whatsapp' as const },
                { icon: <Twitter className="w-4 h-4" />, field: 'twitter' as const },
                { icon: <Facebook className="w-4 h-4" />, field: 'facebook' as const },
              ].map(({ icon, field }) => (
                <a
                  key={field}
                  href={isAdmin ? '#' : f[field]}
                  target={isAdmin ? '_self' : '_blank'}
                  rel="noreferrer"
                  onClick={e => {
                    if (isAdmin) {
                      e.preventDefault();
                      const url = prompt(field + ':', f[field]);
                      if (url !== null) updateFooter(field, url);
                    }
                  }}
                  className="w-9 h-9 rounded-full bg-background/8 border border-background/15 flex items-center justify-center text-background/70 hover:text-primary hover:bg-primary/20 hover:border-primary/30 transition-all duration-200"
                  data-testid={`link-social-${field}`}
                >
                  {icon}
                </a>
              ))}
            </div>
            {isAdmin && (
              <p className="text-background/40 text-xs">{lang === 'ar' ? 'انقر على أيقونة لتغيير الرابط' : 'Click an icon to change its link'}</p>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-background/10 text-center text-background/40 text-xs">
          &copy; {new Date().getFullYear()} {lang === 'ar' ? 'معرض مشاتل القادري الزراعية — جميع الحقوق محفوظة' : 'Al-Qadri Agricultural Nurseries — All rights reserved'}
        </div>
      </div>
    </footer>
  );
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}
