import React from 'react';
import { useApp } from '@/lib/context';
import { Moon, Sun, Globe, ImagePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';

export function Navbar() {
  const { lang, setLang, theme, setTheme, isAdmin, setIsAdmin, t, siteData, updateSiteData } = useApp();
  const [, setLocation] = useLocation();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  const [isLoginOpen, setIsLoginOpen] = React.useState(false);
  const [isLogoOpen, setIsLogoOpen] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'Ayoub' && password === 'Ayoub@123') {
      setIsAdmin(true);
      setIsLoginOpen(false);
      setUsername('');
      setPassword('');
      setLoginError('');
    } else {
      setLoginError(t.admin.error);
    }
  };

  const handleLogoSave = () => {
    updateSiteData({ logo: { customUrl: logoUrl } });
    setIsLogoOpen(false);
  };

  const logoSrc = siteData.logo.customUrl;

  return (
    <nav
      className="fixed top-0 w-full z-50 glass-panel py-3"
      data-testid="navbar"
    >
      <div className="container mx-auto px-5 flex justify-between items-center">

        {/* Logo + Name */}
        <button
          onClick={() => setLocation('/')}
          className="flex items-center gap-3 group"
          data-testid="nav-logo"
        >
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="logo"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <LeafIcon className="w-6 h-6 text-primary" />
            </div>
          )}
          <span className="font-bold text-lg hidden sm:block text-foreground group-hover:text-primary transition-colors">
            {lang === 'ar' ? 'القادري' : 'Al-Qadri'}
          </span>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Language */}
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-xs font-bold"
            aria-label="Toggle language"
            data-testid="btn-toggle-lang"
          >
            {lang === 'ar' ? <Globe className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            <span className="sr-only">{lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>

          {/* Lang text label */}
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="text-xs font-semibold px-2 py-1 rounded-full bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            data-testid="btn-lang-label"
          >
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>

          {/* Dark mode */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
            data-testid="btn-toggle-theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Change logo (admin only) */}
          {isAdmin && (
            <Dialog open={isLogoOpen} onOpenChange={setIsLogoOpen}>
              <DialogTrigger asChild>
                <button
                  className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-primary/10 transition-colors text-primary"
                  aria-label="Change logo"
                  data-testid="btn-change-logo"
                  onClick={() => setLogoUrl(siteData.logo.customUrl)}
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="glass-panel sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl">{t.admin.change_logo}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-3">
                  <div className="space-y-2">
                    <Label>{t.admin.logo_url}</Label>
                    <Input
                      value={logoUrl}
                      onChange={e => setLogoUrl(e.target.value)}
                      placeholder={t.admin.logo_placeholder}
                      dir="ltr"
                    />
                  </div>
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="preview"
                      className="w-20 h-20 rounded-full object-cover mx-auto ring-2 ring-primary/30"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsLogoOpen(false)}>{t.admin.cancel}</Button>
                    <Button onClick={handleLogoSave} className="bg-primary text-primary-foreground hover:bg-primary/90">{t.admin.save_changes}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Hidden admin dot */}
          {!isAdmin && (
            <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
              <DialogTrigger asChild>
                <button
                  className="w-2 h-2 rounded-full opacity-0 hover:opacity-100 transition-opacity bg-foreground/40 ms-2"
                  aria-label="Admin login"
                  data-testid="btn-admin-trigger"
                />
              </DialogTrigger>
              <DialogContent className="glass-panel sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-2xl text-center">{t.admin.login_title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleLogin} className="space-y-5 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="adm-user">{t.admin.username}</Label>
                    <Input
                      id="adm-user"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      autoComplete="off"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adm-pass">{t.admin.password}</Label>
                    <Input
                      id="adm-pass"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                  {loginError && <p className="text-destructive text-sm">{loginError}</p>}
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {t.admin.login_btn}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </nav>
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
