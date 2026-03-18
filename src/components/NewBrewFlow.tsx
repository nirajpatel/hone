import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Coffee, BrewMethod, User, Brew, CoffeeTemperature, BrewStage, Equipment } from '../types';
import { QrCode, Loader2, History, Info, Plus, Trash2, X, ChevronDown, ChevronLeft, ChevronRight, Calendar, Thermometer, Gauge, Weight, Droplet, Clock, Scale, Mic, Check, MoreVertical, ArrowRightLeft } from 'lucide-react';
import { StandardDialog } from './ui/standard-dialog';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import jsQR from 'jsqr@1.4.0';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Badge } from './ui/badge';
import { TimeInput, formatTime } from './TimeInput';
import { toast } from 'sonner@2.0.3';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from './ui/alert-dialog';
import { AutocompleteDropdown } from './ui/autocomplete-dropdown';
import { getRatingEmoji, getRatingText, formatEquipmentName, capitalizeBrewMethod } from '../utils/formatters';
import { BrewEquipmentIcon } from './icons/BrewEquipmentIcon';
import { GrinderIcon } from './icons/GrinderIcon';
import { getTastingNoteSuggestions, capitalize } from '../utils/tastingNotes';
import { getAllBrewMethodConfigs, supportsStages } from '../utils/brewMethods';
import { FormattedAISuggestions, type AISuggestionsData, type FirstTimeSuggestionsData } from './DialInGuidance';
import { VoiceStagesMode } from './VoiceStagesMode';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { COPY } from '../constants/copy';
import { useWakeLock } from '../hooks/useWakeLock';

// DEV: set to true to always show the brewing popover for UI iteration
const DEV_SHOW_BREWING = false;

