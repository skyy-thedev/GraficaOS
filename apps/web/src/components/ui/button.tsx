import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

const VARIANT_MAP: Record<string, string> = {
  default: 'btn-default',
  destructive: 'btn-destructive',
  outline: 'btn-outline',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  success: 'btn-success',
  warning: 'btn-warning',
  link: 'btn-link',
};

const SIZE_MAP: Record<string, string> = {
  default: 'btn-md',
  sm: 'btn-sm',
  lg: 'btn-lg',
  icon: 'btn-icon',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'success' | 'warning' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn('btn', VARIANT_MAP[variant], SIZE_MAP[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
