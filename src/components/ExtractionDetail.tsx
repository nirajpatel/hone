import { Calendar, Coffee, Droplet, Clock, Scale, Settings, ListOrdered, Thermometer, Gauge, Weight, User } from 'lucide-react';
import { useEffect } from 'react';
import { formatTime, formatExtractionTime } from './TimeInput';
import { Extraction, BrewMethod } from '../types';
import { Button } from './ui/button';
import { StandardDialog } from './ui/standard-dialog';
import { BrewEquipmentIcon } from './icons/BrewEquipmentIcon';
import { GrinderIcon } from './icons/GrinderIcon';
import { capitalizeBrewMethod, getRatingEmoji, getRatingText } from '../utils/formatters';
import { supportsStages } from '../utils/brewMethods';

interface ExtractionDetailProps {
  extraction: Extraction;
  onClose: () => void;
  onEdit: (extraction: Extraction) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function ExtractionDetail({ extraction, onClose, onEdit, onNavigatePrev, onNavigateNext, hasPrev, hasNext }: ExtractionDetailProps) {
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

  const formatHeaderDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${month} ${day}, ${year} at ${time}`;
  };

  const getTemperatureLabel = (temp: string) => {
    switch (temp) {
      case 'hot':
        return 'Hot';
      case 'iced':
        return 'Iced';
      case 'room-temperature':
        return 'Room Temperature';
      case 'frozen':
        return 'Frozen';
      default:
        return temp.charAt(0).toUpperCase() + temp.slice(1);
    }
  };

  // Calculate brew ratio
  const calculateBrewRatio = () => {
    const ratio = extraction.finalWeight / extraction.dosage;
    const rounded = Math.round(ratio * 10) / 10;
    // If it's a whole number, don't show decimal
    return `1:${rounded % 1 === 0 ? Math.round(rounded) : rounded.toFixed(1)}`;
  };

  return (
    <StandardDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title={`Extraction on ${formatHeaderDate(extraction.createdAt)}`}
      subtitle={`${extraction.roaster} – ${extraction.coffeeName} • ${capitalizeBrewMethod(extraction.brewMethod)}`}
      footerContent={
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
          <Button onClick={() => onEdit(extraction)} className="flex-1 cursor-pointer">
            Edit Extraction
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
                  <p className="text-sm text-gray-500 mb-1">Date & Time</p>
                  <p className="text-sm text-gray-900">{formatHeaderDate(extraction.createdAt)}</p>
                </div>
              </div>
              {extraction.userName && (
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Made By</p>
                    <p className="text-sm text-gray-900">{extraction.userName}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Coffee className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 mb-1">Brew Method</p>
                  <p className="text-sm text-gray-900 capitalize">{capitalizeBrewMethod(extraction.brewMethod)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Thermometer className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 mb-1">Temperature</p>
                  <p className="text-sm text-gray-900">{getTemperatureLabel(extraction.coffeeTemperature)}</p>
                </div>
              </div>
              {extraction.brewerName && (
                <div className="flex items-start gap-3">
                  <BrewEquipmentIcon className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Brewer</p>
                    <p className="text-sm text-gray-900">{extraction.brewerName}</p>
                  </div>
                </div>
              )}
              {extraction.grinderName && (
                <div className="flex items-start gap-3">
                  <GrinderIcon className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Grinder</p>
                    <p className="text-sm text-gray-900">{extraction.grinderName}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Extraction Parameters */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-gray-900 mb-4" style={{ fontWeight: 'var(--font-weight-semibold)' }}>Extraction Parameters</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <Gauge className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Grind Setting</p>
                    <p className="text-sm text-gray-900">{extraction.grindSetting}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Weight className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Dosage</p>
                    <p className="text-sm text-gray-900">{extraction.dosage} grams</p>
                  </div>
                </div>
                
                {extraction.waterTemp && (
                  <div className="flex items-start gap-3">
                    <Thermometer className="w-5 h-5 text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Water Temperature</p>
                      <p className="text-sm text-gray-900">{extraction.waterTemp}°F</p>
                    </div>
                  </div>
                )}
                
                {/* Pour Over with Stages */}
                {supportsStages(extraction.brewMethod) && extraction.stages && extraction.stages.length > 0 ? (
                  <>
                    {/* Overall metrics for pour over */}
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Extraction Time</p>
                        <p className="text-sm text-gray-900">{formatExtractionTime(parseFloat(extraction.extractionTime))}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Droplet className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Final Weight</p>
                        <p className="text-sm text-gray-900">{extraction.finalWeight} grams</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Scale className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Brew Ratio</p>
                        <p className="text-sm text-gray-900">{calculateBrewRatio()}</p>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-start gap-3 mb-3">
                        <ListOrdered className="w-5 h-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Brew Stages</p>
                        </div>
                      </div>
                      <div className="ml-8">
                        {/* Table Header */}
                        <div className="grid grid-cols-3 gap-4 pb-2 border-b border-gray-200">
                          <div className="text-sm text-gray-500">Stage</div>
                          <div className="text-sm text-gray-500">Brew Time</div>
                          <div className="text-sm text-gray-500 text-right">End Weight</div>
                        </div>
                        {/* Table Rows */}
                        {extraction.stages.map((stage, index) => {
                          const startTime = index === 0 ? 0 : extraction.stages![index - 1].endTime;
                          const endTime = stage.endTime;
                          return (
                            <div key={index} className="grid grid-cols-3 gap-4 py-3 border-b border-gray-100 last:border-0">
                              <div className="text-sm text-gray-900">Stage {index + 1}</div>
                              <div className="text-sm text-gray-900">
                                {formatTime(startTime)}-{formatTime(endTime)}
                              </div>
                              <div className="text-sm text-gray-900 text-right">{stage.endWeight}g</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Espresso or Pour Over without stages */
                  <>
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Extraction Time</p>
                        <p className="text-sm text-gray-900">{formatExtractionTime(parseFloat(extraction.extractionTime))}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Droplet className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Final Weight</p>
                        <p className="text-sm text-gray-900">{extraction.finalWeight} grams</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Scale className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Brew Ratio</p>
                        <p className="text-sm text-gray-900">{calculateBrewRatio()}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quality Rating */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-gray-900 mb-4" style={{ fontWeight: 'var(--font-weight-semibold)' }}>Extraction Quality</h3>
              <div className="flex items-center gap-3 mb-4">
                {extraction.quality && extraction.quality > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{getRatingEmoji(extraction.quality)}</span>
                    <span className="text-sm text-gray-900">{getRatingText(extraction.quality)}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Not rated</span>
                )}
              </div>

              {/* Extraction Notes */}
              {(() => {
                if (!extraction.tastingNotes || extraction.tastingNotes.trim() === '') {
                  return (
                    <p className="text-sm text-gray-500">No notes added</p>
                  );
                }
                const notes = extraction.tastingNotes.split(', ').filter(n => n.trim());
                if (notes.length === 0) {
                  return (
                    <p className="text-sm text-gray-500">No notes added</p>
                  );
                }
                
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {notes.map((note, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full text-sm"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
      </div>
    </StandardDialog>
  );
}