// Helper function to validate numeric input
const validateNumericInput = (value: string): string => {
  // Allow empty string
  if (value === '') return '';
  // Allow only digits and one decimal point
  const cleaned = value.replace(/[^\d.]/g, '');
  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

interface MachineStatus {
  serialNumber: string;
  name: string;
  modelName: string;
  connected: boolean;
  state: string;
  mode: string;
  coffeeBoilerTemp?: number;
}

interface StreamUpdate {
  type: string;
  timestamp: string;
  state?: string;
  mode?: string;
  brewDuration?: number;
  brewWeight?: number;
  coffeeBoilerTemp?: number;
}

interface NewBrewFlowProps {
  coffees: Coffee[];
  users: User[];
  currentUser: User;
  brews: Brew[];
  accessToken: string;
  onClose: () => void;
  onSave: (brew: {
    coffeeId: string;
    coffeeName: string;
    roaster: string;
    brewMethod: BrewMethod;
    grindSetting: string;
    dosage: number;
    brewTime: number;
    finalWeight: number;
    quality?: number;
    waterTemp?: number;
    coffeeTemperature: CoffeeTemperature;
    brewerId?: string;
    brewerName?: string;
    grinderId?: string;
    grinderName?: string;
    userId: string;
    userName: string;
    stages?: BrewStage[];
    tastingNotes?: string;
    personalNotes?: string;
  }) => void;
  duplicateData?: {
    id: string;
    coffeeId: string;
    coffeeName: string;
    roaster: string;
    brewMethod: BrewMethod;
    grindSetting: string;
    dosage: number;
    brewTime: number;
    finalWeight: number;
    quality?: number;
    waterTemp?: number;
    coffeeTemperature: CoffeeTemperature;
    userId: string;
    userName: string;
  } | null;
  editingBrew?: Brew | null;
  prefilledCoffeeId?: string | null;
  prefilledBrewMethod?: BrewMethod | null;
  onUpdate?: (id: string, data: {
    coffeeId: string;
    userId: string;
    grindSetting: string;
    dosage: number;
    brewTime: number;
    finalWeight: number;
    quality?: number;
    waterTemp?: number;
    coffeeTemperature: CoffeeTemperature;
    brewerId?: string;
    brewerName?: string;
    grinderId?: string;
    grinderName?: string;
    stages?: BrewStage[];
    tastingNotes?: string;
    personalNotes?: string;
  }) => void;
  equipmentChangeCounter?: number;
  onMarkCoffeeFinished?: (id: string) => void;
  onAddAnotherBag?: (coffee: Coffee) => void;
  hidden?: boolean;
}

export function NewBrewFlow({ coffees, users, currentUser, brews, accessToken, onClose, onSave, duplicateData, editingBrew, onUpdate, equipmentChangeCounter, prefilledCoffeeId, prefilledBrewMethod, onMarkCoffeeFinished, onAddAnotherBag, hidden }: NewBrewFlowProps) {
  useWakeLock(true);

  // Detect if mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Detect if tablet (iPad or Android tablet)
  const isTablet = /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768;
  
  // Detect if phone (mobile but not tablet)
  const isPhone = isMobile && !isTablet;
  
  const [coffeeId, setCoffeeId] = useState('');
  const [brewMethod, setBrewMethod] = useState<BrewMethod | ''>('');
  const [userId, setUserId] = useState(currentUser.id);
  const [grindSetting, setGrindSetting] = useState('');
  const [dosage, setDosage] = useState('');
  const [brewTime, setExtractionTime] = useState('');
  const [finalWeight, setFinalWeight] = useState('');
  const [quality, setQuality] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [coffeeTemperature, setCoffeeTemperature] = useState<CoffeeTemperature | ''>('');
  const [waterTemp, setWaterTemp] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showPreviousBrews, setShowPreviousBrews] = useState(false);
  const [isPreFilled, setIsPreFilled] = useState(false);
  const [isPreFilledFromSelection, setIsPreFilledFromSelection] = useState(false);
  const [preFilledBrew, setPreFilledBrew] = useState<Brew | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bag selector dropdown
  const [bagDropdownOpen, setBagDropdownOpen] = useState(false);
  const pendingBagSelectRef = useRef(false);
  const [finishBagPrompt, setFinishBagPrompt] = useState<{ oldBagId: string; oldBagLabel: string } | null>(null);

  // QR Scanner Modal
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrCameraStream, setQrCameraStream] = useState<MediaStream | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrScanIntervalRef = useRef<number | null>(null);

  // Equipment state
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [brewerId, setBrewerId] = useState('');
  const [grinderId, setGrinderId] = useState('');
  const [showBrewerDropdown, setShowBrewerDropdown] = useState(false);
  const [showGrinderDropdown, setShowGrinderDropdown] = useState(false);

  // Pour over stages
  const [stages, setStages] = useState<Array<{ endTime: string; endWeight: string }>>([
    { endTime: '', endWeight: '' }
  ]);
  
  // Refs for stage weight inputs for auto-focus
  const stageWeightRefs = useRef<(HTMLInputElement | null)[]>([]);
  const stageContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shouldFocusNewStage = useRef(false);

  // Voice mode for stages
  const [voiceMode, setVoiceMode] = useState(false);
  const { isSupported: voiceSupported } = useVoiceRecognition();
  const brewStagesRef = useRef<HTMLDivElement>(null);

  // Tasting notes
  const [tastingNotesPills, setTastingNotesPills] = useState<string[]>([]);
  const [tastingNotesInput, setTastingNotesInput] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');

  // AI Suggestions
  const [suggestions, setSuggestions] = useState<string | AISuggestionsData | FirstTimeSuggestionsData | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [thinkingText, setThinkingText] = useState<string>('');
  const lastSuggestionCoffeeIdRef = useRef<string>('');
  const lastSuggestionBrewerIdRef = useRef<string>('');
  const lastSuggestionGrinderIdRef = useRef<string>('');
  const lastSuggestionBrewMethodRef = useRef<string>('');

  // Collapsible states for information boxes
  const [isPrefilledOpen, setIsPrefilledOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(true); // Open by default when baselineMode is 'most-recent'

  // Baseline brew mode
  const [baselineMode, setBaselineMode] = useState<'most-recent' | 'best' | 'browse-all'>('most-recent');

  // Keep Dial-In Guidance open when baselineMode is 'most-recent', closed otherwise
  useEffect(() => {
    if (baselineMode === 'most-recent') {
      setIsSuggestionsOpen(true);
    } else {
      setIsSuggestionsOpen(false);
    }
  }, [baselineMode]);
  const [browseAllIndex, setBrowseAllIndex] = useState(0);
  const lastSuggestionBrewIdRef = useRef<string>('');

  useEffect(() => {
    if (voiceMode && brewStagesRef.current) {
      brewStagesRef.current.scrollIntoView({ block: 'start' });
    }
  }, [voiceMode, loadingSuggestions, suggestions, thinkingText]);

  const isEditMode = !!editingBrew;

  // La Marzocco machine status
  const [machineStatus, setMachineStatus] = useState<MachineStatus | null>(null);
  const [machineError, setMachineError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const previousCoffeeIdRef = useRef<string>('');
  const previousBrewMethodRef = useRef<string>('');
  const initializedEditingIdRef = useRef<string | null>(null);
  const brewingStateTimestampRef = useRef<number | null>(null);
  const stalenessCheckIntervalRef = useRef<number | null>(null);
  const previousBrewingStateRef = useRef<string | null>(null);
  
  const selectedCoffee = coffees.find(c => c.id === coffeeId);

  // All bag IDs for the same bean (same roaster + name) so baseline matching spans bags
  const sameCoffeeBagIds = useMemo(() => {
    if (!selectedCoffee) return new Set<string>(coffeeId ? [coffeeId] : []);
    return new Set(
      coffees
        .filter(c => c.roaster === selectedCoffee.roaster && c.name === selectedCoffee.name)
        .map(c => c.id)
    );
  }, [coffeeId, coffees, selectedCoffee]);

  const activeBags = useMemo(() => {
    if (!selectedCoffee) return [];
    return coffees
      .filter(c => c.roaster === selectedCoffee.roaster && c.name === selectedCoffee.name && !c.finished)
      .sort((a, b) => {
        if (a.roastDate && b.roastDate) {
          const [ay, am, ad] = a.roastDate.split('-').map(Number);
          const [by, bm, bd] = b.roastDate.split('-').map(Number);
          return new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [selectedCoffee, coffees]);

  const isEspresso = brewMethod === 'espresso';
  const isImmersion = brewMethod === 'immersion';

  // Check if La Marzocco status should be shown
  const shouldShowLaMarzoccoStatus = () => {
    if (!brewerId) return false;
    
    const selectedBrewer = equipment.find(e => e.id === brewerId);
    if (!selectedBrewer) return false;
    
    // Check if brewer is La Marzocco Linea Mini
    const isLaMarzoccoLineaMini = 
      selectedBrewer.company?.toLowerCase() === 'la marzocco' && 
      selectedBrewer.model?.toLowerCase() === 'linea mini';
    
    if (!isLaMarzoccoLineaMini) return false;
    
    // Check if user or household matches the allowed IDs
    const allowedUserId = 'LAMARZOCCO_ALLOWED_USER_ID';
    const allowedHouseholdId = 'LAMARZOCCO_ALLOWED_HOUSEHOLD_ID';
    
    return currentUser.id === allowedUserId || currentUser.householdId === allowedHouseholdId;
  };

  const getCoffeesForDropdown = () => {
    const coffeeLastBrewed = new Map<string, Date>();
    brews.forEach(brew => {
      const brewDate = new Date(brew.createdAt);
      const currentLast = coffeeLastBrewed.get(brew.coffeeId);
      if (!currentLast || brewDate > currentLast) {
        coffeeLastBrewed.set(brew.coffeeId, brewDate);
      }
    });

    const recentlyUsed = coffees
      .filter(c => coffeeLastBrewed.has(c.id))
      .sort((a, b) => coffeeLastBrewed.get(b.id)!.getTime() - coffeeLastBrewed.get(a.id)!.getTime())
      .slice(0, 3);

    const recentlyUsedIds = new Set(recentlyUsed.map(c => c.id));
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const recentlyAdded = coffees
      .filter(c => {
        if (recentlyUsedIds.has(c.id)) return false;
        if (!c.roastDate) return false;
        const [year, monthNum, day] = c.roastDate.split('-').map(Number);
        return new Date(year, monthNum - 1, day) >= twoWeeksAgo;
      })
      .sort((a, b) => {
        const [ay, am, ad] = a.roastDate.split('-').map(Number);
        const [by, bm, bd] = b.roastDate.split('-').map(Number);
        return new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime();
      })
      .slice(0, 2);

    return { recentlyUsed, recentlyAdded, coffeeLastBrewed };
  };

  const getDropdownLabel = (searchQuery: string) => {
    if (searchQuery) {
      return `Beans matching "${searchQuery}"`;
    }
    return '';
  };

  // Fetch machine status (for polling)
  const fetchMachineStatus = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/lamarzocco/status`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to fetch status');
      }

      const data = await response.json();
      setMachineStatus(data);
      setMachineError(null);
      
      // Update water temperature from initial status
      if (data.coffeeBoilerTemp !== undefined && !isEditMode) {
        const tempF = (data.coffeeBoilerTemp * 9 / 5) + 32;
        const roundedTemp = Math.round(tempF * 10) / 10;
        setWaterTemp(roundedTemp.toString());
      }
      
      return data;
    } catch (err: any) {
      // Set error state so UI shows error instead of stuck in "Connecting..."
      setMachineError(err.message || 'Connection failed');
      setMachineStatus(null);
      return null;
    }
  };

  // Start streaming machine status
  const startStreaming = () => {
    if (eventSourceRef.current) {
      return; // Already streaming
    }

    // Clear polling interval immediately
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    // Start staleness checker - verify brewing state hasn't been stuck for too long
    if (!stalenessCheckIntervalRef.current) {
      stalenessCheckIntervalRef.current = setInterval(async () => {
        // If we've been in brewing state for more than 45 seconds, poll to verify
        if (brewingStateTimestampRef.current) {
          const brewingDuration = Date.now() - brewingStateTimestampRef.current;
          if (brewingDuration > 45000) { // 45 seconds
            console.log('La Marzocco: Brewing state may be stale, polling for fresh status');
            try {
              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/lamarzocco/status`,
                {
                  headers: {
                    'Authorization': `Bearer ${publicAnonKey}`,
                  },
                }
              );
              if (response.ok) {
                const status = await response.json();
                setMachineStatus(status);
                
                // Update brewing timestamp tracker
                const stateUpper = status.state?.toUpperCase();
                if (stateUpper === 'BREWING') {
                  // Still brewing - keep the timestamp
                } else {
                  // Not brewing anymore - clear the timestamp
                  brewingStateTimestampRef.current = null;
                }
              }
            } catch (err) {
              console.error('La Marzocco: Staleness check failed', err);
            }
          }
        }
      }, 5000); // Check every 5 seconds
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 2000; // Start with 2 seconds

    // Use fetch with ReadableStream instead of EventSource to support auth headers
    const connectStream = async () => {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/lamarzocco/stream`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Stream connection failed: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let lastActivityTime = Date.now();
        const activityTimeoutMs = 30000; // 30 seconds - detect dead Edge Function quickly

        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;

        // Store reader in ref so we can cancel it
        eventSourceRef.current = { close: () => reader.cancel() } as any;

        // Activity timeout checker
        const activityChecker = setInterval(() => {
          const timeSinceLastActivity = Date.now() - lastActivityTime;
          if (timeSinceLastActivity > activityTimeoutMs) {
            console.log('La Marzocco: Stream inactive, reconnecting...');
            clearInterval(activityChecker);
            reader.cancel();
            eventSourceRef.current = null;
            // Trigger reconnection
            attemptReconnect();
          }
        }, 5000); // Check every 5 seconds for fast disconnect detection

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              clearInterval(activityChecker);
              eventSourceRef.current = null;
              attemptReconnect();
              break;
            }

            lastActivityTime = Date.now(); // Update activity timestamp

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                const eventType = line.substring(7);
                continue;
              }

              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                
                try {
                  const update: StreamUpdate = JSON.parse(data);

                  // Populate form fields only when brewing completes
                  if (update.type === 'brewing_complete') {
                    if (update.brewDuration !== undefined) {
                      const roundedTime = Math.round(update.brewDuration);
                      setExtractionTime(roundedTime.toString());
                    }
                    
                    if (update.brewWeight !== undefined) {
                      const roundedWeight = Math.round(update.brewWeight * 10) / 10;
                      setFinalWeight(roundedWeight.toString());
                    }
                  }

                  // Update machine status with all available data
                  if (update.state || update.coffeeBoilerTemp !== undefined) {
                    setMachineStatus(prev => {
                      // Handle initial event with full data
                      if (!prev && update.type === 'initial') {
                        return {
                          serialNumber: (update as any).serialNumber || '',
                          name: (update as any).name || '',
                          modelName: (update as any).modelName || '',
                          connected: (update as any).connected || false,
                          state: update.state || '',
                          mode: update.mode || '',
                          coffeeBoilerTemp: update.coffeeBoilerTemp
                        };
                      }
                      if (!prev) return null;
                      return {
                        ...prev,
                        ...(update.state && { state: update.state }),
                        ...(update.coffeeBoilerTemp !== undefined && { coffeeBoilerTemp: update.coffeeBoilerTemp })
                      };
                    });
                    
                    // Track when brewing state starts/ends
                    if (update.state) {
                      const stateUpper = update.state.toUpperCase();
                      if (stateUpper === 'BREWING') {
                        if (!brewingStateTimestampRef.current) {
                          brewingStateTimestampRef.current = Date.now();
                        }
                      } else {
                        brewingStateTimestampRef.current = null;
                      }
                    }
                    
                    // Update water temperature from coffee boiler temp (on all updates, not just during brewing)
                    if (update.coffeeBoilerTemp !== undefined && !isEditMode) {
                      const tempF = (update.coffeeBoilerTemp * 9 / 5) + 32;
                      const roundedTemp = Math.round(tempF * 10) / 10;
                      setWaterTemp(roundedTemp.toString());
                    }
                    
                    // Clear form fields when brewing starts
                    if (update.state) {
                      const stateUpper = update.state.toUpperCase();
                      if (stateUpper === 'BREWING' && update.type === 'brewing_started') {
                        setExtractionTime('');
                        setFinalWeight('');
                      }
                      
                      // If state changed to STANDBY or OFF, stop streaming and start polling
                      if (stateUpper === 'STANDBY' || stateUpper === 'OFF') {
                        clearInterval(activityChecker);
                        stopStreaming();
                        startPolling();
                        break;
                      }
                    }
                  }
                } catch (err) {
                  // Silently handle parse errors
                }
              }
            }
          }
        } catch (readError) {
          // Stream read error - silently reconnect
          clearInterval(activityChecker);
          eventSourceRef.current = null;
          attemptReconnect();
        }
      } catch (err: any) {
        // Stream connection error - silently reconnect
        eventSourceRef.current = null;
        attemptReconnect();
      }
    };

    const attemptReconnect = () => {
      // Don't reconnect if we've stopped manually or exceeded max attempts
      if (!eventSourceRef.current && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts - 1); // Exponential backoff
        
        setTimeout(() => {
          // Double-check we haven't started polling or closed in the meantime
          if (!pollIntervalRef.current && !eventSourceRef.current) {
            connectStream();
          }
        }, delay);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        setMachineError('Stream connection unstable, using polling mode');
        startPolling();
      }
    };

    connectStream();
  };

  // Stop streaming
  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // Clear staleness checker
    if (stalenessCheckIntervalRef.current) {
      clearInterval(stalenessCheckIntervalRef.current);
      stalenessCheckIntervalRef.current = null;
    }
    
    // Clear brewing timestamp
    brewingStateTimestampRef.current = null;
  };

  // Start polling machine status
  const startPolling = () => {
    if (pollIntervalRef.current) {
      return; // Already polling
    }

    // Initial fetch
    fetchMachineStatus().then(status => {
      if (status) {
        const state = status.state;
        
        // If STANDBY or OFF, start polling every second
        const stateUpper = state.toUpperCase();
        if (stateUpper === 'STANDBY' || stateUpper === 'OFF') {
          pollIntervalRef.current = window.setInterval(async () => {
            // CRITICAL: Check if streaming started, if so stop polling immediately and exit
            if (eventSourceRef.current) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              return; // Exit immediately
            }

            const currentStatus = await fetchMachineStatus();
            if (currentStatus) {
              const currentState = currentStatus.state;
              const currentStateUpper = currentState.toUpperCase();
              // Switch to streaming if state changes to POWERED_ON or BREWING
              if (currentStateUpper === 'POWEREDON' || currentStateUpper === 'BREWING' || currentStateUpper === 'POWERED_ON') {
                // CRITICAL: Clear interval BEFORE calling startStreaming
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                // Now start streaming
                startStreaming();
              }
            }
          }, 1000);
        } else if (stateUpper === 'POWEREDON' || stateUpper === 'BREWING' || stateUpper === 'POWERED_ON') {
          // Already powered on or brewing, start streaming immediately
          startStreaming();
        }
      }
    }).catch(err => {
      console.error('La Marzocco: Error in initial fetch:', err);
      setMachineError(err.message || 'Connection failed');
    });

    // Cleanup function
    return () => {
      stopStreaming();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (stalenessCheckIntervalRef.current) {
        clearInterval(stalenessCheckIntervalRef.current);
        stalenessCheckIntervalRef.current = null;
      }
      brewingStateTimestampRef.current = null;
    };
  };

  // La Marzocco machine status effect
  useEffect(() => {
    // Don't monitor machine status in edit mode - only for new brews
    if (isEditMode) {
      return;
    }

    // Only monitor if conditions are met for La Marzocco integration
    if (!isEspresso || !shouldShowLaMarzoccoStatus()) {
      // Clean up if not espresso or conditions not met
      stopStreaming();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setMachineStatus(null);
      setMachineError(null);
      return;
    }

    // Start polling - this will handle everything
    const cleanup = startPolling();

    // Cleanup on unmount
    return () => {
      stopStreaming();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isEspresso, isEditMode, brewerId, equipment]);

  // Scroll to extraction time field when brewing popover closes
  useEffect(() => {
    const currentBrewingState = machineStatus?.state.toUpperCase();
    const wasBrewing = previousBrewingStateRef.current === 'BREWING';
    const isNowNotBrewing = currentBrewingState !== 'BREWING';
    
    // If we transitioned from BREWING to non-BREWING, scroll to the extraction time field
    if (wasBrewing && isNowNotBrewing && !isEditMode && isEspresso) {
      // Use setTimeout to ensure the form is visible after popover closes
      setTimeout(() => {
        const brewTimeInput = document.getElementById('brewTime');
        if (brewTimeInput) {
          brewTimeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Optionally focus the field
          (brewTimeInput as HTMLInputElement).focus();
        }
      }, 100);
    }
    
    // Update the previous state
    previousBrewingStateRef.current = currentBrewingState || null;
  }, [machineStatus?.state, isEditMode, isEspresso]);

  // Fetch equipment on mount and when app resumes from background
  const fetchEquipment = async () => {
    setEquipmentLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/equipment`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEquipment(data);
      } else {
        toast.error('Failed to load equipment');
      }
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast.error('Failed to load equipment');
    } finally {
      setEquipmentLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipment();
  }, [accessToken, equipmentChangeCounter]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchEquipment();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [accessToken]);

  // Auto-select equipment when coffee or brew method changes or equipment loads
  useEffect(() => {
    if (!brewMethod || equipment.length === 0) return;
    // Skip auto-selection in edit mode - let the edit mode initialization handle it
    if (isEditMode) return;

    const activeBrewers = equipment.filter(
      e => e.type === 'brewer' && e.method === brewMethod && e.active
    );
    const activeGrinders = equipment.filter(
      e => e.type === 'grinder' && e.active && (
        // Support both methods array (new) and single method (legacy)
        (e.methods && e.methods.includes(brewMethod)) || e.method === brewMethod
      )
    );

    // Check if current selections are valid for the brew method
    const currentBrewerValid = brewerId && activeBrewers.some(b => b.id === brewerId);
    const currentGrinderValid = grinderId && activeGrinders.some(g => g.id === grinderId);

    // Reset or auto-select brewer
    if (!currentBrewerValid) {
      if (activeBrewers.length === 1) {
        setBrewerId(activeBrewers[0].id);
      } else if (activeBrewers.length > 1) {
        // Auto-select primary brewer if available (check primaryForMethods first, fall back to primary)
        const primaryBrewer = activeBrewers.find(b => {
          const primaryForMethods = b.primaryForMethods || (b.primary ? [b.method] : []);
          return primaryForMethods.includes(brewMethod);
        });
        setBrewerId(primaryBrewer ? primaryBrewer.id : '');
      } else {
        setBrewerId('');
      }
    }

    // Reset or auto-select grinder
    if (!currentGrinderValid) {
      if (activeGrinders.length === 1) {
        setGrinderId(activeGrinders[0].id);
      } else if (activeGrinders.length > 1) {
        // Auto-select primary grinder if available (check primaryForMethods first, fall back to primary)
        const primaryGrinder = activeGrinders.find(g => {
          const primaryForMethods = g.primaryForMethods || (g.primary ? [g.method] : []);
          return primaryForMethods.includes(brewMethod);
        });
        setGrinderId(primaryGrinder ? primaryGrinder.id : '');
      } else {
        setGrinderId('');
      }
    }
  }, [coffeeId, selectedCoffee, equipment, isEditMode, brewMethod]);

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPreviousBrews) {
          setShowPreviousBrews(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, showPreviousBrews]);

  // Initialize with duplicate data if provided
  useEffect(() => {
    if (duplicateData) {
      setCoffeeId(duplicateData.coffeeId);
      setBrewMethod(duplicateData.brewMethod);
      setUserId(duplicateData.userId);
      // Don't copy extraction time - leave empty for duplicate
      setExtractionTime('');
      // Don't copy final weight - leave empty for duplicate
      setFinalWeight('');
      // Don't copy quality - reset to 0 for duplicate
      setQuality(0);
      // Don't copy tasting notes - leave empty for duplicate
      setTastingNotesPills([]);
      // Don't copy personal notes - leave empty for duplicate
      setPersonalNotes('');
      
        // Set the duplicated brew as the baseline brew
      const baselineBrew = brews.find(b => b.id === duplicateData.id);
      if (baselineBrew) {
        // Apply baseline brew (same logic as applyBaselineBrew function)
        setCoffeeTemperature(baselineBrew.coffeeTemperature);
        setGrindSetting(baselineBrew.grindSetting);
        setDosage(baselineBrew.dosage.toString());
        setWaterTemp(baselineBrew.waterTemp ? baselineBrew.waterTemp.toString() : '');
        if (baselineBrew.brewerId) setBrewerId(baselineBrew.brewerId);
        if (baselineBrew.grinderId) setGrinderId(baselineBrew.grinderId);
        setPreFilledBrew(baselineBrew);

        // Set to Browse All mode scrolled to the selected brew (match across all bags of same bean)
        const baselineCoffee = coffees.find(c => c.id === baselineBrew.coffeeId);
        const bagIds = baselineCoffee
          ? new Set(coffees.filter(c => c.roaster === baselineCoffee.roaster && c.name === baselineCoffee.name).map(c => c.id))
          : new Set([baselineBrew.coffeeId]);
        const matching = brews
          .filter(e => bagIds.has(e.coffeeId) && e.brewMethod === baselineBrew.brewMethod)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const idx = matching.findIndex(b => b.id === baselineBrew.id);
        setBaselineMode('browse-all');
        setBrowseAllIndex(idx >= 0 ? idx : 0);
      } else {
        // Fallback: if brew not found, set fields manually from duplicateData
      setGrindSetting(duplicateData.grindSetting);
      setDosage(duplicateData.dosage.toString());
      setWaterTemp(duplicateData.waterTemp ? duplicateData.waterTemp.toString() : '');
      setCoffeeTemperature(duplicateData.coffeeTemperature);
      if (duplicateData.brewerId) setBrewerId(duplicateData.brewerId);
      if (duplicateData.grinderId) setGrinderId(duplicateData.grinderId);
    }
    }
  }, [duplicateData, brews]);

  // Auto-select coffee and brew method from barista's last brew
  // Runs on mount and whenever barista (userId) changes
  useEffect(() => {
    // Only auto-select if not duplicating, editing, or prefilling
    if (!duplicateData && !editingBrew && !prefilledCoffeeId && !prefilledBrewMethod) {
      // Find the most recent brew for the selected barista
      const baristaBrews = brews
        .filter(e => e.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (baristaBrews.length > 0) {
        const lastBrew = baristaBrews[0];
        // Auto-select coffee and brew method
        setCoffeeId(lastBrew.coffeeId);
        setBrewMethod(lastBrew.brewMethod);
      } else {
        // If the barista has no brews, clear the selections
        setCoffeeId('');
        setBrewMethod('');
      }
    }
  }, [userId]); // Run when userId changes (including on mount since it's initialized to currentUser.id)

  // Initialize with prefilled coffee and brew method if provided
  useEffect(() => {
    if (prefilledCoffeeId && prefilledBrewMethod && !duplicateData && !editingBrew) {
      setCoffeeId(prefilledCoffeeId);
      setBrewMethod(prefilledBrewMethod);
    }
  }, [prefilledCoffeeId, prefilledBrewMethod, duplicateData, editingBrew]);

  // Initialize with editing brew data if provided
  useEffect(() => {
    if (editingBrew && initializedEditingIdRef.current !== editingBrew.id) {
      initializedEditingIdRef.current = editingBrew.id;
      
      setCoffeeId(editingBrew.coffeeId);
      setBrewMethod(editingBrew.brewMethod);
      setUserId(editingBrew.userId);
      setGrindSetting(editingBrew.grindSetting);
      setDosage(editingBrew.dosage.toString());
      setQuality(editingBrew.quality || 0);
      setWaterTemp(editingBrew.waterTemp ? editingBrew.waterTemp.toString() : '');
      setCoffeeTemperature(editingBrew.coffeeTemperature);
      
      // Set equipment IDs if available
      if (editingBrew.brewerId) setBrewerId(editingBrew.brewerId);
      if (editingBrew.grinderId) setGrinderId(editingBrew.grinderId);
      
      // Load tasting notes
      if (editingBrew.tastingNotes) {
        setTastingNotesPills(editingBrew.tastingNotes.split(', ').filter(note => note.trim()));
      }
      
      // Load personal notes
      if (editingBrew.personalNotes) {
        setPersonalNotes(editingBrew.personalNotes);
      }
      
      // For pour over, load stages if available, otherwise use brewTime and finalWeight
      if (supportsStages(editingBrew.brewMethod)) {
        if (editingBrew.stages && editingBrew.stages.length > 0) {
          setStages(editingBrew.stages.map(stage => ({
            endTime: stage.endTime.toString(),
            endWeight: stage.endWeight.toString(),
          })));
        } else {
          // If no stages, create one from brewTime and finalWeight
          setStages([{
            endTime: editingBrew.brewTime.toString(),
            endWeight: editingBrew.finalWeight.toString(),
          }]);
        }
      } else {
        // Espresso
        setExtractionTime(editingBrew.brewTime.toString());
        setFinalWeight(editingBrew.finalWeight.toString());
      }
    } else if (!editingBrew) {
      // Reset the ref when not editing
      initializedEditingIdRef.current = null;
    }
  }, [editingBrew]);

  // Re-open bag dropdown after add-new-bag flow completes
  useEffect(() => {
    if (pendingBagSelectRef.current && coffeeId) {
      const selected = coffees.find(c => c.id === coffeeId);
      if (selected) {
        const sameBeanBags = coffees.filter(
          c => c.roaster === selected.roaster && c.name === selected.name
        );
        if (sameBeanBags.length > 1) {
          pendingBagSelectRef.current = false;
          setBagDropdownOpen(true);
        }
      }
    }
  }, [coffees, coffeeId]);

  // Pre-fill grind setting and dosage from most recent brew with same coffee and method
  useEffect(() => {
    if (coffeeId && brewMethod && !duplicateData && !editingBrew) {
      // Reset fields when coffee ID or brew method changes
      if (previousCoffeeIdRef.current !== coffeeId || previousBrewMethodRef.current !== brewMethod) {
        previousCoffeeIdRef.current = coffeeId;
        previousBrewMethodRef.current = brewMethod;
        
        const selectedCoffee = coffees.find(c => c.id === coffeeId);
        if (selectedCoffee) {
          // Reset fields when coffee or brew method changes
          setGrindSetting('');
          setDosage('');
          setExtractionTime('');
          setFinalWeight('');
          setWaterTemp('');
          setQuality(0);
          setIsPreFilled(false);
          setIsPreFilledFromSelection(false);
          setPreFilledBrew(null);
          
          // Find the most recent brew with the same coffee (any bag) and method
          const matchingBrews = brews
            .filter(e => sameCoffeeBagIds.has(e.coffeeId) && e.brewMethod === brewMethod)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          if (matchingBrews.length > 0) {
            const mostRecent = matchingBrews[0];
            // Pre-fill from most recent brew
            setGrindSetting(mostRecent.grindSetting);
            setDosage(mostRecent.dosage.toString());
            setCoffeeTemperature(mostRecent.coffeeTemperature);
            // Pre-fill waterTemp if it exists
            if (mostRecent.waterTemp) {
              setWaterTemp(mostRecent.waterTemp.toString());
            }
            // Pre-fill equipment if it exists and is still active
            if (mostRecent.brewerId) {
              const brewerStillActive = equipment.find(
                e => e.id === mostRecent.brewerId && e.active && e.method === brewMethod
              );
              if (brewerStillActive) {
                setBrewerId(mostRecent.brewerId);
              }
            }
            if (mostRecent.grinderId) {
              const grinderStillActive = equipment.find(
                e => e.id === mostRecent.grinderId && e.active && e.method === brewMethod
              );
              if (grinderStillActive) {
                setGrinderId(mostRecent.grinderId);
              }
            }
            setIsPreFilled(true);
            setPreFilledBrew(mostRecent);
          } else {
          }
        }
      }
    }
  }, [coffeeId, duplicateData, editingBrew, coffees, brews, equipment, brewMethod]);

  // Fetch AI suggestions when suggestions dialog is opened
  useEffect(() => {
    const abortController = new AbortController();

    const fetchSuggestions = async () => {
      // Only fetch when dialog is opened
      if (!isSuggestionsOpen) {
        return;
      }

      if (!coffeeId || duplicateData || editingBrew || !coffees || !brews) {
        setSuggestions(null);
        return;
      }

      // Only fetch if the baseline brew has changed since last fetch
      const currentBaselineBrew = getBaselineBrew();
      const currentBrewId = currentBaselineBrew?.id || '';
      
      if (lastSuggestionBrewIdRef.current === currentBrewId && 
          lastSuggestionCoffeeIdRef.current === coffeeId && 
          lastSuggestionBrewerIdRef.current === brewerId &&
          lastSuggestionGrinderIdRef.current === grinderId &&
          lastSuggestionBrewMethodRef.current === brewMethod) {
        return;
      }

      const selectedCoffee = coffees.find(c => c.id === coffeeId);
      if (!selectedCoffee) return;

      // Find all brews with the same coffee (any bag) and method
      const matchingBrews = brews
        .filter(e => sameCoffeeBagIds.has(e.coffeeId) && e.brewMethod === brewMethod)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Check if baseline brew is the most recent brew
      const mostRecentBrew = matchingBrews.length > 0 ? matchingBrews[0] : null;
      const isBaselineMostRecent = currentBaselineBrew && mostRecentBrew && currentBaselineBrew.id === mostRecentBrew.id;

      // Check if baseline brew is exceptional (quality === 3)
      // If so, show special message and skip LLM call
      if (currentBaselineBrew?.quality === 3) {
        setSuggestions("The baseline brew shows excellent balance and extraction. No adjustments are recommended — this recipe is dialed in.");
        setLoadingSuggestions(false);
        setThinkingText('');
        
        // Mark as analyzed
        lastSuggestionCoffeeIdRef.current = coffeeId;
        lastSuggestionBrewerIdRef.current = brewerId;
        lastSuggestionGrinderIdRef.current = grinderId;
        lastSuggestionBrewMethodRef.current = brewMethod;
        lastSuggestionBrewIdRef.current = currentBrewId;
        return;
      }

      // If baseline brew is most recent and has stored full suggestion, use it (regardless of confidence)
      // Note: If suggestions haven't been processed yet (background job still running), 
      // suggestion?.full will be undefined and we'll fall through to make a live LLM call
      if (isBaselineMostRecent && currentBaselineBrew.suggestion?.full) {
        // Use stored full suggestion
        setSuggestions(currentBaselineBrew.suggestion.full);
        setLoadingSuggestions(false);
        setThinkingText('');
        
        // Mark as analyzed
        lastSuggestionCoffeeIdRef.current = coffeeId;
        lastSuggestionBrewerIdRef.current = brewerId;
        lastSuggestionGrinderIdRef.current = grinderId;
        lastSuggestionBrewMethodRef.current = brewMethod;
        lastSuggestionBrewIdRef.current = currentBrewId;
        return;
      }

      // Fall through to live LLM call if:
      // - Baseline brew is not most recent (newer brews exist)
      // - Suggestions haven't been processed yet (background job still running)
      // - No stored suggestions exist

      // Mark this coffee, equipment, brew method, and brew as analyzed
      lastSuggestionCoffeeIdRef.current = coffeeId;
      lastSuggestionBrewerIdRef.current = brewerId;
      lastSuggestionGrinderIdRef.current = grinderId;
      lastSuggestionBrewMethodRef.current = brewMethod;
      lastSuggestionBrewIdRef.current = currentBrewId;

      setLoadingSuggestions(true);
      setThinkingText('Analyzing');
      setSuggestions(null);

      try {
        // Determine if this is a first-time coffee (no previous brews)
        const isFirstTime = matchingBrews.length === 0;
        
        let brewsToSend: Brew[] = [];
        let baselineBrewId: string | null = null;
        let exceptionalBrewId: string | null = null;
        
        if (!isFirstTime) {
          // Take top 10 most recent brews
          const top10Recent = matchingBrews.slice(0, 10);
          const top10Ids = new Set(top10Recent.map(b => b.id));
          
          // Find baseline brew (the one being analyzed)
          const baselineBrew = preFilledBrew || matchingBrews[0];
          baselineBrewId = baselineBrew?.id || null;
          
          // Find most recent Exceptional brew (quality === 3)
          const exceptionalBrew = matchingBrews.find(b => b.quality === 3);
          exceptionalBrewId = exceptionalBrew?.id || null;
          
          // Start with top 10
          brewsToSend = [...top10Recent];
          
          // Add baseline brew if not already in top 10
          if (baselineBrewId && !top10Ids.has(baselineBrewId)) {
            brewsToSend.push(baselineBrew);
          }
          
          // Add exceptional brew if not already included
          if (exceptionalBrew && !brewsToSend.find(b => b.id === exceptionalBrew.id)) {
            brewsToSend.push(exceptionalBrew);
          }
          
          // Re-sort chronologically (most recent first)
          brewsToSend.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        
        const brewer = brewerId ? equipment.find(e => e.id === brewerId) : undefined;
        const grinder = grinderId ? equipment.find(e => e.id === grinderId) : undefined;
        const brewerName = brewer ? formatEquipmentName(brewer) : undefined;
        const grinderName = grinder ? formatEquipmentName(grinder) : undefined;
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/brew-suggestions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              coffee: {
                name: selectedCoffee.name,
                roaster: selectedCoffee.roaster,
                notes: selectedCoffee.notes,
                brewMethod: brewMethod,
                region: selectedCoffee.region,
                roastLevel: selectedCoffee.roastLevel,
              },
              brews: brewsToSend.map(e => ({
                id: e.id,
                grindSetting: e.grindSetting,
                dosage: e.dosage,
                waterTemp: e.waterTemp,
                brewTime: e.brewTime,
                finalWeight: e.finalWeight,
                quality: e.quality,
                tastingNotes: e.tastingNotes,
                brewMethod: e.brewMethod,
                stages: e.stages,
                coffeeTemperature: e.coffeeTemperature,
                brewerName: e.brewerName,
                grinderName: e.grinderName,
                notes: e.notes,
                createdAt: e.createdAt,
                isBaseline: e.id === baselineBrewId,
                isExceptional: e.id === exceptionalBrewId,
              })),
              brewMethod: brewMethod,
              targetBrewId: baselineBrewId,
              brewerName,
              grinderName,
            }),
            signal: abortController.signal,
          }
        );

        if (abortController.signal.aborted) return;

        if (response.ok) {
          // Handle regular JSON response
          const data = await response.json();
          if (!abortController.signal.aborted) {
            setSuggestions(data);
            setThinkingText(''); // Clear thinking text when done
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch suggestions:', response.status, errorData);
          if (!abortController.signal.aborted) {
            setSuggestions(null);
            setThinkingText('');
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error('Error fetching suggestions:', error);
        setSuggestions(null);
        setThinkingText('');
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingSuggestions(false);
        }
      }
    };

    fetchSuggestions();

    return () => {
      abortController.abort();
    };
  }, [isSuggestionsOpen, coffeeId, duplicateData, editingBrew, brewerId, grinderId, brewMethod]);

  // Auto-focus on next stage's time input when a new stage is added
  const prevStagesLengthRef = useRef(stages.length);
  useEffect(() => {
    // If stages length increased and we should focus on the new stage
    if (stages.length > prevStagesLengthRef.current && shouldFocusNewStage.current) {
      shouldFocusNewStage.current = false;
      const newStageIndex = stages.length - 1;
      setTimeout(() => {
        // Find the first input in the new stage's container and focus it
        const container = stageContainerRefs.current[newStageIndex];
        if (container) {
          const firstInput = container.querySelector('input');
          if (firstInput) {
            (firstInput as HTMLInputElement).focus();
          }
        }
      }, 50);
    }
    prevStagesLengthRef.current = stages.length;
  }, [stages.length]);

  // For espresso and immersion, require brewTime and finalWeight
  // For pour over, require all stages except the last one to have endTime and endWeight
  // The last stage is optional (allows for an empty stage to be ready for input)
  const canSave = coffeeId && brewMethod && userId && grindSetting && dosage && coffeeTemperature && (
    (isEspresso || isImmersion)
      ? (brewTime && finalWeight)
      : stages.slice(0, -1).every(stage => stage.endTime && stage.endWeight) && 
        (stages.length === 1 ? (stages[0].endTime && stages[0].endWeight) : true)
  );



  const handleSave = async () => {
    if (!canSave || !selectedCoffee || isSaving || !brewMethod) return;

    setIsSaving(true);

    try {
      const selectedUser = users.find(u => u.id === userId);
      if (!selectedUser) return;

      // For pour over, use the last stage's values as brewTime and finalWeight
      // Filter out empty final stage
      let finalBrewTime: number;
      let finalBrewWeight: number;

      if (supportsStages(brewMethod)) {
        // Filter out the last stage if it's empty
        const validStages = stages.filter(stage => stage.endTime && stage.endWeight);
        if (validStages.length === 0) {
          console.error('No valid stages found for pour over brew');
          return;
        }
        const lastStage = validStages[validStages.length - 1];
        finalBrewTime = parseFloat(lastStage.endTime);
        finalBrewWeight = parseFloat(lastStage.endWeight);
      } else {
        finalBrewTime = parseFloat(brewTime);
        finalBrewWeight = parseFloat(finalWeight);
      }

      // Get equipment names
      const brewer = equipment.find(e => e.id === brewerId);
      const grinder = equipment.find(e => e.id === grinderId);

      if (isEditMode && editingBrew && onUpdate) {
        // Update existing brew
        // Preserve original equipment names if equipment was deleted (not found in equipment list)
        const finalBrewerName = brewer?.name || (brewerId === editingBrew.brewerId ? editingBrew.brewerName : undefined);
        const finalGrinderName = grinder?.name || (grinderId === editingBrew.grinderId ? editingBrew.grinderName : undefined);
        
        await onUpdate(editingBrew.id, {
          coffeeId,
          brewMethod,
          userId,
          grindSetting,
          dosage: parseFloat(dosage),
          brewTime: finalBrewTime,
          finalWeight: finalBrewWeight,
          quality: quality > 0 ? quality : undefined,
          waterTemp: waterTemp ? parseFloat(waterTemp) : undefined,
          coffeeTemperature,
          brewerId: brewerId || undefined,
          brewerName: finalBrewerName,
          grinderId: grinderId || undefined,
          grinderName: finalGrinderName,
          stages: supportsStages(brewMethod) ? stages.filter(stage => stage.endTime && stage.endWeight).map(stage => ({
            endTime: parseFloat(stage.endTime),
            endWeight: parseFloat(stage.endWeight),
          })) : undefined,
          tastingNotes: tastingNotesPills.join(', '),
          personalNotes: personalNotes.trim() || undefined,
        });
      } else {
        // Create new brew
        await onSave({
          coffeeId,
          coffeeName: selectedCoffee.name,
          roaster: selectedCoffee.roaster,
          brewMethod,
          grindSetting,
          dosage: parseFloat(dosage),
          brewTime: finalBrewTime,
          finalWeight: finalBrewWeight,
          quality: quality > 0 ? quality : undefined,
          waterTemp: waterTemp ? parseFloat(waterTemp) : undefined,
          coffeeTemperature,
          brewerId: brewerId || undefined,
          brewerName: brewer?.name || undefined,
          grinderId: grinderId || undefined,
          grinderName: grinder?.name || undefined,
          userId,
          userName: selectedUser.name || selectedUser.email,
          stages: supportsStages(brewMethod) ? stages.filter(stage => stage.endTime && stage.endWeight).map(stage => ({
            endTime: parseFloat(stage.endTime),
            endWeight: parseFloat(stage.endWeight),
          })) : undefined,
          tastingNotes: tastingNotesPills.join(', '),
          personalNotes: personalNotes.trim() || undefined,
        });
      }
    } catch (error) {
      console.error('Error saving brew:', error);
      toast.error('Failed to save brew. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper functions to get baseline brew (matches across all bags of the same bean)
  const getMatchingBrews = () => {
    return brews
      .filter(e => sameCoffeeBagIds.has(e.coffeeId) && e.brewMethod === brewMethod)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getMostRecentBrew = () => {
    const matching = getMatchingBrews();
    return matching.length > 0 ? matching[0] : null;
  };

  const getBestBrew = () => {
    const matching = getMatchingBrews();
    if (matching.length === 0) return null;
    
    // Find highest quality rating
    const maxQuality = Math.max(...matching.map(e => e.quality || 0));
    
    // If no rated brews, return most recent
    if (maxQuality === 0) return matching[0];
    
    // Get all brews with max quality and return most recent
    const bestBrews = matching.filter(e => (e.quality || 0) === maxQuality);
    return bestBrews[0];
  };

  const getBaselineBrew = () => {
    if (baselineMode === 'most-recent') {
      return getMostRecentBrew();
    } else if (baselineMode === 'best') {
      return getBestBrew();
    } else {
      // browse-all mode
      const matching = getMatchingBrews();
      return matching.length > 0 ? matching[browseAllIndex] : null;
    }
  };

  const applyBaselineBrew = (brew: Brew | null) => {
    if (!brew) return;
    
    setCoffeeTemperature(brew.coffeeTemperature);
    setGrindSetting(brew.grindSetting);
    setDosage(brew.dosage.toString());
    setWaterTemp(brew.waterTemp ? brew.waterTemp.toString() : '');
    if (brew.brewerId) setBrewerId(brew.brewerId);
    if (brew.grinderId) setGrinderId(brew.grinderId);
    setPreFilledBrew(brew);
    
    // Collapse AI suggestions when baseline changes
    // Only clear suggestions if it's a different brew
    if (lastSuggestionBrewIdRef.current !== brew.id) {
      setIsSuggestionsOpen(false);
    }
  };

  const handleBaselineModeChange = (mode: 'most-recent' | 'best' | 'browse-all') => {
    setBaselineMode(mode);
    // useEffect will handle opening/closing dial-in guidance based on mode
    
    if (mode === 'browse-all') {
      setBrowseAllIndex(0);
      const matching = getMatchingBrews();
      if (matching.length > 0) {
        applyBaselineBrew(matching[0]);
      }
    } else {
      const brew = mode === 'most-recent' ? getMostRecentBrew() : getBestBrew();
      applyBaselineBrew(brew);
    }
  };

  const handleBrowseNavigation = (direction: 'prev' | 'next') => {
    const matching = getMatchingBrews();
    const newIndex = direction === 'prev' ? browseAllIndex - 1 : browseAllIndex + 1;
    
    if (newIndex >= 0 && newIndex < matching.length) {
      setBrowseAllIndex(newIndex);
      applyBaselineBrew(matching[newIndex]);
    }
  };

  const handleUseBrew = (brew: Brew) => {
    setCoffeeTemperature(brew.coffeeTemperature);
    setGrindSetting(brew.grindSetting);
    setDosage(brew.dosage.toString());
    setWaterTemp(brew.waterTemp ? brew.waterTemp.toString() : '');
    if (brew.brewerId) setBrewerId(brew.brewerId);
    if (brew.grinderId) setGrinderId(brew.grinderId);
    setIsPreFilled(true);
    setIsPreFilledFromSelection(true);
    setPreFilledBrew(brew);
    setShowPreviousBrews(false);
  };

  const getQualityLabel = (q: number) => {
    if (q === 3) return 'Exceptional';
    if (q === 2) return 'Decent';
    if (q === 1) return 'Bad';
    return 'Not rated';
  };

  // Tasting notes handlers
  const handleTastingNotesKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tastingNotesInput.trim()) {
      e.preventDefault();
      addTastingNotesPill();
    }
  };

  const addTastingNotesPill = () => {
    const trimmedInput = tastingNotesInput.trim();
    if (trimmedInput && !tastingNotesPills.includes(trimmedInput)) {
      setTastingNotesPills([...tastingNotesPills, trimmedInput]);
      setTastingNotesInput('');
    }
  };

  const removeTastingNotesPill = (index: number) => {
    setTastingNotesPills(tastingNotesPills.filter((_, i) => i !== index));
  };

  const handleTastingNoteSuggestionClick = (suggestion: string) => {
    if (!tastingNotesPills.includes(suggestion)) {
      setTastingNotesPills([...tastingNotesPills, suggestion]);
    }
  };

  // Handle QR code from camera or upload
  const processQRImage = async (file: File) => {
    setIsScanning(true);
    try {
      const image = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            toast.error('Failed to process image');
            setIsScanning(false);
            return;
          }

          ctx.drawImage(image, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code && code.data) {
            const coffee = coffees.find(c => c.id === code.data);
            if (coffee) {
              const prevCoffee = coffees.find(c => c.id === coffeeId);
              const isBagSwitch = prevCoffee && prevCoffee.roaster === coffee.roaster && prevCoffee.name === coffee.name && prevCoffee.id !== coffee.id;
              setCoffeeId(code.data);
              if (isBagSwitch) {
                const roastInfo = coffee.roastDate ? ` (Roasted ${coffee.roastDate})` : '';
                toast.success(COPY.newBagScanned(coffee.roaster, coffee.name, roastInfo));
              } else {
                toast.success(`Coffee scanned: ${coffee.roaster} - ${coffee.name}`);
              }
            } else {
              toast.error('QR code does not match any coffee');
            }
          } else {
            toast.error('No QR code found in image');
          }
          setIsScanning(false);
        };
        image.src = e.target?.result as string;
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing QR code:', error);
      toast.error('Failed to scan label');
      setIsScanning(false);
    }
  };

  const handleCameraCapture = () => {
    setShowQRScanner(true);
    setIsScanning(true);
  };

  // Start QR camera
  const startQRCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: isPhone ? 'environment' : 'user' // Use rear camera on phones, front camera on tablets/desktop
        },
        audio: false
      });
      setQrCameraStream(stream);
      console.log('Camera stream started successfully');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Failed to access camera. Please check your camera permissions.');
      setShowQRScanner(false);
      setIsScanning(false);
    }
  };

  const startQRScanning = () => {
    // Clear any existing interval first
    if (qrScanIntervalRef.current) {
      clearInterval(qrScanIntervalRef.current);
      qrScanIntervalRef.current = null;
    }

    console.log('Starting QR scanning interval...');
    qrScanIntervalRef.current = window.setInterval(() => {
      if (qrVideoRef.current && qrCanvasRef.current) {
        const video = qrVideoRef.current;
        const canvas = qrCanvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code && code.data) {
            console.log('QR code detected:', code.data);
            const coffee = coffees.find(c => c.id === code.data);
            if (coffee) {
              const prevCoffee = coffees.find(c => c.id === coffeeId);
              const isBagSwitch = prevCoffee && prevCoffee.roaster === coffee.roaster && prevCoffee.name === coffee.name && prevCoffee.id !== coffee.id;
              setCoffeeId(code.data);
              if (isBagSwitch) {
                const roastInfo = coffee.roastDate ? ` (Roasted ${coffee.roastDate})` : '';
                toast.success(COPY.newBagScanned(coffee.roaster, coffee.name, roastInfo));
              } else {
                toast.success(`Coffee scanned: ${coffee.roaster} - ${coffee.name}`);
              }
              closeQRScanner();
            } else {
              console.log('QR code does not match any coffee:', code.data);
            }
          }
        }
      }
    }, 300); // Scan every 300ms
  };

  const closeQRScanner = () => {
    // Stop scanning interval
    if (qrScanIntervalRef.current) {
      clearInterval(qrScanIntervalRef.current);
      qrScanIntervalRef.current = null;
    }

    // Stop camera stream
    if (qrCameraStream) {
      qrCameraStream.getTracks().forEach(track => track.stop());
      setQrCameraStream(null);
    }

    setShowQRScanner(false);
    setIsScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop scanning interval
      if (qrScanIntervalRef.current) {
        clearInterval(qrScanIntervalRef.current);
        qrScanIntervalRef.current = null;
      }
    };
  }, []);

  // Start camera when QR scanner modal opens and cleanup when it closes
  useEffect(() => {
    if (showQRScanner) {
      startQRCamera();
    }
    return () => {
      if (qrCameraStream) {
        qrCameraStream.getTracks().forEach(track => track.stop());
        setQrCameraStream(null);
      }
    };
  }, [showQRScanner]);

  // Attach stream to video element and start scanning
  useEffect(() => {
    if (qrCameraStream && showQRScanner) {
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = qrCameraStream;
        qrVideoRef.current.play().then(() => {
          console.log('Video playback started');
          startQRScanning();
        }).catch((error) => {
          console.error('Error playing video:', error);
        });
      }
    }
    
    // Cleanup: stop scanning when stream changes or scanner closes
    return () => {
      if (qrScanIntervalRef.current) {
        clearInterval(qrScanIntervalRef.current);
        qrScanIntervalRef.current = null;
      }
    };
  }, [qrCameraStream, showQRScanner]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processQRImage(file);
  };

  if (hidden) return null;

  return (
    <>
      {/* Brewing Popover - Show when La Marzocco is actively brewing */}
      {!isEditMode && (DEV_SHOW_BREWING || machineStatus?.state.toUpperCase() === 'BREWING') && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" style={{ zIndex: 50 }}>
          <Card className="w-full max-w-xs">
            <div className="p-6 flex flex-col items-center" style={{ gap: '1em' }}>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-900" style={{ animationDuration: '1s' }} />
                <h2 className="text-lg font-semibold">Brewing</h2>
              </div>
              {selectedCoffee && (
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{selectedCoffee.roaster}</p>
                  <p className="text-sm font-medium text-gray-900" style={{ marginTop: '0.125em' }}>{selectedCoffee.name}</p>
                </div>
              )}
              <Button variant="outline" onClick={onClose} className="cursor-pointer w-full">
                Stop Brew
              </Button>
            </div>
          </Card>
        </div>
      )}

      {!showQRScanner && !showPreviousBrews && !((DEV_SHOW_BREWING || machineStatus?.state.toUpperCase() === 'BREWING') && !isEditMode) && (
      <StandardDialog
        open={true}
        onOpenChange={(open) => !open && onClose()}
        title={isEditMode ? 'Edit Brew Details' : 'New Brew'}
        footerContent={
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="cursor-pointer" disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving} className="flex-1 cursor-pointer">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isEditMode ? 'Saving...' : 'Adding...'}
                </>
              ) : (
                isEditMode ? 'Save Changes' : 'Save Brew'
              )}
            </Button>
          </div>
        }
      >
        <div>
          <div className="space-y-4">
            {users.filter(user => user.name || user.email).length > 1 && (
              <div>
                <Label htmlFor="user">Made By</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(user => user.name || user.email).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="coffee">Beans</Label>
              <div className="flex gap-[calc(var(--spacing)*2.5)] mt-2">
                <AutocompleteDropdown
                  value={coffeeId}
                  onChange={setCoffeeId}
                  options={(() => {
                    // Deduplicate by bean (roaster + name), picking the most recently brewed bag per coffee
                    const { coffeeLastBrewed } = getCoffeesForDropdown();
                    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                    const groups = new Map<string, typeof coffees>();
                    coffees.forEach(coffee => {
                      const key = `${coffee.roaster}\0${coffee.name}`;
                      const group = groups.get(key);
                      if (group) {
                        group.push(coffee);
                      } else {
                        groups.set(key, [coffee]);
                      }
                    });

                    return Array.from(groups.values()).map(bags => {
                      // Pick the most recently brewed bag, or most recently created if none brewed
                      const representative = bags
                        .slice()
                        .sort((a, b) => {
                          const aBrewDate = coffeeLastBrewed.get(a.id);
                          const bBrewDate = coffeeLastBrewed.get(b.id);
                          if (aBrewDate && bBrewDate) return bBrewDate.getTime() - aBrewDate.getTime();
                          if (aBrewDate) return -1;
                          if (bBrewDate) return 1;
                          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        })[0];

                      let formattedDate = 'Unknown';
                      if (representative.roastDate) {
                        const [year, monthNum, day] = representative.roastDate.split('-').map(Number);
                        const date = new Date(year, monthNum - 1, day);
                        formattedDate = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
                      }

                      return {
                        value: representative.id,
                        line1: `${representative.roaster} - ${representative.name}`,
                        line2: `Roasted: ${formattedDate}`,
                      };
                    });
                  })()}
                  defaultOptions={(() => {
                    const { recentlyUsed, recentlyAdded, coffeeLastBrewed } = getCoffeesForDropdown();
                    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                    const formatDate = (d: Date) => `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                    const result: { value: string; line1: string; line2?: string; isSectionHeader?: boolean }[] = [];

                    if (recentlyUsed.length > 0) {
                      result.push({ value: '_header_used', line1: 'Recently used beans', isSectionHeader: true });
                      recentlyUsed.forEach(coffee => {
                        const lastBrew = coffeeLastBrewed.get(coffee.id);
                        result.push({
                          value: coffee.id,
                          line1: `${coffee.roaster} - ${coffee.name}`,
                          line2: lastBrew ? `Last brewed: ${formatDate(lastBrew)}` : undefined,
                        });
                      });
                    }

                    if (recentlyAdded.length > 0) {
                      if (recentlyUsed.length > 0) {
                        result.push({ value: '_divider', line1: '', isSectionHeader: true });
                      }
                      result.push({ value: '_header_added', line1: 'Recently added beans', isSectionHeader: true });
                      recentlyAdded.forEach(coffee => {
                        const [year, monthNum, day] = coffee.roastDate.split('-').map(Number);
                        result.push({
                          value: coffee.id,
                          line1: `${coffee.roaster} - ${coffee.name}`,
                          line2: `Roasted: ${formatDate(new Date(year, monthNum - 1, day))}`,
                        });
                      });
                    }

                    return result;
                  })()}
                  placeholder="Search beans"
                  className="flex-1"
                  getDropdownLabel={(searchQuery) => getDropdownLabel(searchQuery)}
                  getDisplayValue={(id) => {
                    const coffee = coffees.find(c => c.id === id);
                    return coffee ? `${coffee.roaster} - ${coffee.name}` : '';
                  }}
                />
                <DropdownMenu open={bagDropdownOpen} onOpenChange={setBagDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer flex-shrink-0 self-center h-9 px-2"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      disabled={isScanning}
                      onSelect={handleCameraCapture}
                    >
                      {isScanning ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Scanning...</>
                      ) : (
                        <><QrCode className="w-4 h-4" />Scan Label</>
                      )}
                    </DropdownMenuItem>
                    {coffeeId && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel inset className="text-xs text-muted-foreground font-normal">
                          {COPY.changeBag}
                        </DropdownMenuLabel>
                        {activeBags.map(bag => {
                          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          const isSelected = bag.id === coffeeId;
                          let label = '';
                          if (bag.roastDate) {
                            const [y, m, d] = bag.roastDate.split('-').map(Number);
                            const date = new Date(y, m - 1, d);
                            label = `Roasted ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
                          } else {
                            const date = new Date(bag.createdAt);
                            label = `Added ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
                          }
                          return (
                            <DropdownMenuItem
                              key={bag.id}
                              inset
                              disabled={isSelected}
                              className={`${isSelected ? 'opacity-100 text-muted-foreground' : 'cursor-pointer'}`}
                              onSelect={() => {
                                const oldBagId = coffeeId;
                                setCoffeeId(bag.id);
                                if (onMarkCoffeeFinished && oldBagId) {
                                  const oldBag = coffees.find(c => c.id === oldBagId);
                                  if (oldBag && !oldBag.finished) {
                                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                    let oldLabel = '';
                                    if (oldBag.roastDate) {
                                      const [oy, om, od] = oldBag.roastDate.split('-').map(Number);
                                      const d = new Date(oy, om - 1, od);
                                      oldLabel = `Roasted ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                                    } else {
                                      const d = new Date(oldBag.createdAt);
                                      oldLabel = `Added ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                                    }
                                    setFinishBagPrompt({ oldBagId, oldBagLabel: oldLabel });
                                  }
                                }
                              }}
                            >
                              {isSelected && <Check className="w-4 h-4 flex-shrink-0 absolute left-2" />}
                              {label}
                            </DropdownMenuItem>
                          );
                        })}
                        {onAddAnotherBag && selectedCoffee && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onSelect={() => {
                                pendingBagSelectRef.current = true;
                                onAddAnotherBag(selectedCoffee);
                              }}
                            >
                              <Plus className="w-4 h-4" />
                              {COPY.addNewBag}
                            </DropdownMenuItem>
                          </>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {coffeeId && activeBags.length > 0 && activeBags[0].id !== coffeeId && !brews.some(b => b.coffeeId === activeBags[0].id) && (() => {
                const newerBag = activeBags[0];
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const currentYear = new Date().getFullYear();
                let roastLabel = '';
                if (newerBag.roastDate) {
                  const [y, m, d] = newerBag.roastDate.split('-').map(Number);
                  const date = new Date(y, m - 1, d);
                  roastLabel = `roasted ${months[date.getMonth()]} ${date.getDate()}${date.getFullYear() !== currentYear ? `, ${date.getFullYear()}` : ''}`;
                }
                return (
                  <p className="text-xs text-gray-500" style={{ marginTop: '4px' }}>
                    {COPY.newBagAvailable}{roastLabel ? ` ${roastLabel}` : ' available'}{' · '}
                    <button
                      type="button"
                      className="font-medium text-gray-700 underline underline-offset-2 cursor-pointer hover:text-gray-900 transition-colors"
                      onClick={() => setBagDropdownOpen(true)}
                    >
                      Use
                    </button>
                  </p>
                );
              })()}
              <AlertDialog open={!!finishBagPrompt} onOpenChange={(open) => !open && setFinishBagPrompt(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{COPY.didYouFinishPreviousBag}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {COPY.markBagsFinishedFromPage}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">Keep Active</AlertDialogCancel>
                    <AlertDialogAction
                      className="cursor-pointer"
                      onClick={() => {
                        if (finishBagPrompt && onMarkCoffeeFinished) {
                          onMarkCoffeeFinished(finishBagPrompt.oldBagId);
                        }
                        setFinishBagPrompt(null);
                      }}
                    >
                      Mark Finished
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div>
              <Label htmlFor="brewMethod">Brew Method</Label>
              <Select value={brewMethod} onValueChange={(value: BrewMethod) => setBrewMethod(value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a brew method" />
                </SelectTrigger>
                <SelectContent>
                  {getAllBrewMethodConfigs().map(method => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const activeBrewers = brewMethod ? equipment.filter(
                e => e.type === 'brewer' && e.method === brewMethod && e.active
              ) : [];
              const activeGrinders = brewMethod ? equipment.filter(
                e => e.type === 'grinder' && e.active && (
                  // Support both methods array (new) and single method (legacy)
                  (e.methods && e.methods.includes(brewMethod)) || e.method === brewMethod
                )
              ) : [];

              // In edit mode, include previously saved equipment even if no longer active
              let availableBrewers = isEditMode && brewerId && brewMethod
                ? [...activeBrewers, ...equipment.filter(e => 
                    e.id === brewerId && 
                    e.type === 'brewer' && 
                    e.method === brewMethod &&
                    !activeBrewers.some(b => b.id === e.id)
                  )]
                : activeBrewers;

              let availableGrinders = isEditMode && grinderId && brewMethod
                ? [...activeGrinders, ...equipment.filter(e => 
                    e.id === grinderId && 
                    e.type === 'grinder' && 
                    ((e.methods && e.methods.includes(brewMethod)) || e.method === brewMethod) &&
                    !activeGrinders.some(g => g.id === e.id)
                  )]
                : activeGrinders;

              // If in edit mode and the saved equipment was deleted (not in equipment array at all),
              // manually add it to the available options using the saved name
              if (isEditMode && editingBrew && brewMethod) {
                if (editingBrew.brewerId && !availableBrewers.some(b => b.id === editingBrew.brewerId)) {
                  availableBrewers = [...availableBrewers, {
                    id: editingBrew.brewerId,
                    name: editingBrew.brewerName || 'Unknown Brewer',
                    type: 'brewer' as const,
                    method: brewMethod,
                    active: false,
                    primary: false,
                    userId: '',
                    createdAt: '',
                  }];
                }
                if (editingBrew.grinderId && !availableGrinders.some(g => g.id === editingBrew.grinderId)) {
                  availableGrinders = [...availableGrinders, {
                    id: editingBrew.grinderId,
                    name: editingBrew.grinderName || 'Unknown Grinder',
                    type: 'grinder' as const,
                    method: brewMethod,
                    active: false,
                    primary: false,
                    userId: '',
                    createdAt: '',
                  }];
                }
              }

              return (
                <div>
                  <Label>Brewing Equipment</Label>
                  <div className="mt-2">
                    {/* Brewer Selection */}
                    <div className="flex items-center gap-1 min-h-[24px]">
                      <span className="text-sm">Brewer:</span>
                      {!brewMethod ? (
                        <span className="text-sm text-gray-500">Select brew method first</span>
                      ) : isEditMode && (editingBrew?.brewerName || brewerId) ? (
                        !showBrewerDropdown ? (
                          <>
                            <span className="text-sm">
                              {brewerId 
                                ? (availableBrewers.find(b => b.id === brewerId) ? formatEquipmentName(availableBrewers.find(b => b.id === brewerId)!) : editingBrew?.brewerName)
                                : editingBrew?.brewerName}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowBrewerDropdown(true)}
                              className="text-xs text-blue-600 hover:text-blue-700 underline cursor-pointer ml-1 self-center"
                            >
                              Change
                            </button>
                          </>
                        ) : (
                          <Select 
                            value={brewerId || editingBrew?.brewerId || ''} 
                            onValueChange={(value) => {
                              setBrewerId(value);
                              setShowBrewerDropdown(false);
                            }}
                            open={showBrewerDropdown}
                            onOpenChange={setShowBrewerDropdown}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select brewer" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableBrewers.map((brewer) => (
                                <SelectItem key={brewer.id} value={brewer.id}>
                                  {brewer.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      ) : isEditMode && !editingBrew?.brewerName && !brewerId ? (
                        !showBrewerDropdown ? (
                          <>
                            <span className="text-sm text-gray-500">None selected</span>
                            <button
                              type="button"
                              onClick={() => setShowBrewerDropdown(true)}
                              className="text-xs text-blue-600 hover:text-blue-700 underline cursor-pointer ml-1 self-center"
                            >
                              Select
                            </button>
                          </>
                        ) : (
                          <Select 
                            value={brewerId || ''} 
                            onValueChange={(value) => {
                              setBrewerId(value);
                              setShowBrewerDropdown(false);
                            }}
                            open={showBrewerDropdown}
                            onOpenChange={setShowBrewerDropdown}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select brewer" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableBrewers.map((brewer) => (
                                <SelectItem key={brewer.id} value={brewer.id}>
                                  {brewer.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      ) : !isEditMode && equipmentLoading ? (
                        <span className="text-sm text-gray-500">Loading...</span>
                      ) : !isEditMode && availableBrewers.length === 0 ? (
                        <span className="text-sm text-gray-500">No active brewers for {brewMethod}</span>
                      ) : availableBrewers.length === 1 ? (
                        <>
                          <span className="text-sm">{availableBrewers[0].name}</span>
                          {!isEditMode && isEspresso && shouldShowLaMarzoccoStatus() && (
                            <>
                              {machineStatus ? (
                                <Badge variant="outline" className="gap-1.5 h-6 font-normal" style={{ marginLeft: 'calc(var(--spacing) * 1)' }}>
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                    machineStatus.state.toUpperCase() === 'BREWING' ? 'bg-green-500 animate-brewing-pulse' :
                                    machineStatus.state.toUpperCase() === 'POWERED_ON' || machineStatus.state.toUpperCase() === 'POWEREDON' ? 'bg-green-500' :
                                    machineStatus.state.toUpperCase() === 'STANDBY' ? 'bg-amber-500' :
                                    'bg-red-500'
                                  }`}></span>
                                  <span>
                                    {machineStatus.state.toUpperCase() === 'BREWING' ? 'Brewing' :
                                     machineStatus.state.toUpperCase() === 'POWERED_ON' || machineStatus.state.toUpperCase() === 'POWEREDON' ? 'Ready' :
                                     machineStatus.state.toUpperCase() === 'STANDBY' ? 'Standby' :
                                     'Off'}
                                  </span>
                                </Badge>
                              ) : machineError ? (
                                <span className="text-xs text-red-600" style={{ marginLeft: 'calc(var(--spacing) * 1)' }}>{machineError}</span>
                              ) : (
                                <Badge variant="outline" className="gap-1.5 h-6 font-normal text-gray-400" style={{ marginLeft: 'calc(var(--spacing) * 1)' }}>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Connecting</span>
                                </Badge>
                              )}
                            </>
                          )}
                        </>
                      ) : !showBrewerDropdown ? (
                        <>
                          <span className="text-sm">{brewerId ? (availableBrewers.find(b => b.id === brewerId) ? formatEquipmentName(availableBrewers.find(b => b.id === brewerId)!) : 'Select brewer') : (availableBrewers.find(b => b.primary) ? formatEquipmentName(availableBrewers.find(b => b.primary)!) : 'Select brewer')}</span>
                          {!isEditMode && isEspresso && shouldShowLaMarzoccoStatus() && (
                            <>
                              {machineStatus ? (
                                <Badge variant="outline" className="gap-1.5 h-6 font-normal" style={{ marginLeft: 'calc(var(--spacing) * 1)' }}>
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                    machineStatus.state.toUpperCase() === 'BREWING' ? 'bg-green-500 animate-brewing-pulse' :
                                    machineStatus.state.toUpperCase() === 'POWERED_ON' || machineStatus.state.toUpperCase() === 'POWEREDON' ? 'bg-green-500' :
                                    machineStatus.state.toUpperCase() === 'STANDBY' ? 'bg-amber-500' :
                                    'bg-red-500'
                                  }`}></span>
                                  <span>
                                    {machineStatus.state.toUpperCase() === 'BREWING' ? 'Brewing' :
                                     machineStatus.state.toUpperCase() === 'POWERED_ON' || machineStatus.state.toUpperCase() === 'POWEREDON' ? 'Ready' :
                                     machineStatus.state.toUpperCase() === 'STANDBY' ? 'Standby' :
                                     'Off'}
                                  </span>
                                </Badge>
                              ) : machineError ? (
                                <span className="text-xs text-red-600" style={{ marginLeft: 'calc(var(--spacing) * 1)' }}>{machineError}</span>
                              ) : (
                                <Badge variant="outline" className="gap-1.5 h-6 font-normal text-gray-400" style={{ marginLeft: 'calc(var(--spacing) * 1)' }}>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Connecting</span>
                                </Badge>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowBrewerDropdown(true)}
                            className="text-xs text-blue-600 hover:text-blue-700 underline cursor-pointer ml-1 self-center"
                          >
                            Change
                          </button>
                        </>
                      ) : (
                        <Select 
                          value={brewerId} 
                          onValueChange={(value) => {
                            setBrewerId(value);
                            setShowBrewerDropdown(false);
                          }}
                          open={showBrewerDropdown}
                          onOpenChange={setShowBrewerDropdown}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select brewer" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableBrewers.map((brewer) => (
                              <SelectItem key={brewer.id} value={brewer.id}>
                                {formatEquipmentName(brewer)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Grinder Selection */}
                    <div className="flex items-center gap-1 mt-1 min-h-[24px]">
                      <span className="text-sm">Grinder:</span>
                      {!brewMethod ? (
                        <span className="text-sm text-gray-500">Select brew method first</span>
                      ) : isEditMode && (editingBrew?.grinderName || grinderId) ? (
                        !showGrinderDropdown ? (
                          <>
                            <span className="text-sm">
                              {grinderId 
                                ? (availableGrinders.find(g => g.id === grinderId) ? formatEquipmentName(availableGrinders.find(g => g.id === grinderId)!) : editingBrew?.grinderName)
                                : editingBrew?.grinderName}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowGrinderDropdown(true)}
                              className="text-xs text-blue-600 hover:text-blue-700 underline cursor-pointer ml-1 self-center"
                            >
                              Change
                            </button>
                          </>
                        ) : (
                          <Select 
                            value={grinderId || editingBrew?.grinderId || ''} 
                            onValueChange={(value) => {
                              setGrinderId(value);
                              setShowGrinderDropdown(false);
                            }}
                            open={showGrinderDropdown}
                            onOpenChange={setShowGrinderDropdown}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select grinder" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableGrinders.map((grinder) => (
                                <SelectItem key={grinder.id} value={grinder.id}>
                                  {formatEquipmentName(grinder)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      ) : isEditMode && !editingBrew?.grinderName && !grinderId ? (
                        !showGrinderDropdown ? (
                          <>
                            <span className="text-sm text-gray-500">None selected</span>
                            <button
                              type="button"
                              onClick={() => setShowGrinderDropdown(true)}
                              className="text-xs text-blue-600 hover:text-blue-700 underline cursor-pointer ml-1 self-center"
                            >
                              Select
                            </button>
                          </>
                        ) : (
                          <Select 
                            value={grinderId || ''} 
                            onValueChange={(value) => {
                              setGrinderId(value);
                              setShowGrinderDropdown(false);
                            }}
                            open={showGrinderDropdown}
                            onOpenChange={setShowGrinderDropdown}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select grinder" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableGrinders.map((grinder) => (
                                <SelectItem key={grinder.id} value={grinder.id}>
                                  {formatEquipmentName(grinder)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      ) : !isEditMode && equipmentLoading ? (
                        <span className="text-sm text-gray-500">Loading...</span>
                      ) : !isEditMode && availableGrinders.length === 0 ? (
                        <span className="text-sm text-gray-500">No active grinders for {brewMethod}</span>
                      ) : availableGrinders.length === 1 ? (
                        <span className="text-sm">{formatEquipmentName(availableGrinders[0])}</span>
                      ) : !showGrinderDropdown ? (
                        <>
                          <span className="text-sm">{grinderId ? (availableGrinders.find(g => g.id === grinderId) ? formatEquipmentName(availableGrinders.find(g => g.id === grinderId)!) : 'Select grinder') : (availableGrinders.find(g => g.primary) ? formatEquipmentName(availableGrinders.find(g => g.primary)!) : 'Select grinder')}</span>
                          <button
                            type="button"
                            onClick={() => setShowGrinderDropdown(true)}
                            className="text-xs text-blue-600 hover:text-blue-700 underline cursor-pointer ml-1 self-center"
                          >
                            Change
                          </button>
                        </>
                      ) : (
                        <Select 
                          value={grinderId} 
                          onValueChange={(value) => {
                            setGrinderId(value);
                            setShowGrinderDropdown(false);
                          }}
                          open={showGrinderDropdown}
                          onOpenChange={setShowGrinderDropdown}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select grinder" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableGrinders.map((grinder) => (
                              <SelectItem key={grinder.id} value={grinder.id}>
                                {formatEquipmentName(grinder)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {!editingBrew && (() => {
              const hasBrews = coffeeId && brewMethod && brews.some(
                e => sameCoffeeBagIds.has(e.coffeeId) && e.brewMethod === brewMethod
              );
              
              const canExpand = coffeeId && brewMethod;
              
              return (
                <Collapsible open={canExpand && isPrefilledOpen} onOpenChange={(open) => {
                  if (canExpand) {
                    setIsPrefilledOpen(open);
                  }
                }}>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #B6D3F2' }}>
                    <CollapsibleTrigger className="w-full" disabled={!canExpand}>
                      <div className={`flex items-center gap-2 px-3 py-2.5 ${canExpand ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`} style={{ backgroundColor: '#E8F1FB' }}>
                        <span className="flex-shrink-0 leading-none">📌</span>
                        <p className="text-sm text-gray-900 font-medium flex-1 text-left">
                          Baseline Brew{' '}
                          <span className="text-gray-600 font-normal">
                            {baselineMode === 'most-recent' ? '(Most Recent)' : 
                             baselineMode === 'best' ? '(Best)' : 
                             '(Manually Selected)'}
                          </span>
                        </p>
                        <ChevronDown 
                          className={`w-4 h-4 text-gray-900 transition-transform ${canExpand && isPrefilledOpen ? 'transform rotate-180' : ''}`}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pt-3 pb-2.5" style={{ borderTop: '1px solid #B6D3F2' }}>
                        {!hasBrews ? (
                          <p className="text-sm text-gray-600">
                            No previous brews with this coffee and method
                          </p>
                        ) : (
                          <>
                            {/* Baseline Mode Pills */}
                            <div className="flex flex-wrap gap-1.5 mb-4">
                          <button
                            type="button"
                            onClick={() => handleBaselineModeChange('most-recent')}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm border transition-colors cursor-pointer ${
                              baselineMode === 'most-recent'
                                ? 'bg-blue-100 border-blue-500 text-blue-700'
                                : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                            }`}
                          >
                            Most Recent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBaselineModeChange('best')}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm border transition-colors cursor-pointer ${
                              baselineMode === 'best'
                                ? 'bg-blue-100 border-blue-500 text-blue-700'
                                : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                            }`}
                          >
                            Best
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBaselineModeChange('browse-all')}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm border transition-colors cursor-pointer ${
                              baselineMode === 'browse-all'
                                ? 'bg-blue-100 border-blue-500 text-blue-700'
                                : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                            }`}
                          >
                            Browse All
                          </button>
                        </div>

                        {/* Browse All Navigation */}
                        {baselineMode === 'browse-all' && (() => {
                          const matching = getMatchingBrews();
                          const total = matching.length;
                          const current = browseAllIndex + 1;
                          
                          return (
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                              <button
                                type="button"
                                onClick={() => handleBrowseNavigation('prev')}
                                disabled={browseAllIndex === 0}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  browseAllIndex === 0
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <span className="text-xs text-gray-600">
                                Brew {current} of {total}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleBrowseNavigation('next')}
                                disabled={browseAllIndex >= total - 1}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  browseAllIndex >= total - 1
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })()}

                        {preFilledBrew && (
                          <div className="mt-3 space-y-4">
                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                              <div className="flex items-start gap-2">
                                <Calendar className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">Date & Time</p>
                                  <p className="text-xs text-gray-900">
                                    {new Date(preFilledBrew.createdAt).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    })} at {new Date(preFilledBrew.createdAt).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-start gap-2">
                                <Thermometer className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">Bean Temp</p>
                                  <p className="text-xs text-gray-900">
                                    {preFilledBrew.coffeeTemperature === 'frozen' ? 'Frozen' : 'Room Temp'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-start gap-2">
                                <BrewEquipmentIcon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">Brewer</p>
                                  <p className="text-xs text-gray-900">{preFilledBrew.brewerName || 'N/A'}</p>
                                </div>
                              </div>

                              <div className="flex items-start gap-2">
                                <GrinderIcon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">Grinder</p>
                                  <p className="text-xs text-gray-900">{preFilledBrew.grinderName || 'N/A'}</p>
                                </div>
                              </div>
                            </div>

                            {/* Parameters Section */}
                            <div className="border-t border-gray-200 pt-3">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <div className="flex items-start gap-2">
                                  <Gauge className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-500 mb-0.5">Grind Setting</p>
                                    <p className="text-xs text-gray-900">{preFilledBrew.grindSetting || 'N/A'}</p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2">
                                  <Weight className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-500 mb-0.5">Dosage</p>
                                    <p className="text-xs text-gray-900">{preFilledBrew.dosage ? `${preFilledBrew.dosage}g` : 'N/A'}</p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2">
                                  <Droplet className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-500 mb-0.5">Water Temp</p>
                                    <p className="text-xs text-gray-900">{preFilledBrew.waterTemp ? `${preFilledBrew.waterTemp}°F` : 'N/A'}</p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2">
                                  <Clock className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-500 mb-0.5">{isImmersion ? 'Steep Time' : 'Extraction Time'}</p>
                                    <p className="text-xs text-gray-900">{preFilledBrew.brewTime ? formatTime(parseFloat(preFilledBrew.brewTime)) : 'N/A'}</p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2">
                                  <Scale className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-500 mb-0.5">Final Weight</p>
                                    <p className="text-xs text-gray-900">{preFilledBrew.finalWeight ? `${preFilledBrew.finalWeight}g` : 'N/A'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Brew Stages */}
                            {preFilledBrew.stages && preFilledBrew.stages.length > 0 && (
                              <div className="border-t border-gray-200 pt-3">
                                <p className="text-xs text-gray-500 mb-2">Brew Stages</p>
                                <div className="space-y-1">
                                  {/* Table Header */}
                                  <div className="grid grid-cols-3 gap-3 pb-1 border-b border-gray-200">
                                    <div className="text-xs text-gray-500">Stage</div>
                                    <div className="text-xs text-gray-500">Time</div>
                                    <div className="text-xs text-gray-500 text-right">Weight</div>
                                  </div>
                                  {/* Table Rows */}
                                  {preFilledBrew.stages.map((stage, index) => {
                                    const startTime = index === 0 ? 0 : preFilledBrew.stages![index - 1].endTime;
                                    const endTime = stage.endTime;
                                    return (
                                      <div key={index} className="grid grid-cols-3 gap-3 py-1 border-b border-gray-100 last:border-0">
                                        <div className="text-xs text-gray-900">Stage {index + 1}</div>
                                        <div className="text-xs text-gray-900">
                                          {formatTime(startTime)}-{formatTime(endTime)}
                                        </div>
                                        <div className="text-xs text-gray-900 text-right">{stage.endWeight}g</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Quality & Notes */}
                            <div className="border-t border-gray-200 pt-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Quality:</span>
                                {preFilledBrew.quality ? (
                                  <>
                                    <span className="text-base">{getRatingEmoji(preFilledBrew.quality)}</span>
                                    <span className="text-xs text-gray-900">
                                      {getRatingText(preFilledBrew.quality)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-900">Not rated</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="text-xs text-gray-500">Tasting Notes:</span>
                                {preFilledBrew.tastingNotes ? (
                                  preFilledBrew.tastingNotes.split(',').map((note, idx) => (
                                    <span 
                                      key={idx}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 border border-gray-300"
                                    >
                                      {capitalize(note.trim())}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-900">No notes added</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                          </>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })()}

            {/* AI Suggestions */}
            {!editingBrew && (() => {
              const canExpand = coffeeId && brewMethod;
              
              return (
                <Collapsible open={canExpand && isSuggestionsOpen} onOpenChange={(open) => {
                  if (!canExpand) return;
                  
                  setIsSuggestionsOpen(open);
                  // If opening and we need to fetch, set loading state immediately
                  const currentBaselineBrew = getBaselineBrew();
                  const currentBrewId = currentBaselineBrew?.id || '';
                  if (open && !suggestions && 
                      (lastSuggestionBrewIdRef.current !== currentBrewId ||
                       lastSuggestionCoffeeIdRef.current !== coffeeId || 
                       lastSuggestionBrewerIdRef.current !== brewerId ||
                       lastSuggestionGrinderIdRef.current !== grinderId ||
                       lastSuggestionBrewMethodRef.current !== brewMethod)) {
                    setLoadingSuggestions(true);
                    setThinkingText('Analyzing');
                  }
                }}>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #FFD98A' }}>
                    <CollapsibleTrigger className="w-full" disabled={!canExpand}>
                      <div className={`flex items-center gap-2 px-3 py-2.5 ${canExpand ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`} style={{ backgroundColor: '#FFF2CC' }}>
                        <span className="flex-shrink-0 leading-none">🧭</span>
                        <p className="text-sm text-gray-900 font-medium flex-1 text-left">
                          Dial-In Guidance
                        </p>
                        <ChevronDown 
                          className={`w-4 h-4 text-gray-900 transition-transform ${canExpand && isSuggestionsOpen ? 'transform rotate-180' : ''}`}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pt-3 pb-2.5" style={{ borderTop: '1px solid #FFD98A' }}>
                        <div className="text-sm text-gray-900 space-y-2">
                          {loadingSuggestions ? (
                            <div className="flex items-start gap-2">
                              <Loader2 className="w-4 h-4 text-gray-700 animate-spin flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-gray-700">
                                {thinkingText || 'Analyzing'}
                              </p>
                            </div>
                          ) : suggestions ? (
                            <FormattedAISuggestions suggestions={suggestions} />
                          ) : (
                            <p className="text-sm text-gray-500 italic">Click to load AI suggestions...</p>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })()}

            <div>
              <Label>Bean Temperature</Label>
              <RadioGroup value={coffeeTemperature} onValueChange={(value: CoffeeTemperature) => setCoffeeTemperature(value)} className="mt-3">
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="room-temperature" id="room-temp" />
                    <Label htmlFor="room-temp" className="cursor-pointer font-normal">Room Temperature</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="frozen" id="frozen" />
                    <Label htmlFor="frozen" className="cursor-pointer font-normal">Frozen</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="grindSetting">Grind Setting</Label>
              <Input
                id="grindSetting"
                type="text"
                value={grindSetting}
                onChange={(e) => setGrindSetting(e.target.value)}
                placeholder="20"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="dosage">Dosage (g)</Label>
              <Input
                id="dosage"
                type="text"
                inputMode="decimal"
                step="0.1"
                value={dosage}
                onChange={(e) => setDosage(validateNumericInput(e.target.value))}
                placeholder="18"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="waterTemp">
                Water Temperature (°F)
              </Label>
              <Input
                id="waterTemp"
                type="text"
                inputMode="decimal"
                step="0.1"
                value={waterTemp}
                onChange={(e) => setWaterTemp(validateNumericInput(e.target.value))}
                placeholder="200"
                className="mt-2"
              />
            </div>

            {/* Immersion: Steep time and final weight */}
            {isImmersion && (
              <>
                <div>
                  <Label>Steep Time</Label>
                  <div className="mt-2">
                    <TimeInput
                      value={brewTime}
                      onChange={(value) => setExtractionTime(value)}
                      placeholder="4m 00s"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="finalWeight">Final Weight (g)</Label>
                  <Input
                    id="finalWeight"
                    type="text"
                    inputMode="decimal"
                    step="0.1"
                    value={finalWeight}
                    onChange={(e) => setFinalWeight(validateNumericInput(e.target.value))}
                    placeholder="350"
                    className="mt-2"
                  />
                </div>
              </>
            )}

            {/* Espresso: Single brew time and final weight */}
            {isEspresso && (
              <>
                <div>
                  <Label htmlFor="brewTime">Extraction Time (s)</Label>
                  <Input
                    id="brewTime"
                    type="text"
                    inputMode="decimal"
                    step="0.1"
                    value={brewTime}
                    onChange={(e) => setExtractionTime(validateNumericInput(e.target.value))}
                    placeholder="30"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="finalWeight">Final Weight (g)</Label>
                  <Input
                    id="finalWeight"
                    type="text"
                    inputMode="decimal"
                    step="0.1"
                    value={finalWeight}
                    onChange={(e) => setFinalWeight(validateNumericInput(e.target.value))}
                    placeholder="36"
                    className="mt-2"
                  />
                </div>
              </>
            )}

            {/* Pour Over: Multiple stages */}
            {supportsStages(brewMethod) && (
              <div ref={brewStagesRef}>
                <div className="flex items-center justify-between">
                  <Label>Brew Stages</Label>
                  {voiceSupported && (
                    <Button
                      type="button"
                      variant={voiceMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setVoiceMode(prev => !prev)}
                      className={`cursor-pointer gap-1.5 h-7 text-xs ${voiceMode ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      {voiceMode ? 'Stop' : 'Voice Mode'}
                    </Button>
                  )}
                </div>

                {voiceMode ? (
                  <div className="mt-2">
                    <VoiceStagesMode
                      stages={stages}
                      setStages={setStages}
                      onExit={() => setVoiceMode(false)}
                    />
                  </div>
                ) : (
                <div className="mt-2 space-y-3">
                  {stages.map((stage, index) => (
                    <div 
                      key={`stage-${index}`} 
                      ref={(el) => {
                        stageContainerRefs.current[index] = el;
                      }}
                      className="flex items-start gap-3"
                    >
                      <div className={`text-sm text-gray-700 whitespace-nowrap w-16 flex-shrink-0 ${index === 0 ? 'pt-8' : 'pt-2'}`}>
                        Stage {index + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          {index === 0 && (
                            <Label htmlFor={`stage-${index}-time`} className="text-sm text-gray-900 font-normal" style={{ marginBottom: 'calc(var(--spacing))' }}>
                              End Time
                            </Label>
                          )}
                          <TimeInput
                            value={stage.endTime}
                            onChange={(value) => {
                              setStages(prevStages => 
                                prevStages.map((s, i) => 
                                  i === index 
                                    ? { ...s, endTime: value }
                                    : s
                                )
                              );
                            }}
                            onComplete={() => {
                              // When end time is completed, focus on end weight
                              setTimeout(() => {
                                const weightInput = stageWeightRefs.current[index];
                                if (weightInput) {
                                  weightInput.focus();
                                } else {
                                  // Fallback: Query DOM directly if ref isn't set yet
                                  const input = document.getElementById(`stage-${index}-weight`) as HTMLInputElement;
                                  input?.focus();
                                }
                              }, 100);
                            }}
                            placeholder="0m 0s"
                          />
                        </div>
                        <div>
                          {index === 0 && (
                            <Label htmlFor={`stage-${index}-weight`} className="text-sm text-gray-900 font-normal whitespace-nowrap" style={{ marginBottom: 'calc(var(--spacing))' }}>
                              End Weight (g)
                            </Label>
                          )}
                          <Input
                            ref={(el) => {
                              stageWeightRefs.current[index] = el;
                            }}
                            id={`stage-${index}-weight`}
                            type="text"
                            inputMode="decimal"
                            step="0.1"
                            value={stage.endWeight}
                            onChange={(e) => {
                              const value = validateNumericInput(e.target.value);
                              setStages(prevStages => 
                                prevStages.map((s, i) => 
                                  i === index 
                                    ? { ...s, endWeight: value }
                                    : s
                                )
                              );
                              
                              // If text was entered and this is the last stage, create next stage (but don't auto-focus)
                              if (value && index === stages.length - 1) {
                                shouldFocusNewStage.current = false; // Don't auto-focus the new stage
                                setTimeout(() => {
                                  setStages(prev => [...prev, { endTime: '', endWeight: '' }]);
                                }, 0);
                              }
                            }}
                            placeholder="0"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      {index > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newStages = stages.filter((_, i) => i !== index);
                            setStages(newStages);
                          }}
                          tabIndex={-1}
                          className="cursor-pointer h-9 w-9 p-0 mt-0 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500" />
                        </Button>
                      ) : (
                        <div className="h-9 w-9 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStages([...stages, { endTime: '', endWeight: '' }])}
                    className="cursor-pointer h-9 font-normal w-full"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Stage</span>
                  </Button>
                </div>
                )}
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-4">
                You can come back later to provide the details below, but they are critical for accurate Dial-In Guidance.
              </p>
              <Label>
                Extraction Quality <span className="text-muted-foreground">(optional)</span>
              </Label>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      className={`text-3xl cursor-pointer transition-opacity ${
                        quality === rating
                          ? 'opacity-100'
                          : hoveredStar === rating
                          ? 'opacity-100'
                          : 'opacity-30 hover:opacity-60'
                      }`}
                      onClick={() => setQuality(rating)}
                      onMouseEnter={() => setHoveredStar(rating)}
                      onMouseLeave={() => setHoveredStar(0)}
                    >
                      {getRatingEmoji(rating)}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-card-foreground">{getRatingText(hoveredStar || quality)}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="tastingNotes">
                Extraction Notes <span className="text-muted-foreground">(optional)</span>
              </Label>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 px-3 py-1 min-h-[36px] border border-input rounded-md bg-input-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] transition-[color,box-shadow]">
                {tastingNotesPills.map((pill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full text-sm"
                  >
                    {pill}
                    <button
                      type="button"
                      onClick={() => removeTastingNotesPill(index)}
                      className="hover:bg-gray-200 rounded-full p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="tastingNotes"
                  value={tastingNotesInput}
                  onChange={(e) => setTastingNotesInput(e.target.value)}
                  onKeyDown={handleTastingNotesKeyPress}
                  onBlur={addTastingNotesPill}
                  placeholder={tastingNotesPills.length === 0 ? "Balanced, Sweet, Syrupy" : ""}
                  className="flex-1 min-w-[120px] outline-none bg-transparent placeholder:text-muted-foreground text-base md:text-sm"
                />
              </div>

              {quality > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-gray-600">Suggestions:</span>
                  {getTastingNoteSuggestions(quality).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleTastingNoteSuggestionClick(suggestion)}
                      className="text-sm px-2 py-0.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={tastingNotesPills.includes(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <Label htmlFor="personalNotes">
                Personal Notes <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="personalNotes"
                value={personalNotes}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 1000) {
                    setPersonalNotes(value);
                  }
                }}
                placeholder="Anything you want to remember…"
                className="mt-2 resize-y"
                style={{ minHeight: '40px', height: '72px' }}
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 mt-1">{personalNotes.length}/1000 characters</p>
            </div>
          </div>
        </div>
      </StandardDialog>
      )}

      {/* Previous Brews Dialog */}
      {showPreviousBrews && coffeeId && selectedCoffee && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" style={{ zIndex: 60 }}>
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg text-gray-900 font-semibold">Previous Brews</h2>
                  <p className="text-gray-600 mt-1">
                    {selectedCoffee.roaster} – {selectedCoffee.name} ({capitalizeBrewMethod(brewMethod)})
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowPreviousBrews(false)} className="cursor-pointer">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="p-6">

              {(() => {
                const previousBrews = brews
                  .filter(e => sameCoffeeBagIds.has(e.coffeeId) && e.brewMethod === brewMethod)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                if (previousBrews.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <Info className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p>No previous brews found for this coffee.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <p className="text-sm text-gray-600 mb-3 mobile-card-instruction">
                      Select a previous brew to pre-fill brew inputs
                    </p>
                    <table className="w-full border-collapse previous-brews-table">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Date</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Temperature</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Grind</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Dosage</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Rating</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Notes</th>
                          <th className="w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {previousBrews.map((brew, index) => {
                          const user = users.find(u => u.id === brew.userId);
                          return (
                            <tr
                              key={brew.id}
                              className="border-b hover:bg-gray-50 transition-colors mobile-clickable-card"
                              onClick={(e) => {
                                // Only trigger on mobile when clicking the card itself (not the button)
                                if (window.innerWidth <= 768 && !(e.target as HTMLElement).closest('button')) {
                                  handleUseBrew(brew);
                                }
                              }}
                            >
                              <td className="py-2 px-4 text-sm text-gray-900" data-label="Date:">
                                {(() => {
                                  const date = new Date(brew.createdAt);
                                  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                  const month = months[date.getMonth()];
                                  const day = date.getDate();
                                  const year = date.getFullYear();
                                  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                  return `${month} ${day}, ${year} at ${time}`;
                                })()}
                              </td>
                              <td className="py-2 px-4 text-sm text-gray-900" data-label="Temperature:">
                                {brew.coffeeTemperature === 'frozen' ? 'Frozen' : 'Room Temperature'}
                              </td>
                              <td className="py-2 px-4 text-sm text-gray-900" data-label="Grind:">
                                {brew.grindSetting}
                              </td>
                              <td className="py-2 px-4 text-sm text-gray-900" data-label="Dosage:">
                                {brew.dosage}g
                              </td>
                              <td className="py-2 px-4 text-sm" data-label="Rating:">
                                <div className="flex items-center gap-2">
                                  {brew.quality ? (
                                    <>
                                      <span className="text-xl">{getRatingEmoji(brew.quality)}</span>
                                      <span className="text-gray-900">{getRatingText(brew.quality)}</span>
                                    </>
                                  ) : (
                                    <span className="text-gray-900">Not rated</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-4 text-sm" data-label="Notes:">
                                {(() => {
                                  if (!brew.tastingNotes || brew.tastingNotes.trim() === '') {
                                    return <span className="text-gray-400">—</span>;
                                  }
                                  const notes = brew.tastingNotes.split(', ').filter(n => n.trim());
                                  if (notes.length === 0) {
                                    return <span className="text-gray-400">—</span>;
                                  }
                                  // Display first 2 notes, then show "+ n more" for the rest
                                  const visibleNotes = notes.slice(0, 2);
                                  const hiddenCount = notes.length - visibleNotes.length;
                                  return (
                                    <div className="flex flex-wrap items-center gap-1">
                                      {visibleNotes.map((note, index) => (
                                        <span
                                          key={index}
                                          className="inline-flex items-center bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full text-sm whitespace-nowrap"
                                        >
                                          {capitalize(note)}
                                        </span>
                                      ))}
                                      {hiddenCount > 0 && (
                                        <span className="text-gray-500 text-sm whitespace-nowrap ml-1">
                                          +{hiddenCount} more
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-2 px-4 text-sm mobile-hide-use-button">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUseBrew(brew)}
                                  className="cursor-pointer text-sm px-2 py-1 whitespace-nowrap"
                                >
                                  Use
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              <div className="mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPreviousBrews(false)} 
                  className="w-full cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && createPortal(
        <>
          {/* Desktop View */}
          {!isMobile && (
          <div className="fixed inset-0 bg-black/80 items-center justify-center flex" style={{ zIndex: 9999 }} onClick={closeQRScanner}>
            <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Scan Label</h3>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    onClick={closeQRScanner} 
                    className="cursor-pointer flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <video
                    ref={qrVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas
                    ref={qrCanvasRef}
                    className="hidden"
                  />
                  
                  {/* QR Code scanning box */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 relative">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeQRScanner}
                    className="flex-1 cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
          )}

          {/* Mobile View - iOS Native Style */}
          {isMobile && (
          <div className="fixed inset-0 bg-black" style={{ zIndex: 9999 }}>            {/* Close button at top */}
            <div className="absolute top-4 right-4 z-10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeQRScanner}
                className="cursor-pointer flex-shrink-0"
              >
                <X className="w-5 h-5 text-white" />
              </Button>
            </div>

            {/* Full screen camera */}
            <div className="absolute inset-0">
              <video
                ref={qrVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas
                ref={qrCanvasRef}
                className="hidden"
              />
              
              {/* QR Code scanning box */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                </div>
              </div>

              {/* Instruction text */}
              <div className="absolute bottom-20 left-0 right-0 text-center px-4">
                <p className="text-white px-4 py-2 inline-block">
                  Position label within frame
                </p>
              </div>
            </div>
          </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}