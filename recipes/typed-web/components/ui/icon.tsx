import type { FC } from 'hono/jsx'
import type { IconNode } from 'lucide'
import {
  ChevronDown,
  CircleCheck,
  Clock,
  Handshake,
  LayoutTemplate,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  Phone,
  Shield,
  ShoppingCart,
  Sparkles,
  Sun,
  X,
} from 'lucide'

type IconElementProps = {
  class?: string
  [key: string]: unknown
}

type IconProps = IconElementProps & {
  iconNode: IconNode
}

export const Icon: FC<IconProps> = ({
  iconNode,
  class: className,
  ...props
}) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    stroke-width='2'
    stroke-linecap='round'
    stroke-linejoin='round'
    class={className}
    {...(props as Record<string, string | number | boolean | undefined>)}
  >
    {(iconNode as [string, Record<string, string | number | undefined>][]).map(
      ([tag, attrs], index: number) => {
        const Tag = tag as any
        return <Tag key={index} {...attrs} />
      }
    )}
  </svg>
)

const createIcon = <T extends Record<string, unknown> = Record<string, unknown>>(
  iconNode: IconNode
): FC<{ class?: string } & T> =>
  ({ class: className, ...props }) => (
    <Icon
      iconNode={iconNode}
      class={className}
      {...(props as Record<string, string | number | boolean | undefined>)}
    />
  )

export const ChatIcon = createIcon(MessageSquare)
export const CheckCircleIcon = createIcon(CircleCheck)
export const ChevronDownIcon = createIcon(ChevronDown)
export const ClockIcon = createIcon(Clock)
export const HandshakeIcon = createIcon(Handshake)
export const LayoutIcon = createIcon(LayoutTemplate)
export const MailIcon = createIcon(Mail)
export const MapPinIcon = createIcon(MapPin)
export const MenuIcon = createIcon(Menu)
export const MoonIcon = createIcon(Moon)
export const PhoneIcon = createIcon(Phone)
export const ShieldIcon = createIcon(Shield)
export const ShoppingCartIcon = createIcon(ShoppingCart)
export const SparklesIcon = createIcon(Sparkles)
export const SunIcon = createIcon(Sun)
export const XIcon = createIcon(X)
