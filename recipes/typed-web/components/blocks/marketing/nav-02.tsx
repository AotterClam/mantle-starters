import type { FC } from 'hono/jsx'
import { Languages } from 'lucide'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { getButtonClasses } from '@/components/ui/button'
import { ChevronDownIcon, Icon, MenuIcon, ShoppingCartIcon, XIcon } from '@/components/ui/icon'
import { ThemeToggle } from '@/components/ui/theme-toggle'

type NavLink = {
  label: string
  href: string
}

type Nav02Props = {
  logo?: string
  logoHref?: string
  links?: NavLink[]
  loginText?: string
  loginHref?: string
  ctaText?: string
  ctaHref?: string
  ctaIcon?: 'cart'
  locale?: string
  locales?: readonly string[]
  localePath?: string
  labels: {
    openNavigation: string
    closeNavigation: string
    navigation: string
    toggleTheme: string
    lightMode: string
    darkMode: string
    language?: string
  }
  class?: string
}

export const Nav02: FC<Nav02Props> = ({
  logo = '',
  logoHref = '/',
  links = [],
  loginText,
  loginHref = '#',
  ctaText,
  ctaHref = '#',
  ctaIcon,
  locale,
  locales = [],
  localePath = '/:locale',
  labels,
  class: className,
}) => (
  <nav data-site-nav class={cn('border-b border-b-border-subtle bg-background', className)}>
    <div data-site-nav-inner class="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <div class="flex items-center gap-8">
        <a href={logoHref} data-site-nav-logo class="text-lg font-semibold tracking-tight text-foreground">
          {logo}
        </a>
        <div class="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              href={link.href}
              class="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="hidden items-center gap-3 lg:flex">
          {loginText && (
            <a href={loginHref} class={getButtonClasses('ghost', 'sm')}>
              {loginText}
            </a>
          )}
          {ctaText && (
            <a
              href={ctaHref}
              class={getButtonClasses('default', 'sm')}
              data-cart-link={ctaIcon === 'cart' ? '' : undefined}
              data-cart-label={ctaText}
            >
              {ctaIcon === 'cart' && <ShoppingCartIcon class="size-4" />}
              {ctaText}
              {ctaIcon === 'cart' && <Badge data-cart-count hidden class="min-w-5 px-1.5">0</Badge>}
            </a>
          )}
          <LocaleSwitch locale={locale} locales={locales} path={localePath} languageLabel={labels.language} />
          <ThemeToggle labels={labels} />
        </div>

        <button
          data-mobile-nav-trigger
          class={cn(getButtonClasses('ghost', 'iconSm'), 'group lg:hidden')}
          aria-controls="mobile-navigation"
          aria-expanded="false"
          aria-label={labels.openNavigation}
        >
          <MenuIcon class="size-4 group-aria-expanded:hidden" />
          <XIcon class="hidden size-4 group-aria-expanded:block" />
        </button>
      </div>
    </div>

    <div
      id="mobile-navigation"
      data-mobile-nav
      data-sheet
      data-sheet-side="right"
      data-state="closed"
      class="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={labels.navigation}
    >
      <button
        data-sheet-overlay
        data-mobile-nav-close="true"
        class="fixed inset-0 bg-background/80 backdrop-blur-sm"
        aria-label={labels.closeNavigation}
      />
      <div
        data-sheet-content
        class="fixed inset-y-0 right-0 flex h-dvh w-80 max-w-[calc(100vw-2rem)] flex-col border-l border-border-subtle bg-background p-4 shadow-xl"
      >
        <div class="flex h-10 items-center justify-between gap-4">
          <a href={logoHref} data-mobile-nav-close="true" class="text-base font-semibold tracking-tight text-foreground">
            {logo}
          </a>
          <button
            data-mobile-nav-close="true"
            class={getButtonClasses('ghost', 'iconSm')}
            aria-label={labels.closeNavigation}
          >
            <XIcon class="size-4" />
          </button>
        </div>

        <div class="mt-8 flex flex-col gap-1">
          {links.map((link) => (
            <a
              href={link.href}
              data-mobile-nav-close="true"
              data-mobile-nav-link
              class="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div class="mt-auto flex flex-col gap-2 pt-8">
          <LocaleSwitch locale={locale} locales={locales} path={localePath} languageLabel={labels.language} showLabel />
          <ThemeToggle labels={labels} showLabel class="w-full" />
          {loginText && (
            <a href={loginHref} data-mobile-nav-close="true" class={cn(getButtonClasses('ghost', 'sm'), 'w-full')}>
              {loginText}
            </a>
          )}
          {ctaText && (
            <a
              href={ctaHref}
              data-mobile-nav-close="true"
              class={cn(getButtonClasses('default', 'sm'), 'w-full')}
              data-cart-link={ctaIcon === 'cart' ? '' : undefined}
              data-cart-label={ctaText}
            >
              {ctaIcon === 'cart' && <ShoppingCartIcon class="size-4" />}
              {ctaText}
              {ctaIcon === 'cart' && <Badge data-cart-count hidden class="ml-auto min-w-5 px-1.5">0</Badge>}
            </a>
          )}
        </div>
      </div>
    </div>
  </nav>
)

const LocaleSwitch: FC<{
  locale?: string
  locales: readonly string[]
  path: string
  languageLabel?: string
  showLabel?: boolean
}> = ({ locale, locales, path, languageLabel = 'Language', showLabel = false }) => locales.length > 1 && locale ? (
  <details data-locale-switch class={cn('group relative', showLabel && 'w-full')}>
    <summary class={cn(getButtonClasses('ghost', showLabel ? 'sm' : 'iconSm'), showLabel && 'w-full justify-start')}>
      <Icon iconNode={Languages} class="size-4 shrink-0" />
      {showLabel && <span class="min-w-0 truncate">{languageName(locale)}</span>}
      {showLabel && <ChevronDownIcon class="ml-auto size-3.5 transition-transform group-open:rotate-180" />}
      <span class="sr-only">{languageLabel}: {languageName(locale)} ({locale})</span>
    </summary>
    <div class={cn(
      'absolute z-50 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md',
      showLabel ? 'bottom-full mb-1 w-full' : 'right-0 mt-1 min-w-48',
    )}>
      {locales.map((option) => (
        <a
          href={path.replace(':locale', option.toLowerCase())}
          aria-current={option === locale ? 'page' : undefined}
          class="flex min-h-9 min-w-0 items-center gap-3 rounded-md px-2.5 text-sm text-popover-foreground hover:bg-accent aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold"
        >
          <span class="min-w-0 flex-1 truncate">{languageName(option)}</span>
          <span class="shrink-0 text-xs uppercase text-foreground-soft">{option}</span>
        </a>
      ))}
    </div>
  </details>
) : null

function languageName(locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale
  } catch {
    return locale
  }
}

export default Nav02
