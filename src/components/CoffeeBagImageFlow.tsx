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
  owners: string[];
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
  const [isDefaultStep, setIsDefaultStep] = useState(true);
  const [defaultExistingImage, setDefaultExistingImage] = useState<string | null>(null);
  const [overlayUploadedImage, setOverlayUploadedImage] = useState<string | null>(null);
  const [defaultBagSelected, setDefaultBagSelected] = useState(false);

  const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;

  useEffect(() => {
    loadCoffeesNeedingImages();
  }, []);

  const loadCoffeesNeedingImages = async () => {
    try {
      setLoading(true);
      
      console.log('Total coffees:', coffees.length);

      // Fetch existing default image
      try {
        const defaultRes = await fetch(
          `${apiUrl}/coffee-representative-image?roaster=__default__&coffeeName=__default__`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        if (defaultRes.ok) {
          const data = await defaultRes.json();
          if (data.imageUrl) setDefaultExistingImage(data.imageUrl);
        }
      } catch {
        // Non-fatal
      }
      
      // Get unique coffee combinations (roaster + name)
      const uniqueMap = new Map<string, UniqueCoffee>();
      
      for (const coffee of coffees) {
        const key = `${coffee.roaster}|${coffee.name}`;
        const ownerName = (coffee as any).ownerName as string | undefined;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            roaster: coffee.roaster,
            name: coffee.name,
            region: coffee.region,
            notes: coffee.notes,
            roastLevel: coffee.roastLevel,
            owners: ownerName ? [ownerName] : [],
          });
        } else if (ownerName) {
          const entry = uniqueMap.get(key)!;
          if (!entry.owners.includes(ownerName)) {
            entry.owners.push(ownerName);
          }
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

  const handleGenerateDefault = async () => {
    try {
      setIsGenerating(true);
      const res = await fetch(`${apiUrl}/generate-coffee-bag-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          roaster: '__default__',
          coffeeName: '__default__',
          ...(uploadedImage ? { referenceImage: uploadedImage } : {}),
          customPrompt: customPrompt,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate image');

      const data = await res.json();
      setGeneratedImage(data.imageUrl);
      toast.success('Image generated successfully!');
    } catch (error) {
      console.error('Error generating default image:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDefault = async () => {
    if (!generatedImage) {
      toast.error('Please generate an image first');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/coffee-representative-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          roaster: '__default__',
          coffeeName: '__default__',
          imageUrl: generatedImage,
        }),
      });

      if (!res.ok) throw new Error('Failed to save image');

      toast.success('Default image saved!');
      setIsDefaultStep(false);
      setUploadedImage(null);
      setGeneratedImage(null);
      setCustomPrompt('');
    } catch (error) {
      console.error('Error saving default image:', error);
      toast.error('Failed to save image');
    }
  };

  const handleSkipDefault = () => {
    setIsDefaultStep(false);
    setUploadedImage(null);
    setGeneratedImage(null);
    setCustomPrompt('');
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
        setOverlayUploadedImage(null);
        setCustomPrompt('');
        setDefaultBagSelected(false);
      } else {
        toast.success('All images generated!');
        onClose();
      }
    } catch (error) {
      console.error('Error saving image:', error);
      toast.error('Failed to save image');
    }
  };

  const handleGenerateWithDefaultBag = async () => {
    const currentCoffee = uniqueCoffees[currentIndex];
    if (!currentCoffee) return;
    if (!defaultExistingImage) {
      toast.error('No default bag image set. Generate one first from the Default Shelf Image step.');
      return;
    }

    setIsGenerating(true);
    try {
      // Load Montserrat Bold + Regular via Google Fonts CSS API
      const loadFontUrl = async (weight: number): Promise<string | null> => {
        try {
          const res = await fetch(`https://fonts.googleapis.com/css2?family=Montserrat:wght@${weight}`);
          const css = await res.text();
          const match = css.match(/url\(([^)]+\.woff2)\)/);
          return match ? match[1] : null;
        } catch { return null; }
      };

      const [boldUrl, regularUrl] = await Promise.all([loadFontUrl(700), loadFontUrl(400)]);

      const loadFace = async (name: string, url: string | null) => {
        if (!url) return;
        try {
          const face = new FontFace(name, `url(${url})`);
          await face.load();
          document.fonts.add(face);
        } catch { /* fall back to system font */ }
      };

      await Promise.all([loadFace('BagBold', boldUrl), loadFace('BagRegular', regularUrl)]);

      const boldFamily   = boldUrl    ? 'BagBold, Montserrat, Helvetica Neue, sans-serif'    : 'Helvetica Neue, Helvetica, Arial, sans-serif';
      const regularFamily = regularUrl ? 'BagRegular, Montserrat, Helvetica Neue, sans-serif' : 'Helvetica Neue, Helvetica, Arial, sans-serif';

      // Load the bag image (it's a base64 data URL — no CORS needed)
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = defaultExistingImage;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 1024, 1024);

      // Letter-spacing helper: draw text character-by-character with fixed tracking
      const fillTracked = (text: string, x: number, y: number, tracking: number) => {
        const totalW = ctx.measureText(text).width + tracking * Math.max(0, text.length - 1);
        let curX = x - totalW / 2;
        for (const ch of text) {
          ctx.fillText(ch, curX, y);
          curX += ctx.measureText(ch).width + tracking;
        }
      };

      // Word-wrap helper: splits text into lines that each fit within maxWidth
      const wrapWords = (text: string, tracking: number, maxWidth: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const word of words) {
          const test = cur ? `${cur} ${word}` : word;
          const w = ctx.measureText(test).width + tracking * Math.max(0, test.length - 1);
          if (w > maxWidth && cur) { lines.push(cur); cur = word; }
          else { cur = test; }
        }
        if (cur) lines.push(cur);
        return lines;
      };

      const ROASTER_TRACKING = 3;
      const COFFEE_TRACKING  = 4;
      const maxW = 400; // safe flat-face width of the bag
      const cx   = 512;

      const roasterText = currentCoffee.roaster.toUpperCase();
      const coffeeText  = currentCoffee.name.toUpperCase();

      // Shrink font size until the longest single word fits within maxW
      const shrinkToFit = (
        baseSize: number,
        text: string,
        weight: string,
        family: string,
        tracking: number,
      ): number => {
        let size = baseSize;
        const longestWord = text.split(' ').reduce((a, b) => (a.length >= b.length ? a : b), '');
        while (size > 10) {
          ctx.font = `${weight} ${size}px ${family}`;
          const wordW = ctx.measureText(longestWord).width + tracking * Math.max(0, longestWord.length - 1);
          if (wordW <= maxW) break;
          size -= 1;
        }
        return size;
      };

      const roasterSize = shrinkToFit(52, roasterText, '700', boldFamily, ROASTER_TRACKING);
      const coffeeSize  = shrinkToFit(Math.round(roasterSize * 0.58), coffeeText, '400', regularFamily, COFFEE_TRACKING);

      const roasterDecl = `700 ${roasterSize}px ${boldFamily}`;
      const coffeeDecl  = `400 ${coffeeSize}px ${regularFamily}`;

      ctx.font = roasterDecl;
      const roasterLines = wrapWords(roasterText, ROASTER_TRACKING, maxW);
      ctx.font = coffeeDecl;
      const coffeeLines  = wrapWords(coffeeText,  COFFEE_TRACKING,  maxW);

      // Vertical layout: both line-blocks centered together at y=440
      const roasterLineH = Math.round(roasterSize * 1.1);
      const coffeeLineH  = Math.round(coffeeSize  * 1.3);
      const blockGap     = Math.round(roasterSize * 0.55); // gap between roaster block and coffee block
      const roasterBlockH = roasterSize + (roasterLines.length - 1) * roasterLineH;
      const coffeeBlockH  = coffeeSize  + (coffeeLines.length  - 1) * coffeeLineH;
      const totalH  = roasterBlockH + blockGap + coffeeBlockH;
      const blockTop = 512 - totalH / 2;

      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle    = '#000000';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';

      // Roaster lines — bold
      ctx.font = roasterDecl;
      roasterLines.forEach((line, i) => {
        fillTracked(line, cx, blockTop + roasterSize + i * roasterLineH, ROASTER_TRACKING);
      });

      // Coffee name lines — regular
      ctx.font = coffeeDecl;
      const coffeeStartY = blockTop + roasterBlockH + blockGap + coffeeSize;
      coffeeLines.forEach((line, i) => {
        fillTracked(line, cx, coffeeStartY + i * coffeeLineH, COFFEE_TRACKING);
      });

      ctx.globalCompositeOperation = 'source-over';

      setGeneratedImage(canvas.toDataURL('image/png'));
      toast.success('Image generated!');
    } catch (error) {
      console.error('Error compositing bag image:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOverlayImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setOverlayUploadedImage(dataUrl);
      await handleGenerateWithOverlayImage(dataUrl);
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const fetchAsBase64 = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) return url;
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleGenerateWithOverlayImage = async (imageDataUrl?: string) => {
    const currentCoffee = uniqueCoffees[currentIndex];
    if (!currentCoffee) return;
    const rawRef = imageDataUrl ?? overlayUploadedImage;
    if (!rawRef) return;

    try {
      setIsGenerating(true);
      const refImage = await fetchAsBase64(rawRef);
      const res = await fetch(`${apiUrl}/generate-coffee-bag-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          roaster: currentCoffee.roaster,
          coffeeName: currentCoffee.name,
          referenceImage: refImage,
          mode: 'text-overlay',
          customPrompt: customPrompt,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate image');

      const data = await res.json();
      setGeneratedImage(data.imageUrl);
      toast.success('Image generated!');
    } catch (error) {
      console.error('Error generating from uploaded image:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < uniqueCoffees.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUploadedImage(null);
      setGeneratedImage(null);
      setOverlayUploadedImage(null);
      setCustomPrompt('');
      setDefaultBagSelected(false);
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

  if (isDefaultStep) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-lg p-8 max-w-4xl w-full my-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Default Shelf Image</h2>
              <p className="text-sm text-gray-600 mt-1">
                This image is shown for coffees that don't have their own bag photo.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Existing default image */}
          {defaultExistingImage && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg flex items-start gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">Current Default Image:</p>
                <img
                  src={defaultExistingImage}
                  alt="Current default shelf image"
                  className="w-24 h-36 object-contain rounded border border-gray-300"
                />
              </div>
              <p className="text-xs text-amber-600 mt-6">
                ⚠️ A default image already exists. Saving a new one will replace it.
              </p>
            </div>
          )}

          {/* Upload Section */}
          {!generatedImage && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Reference Photo
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                {uploadedImage ? (
                  <div className="space-y-4">
                    <img
                      src={uploadedImage}
                      alt="Uploaded reference"
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
                    <p className="text-gray-600">Click to upload a reference bag image</p>
                    <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 10MB</p>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Custom Prompt */}
          {!generatedImage && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Prompt Text (Optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Add extra instructions to append to the default generation prompt..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                This text is appended to the default prompt. Leave empty to use the default prompt as-is.
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
                alt="Generated default shelf image"
                className="max-h-96 mx-auto rounded-lg border border-gray-200"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <Button variant="ghost" onClick={handleSkipDefault} className="cursor-pointer">
              Skip
            </Button>

            {!generatedImage ? (
              <Button
                onClick={handleGenerateDefault}
                disabled={isGenerating}
                className="cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Image'
                )}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleGenerateDefault}
                  disabled={isGenerating}
                  className="cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
                <Button onClick={handleSaveDefault} className="cursor-pointer">
                  <Check className="w-4 h-4 mr-2" />
                  Save & Continue
                </Button>
              </div>
            )}
          </div>
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
              {currentCoffee.owners.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentCoffee.owners.map((owner) => (
                    <span
                      key={owner}
                      className="inline-block px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium"
                    >
                      {owner}
                    </span>
                  ))}
                </div>
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

            {/* Text-overlay shortcuts */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 flex-none">or add text overlay</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {/* Default bag option */}
              {defaultExistingImage && !defaultBagSelected && (
                <button
                  onClick={() => setDefaultBagSelected(true)}
                  disabled={isGenerating}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <img
                    src={defaultExistingImage}
                    alt="Default bag"
                    className="w-10 h-14 object-contain rounded flex-none"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">Use Default Bag + Add Text</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      Add "{currentCoffee.roaster}" and "{currentCoffee.name}" in a minimalist font
                    </p>
                  </div>
                </button>
              )}
              {defaultExistingImage && defaultBagSelected && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={defaultExistingImage}
                      alt="Default bag"
                      className="w-10 h-14 object-contain rounded flex-none"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Use Default Bag + Add Text</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        Add "{currentCoffee.roaster}" and "{currentCoffee.name}" in a minimalist font
                      </p>
                    </div>
                    <button
                      onClick={() => setDefaultBagSelected(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer flex-none"
                    >
                      Cancel
                    </button>
                  </div>
                  <Button
                    onClick={handleGenerateWithDefaultBag}
                    disabled={isGenerating}
                    className="cursor-pointer w-full"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate'
                    )}
                  </Button>
                </div>
              )}

              {/* Upload own image option */}
              {(() => {
                const coffeePhotos = [
                  ...new Set(
                    coffees
                      .filter(c => c.roaster === currentCoffee.roaster && c.name === currentCoffee.name)
                      .flatMap(c => c.imageUrls ?? [])
                  ),
                ];
                return (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 mb-2">Use Your Bag Photo + Add Text</p>

                    {/* Existing uploaded photos */}
                    {coffeePhotos.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-3">
                        {coffeePhotos.map((url, i) => (
                          <button
                            key={i}
                            onClick={() => handleGenerateWithOverlayImage(url)}
                            disabled={isGenerating}
                            className="relative rounded overflow-hidden border-2 border-transparent hover:border-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-none"
                            title="Use this photo"
                          >
                            <img
                              src={url}
                              alt={`Bag photo ${i + 1}`}
                              className="w-14 h-20 object-cover"
                            />
                            {isGenerating ? (
                              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* File upload */}
                    <label className={`flex items-center gap-2 cursor-pointer w-fit ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleOverlayImageUpload}
                        className="hidden"
                        disabled={isGenerating}
                      />
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                        <Upload className="w-3.5 h-3.5" />
                        {coffeePhotos.length > 0 ? 'Upload a different photo' : 'Upload a photo'}
                      </div>
                    </label>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Prompt Extension */}
        {!generatedImage && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Prompt Text (Optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Extra instructions appended to whichever generation method you use..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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