import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './tooltip';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

interface SimpleTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  asChild?: boolean;
}

export function SimpleTooltip({ content, children, asChild = true }: SimpleTooltipProps) {
  const isDesktop = useIsDesktop();
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

  if (!isDesktop) {
    return <>{children}</>;
  }

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