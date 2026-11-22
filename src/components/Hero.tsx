/**
 * Hero - Server Component
 * Static content rendered on the server, no JavaScript shipped to client
 */

import { useTranslations } from 'next-intl';

// Layout / styling constants (issue #1451: no inline magic numbers/strings)
const HERO_SECTION_CLASSES =
  'animate-scale-in rounded-[2rem] border border-line/70 bg-panel/80 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur md:p-10';
const HERO_LAYOUT_CLASSES = 'flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between';
const HERO_CONTENT_CLASSES = 'max-w-2xl space-y-4';
const HERO_EYEBROW_CLASSES =
  'font-space-grotesk text-sm font-medium uppercase tracking-[0.35em] text-accent';
const HERO_TITLE_GROUP_CLASSES = 'space-y-3';
const HERO_TITLE_CLASSES = 'font-space-grotesk text-4xl font-semibold tracking-tight sm:text-5xl';
const HERO_DESCRIPTION_CLASSES = 'max-w-xl text-sm leading-7 text-muted sm:text-base';
const HERO_BADGE_CLASSES =
  'flex items-center gap-3 rounded-full border border-line bg-bg/60 px-4 py-3 text-sm text-muted';
const HERO_BADGE_DOT_CLASSES =
  'inline-flex h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_18px_rgba(201,169,98,0.85)]';

export default function Hero() {
  const t = useTranslations('Hero');

  return (
    <section className={HERO_SECTION_CLASSES}>
      <div className={HERO_LAYOUT_CLASSES}>
        <div className={HERO_CONTENT_CLASSES}>
          <p className={HERO_EYEBROW_CLASSES}>{t('eyebrow')}</p>
          <div className={HERO_TITLE_GROUP_CLASSES}>
            <h1 className={HERO_TITLE_CLASSES}>{t('title')}</h1>
            <p className={HERO_DESCRIPTION_CLASSES}>{t('description')}</p>
          </div>
        </div>

        <div className={HERO_BADGE_CLASSES}>
          <span className={HERO_BADGE_DOT_CLASSES} aria-hidden="true" />
          {t('status')}
        </div>
      </div>
    </section>
  );
}
