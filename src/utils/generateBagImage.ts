import { projectId, publicAnonKey } from './supabase/info';

const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;

/**
 * Generates a coffee bag image by overlaying roaster + coffee name text
 * onto the default bag template using client-side canvas rendering.
 * Returns a PNG data URL, or null if the default bag image isn't available.
 */
export async function generateDefaultBagImage(
  roaster: string,
  coffeeName: string
): Promise<string | null> {
  // Fetch the default bag template
  let defaultImageUrl: string | null = null;
  try {
    const res = await fetch(
      `${apiUrl}/coffee-representative-image?roaster=__default__&coffeeName=__default__`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } }
    );
    if (res.ok) {
      const data = await res.json();
      defaultImageUrl = data.imageUrl ?? null;
    }
  } catch {
    return null;
  }

  if (!defaultImageUrl) return null;

  // Load fonts
  const loadFontUrl = async (weight: number): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://fonts.googleapis.com/css2?family=Montserrat:wght@${weight}`
      );
      const css = await res.text();
      const match = css.match(/url\(([^)]+\.woff2)\)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const [boldUrl, regularUrl] = await Promise.all([
    loadFontUrl(700),
    loadFontUrl(400),
  ]);

  const loadFace = async (name: string, url: string | null) => {
    if (!url) return;
    try {
      const face = new FontFace(name, `url(${url})`);
      await face.load();
      document.fonts.add(face);
    } catch {
      /* fallback to system fonts */
    }
  };

  await Promise.all([
    loadFace('BagBold', boldUrl),
    loadFace('BagRegular', regularUrl),
  ]);

  const boldFamily = boldUrl
    ? 'BagBold, Montserrat, Helvetica Neue, sans-serif'
    : 'Helvetica Neue, Helvetica, Arial, sans-serif';
  const regularFamily = regularUrl
    ? 'BagRegular, Montserrat, Helvetica Neue, sans-serif'
    : 'Helvetica Neue, Helvetica, Arial, sans-serif';

  // Load the default bag image onto canvas
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = defaultImageUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 1024, 1024);

  // Text rendering helpers
  const fillTracked = (text: string, x: number, y: number, tracking: number) => {
    const totalW =
      ctx.measureText(text).width + tracking * Math.max(0, text.length - 1);
    let curX = x - totalW / 2;
    for (const ch of text) {
      ctx.fillText(ch, curX, y);
      curX += ctx.measureText(ch).width + tracking;
    }
  };

  const wrapWords = (text: string, tracking: number, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      const w =
        ctx.measureText(test).width + tracking * Math.max(0, test.length - 1);
      if (w > maxWidth && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const ROASTER_TRACKING = 3;
  const COFFEE_TRACKING = 4;
  const maxW = 360;
  const cx = 512;

  const roasterText = roaster.toUpperCase();
  const coffeeText = coffeeName.toUpperCase();

  const shrinkToFit = (
    baseSize: number,
    text: string,
    weight: string,
    family: string,
    tracking: number
  ): number => {
    let size = baseSize;
    const longestWord = text
      .split(' ')
      .reduce((a, b) => (a.length >= b.length ? a : b), '');
    while (size > 10) {
      ctx.font = `${weight} ${size}px ${family}`;
      if (
        ctx.measureText(longestWord).width +
          tracking * Math.max(0, longestWord.length - 1) <=
        maxW
      )
        break;
      size -= 1;
    }
    return size;
  };

  const roasterSize = shrinkToFit(52, roasterText, '700', boldFamily, ROASTER_TRACKING);
  const coffeeSize = shrinkToFit(
    Math.round(roasterSize * 0.58),
    coffeeText,
    '400',
    regularFamily,
    COFFEE_TRACKING
  );

  const roasterDecl = `700 ${roasterSize}px ${boldFamily}`;
  const coffeeDecl = `400 ${coffeeSize}px ${regularFamily}`;

  ctx.font = roasterDecl;
  const roasterLines = wrapWords(roasterText, ROASTER_TRACKING, maxW);
  ctx.font = coffeeDecl;
  const coffeeLines = wrapWords(coffeeText, COFFEE_TRACKING, maxW);

  const roasterLineH = Math.round(roasterSize * 1.1);
  const coffeeLineH = Math.round(coffeeSize * 1.3);
  const blockGap = Math.round(roasterSize * 0.55);
  const roasterBlockH = roasterSize + (roasterLines.length - 1) * roasterLineH;
  const coffeeBlockH = coffeeSize + (coffeeLines.length - 1) * coffeeLineH;
  const totalH = roasterBlockH + blockGap + coffeeBlockH;
  const blockTop = 512 - totalH / 2;

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.font = roasterDecl;
  roasterLines.forEach((line, i) =>
    fillTracked(line, cx, blockTop + roasterSize + i * roasterLineH, ROASTER_TRACKING)
  );

  ctx.font = coffeeDecl;
  const coffeeStartY = blockTop + roasterBlockH + blockGap + coffeeSize;
  coffeeLines.forEach((line, i) =>
    fillTracked(line, cx, coffeeStartY + i * coffeeLineH, COFFEE_TRACKING)
  );

  ctx.globalCompositeOperation = 'source-over';

  return canvas.toDataURL('image/png');
}

/**
 * Checks if a representative image already exists for a roaster + coffee name.
 */
export async function hasRepresentativeImage(
  roaster: string,
  coffeeName: string
): Promise<boolean> {
  try {
    const normRoaster = roaster.trim().toLowerCase();
    const normName = coffeeName.trim().toLowerCase();
    const res = await fetch(
      `${apiUrl}/coffee-representative-image?roaster=${encodeURIComponent(normRoaster)}&coffeeName=${encodeURIComponent(normName)}`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } }
    );
    if (res.ok) {
      const data = await res.json();
      return !!data.imageUrl;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Saves a representative image (data URL) for a roaster + coffee name.
 */
export async function saveRepresentativeImage(
  roaster: string,
  coffeeName: string,
  imageDataUrl: string
): Promise<boolean> {
  try {
    const normRoaster = roaster.trim().toLowerCase();
    const normName = coffeeName.trim().toLowerCase();
    const res = await fetch(`${apiUrl}/coffee-representative-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({
        roaster: normRoaster,
        coffeeName: normName,
        imageUrl: imageDataUrl,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
