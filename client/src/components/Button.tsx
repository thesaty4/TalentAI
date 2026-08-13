import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-celestial-blue text-white hover:bg-[#33739A]',
        secondary: 'border border-border-default bg-white text-network-blue hover:bg-culture-gray',
        danger:    'bg-power-orange text-white hover:bg-[#B5361E]',
        ghost:     'text-secure-gray hover:bg-culture-gray',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-4',
        lg: 'h-10 px-6',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
