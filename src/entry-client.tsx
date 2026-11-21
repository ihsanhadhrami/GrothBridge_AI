import '@fontsource-variable/inter';
import './styles.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { startReveal } from './reveal';

const root = document.getElementById('root')!;
const app = <App path={window.location.pathname} />;

// Prerendered pages hydrate; `vite dev` serves an empty shell and renders.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);

startReveal();
