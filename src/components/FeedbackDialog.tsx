import { useState, useEffect, useRef } from 'react';
import { StandardDialog } from './ui/standard-dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string;
}

export function FeedbackDialog({ open, onOpenChange, userEmail }: FeedbackDialogProps) {
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is fully rendered and animation completes
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      toast.error('Please enter your feedback');
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;
      const response = await fetch(`${apiUrl}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          feedback: feedback.trim(),
          userEmail: userEmail || 'Unknown',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send feedback');
      }

      toast.success('Thank you for your feedback!');
      setFeedback('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StandardDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Help us improve Hone"
      subtitle={<span className="text-sm">Your feedback helps us make every brew better</span>}
      maxWidth="500px"
      footerContent={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFeedback('');
              onOpenChange(false);
            }}
            disabled={isSubmitting}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e);
            }}
            disabled={isSubmitting || !feedback.trim()}
            className="cursor-pointer"
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 mb-4">
        <Textarea
          ref={textareaRef}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Ideas, issues, or suggestions?"
          className="resize-none"
          rows={3}
          style={{ minHeight: '72px', height: '72px' }}
          disabled={isSubmitting}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (feedback.trim() && !isSubmitting) {
                handleSubmit(e);
              }
            }
          }}
        />
      </div>
    </StandardDialog>
  );
}
