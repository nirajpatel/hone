import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { X } from 'lucide-react';

interface StandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string | React.ReactNode;
  titleClassName?: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: string;
  maxWidth?: string;
  hideCloseButton?: boolean;
  footerContent?: React.ReactNode;
  titleAlign?: 'start' | 'center';
  headerActions?: React.ReactNode;
  sideNavLeft?: React.ReactNode;
  sideNavRight?: React.ReactNode;
}

export function StandardDialog({
  open,
  onOpenChange,
  title,
  titleClassName,
  subtitle,
  children,
  maxHeight = '90dvh',
  maxWidth = '40rem',
  hideCloseButton = false,
  footerContent,
  titleAlign = 'start',
  headerActions,
  sideNavLeft,
  sideNavRight,
}: StandardDialogProps) {
  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full flex flex-col overflow-hidden gap-0"
        style={{ maxHeight, maxWidth }}
        hideCloseButton
        onOpenAutoFocus={(e) => e.preventDefault()}
        sideNavLeft={sideNavLeft}
        sideNavRight={sideNavRight}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 min-h-0" style={{ overflowAnchor: 'none' }}>
          <DialogHeader
            className="border-b border-gray-200 -mx-6 px-6"
            style={{
              paddingBottom: 'calc(var(--spacing) * 3)',
              marginBottom: 'calc(var(--spacing) * 5)',
            }}
          >
            <DialogTitle className={`flex ${titleAlign === 'center' ? 'items-center' : 'items-start'} justify-between`}>
              <div className="min-w-0 flex-1 pr-2">
                {typeof title === 'string' ? (
                  <div className={`text-lg text-gray-900 font-semibold break-words ${titleClassName}`}>{title}</div>
                ) : (
                  title
                )}
                {subtitle && (
                  <div className="text-gray-600 mt-1 text-base font-normal break-words">{subtitle}</div>
                )}
              </div>
              <div className="flex items-center gap-0 flex-shrink-0">
                {headerActions}
              {!hideCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                    className="cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-0">{children}</div>
        </div>

        {footerContent && (
          <div className="flex-shrink-0 border-t border-gray-200 -mx-6 px-6 pt-4">
            {footerContent}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}