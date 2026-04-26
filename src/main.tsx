import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';

import './mock-server'; // intercept fetch → backend (design preview)
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './theme/fonts.css';
import './index.css';

console.log('Main: Mounting root');

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.error('Main: Missing Clerk Publishable Key — set VITE_CLERK_PUBLISHABLE_KEY in .env');
}

console.log('Main: Initializing app');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Main: Root element not found!');
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY!}
        afterSignOutUrl="/"
        signInFallbackRedirectUrl="/sophia-v2"
        localization={{
          socialButtonsBlockButton: '{{provider|titleize}}',
          socialButtonsBlockButtonText__lastUsed: undefined,
        } as any}
        appearance={{
          elements: {
            socialButtonsBlockButtonText__lastUsed: { display: 'none' },
            badge: { display: 'none' },
            socialButtonsBlockButton: { overflow: 'hidden' },
          },
        }}
      >
        <App />
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

console.log('Main: Root rendered successfully');
