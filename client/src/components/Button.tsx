import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary: Impact Orange
        primary:   'bg-power-orange text-white hover:bg-energy-orange',
        // Secondary: white bg, subtle border
        secondary: 'border border-level-gray bg-white text-network-blue hover:bg-culture-gray',
        // Ghost: transparent — true ghost for tertiary actions
        ghost:     'bg-transparent text-network-blue hover:bg-culture-gray border border-transparent',
        // Danger: Deep Orange
        danger:    'bg-energy-orange text-white hover:bg-energy-orange/80',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-6 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={`${buttonVariants({ variant, size })} ${className ?? ''}`}
      {...props}
    />
  );
}
