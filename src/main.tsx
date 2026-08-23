import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CustomerAuthProvider } from './context/CustomerAuthContext.js';
import { AdminAuthProvider } from './context/AdminAuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <App />
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
