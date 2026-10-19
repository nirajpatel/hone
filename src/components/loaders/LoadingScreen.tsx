import { AppNavBrand } from '../AppNavBrand';
import { AppLoader, LoaderVariant } from './AppLoader';
import { DashboardSkeleton } from './DashboardSkeleton';

// Matches the dashboard nav's row height (set by its h-9 buttons) so the bar doesn't shift when the app appears.
const NAV_ROW_HEIGHT = 36;
const NAV_HEIGHT = NAV_ROW_HEIGHT + 2 * 16 + 1; // row + py-4 + bottom border

// Routes that land on the brews dashboard once loading finishes (sign-in callbacks redirect to /).
const DASHBOARD_ROUTES = ['/', '/login', '/auth/confirm'];

export function LoadingScreen({ variant }: { variant: LoaderVariant }) {
  if (variant === 'skeleton') {
    if (DASHBOARD_ROUTES.includes(window.location.pathname) || window.location.pathname === '/loader-preview') {
      return <DashboardSkeleton />;
    }
    return <NavOnly />;
  }

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
      {/* Bottom padding mirrors the nav so the loader sits at the center of the screen, not of the space below the nav. */}
      <div className="flex-1 flex items-center justify-center" style={{ paddingBottom: NAV_HEIGHT }}>
        <AppLoader variant={variant} />
      </div>
    </div>
  );
}

/** Pages other than the dashboard get just the nav, since a brews skeleton would be the wrong shape. */
function NavOnly() {
  return (
    <div className="bg-gray-50" style={{ height: '100dvh' }}>
      <nav className="bg-white border-b border-gray-200">
        <div className="px-3 md:px-6 py-4">
          <div className="flex items-center" style={{ minHeight: NAV_ROW_HEIGHT }}>
            <AppNavBrand />
          </div>
        </div>
      </nav>
    </div>
  );
}
