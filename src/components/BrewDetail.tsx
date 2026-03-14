import { Calendar, Coffee, Droplet, Clock, Scale, Settings, ListOrdered, Thermometer, Gauge, Weight, User, MoreVertical, RotateCcw, Trash2, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatTime, formatExtractionTime } from './TimeInput';
import { Brew, BrewMethod, User as UserType } from '../types';
import { Button } from './ui/button';
import { StandardDialog } from './ui/standard-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { BrewEquipmentIcon } from './icons/BrewEquipmentIcon';
import { GrinderIcon } from './icons/GrinderIcon';
import { capitalizeBrewMethod, getRatingEmoji, getRatingText } from '../utils/formatters';
import { capitalize } from '../utils/tastingNotes';
import { supportsStages } from '../utils/brewMethods';
import { FormattedAISuggestions } from './DialInGuidance';

interface BrewDetailProps {
  brew: Brew;
  users: UserType[];
  onClose: () => void;
  onEdit: (brew: Brew) => void;
  onDuplicateBrew?: (brew: Brew) => void;
  onDeleteBrew?: (id: string) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  scrollToGuidance?: boolean;
  onScrollComplete?: () => void;
  onViewGuidancePrompt?: (brew: Brew) => Promise<{ systemMessage: string; userPrompt: string }>;
}

