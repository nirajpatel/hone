export function EspressoLoading() {
  return (
    <div className="flex items-center justify-center">
      <svg width="80" height="110" viewBox="0 0 80 110" xmlns="http://www.w3.org/2000/svg" className="w-20 h-28 sm:w-20 sm:h-28">
        {/* Clip path to only show portion below the horizontal line */}
        <defs>
          <clipPath id="belowLine">
            <rect x="0" y="20" width="80" height="90" />
          </clipPath>
        </defs>

        {/* Portafilter shape - vertical lines with horizontal bar */}
        <path d="M 27.5 16 L 27.5 20 L 52.5 20 L 52.5 16"
              stroke="black" 
              strokeWidth="3.25" 
              strokeLinejoin="miter"
              strokeLinecap="square"
              fill="none" />

        {/* Drip */}
        <circle cx="40" cy="30" r="3" fill="black" clipPath="url(#belowLine)">
          {/* Fall - start above the line, end below */}
          <animate
            attributeName="cy"
            dur="1.25s"
            repeatCount="indefinite"
            values="15;23;40;40"
            keyTimes="0;0.6;0.95;1"
            calcMode="linear"
          />

          {/* Fade at end */}
          <animate
            attributeName="opacity"
            dur="1.25s"
            repeatCount="indefinite"
            values="1;1;0;0"
            keyTimes="0;0.8;0.95;1"
            calcMode="linear"
          />
        </circle>
      </svg>
    </div>
  );
}