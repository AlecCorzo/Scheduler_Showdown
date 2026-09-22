import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@fontsource/atkinson-hyperlegible';
import './estilos/tokens.css';
import { Inicio } from './paginas/Inicio.js';
import { Host } from './paginas/Host.js';
import { Jugar } from './paginas/Jugar.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/host" element={<Host />} />
        <Route path="/jugar" element={<Jugar />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
