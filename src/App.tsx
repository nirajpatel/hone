import { useState, useEffect } from 'react';
import { Brew, Coffee, User, BrewMethod, Equipment } from './types';
import { BrewDetail } from './components/BrewDetail';
import { CoffeeDetail } from './components/CoffeeDetail';
import { NewBrewFlow } from './components/NewBrewFlow';
import { AddCoffeeForm } from './components/AddCoffeeForm';
import { QRCodeDialog } from './components/QRCodeDialog';
import { Login } from './components/Login';
import { LandingPage } from './components/LandingPage';
import { BrewsTableView } from './components/BrewsTableView';
import { BrewsTimelineView } from './components/BrewsTimelineView';
import { CoffeesShelvesView } from './components/CoffeesShelvesView';
import { CoffeesTableView } from './components/CoffeesTableView';
import { Profile } from './components/Profile';
import { EquipmentDialog } from './components/EquipmentDialog';
import { EspressoLoading } from './components/EspressoLoading';
import { Terms } from './components/Terms';
import { Privacy } from './components/Privacy';
import { A2POptInProof } from './components/A2POptInProof';
import { CoffeeBagImageFlow } from './components/CoffeeBagImageFlow';
import { Feed } from './components/Feed';
import { UserProfileDialog } from './components/UserProfileDialog';
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
import { capitalizeBrewMethod, getRatingDisplay } from './utils/formatters';
import { getAllBrewMethodConfigs } from './utils/brewMethods';
import { Coffee as CoffeeIcon, Plus, LogOut } from 'lucide-react';
import { MoreVertical, User as UserIcon, QrCode, Pencil, Trash2, Menu, Coffee, List, Settings, X, LayoutGrid, Table as TableIcon } from 'lucide-react';
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