export function BrewDetail({ brew, users, onClose, onEdit, onDuplicateBrew, onDeleteBrew, onNavigatePrev, onNavigateNext, hasPrev, hasNext, scrollToGuidance, onScrollComplete, onViewGuidancePrompt }: BrewDetailProps) {
  const guidanceRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const [showGuidancePrompt, setShowGuidancePrompt] = useState(false);
  const [guidancePromptData, setGuidancePromptData] = useState<{ systemMessage: string; userPrompt: string } | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // Scroll to guidance section
  const scrollToGuidanceSection = (element: HTMLDivElement) => {
    if (hasScrolledRef.current) return;
    
    // Use requestAnimationFrame to ensure DOM is ready and layout is complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (hasScrolledRef.current) return;
        
        // Find the scrollable parent container - StandardDialog has overflow-y-auto on a div
        let scrollableParent: Element | null = element.parentElement;
        
        // Traverse up to find the scrollable container
        while (scrollableParent && scrollableParent !== document.body) {
          const styles = window.getComputedStyle(scrollableParent);
          if (styles.overflowY === 'auto' || styles.overflowY === 'scroll') {
            break;
          }
          scrollableParent = scrollableParent.parentElement;
        }
        
        if (scrollableParent && scrollableParent !== document.body) {
          // Calculate the position relative to the scrollable container
          const elementRect = element.getBoundingClientRect();
          const parentRect = scrollableParent.getBoundingClientRect();
          const relativeTop = elementRect.top - parentRect.top + scrollableParent.scrollTop;
          
          scrollableParent.scrollTo({
            top: Math.max(0, relativeTop - 20), // Add some padding from top
            behavior: 'smooth'
          });
          
          hasScrolledRef.current = true;
          onScrollComplete?.();
        } else {
          // Fallback: try to find dialog content container
          const dialogContent = document.querySelector('[data-slot="dialog-content"]');
          if (dialogContent) {
            const elementRect = element.getBoundingClientRect();
            const parentRect = dialogContent.getBoundingClientRect();
            const relativeTop = elementRect.top - parentRect.top + dialogContent.scrollTop;
            
            dialogContent.scrollTo({
              top: Math.max(0, relativeTop - 20),
              behavior: 'smooth'
            });
            
            hasScrolledRef.current = true;
            onScrollComplete?.();
          } else {
            // Final fallback to standard scrollIntoView
            element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
            hasScrolledRef.current = true;
            onScrollComplete?.();
          }
        }
      });
    });
  };

  // Reset scroll flag when brew changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [brew.id]);

  // Handle scroll when scrollToGuidance is true and element is mounted
  useEffect(() => {
    if (scrollToGuidance && guidanceRef.current && !hasScrolledRef.current) {
      scrollToGuidanceSection(guidanceRef.current);
    }
  }, [scrollToGuidance]);

  // Ref callback that fires when element is mounted
  const setGuidanceRef = (element: HTMLDivElement | null) => {
    guidanceRef.current = element;
    if (element && scrollToGuidance && !hasScrolledRef.current) {
      scrollToGuidanceSection(element);
    }
  };

  // Handle Escape key to close and arrow keys for navigation
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasNext && onNavigateNext) {
        // Left arrow = back in time (older brew)
        onNavigateNext();
      } else if (e.key === 'ArrowRight' && hasPrev && onNavigatePrev) {
        // Right arrow = forward in time (newer brew)
        onNavigatePrev();
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [onClose, onNavigatePrev, onNavigateNext, hasPrev, hasNext]);

  const formatHeaderDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
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
    const ratio = brew.finalWeight / brew.dosage;
    const rounded = Math.round(ratio * 10) / 10;
    // If it's a whole number, don't show decimal
    return `1:${rounded % 1 === 0 ? Math.round(rounded) : rounded.toFixed(1)}`;
  };

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
        {onDuplicateBrew && (
          <DropdownMenuItem onSelect={() => onDuplicateBrew(brew)} className="cursor-pointer">
            <RotateCcw className="w-4 h-4 mr-2" />
            Brew From This
          </DropdownMenuItem>
        )}
        {onViewGuidancePrompt && (
          <DropdownMenuItem
            onSelect={async () => {
              setLoadingPrompt(true);
              setShowGuidancePrompt(true);
              try {
                const data = await onViewGuidancePrompt(brew);
                setGuidancePromptData(data);
              } catch (e) {
                console.error('Failed to fetch guidance prompt:', e);
                setGuidancePromptData({ systemMessage: 'Error', userPrompt: 'Failed to fetch guidance prompt.' });
              } finally {
                setLoadingPrompt(false);
              }
            }}
            className="cursor-pointer"
          >
            <FileText className="w-4 h-4 mr-2" />
            Guidance Prompt
          </DropdownMenuItem>
        )}
        {onDeleteBrew && (
          <DropdownMenuItem onSelect={() => onDeleteBrew(brew.id)} className="cursor-pointer">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
    <StandardDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title={`Brew on ${formatHeaderDate(brew.createdAt)}`}
      subtitle={`${brew.roaster} – ${brew.coffeeName} • ${capitalizeBrewMethod(brew.brewMethod)}`}
      headerActions={headerActions}
      footerContent={
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
          <Button onClick={() => onEdit(brew)} className="flex-1 cursor-pointer">
            Edit Details
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
                  <p className="text-sm text-gray-900">{formatHeaderDate(brew.createdAt)}</p>
                </div>
              </div>
              {brew.userName && users.length > 1 && (
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Made By</p>
                    <p className="text-sm text-gray-900">{brew.userName}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Coffee className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 mb-1">Brew Method</p>
                  <p className="text-sm text-gray-900 capitalize">{capitalizeBrewMethod(brew.brewMethod)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Thermometer className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 mb-1">Temperature</p>
                  <p className="text-sm text-gray-900">{getTemperatureLabel(brew.coffeeTemperature)}</p>
                </div>
              </div>
              {brew.brewerName && (
                <div className="flex items-start gap-3">
                  <BrewEquipmentIcon className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Brewer</p>
                    <p className="text-sm text-gray-900">{brew.brewerName}</p>
                  </div>
                </div>
              )}
              {brew.grinderName && (
                <div className="flex items-start gap-3">
                  <GrinderIcon className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Grinder</p>
                    <p className="text-sm text-gray-900">{brew.grinderName}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Brew Parameters */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-gray-900 mb-4" style={{ fontWeight: 'var(--font-weight-semibold)' }}>Brew Parameters</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <Gauge className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Grind Setting</p>
                    <p className="text-sm text-gray-900">{brew.grindSetting}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Weight className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Dosage</p>
                    <p className="text-sm text-gray-900">{brew.dosage} grams</p>
                  </div>
                </div>
                
                {brew.waterTemp && (
                  <div className="flex items-start gap-3">
                    <Thermometer className="w-5 h-5 text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Water Temperature</p>
                      <p className="text-sm text-gray-900">{brew.waterTemp}°F</p>
                    </div>
                  </div>
                )}
                
                {/* Pour Over with Stages */}
                {supportsStages(brew.brewMethod) && brew.stages && brew.stages.length > 0 ? (
                  <>
                    {/* Overall metrics for pour over */}
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Extraction Time</p>
                        <p className="text-sm text-gray-900">{formatExtractionTime(parseFloat(brew.brewTime))}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Droplet className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Final Weight</p>
                        <p className="text-sm text-gray-900">{brew.finalWeight} grams</p>
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
                        {brew.stages.map((stage, index) => {
                          const startTime = index === 0 ? 0 : brew.stages![index - 1].endTime;
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
                ) : brew.brewMethod === 'immersion' ? (
                  /* Immersion */
                  <>
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Steep Time</p>
                        <p className="text-sm text-gray-900">{formatExtractionTime(parseFloat(brew.brewTime))}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Droplet className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Final Weight</p>
                        <p className="text-sm text-gray-900">{brew.finalWeight} grams</p>
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
                ) : (
                  /* Espresso or Pour Over without stages */
                  <>
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Extraction Time</p>
                        <p className="text-sm text-gray-900">{formatExtractionTime(parseFloat(brew.brewTime))}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Droplet className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Final Weight</p>
                        <p className="text-sm text-gray-900">{brew.finalWeight} grams</p>
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
                {brew.quality && brew.quality > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{getRatingEmoji(brew.quality)}</span>
                    <span className="text-sm text-gray-900">{getRatingText(brew.quality)}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Not rated</span>
                )}
              </div>

              {/* Extraction Notes */}
              {(() => {
                if (!brew.tastingNotes || brew.tastingNotes.trim() === '') {
                  return (
                    <p className="text-sm text-gray-500">No notes added</p>
                  );
                }
                const notes = brew.tastingNotes.split(', ').filter(n => n.trim());
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
                        {capitalize(note)}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Dial-In Guidance */}
            {brew.suggestion?.full && (
              <div ref={setGuidanceRef} id="dial-in-guidance" className="border-t border-gray-200 pt-6 mb-6">
                <h3 className="text-gray-900 mb-4" style={{ fontWeight: 'var(--font-weight-semibold)' }}>Next Brew: Dial-In Guidance</h3>
                <FormattedAISuggestions suggestions={brew.suggestion.full} />
              </div>
            )}

            {/* Personal Notes */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-gray-900 mb-4" style={{ fontWeight: 'var(--font-weight-semibold)' }}>Personal Notes</h3>
              {brew.personalNotes ? (
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{brew.personalNotes}</p>
              ) : (
                <p className="text-sm text-gray-500">No notes added</p>
              )}
            </div>
      </div>
    </StandardDialog>

    {showGuidancePrompt && (
      <StandardDialog
        open={showGuidancePrompt}
        onOpenChange={(open) => {
          if (!open) {
            setShowGuidancePrompt(false);
            setGuidancePromptData(null);
          }
        }}
        title="Guidance Prompt"
        subtitle="Debug view of the prompt sent to the AI model"
        footerContent={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setShowGuidancePrompt(false); setGuidancePromptData(null); }} className="cursor-pointer flex-1">
              Close
            </Button>
            {guidancePromptData && (
              <Button
                onClick={() => {
                  const text = `=== SYSTEM MESSAGE ===\n${guidancePromptData.systemMessage}\n\n=== USER PROMPT ===\n${guidancePromptData.userPrompt}`;
                  navigator.clipboard.writeText(text);
                }}
                className="cursor-pointer flex-1"
              >
                Copy to Clipboard
              </Button>
            )}
          </div>
        }
      >
        {loadingPrompt ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900" />
          </div>
        ) : guidancePromptData ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">System Message</h4>
              <pre className="text-xs text-gray-800 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words border border-gray-200 max-h-32 overflow-y-auto">
                {guidancePromptData.systemMessage}
              </pre>
            </div>
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">User Prompt</h4>
              <pre className="text-xs text-gray-800 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words border border-gray-200 max-h-[60vh] overflow-y-auto">
                {guidancePromptData.userPrompt}
              </pre>
            </div>
          </div>
        ) : null}
      </StandardDialog>
    )}
  </>
  );
}