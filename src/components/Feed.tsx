import { useState } from 'react';
import { Heart, MessageCircle, Star } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { capitalizeBrewMethod } from '../utils/formatters';
import { Extraction, Coffee } from '../types';

interface FeedProps {
  brews: Extraction[];
  coffees: Coffee[];
}

interface FeedCardProps {
  brew: Extraction;
  coffeeImages?: string[];
}

const FeedCard = ({ brew, coffeeImages }: FeedCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Array<{ userName: string; text: string; avatar?: string }>>([]);
  const [newComment, setNewComment] = useState('');

  const handleLike = () => {
    if (isLiked) {
      setLikes(likes - 1);
      setIsLiked(false);
    } else {
      setLikes(likes + 1);
      setIsLiked(true);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      setComments([...comments, { userName: 'You', text: newComment.trim() }]);
      setNewComment('');
    }
  };

  const getQualityLabel = (rating: number) => {
    switch (rating) {
      case 1: return 'Poor';
      case 2: return 'Good';
      case 3: return 'Excellent';
      default: return '';
    }
  };

  const formatBrewRatio = (dosage: number, finalWeight: number) => {
    if (!dosage || !finalWeight) return null;
    const ratio = finalWeight / dosage;
    const roundedRatio = Math.round(ratio * 10) / 10;
    return `1:${roundedRatio % 1 === 0 ? roundedRatio.toFixed(0) : roundedRatio.toFixed(1)}`;
  };

  const formatTimestamp = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else {
      return created.toLocaleDateString();
    }
  };

  const brewRatio = formatBrewRatio(brew.dosage, brew.finalWeight);
  const coffeeImage = coffeeImages && coffeeImages.length > 0 ? coffeeImages[0] : undefined;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            <span className="text-gray-600 font-medium text-sm">
              {brew.userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{brew.userName}</p>
            <p className="text-xs text-gray-500">{formatTimestamp(brew.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Roaster Name */}
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-lg font-semibold text-gray-900">{brew.roaster}</h3>
      </div>

      {/* Content */}
      <div className="px-4 pb-3 flex gap-3">
        {/* Coffee Image Thumbnail */}
        {coffeeImage && (
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
              <ImageWithFallback 
                src={coffeeImage} 
                alt={brew.coffeeName}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 mb-1">
            {brew.roaster} – {brew.coffeeName}
          </p>
          
          <div className="space-y-1 text-sm">
            <p className="text-gray-700">
              <span className="text-gray-500">Method:</span> {capitalizeBrewMethod(brew.brewMethod)}
            </p>
            
            {brew.quality && brew.quality > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Quality:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((star) => (
                    <Star
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= brew.quality!
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="text-gray-700 ml-1">{getQualityLabel(brew.quality)}</span>
                </div>
              </div>
            )}

            {brew.tastingNotes && brew.tastingNotes.trim() && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-gray-500">Notes:</span>
                {brew.tastingNotes.split(',').map((note, idx) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 border border-gray-200 text-gray-700"
                  >
                    {note.trim()}
                  </span>
                ))}
              </div>
            )}

            {brewRatio && (
              <p className="text-gray-700">
                <span className="text-gray-500">Brew Ratio:</span> {brewRatio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors"
          >
            <Heart 
              className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`}
            />
            <span className="text-sm font-medium">{likes}</span>
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{comments.length}</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="px-4 pb-3 border-t border-gray-100">
          <div className="pt-3 space-y-3">
            {comments.map((comment, idx) => (
              <div key={idx} className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {comment.avatar ? (
                    <img src={comment.avatar} alt={comment.userName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-600 text-xs font-medium">
                      {comment.userName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                  <p className="font-medium text-sm text-gray-900">{comment.userName}</p>
                  <p className="text-sm text-gray-700">{comment.text}</p>
                </div>
              </div>
            ))}
            
            {/* Add Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2 mt-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const Feed = ({ brews, coffees }: FeedProps) => {
  // Get last 5 brews sorted by date
  const recentBrews = [...brews]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Create a map of coffee images by coffee ID
  const coffeeImageMap = new Map<string, string[]>();
  coffees.forEach(coffee => {
    if (coffee.imageUrls && coffee.imageUrls.length > 0) {
      coffeeImageMap.set(coffee.id, coffee.imageUrls);
    }
  });

  if (recentBrews.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No brews yet. Start logging your brews to see them here!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-4">
        {recentBrews.map((brew) => (
          <FeedCard 
            key={brew.id} 
            brew={brew}
            coffeeImages={coffeeImageMap.get(brew.coffeeId)}
          />
        ))}
      </div>
    </div>
  );
};
