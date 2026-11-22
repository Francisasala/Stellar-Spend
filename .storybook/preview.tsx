import type { Preview } from '@storybook/nextjs-vite';
import '../src/app/globals.css';
import React from 'react';
import { I18nProvider } from '../src/i18n/I18nProvider';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
    backgrounds: {
      disable: true,
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'dark',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'circlehollow', title: 'Light' },
          { value: 'dark', icon: 'circle', title: 'Dark' },
          { value: 'high-contrast', icon: 'eye', title: 'High Contrast' },
        ],
        showName: true,
      },
    },
    locale: {
      name: 'Locale',
      description: 'Internationalization locale',
      defaultValue: 'en',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en', icon: 'globe', title: 'English' },
          { value: 'es', icon: 'globe', title: 'Español' },
          { value: 'fr', icon: 'globe', title: 'Français' },
          { value: 'de', icon: 'globe', title: 'Deutsch' },
        ],
        showName: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'dark';
      const locale = context.globals.locale || 'en';
      React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('lang', locale);
      }, [theme, locale]);
      return (
        <I18nProvider locale={locale}>
          <div className="bg-[var(--bg)] text-[var(--text)] min-h-screen p-8">
            <Story />
          </div>
        </I18nProvider>
      );
    },
  ],
};

export default preview;
