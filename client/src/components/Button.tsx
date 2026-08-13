import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary: teal bg
        primary:   'bg-[#3B6E64] text-white hover:bg-[#2C4A44]',
        // Secondary: white bg, subtle border
        secondary: 'border border-[#E3E5E9] bg-white text-[#1B2430] hover:bg-[#F5F6F8]',
        // Muted/tertiary: no border
        ghost:     'bg-[#F5F6F8] text-[#1B2430] hover:bg-[#E7EFEC] border-none',
        // Danger: rust-red
        danger:    'bg-[#C1502E] text-white hover:bg-[#A83F22]',
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
