import React, { useState } from 'react';
import { ResilientImage } from './ResilientImage';

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  title: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeUrl,
  afterUrl,
  title,
  beforeLabel = 'Before Intervention',
  afterLabel = 'After Verification',
}) => {
  const [splitPercent, setSplitPercent] = useState(52);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#B5D8C7] bg-[#F5FAF7]">
        {/* After image (full base layer) */}
        <ResilientImage
          src={afterUrl}
          alt={`${title} — ${afterLabel}`}
          className="h-full w-full object-cover"
        />

        {/* Before image (clipped by slider percentage) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
        >
          <ResilientImage
            src={beforeUrl}
            alt={`${title} — ${beforeLabel}`}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Vertical divider indicator */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-sm"
          style={{ left: `${splitPercent}%` }}
        >
          <div className="absolute top-1/2 -left-3.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[#254B33] bg-white text-[11px] font-bold text-[#06271A] shadow">
            ↔
          </div>
        </div>

        {/* Corner Labels */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between text-xs font-medium">
          <span className="rounded bg-[#06271A]/85 px-2.5 py-1 text-white">
            {beforeLabel}
          </span>
          <span className="rounded bg-[#254B33]/90 px-2.5 py-1 text-white">
            {afterLabel}
          </span>
        </div>
      </div>

      {/* Accessible Slider & Quick Presets */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex flex-1 items-center gap-3 text-xs font-medium text-[#254B33]">
          <span className="whitespace-nowrap">Compare view</span>
          <input
            type="range"
            min={0}
            max={100}
            value={splitPercent}
            onChange={(e) => setSplitPercent(Number(e.target.value))}
            aria-label={`Before and after comparison slider for ${title}`}
            className="h-2 w-full cursor-pointer accent-[#254B33]"
          />
        </label>

        <div className="flex items-center gap-1 rounded-lg border border-[#B5D8C7] bg-white p-1">
          <button
            type="button"
            onClick={() => setSplitPercent(100)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              splitPercent >= 90
                ? 'bg-[#254B33] text-white'
                : 'text-[#254B33] hover:bg-[#F5FAF7]'
            }`}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => setSplitPercent(50)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              splitPercent > 10 && splitPercent < 90
                ? 'bg-[#254B33] text-white'
                : 'text-[#254B33] hover:bg-[#F5FAF7]'
            }`}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setSplitPercent(0)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              splitPercent <= 10
                ? 'bg-[#254B33] text-white'
                : 'text-[#254B33] hover:bg-[#F5FAF7]'
            }`}
          >
            After
          </button>
        </div>
      </div>
    </div>
  );
};