export default function App() {
  const [brews, setBrews] = useState<Brew[]>([]);
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrew, setSelectedBrew] = useState<Extraction | null>(null);
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
  const [hoveredBrewRating, setHoveredBrewRating] = useState<{ id: string, rating: number } | null>(null);
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
  const [equipmentChangeCounter, setEquipmentChangeCounter] = useState(0);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [coffeesView, setCoffeesView] = useState<'shelf' | 'table'>('table');
  const [brewsView, setBrewsView] = useState<'table' | 'timeline'>('timeline');
  const [equipment, setEquipment] = useState<Equipment[]>([]);

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

  // SMS reminder checker - runs every minute when user is logged in
  useEffect(() => {
    if (!currentUser) return;

    const checkReminders = async () => {
      try {
        await fetch(`${apiUrl}/check-reminders`, {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });
      } catch (error) {
        // Silently fail - reminder checks are background tasks
      }
    };

    // Check immediately
    checkReminders();
    
    // Then check every minute
    const interval = setInterval(checkReminders, 60000);
    
    return () => clearInterval(interval);
  }, [apiUrl, currentUser]);

  useEffect(() => {
    // Set document title and meta tags
    document.title = 'Hone';
    
    // Clear favicon and apple-touch-icon
    // Remove existing favicon
    const existingFavicon = document.querySelector("link[rel='icon']");
    if (existingFavicon) {
      existingFavicon.remove();
    }
    
    // Remove existing apple-touch-icon
    const existingAppleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (existingAppleIcon) {
      existingAppleIcon.remove();
    }
    
    // Update or create meta tags for social media
    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) || 
                 document.querySelector(`meta[name="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        if (property.startsWith('og:') || property.startsWith('twitter:')) {
          meta.setAttribute('property', property);
        } else {
          meta.setAttribute('name', property);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    updateMetaTag('description', '');
    updateMetaTag('og:title', 'Hone');
    updateMetaTag('og:description', '');
    updateMetaTag('og:type', 'website');
    updateMetaTag('twitter:card', 'summary');
    updateMetaTag('twitter:title', 'Hone');
    updateMetaTag('twitter:description', '');
    
    // Add apple-mobile-web-app-capable and title for better iOS home screen experience
    updateMetaTag('apple-mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-status-bar-style', 'default');
    updateMetaTag('apple-mobile-web-app-title', 'Hone');
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

  useEffect(() => {
    checkAuth();
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.access_token) {
        setAccessToken(session.access_token);
        await createOrGetUser(session.access_token);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setAccessToken(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      // Check for OAuth errors in URL
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      const error = urlParams.get('error') || hashParams.get('error');
      const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
      
      if (error) {
        toast.error(`OAuth Error: ${errorDescription || error}`);
        setLoading(false);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
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
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking auth:', error);
      setLoading(false);
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
        // Fetch brews and coffees after successful auth
        await fetchData(token);
      } else {
        toast.error('Failed to set up user');
      }
    } catch (error) {
      console.error('Error creating/getting user:', error);
      toast.error('Error setting up user');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (token?: string) => {
    const authToken = token || accessToken;
    if (!authToken) {
      console.error('No access token available');
      return;
    }

    try {
      const [brewsRes, coffeesRes, usersRes, equipmentRes] = await Promise.all([
        fetch(`${apiUrl}/brews`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`${apiUrl}/coffees`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`${apiUrl}/users`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`${apiUrl}/equipment`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      if (brewsRes.ok && coffeesRes.ok && usersRes.ok && equipmentRes.ok) {
        const brewsData = await brewsRes.json();
        const coffeesData = await coffeesRes.json();
        const usersData = await usersRes.json();
        const equipmentData = await equipmentRes.json();
        setBrews(brewsData);
        setCoffees(coffeesData);
        setUsers(usersData);
        setEquipment(equipmentData);
      } else {
        console.error('Failed to fetch data');
        toast.error('Failed to load data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading data');
    }
  };

  const handleAddExtraction = async (brew: Omit<Extraction, 'id' | 'createdAt'>) => {
    if (!accessToken) {
      toast.error('Please sign in to create brews');
      return;
    }

    try {
      // Get fresh access token (auto-refreshed by Supabase if needed)
      const freshToken = await getAccessToken();

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
        const error = await res.json();
        console.error('Failed to create brew:', error);
        toast.error(error.error || 'Failed to log brew');
      }
    } catch (error) {
      console.error('Error creating brew:', error);
      toast.error('Error logging brew');
    }
  };

  const handleUpdateQuality = async (id: string, quality: number | undefined) => {
    if (!accessToken) {
      toast.error('Please sign in to update brews');
      return;
    }

    try {
      // Get fresh access token (auto-refreshed by Supabase if needed)
      const freshToken = await getAccessToken();

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
        const error = await res.json();
        console.error('Failed to update brew:', error);
        toast.error(error.error || 'Failed to update quality');
      }
    } catch (error) {
      console.error('Error updating brew:', error);
      toast.error('Error updating quality');
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    if (!accessToken) {
      toast.error('Please sign in to update brews');
      return;
    }

    try {
      // Get fresh access token (auto-refreshed by Supabase if needed)
      const freshToken = await getAccessToken();

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
        const error = await res.json();
        console.error('Failed to update notes:', error);
        toast.error(error.error || 'Failed to update notes');
      }
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Error updating notes');
    }
  };

  const handleAddCoffee = async (coffee: Omit<Coffee, 'id' | 'createdAt'>) => {
    if (!accessToken) {
      toast.error('Please sign in to add coffees');
      return;
    }

    try {
      // Get fresh access token (auto-refreshed by Supabase if needed)
      const freshToken = await getAccessToken();

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
        setCoffees([...coffees, newCoffee]);
        setShowAddCoffee(false);
        toast.success('Coffee added');
      } else {
        const error = await res.json();
        console.error('Failed to create coffee:', error);
        toast.error('Failed to add coffee');
      }
    } catch (error) {
      console.error('Error creating coffee:', error);
      toast.error('Error adding coffee');
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

  const handleDuplicateExtraction = (brew: Extraction) => {
    setDuplicateBrewData(brew);
    setShowNewBrew(true);
  };

  const handleDeleteBrew = async (id: string) => {
    if (!accessToken) {
      toast.error('Please sign in to delete brews');
      return;
    }

    try {
      // Get fresh access token (auto-refreshed by Supabase if needed)
      const freshToken = await getAccessToken();

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
        const error = await res.json();
        console.error('Failed to delete brew:', error);
        toast.error(error.error || 'Failed to delete brew');
      }
    } catch (error) {
      console.error('Error deleting brew:', error);
      toast.error('Error deleting brew');
    }
  };

  const handleDeleteCoffee = async (id: string) => {
    if (!accessToken) {
      toast.error('Please sign in to delete coffees');
      return;
    }

    try {
      // Get fresh access token (auto-refreshed by Supabase if needed)
      const freshToken = await getAccessToken();

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
        const error = await res.json();
        console.error('Failed to delete coffee:', error);
        toast.error('Failed to delete coffee');
      }
    } catch (error) {
      console.error('Error deleting coffee:', error);
      toast.error('Error deleting coffee');
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
      // Get fresh access token (auto-refreshed by Supabase if needed)
      const freshToken = await getAccessToken();

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
        const error = await res.json();
        console.error('Failed to update coffee:', error);
        toast.error('Failed to update coffee');
      }
    } catch (error) {
      console.error('Error updating coffee:', error);
      toast.error('Error updating coffee');
    }
  };

  const handleEditExtraction = (brew: Extraction) => {
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
      // Get fresh access token (auto-refreshed by Supabase if needed)
      const freshToken = await getAccessToken();

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
        const error = await res.json();
        console.error('Failed to update brew:', error);
        toast.error(error.error || 'Failed to update brew');
      }
    } catch (error) {
      console.error('Error updating brew:', error);
      toast.error('Error updating brew');
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

  const filteredCoffees = coffees.filter(
    (o) => filterMethod === 'all' || o.brewMethod === filterMethod
  );

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

  if (currentRoute === '/coffee-bag') {
    if (loading) {
      return <EspressoLoading />;
    }
    return (
      <CoffeeBagImageFlow
        coffees={coffees}
        onClose={handleNavigateBack}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <EspressoLoading />
      </div>
    );
  }

  if (!currentUser) {
    return <LandingPage onLoginSuccess={() => checkAuth()} />;
  }

  if (currentRoute === '/feed') {
    return (
      <div className="min-h-screen bg-gray-50">
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
    <div className="min-h-screen bg-gray-50">
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
            <div className="text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-lg)' }}>Hone</div>
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
                  <span>Coffees</span>
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

      {/* Main Content */}
      <div className="px-3 py-4 md:px-6 md:py-6">
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
        ) : coffeesView === 'table' ? (
          <CoffeesTableView
            coffees={coffees}
            brews={brews}
            filterMethod={filterMethod}
            groupBy={groupBy}
            onFilterMethodChange={setFilterMethod}
            onGroupByChange={setGroupBy}
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
            onGroupByChange={setGroupBy}
            onNewCoffee={() => setShowAddCoffee(true)}
            view={coffeesView}
            onViewChange={setCoffeesView}
          />
        )}
      </div>

      {selectedBrew && (() => {
        // Get flat list of filtered brews in table order
        const flatBrews: Brew[] = [];
        Object.entries(groupedBrews).forEach(([_, groupBrews]) => {
          flatBrews.push(...groupBrews);
        });
        
        const currentIndex = flatBrews.findIndex(e => e.id === selectedBrew.id);
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex < flatBrews.length - 1;
        
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
            onNavigatePrev={hasPrev ? () => {
              setScrollToGuidance(false);
              setSelectedBrew(flatBrews[currentIndex - 1]);
            } : undefined}
            onNavigateNext={hasNext ? () => {
              setScrollToGuidance(false);
              setSelectedBrew(flatBrews[currentIndex + 1]);
            } : undefined}
            hasPrev={hasPrev}
            hasNext={hasNext}
            scrollToGuidance={scrollToGuidance}
            onScrollComplete={() => setScrollToGuidance(false)}
          />
        );
      })()}

      {selectedCoffee && (() => {
        // Get flat list of filtered coffees in table order
        const flatCoffees: Coffee[] = [];
        Object.entries(groupedCoffees).forEach(([_, groupCoffees]) => {
          flatCoffees.push(...groupCoffees);
        });
        
        const currentIndex = flatCoffees.findIndex(c => c.id === selectedCoffee.id);
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex < flatCoffees.length - 1;
        
        return (
          <CoffeeDetail
            coffee={selectedCoffee}
            brews={brews}
            onClose={() => setSelectedCoffee(null)}
            onEdit={(coffee) => {
              setSelectedCoffee(null);
              handleEditCoffee(coffee);
            }}
            onDuplicateCoffee={(coffee) => {
              setSelectedCoffee(null);
              handleDuplicateCoffee(coffee);
            }}
            onDeleteCoffee={(id) => {
              setSelectedCoffee(null);
              setDeletingCoffeeId(id);
            }}
            onNavigatePrev={hasPrev ? () => setSelectedCoffee(flatCoffees[currentIndex - 1]) : undefined}
            onNavigateNext={hasNext ? () => setSelectedCoffee(flatCoffees[currentIndex + 1]) : undefined}
            hasPrev={hasPrev}
            hasNext={hasNext}
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
    </div>
  );
}