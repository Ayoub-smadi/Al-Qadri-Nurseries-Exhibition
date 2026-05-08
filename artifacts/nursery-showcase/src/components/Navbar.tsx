import React from 'react';
import { useApp } from '@/lib/context';
import { Moon, Sun, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function Navbar() {
  const { lang, setLang, theme, setTheme, isAdmin, setIsAdmin, t } = useApp();
  const [adminUsername, setAdminUsername] = React.useState('');
  const [adminPassword, setAdminPassword] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  const [isLoginOpen, setIsLoginOpen] = React.useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === 'admin' && adminPassword === 'admin123') {
      setIsAdmin(true);
      setIsLoginOpen(false);
      setAdminUsername('');
      setAdminPassword('');
      setLoginError('');
    } else {
      setLoginError(t.admin.error);
    }
  };

  return (
    <nav className="fixed top-0 w-full z-50 glass-panel py-4">
      <div className="container mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M12 2C12 2 5 6 5 13C5 17.5 8 22 12 22C16 22 19 17.5 19 13C19 6 12 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 22V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 17C12 17 9 16 9 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-bold text-xl tracking-tight hidden sm:block">
            {lang === 'ar' ? 'القادري' : 'Al-Qadri'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Toggle language"
          >
            <Globe className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {!isAdmin && (
            <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
              <DialogTrigger asChild>
                <button className="w-2 h-2 rounded-full opacity-10 hover:opacity-100 transition-opacity bg-foreground ml-2"></button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] glass-panel border-border">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-serif text-center">{t.admin.login_title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleLogin} className="space-y-6 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">{t.admin.username}</Label>
                    <Input 
                      id="username" 
                      value={adminUsername} 
                      onChange={e => setAdminUsername(e.target.value)} 
                      className="bg-background/50 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t.admin.password}</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={adminPassword} 
                      onChange={e => setAdminPassword(e.target.value)} 
                      className="bg-background/50 border-border"
                    />
                  </div>
                  {loginError && <p className="text-destructive text-sm">{loginError}</p>}
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
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
