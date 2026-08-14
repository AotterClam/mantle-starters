import type { Child, FC } from 'hono/jsx'
import { cn } from '@/lib/utils'

type Feature = {
  icon: FC<{ class?: string }>
  title: string
  description: string
  href?: string
}

type Features02Props = {
  eyebrow?: string
  title?: Child
  description?: string
  features?: Feature[]
  showHeader?: boolean
  class?: string
}

export const Features02: FC<Features02Props> = ({
  eyebrow,
  title = '',
  description,
  features = [],
  showHeader = true,
  class: className,
}) => (
  <section class={cn('py-16 md:py-24', className)}>
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      {showHeader && (
        <div class="grid items-end gap-8 lg:grid-cols-2 lg:gap-16">
          <div>
            {eyebrow && (
              <p class="text-xs font-medium uppercase tracking-wide text-primary">
                {eyebrow}
              </p>
            )}
            <h2 class={cn('text-3xl tracking-tight sm:text-4xl', eyebrow && 'mt-3')}>
              {title}
            </h2>
          </div>
          {description && (
            <p class="max-w-lg text-base text-foreground-muted">
              {description}
            </p>
          )}
        </div>
      )}
      <div class={cn('grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3', showHeader && 'mt-16')}>
        {features.map((feature) => feature.href ? (
          <a
            key={feature.title}
            href={feature.href}
            class="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FeatureBody feature={feature} linked />
          </a>
        ) : (
          <div key={feature.title}><FeatureBody feature={feature} /></div>
        ))}
      </div>
    </div>
  </section>
)

const FeatureBody: FC<{ feature: Feature; linked?: boolean }> = ({ feature, linked }) => (
  <>
    <div class="flex size-9 items-center justify-center rounded-lg bg-card shadow">
      <feature.icon class="size-4 text-foreground" />
    </div>
    <h3 class={cn('mt-4 tracking-tight', linked && 'transition-colors group-hover:text-primary')}>
      {feature.title}
    </h3>
    <p class="mt-2 text-sm text-foreground-muted">
      {feature.description}
    </p>
  </>
)

export default Features02
