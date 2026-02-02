import { useEffect } from 'react';
import { Coffee, Brew } from '../types';
import { MapPin, Calendar, FileText, Flame, MoreVertical, Copy, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { StandardDialog } from './ui/standard-dialog';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { getRatingEmoji, getRatingText } from '../utils/formatters';

interface CoffeeDetailProps {
  coffee: Coffee;
  brews: Brew[];
  onClose: () => void;
  onEdit: (coffee: Coffee) => void;
  onDuplicateCoffee?: (coffee: Coffee) => void;
  onDeleteCoffee?: (id: string) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function CoffeeDetail({ coffee, brews, onClose, onEdit, onDuplicateCoffee, onDeleteCoffee, onNavigatePrev, onNavigateNext, hasPrev, hasNext }: CoffeeDetailProps) {
  // Handle Escape key to close and arrow keys for navigation
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onNavigatePrev) {
        onNavigatePrev();
      } else if (e.key === 'ArrowRight' && hasNext && onNavigateNext) {
        onNavigateNext();
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [onClose, onNavigatePrev, onNavigateNext, hasPrev, hasNext]);

  const formatRoastDate = (dateString: string) => {
    const [year, monthNum, day] = dateString.split('-').map(Number);
    const date = new Date(year, monthNum - 1, day);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[date.getMonth()];
    return `${month} ${day}, ${year}`;
  };

  const getDaysOld = (roastDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [year, month, day] = roastDate.split('-').map(Number);
    const roast = new Date(year, month - 1, day);
    
    const diffTime = Math.abs(today.getTime() - roast.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  const getCoffeeAverageRating = (coffeeId: string): { rating: number; count: number } => {
    const coffeeBrews = brews.filter(
      (brew) => brew.coffeeId === coffeeId && brew.quality && brew.quality > 0
    );
    
    if (coffeeBrews.length === 0) {
      return { rating: 0, count: 0 };
    }

    const sum = coffeeBrews.reduce((acc, brew) => acc + (brew.quality || 0), 0);
    const average = sum / coffeeBrews.length;
    const rounded = Math.round(average);
    
    return { rating: rounded, count: coffeeBrews.length };
  };

  const { rating, count } = getCoffeeAverageRating(coffee.id);

  // Collect all images (both old imageUrl and new imageUrls)
  const allImages: string[] = [];
  if (coffee.imageUrl) {
    allImages.push(coffee.imageUrl);
  }
  if (coffee.imageUrls && coffee.imageUrls.length > 0) {
    allImages.push(...coffee.imageUrls);
  }

  const headerActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="cursor-pointer data-[state=open]:bg-accent transition-colors"
        >
          <MoreVertical className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onDuplicateCoffee && (
          <DropdownMenuItem onSelect={() => onDuplicateCoffee(coffee)} className="cursor-pointer">
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
        )}
        {onDeleteCoffee && (
          <DropdownMenuItem onSelect={() => onDeleteCoffee(coffee.id)} className="cursor-pointer">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <StandardDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title={coffee.name}
      subtitle={coffee.roaster}
      headerActions={headerActions}
      footerContent={
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
          <Button onClick={() => onEdit(coffee)} className="flex-1 cursor-pointer">
            Edit Coffee
          </Button>
        </div>
      }
    >
      <div className="px-0">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 mb-1">Roast Date</p>
                  <p className="text-sm text-gray-900">{formatRoastDate(coffee.roastDate)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 mb-1">Age</p>
                  <p className="text-sm text-gray-900">{getDaysOld(coffee.roastDate)}</p>
                </div>
              </div>
              {coffee.roastLevel && (
                <div className="flex items-start gap-3">
                  <Flame className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Roast Level</p>
                    <p className="text-sm text-gray-900">{coffee.roastLevel}</p>
                  </div>
                </div>
              )}
              {coffee.region && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Region</p>
                    <p className="text-sm text-gray-900">{coffee.region}</p>
                  </div>
                </div>
              )}
              {coffee.notes && (
                <div className="flex items-start gap-3 col-span-2">
                  <FileText className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Tasting Notes</p>
                    <p className="text-sm text-gray-900">{coffee.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Extraction Quality */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-gray-900 mb-4" style={{ fontWeight: 'var(--font-weight-semibold)' }}>Extraction Quality</h3>
              {rating > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{getRatingEmoji(rating)}</span>
                    <span className="text-base text-gray-900">{getRatingText(rating)}</span>
                  </div>
                  <p className="text-sm text-gray-500">Average of {count} brew{count !== 1 ? 's' : ''}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">No brews logged yet</p>
              )}
            </div>

            {/* Photos */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-gray-900 mb-4" style={{ fontWeight: 'var(--font-weight-semibold)' }}>Photos</h3>
              {allImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {allImages.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`${coffee.name} from ${coffee.roaster} - Photo ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No photos uploaded</p>
              )}
            </div>
      </div>
    </StandardDialog>
  );
}