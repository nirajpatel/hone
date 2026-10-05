import { EspressoLoading } from '../EspressoLoading';
import { MarkTraceLoading } from './MarkTraceLoading';
import { ScaleLoading } from './ScaleLoading';

export type LoaderVariant = 'scale' | 'scale-white' | 'trace' | 'espresso';

const VARIANTS: LoaderVariant[] = ['scale', 'scale-white', 'trace', 'espresso'];
const STORAGE_KEY = 'hone-loader';
const DEFAULT_VARIANT: LoaderVariant = 'scale';

export const isScaleVariant = (variant: LoaderVariant) => variant === 'scale' || variant === 'scale-white';

/** `?loader=scale|scale-white|trace|espresso` picks a loader and remembers it on this device. */
export function getLoaderVariant(): LoaderVariant {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('loader') as LoaderVariant | null;
    if (fromUrl && VARIANTS.includes(fromUrl)) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(STORAGE_KEY) as LoaderVariant | null;
    if (saved && VARIANTS.includes(saved)) return saved;
  } catch {
    // Storage unavailable — use the default.
  }
  return DEFAULT_VARIANT;
}

export function AppLoader({ variant }: { variant: LoaderVariant }) {
  if (variant === 'espresso') return <EspressoLoading />;
  if (isScaleVariant(variant)) return <ScaleLoading />;
  return <MarkTraceLoading />;
}
