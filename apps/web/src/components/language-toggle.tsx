import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { languages } from '@/i18n';

/** ไทย / EN segmented switch, present on every screen. `tone` matches the surface it sits on. */
export function LanguageToggle({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div role="group" aria-label={t('app.language')} className={cn(
      'inline-flex rounded-full p-[3px]',
      tone === 'dark' ? 'bg-black/14 shadow-[inset_0_0_0_1px_var(--sidebar-border)]' : 'bg-muted shadow-[inset_0_0_0_1px_var(--border)]',
      className,
    )}>
      {languages.map(language => {
        const active = i18n.language === language;
        return (
          <button key={language} type="button" aria-pressed={active} lang={language}
            aria-label={t(language === 'th' ? 'lang.thName' : 'lang.enName')}
            onClick={() => void i18n.changeLanguage(language)}
            className={cn(
              'min-h-10 min-w-12 cursor-pointer rounded-full px-3 font-[Noto_Sans,var(--font-heading)] text-[0.9375rem] font-semibold transition-colors',
              tone === 'dark'
                ? active ? 'bg-sidebar-foreground text-sidebar' : 'text-sidebar-muted hover:text-white'
                : active ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}>
            {t(language === 'th' ? 'lang.th' : 'lang.en')}
          </button>
        );
      })}
    </div>
  );
}
