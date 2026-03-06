import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { Coffee } from '../types';
import { Button } from './ui/button';
import { X, Upload, RefreshCw, Check, ChevronLeft, ChevronRight, LayoutGrid, Pencil } from 'lucide-react';
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

// Module-level caches so data survives tab switches (component unmount/remount)
let _cachedUniqueCoffees: UniqueCoffee[] | null = null;
let _cachedExistingImages: Map<string, string> | null = null;
let _cachedDefaultImage: string | null = null;
let _fetchInProgress = false;

export function CoffeeBagImageFlow({ coffees, onClose }: CoffeeBagImageFlowProps) {
  const [uniqueCoffees, setUniqueCoffees] = useState<UniqueCoffee[]>(_cachedUniqueCoffees ?? []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(_cachedUniqueCoffees === null);
  const [existingImages, setExistingImages] = useState<Map<string, string>>(_cachedExistingImages ?? new Map());
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isDefaultStep, setIsDefaultStep] = useState(true);
  const [defaultExistingImage, setDefaultExistingImage] = useState<string | null>(_cachedDefaultImage);
  const [overlayUploadedImage, setOverlayUploadedImage] = useState<string | null>(null);
  const [defaultBagSelected, setDefaultBagSelected] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'grid'>('grid');

  const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;

  useEffect(() => {
    // Already have cached data — skip fetch entirely
    if (_cachedUniqueCoffees !== null) return;
    // Another instance is already fetching — skip
    if (_fetchInProgress) return;
    loadCoffeesNeedingImages();
  }, []);


  const loadCoffeesNeedingImages = async () => {
    _fetchInProgress = true;
    try {
      // Fetch alias maps so variant roaster/coffee names are grouped under their canonical key
      let roasterAliases: Record<string, string> = {};
      let coffeeNameAliases: Record<string, string> = {};
      try {
        const aliasRes = await fetch(`${apiUrl}/aliases`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (aliasRes.ok) {
          const data = await aliasRes.json();
          roasterAliases = data.roasterAliases ?? {};
          coffeeNameAliases = data.coffeeNameAliases ?? {};
        }
      } catch { /* non-fatal — proceed without aliases */ }

      const resolveCanonical = (roaster: string, name: string) => {
        const canonicalRoaster = roasterAliases[roaster] ?? roaster;
        const coffeeKey = `${canonicalRoaster}|${name}`;
        const canonicalName = coffeeNameAliases[coffeeKey]?.split('|')[1] ?? name;
        return { roaster: canonicalRoaster, name: canonicalName };
      };

      // Build unique coffees list immediately and show UI
      const uniqueMap = new Map<string, UniqueCoffee>();
      for (const coffee of coffees) {
        const canonical = resolveCanonical(coffee.roaster, coffee.name);
        const key = `${canonical.roaster}|${canonical.name}`;
        const ownerName = (coffee as any).ownerName as string | undefined;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            roaster: canonical.roaster,
            name: canonical.name,
            region: coffee.region,
            notes: coffee.notes,
            roastLevel: coffee.roastLevel,
            owners: ownerName ? [ownerName] : [],
          });
        } else if (ownerName) {
          const entry = uniqueMap.get(key)!;
          if (!entry.owners.includes(ownerName)) entry.owners.push(ownerName);
        }
      }

      const allUniqueCoffees = Array.from(uniqueMap.values());
      _cachedUniqueCoffees = allUniqueCoffees;
      setUniqueCoffees(allUniqueCoffees);
      setLoading(false); // Show UI immediately

      // Fetch default image and all coffee images in background
      const fetchDefault = async () => {
        try {
          const res = await fetch(
            `${apiUrl}/coffee-representative-image?roaster=__default__&coffeeName=__default__`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.imageUrl) {
              _cachedDefaultImage = data.imageUrl;
              setDefaultExistingImage(data.imageUrl);
            }
          }
        } catch { /* non-fatal */ }
      };

      // Fetch images in batches of 8, updating state and cache after each batch
      const fetchAllImages = async () => {
        const batchSize = 8;
        for (let i = 0; i < allUniqueCoffees.length; i += batchSize) {
          const batch = allUniqueCoffees.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (coffee) => {
              const key = `${coffee.roaster}|${coffee.name}`;
              try {
                const res = await fetch(
                  `${apiUrl}/coffee-representative-image?roaster=${encodeURIComponent(coffee.roaster)}&coffeeName=${encodeURIComponent(coffee.name)}`,
                  { headers: { Authorization: `Bearer ${publicAnonKey}` } }
                );
                if (res.ok) {
                  const data = await res.json();
                  if (data.imageUrl) return [key, data.imageUrl] as [string, string];
                }
              } catch { /* continue */ }
              return null;
            })
          );
          const found = results.filter((r): r is [string, string] => r !== null);
          if (found.length > 0) {
            setExistingImages(prev => {
              const next = new Map(prev);
              for (const [k, v] of found) {
                next.set(k, v);
                _cachedExistingImages = next;
              }
              return next;
            });
          }
        }
        _fetchInProgress = false;
      };

      // Run both concurrently in the background
      fetchDefault();
      fetchAllImages();
    } catch (error) {
      console.error('Error loading coffees:', error);
      toast.error('Failed to load coffees');
      setLoading(false);
      _fetchInProgress = false;
    }
  };

  // ─── Navigation ────────────────────────────────────────────────────────────

  const resetPerCoffeeState = () => {
    setUploadedImage(null);
    setGeneratedImage(null);
    setOverlayUploadedImage(null);
    setCustomPrompt('');
    setDefaultBagSelected(false);
  };

  const goBack = useCallback(() => {
    if (isDefaultStep) return;
    if (currentIndex === 0) {
      setIsDefaultStep(true);
      resetPerCoffeeState();
    } else {
      setCurrentIndex(i => i - 1);
      resetPerCoffeeState();
    }
  }, [isDefaultStep, currentIndex]);

  const goForward = useCallback(() => {
    if (isDefaultStep) {
      setIsDefaultStep(false);
      resetPerCoffeeState();
    } else if (currentIndex < uniqueCoffees.length - 1) {
      setCurrentIndex(i => i + 1);
      resetPerCoffeeState();
    }
  }, [isDefaultStep, currentIndex, uniqueCoffees.length]);

  const isAtStart = isDefaultStep;
  const isAtEnd = !isDefaultStep && currentIndex === uniqueCoffees.length - 1;

  // ─── Image handlers ────────────────────────────────────────────────────────

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setUploadedImage(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerateDefault = async () => {
    try {
      setIsGenerating(true);
      const res = await fetch(`${apiUrl}/generate-coffee-bag-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          roaster: '__default__',
          coffeeName: '__default__',
          ...(uploadedImage ? { referenceImage: uploadedImage } : {}),
          customPrompt,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate image');
      const data = await res.json();
      setGeneratedImage(data.imageUrl);
      toast.success('Image generated!');
    } catch {
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDefault = async () => {
    if (!generatedImage) { toast.error('Generate an image first'); return; }
    try {
      const res = await fetch(`${apiUrl}/coffee-representative-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ roaster: '__default__', coffeeName: '__default__', imageUrl: generatedImage }),
      });
      if (!res.ok) throw new Error();
      setDefaultExistingImage(generatedImage);
      toast.success('Default image saved!');
    } catch {
      toast.error('Failed to save image');
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage) { toast.error('Upload an image first'); return; }
    const currentCoffee = uniqueCoffees[currentIndex];
    if (!currentCoffee) return;
    try {
      setIsGenerating(true);
      const res = await fetch(`${apiUrl}/generate-coffee-bag-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          roaster: currentCoffee.roaster,
          coffeeName: currentCoffee.name,
          region: currentCoffee.region,
          notes: currentCoffee.notes,
          roastLevel: currentCoffee.roastLevel,
          referenceImage: uploadedImage,
          customPrompt,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGeneratedImage(data.imageUrl);
      toast.success('Image generated!');
    } catch {
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedImage) { toast.error('Generate an image first'); return; }
    const currentCoffee = uniqueCoffees[currentIndex];
    if (!currentCoffee) return;
    try {
      const res = await fetch(`${apiUrl}/coffee-representative-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ roaster: currentCoffee.roaster, coffeeName: currentCoffee.name, imageUrl: generatedImage }),
      });
      if (!res.ok) throw new Error();
      const key = `${currentCoffee.roaster}|${currentCoffee.name}`;
      setExistingImages(prev => new Map(prev).set(key, generatedImage));
      toast.success('Image saved!');
    } catch {
      toast.error('Failed to save image');
    }
  };

  const handleGenerateWithDefaultBag = async () => {
    const currentCoffee = uniqueCoffees[currentIndex];
    if (!currentCoffee || !defaultExistingImage) {
      toast.error('No default bag image set.');
      return;
    }
    setIsGenerating(true);
    try {
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
        try { const face = new FontFace(name, `url(${url})`); await face.load(); document.fonts.add(face); } catch { /* fallback */ }
      };
      await Promise.all([loadFace('BagBold', boldUrl), loadFace('BagRegular', regularUrl)]);
      const boldFamily   = boldUrl    ? 'BagBold, Montserrat, Helvetica Neue, sans-serif' : 'Helvetica Neue, Helvetica, Arial, sans-serif';
      const regularFamily = regularUrl ? 'BagRegular, Montserrat, Helvetica Neue, sans-serif' : 'Helvetica Neue, Helvetica, Arial, sans-serif';
      const img = new Image();
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = defaultExistingImage; });
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 1024, 1024);
      const fillTracked = (text: string, x: number, y: number, tracking: number) => {
        const totalW = ctx.measureText(text).width + tracking * Math.max(0, text.length - 1);
        let curX = x - totalW / 2;
        for (const ch of text) { ctx.fillText(ch, curX, y); curX += ctx.measureText(ch).width + tracking; }
      };
      const wrapWords = (text: string, tracking: number, maxWidth: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const word of words) {
          const test = cur ? `${cur} ${word}` : word;
          const w = ctx.measureText(test).width + tracking * Math.max(0, test.length - 1);
          if (w > maxWidth && cur) { lines.push(cur); cur = word; } else { cur = test; }
        }
        if (cur) lines.push(cur);
        return lines;
      };
      const ROASTER_TRACKING = 3; const COFFEE_TRACKING = 4; const maxW = 360; const cx = 512;
      const roasterText = currentCoffee.roaster.toUpperCase();
      const coffeeText  = currentCoffee.name.toUpperCase();
      const shrinkToFit = (baseSize: number, text: string, weight: string, family: string, tracking: number): number => {
        let size = baseSize;
        const longestWord = text.split(' ').reduce((a, b) => (a.length >= b.length ? a : b), '');
        while (size > 10) {
          ctx.font = `${weight} ${size}px ${family}`;
          if (ctx.measureText(longestWord).width + tracking * Math.max(0, longestWord.length - 1) <= maxW) break;
          size -= 1;
        }
        return size;
      };
      const roasterSize = shrinkToFit(52, roasterText, '700', boldFamily, ROASTER_TRACKING);
      const coffeeSize  = shrinkToFit(Math.round(roasterSize * 0.58), coffeeText, '400', regularFamily, COFFEE_TRACKING);
      const roasterDecl = `700 ${roasterSize}px ${boldFamily}`;
      const coffeeDecl  = `400 ${coffeeSize}px ${regularFamily}`;
      ctx.font = roasterDecl; const roasterLines = wrapWords(roasterText, ROASTER_TRACKING, maxW);
      ctx.font = coffeeDecl;  const coffeeLines  = wrapWords(coffeeText,  COFFEE_TRACKING,  maxW);
      const roasterLineH = Math.round(roasterSize * 1.1); const coffeeLineH = Math.round(coffeeSize * 1.3);
      const blockGap = Math.round(roasterSize * 0.55);
      const roasterBlockH = roasterSize + (roasterLines.length - 1) * roasterLineH;
      const coffeeBlockH  = coffeeSize  + (coffeeLines.length  - 1) * coffeeLineH;
      const totalH = roasterBlockH + blockGap + coffeeBlockH;
      const blockTop = 512 - totalH / 2;
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#000000'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = roasterDecl;
      roasterLines.forEach((line, i) => fillTracked(line, cx, blockTop + roasterSize + i * roasterLineH, ROASTER_TRACKING));
      ctx.font = coffeeDecl;
      const coffeeStartY = blockTop + roasterBlockH + blockGap + coffeeSize;
      coffeeLines.forEach((line, i) => fillTracked(line, cx, coffeeStartY + i * coffeeLineH, COFFEE_TRACKING));
      ctx.globalCompositeOperation = 'source-over';
      setGeneratedImage(canvas.toDataURL('image/png'));
      toast.success('Image generated!');
    } catch {
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOverlayImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setOverlayUploadedImage(dataUrl);
      await handleGenerateWithOverlayImage(dataUrl);
    };
    reader.readAsDataURL(file);
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ roaster: currentCoffee.roaster, coffeeName: currentCoffee.name, referenceImage: refImage, mode: 'text-overlay', customPrompt }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGeneratedImage(data.imageUrl);
      toast.success('Image generated!');
    } catch {
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading coffees...</p>
        </div>
      </div>
    );
  }

  // ─── Shared layout shell ───────────────────────────────────────────────────

  const currentCoffee = !isDefaultStep ? uniqueCoffees[currentIndex] : null;
  const currentKey = currentCoffee ? `${currentCoffee.roaster}|${currentCoffee.name}` : null;
  const currentExistingImage = currentKey ? existingImages.get(currentKey) ?? null : null;
  // Top panel = current/existing image for this step
  const topImage = isDefaultStep ? defaultExistingImage : currentExistingImage;
  // Bottom panel = newly generated image
  const bottomImage = generatedImage;

  const coffeePhotos = currentCoffee
    ? [...new Set(coffees.filter(c => c.roaster === currentCoffee.roaster && c.name === currentCoffee.name).flatMap(c => c.imageUrls ?? []))]
    : [];

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-none">
        <div className="text-sm font-semibold text-gray-900">
          {viewMode === 'grid' ? `All Bags (${uniqueCoffees.length})` : isDefaultStep ? 'Default' : `Coffee ${currentIndex + 1} / ${uniqueCoffees.length}`}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-md border border-gray-200 overflow-hidden divide-x divide-gray-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === 'edit' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          <button
            onClick={() => { _cachedUniqueCoffees = null; _cachedExistingImages = null; _cachedDefaultImage = null; onClose(); }}
            className="p-1.5 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* ── Grid view ──────────────────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {uniqueCoffees.map((coffee) => {
              const key = `${coffee.roaster}|${coffee.name}`;
              const img = existingImages.get(key) ?? defaultExistingImage;
              return (
                <button
                  key={key}
                  onClick={() => {
                    const idx = uniqueCoffees.findIndex(c => `${c.roaster}|${c.name}` === key);
                    if (idx !== -1) {
                      setCurrentIndex(idx);
                      setIsDefaultStep(false);
                      resetPerCoffeeState();
                      setViewMode('edit');
                    }
                  }}
                  className="group text-left rounded-lg overflow-hidden border border-gray-200 bg-white hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                >
                  {/* Square image area */}
                  <div className="relative w-full bg-gray-100" style={{ paddingBottom: '100%' }}>
                    {img ? (
                      <img
                        src={img}
                        alt={`${coffee.roaster} ${coffee.name}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-gray-300">No image</span>
                      </div>
                    )}
                    {!existingImages.get(key) && (
                      <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1 py-0.5 rounded">
                        default
                      </div>
                    )}
                  </div>
                  {/* Label */}
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] font-medium text-gray-700 leading-tight truncate">{coffee.roaster}</p>
                    <p className="text-[11px] text-gray-400 leading-tight truncate">{coffee.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Body (edit mode only) ──────────────────────────────────────────── */}
      {viewMode === 'edit' && <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>

        {/* Left: controls */}
        <div style={{ flex: '1 1 0', overflowY: 'auto' }} className="p-6 pb-10 space-y-2">

          {isDefaultStep ? (
            <>
              {/* Default step description */}
              <p className="text-sm text-gray-500">
                This image is shown for coffees without their own bag photo.
              </p>

              {/* Existing warning */}
              {defaultExistingImage && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  ⚠️ A default image already exists. Saving will replace it.
                </p>
              )}

              {/* Reference upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference Photo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                {uploadedImage ? (
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                    <img src={uploadedImage} alt="Reference" className="w-12 h-16 object-contain rounded flex-none" />
                    <label className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      Change image
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload a reference bag image</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</p>
                  </label>
                )}
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Prompt <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Append extra instructions to the default generation prompt..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          ) : (
            <>
              {/* Coffee meta */}
              <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-1">
                <p className="text-base font-semibold text-gray-900">{currentCoffee?.roaster}</p>
                <p className="text-sm text-gray-700">{currentCoffee?.name}</p>
                {currentCoffee && currentCoffee.owners.length > 0 && (
                  <p className="text-sm text-gray-500">
                    User: {currentCoffee.owners.join(', ')}
                  </p>
                )}
                {currentCoffee?.region && <p className="text-sm text-gray-500">Region: {currentCoffee.region}</p>}
                {currentCoffee?.roastLevel && <p className="text-sm text-gray-500">Roast: {currentCoffee.roastLevel}</p>}
                {currentCoffee?.notes && <p className="text-sm text-gray-500">Notes: {toTitleCase(currentCoffee.notes)}</p>}
                {currentExistingImage && (
                  <p className="text-xs text-amber-600 pt-1">⚠️ This coffee already has an image. Generating replaces it.</p>
                )}
              </div>

              {/* AI generation — upload bag photo */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Generate from Bag Photo</p>
                {uploadedImage ? (
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                    <img src={uploadedImage} alt="Uploaded" className="w-12 h-16 object-contain rounded flex-none" />
                    <label className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      Change image
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <Upload className="w-7 h-7 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload a bag photo</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</p>
                  </label>
                )}
              </div>

              {/* Separator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 flex-none">or add text overlay</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Default bag option */}
              {defaultExistingImage && !defaultBagSelected && (
                <button
                  onClick={() => setDefaultBagSelected(true)}
                  disabled={isGenerating}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left disabled:opacity-50 cursor-pointer"
                >
                  <img src={defaultExistingImage} alt="Default bag" className="w-10 h-14 object-contain rounded flex-none" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">Use Default Bag + Add Text</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      Add "{currentCoffee?.roaster}" and "{currentCoffee?.name}" in a minimalist font
                    </p>
                  </div>
                </button>
              )}
              {defaultExistingImage && defaultBagSelected && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
                  <div className="flex items-center gap-4">
                    <img src={defaultExistingImage} alt="Default bag" className="w-10 h-14 object-contain rounded flex-none" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Use Default Bag + Add Text</p>
                    </div>
                    <button onClick={() => setDefaultBagSelected(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Upload own image + text overlay */}
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
                <p className="text-sm font-medium text-gray-800 mb-3">Use Your Bag Photo + Add Text</p>
                {coffeePhotos.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {coffeePhotos.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => handleGenerateWithOverlayImage(url)}
                        disabled={isGenerating}
                        className="relative rounded overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors disabled:opacity-50 cursor-pointer flex-none"
                        title="Use this photo"
                      >
                        <img src={url} alt={`Bag photo ${i + 1}`} className="w-14 h-20 object-cover" />
                        {isGenerating && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <label className={`flex items-center gap-2 cursor-pointer w-fit ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                  <input type="file" accept="image/*" onChange={handleOverlayImageUpload} className="hidden" disabled={isGenerating} />
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                    <Upload className="w-3.5 h-3.5" />
                    {coffeePhotos.length > 0 ? 'Upload a different photo' : 'Upload a photo'}
                  </div>
                </label>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Additional Prompt <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Extra instructions appended to whichever generation method you use..."
                  className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Right: two static image panels */}
        <div style={{ width: '25%', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid #e5e7eb', backgroundColor: 'white' }}>

          {/* Top half: current / existing image */}
          <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: '1px solid #f3f4f6' }}>
            <p className="text-xs text-gray-400 uppercase tracking-wide" style={{ flexShrink: 0, padding: '16px 16px 8px' }}>Current</p>
            <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', padding: '0 16px 16px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {topImage ? (
                  <img
                    src={topImage}
                    alt="Current image"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <p className="text-xs text-gray-300 text-center px-4">No current image</p>
                )}
              </div>
            </div>
          </div>

          {/* Bottom half: generated image */}
          <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <p className="text-xs text-gray-400 uppercase tracking-wide" style={{ flexShrink: 0, padding: '16px 16px 8px' }}>Generated</p>
            <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', padding: '0 16px 16px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {bottomImage ? (
                  <img
                    src={bottomImage}
                    alt="Generated image"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <p className="text-xs text-gray-300 text-center px-4">Generated image will appear here</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>}

      {/* ── Footer (edit mode only) ────────────────────────────────────────── */}
      {viewMode === 'edit' && <div className="flex items-center justify-between px-6 bg-white border-t border-gray-200 flex-none" style={{ height: '56px' }}>
        {/* Left: previous */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goBack} disabled={isAtStart} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
        </div>

        {/* Center: primary actions — fixed height, no layout shift */}
        <div className="flex items-center gap-2 h-full">
          {isDefaultStep ? (
            <>
              <Button onClick={handleGenerateDefault} disabled={isGenerating} className="cursor-pointer">
                {isGenerating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</> : generatedImage ? 'Regenerate' : 'Generate Image'}
              </Button>
              {generatedImage && (
                <Button variant="outline" onClick={handleSaveDefault} className="cursor-pointer">
                  <Check className="w-4 h-4 mr-2" />
                  Save Default
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={defaultBagSelected ? handleGenerateWithDefaultBag : handleGenerate}
                disabled={isGenerating || (!uploadedImage && !defaultBagSelected)}
                className="cursor-pointer"
              >
                {isGenerating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</> : generatedImage ? 'Regenerate' : 'Generate Image'}
              </Button>
              {generatedImage && (
                <Button variant="outline" onClick={handleSave} className="cursor-pointer">
                  <Check className="w-4 h-4 mr-2" />
                  Save
                </Button>
              )}
            </>
          )}
        </div>

        {/* Right: next */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goForward} disabled={isAtEnd} className="cursor-pointer">
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>}
    </div>
  );
}
