import { createRoot } from 'react-dom/client';
import App from '@/App/App';
import { StoreProvider } from './App/providers/StoreProvider';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);

root.render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
