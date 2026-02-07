import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { toast } from 'sonner@2.0.3';
import { StandardDialog } from './ui/standard-dialog';
import { projectId } from '../utils/supabase/info';
import { User } from '../types';
import { Copy, Check, Users } from 'lucide-react';

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  accessToken: string;
  onUpdate: (user: User) => void;
}

// Format phone number as (XXX) XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');
  
  // Remove +1 prefix if present (since we show it in the UI)
  const withoutPrefix = numbers.startsWith('1') && numbers.length === 11 ? numbers.slice(1) : numbers;
  
  // Limit to 10 digits
  const limited = withoutPrefix.slice(0, 10);
  
  // Apply formatting
  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  } else {
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  }
};

// Remove formatting from phone number for storage (add +1 prefix)
const unformatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return `+1${numbers}`; // Add +1 prefix for storage
};

export function UserProfileDialog({
  open,
  onOpenChange,
  user,
  accessToken,
  onUpdate,
}: UserProfileDialogProps) {
  // Initialize with formatted phone number
  const initialPhone = user.phoneNumber 
    ? formatPhoneNumber(user.phoneNumber)
    : '';
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [smsConsent, setSmsConsent] = useState(user.smsConsent || false);
  const [saving, setSaving] = useState(false);
  
  // Household state
  const [household, setHousehold] = useState<any>(null);
  const [householdMembers, setHouseholdMembers] = useState<User[]>([]);
  const [loadingHousehold, setLoadingHousehold] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningHousehold, setJoiningHousehold] = useState(false);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteCodeError, setInviteCodeError] = useState('');

  // Update state when user prop changes or dialog opens
  useEffect(() => {
    if (open) {
      const phone = user.phoneNumber 
        ? formatPhoneNumber(user.phoneNumber)
        : '';
      setPhoneNumber(phone);
      setSmsConsent(user.smsConsent || false);
      setInviteCodeError(''); // Clear error when dialog opens
      fetchHousehold();
    }
  }, [open, user.phoneNumber, user.smsConsent]);

  const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;

  const fetchHousehold = async () => {
    try {
      setLoadingHousehold(true);
      const response = await fetch(`${apiUrl}/households/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setHousehold(data.household);
        setHouseholdMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching household:', error);
    } finally {
      setLoadingHousehold(false);
    }
  };

  const handleCreateHousehold = async () => {
    try {
      setCreatingHousehold(true);
      const response = await fetch(`${apiUrl}/households`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const newHousehold = await response.json();
        setHousehold(newHousehold);
        toast.success('Household created! Share the invite code with others.');
        
        // Refresh the current user to get updated householdId
        const userResponse = await fetch(`${apiUrl}/users/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userResponse.ok) {
          const updatedUser = await userResponse.json();
          onUpdate(updatedUser);
        }
        
        // Refresh household data
        await fetchHousehold();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create household');
      }
    } catch (error) {
      console.error('Error creating household:', error);
      toast.error('Failed to create household');
    } finally {
      setCreatingHousehold(false);
    }
  };

  const handleJoinHousehold = async () => {
    try {
      setJoiningHousehold(true);
      const response = await fetch(`${apiUrl}/households/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() }),
      });

      if (response.ok) {
        toast.success('Successfully joined household!');
        setInviteCode('');
        // Refresh household data
        await fetchHousehold();
        // Reload page to refresh all data with household scope
        window.location.reload();
      } else {
        const error = await response.json();
        setInviteCodeError(error.error || 'Failed to join household');
        toast.error(error.error || 'Failed to join household');
      }
    } catch (error) {
      console.error('Error joining household:', error);
      toast.error('Failed to join household');
    } finally {
      setJoiningHousehold(false);
    }
  };

  const handleCopyCode = () => {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode);
      setCopiedCode(true);
      toast.success('Invite code copied to clipboard');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate: if SMS consent is checked, phone number must be provided
      if (smsConsent && !phoneNumber.trim()) {
        toast.error('Please enter a phone number to receive SMS messages');
        setSaving(false);
        return;
      }

      // If phone number is removed, uncheck SMS consent
      const finalPhoneNumber = phoneNumber.trim() ? unformatPhoneNumber(phoneNumber) : null;
      const finalSmsConsent = finalPhoneNumber ? smsConsent : false;

      const response = await fetch(`${apiUrl}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          phoneNumber: finalPhoneNumber,
          smsConsent: finalSmsConsent,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error response from server:', error);
        throw new Error(error.error || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      onUpdate(updatedUser);
      toast.success('Account settings updated successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StandardDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Account Settings"
      titleClassName="text-lg"
      maxWidth="36rem"
      footerContent={
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 cursor-pointer">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Account Info Section */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Account Info</h3>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={user.name || ''} disabled className="mt-2" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled className="mt-2" />
          </div>
        </div>

        {/* Household Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-base font-semibold text-gray-900">
            Household
          </h3>
          
          {loadingHousehold ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : household ? (
            <div className="space-y-4">
              <div>
                <Label>Invite Code</Label>
                <div className="flex gap-2 mt-2">
                  <Input 
                    value={household.inviteCode} 
                    disabled 
                    className="font-mono text-base tracking-wider"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyCode}
                    className="cursor-pointer flex-shrink-0 h-9 w-9 p-0"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Share this code with others to invite them to your household
                </p>
              </div>
              
              <div>
                <Label>Members ({householdMembers.length})</Label>
                <div className="mt-2 space-y-2">
                  {householdMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {member.name}
                          {member.id === user.id && (
                            <span className="font-normal text-gray-500"> (You)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{member.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Create a household to share coffee inventory and extractions with others, or join an existing household with an invite code.
              </p>
              
              <div className="space-y-3">
                <Button
                  type="button"
                  onClick={handleCreateHousehold}
                  disabled={creatingHousehold}
                  className="w-full cursor-pointer"
                >
                  {creatingHousehold ? 'Creating...' : 'Create Household'}
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-gray-500">or</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Join with Invite Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="inviteCode"
                      placeholder="Enter code"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value.toUpperCase());
                        setInviteCodeError(''); // Clear error when typing
                      }}
                      className={`font-mono ${inviteCodeError ? 'border-red-500' : ''}`}
                    />
                    <Button
                      type="button"
                      onClick={handleJoinHousehold}
                      disabled={!inviteCode.trim() || joiningHousehold}
                      className="cursor-pointer flex-shrink-0"
                    >
                      {joiningHousehold ? 'Joining...' : 'Join'}
                    </Button>
                  </div>
                  {inviteCodeError && (
                    <p className="text-sm text-red-500 mt-1">{inviteCodeError}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SMS Notifications Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-base font-semibold text-gray-900">SMS Notifications</h3>
        <div>
          <Label htmlFor="phoneNumber">
            Phone Number <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="relative mt-2">
            <div className="absolute left-3 pointer-events-none select-none text-sm" style={{ top: '8.5px' }}>+1</div>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="(123) 456-7890"
              value={phoneNumber}
              onChange={handlePhoneChange}
              className="pl-[30px]"
            />
          </div>
        </div>
        <div className="mb-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="smsConsent"
              checked={smsConsent}
              onCheckedChange={(checked) => setSmsConsent(checked as boolean)}
              className="mt-1"
            />
            <div className="flex-1" style={{ lineHeight: 1 }}>
              <label htmlFor="smsConsent" className="cursor-pointer" style={{ fontSize: '14px', fontWeight: 400, display: 'block' }}>
                By checking this box, you agree to receive recurring SMS messages from Hone related to rating your coffee brews. Message frequency varies (up to 2 messages per brew). SMS consent is not required to use the app. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. See{' '}
                <a 
                  href="https://hone.coffee/terms" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Terms and Conditions
                </a>.
              </label>
            </div>
          </div>
        </div>
        </div>
      </div>
    </StandardDialog>
  );
}