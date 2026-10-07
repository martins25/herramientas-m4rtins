import React from 'react';
import { Hash, ChevronLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionTitle } from '../components/SectionTitle';
import { TOOLS } from './tools/registry';
import { Seo } from '../components/Seo';

export const ToolsPage: React.FC = () => {
  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="Herramientas de Ciberseguridad Gratis Online | Adrián Martín"
        description="Herramientas gratuitas de ciberseguridad que funcionan en tu navegador: generador de contraseñas seguras y consulta de IP pública (IPv4 e IPv6)."
        path="/herramientas"
      />
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-cyber-400 hover:text-cyber-300 transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver al inicio
          </Link>
          <SectionTitle
            title="Herramientas"
            subtitle="Utilidades de ciberseguridad hechas por mí, que se ejecutan directamente en tu navegador."
          />
        </div>

        <div className="grid gap-8 sm:grid-cols-2 max-w-4xl mx-auto">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const card = (
              <article className="animated-border-card bg-cyber-800 rounded-2xl h-full group">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-cyber-400/10 text-cyber-400 border border-cyber-400/20">
                      <Icon className="w-5 h-5" />
                    </span>
                    {tool.status === 'soon' && (
                      <span className="ml-auto text-xs font-semibold uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-2 py-0.5">
                        Próximamente
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-white mb-2 group-hover:text-cyber-400 transition-colors leading-snug">
                    {tool.title}
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4 flex-grow">
                    {tool.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {tool.tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center px-2 py-1 bg-slate-900 rounded text-xs text-slate-400 border border-slate-700"
                      >
                        <Hash className="w-3 h-3 mr-0.5 opacity-50" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  {tool.status === 'live' && (
                    <span className="inline-flex items-center text-sm font-bold text-cyber-400 group-hover:text-cyber-300 transition-colors mt-auto pt-2 border-t border-slate-700/60">
                      Abrir herramienta <ArrowRight className="w-4 h-4 ml-1" />
                    </span>
                  )}
                </div>
              </article>
            );

            return tool.status === 'live' ? (
              <Link key={tool.slug} to={`/herramientas/${tool.slug}`} className="block h-full">
                {card}
              </Link>
            ) : (
              <div key={tool.slug} className="h-full opacity-70">
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
