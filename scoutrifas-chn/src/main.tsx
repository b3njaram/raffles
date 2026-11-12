import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {PreferencesProvider} from './Preferences';
createRoot(document.getElementById('root')!).render(<React.StrictMode><PreferencesProvider><App/></PreferencesProvider></React.StrictMode>);
