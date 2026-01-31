import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './tooltip';

interface SimpleTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  asChild?: boolean;
}

export function SimpleTooltip({ content, children, asChild = true }: SimpleTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const manuallyOpenedRef = React.useRef(false);

  // Clear timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle click/touch for mobile devices
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Toggle the tooltip
    const newOpenState = !open;
    manuallyOpenedRef.current = newOpenState;
    setOpen(newOpenState);

    // If opening, set timeout to auto-close after 5 seconds
    if (newOpenState) {
      timeoutRef.current = setTimeout(() => {
        manuallyOpenedRef.current = false;
        setOpen(false);
      }, 5000);
    }
  };

  // Custom onOpenChange that prevents closing when manually opened
  const handleOpenChange = (newOpen: boolean) => {
    // If trying to close but it was manually opened, ignore
    if (!newOpen && manuallyOpenedRef.current) {
      return;
    }
    
    // Clear timeout if closing
    if (!newOpen && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      manuallyOpenedRef.current = false;
    }
    
    setOpen(newOpen);
  };

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger 
        asChild={asChild}
        onPointerDown={handlePointerDown}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}