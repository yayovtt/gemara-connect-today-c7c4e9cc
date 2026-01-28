import { Search, Sparkles, Book } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Header() {
  const location = useLocation();
  
  return (
    <header className="bg-navy border-b-4 border-gold sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gold rounded-xl flex items-center justify-center shadow-md">
                <Search className="w-6 h-6 text-navy" />
              </div>
              <Sparkles className="w-4 h-4 text-gold absolute -top-1 -left-1 animate-pulse-soft" />
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold text-white">חיפוש חכם</h1>
              <p className="text-sm text-gold-light">ניתוח טקסטים מתקדם</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className={cn(
                "px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2",
                location.pathname === '/' 
                  ? "bg-gold text-navy" 
                  : "text-white hover:bg-white/10"
              )}
            >
              <Search className="w-4 h-4" />
              חיפוש
            </Link>
            <Link
              to="/index"
              className={cn(
                "px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2",
                location.pathname === '/index' 
                  ? "bg-gold text-navy" 
                  : "text-white hover:bg-white/10"
              )}
            >
              <Book className="w-4 h-4" />
              אינדקס
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
