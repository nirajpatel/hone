import { useState } from 'react';
import { StandardDialog } from './ui/standard-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface ProfileData {
  photoUrl?: string;
  city?: string;
  bio?: string;
}

interface EditProfileDialogProps {
  profileData: ProfileData;
  onClose: () => void;
  onSave: (data: ProfileData) => void;
}

export function EditProfileDialog({ profileData, onClose, onSave }: EditProfileDialogProps) {
  const [photoUrl, setPhotoUrl] = useState(profileData.photoUrl || '');
  const [city, setCity] = useState(profileData.city || '');
  const [bio, setBio] = useState(profileData.bio || '');

  const handleSave = () => {
    onSave({
      photoUrl: photoUrl.trim() || undefined,
      city: city.trim() || undefined,
      bio: bio.trim() || undefined,
    });
  };

  return (
    <StandardDialog open={true} onOpenChange={onClose}>
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-6">Edit Profile</h2>

        <div className="space-y-4">
          {/* Profile Photo URL */}
          <div>
            <Label htmlFor="photoUrl">Profile Photo URL</Label>
            <Input
              id="photoUrl"
              type="url"
              placeholder="https://example.com/photo.jpg"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter a URL to your profile photo
            </p>
          </div>

          {/* City */}
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              type="text"
              placeholder="San Francisco, CA"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Bio/Tagline */}
          <div>
            <Label htmlFor="bio">Coffee Tagline / Bio</Label>
            <Textarea
              id="bio"
              placeholder="Pour over enthusiast, specialty coffee lover"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              {bio.length}/200 characters
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </StandardDialog>
  );
}
