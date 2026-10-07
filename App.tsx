import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';

// Carga diferida por ruta (code-splitting).
const ToolsPage = lazy(() => import('./pages/ToolsPage').then((m) => ({ default: m.ToolsPage })));
const GeneradorContrasenasPage = lazy(() => import('./pages/tools/GeneradorContrasenasPage').then((m) => ({ default: m.GeneradorContrasenasPage })));
const MiIpPage = lazy(() => import('./pages/tools/MiIpPage').then((m) => ({ default: m.MiIpPage })));
const MensajesOcultosPage = lazy(() => import('./pages/tools/MensajesOcultosPage').then((m) => ({ default: m.MensajesOcultosPage })));
const PwnedPasswordPage = lazy(() => import('./pages/tools/PwnedPasswordPage').then((m) => ({ default: m.PwnedPasswordPage })));
const CalculadoraSubredesPage = lazy(() => import('./pages/tools/CalculadoraSubredesPage').then((m) => ({ default: m.CalculadoraSubredesPage })));
const GeneradorHashesPage = lazy(() => import('./pages/tools/GeneradorHashesPage').then((m) => ({ default: m.GeneradorHashesPage })));
const Base64UrlPage = lazy(() => import('./pages/tools/Base64UrlPage').then((m) => ({ default: m.Base64UrlPage })));
const JwtDecoderPage = lazy(() => import('./pages/tools/JwtDecoderPage').then((m) => ({ default: m.JwtDecoderPage })));
const MarcaAguaDniPage = lazy(() => import('./pages/tools/MarcaAguaDniPage').then((m) => ({ default: m.MarcaAguaDniPage })));

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
};

const App: React.FC = () => {
  return (
    <Router>
      <ScrollToTop />
      <Layout>
        <Suspense fallback={<div className="min-h-screen bg-cyber-900" />}>
          <Routes>
            <Route path="/" element={<ToolsPage />} />
            <Route path="/herramientas" element={<ToolsPage />} />
            <Route path="/herramientas/generador-de-contrasenas" element={<GeneradorContrasenasPage />} />
            <Route path="/herramientas/cual-es-mi-ip" element={<MiIpPage />} />
            <Route path="/herramientas/mensajes-ocultos-en-emojis" element={<MensajesOcultosPage />} />
            <Route path="/herramientas/comprobar-contrasena-filtrada" element={<PwnedPasswordPage />} />
            <Route path="/herramientas/calculadora-subredes-cidr" element={<CalculadoraSubredesPage />} />
            <Route path="/herramientas/decodificar-jwt" element={<JwtDecoderPage />} />
            <Route path="/herramientas/generador-de-hashes" element={<GeneradorHashesPage />} />
            <Route path="/herramientas/base64-url-encode-decode" element={<Base64UrlPage />} />
            <Route path="/herramientas/marca-de-agua-dni" element={<MarcaAguaDniPage />} />
            <Route path="*" element={<Navigate to="/herramientas" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
};

export default App;
