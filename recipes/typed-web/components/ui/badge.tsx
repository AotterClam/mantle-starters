import type { FC, JSX } from "hono/jsx";
import { cn } from "@/lib/utils";

type BadgeProps = JSX.IntrinsicElements["span"];

export const Badge: FC<BadgeProps> = ({ class: className, children, ...props }) => (
  <span
    class={cn(
      "inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary",
      className,
    )}
    {...props}
  >
    {children}
  </span>
);
