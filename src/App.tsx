import { useState, useEffect, useRef } from 'react';
import { Brew, Coffee, User, BrewMethod, Equipment, CoffeeTemperature, BrewStage } from './types';
import { BrewDetail } from './components/BrewDetail';
import { CoffeeDetail } from './components/CoffeeDetail';
import { NewBrewFlow } from './components/NewBrewFlow';
import { AddCoffeeForm } from './components/AddCoffeeForm';
import { QRCodeDialog } from './components/QRCodeDialog';
import { LandingPage } from './components/LandingPage';
import { SignInPage } from './components/SignInPage';
import { BrewsTableView } from './components/BrewsTableView';
import { BrewsTimelineView } from './components/BrewsTimelineView';
import { CoffeesShelvesView, setRepImageCacheEntry } from './components/CoffeesShelvesView';
import { generateDefaultBagImage, hasRepresentativeImage, saveRepresentativeImage } from './utils/generateBagImage';
import { CoffeesTableView } from './components/CoffeesTableView';
import { CoffeesToolbar } from './components/CoffeesToolbar';
import { Profile } from './components/Profile';
import { EquipmentDialog } from './components/EquipmentDialog';
import { EspressoLoading } from './components/EspressoLoading';
import { Terms } from './components/Terms';
import { Privacy } from './components/Privacy';
import { A2POptInProof } from './components/A2POptInProof';
import { CoffeeBagImageFlow } from './components/CoffeeBagImageFlow';
import { AliasesManager } from './components/AliasesManager';
import { Feed } from './components/Feed';
import { UserProfileDialog } from './components/UserProfileDialog';
import { FeedbackDialog } from './components/FeedbackDialog';
import { BrewEquipmentIcon } from './components/icons/BrewEquipmentIcon';
import { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { Button } from './components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from './components/ui/sheet';
import coffeeBeansImage from './assets/coffee-beans.webp';
import honeLogo from './assets/hone-logo.svg';
import { capitalizeBrewMethod, getRatingDisplay } from './utils/formatters';
import { getAllBrewMethodConfigs } from './utils/brewMethods';
import { Coffee as CoffeeIcon, Plus, LogOut, Link2, ImageIcon } from 'lucide-react';
import { MoreVertical, User as UserIcon, QrCode, Pencil, Trash2, Menu, Coffee, List, Settings, X, LayoutGrid, Table as TableIcon, MessageSquare } from 'lucide-react';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { toast, Toaster } from 'sonner@2.0.3';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/ui/tooltip';
import { SimpleTooltip } from './components/ui/simple-tooltip';
import { supabase } from './utils/supabase/client';
import { sanitizeErrorMessage } from './utils/errorHandling';
import { fetchWithRetry } from './utils/fetchWithRetry';

export default function App() {
  const [brews, setBrews] = useState<Brew[]>([]);
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [allCoffees, setAllCoffees] = useState<Coffee[]>([]);
  const [allCoffeesLoading, setAllCoffeesLoading] = useState(false);
  const [selectedCoffeeSiblings, setSelectedCoffeeSiblings] = useState<Coffee[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedBrew, setSelectedBrew] = useState<Brew | null>(null);
  const [scrollToGuidance, setScrollToGuidance] = useState(false);
  const [selectedCoffee, setSelectedCoffee] = useState<Coffee | null>(null);
  const [showNewBrew, setShowNewBrew] = useState(false);
  const [showAddCoffee, setShowAddCoffee] = useState(false);
  const [activeView, setActiveView] = useState<'brews' | 'coffees' | 'profile'>('brews');
  const [filterMethod, setFilterMethod] = useState<BrewMethod | 'all'>('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [duplicateBrewData, setDuplicateBrewData] = useState<Brew | null>(null);
  const [duplicateCoffeeData, setDuplicateCoffeeData] = useState<Coffee | null>(null);
  const [prefilledCoffeeId, setPrefilledCoffeeId] = useState<string | null>(null);
  const [prefilledBrewMethod, setPrefilledBrewMethod] = useState<BrewMethod | null>(null);
  const [editingCoffee, setEditingCoffee] = useState<Coffee | null>(null);
  const [editingBrew, setEditingBrew] = useState<Brew | null>(null);
  const [qrCodeCoffee, setQrCodeCoffee] = useState<Coffee | null>(null);
  const [deletingBrewId, setDeletingBrewId] = useState<string | null>(null);
  const [deletingCoffeeId, setDeletingCoffeeId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [groupBy, setGroupBy] = useState<'month' | 'coffee'>('month');
  const [showProfile, setShowProfile] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showAliases, setShowAliases] = useState(false);
  const [showBagImages, setShowBagImages] = useState(false);
  const [hoveredBrewRating, setHoveredBrewRating] = useState<{ id: string, rating: number } | null>(null);
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
  const [equipmentChangeCounter, setEquipmentChangeCounter] = useState(0);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [coffeesView, setCoffeesView] = useState<'shelf' | 'table'>('shelf');
  const [brewsView, setBrewsView] = useState<'table' | 'timeline'>('timeline');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [aliases, setAliases] = useState<{ roasterAliases: Record<string, string>; coffeeNameAliases: Record<string, string> }>({ roasterAliases: {}, coffeeNameAliases: {} });
  const [isFeedbackHovered, setIsFeedbackHovered] = useState(false);

  const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;

  // Helper to get fresh access token from Supabase (handles auto-refresh)
  const getAccessToken = async (): Promise<string | null> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return session?.access_token || null;
  };

  // Stable refs so the onAuthStateChange listener always calls the latest functions
  const checkAuthRef = useRef<() => Promise<void>>(null!);
  const createOrGetUserRef = useRef<(token: string) => Promise<void>>(null!);

  // Refresh data when app resumes from iOS home screen frozen state.
  // Use getSession() only — do NOT call refreshSession() here. Forcing refresh on tab focus
  // can race with Supabase's autoRefreshToken and trigger "Refresh Token Not Found" (e.g. when
  // the server has already rotated the token), logging the user out.
  const isRefreshingRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Skip refresh for the first 3s after load so we don't run it on reload and sign out on transient errors
      if (Date.now() - mountTimeRef.current < 3000) return;
      if (document.visibilityState === 'visible' && currentUser && accessToken && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error || !session?.access_token) {
            // Session missing or error — don't force refresh; let autoRefreshToken or next navigation handle it
            return;
          }
          setAccessToken(session.access_token);
          fetchData(session.access_token);
        } finally {
          isRefreshingRef.current = false;
        }
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [currentUser, accessToken]);

  // Version check - poll server for updates every 30 seconds
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch(`${apiUrl}/version`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (res.ok) {
          const { version: serverVersion } = await res.json();
          setServerVersion(serverVersion);
          const storedVersion = localStorage.getItem('app_version');
          
          // Show banner if server version doesn't match stored version
          if (!storedVersion || storedVersion !== serverVersion) {
            // Automatically update localStorage with new version
            localStorage.setItem('app_version', serverVersion);
            setShowUpdateBanner(true);
          } else {
            setShowUpdateBanner(false);
          }
        }
      } catch (error) {
        // Silently fail - don't show error for version check
        console.log('Version check failed:', error);
      }
    };

    // Check immediately on mount
    checkVersion();
    
    // Then check every 30 seconds
    const interval = setInterval(checkVersion, 30000);
    
    return () => clearInterval(interval);
  }, [apiUrl]);

  // SMS reminder checker - disabled (notification checks turned off)
  // useEffect(() => {
  //   if (!currentUser) return;
  //   const checkReminders = async () => {
  //     try {
  //       await fetch(`${apiUrl}/check-reminders`, { headers: { 'Authorization': `Bearer ${publicAnonKey}` } });
  //     } catch (error) { /* Silently fail */ }
  //   };
  //   checkReminders();
  //   const interval = setInterval(checkReminders, 60000);
  //   return () => clearInterval(interval);
  // }, [apiUrl, currentUser]);

  useEffect(() => {
    // Set document title and meta tags
    document.title = 'Hone – Designed for Better Coffee';
    
    // Set favicon and apple-touch-icon to Hone logo
    const existingFavicon = document.querySelector("link[rel='icon']");
    if (existingFavicon) existingFavicon.remove();
    const favicon = document.createElement('link');
    favicon.setAttribute('rel', 'icon');
    favicon.setAttribute('href', '/favicon.png?v=2');
    favicon.setAttribute('type', 'image/png');
    document.head.appendChild(favicon);

    const existingAppleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (existingAppleIcon) existingAppleIcon.remove();
    const appleIcon = document.createElement('link');
    appleIcon.setAttribute('rel', 'apple-touch-icon');
    appleIcon.setAttribute('href', '/favicon.png?v=2');
    document.head.appendChild(appleIcon);

    // Update or create meta tags for social media
    const updateMetaTag = (property: string, content: string, useProperty = false) => {
      let meta: HTMLMetaElement | null = null;
      
      if (useProperty || property.startsWith('og:')) {
        meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', property);
          document.head.appendChild(meta);
        }
      } else {
        meta = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', property);
          document.head.appendChild(meta);
        }
      }
      meta.setAttribute('content', content);
    };

    // Standard meta tags
    updateMetaTag('description', 'Track your brews, analyze patterns, and get personalized guidance to brew better coffee – every time.');
    
    // Open Graph tags (use property attribute)
    updateMetaTag('og:type', 'website', true);
    updateMetaTag('og:title', 'Hone – Designed for Better Coffee', true);
    updateMetaTag('og:description', 'Track brews. Learn from your data. Get personalized guidance for better coffee.', true);
    updateMetaTag('og:url', 'https://hone.coffee', true);
    updateMetaTag('og:site_name', 'Hone', true);
    updateMetaTag('og:image', `${typeof window !== 'undefined' ? window.location.origin : 'https://hone.coffee'}/og-image.png`, true);

    // Twitter Card tags (use name attribute)
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', 'Hone – Designed for Better Coffee');
    updateMetaTag('twitter:description', 'Log brews, analyze patterns, and get personalized guidance to brew better coffee.');
    updateMetaTag('twitter:image', `${typeof window !== 'undefined' ? window.location.origin : 'https://hone.coffee'}/og-image.png`);

    // Theme and app meta tags (use name attribute)
    updateMetaTag('theme-color', '#000000');
    updateMetaTag('apple-mobile-web-app-title', 'Hone');
    updateMetaTag('application-name', 'Hone');
    updateMetaTag('mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-capable', 'yes'); // Keep for iOS compatibility
    updateMetaTag('apple-mobile-web-app-status-bar-style', 'default');
    
    // SEO meta tags
    updateMetaTag('robots', 'index, follow');
    
    // Canonical link
    let canonicalLink = document.querySelector("link[rel='canonical']") as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://hone.coffee');
  }, []);

  useEffect(() => {
    // Handle route changes
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };

    // Check route on mount and when pathname changes
    const checkRoute = () => {
      setCurrentRoute(window.location.pathname);
    };

    // Check immediately
    checkRoute();

    // Listen for popstate (back/forward)
    window.addEventListener('popstate', handlePopState);
    
    // Poll for route changes (for direct navigation)
    const interval = setInterval(checkRoute, 100);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, []);

  // Redirect from /login to / when user becomes authenticated
  useEffect(() => {
    if (currentUser && currentRoute === '/login') {
      window.history.pushState({}, '', '/');
      setCurrentRoute('/');
    }
  }, [currentUser, currentRoute]);

  const ADMIN_EMAIL = 'niraj.patel.09@gmail.com';

  // Admin: fetch all coffees when Bag Images is opened
  useEffect(() => {
    if (!showBagImages || !currentUser || !accessToken) return;
    if (currentUser.email !== ADMIN_EMAIL) return;
    if (allCoffees.length > 0) return;

    const fetchAllCoffees = async () => {
      setAllCoffeesLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(`${apiUrl}/coffees/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setAllCoffees(await res.json());
      } catch (e) {
        console.error('Failed to fetch all coffees', e);
      } finally {
        setAllCoffeesLoading(false);
      }
    };

    fetchAllCoffees();
  }, [showBagImages, currentUser, accessToken]);

  // Fetch aliases for canonical coffee matching (brew nav, same as backend/bag images)
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/aliases`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then((res) => (res.ok ? res.json() : { roasterAliases: {}, coffeeNameAliases: {} }))
      .then((data) => {
        if (!cancelled) setAliases({ roasterAliases: data.roasterAliases ?? {}, coffeeNameAliases: data.coffeeNameAliases ?? {} });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiUrl]);

  useEffect(() => {
    checkAuthRef.current();
    
    // Set up auth state listener — uses refs to always call the latest function versions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (window.location.pathname === '/auth/confirm') {
        return;
      }
      
      if (event === 'INITIAL_SESSION' && session?.access_token) {
        setAccessToken(session.access_token);
        await createOrGetUserRef.current(session.access_token);
        setLoading(false);
        setAuthChecked(true);
      } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        setAccessToken(session.access_token);
      } else if (event === 'SIGNED_IN' && session?.access_token) {
        setAccessToken(session.access_token);
        await createOrGetUserRef.current(session.access_token);
        if (window.location.pathname === '/login') {
          window.history.pushState({}, '', '/');
          setCurrentRoute('/');
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setAccessToken(null);
        setLoading(false);
        setAuthChecked(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      // Skip error handling if we're on /login route (let SignInPage handle it)
      const isLoginRoute = window.location.pathname === '/login';
      const isAuthConfirmRoute = window.location.pathname === '/auth/confirm';
      
      // Check for OAuth errors in URL
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      const error = urlParams.get('error') || hashParams.get('error');
      const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
      
      if (error && !isLoginRoute && !isAuthConfirmRoute) {
        const sanitizedError = sanitizeErrorMessage({ message: errorDescription || error, code: error }, 'Sign in failed. Please try again.');
        toast.error(sanitizedError);
        setLoading(false);
        setAuthChecked(true);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      // If on login route and there's an error, let SignInPage handle it
      if (error && isLoginRoute) {
        setLoading(false);
        setAuthChecked(true);
        return;
      }
      
      // Handle /auth/confirm route for PKCE magic link verification
      if (isAuthConfirmRoute) {
        const tokenHash = urlParams.get('token_hash');
        const type = urlParams.get('type');
        const redirectTo = urlParams.get('redirect_to');
        
        if (tokenHash && type === 'email') {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'email',
          });
          
          if (verifyError) {
            console.error('Magic link verification error:', verifyError);
            toast.error(sanitizeErrorMessage(verifyError, 'Failed to verify magic link. Please try again.'));
            // Clear URL params and redirect to login
            window.history.replaceState({}, '', '/login');
            setCurrentRoute('/login');
            setLoading(false);
            setAuthChecked(true);
            return;
          }
          
          // Wait for session to be established
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verify session was created
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (session?.access_token) {
            // Session established - set auth state first
            setAccessToken(session.access_token);
            await createOrGetUser(session.access_token);
            
            // Extract target path from redirect_to, default to root
            let targetPath = '/';
            if (redirectTo) {
              try {
                const redirectUrl = new URL(redirectTo);
                targetPath = redirectUrl.pathname || '/';
              } catch (e) {
                // If redirectTo is not a full URL, treat it as a path
                targetPath = redirectTo.startsWith('/') ? redirectTo : '/';
              }
            }
            
            // Clear URL params and navigate to target path
            window.history.replaceState({}, '', targetPath);
            setCurrentRoute(targetPath);
            setAuthChecked(true);
            setLoading(false);
            return;
          } else {
            // Session not established - redirect to login
            console.error('Session not established after verification');
            window.history.replaceState({}, '', '/login');
            setCurrentRoute('/login');
            setLoading(false);
            setAuthChecked(true);
            return;
          }
        } else {
          console.error('Missing token_hash or invalid type in /auth/confirm');
          toast.error('Invalid magic link');
          window.history.replaceState({}, '', '/login');
          setCurrentRoute('/login');
          setLoading(false);
          setAuthChecked(true);
          return;
        }
      }
      
      // Check if we have an auth code or tokens in the URL
      const code = urlParams.get('code');
      const accessToken = hashParams.get('access_token');
      
      // If we have a code or token, wait for Supabase to process it
      if (code || accessToken) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Check for session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        setAccessToken(session.access_token);
        await createOrGetUser(session.access_token);
        // Redirect from /login to root after successful sign-in
        if (window.location.pathname === '/login') {
          window.history.pushState({}, '', '/');
          setCurrentRoute('/');
        } else {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setAuthChecked(true);
        return;
      }
      
      setLoading(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('Error checking auth:', error);
      toast.error('Something went wrong. Please refresh and try again.');
      setLoading(false);
      setAuthChecked(true);
    }
  };

  const createOrGetUser = async (token: string) => {
    try {
      const res = await fetch(`${apiUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const userData = await res.json();
        setCurrentUser(userData);
        await fetchData(token);
      } else {
        const errorData = await res.json().catch(() => ({}));

        if (res.status === 403) {
          await supabase.auth.signOut();
          setCurrentUser(null);
          setAccessToken(null);
          window.history.pushState({}, '', '/login');
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          console.error('Error creating/getting user:', res.status, errorData);
          toast.error('Failed to load your account. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error creating/getting user:', error);
      toast.error('Failed to connect. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  checkAuthRef.current = checkAuth;
  createOrGetUserRef.current = createOrGetUser;

  const fetchData = async (token?: string) => {
    const authToken = token || await getAccessToken() || accessToken;
    if (!authToken) {
      console.error('No access token available');
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [brewsRes, coffeesRes, usersRes, equipmentRes] = await Promise.all([
        fetchWithRetry(`${apiUrl}/brews`, { headers }),
        fetchWithRetry(`${apiUrl}/coffees`, { headers }),
        fetchWithRetry(`${apiUrl}/users`, { headers }),
        fetchWithRetry(`${apiUrl}/equipment`, { headers }),
      ]);

      const anyUnauthorized = [brewsRes, coffeesRes, usersRes, equipmentRes].some(r => r.status === 401 || r.status === 403);
      if (anyUnauthorized) {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setAccessToken(null);
        toast.error('Session expired. Please sign in again.');
        return;
      }

      // Update each resource independently so a single failure doesn't discard the rest
      if (brewsRes.ok) setBrews(await brewsRes.json());
      if (coffeesRes.ok) setCoffees(await coffeesRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (equipmentRes.ok) setEquipment(await equipmentRes.json());

      const failed = [
        !brewsRes.ok && 'brews',
        !coffeesRes.ok && 'beans',
        !usersRes.ok && 'users',
        !equipmentRes.ok && 'equipment',
      ].filter(Boolean);
      if (failed.length > 0) {
        console.error('Failed to fetch:', failed.join(', '));
        toast.error(`Failed to load ${failed.join(', ')}`);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading data');
    }
  };

  const handleAddExtraction = async (brew: Omit<Brew, 'id' | 'createdAt'>) => {
    if (!accessToken) {
      toast.error('Please sign in to create brews');
      return;
    }

    try {
      const freshToken = await getAccessToken();
      if (!freshToken) { toast.error('Session expired. Please sign in again.'); return; }

      // Create a local timestamp string for SMS display (in user's timezone)
      const now = new Date();
      const localTimestamp = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }) + ' at ' + now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });

      // Capture timezone offset in minutes (negative for ahead of UTC, positive for behind)
      // E.g., PST is -480 (UTC-8), EST is -300 (UTC-5), JST is 540 (UTC+9)
      const timezoneOffset = new Date().getTimezoneOffset();

      const res = await fetch(`${apiUrl}/brews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({
          ...brew,
          localTimestamp, // Add local timestamp for SMS display
          timezoneOffset, // Add timezone offset for day boundary calculation
        }),
      });

      if (res.ok) {
        const newBrew = await res.json();
        setBrews([...brews, newBrew]);
        setShowNewBrew(false);
        toast.success('Brew logged');
      } else {
        const error = await res.json().catch(() => ({}));
        console.error('Failed to create brew:', error);
        toast.error(sanitizeErrorMessage(error, 'Failed to log brew'));
      }
    } catch (error) {
      console.error('Error creating brew:', error);
      toast.error(sanitizeErrorMessage(error, 'Something went wrong'));
    }
  };

  const handleUpdateQuality = async (id: string, quality: number | undefined) => {
    if (!accessToken) {
      toast.error('Please sign in to update brews');
      return;
    }

    try {
      const freshToken = await getAccessToken();
      if (!freshToken) { toast.error('Session expired. Please sign in again.'); return; }

      const res = await fetch(`${apiUrl}/brews/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ quality: quality || null }),
      });

      if (res.ok) {
        const updated = await res.json();
        setBrews(brews.map((e) => (e.id === id ? updated : e)));
        setSelectedBrew(null);
        toast.success(quality ? 'Quality updated' : 'Quality cleared');
      } else {
        const error = await res.json().catch(() => ({}));
        console.error('Failed to update brew:', error);
        toast.error(sanitizeErrorMessage(error, 'Failed to update quality'));
      }
    } catch (error) {
      console.error('Error updating brew:', error);
      toast.error(sanitizeErrorMessage(error, 'Something went wrong'));
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    if (!accessToken) {
      toast.error('Please sign in to update brews');
      return;
    }

    try {
      const freshToken = await getAccessToken();
      if (!freshToken) { toast.error('Session expired. Please sign in again.'); return; }

      const res = await fetch(`${apiUrl}/brews/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ tastingNotes: notes || null }),
      });

      if (res.ok) {
        const updated = await res.json();
        setBrews(brews.map((e) => (e.id === id ? updated : e)));
        toast.success('Notes updated successfully');
      } else {
        const error = await res.json().catch(() => ({}));
        console.error('Failed to update notes:', error);
        toast.error(sanitizeErrorMessage(error, 'Failed to update notes'));
      }
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error(sanitizeErrorMessage(error, 'Something went wrong'));
    }
  };

  const handleAddCoffee = async (coffee: Omit<Coffee, 'id' | 'createdAt'>) => {
    if (!accessToken) {
      toast.error('Please sign in to add coffees');
      return;
    }

    try {
      const freshToken = await getAccessToken();
      if (!freshToken) { toast.error('Session expired. Please sign in again.'); return; }

      const res = await fetch(`${apiUrl}/coffees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify(coffee),
      });

      if (res.ok) {
        const newCoffee = await res.json();

        // Generate bag image BEFORE updating coffees state so the shelves
        // effect finds the cache already populated (avoids race condition).
        try {
          const alreadyHasImage = await hasRepresentativeImage(newCoffee.roaster, newCoffee.name);
          if (!alreadyHasImage) {
            const dataUrl = await generateDefaultBagImage(newCoffee.roaster, newCoffee.name);
            if (dataUrl) {
              const saved = await saveRepresentativeImage(newCoffee.roaster, newCoffee.name, dataUrl);
              if (saved) {
                setRepImageCacheEntry(newCoffee.roaster, newCoffee.name, dataUrl);
              }
            }
          }
        } catch (e) {
          console.error('Auto bag image generation failed:', e);
        }

        setCoffees([...coffees, newCoffee]);
        setShowAddCoffee(false);
        toast.success('Coffee added');
      } else {
        const error = await res.json().catch(() => ({}));
        console.error('Failed to create coffee:', error);
        toast.error(sanitizeErrorMessage(error, 'Failed to add coffee'));
      }
    } catch (error) {
      console.error('Error creating coffee:', error);
      toast.error(sanitizeErrorMessage(error, 'Failed to add coffee'));
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setAccessToken(null);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Error logging out');
    }
  };

  const handleDuplicateExtraction = (brew: Brew) => {
    setDuplicateBrewData(brew);
    setShowNewBrew(true);
  };

  const handleDeleteBrew = async (id: string) => {
    if (!accessToken) {
      toast.error('Please sign in to delete brews');
      return;
    }

    try {
      const freshToken = await getAccessToken();
      if (!freshToken) { toast.error('Session expired. Please sign in again.'); return; }

      const res = await fetch(`${apiUrl}/brews/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${freshToken}`,
        },
      });

      if (res.ok) {
        setBrews(brews.filter((e) => e.id !== id));
        toast.success('Brew deleted');
        setDeletingBrewId(null);
      } else {
        const error = await res.json().catch(() => ({}));
        console.error('Failed to delete brew:', error);
        toast.error(sanitizeErrorMessage(error, 'Failed to delete brew'));
      }
    } catch (error) {
      console.error('Error deleting brew:', error);
      toast.error(sanitizeErrorMessage(error, 'Something went wrong'));
    }
  };

  const handleDeleteCoffee = async (id: string) => {
    if (!accessToken) {
      toast.error('Please sign in to delete coffees');
      return;
    }

    try {
      const freshToken = await getAccessToken();
      if (!freshToken) { toast.error('Session expired. Please sign in again.'); return; }

      const res = await fetch(`${apiUrl}/coffees/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${freshToken}`,
        },
      });

      if (res.ok) {
        setCoffees(coffees.filter((o) => o.id !== id));
        // Also remove all brews associated with this coffee
        setBrews(brews.filter((b) => b.coffeeId !== id));
        toast.success('Coffee and associated brews deleted');
        setDeletingCoffeeId(null);
      } else {
        const error = await res.json().catch(() => ({}));
        console.error('Failed to delete coffee:', error);
        toast.error(sanitizeErrorMessage(error, 'Failed to delete coffee'));
      }
    } catch (error) {
      console.error('Error deleting coffee:', error);
      toast.error(sanitizeErrorMessage(error, 'Failed to delete coffee'));
    }
  };

  const handleDuplicateCoffee = (coffee: Coffee) => {
    setDuplicateCoffeeData(coffee);
    setEditingCoffee(null); // Clear edit data to ensure it's treated as new
    setShowAddCoffee(true);
  };

  const handleDuplicateBrew = (brew: Brew) => {
    setDuplicateBrewData(brew);
    setShowNewBrew(true);
  };

  const handleEditCoffee = (coffee: Coffee) => {
    setEditingCoffee(coffee);
    setShowAddCoffee(true);
  };

  const handleUpdateCoffee = async (id: string, data: Omit<Coffee, 'id' | 'createdAt'>) => {
    if (!accessToken) {
      toast.error('Please sign in to update coffees');
      return;
    }

    try {
      const freshToken = await getAccessToken();
      if (!freshToken) { toast.error('Session expired. Please sign in again.'); return; }

      const res = await fetch(`${apiUrl}/coffees/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const updated = await res.json();
        setCoffees(coffees.map((o) => (o.id === id ? updated : o)));
        setShowAddCoffee(false);
        setEditingCoffee(null);
        toast.success('Coffee updated');
      } else {
        const error = await res.json().catch(() => ({}));
        console.error('Failed to update coffee:', error);
        toast.error(sanitizeErrorMessage(error, 'Failed to update coffee'));
      }
    } catch (error) {
      console.error('Error updating coffee:', error);
      toast.error(sanitizeErrorMessage(error, 'Failed to update coffee'));
    }
  };

  const handleMarkCoffeeFinished = async (id: string, finished: boolean = true) => {
    const coffee = coffees.find(c => c.id === id);
    if (!coffee || !accessToken) return;

    try {
      const freshToken = await getAccessToken();
      if (!freshToken) { toast.error('Session expired. Please sign in again.'); return; }

      const { id: _id, createdAt: _ca, ...data } = coffee;
      const res = await fetch(`${apiUrl}/coffees/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ ...data, finished }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCoffees(coffees.map(c => (c.id === id ? updated : c)));
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(sanitizeErrorMessage(error, 'Failed to update bag status'));
      }
    } catch (error) {
      console.error('Error marking coffee as finished:', error);
      toast.error(sanitizeErrorMessage(error, 'Failed to update bag status'));
    }
  };

  const handleEditExtraction = (brew: Brew) => {
    setShowNewBrew(false); // Close new brew form if open
    setDuplicateBrewData(null); // Clear any duplicate data
    setEditingBrew(brew);
  };

  const handleUpdateExtraction = async (
    id: string,
    data: {
      coffeeId: string;
      brewMethod: BrewMethod;
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
    }
  ) => {
    if (!accessToken) {
      toast.error('Please sign in to update brews');
      return;
    }

    try {
      const freshToken = await getAccessToken();
      if (!freshToken) { toast.error('Session expired. Please sign in again.'); return; }

      // Get coffee and user details for the updated brew
      const coffee = coffees.find(o => o.id === data.coffeeId);
      const user = users.find(u => u.id === data.userId);
      
      if (!coffee || !user) {
        toast.error('Invalid coffee or user');
        return;
      }

      const updatePayload = {
        ...data,
        coffeeName: coffee.name,
        roaster: coffee.roaster,
        userName: user.name || user.email,
      };

      const res = await fetch(`${apiUrl}/brews/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (res.ok) {
        const updated = await res.json();
        setBrews(brews.map((e) => (e.id === id ? updated : e)));
        setEditingBrew(null);
        toast.success('Brew updated successfully');
      } else {
        const error = await res.json().catch(() => ({}));
        console.error('Failed to update brew:', error);
        toast.error(sanitizeErrorMessage(error, 'Failed to update brew'));
      }
    } catch (error) {
      console.error('Error updating brew:', error);
      toast.error(sanitizeErrorMessage(error, 'Something went wrong'));
    }
  };

  const formatDate = (dateString: string, showYear: boolean = true) => {
    const date = new Date(dateString);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    // Check if date is today or yesterday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Use simplified format for today/yesterday regardless of grouping
    if (checkDate.getTime() === today.getTime()) {
      return `Today at ${time}`;
    } else if (checkDate.getTime() === yesterday.getTime()) {
      return `Yesterday at ${time}`;
    }
    
    const dateStr = showYear ? `${month} ${day}, ${year}` : `${month} ${day}`;
    return `${dateStr} at ${time}`;
  };

  const getDaysOld = (roastDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [year, month, day] = roastDate.split('-').map(Number);
    const roast = new Date(year, month - 1, day);
    
    const diffTime = Math.abs(today.getTime() - roast.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // < 1 month: show days
    if (diffDays < 30) {
      return diffDays === 1 ? '1 day' : `${diffDays} days`;
    }
    
    // < 1 year: show months
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month' : `${months} months`;
    }
    
    // >= 1 year: show years
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year' : `${years} years`;
  };

  const getExactDaysOld = (roastDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [year, month, day] = roastDate.split('-').map(Number);
    const roast = new Date(year, month - 1, day);
    
    const diffTime = Math.abs(today.getTime() - roast.getTime());
    const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Calculate years, months, and days
    const years = Math.floor(totalDays / 365);
    const remainingAfterYears = totalDays % 365;
    const months = Math.floor(remainingAfterYears / 30);
    const days = remainingAfterYears % 30;
    
    // Build the string with only non-zero parts
    const parts = [];
    if (years > 0) {
      parts.push(years === 1 ? '1 year' : `${years} years`);
    }
    if (months > 0) {
      parts.push(months === 1 ? '1 month' : `${months} months`);
    }
    if (days > 0) {
      parts.push(days === 1 ? '1 day' : `${days} days`);
    }
    
    // If nothing (0 days), just say "0 days"
    if (parts.length === 0) {
      return '0 days';
    }
    
    return parts.join(' ');
  };

  const getCoffeeAverageRating = (coffeeId: string): { rating: number; count: number } => {
    const coffeeExtractions = brews.filter(
      (brew) => brew.coffeeId === coffeeId && brew.quality && brew.quality > 0
    );
    
    if (coffeeExtractions.length === 0) {
      return { rating: 0, count: 0 };
    }

    const sum = coffeeExtractions.reduce((acc, brew) => acc + (brew.quality || 0), 0);
    const average = sum / coffeeExtractions.length;
    const rounded = Math.round(average); // This rounds 0.5 and above up, below 0.5 down
    
    return { rating: rounded, count: coffeeExtractions.length };
  };

  // Filter data
  const filteredBrews = brews.filter(
    (e) => filterMethod === 'all' || e.brewMethod === filterMethod
  );

  // Beans view shows all beans; brew method filter applies only to brews.
  const filteredCoffees = coffees;

  // Group data
  const groupExtractionsByMonth = (brews: Brew[]) => {
    const sorted = [...brews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const grouped: { [key: string]: Brew[] } = {};
    
    sorted.forEach(brew => {
      const date = new Date(brew.createdAt);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(brew);
    });
    
    return grouped;
  };

  const groupExtractionsByRoaster = (brews: Brew[]) => {
    const grouped: { [key: string]: Brew[] } = {};
    
    brews.forEach(brew => {
      const key = `${brew.roaster} – ${brew.coffeeName}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(brew);
    });
    
    // Sort each group's brews by date (newest first)
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
    
    // Sort groups by the most recent brew date in each group (newest first)
    const sortedGrouped: { [key: string]: Brew[] } = {};
    Object.keys(grouped)
      .sort((a, b) => {
        const aLatest = new Date(grouped[a][0].createdAt).getTime();
        const bLatest = new Date(grouped[b][0].createdAt).getTime();
        return bLatest - aLatest;
      })
      .forEach(key => {
        sortedGrouped[key] = grouped[key];
      });
    
    return sortedGrouped;
  };

  const groupCoffeesByMonth = (coffees: Coffee[]) => {
    const sorted = [...coffees].sort((a, b) => new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime());
    const grouped: { [key: string]: Coffee[] } = {};
    
    sorted.forEach(coffee => {
      const date = new Date(coffee.roastDate);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(coffee);
    });
    
    return grouped;
  };

  const groupCoffeesByRoaster = (coffees: Coffee[]) => {
    const grouped: { [key: string]: Coffee[] } = {};
    
    coffees.forEach(coffee => {
      const key = `${coffee.roaster} – ${coffee.name}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(coffee);
    });
    
    // Sort each group's coffees by roast date (newest first)
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime());
    });
    
    // Sort groups by the most recent roast date in each group (newest first)
    const sortedGrouped: { [key: string]: Coffee[] } = {};
    Object.keys(grouped)
      .sort((a, b) => {
        const aLatest = new Date(grouped[a][0].roastDate).getTime();
        const bLatest = new Date(grouped[b][0].roastDate).getTime();
        return bLatest - aLatest;
      })
      .forEach(key => {
        sortedGrouped[key] = grouped[key];
      });
    
    return sortedGrouped;
  };

  const groupedBrews = groupBy === 'month' 
    ? groupExtractionsByMonth(filteredBrews) 
    : groupExtractionsByRoaster(filteredBrews);
  
  const groupedCoffees = groupBy === 'month' 
    ? groupCoffeesByMonth(filteredCoffees) 
    : groupCoffeesByRoaster(filteredCoffees);

  // Handle routing
  const handleNavigateBack = () => {
    window.history.pushState({}, '', '/');
    setCurrentRoute('/');
  };

  if (currentRoute === '/terms') {
    return <Terms onBack={handleNavigateBack} />;
  }

  if (currentRoute === '/privacy') {
    return <Privacy onBack={handleNavigateBack} />;
  }

  if (currentRoute === '/a2p-optin-proof') {
    return <A2POptInProof onBack={handleNavigateBack} />;
  }

  if (currentRoute === '/landing') {
    return <LandingPage onLoginSuccess={() => checkAuth()} />;
  }

  // Show loading for /auth/confirm route (magic link verification)
  if (currentRoute === '/auth/confirm') {
    return (
      <div className="bg-gray-50 flex items-center justify-center" style={{ height: '100dvh' }}>
        <EspressoLoading />
      </div>
    );
  }

  if (currentRoute === '/login') {
    // If user is already logged in, show loading briefly while redirect happens
    if (currentUser) {
      return (
        <div className="bg-gray-50 flex items-center justify-center" style={{ height: '100dvh' }}>
          <EspressoLoading />
        </div>
      );
    }
    
    // Check if this is an OAuth callback (has code or access_token in URL)
    // If so, show loading instead of login page to prevent flash
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const code = urlParams.get('code');
    const accessToken = hashParams.get('access_token');
    const hasOAuthCallback = code || accessToken;
    
    if (hasOAuthCallback) {
      // OAuth callback detected - show loading while processing
      return (
        <div className="bg-gray-50 flex items-center justify-center" style={{ height: '100dvh' }}>
          <EspressoLoading />
        </div>
      );
    }
    
    return <SignInPage onLoginSuccess={() => checkAuth()} />;
  }


  // Public routes that don't require auth
  const publicRoutes = ['/login', '/landing'];
  const isPublicRoute = publicRoutes.includes(currentRoute);
  
  // Root route (/) shows landing page when logged out
  const isRootRoute = currentRoute === '/';

  // Check if there's a potential session stored (to prevent flash for logged-in users)
  // Supabase stores session in localStorage under the storageKey configured in client.ts
  const hasPotentialSession = typeof window !== 'undefined' && 
    localStorage.getItem('hone-auth') !== null;

  // Show loading spinner if:
  // 1. User is logged in and loading their data, OR
  // 2. We're loading and there's a potential session (might be logged in, checking auth)
  // Don't show loading if no potential session (definitely logged out)
  if (loading) {
    if (currentUser) {
      // User is logged in, loading their data - show loading
      return (
        <div className="bg-gray-50 flex items-center justify-center" style={{ height: '100dvh' }}>
          <EspressoLoading />
        </div>
      );
    } else if (hasPotentialSession && !authChecked) {
      // Potential session exists, still checking auth - show loading to prevent flash
      return (
        <div className="bg-gray-50 flex items-center justify-center" style={{ height: '100dvh' }}>
          <EspressoLoading />
        </div>
      );
    }
    // No potential session - user is definitely logged out, don't show loading
  }

  if (!currentUser) {
    // Show LandingPage - no loading spinner for logged-out users
    return <LandingPage onLoginSuccess={() => checkAuth()} />;
  }

  if (currentRoute === '/feed') {
  return (
    <div className="bg-gray-50" style={{ minHeight: '100dvh' }}>
        <div className="bg-white shadow-sm mb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleNavigateBack}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  ← Back
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Feed</h1>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <Feed brews={brews} coffees={coffees} />
        </div>
      </div>
    );
  }

  if (currentRoute === '/profile' && currentUser) {
    return (
      <Profile
        currentUser={currentUser}
        users={users}
        coffees={coffees}
        brews={brews}
        accessToken={accessToken!}
        onNewBrew={() => {
          setShowNewBrew(true);
          window.history.pushState({}, '', '/');
          setCurrentRoute('/');
        }}
        onNewCoffee={() => {
          setShowAddCoffee(true);
          window.history.pushState({}, '', '/');
          setCurrentRoute('/');
        }}
        onEditBrew={(brew) => {
          setEditingBrew(brew);
          window.history.pushState({}, '', '/');
          setCurrentRoute('/');
        }}
        onDeleteBrew={handleDeleteBrew}
        onEditCoffee={(coffee) => {
          setEditingCoffee(coffee);
          window.history.pushState({}, '', '/');
          setCurrentRoute('/');
        }}
        onDeleteCoffee={handleDeleteCoffee}
        onDuplicateBrew={(brew) => {
          setDuplicateBrewData(brew);
          setShowNewBrew(true);
          window.history.pushState({}, '', '/');
          setCurrentRoute('/');
        }}
      />
    );
  }

  return (
    <div className="bg-gray-50 flex flex-col min-h-0" style={{ minHeight: '100dvh' }}>
      <Toaster 
        position="top-center" 
        richColors 
        toastOptions={{ 
          style: { textAlign: 'center' },
          classNames: {
            toast: 'justify-center',
            title: 'text-center',
            description: 'text-center',
          }
        }} 
      />
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="px-3 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <img src={honeLogo} alt="" className="app-nav-logo" style={{ height: '22px', width: 'auto', display: 'block' }} />
              <span className="hidden md:inline text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: '18px', lineHeight: 1, color: '#111827' }}>Hone</span>
            </div>
            <div className="flex items-center gap-4">
              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant={activeView === 'brews' ? 'default' : 'ghost'}
                  onClick={() => setActiveView('brews')}
                  className="cursor-pointer"
                >
                  <span>Brews</span>
                </Button>
                <Button
                  variant={activeView === 'coffees' ? 'default' : 'ghost'}
                  onClick={() => setActiveView('coffees')}
                  className="cursor-pointer"
                >
                  <span>Beans</span>
                </Button>
              </div>
              
              {/* Mobile Navigation - Emoji Buttons */}
              <div className="flex md:hidden items-center gap-2">
                <Button
                  variant={activeView === 'brews' ? 'default' : 'ghost'}
                  onClick={() => setActiveView('brews')}
                  className="cursor-pointer h-9 w-9 p-0 text-xl"
                >
                  ☕
                </Button>
                <Button
                  variant={activeView === 'coffees' ? 'default' : 'ghost'}
                  onClick={() => setActiveView('coffees')}
                  className="cursor-pointer h-9 w-9 p-0 flex items-center justify-center"
                >
                  <img 
                    src={coffeeBeansImage} 
                    alt="Coffee beans" 
                    className="object-contain"
                    style={{ width: '18px', height: '18px' }}
                    loading="lazy"
                  />
                </Button>
              </div>
              
              <div className="flex items-center gap-3 border-l pl-4">
                {currentUser ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full">
                        <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                          <AvatarImage src={currentUser.avatarUrl || ''} />
                          <AvatarFallback>
                            <UserIcon className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowProfile(true)}>
                        <UserIcon className="w-4 h-4" />
                        Account
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowEquipment(true)}>
                        <BrewEquipmentIcon className="w-4 h-4" />
                        Equipment
                      </DropdownMenuItem>
                      {currentUser?.email === ADMIN_EMAIL && (
                        <>
                          <DropdownMenuItem onClick={() => setShowBagImages(true)}>
                            <ImageIcon className="w-4 h-4" />
                            Bag Images
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowAliases(true)}>
                            <Link2 className="w-4 h-4" />
                            Manage Aliases
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={() => setShowFeedback(true)}>
                        <MessageSquare className="w-4 h-4" />
                        Feedback
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)}>
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="text-sm text-gray-500">Not signed in</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Update Banner */}
      {showUpdateBanner && (
        <div
          style={{
            backgroundColor: '#D32F2F',
            color: '#FFFFFF',
            padding: '12px 24px',
            textAlign: 'center',
            fontSize: '14px',
          }}
        >
          📢 We've made improvements.{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (serverVersion) {
                localStorage.setItem('app_version', serverVersion);
                window.location.reload();
              }
            }}
            style={{
              color: '#FFFFFF',
              textDecoration: 'underline',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload the page
          </a>
          {' '}to get the latest updates.
        </div>
      )}

      {/* Main Content — grows with content so footer stays at bottom of page when content overflows */}
      <div className="px-3 py-4 md:px-6 md:py-6 flex flex-col flex-1 mobile-page-content" style={{ flex: '1 1 auto' }}>
        {activeView === 'brews' ? (
          brewsView === 'table' ? (
            <BrewsTableView
              brews={brews}
              coffees={coffees}
              users={users}
              filterMethod={filterMethod}
              groupBy={groupBy}
              onFilterMethodChange={setFilterMethod}
              onGroupByChange={setGroupBy}
              onNewBrew={() => setShowNewBrew(true)}
              onSelectBrew={(brew, scrollToGuidance) => {
                setSelectedBrew(brew);
                setScrollToGuidance(scrollToGuidance || false);
              }}
              onEditBrew={(brew) => {
                setEditingBrew(brew);
              }}
              onDeleteBrew={(id) => setDeletingBrewId(id)}
              onDuplicateBrew={(brew) => {
                setDuplicateBrewData(brew);
                setShowNewBrew(true);
              }}
              hoveredBrewRating={hoveredBrewRating}
              onHoverBrewRating={setHoveredBrewRating}
              view={brewsView}
              onViewChange={setBrewsView}
              equipment={equipment}
              onAddBrewForCoffee={(coffeeId, brewMethod) => {
                setPrefilledCoffeeId(coffeeId);
                setPrefilledBrewMethod(brewMethod);
                setShowNewBrew(true);
              }}
              onOpenEquipment={() => setShowEquipment(true)}
              onOpenAddCoffee={() => setShowAddCoffee(true)}
              onUpdateQuality={handleUpdateQuality}
              onUpdateNotes={handleUpdateNotes}
            />
          ) : (
            <BrewsTimelineView
              brews={brews}
              coffees={coffees}
              users={users}
              filterMethod={filterMethod}
              onFilterMethodChange={setFilterMethod}
              onNewBrew={() => setShowNewBrew(true)}
              onSelectBrew={(brew, scrollToGuidance) => {
                setSelectedBrew(brew);
                setScrollToGuidance(scrollToGuidance || false);
              }}
              view={brewsView}
              onViewChange={setBrewsView}
              equipment={equipment}
              onAddBrewForCoffee={(coffeeId, brewMethod) => {
                setPrefilledCoffeeId(coffeeId);
                setPrefilledBrewMethod(brewMethod);
                setShowNewBrew(true);
              }}
              onOpenEquipment={() => setShowEquipment(true)}
              onOpenAddCoffee={() => setShowAddCoffee(true)}
            />
          )
        ) : (
          <>
            {coffees.length > 0 && (
              <CoffeesToolbar
                view={coffeesView}
                groupBy={groupBy}
                onViewChange={setCoffeesView}
                onGroupByChange={setGroupBy}
                onNewCoffee={() => setShowAddCoffee(true)}
              />
            )}
            {coffeesView === 'table' ? (
              <CoffeesTableView
                coffees={coffees}
                brews={brews}
                groupBy={groupBy}
                onNewCoffee={() => setShowAddCoffee(true)}
                onSelectCoffee={setSelectedCoffee}
                onEditCoffee={handleEditCoffee}
                onDuplicateCoffee={handleDuplicateCoffee}
                onDeleteCoffee={(id) => setDeletingCoffeeId(id)}
                onPrintQR={setQrCodeCoffee}
              />
            ) : (
              <CoffeesShelvesView
                coffees={coffees}
                brews={brews}
                groupBy={groupBy}
                aliases={aliases}
                onNewCoffee={() => setShowAddCoffee(true)}
                onSelectCoffee={(coffee, siblings) => {
                  setSelectedCoffee(coffee);
                  setSelectedCoffeeSiblings(siblings ?? null);
                }}
              />
            )}
          </>
        )}
      </div>

      {selectedBrew && (() => {
        // Same as NewBrewFlow baseline + alias resolution: same coffee (all bags, canonical roaster + name) + same brew method
        const norm = (s: string) => (s || '').trim().toLowerCase();
        const resolveCanonical = (roaster: string, name: string) => {
          const ra = aliases.roasterAliases;
          const cna = aliases.coffeeNameAliases;
          const normR = norm(roaster);
          let canonicalRoaster = roaster;
          for (const [variant, canonical] of Object.entries(ra)) {
            if (norm(variant) === normR) { canonicalRoaster = canonical as string; break; }
          }
          const normCoffeeKey = `${norm(canonicalRoaster)}|${norm(name)}`;
          let canonicalCoffeeName = name;
          for (const [variantKey, canonicalValue] of Object.entries(cna)) {
            const [kr, kn] = variantKey.split('|');
            if (`${norm(kr)}|${norm(kn)}` === normCoffeeKey) {
              canonicalCoffeeName = (canonicalValue as string).split('|')[1] ?? name;
              break;
            }
          }
          return { roaster: canonicalRoaster, coffeeName: canonicalCoffeeName };
        };
        const selectedCoffee = coffees.find(c => c.id === selectedBrew.coffeeId);
        const selectedCanonical = selectedCoffee ? resolveCanonical(selectedCoffee.roaster, selectedCoffee.name) : null;
        const selectedKey = selectedCanonical ? `${norm(selectedCanonical.roaster)}|${norm(selectedCanonical.coffeeName)}` : null;
        const sameCoffeeBagIds = selectedKey
          ? new Set(
              coffees
                .filter((c) => {
                  const can = resolveCanonical(c.roaster, c.name);
                  return `${norm(can.roaster)}|${norm(can.coffeeName)}` === selectedKey;
                })
                .map((c) => c.id)
            )
          : new Set(selectedCoffee ? [selectedCoffee.id] : [selectedBrew.coffeeId]);
        const navBrews = brews
          .filter(b => sameCoffeeBagIds.has(b.coffeeId) && b.brewMethod === selectedBrew.brewMethod)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const currentIndex = navBrews.findIndex(e => e.id === selectedBrew.id);
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex < navBrews.length - 1;
        
        return (
          <BrewDetail
            brew={selectedBrew}
            users={users}
            onClose={() => {
              setSelectedBrew(null);
              setScrollToGuidance(false);
            }}
            onEdit={(brew) => {
              setSelectedBrew(null);
              setEditingBrew(brew);
            }}
            onDuplicateBrew={(brew) => {
              setSelectedBrew(null);
              handleDuplicateBrew(brew);
            }}
            onDeleteBrew={(id) => {
              setSelectedBrew(null);
              setDeletingBrewId(id);
            }}
            onViewGuidancePrompt={currentUser?.email === ADMIN_EMAIL ? async (brew) => {
              const coffee = coffees.find(c => c.id === brew.coffeeId);
              if (!coffee) throw new Error('Coffee not found');

              const matchingBrews = brews
                .filter(b => b.coffeeId === brew.coffeeId && b.brewMethod === brew.brewMethod)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

              const top10Recent = matchingBrews.slice(0, 10);
              const top10Ids = new Set(top10Recent.map(b => b.id));
              const exceptionalBrew = matchingBrews.find(b => b.quality === 3);

              let brewsToSend = [...top10Recent];
              if (!top10Ids.has(brew.id)) brewsToSend.push(brew);
              if (exceptionalBrew && !brewsToSend.find(b => b.id === exceptionalBrew.id)) brewsToSend.push(exceptionalBrew);
              brewsToSend.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
                      name: coffee.name,
                      roaster: coffee.roaster,
                      notes: coffee.notes,
                      region: coffee.region,
                      roastLevel: coffee.roastLevel,
                    },
                    brews: brewsToSend.map(b => ({
                      id: b.id,
                      grindSetting: b.grindSetting,
                      dosage: b.dosage,
                      waterTemp: b.waterTemp,
                      brewTime: b.brewTime,
                      finalWeight: b.finalWeight,
                      quality: b.quality,
                      tastingNotes: b.tastingNotes,
                      brewMethod: b.brewMethod,
                      stages: b.stages,
                      coffeeTemperature: b.coffeeTemperature,
                      brewerName: b.brewerName,
                      grinderName: b.grinderName,
                      notes: b.personalNotes,
                      createdAt: b.createdAt,
                      isBaseline: b.id === brew.id,
                      isExceptional: exceptionalBrew ? b.id === exceptionalBrew.id : false,
                    })),
                    brewMethod: brew.brewMethod,
                    targetBrewId: brew.id,
                    brewerName: brew.brewerName,
                    grinderName: brew.grinderName,
                    debugPrompt: true,
                  }),
                }
              );

              if (!response.ok) throw new Error(`API error: ${response.status}`);
              return await response.json();
            } : undefined}
            onNavigatePrev={hasPrev ? () => {
              setScrollToGuidance(false);
              setSelectedBrew(navBrews[currentIndex - 1]);
            } : undefined}
            onNavigateNext={hasNext ? () => {
              setScrollToGuidance(false);
              setSelectedBrew(navBrews[currentIndex + 1]);
            } : undefined}
            hasPrev={hasPrev}
            hasNext={hasNext}
            scrollToGuidance={scrollToGuidance}
            onScrollComplete={() => setScrollToGuidance(false)}
          />
        );
      })()}

      {selectedCoffee && (() => {
        // If opened from the shelf "by roaster" view, navigate within sibling bags
        const navList: Coffee[] = selectedCoffeeSiblings ?? (() => {
          const flat: Coffee[] = [];
          Object.entries(groupedCoffees).forEach(([_, gc]) => flat.push(...gc));
          return flat;
        })();

        const currentIndex = navList.findIndex(c => c.id === selectedCoffee.id);
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex < navList.length - 1;

        return (
          <CoffeeDetail
            coffee={selectedCoffee}
            brews={brews}
            onClose={() => { setSelectedCoffee(null); setSelectedCoffeeSiblings(null); }}
            onEdit={(coffee) => {
              setSelectedCoffee(null);
              setSelectedCoffeeSiblings(null);
              handleEditCoffee(coffee);
            }}
            onDuplicateCoffee={(coffee) => {
              setSelectedCoffee(null);
              setSelectedCoffeeSiblings(null);
              handleDuplicateCoffee(coffee);
            }}
            onPrintQR={(coffee) => {
              setSelectedCoffee(null);
              setSelectedCoffeeSiblings(null);
              setQrCodeCoffee(coffee);
            }}
            onDeleteCoffee={(id) => {
              setSelectedCoffee(null);
              setSelectedCoffeeSiblings(null);
              setDeletingCoffeeId(id);
            }}
            onMarkFinished={(id, finished) => {
              handleMarkCoffeeFinished(id, finished);
              setSelectedCoffee(prev => prev ? { ...prev, finished } : null);
            }}
            onNavigatePrev={hasPrev ? () => setSelectedCoffee(navList[currentIndex - 1]) : undefined}
            onNavigateNext={hasNext ? () => setSelectedCoffee(navList[currentIndex + 1]) : undefined}
            hasPrev={hasPrev}
            hasNext={hasNext}
            showNavArrows={selectedCoffeeSiblings !== null}
          />
        );
      })()}

      {showNewBrew && (
        currentUser ? (
          <NewBrewFlow
            coffees={coffees}
            users={users}
            currentUser={currentUser}
            brews={brews}
            accessToken={accessToken!}
            onClose={() => {
              setShowNewBrew(false);
              setDuplicateBrewData(null);
              setPrefilledCoffeeId(null);
              setPrefilledBrewMethod(null);
            }}
            onSave={handleAddExtraction}
            duplicateData={duplicateBrewData}
            equipmentChangeCounter={equipmentChangeCounter}
            prefilledCoffeeId={prefilledCoffeeId}
            prefilledBrewMethod={prefilledBrewMethod}
            onMarkCoffeeFinished={handleMarkCoffeeFinished}
            onAddAnotherBag={handleDuplicateCoffee}
            hidden={showAddCoffee}
          />
        ) : (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h2 className="text-gray-900 mb-4">Sign In Required</h2>
              <p className="text-gray-600 mb-6">Please sign in to create brews.</p>
              <Button onClick={() => setShowNewBrew(false)}>Close</Button>
            </div>
          </div>
        )
      )}

      {showAddCoffee && (
        <AddCoffeeForm
          onClose={() => {
            setShowAddCoffee(false);
            setEditingCoffee(null);
            setDuplicateCoffeeData(null);
          }}
          onSave={handleAddCoffee}
          editData={editingCoffee}
          duplicateData={duplicateCoffeeData}
          onUpdate={handleUpdateCoffee}
          existingCoffees={coffees}
        />
      )}

      {editingBrew && (
        <NewBrewFlow
          coffees={coffees}
          users={users}
          currentUser={currentUser!}
          brews={brews}
          accessToken={accessToken!}
          onClose={() => setEditingBrew(null)}
          onSave={handleAddExtraction}
          editingBrew={editingBrew}
          onUpdate={handleUpdateExtraction}
          equipmentChangeCounter={equipmentChangeCounter}
          onMarkCoffeeFinished={handleMarkCoffeeFinished}
          onAddAnotherBag={handleDuplicateCoffee}
          hidden={showAddCoffee}
        />
      )}

      {qrCodeCoffee && (
        <QRCodeDialog
          coffee={qrCodeCoffee}
          onClose={() => setQrCodeCoffee(null)}
        />
      )}

      {deletingBrewId && (
        <AlertDialog open={!!deletingBrewId} onOpenChange={(open) => !open && setDeletingBrewId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-start justify-between">
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingBrewId(null)}
                  className="cursor-pointer flex-shrink-0 -mt-1"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </AlertDialogHeader>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the brew.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingBrewId(null)} className="cursor-pointer">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteBrew(deletingBrewId)} className="cursor-pointer">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {deletingCoffeeId && (
        <AlertDialog open={!!deletingCoffeeId} onOpenChange={(open) => !open && setDeletingCoffeeId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-start justify-between">
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingCoffeeId(null)}
                  className="cursor-pointer flex-shrink-0 -mt-1"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </AlertDialogHeader>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the coffee and all associated brews.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingCoffeeId(null)} className="cursor-pointer">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteCoffee(deletingCoffeeId)} className="cursor-pointer">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showLogoutConfirm && (
        <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-start justify-between">
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="cursor-pointer flex-shrink-0 -mt-1"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </AlertDialogHeader>
            <AlertDialogDescription>
              You will be logged out of your account.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowLogoutConfirm(false)} className="cursor-pointer">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { handleLogout(); setShowLogoutConfirm(false); }} className="cursor-pointer">Log Out</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showProfile && currentUser && accessToken && (
        <UserProfileDialog
          open={showProfile}
          onOpenChange={setShowProfile}
          user={currentUser}
          accessToken={accessToken}
          onUpdate={(updatedUser) => {
            setCurrentUser(updatedUser);
            // Update the user in users list too
            setUsers(users.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
          }}
        />
      )}

      {showEquipment && accessToken && (
        <EquipmentDialog
          open={showEquipment}
          onOpenChange={setShowEquipment}
          accessToken={accessToken}
          onEquipmentChange={() => {
            setEquipmentChangeCounter(prev => prev + 1);
            fetchData(); // Refetch brews to get updated equipment names
          }}
        />
      )}

      {showAliases && accessToken && currentUser?.email === ADMIN_EMAIL && (
        <AliasesManager
          open={showAliases}
          onOpenChange={setShowAliases}
          accessToken={accessToken}
        />
      )}

      {showBagImages && currentUser?.email === ADMIN_EMAIL && (
        allCoffeesLoading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
            <EspressoLoading />
          </div>
        ) : (
          <div className="fixed inset-0 z-50">
            <CoffeeBagImageFlow
              coffees={allCoffees.length > 0 ? allCoffees : coffees}
              onClose={() => setShowBagImages(false)}
            />
          </div>
        )
      )}

      {/* Floating Feedback Button - Only show when logged in */}
      {currentUser && (
        <>
          <button
            type="button"
            onClick={() => setShowFeedback(true)}
            onMouseEnter={() => setIsFeedbackHovered(true)}
            onMouseLeave={() => setIsFeedbackHovered(false)}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: isFeedbackHovered ? '10px' : '0',
              backgroundColor: isFeedbackHovered ? '#1f2937' : '#111827',
              color: '#ffffff',
              paddingTop: '8px',
              paddingBottom: '8px',
              paddingLeft: '12px',
              paddingRight: '12px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 500,
              transition: 'background-color 0.2s, gap 0.2s',
            }}
            aria-label="Send feedback"
          >
            <MessageSquare className="w-5 h-5" style={{ flexShrink: 0 }} />
            <span 
              style={{
                opacity: isFeedbackHovered ? 1 : 0,
                maxWidth: isFeedbackHovered ? '200px' : '0',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.2s, max-width 0.2s',
                fontSize: '14px',
              }}
            >
              Feedback
            </span>
          </button>
          <FeedbackDialog
            open={showFeedback}
            onOpenChange={setShowFeedback}
            userEmail={currentUser.email}
          />
        </>
      )}
      
      {/* Footer */}
      <footer className="px-3 md:px-6 pt-4 pb-6" style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', textAlign: 'left' }}>
        <div className="w-full" style={{ textAlign: 'left' }}>
          © 2026 Hone • <a href="/privacy" style={{ color: '#6b7280', textDecoration: 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>Privacy</a> • <a href="/terms" style={{ color: '#6b7280', textDecoration: 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>Terms</a>
        </div>
      </footer>
    </div>
  );
}