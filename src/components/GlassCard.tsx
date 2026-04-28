import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  hover?: boolean;
};

export default function GlassCard({ children, className = '', style, hover = false }: Props) {
  return (
    <div className={`glass ${hover ? 'glass-hover' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}
