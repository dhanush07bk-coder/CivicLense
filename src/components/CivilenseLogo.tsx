import React from 'react';

interface CivilenseLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  inverted?: boolean;
}

export const CivilenseLogo: React.FC<CivilenseLogoProps> = ({
  size = 'md',
  showWordmark = true,
  inverted = false,
}) => {
  const iconDimensions =
    size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const wordmarkSize =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  const ringStroke = inverted ? '#9CCCCC' : '#5E9185';
  const pinFill = inverted ? '#B5D8C7' : '#254B33';
  const leafFill = inverted ? '#06271A' : '#B5D8C7';
  const stemStroke = inverted ? '#B5D8C7' : '#254B33';

  return (
    <span className="inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0">
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconDimensions} shrink-0`}
        aria-hidden="true"
      >
        {/* Outer circular community ring */}
        <circle
          cx="18"
          cy="18"
          r="15.25"
          stroke={ringStroke}
          strokeWidth="2"
          strokeDasharray="78 18"
          strokeLinecap="round"
        />
        {/* Subtle geometric location pin */}
        <path
          d="M18 6C12.48 6 8 10.48 8 16c0 6.8 8.35 13.7 9.45 14.58a.88.88 0 0 0 1.1 0C19.65 29.7 28 22.8 28 16c0-5.52-4.48-10-10-10Z"
          fill={pinFill}
        />
        {/* Minimal botanical leaf inside pin */}
        <path
          d="M18 10.5c-3.1 2.2-4.5 5.2-3.8 8.1.48 1.97 1.98 3.2 3.8 3.4 1.82-.2 3.32-1.43 3.8-3.4.7-2.9-.7-5.9-3.8-8.1Z"
          fill={leafFill}
        />
        {/* Leaf central rib */}
        <path
          d="M18 11.75v10.1"
          stroke={stemStroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {showWordmark && (
        <span
          className={`font-display font-bold tracking-tight ${wordmarkSize} ${
            inverted ? 'text-white' : 'text-[#06271A]'
          }`}
        >
          Civilense
        </span>
      )}
    </span>
  );
};
