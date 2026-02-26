import React from 'react';
import { cn } from '@/lib';

interface SectionContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

export function SectionContainer({
  children,
  className,
  as: Component = 'section',
}: SectionContainerProps) {
  return (
    <Component
      className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', className)}
    >
      {children}
    </Component>
  );
}
