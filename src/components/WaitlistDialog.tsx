import { useState, useEffect } from 'react';
import { StandardDialog } from './ui/standard-dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';
import { Loader2 } from 'lucide-react';
import { sanitizeErrorMessage } from '../utils/errorHandling';

interface EarlyAccessRequest {
  email: string;
  created_at: string;
  status: string;
  methods: string[];
}

interface WaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
}

export function WaitlistDialog({
  open,
  onOpenChange,
  accessToken,
}: WaitlistDialogProps) {
  const [requests, setRequests] = useState<EarlyAccessRequest[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchRequests();
    } else {
      // Reset state when dialog closes
      setSelectedEmails(new Set());
    }
  }, [open]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;
      const response = await fetch(`${apiUrl}/admin/early-access-requests`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch early access requests');
      }

      const data = await response.json();
      // Filter to only show pending requests and sort by date ascending (oldest first)
      const pendingRequests = data
        .filter((req: EarlyAccessRequest) => req.status === 'pending')
        .sort((a: EarlyAccessRequest, b: EarlyAccessRequest) => {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      setRequests(pendingRequests);
    } catch (error) {
      console.error('Error fetching early access requests:', error);
      toast.error('Failed to load early access requests');
    } finally {
      setLoading(false);
    }
  };

  const toggleEmail = (email: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedEmails(newSelected);
  };

  const handleApprove = async () => {
    if (selectedEmails.size === 0) {
      toast.error('Please select at least one request to approve');
      return;
    }

    setApproving(true);
    try {
      const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;
      const response = await fetch(`${apiUrl}/admin/approve-waitlist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: Array.from(selectedEmails),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve requests');
      }

      const result = await response.json();
      toast.success(`Successfully approved ${result.approved.length} request(s)`);
      
      // Refresh the list
      await fetchRequests();
      setSelectedEmails(new Set());
    } catch (error: any) {
      console.error('Error approving requests:', error);
      toast.error(sanitizeErrorMessage(error, 'Failed to approve requests'));
    } finally {
      setApproving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <StandardDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Early Access Waitlist"
      subtitle={`${requests.length} pending request${requests.length !== 1 ? 's' : ''}`}
      maxWidth="50rem"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No pending early access requests
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {requests.map((request) => (
                <div
                  key={request.email}
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Checkbox
                    id={`checkbox-${request.email}`}
                    checked={selectedEmails.has(request.email)}
                    onCheckedChange={() => toggleEmail(request.email)}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 ml-4">
                    <Label
                      htmlFor={`checkbox-${request.email}`}
                      className="cursor-pointer block"
                    >
                      <div>
                        <div className="text-sm text-gray-900 font-normal leading-normal">
                          {request.email}
                        </div>
                        <div className="text-sm text-gray-500 font-normal leading-normal">
                          Requested {formatDate(request.created_at)}
                        </div>
                        {request.methods && request.methods.length > 0 && (
                          <div className="text-sm text-gray-500 font-normal leading-normal">
                            Methods: {request.methods.join(', ')}
                          </div>
                        )}
                      </div>
                    </Label>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {selectedEmails.size} of {requests.length} selected
              </div>
              <Button
                onClick={handleApprove}
                disabled={selectedEmails.size === 0 || approving}
              >
                {approving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  `Approve ${selectedEmails.size > 0 ? `(${selectedEmails.size})` : ''}`
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </StandardDialog>
  );
}
