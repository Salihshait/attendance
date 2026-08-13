import type { ModuleColor } from './navigation';

/**
 * Literal Tailwind class names (kept as literal strings, not template-built,
 * so the Tailwind scanner picks them up) mapped per module accent color.
 */
export const moduleColorMap: Record<
  ModuleColor,
  { text: string; bg: string; bgDark: string; border: string }
> = {
  attendance: {
    text: 'text-module-attendance',
    bg: 'bg-module-attendance',
    bgDark: 'bg-module-attendance-dark',
    border: 'border-module-attendance',
  },
  eip: {
    text: 'text-module-eip',
    bg: 'bg-module-eip',
    bgDark: 'bg-module-eip-dark',
    border: 'border-module-eip',
  },
  exit: {
    text: 'text-module-exit',
    bg: 'bg-module-exit',
    bgDark: 'bg-module-exit-dark',
    border: 'border-module-exit',
  },
  manager: {
    text: 'text-module-manager',
    bg: 'bg-module-manager',
    bgDark: 'bg-module-manager-dark',
    border: 'border-module-manager',
  },
  admin: {
    text: 'text-module-admin',
    bg: 'bg-module-admin',
    bgDark: 'bg-module-admin-dark',
    border: 'border-module-admin',
  },
};
