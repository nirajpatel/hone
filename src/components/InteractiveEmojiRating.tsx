import { useState } from 'react';
import { getRatingEmoji, getRatingText } from '../utils/formatters';

interface InteractiveEmojiRatingProps {
  currentRating?: number;
  onRatingClick: (rating: number) => void;
  onHoverChange?: (rating: number | null) => void;
}

export function InteractiveEmojiRating({ 
  currentRating, 
  onRatingClick,
  onHoverChange,
}: InteractiveEmojiRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const handleEmojiClick = (rating: number, e: React.MouseEvent) => {
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
      className="flex items-center gap-1"
      onMouseLeave={handleMouseLeave}
    >
      {[1, 2, 3].map((rating) => (
        <button
          key={rating}
          onClick={(e) => handleEmojiClick(rating, e)}
          onMouseEnter={() => handleMouseEnter(rating)}
          className="focus:outline-none transition-transform hover:scale-110 cursor-pointer text-xl"
          type="button"
          title={getRatingText(rating)}
        >
          <span
            className={`transition-opacity ${
              displayRating && rating === displayRating
                ? 'opacity-100'
                : displayRating
                ? 'opacity-30'
                : currentRating === rating
                ? 'opacity-100'
                : 'opacity-30 hover:opacity-60'
            }`}
          >
            {getRatingEmoji(rating)}
          </span>
        </button>
      ))}
    </div>
  );
}
