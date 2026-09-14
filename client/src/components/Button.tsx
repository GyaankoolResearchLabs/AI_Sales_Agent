import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-60',
          size === 'sm' && 'px-2.5 py-1.5 text-xs',
          size === 'md' && 'px-3.5 py-2 text-sm',
          size === 'lg' && 'px-4.5 py-2.5 text-sm',
          variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
          variant === 'secondary' && 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm',
          variant === 'ghost' && 'text-gray-600 hover:bg-gray-100',
          variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
          className
        )}
        {...props}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export default Button;
