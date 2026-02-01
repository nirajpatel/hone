import * as React from 'react';
import * as TooltipPrimitive from "@radix-ui/react-tooltip@1.1.8";
import { cn } from './utils';

interface DelayedHelpTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  asChild?: boolean;
  delayMs?: number; // Delay before tooltip can appear (default 1000ms = 1 second)
  hoverDurationMs?: number; // How long user must hover before showing (default 1000ms = 1 second)
}

export function DelayedHelpTooltip({ 
  content, 
  children, 
  asChild = true,
  delayMs = 1000, // 1 second delay before tooltip can appear
  hoverDurationMs = 1000, // User must hover for 1 second
}: DelayedHelpTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const [delayElapsed, setDelayElapsed] = React.useState(false);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const delayTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Clear timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
    };
  }, []);

  // Start delay timer when component mounts (only once)
  React.useEffect(() => {
    delayTimeoutRef.current = setTimeout(() => {
      setDelayElapsed(true);
    }, delayMs);

    return () => {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
    };
  }, [delayMs]);

  const handleMouseEnter = (e: React.MouseEvent) => {
    // Only show if delay has elapsed
    if (!delayElapsed) {
      return;
    }

    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set timeout to show tooltip after hover duration
    hoverTimeoutRef.current = setTimeout(() => {
      // Only show if delay has elapsed
      if (delayElapsed) {
        setOpen(true);
      }
    }, hoverDurationMs);
  };

  const handleMouseLeave = () => {
    // Clear hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    setOpen(false);
  };

  const handleClick = () => {
    // Close tooltip on click
    setOpen(false);
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing, not opening (we control opening via our logic)
    // This prevents Radix UI from opening it automatically
    if (!newOpen) {
      setOpen(false);
    } else if (!delayElapsed) {
      // Prevent opening if delay hasn't elapsed
      setOpen(false);
    }
  };

  return (
    <TooltipPrimitive.Provider delayDuration={999999}>
      <TooltipPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <TooltipPrimitive.Trigger 
          asChild={asChild}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={0}
            className={cn(
              "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance"
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
