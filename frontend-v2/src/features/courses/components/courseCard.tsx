'use client';

import { Heart, ShoppingCart, BookOpen, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { useWishlistStore } from '@/src/store/wishlist-store';
import { colors } from '@/src/shared/constants/design-tokens';
import { getLevelBadgeClass, formatLevel } from '@/lib/utils';
import { StarRating } from '@/src/shared/components/ui/StarRating';
import type { Course } from '../types';

const accessibilityLabels: Record<string, string> = {
  largePrint: 'Large Print',
  braille: 'Braille',
  dyslexiaFriendly: 'Dyslexia-Friendly',
  captioned: 'Closed Captions',
  transcript: 'Transcripts',
  screenReaderCompatible: 'Screen Reader',
};

export interface CourseCardProps extends Partial<Course> {
  id: string | number;
  title: string;
  onAddToCart?: () => void;
}

export function CourseCard({
  id,
  title,
  rating = 0,
  description = '',
  instructor = '',
  level = 'Beginner',
  price = 0,
  currency = '$',
  image = '',
  category = '',
  accessibility,
  onAddToCart,
}: CourseCardProps & { accessibility?: Course['accessibility'] }) {
  const toggle = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.isWishlisted);
  const wishlisted = isWishlisted(String(id));

  return (
    <Card className="flex flex-col h-full overflow-hidden hover:shadow-lg transition-all duration-300 border-gray-200 hover:border-[var(--dt-primary)]/20 group" style={{ '--dt-primary': colors.primary, '--dt-primary-hover': colors.primaryHover } as React.CSSProperties}>
      {/* Image Container */}
      <div className="relative h-40 bg-gradient-to-br from-blue-400 to-indigo-600 overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          /* #784 — proper placeholder when no image is provided */
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <BookOpen className="text-white/70" size={32} aria-hidden="true" />
            <span className="text-white/90 text-xs font-semibold uppercase tracking-wide">{category}</span>
          </div>
        )}
        {/* Wishlist Button */}
        <button
          onClick={() => toggle(String(id))}
          aria-label={wishlisted ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}
          aria-pressed={wishlisted}
          className="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-all hover:scale-110 focus-ring"
        >
          <Heart
            size={18}
            aria-hidden="true"
            className={wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400'}
          />
        </button>
        {/* Category Badge */}
        <div className="absolute top-3 left-3 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
          {category}
        </div>
      </div>

      {/* Content */}
      <CardContent className="flex flex-col flex-1 p-5 space-y-4">
        {/* Title */}
        <div>
          <h3 className="text-base font-bold text-gray-900 line-clamp-2 group-hover:text-[var(--dt-primary)] transition-colors">
            {title}
          </h3>
        </div>

        {/* Instructor & Rating */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">By {instructor}</p>
          <div className="flex items-center gap-1">
            <StarRating rating={rating} />
            <span className="sr-only">Rated {rating} out of 5 stars</span>
            <span className="text-xs font-semibold text-gray-700 ml-1" aria-hidden="true">{rating}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2">{description}</p>

        {/* Level & Accessibility Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getLevelBadgeClass(level)}`}
          >
            {formatLevel(level)}
          </span>
          {/* Accessibility badges - show only first 2 to avoid clutter */}
          {accessibility && Object.entries(accessibility)
            .filter(([_, value]) => value === true)
            .slice(0, 2)
            .map(([key]) => (
              <span
                key={key}
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700"
                title={accessibilityLabels[key] || key}
              >
                <BadgeCheck className="w-3 h-3" />
                {accessibilityLabels[key] || key}
              </span>
            ))}
          {/* Show more indicator if there are more than 2 */}
          {accessibility && Object.entries(accessibility).filter(([_, value]) => value === true).length > 2 && (
            <span className="text-xs text-gray-500">+{Object.entries(accessibility).filter(([_, value]) => value === true).length - 2} more</span>
          )}
        </div>

        {/* Price & Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
          <span className="text-xl font-bold text-[var(--dt-primary)]">
            {price === 0 ? 'Free' : `${currency || '$'}${price.toFixed(2)}`}
          </span>
          <Button
            onClick={onAddToCart}
            size="sm"
            className="min-h-[44px] min-w-[44px] bg-[var(--dt-primary)] hover:bg-[var(--dt-primary-hover)] text-white font-semibold gap-2 group/btn"
          >
            <ShoppingCart size={16} className="group-hover/btn:scale-110 transition-transform" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}