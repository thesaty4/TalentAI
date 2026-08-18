import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary: Impact Orange
        primary:   'bg-[#FF5F2D] text-white hover:bg-[#CF3708]',
        // Secondary: white bg, subtle border
        secondary: 'border border-[#C8CAD3] bg-white text-[#181A24] hover:bg-[#F2F3F6]',
        // Muted/tertiary: no border
        ghost:     'bg-[#F2F3F6] text-[#181A24] hover:bg-[#C8CAD3] border-none',
        // Danger: Deep Orange
        danger:    'bg-[#CF3708] text-white hover:bg-[#A52D07]',
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
      style={{ borderRadius: '8px' }}
      {...props}
    />
  );
}
