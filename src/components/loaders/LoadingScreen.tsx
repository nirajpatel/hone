import { AppNavBrand } from '../AppNavBrand';
import { AppLoader, LoaderVariant } from './AppLoader';

// Matches the dashboard nav's row height (set by its h-9 buttons) so the bar doesn't shift when the app appears.
const NAV_ROW_HEIGHT = 36;

export function LoadingScreen({ variant }: { variant: LoaderVariant }) {
  const white = variant === 'scale-white';

  if (variant === 'trace' || variant === 'espresso') {
    return (
      <div className="bg-gray-50 flex items-center justify-center" style={{ height: '100dvh' }}>
        <AppLoader variant={variant} />
      </div>
    );
  }

  return (
    <div className={`${white ? 'bg-white' : 'bg-gray-50'} flex flex-col`} style={{ height: '100dvh' }}>
      <nav
        className={white ? 'bg-white' : 'bg-white border-b border-gray-200'}
        style={white ? { borderBottom: '1px solid transparent' } : undefined}
      >
        <div className="px-3 md:px-6 py-4">
          <div className="flex items-center" style={{ minHeight: NAV_ROW_HEIGHT }}>
            <AppNavBrand />
          </div>
        </div>
      </nav>
      <div className="flex-1 flex items-center justify-center">
        <AppLoader variant={variant} />
      </div>
    </div>
  );
}
