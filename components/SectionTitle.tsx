import React from 'react';

interface SectionTitleProps {
  title: string;
  subtitle?: string;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, subtitle }) => {
  return (
    <div className="mb-12 text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight relative inline-block">
        <span className="relative z-10">{title}</span>
        <span className="absolute bottom-1 left-0 w-full h-3 bg-cyber-400/20 -z-0 skew-x-12"></span>
      </h2>
      {subtitle && (
        <p className="text-slate-400 max-w-2xl mx-auto mt-4 text-lg">{subtitle}</p>
      )}
    </div>
  );
};