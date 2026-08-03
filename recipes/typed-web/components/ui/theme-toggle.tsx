import type { FC } from "hono/jsx";
import { cn } from "@/lib/utils";
import { getButtonClasses } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "@/components/ui/icon";

type ThemeToggleProps = {
  labels: {
    toggleTheme: string
    lightMode: string
    darkMode: string
  }
  showLabel?: boolean;
  class?: string;
};

export const ThemeToggle: FC<ThemeToggleProps> = ({
  labels,
  showLabel = false,
  class: className,
}) => (
  <button
    type="button"
    data-theme-toggle
    data-theme="light"
    data-light-mode-label={labels.lightMode}
    data-dark-mode-label={labels.darkMode}
    aria-label={labels.toggleTheme}
    aria-pressed="false"
    class={cn(getButtonClasses("ghost", showLabel ? "sm" : "iconSm"), className)}
  >
    <MoonIcon data-theme-icon="moon" class="size-4" />
    <SunIcon data-theme-icon="sun" class="size-4" />
    {showLabel && <span data-theme-label>{labels.darkMode}</span>}
  </button>
);
