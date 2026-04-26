import { ButtonHTMLAttributes } from 'react';
import { C } from '../theme';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent';
  fullWidth?: boolean;
}

const variantStyles = (variant: string) => {
  switch (variant) {
    case 'primary':
      return { background: C.teal, color: C.white };
    case 'secondary':
      return { color: C.text };
    case 'accent':
      return { background: C.teal, color: C.white };
    default:
      return {};
  }
};

const Button = ({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  style,
  ...props
}: ButtonProps) => {
  const baseClasses = 'flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm hover-teal';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${widthClass} ${className}`}
      style={{ ...variantStyles(variant), ...style }}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;

