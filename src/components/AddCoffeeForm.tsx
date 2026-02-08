import { useState, useEffect, useRef } from 'react';
import { Coffee, RoastLevel } from '../types';
import { Plus, Camera, Trash2, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { StandardDialog } from './ui/standard-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { toast } from 'sonner@2.0.3';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface AddCoffeeFormProps {
  onClose: () => void;
  onSave: (coffee: {
    roaster: string;
    name: string;
    roastDate: string;
  }) => void;
  editData?: Coffee | null;
  duplicateData?: Coffee | null;
  onUpdate?: (id: string, data: Omit<Coffee, 'id' | 'createdAt'>) => void;
  existingCoffees?: Coffee[];
}

// Title case helper
const toTitleCase = (str: string): string => {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export function AddCoffeeForm({ onClose, onSave, editData, duplicateData, onUpdate, existingCoffees = [] }: AddCoffeeFormProps) {
  const [roaster, setRoaster] = useState('');
  const [name, setName] = useState('');
  const [roastDate, setRoastDate] = useState('');
  const [regionPills, setRegionPills] = useState<string[]>([]);
  const [regionInput, setRegionInput] = useState('');
  const [notesPills, setNotesPills] = useState<string[]>([]);
  const [notesInput, setNotesInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [extractionMessage, setExtractionMessage] = useState('');
  const [roasterSuggestions, setRoasterSuggestions] = useState<string[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showRoasterSuggestions, setShowRoasterSuggestions] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [roastLevel, setRoastLevel] = useState<RoastLevel | undefined>();
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Track focus state for roaster and name fields
  const [roasterFocused, setRoasterFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  // AI lookup states per field
  const [roastLevelLoading, setRoastLevelLoading] = useState(false);
  const [regionLoading, setRegionLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [personalNotes, setPersonalNotes] = useState('');

  // Detect iOS devices
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Detect if mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    const dataToUse = editData || duplicateData;
    if (dataToUse) {
      setRoaster(dataToUse.roaster);
      setName(dataToUse.name);
      // For duplicates, don't copy roast date - leave it empty
      // For edits, keep the roast date
      if (editData) {
        setRoastDate(dataToUse.roastDate || '');
      } else {
        // Duplicate - clear roast date
        setRoastDate('');
      }
      // Parse region and notes into pills
      if (dataToUse.region) {
        setRegionPills(dataToUse.region.split(',').map(s => s.trim()).filter(Boolean));
      }
      if (dataToUse.notes) {
        setNotesPills(dataToUse.notes.split(',').map(s => s.trim()).filter(Boolean));
      }
      // Load existing image if available
      if (dataToUse.imageUrl) {
        setImages([dataToUse.imageUrl]);
      }
      // Load existing images if available
      if (dataToUse.imageUrls && dataToUse.imageUrls.length > 0) {
        setImages(dataToUse.imageUrls);
      }
      // Set roast level if available
      if (dataToUse.roastLevel) {
        setRoastLevel(dataToUse.roastLevel);
      }
      // Load personal notes if available
      if (dataToUse.personalNotes) {
        setPersonalNotes(dataToUse.personalNotes);
      }
    }
  }, [editData, duplicateData, isIOS]);

  // Auto-fill region and notes based on roaster and name from previous entries
  // Only trigger when both fields have text and neither is focused
  useEffect(() => {
    // Only run if both roaster and name have text, neither is focused, and not in edit mode
    if (!roaster || !name || roasterFocused || nameFocused || editData) {
      return;
    }

    // Find the most recent coffee with the same roaster and name that has region, notes, or roast level
    const matchingCoffees = existingCoffees.filter(
      c => c.roaster.toLowerCase() === roaster.toLowerCase() && 
           c.name.toLowerCase() === name.toLowerCase() &&
           (c.region || c.notes || c.roastLevel)
    );

    if (matchingCoffees.length > 0) {
      // Sort by createdAt to get the most recent
      const mostRecent = matchingCoffees.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      if (mostRecent.roastLevel) {
        setRoastLevel(mostRecent.roastLevel);
      }
      if (mostRecent.region) {
        setRegionPills(mostRecent.region.split(',').map(s => s.trim()).filter(Boolean));
      }
      if (mostRecent.notes) {
        setNotesPills(mostRecent.notes.split(',').map(s => s.trim()).filter(Boolean));
      }
      
      // After auto-filling, check if any fields are still empty and trigger AI lookup in parallel
      setTimeout(async () => {
        const lookups: Promise<void>[] = [];
        
        if (!mostRecent.roastLevel && !roastLevelLoading) {
          lookups.push(handleRoastLevelLookup());
        }
        if (!mostRecent.region && !regionLoading && regionPills.length === 0) {
          lookups.push(handleRegionLookup());
        }
        if (!mostRecent.notes && !notesLoading && notesPills.length === 0) {
          lookups.push(handleNotesLookup());
        }
        
        // Run all AI lookups in parallel
        if (lookups.length > 0) {
          await Promise.all(lookups);
        }
      }, 300);
    } else {
      // No previous coffee found, trigger AI lookup for all fields in parallel
      setTimeout(async () => {
        const lookups: Promise<void>[] = [];
        
        if (!roastLevel && !roastLevelLoading) {
          lookups.push(handleRoastLevelLookup());
        }
        if (regionPills.length === 0 && !regionLoading) {
          lookups.push(handleRegionLookup());
        }
        if (notesPills.length === 0 && !notesLoading) {
          lookups.push(handleNotesLookup());
        }
        
        // Run all AI lookups in parallel
        if (lookups.length > 0) {
          await Promise.all(lookups);
        }
      }, 300);
    }
  }, [roaster, name, roasterFocused, nameFocused, existingCoffees, editData]);

  const handleSave = () => {
    if (!canSave) return;
    
    // Date input already provides yyyy-mm-dd format
    onSave({
      roaster,
      name,
      roastDate: roastDate,
      region: regionPills.join(', '),
      notes: notesPills.join(', '),
      imageData: images.length > 0 ? images : undefined, // Send all images
      roastLevel,
      personalNotes: personalNotes.trim() || undefined,
    } as any);
  };

  const handleUpdate = () => {
    if (!canSave || !editData) return;
    
    // Date input already provides yyyy-mm-dd format
    
    onUpdate!(editData.id, {
      roaster,
      name,
      roastDate: roastDate,
      region: regionPills.join(', '),
      notes: notesPills.join(', '),
      imageData: images.length > 0 ? images : undefined, // Send all images
      roastLevel,
      personalNotes: personalNotes.trim() || undefined,
    } as any);
  };

  // Add region pill
  const addRegionPill = () => {
    const trimmed = regionInput.trim();
    if (trimmed && !regionPills.includes(trimmed)) {
      setRegionPills([...regionPills, trimmed]);
      setRegionInput('');
    }
  };

  // Remove region pill
  const removeRegionPill = (index: number) => {
    setRegionPills(regionPills.filter((_, i) => i !== index));
  };

  // Handle region input key press
  const handleRegionKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRegionPill();
    }
  };

  // Add notes pill
  const addNotesPill = () => {
    const trimmed = notesInput.trim();
    if (trimmed && !notesPills.includes(trimmed)) {
      setNotesPills([...notesPills, trimmed]);
      setNotesInput('');
    }
  };

  // Remove notes pill
  const removeNotesPill = (index: number) => {
    setNotesPills(notesPills.filter((_, i) => i !== index));
  };

  // Handle notes input key press
  const handleNotesKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNotesPill();
    }
  };

  // Update roaster suggestions as user types
  useEffect(() => {
    if (editData) {
      setRoasterSuggestions([]);
      return;
    }
    
    const uniqueRoasters = Array.from(new Set(existingCoffees.map(c => c.roaster)))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    // If roaster is empty or just focused, show all
    if (!roaster || roasterFocused) {
      setRoasterSuggestions(uniqueRoasters);
    } else {
      const filtered = uniqueRoasters.filter(r => 
        r.toLowerCase().includes(roaster.toLowerCase())
      );
      setRoasterSuggestions(filtered);
    }
  }, [roaster, existingCoffees, editData, roasterFocused]);

  // Update name suggestions as user types
  useEffect(() => {
    if (editData) {
      setNameSuggestions([]);
      return;
    }
    
    let uniqueNames: string[];
    
    // If roaster is selected, show only coffees from that roaster
    if (roaster) {
      uniqueNames = Array.from(
        new Set(
          existingCoffees
            .filter(c => c.roaster.toLowerCase() === roaster.toLowerCase())
            .map(c => c.name)
        )
      ).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    } else {
      // Otherwise show all unique coffee names
      uniqueNames = Array.from(new Set(existingCoffees.map(c => c.name)))
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }
    
    // If name is empty, show all
    if (!name) {
      setNameSuggestions(uniqueNames);
    } else {
      const filtered = uniqueNames.filter(n => 
        n.toLowerCase().includes(name.toLowerCase())
      );
      setNameSuggestions(filtered);
    }
  }, [name, roaster, existingCoffees, editData]);

  const canSave = roaster && name && !roastLevelLoading && !regionLoading && !notesLoading;

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newImages: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const base64 = await fileToBase64(files[i]);
        newImages.push(base64);
      }
      setImages([...images, ...newImages]);
    } catch (error) {
      console.error('Error reading files:', error);
      alert('Failed to read images. Please try again.');
    }
  };

  // Handle camera capture - different behavior for mobile vs desktop
  const handleCameraCapture = () => {
    if (isMobile) {
      // Mobile: Open native camera with front-facing camera
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'user'; // Front-facing camera
      input.style.display = 'none';
      
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        
        if (!files || files.length === 0) {
          return;
        }

        try {
          const newImages: string[] = [];
          for (let i = 0; i < files.length; i++) {
            const base64 = await fileToBase64(files[i]);
            newImages.push(base64);
          }
          setImages((prevImages) => {
            return [...prevImages, ...newImages];
          });
        } catch (error) {
          console.error('Error reading camera images:', error);
          alert('Failed to read camera images. Please try again.');
        } finally {
          // Clean up
          document.body.removeChild(input);
        }
      };
      
      // Append to body (required for iOS)
      document.body.appendChild(input);
      input.click();
    } else {
      // Desktop: Open camera modal
      setShowCameraModal(true);
    }
  };

  // Start desktop camera
  const startDesktopCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: false 
      });
      setCameraStream(stream);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Failed to access camera. Please make sure you have granted camera permissions.');
      setShowCameraModal(false);
    }
  };

  // Stop desktop camera
  const stopDesktopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  // Capture photo from desktop camera
  const captureDesktopPhoto = () => {
    const video = document.getElementById('camera-video') as HTMLVideoElement;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg');
    setImages([...images, base64]);
  };

  // Close desktop camera modal
  const closeDesktopCamera = () => {
    stopDesktopCamera();
    setShowCameraModal(false);
  };

  // Start camera when modal opens
  useEffect(() => {
    if (showCameraModal && !isMobile) {
      startDesktopCamera();
    }
    return () => {
      if (showCameraModal) {
        stopDesktopCamera();
      }
    };
  }, [showCameraModal]);

  // Attach stream to video element
  useEffect(() => {
    if (cameraStream && showCameraModal) {
      const video = document.getElementById('camera-video') as HTMLVideoElement;
      if (video) {
        video.srcObject = cameraStream;
      }
    }
  }, [cameraStream, showCameraModal]);

  // Remove image from array
  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Extract details from images
  const extractFromImages = async () => {
    if (images.length === 0) {
      alert('Please add at least one image first.');
      return;
    }

    setIsExtracting(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/extract-coffee-bag`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ images }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract details');
      }

      const data = await response.json();
      
      // Match casing with existing coffees
      let roasterValue = data.roaster || '';
      let nameValue = data.name || '';
      
      // Find matching roaster (case-insensitive) and use its casing
      if (roasterValue) {
        const existingRoaster = existingCoffees.find(
          c => c.roaster.toLowerCase() === roasterValue.toLowerCase()
        );
        if (existingRoaster) {
          roasterValue = existingRoaster.roaster;
        }
      }
      
      // Find matching name (case-insensitive) and use its casing
      if (nameValue) {
        const existingName = existingCoffees.find(
          c => c.name.toLowerCase() === nameValue.toLowerCase()
        );
        if (existingName) {
          nameValue = existingName.name;
        }
      }
      
      // Auto-fill the fields with extracted data
      if (roasterValue) setRoaster(roasterValue);
      if (nameValue) setName(nameValue);
      if (data.roastDate) {
        setRoastDate(data.roastDate);
      }
      if (data.region) {
        // Parse region into pills (split by commas)
        const regions = data.region.split(',').map((s: string) => s.trim()).filter(Boolean);
        setRegionPills(regions);
      }
      if (data.notes) {
        // Parse notes into pills (split by commas)
        const notes = data.notes.split(',').map((s: string) => s.trim()).filter(Boolean);
        setNotesPills(notes);
      }
      if (data.roastLevel && ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark'].includes(data.roastLevel)) {
        setRoastLevel(data.roastLevel as RoastLevel);
      }

      setExtractionStatus('success');
      setExtractionMessage('Details extracted successfully! Please review and adjust as needed.');
    } catch (error) {
      console.error('Error extracting details:', error);
      setExtractionStatus('error');
      setExtractionMessage(`Failed to extract details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // AI lookup for roast level
  const handleRoastLevelLookup = async () => {
    if (!roaster || !name) {
      toast.error('Please enter roaster and coffee name first');
      return;
    }

    setRoastLevelLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/lookup-coffee-details`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ roaster, coffeeName: name, field: 'roastLevel' }),
        }
      );

      if (!response.ok) {
        let errorMessage = 'Failed to lookup roast level';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.roastLevel && ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark'].includes(data.roastLevel)) {
        setRoastLevel(data.roastLevel as RoastLevel);
        toast.success('Roast level autofilled!');
      } else {
        toast.warning('Could not find reliable roast level information for this coffee');
      }
    } catch (error) {
      console.error('Error looking up roast level:', error);
      toast.error(`Failed to lookup roast level: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRoastLevelLoading(false);
    }
  };

  // AI lookup for region
  const handleRegionLookup = async () => {
    if (!roaster || !name) {
      toast.error('Please enter roaster and coffee name first');
      return;
    }

    setRegionLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/lookup-coffee-details`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ roaster, coffeeName: name, field: 'region' }),
        }
      );

      if (!response.ok) {
        let errorMessage = 'Failed to lookup region';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.region) {
        // Title case and split into pills
        const regions = data.region.split(',').map((s: string) => toTitleCase(s.trim())).filter(Boolean);
        setRegionPills(regions);
        toast.success('Region autofilled!');
      } else {
        toast.warning('Could not find reliable region information for this coffee');
      }
    } catch (error) {
      console.error('Error looking up region:', error);
      toast.error(`Failed to lookup region: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRegionLoading(false);
    }
  };

  // AI lookup for tasting notes
  const handleNotesLookup = async () => {
    if (!roaster || !name) {
      toast.error('Please enter roaster and coffee name first');
      return;
    }

    setNotesLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/lookup-coffee-details`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ roaster, coffeeName: name, field: 'tastingNotes' }),
        }
      );

      if (!response.ok) {
        let errorMessage = 'Failed to lookup tasting notes';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.notes) {
        // Title case and split into pills
        const notes = data.notes.split(',').map((s: string) => toTitleCase(s.trim())).filter(Boolean);
        setNotesPills(notes);
        toast.success('Tasting notes autofilled!');
      } else {
        toast.warning('Could not find reliable tasting notes for this coffee');
      }
    } catch (error) {
      console.error('Error looking up tasting notes:', error);
      toast.error(`Failed to lookup tasting notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setNotesLoading(false);
    }
  };

  // Helper function to highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    const before = text.slice(0, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);
    
    return (
      <>
        {before}
        <span className="font-bold">{match}</span>
        {after}
      </>
    );
  };

  return (
    <>
      <StandardDialog 
        open={!showCameraModal} 
        onOpenChange={(open) => !open && onClose()}
        title="Add Coffee"
        titleAlign="center"
        footerContent={
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={editData ? handleUpdate : handleSave} disabled={!canSave} className="flex-1 cursor-pointer">
              {editData ? 'Save Changes' : 'Add Coffee'}
            </Button>
          </div>
        }
      >
        <div>
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4 mb-4">
              <Label>Bag Photos</Label>
              
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    • Auto-fill coffee details from your bag
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    • Saved with your coffee
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={handleCameraCapture}
                  className="cursor-pointer whitespace-nowrap flex-shrink-0 self-center h-9 font-normal"
                >
                  <Camera className="w-4 h-4" />
                  Add Photo
                </Button>
              </div>

              {images.length > 0 && (
                <div className="space-y-3 mt-3">
                  <div className="flex flex-wrap gap-2">
                    {images.map((img, index) => (
                      <div key={index} className="relative">
                        <img
                          src={img}
                          alt={`Coffee bag ${index + 1}`}
                          className="w-20 h-20 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs cursor-pointer hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {!editData && (
                    <>
                      <Button
                        type="button"
                        onClick={extractFromImages}
                        disabled={isExtracting}
                        className="w-full cursor-pointer"
                      >
                        {isExtracting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Extracting Details
                          </>
                        ) : (
                          'Extract Details'
                        )}
                      </Button>
                      
                      {extractionStatus === 'success' && (
                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span>Details extracted. Review the fields below.</span>
                        </div>
                      )}
                      
                      {extractionStatus === 'error' && (
                        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{extractionMessage}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <Label htmlFor="roaster">Roaster</Label>
              <Input
                id="roaster"
                value={roaster}
                onChange={(e) => setRoaster(e.target.value)}
                placeholder="Onyx Coffee Lab"
                className="mt-2"
                onFocus={() => setShowRoasterSuggestions(true)}
                onBlur={() => setTimeout(() => setShowRoasterSuggestions(false), 200)}
                autoComplete="off"
                onFocusCapture={() => setRoasterFocused(true)}
                onBlurCapture={() => setRoasterFocused(false)}
              />
              {showRoasterSuggestions && (roasterSuggestions.length > 0 || roaster) && (
                <div className="absolute z-10 mt-1 left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                  {/* Show current input as first option if it doesn't match existing suggestions */}
                  {roaster && !roasterSuggestions.some(s => s.toLowerCase() === roaster.toLowerCase()) && (
                    <div
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm border-b"
                      onClick={() => {
                        setRoaster(roaster);
                        setShowRoasterSuggestions(false);
                      }}
                    >
                      <span className="font-bold">{roaster}</span>
                    </div>
                  )}
                  {roasterSuggestions.slice(0, 5).map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm border-b last:border-b-0"
                      onClick={() => {
                        setRoaster(suggestion);
                        setShowRoasterSuggestions(false);
                      }}
                    >
                      {highlightMatch(suggestion, roaster)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <Label htmlFor="name">Coffee Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Southern Weather"
                className="mt-2"
                onFocus={() => setShowNameSuggestions(true)}
                onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                autoComplete="off"
                onFocusCapture={() => setNameFocused(true)}
                onBlurCapture={() => setNameFocused(false)}
              />
              {showNameSuggestions && (nameSuggestions.length > 0 || name) && (
                <div className="absolute z-10 mt-1 left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                  {/* Show current input as first option if it doesn't match existing suggestions */}
                  {name && !nameSuggestions.some(s => s.toLowerCase() === name.toLowerCase()) && (
                    <div
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm border-b"
                      onClick={() => {
                        setName(name);
                        setShowNameSuggestions(false);
                      }}
                    >
                      <span className="font-bold">{name}</span>
                    </div>
                  )}
                  {nameSuggestions.slice(0, 5).map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm border-b last:border-b-0"
                      onClick={() => {
                        setName(suggestion);
                        setShowNameSuggestions(false);
                      }}
                    >
                      {highlightMatch(suggestion, name)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="roastDate">
                Roast Date <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="roastDate"
                type="date"
                inputMode="numeric"
                value={roastDate}
                onChange={(e) => setRoastDate(e.target.value)}
                className="mt-2 w-full"
                style={{
                  height: '2.25rem',
                  minHeight: '2.25rem',
                  maxHeight: '2.25rem',
                  lineHeight: '1.5',
                }}
              />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-4">
                The following fields are optional, but sharing more will help improve your dial-in guidance.
              </p>
              <Label htmlFor="roastLevel">
                Roast Level <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select value={roastLevel || ''} onValueChange={(v) => setRoastLevel(v as RoastLevel || undefined)} disabled={roastLevelLoading}>
                <SelectTrigger className="w-full overflow-hidden mt-2">
                  {roastLevelLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Select roast level" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Light">Light</SelectItem>
                  <SelectItem value="Medium-Light">Medium-Light</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Medium-Dark">Medium-Dark</SelectItem>
                  <SelectItem value="Dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="region">
                Region <span className="text-muted-foreground">(optional)</span>
              </Label>
              <div className={`mt-2 flex flex-wrap items-center gap-1.5 px-3 py-1 min-h-[36px] border border-input rounded-md bg-input-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] transition-[color,box-shadow] ${regionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                {regionLoading && regionPills.length === 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching</span>
                  </div>
                )}
                {regionPills.map((pill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full text-sm"
                  >
                    {pill}
                    <button
                      type="button"
                      onClick={() => removeRegionPill(index)}
                      className="hover:bg-gray-200 rounded-full p-0.5 cursor-pointer"
                      disabled={regionLoading}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {!regionLoading && (
                  <input
                    id="region"
                    value={regionInput}
                    onChange={(e) => setRegionInput(e.target.value)}
                    onKeyDown={handleRegionKeyPress}
                    onBlur={addRegionPill}
                    placeholder={regionPills.length === 0 ? "Honduras, Colombia, Ethiopia" : ""}
                    className={`flex-1 min-w-[120px] outline-none bg-transparent placeholder:text-muted-foreground text-base md:text-sm`}
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Press Enter to add each region</p>
            </div>

            <div>
              <Label htmlFor="notes">
                Tasting Notes <span className="text-muted-foreground">(optional)</span>
              </Label>
              <div className={`mt-2 flex flex-wrap items-center gap-1.5 px-3 py-1 min-h-[36px] border border-input rounded-md bg-input-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] transition-[color,box-shadow] ${notesLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                {notesLoading && notesPills.length === 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching</span>
                  </div>
                )}
                {notesPills.map((pill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full text-sm"
                  >
                    {pill}
                    <button
                      type="button"
                      onClick={() => removeNotesPill(index)}
                      className="hover:bg-gray-200 rounded-full p-0.5 cursor-pointer"
                      disabled={notesLoading}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {!notesLoading && (
                  <input
                    id="notes"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    onKeyDown={handleNotesKeyPress}
                    onBlur={addNotesPill}
                    placeholder={notesPills.length === 0 ? "Milk Chocolate, Plum, Candied Walnuts" : ""}
                    className={`flex-1 min-w-[120px] outline-none bg-transparent placeholder:text-muted-foreground text-base md:text-sm`}
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Press Enter to add each tasting note</p>
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

      {/* Desktop Camera Modal */}
      {showCameraModal && !isMobile && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]"
          onClick={closeDesktopCamera}
        >
          <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Camera</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDesktopCamera();
                  }} 
                  className="cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="p-6">
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <video
                  id="camera-video"
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDesktopCamera();
                  }}
                  className="flex-1 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    captureDesktopPhoto();
                    closeDesktopCamera();
                  }}
                  className="flex-1 cursor-pointer"
                  disabled={!cameraStream}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Photo
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}