import { useState, useEffect } from 'react';
import { User, Coffee, Brew, BrewMethod } from '../types';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { UserCircle2, MapPin, Calendar, Flame, Edit2 } from 'lucide-react';
import { BrewsTableView } from './BrewsTableView';
import { CoffeesTableView } from './CoffeesTableView';
import { EditProfileDialog } from './EditProfileDialog';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface ProfileData {
  photoUrl?: string;
  city?: string;
  bio?: string;
}

interface ProfileProps {
  currentUser: User;
  users: User[];
  coffees: Coffee[];
  brews: Brew[];
  accessToken: string;
  onNewBrew: () => void;
  onNewCoffee: () => void;
  onEditBrew: (brew: Brew) => void;
  onDeleteBrew: (id: string) => void;
  onEditCoffee: (coffee: Coffee) => void;
  onDeleteCoffee: (id: string) => void;
  onDuplicateBrew: (brew: Brew) => void;
}

export function Profile({
  currentUser,
  users,
  coffees,
  brews,
  accessToken,
  onNewBrew,
  onNewCoffee,
  onEditBrew,
  onDeleteBrew,
  onEditCoffee,
  onDeleteCoffee,
  onDuplicateBrew,
}: ProfileProps) {
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'brews' | 'coffees'>('brews');
  const [filterMethod, setFilterMethod] = useState<BrewMethod | 'all'>('all');
  const [groupBy, setGroupBy] = useState<'month' | 'coffee'>('month');
  const [hoveredBrewRating, setHoveredBrewRating] = useState<{ id: string; rating: number } | null>(null);
  const [selectedBrew, setSelectedBrew] = useState<Brew | null>(null);
  const [selectedCoffee, setSelectedCoffee] = useState<Coffee | null>(null);

  // Fetch profile data
  useEffect(() => {
    fetchProfileData();
  }, [currentUser.id]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/profile/${currentUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProfileData(data || {});
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (data: ProfileData) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/profile/${currentUser.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      setProfileData(data);
      toast.success('Profile updated successfully');
      setShowEditProfile(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile');
    }
  };

  // Calculate member since date
  const memberSince = new Date(currentUser.createdAt);
  const memberSinceText = memberSince.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  // Get user's brews sorted by date
  const userBrews = brews
    .filter(e => e.userId === currentUser.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Calculate streak
  const calculateStreak = () => {
    if (userBrews.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(today);

    // Check each day going backwards
    for (let i = 0; i < 365; i++) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const hasBrew = userBrews.some(e => {
        const brewDate = new Date(e.createdAt);
        return brewDate >= dayStart && brewDate <= dayEnd;
      });

      if (hasBrew) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // Allow one day gap if we're not on the first day
        if (streak === 0 && i === 0) {
          // Today has no brew, check yesterday
          currentDate.setDate(currentDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    return streak;
  };

  const streak = calculateStreak();
  const lastBrewDate = userBrews.length > 0 
    ? new Date(userBrews[0].createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Never';

  // Get user's coffees
  const userCoffees = coffees; // Show all coffees for now since userId is not set

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.location.reload();
            }}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4 inline-flex items-center"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-semibold text-gray-900">Profile</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Profile Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-8">
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Profile Photo */}
                <div className="relative">
                  {profileData.photoUrl ? (
                    <img
                      src={profileData.photoUrl}
                      alt={currentUser.name}
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <UserCircle2 className="w-16 h-16 text-white" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {currentUser.name}
                  </h2>
                  {profileData.bio && (
                    <p className="text-sm text-gray-600 mt-2 italic">
                      "{profileData.bio}"
                    </p>
                  )}
                </div>

                {/* City */}
                {profileData.city && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{profileData.city}</span>
                  </div>
                )}

                {/* Edit Profile Button */}
                <Button
                  onClick={() => setShowEditProfile(true)}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>

                {/* Stats */}
                <div className="w-full pt-4 border-t border-gray-200 space-y-3">
                  {/* Member Since */}
                  <div className="flex items-start gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="text-left flex-1">
                      <div className="text-gray-500">Member since</div>
                      <div className="font-medium text-gray-900">{memberSinceText}</div>
                    </div>
                  </div>

                  {/* Streak */}
                  <div className="flex items-start gap-2 text-sm">
                    <Flame className="w-4 h-4 text-orange-500 mt-0.5" />
                    <div className="text-left flex-1">
                      <div className="text-gray-500">Current streak</div>
                      <div className="font-medium text-gray-900">
                        {streak} {streak === 1 ? 'day' : 'days'}
                      </div>
                    </div>
                  </div>

                  {/* Last Brew */}
                  <div className="flex items-start gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="text-left flex-1">
                      <div className="text-gray-500">Last brew</div>
                      <div className="font-medium text-gray-900">{lastBrewDate}</div>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="w-full pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {userBrews.length}
                    </div>
                    <div className="text-xs text-gray-500">Brews</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {userCoffees.length}
                    </div>
                    <div className="text-xs text-gray-500">Coffees</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Tabs */}
          <div className="lg:col-span-3">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('brews')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'brews'
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Brews
                </button>
                <button
                  onClick={() => setActiveTab('coffees')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'coffees'
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Coffees
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'brews' ? (
              <BrewsTableView
                brews={userBrews}
                coffees={coffees}
                users={users}
                filterMethod={filterMethod}
                groupBy={groupBy}
                onFilterMethodChange={setFilterMethod}
                onGroupByChange={setGroupBy}
                onNewBrew={onNewBrew}
                onSelectBrew={setSelectedBrew}
                onEditBrew={onEditBrew}
                onDeleteBrew={onDeleteBrew}
                onDuplicateBrew={onDuplicateBrew}
                hoveredBrewRating={hoveredBrewRating}
                onHoverBrewRating={setHoveredBrewRating}
              />
            ) : (
              <CoffeesTableView
                coffees={userCoffees}
                brews={userBrews}
                filterMethod={filterMethod}
                groupBy={groupBy}
                onFilterMethodChange={setFilterMethod}
                onGroupByChange={setGroupBy}
                onNewCoffee={onNewCoffee}
                onSelectCoffee={setSelectedCoffee}
                onEditCoffee={onEditCoffee}
                onDeleteCoffee={onDeleteCoffee}
              />
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      {showEditProfile && (
        <EditProfileDialog
          profileData={profileData}
          onClose={() => setShowEditProfile(false)}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}