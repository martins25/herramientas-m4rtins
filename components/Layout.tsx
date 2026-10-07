import * as React from 'react';
import { Link } from 'react-router-dom';
import { Github, ExternalLink } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const SITE = 'https://m4rtins.com';
const REPO = 'https://github.com/'; // ← sustituye por la URL de tu repositorio

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#020617] font-sans">
      <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-slate-800 bg-[#020617]/95 backdrop-blur-md py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link to="/herramientas" className="text-xl font-bold text-white">
            Adrián<span className="text-cyber-400">Martín</span>
            <span className="ml-2 text-sm font-medium text-slate-400">· Herramientas</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <a href={SITE} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-cyber-400 transition-colors inline-flex items-center gap-1">
              m4rtins.com <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-cyber-400 transition-colors inline-flex items-center gap-1">
              <Github className="w-4 h-4" /> Código
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-grow bg-[#020617]">{children}</main>

      <footer className="bg-[#020617] border-t border-slate-800 py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Adrián Martín. Herramientas de ciberseguridad de código abierto.</p>
          <div className="flex gap-5">
            <a href={SITE} target="_blank" rel="noopener noreferrer" className="hover:text-cyber-400 transition-colors">Web</a>
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="hover:text-cyber-400 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
