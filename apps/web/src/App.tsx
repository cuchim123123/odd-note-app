import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppProvider } from './providers/app-provider';
import { ThemeProvider } from './providers/theme-provider';
import { router } from './routes';

export const App: React.FC = () => {
  return (
    <AppProvider>
      <ThemeProvider defaultTheme="light" storageKey="odd-note-theme">
        <RouterProvider router={router} />
      </ThemeProvider>
    </AppProvider>
  );
};
