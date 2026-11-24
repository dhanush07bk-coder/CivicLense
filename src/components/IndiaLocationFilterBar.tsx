import React from 'react';

interface IndiaLocationFilterBarProps {
  stateFilter: string;
  cityFilter: string;
  availableStates: string[];
  availableCities: string[];
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  onReset: () => void;
  stateId: string;
  cityId: string;
  allStatesLabel?: string;
  allCitiesLabel?: string;
  resetLabel?: string;
  showLabels?: boolean;
  embedded?: boolean;
}

export const IndiaLocationFilterBar: React.FC<IndiaLocationFilterBarProps> = ({
  stateFilter,
  cityFilter,
  availableStates,
  availableCities,
  onStateChange,
  onCityChange,
  onReset,
  stateId,
  cityId,
  allStatesLabel = 'All Indian States / UTs',
  allCitiesLabel = 'All Indian Cities',
  resetLabel = 'Clear filters',
  showLabels = false,
  embedded = false,
}) => {
  const hasSelection = stateFilter !== 'All' || cityFilter !== 'All';

  const content = (
    <>
      <div className="flex-1 min-w-[180px]">
        <label
          htmlFor={stateId}
          className={
            showLabels
              ? 'mb-1 block text-[11px] font-semibold text-[#5E9185]'
              : 'sr-only'
          }
        >
          Filter by Indian State / UT
        </label>
        <select
          id={stateId}
          value={stateFilter}
          onChange={(e) => {
            onStateChange(e.target.value);
            onCityChange('All');
          }}
          className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
        >
          <option value="All">{allStatesLabel}</option>
          {availableStates.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[180px]">
        <label
          htmlFor={cityId}
          className={
            showLabels
              ? 'mb-1 block text-[11px] font-semibold text-[#5E9185]'
              : 'sr-only'
          }
        >
          Filter by Indian City
        </label>
        <select
          id={cityId}
          value={cityFilter}
          onChange={(e) => onCityChange(e.target.value)}
          className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
        >
          <option value="All">{allCitiesLabel}</option>
          {availableCities.map((ct) => (
            <option key={ct} value={ct}>
              {ct}
            </option>
          ))}
        </select>
      </div>

      {!embedded && hasSelection && (
        <button
          type="button"
          onClick={onReset}
          className={`${
            showLabels ? 'mt-4 ' : ''
          }text-xs font-semibold text-[#254B33] underline decoration-[#5E9185] underline-offset-4 hover:text-[#06271A]`}
        >
          {resetLabel}
        </button>
      )}
    </>
  );

  if (embedded) {
    return <>{content}</>;
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#B5D8C7] bg-white p-4">
      {content}
    </div>
  );
};
