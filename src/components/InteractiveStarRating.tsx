import { useState } from 'react';
import { Star } from 'lucide-react';

interface InteractiveStarRatingProps {
  currentRating?: number;
  onRatingClick: (rating: number) => void;
  onHoverChange?: (rating: number | null) => void;
}

export function InteractiveStarRating({ 
  currentRating, 
  onRatingClick,
  onHoverChange,
}: InteractiveStarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const handleStarClick = (rating: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    onRatingClick(rating);
  };

  const handleMouseEnter = (rating: number) => {
    setHoverRating(rating);
    onHoverChange?.(rating);
  };

  const handleMouseLeave = () => {
    setHoverRating(null);
    onHoverChange?.(null);
  };

  const displayRating = hoverRating !== null ? hoverRating : currentRating;

  return (
    <div 
      className="flex items-center gap-0.5"
      onMouseLeave={handleMouseLeave}
    >
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          onClick={(e) => handleStarClick(star, e)}
          onMouseEnter={() => handleMouseEnter(star)}
          className="focus:outline-none transition-transform hover:scale-110 cursor-pointer"
          type="button"
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              displayRating && star <= displayRating
                ? 'fill-yellow-400 text-yellow-400'
                : hoverRating !== null
                ? 'text-gray-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}