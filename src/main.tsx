import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SisenseContextProvider } from '@sisense/sdk-ui';

import './index.css';
import App from './App.tsx';
import { DATA_SOURCE, SISENSE_TOKEN, SISENSE_URL } from './env.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SisenseContextProvider
      url={SISENSE_URL}
      token={SISENSE_TOKEN}
      defaultDataSource={DATA_SOURCE}
      showRuntimeErrors={false}
      onError={(error) => {
        console.error('[Sisense]', error);
      }}
    >
      <App />
    </SisenseContextProvider>
  </StrictMode>,
);