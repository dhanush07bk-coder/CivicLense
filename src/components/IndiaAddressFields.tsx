import React from 'react';
import { INDIAN_STATES_AND_UTS } from '../utils/indiaGeo';

interface IndiaAddressFieldsProps {
  idPrefix: string;
  stateName: string;
  district: string;
  city: string;
  locality: string;
  pinCode: string;
  errors?: Record<string, string>;
  onChange: (
    field: 'state' | 'district' | 'city' | 'locality' | 'pin_code',
    value: string,
  ) => void;
  compact?: boolean;
}

export const IndiaAddressFields: React.FC<IndiaAddressFieldsProps> = ({
  idPrefix,
  stateName,
  district,
  city,
  locality,
  pinCode,
  errors = {},
  onChange,
  compact = false,
}) => {
  const inputTextClass = compact ? 'px-3 py-2 text-xs' : 'px-3 py-2.5 text-sm';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor={`${idPrefix}-state`}
            className="block text-xs font-semibold text-[#06271A]"
          >
            State / Union Territory <span className="text-red-700">*</span>
          </label>
          <select
            id={`${idPrefix}-state`}
            value={stateName}
            onChange={(e) => onChange('state', e.target.value)}
            aria-invalid={Boolean(errors.state)}
            className={`w-full rounded-lg border border-[#9CCCCC] bg-white ${inputTextClass} text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]`}
          >
            <option value="">Select Indian State / UT</option>
            {INDIAN_STATES_AND_UTS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          {errors.state && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errors.state}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${idPrefix}-district`}
            className="block text-xs font-semibold text-[#06271A]"
          >
            District <span className="text-red-700">*</span>
          </label>
          <input
            id={`${idPrefix}-district`}
            type="text"
            value={district}
            onChange={(e) => onChange('district', e.target.value)}
            placeholder="e.g., Bengaluru Urban"
            aria-invalid={Boolean(errors.district)}
            className={`w-full rounded-lg border border-[#9CCCCC] bg-white ${inputTextClass} text-[#06271A] placeholder:text-[#5E9185]/80 focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]`}
          />
          {errors.district && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errors.district}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${idPrefix}-city`}
            className="block text-xs font-semibold text-[#06271A]"
          >
            City / Town <span className="text-red-700">*</span>
          </label>
          <input
            id={`${idPrefix}-city`}
            type="text"
            value={city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="e.g., Bengaluru"
            aria-invalid={Boolean(errors.city)}
            className={`w-full rounded-lg border border-[#9CCCCC] bg-white ${inputTextClass} text-[#06271A] placeholder:text-[#5E9185]/80 focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]`}
          />
          {errors.city && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errors.city}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${idPrefix}-pincode`}
            className="block text-xs font-semibold text-[#06271A]"
          >
            PIN Code (6-digit Indian PIN) <span className="text-red-700">*</span>
          </label>
          <input
            id={`${idPrefix}-pincode`}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pinCode}
            onChange={(e) =>
              onChange('pin_code', e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="e.g., 560038"
            aria-invalid={Boolean(errors.pin_code)}
            className={`w-full rounded-lg border border-[#9CCCCC] bg-white ${inputTextClass} font-mono-tabular text-[#06271A] placeholder:text-[#5E9185]/80 focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]`}
          />
          {errors.pin_code && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errors.pin_code}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-locality`}
          className="block text-xs font-semibold text-[#06271A]"
        >
          Locality / Area / Landmark <span className="text-red-700">*</span>
        </label>
        <input
          id={`${idPrefix}-locality`}
          type="text"
          value={locality}
          onChange={(e) => onChange('locality', e.target.value)}
          placeholder="e.g., Indiranagar 12th Main, opposite BDA Park"
          aria-invalid={Boolean(errors.locality)}
          className={`w-full rounded-lg border border-[#9CCCCC] bg-white ${inputTextClass} text-[#06271A] placeholder:text-[#5E9185]/80 focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]`}
        />
        {errors.locality && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {errors.locality}
          </p>
        )}
      </div>
    </div>
  );
};
