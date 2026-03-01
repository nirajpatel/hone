import { useState, useEffect } from 'react';
import { Coffee } from '../types';
import { Button } from './ui/button';
import { X, Upload, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toTitleCase } from '../utils/tastingNotes';

interface CoffeeBagImageFlowProps {
  coffees: Coffee[];
  onClose: () => void;
}

interface UniqueCoffee {
  roaster: string;
  name: string;
  region?: string;
  notes?: string;
  roastLevel?: string;
}

export function CoffeeBagImageFlow({ coffees, onClose }: CoffeeBagImageFlowProps) {
  const [uniqueCoffees, setUniqueCoffees] = useState<UniqueCoffee[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingImages, setExistingImages] = useState<Map<string, string>>(new Map());
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;

  useEffect(() => {
    loadCoffeesNeedingImages();
  }, []);

  const loadCoffeesNeedingImages = async () => {
    try {
      setLoading(true);
      
      console.log('Total coffees:', coffees.length);
      
      // Get unique coffee combinations (roaster + name)
      const uniqueMap = new Map<string, UniqueCoffee>();
      
      for (const coffee of coffees) {
        const key = `${coffee.roaster}|${coffee.name}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            roaster: coffee.roaster,
            name: coffee.name,
            region: coffee.region,
            notes: coffee.notes,
            roastLevel: coffee.roastLevel,
          });
        }
      }

      console.log('Unique coffees found:', uniqueMap.size);

      // Check which coffees already have representative images and store them
      const allUniqueCoffees: UniqueCoffee[] = [];
      const existingImagesMap = new Map<string, string>();
      
      for (const coffee of uniqueMap.values()) {
        const key = `${coffee.roaster}|${coffee.name}`;
        try {
          const res = await fetch(
            `${apiUrl}/coffee-representative-image?roaster=${encodeURIComponent(coffee.roaster)}&coffeeName=${encodeURIComponent(coffee.name)}`,
            {
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
              },
            }
          );
          
          if (res.ok) {
            const data = await res.json();
            if (data.imageUrl) {
              existingImagesMap.set(key, data.imageUrl);
            }
          }
        } catch (error) {
          // Continue if request fails
        }
        
        // Add all coffees to the list
        allUniqueCoffees.push(coffee);
      }

      console.log('Total unique coffees:', allUniqueCoffees.length);
      setUniqueCoffees(allUniqueCoffees);
      setExistingImages(existingImagesMap);
      setLoading(false);
    } catch (error) {
      console.error('Error loading coffees:', error);
      toast.error('Failed to load coffees');
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      setGeneratedImage(null); // Reset generated image
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast.error('Please upload an image first');
      return;
    }

    const currentCoffee = uniqueCoffees[currentIndex];
    if (!currentCoffee) return;

    try {
      setIsGenerating(true);
      
      const res = await fetch(`${apiUrl}/generate-coffee-bag-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          roaster: currentCoffee.roaster,
          coffeeName: currentCoffee.name,
          region: currentCoffee.region,
          notes: currentCoffee.notes,
          roastLevel: currentCoffee.roastLevel,
          referenceImage: uploadedImage, // Send the base64 image
          customPrompt: customPrompt, // Add custom prompt
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await res.json();
      
      // Server already processed the image with two-pass alpha extraction
      setGeneratedImage(data.imageUrl);
      toast.success('Image generated successfully!');
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAndNext = async () => {
    if (!generatedImage) {
      toast.error('Please generate an image first');
      return;
    }

    const currentCoffee = uniqueCoffees[currentIndex];
    if (!currentCoffee) return;

    try {
      const res = await fetch(`${apiUrl}/coffee-representative-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          roaster: currentCoffee.roaster,
          coffeeName: currentCoffee.name,
          imageUrl: generatedImage,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save image');
      }

      toast.success('Image saved!');

      // Move to next coffee or close if done
      if (currentIndex < uniqueCoffees.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setUploadedImage(null);
        setGeneratedImage(null);
      } else {
        toast.success('All images generated!');
        onClose();
      }
    } catch (error) {
      console.error('Error saving image:', error);
      toast.error('Failed to save image');
    }
  };

  const handleSkip = () => {
    if (currentIndex < uniqueCoffees.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUploadedImage(null);
      setGeneratedImage(null);
    } else {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
          <p className="text-center text-gray-600">Loading coffees...</p>
        </div>
      </div>
    );
  }

  if (uniqueCoffees.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Coffee Bag Images</h2>
              <p className="text-sm text-gray-600 mt-1">No coffees found.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <Button onClick={onClose} className="cursor-pointer w-full">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const currentCoffee = uniqueCoffees[currentIndex];
  const currentKey = `${currentCoffee.roaster}|${currentCoffee.name}`;
  const hasExistingImage = existingImages.has(currentKey);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-8 max-w-4xl w-full my-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Generate Coffee Bag Image</h2>
            <p className="text-sm text-gray-600 mt-1">
              Coffee {currentIndex + 1} of {uniqueCoffees.length}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Coffee Details */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg text-gray-900">{currentCoffee.roaster}</h3>
              <p className="text-gray-700">{currentCoffee.name}</p>
              {currentCoffee.region && (
                <p className="text-sm text-gray-600 mt-1">Region: {currentCoffee.region}</p>
              )}
              {currentCoffee.roastLevel && (
                <p className="text-sm text-gray-600">Roast: {currentCoffee.roastLevel}</p>
              )}
              {currentCoffee.notes && (
                <p className="text-sm text-gray-600">Notes: {toTitleCase(currentCoffee.notes)}</p>
              )}
            </div>
            {hasExistingImage && (
              <div className="ml-4">
                <p className="text-xs text-gray-500 mb-2">Current Image:</p>
                <img 
                  src={existingImages.get(currentKey)} 
                  alt="Current coffee bag" 
                  className="w-24 h-36 object-cover rounded border border-gray-300"
                />
              </div>
            )}
          </div>
          {hasExistingImage && (
            <p className="text-xs text-amber-600 mt-3">⚠️ This coffee already has an image. Generating a new one will replace it.</p>
          )}
        </div>

        {/* Upload Section */}
        {!generatedImage && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Coffee Bag Photo
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              {uploadedImage ? (
                <div className="space-y-4">
                  <img
                    src={uploadedImage}
                    alt="Uploaded coffee bag"
                    className="max-h-64 mx-auto rounded-lg"
                  />
                  <label className="cursor-pointer inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <span className="text-blue-600 hover:text-blue-700 text-sm">
                      Change image
                    </span>
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Click to upload coffee bag image</p>
                  <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 10MB</p>
                </label>
              )}
            </div>
          </div>
        )}

        {/* Custom Prompt Editor */}
        {!generatedImage && uploadedImage && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Prompt (Optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter custom prompt to override the default generation instructions..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use default prompt. The custom prompt will be appended to the base instructions.
            </p>
          </div>
        )}

        {/* Generated Image */}
        {generatedImage && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Generated Image
            </label>
            <img
              src={generatedImage}
              alt="Generated coffee bag"
              className="max-h-96 mx-auto rounded-lg border border-gray-200"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="cursor-pointer"
          >
            Skip
          </Button>
          
          {!generatedImage ? (
            <Button
              onClick={handleGenerate}
              disabled={!uploadedImage || isGenerating}
              className="cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Image
                </>
              )}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button
                onClick={handleSaveAndNext}
                className="cursor-pointer"
              >
                <Check className="w-4 h-4 mr-2" />
                Save & {currentIndex < uniqueCoffees.length - 1 ? 'Next' : 'Finish'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}