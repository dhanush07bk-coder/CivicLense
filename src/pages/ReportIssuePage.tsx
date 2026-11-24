import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  Shield,
  Trash2,
} from 'lucide-react';
import {
  CivicIssue,
  IssueCategory,
  MapCoordinate,
  PageRoute,
  UserAccount,
} from '../types/civic';
import {
  IssueSubmissionInput,
  requiresAuthoritySafetyAdvisory,
  validateImageFile,
  validateIssueSubmission,
} from '../utils/civicLogic';
import { INDIA_COUNTRY_CODE } from '../utils/indiaGeo';
import { SEED_BEFORE_WASTE_IMAGE } from '../data/seedData';
import {
  LocationPickerMap,
  SelectedIndiaMapLocation,
} from '../components/LocationPickerMap';
import { IndiaAddressFields } from '../components/IndiaAddressFields';
import { ResilientImage } from '../components/ResilientImage';

interface ReportIssuePageProps {
  currentUser: UserAccount | null;
  isSupabaseMode?: boolean;
  onSubmitIssue: (
    input: IssueSubmissionInput,
    options?: { imageFile?: File | null },
  ) => Promise<{ ok: boolean; issue?: CivicIssue; error?: string }>;
  onTrackReport: (reportId: string) => void;
  onNavigate: (route: PageRoute) => void;
}

const CATEGORIES = Object.values(IssueCategory);

export const ReportIssuePage: React.FC<ReportIssuePageProps> = ({
  currentUser,
  isSupabaseMode = false,
  onSubmitIssue,
  onTrackReport,
  onNavigate,
}) => {
  const [category, setCategory] = useState<IssueCategory | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Mandatory India-only structured location fields
  const [stateName, setStateName] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [locality, setLocality] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [selectedMapLoc, setSelectedMapLoc] = useState<
    SelectedIndiaMapLocation | undefined
  >(undefined);
  const [mapConfirmed, setMapConfirmed] = useState(false);

  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedIssue, setSubmittedIssue] = useState<CivicIssue | null>(null);

  const showSafetyAdvisory = requiresAuthoritySafetyAdvisory(
    category,
    title,
    description,
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateImageFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!validation.valid) {
      setErrors((prev) => ({
        ...prev,
        image: validation.error ?? 'Invalid image upload.',
      }));
      return;
    }

    setImageFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setImageFileName(file.name);
        setErrors((prev) => ({ ...prev, image: '' }));
      }
    };
    reader.onerror = () => {
      setImageFile(null);
      setErrors((prev) => ({
        ...prev,
        image: 'Unable to read the selected image file. Please try another photo.',
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddressFieldChange = (
    field: 'state' | 'district' | 'city' | 'locality' | 'pin_code',
    value: string,
  ) => {
    if (field === 'state') setStateName(value);
    if (field === 'district') setDistrict(value);
    if (field === 'city') setCity(value);
    if (field === 'locality') setLocality(value);
    if (field === 'pin_code') setPinCode(value);

    // Require re-confirmation when address fields change after map pin placement
    if (selectedMapLoc) {
      setMapConfirmed(false);
    }

    setErrors((prev) => ({
      ...prev,
      [field]: '',
      coordinates: '',
      mapConfirmed: '',
    }));
  };

  const handleMapSelect = (
    loc: SelectedIndiaMapLocation,
    options?: { preserveExistingOnEmpty?: boolean },
  ) => {
    setSelectedMapLoc(loc);
    const preserve = options?.preserveExistingOnEmpty;

    if (loc.state || !preserve) {
      setStateName((prev) => loc.state || (preserve ? prev : ''));
    }
    if (loc.district || !preserve) {
      setDistrict((prev) => loc.district || (preserve ? prev : ''));
    }
    if (loc.city || !preserve) {
      setCity((prev) => loc.city || (preserve ? prev : ''));
    }
    if (loc.locality || !preserve) {
      setLocality((prev) => loc.locality || (preserve ? prev : ''));
    }
    if (loc.pin_code || !preserve) {
      setPinCode((prev) => loc.pin_code || (preserve ? prev : ''));
    }

    setErrors((prev) => ({
      ...prev,
      state: '',
      district: '',
      city: '',
      locality: '',
      pin_code: '',
      coordinates: '',
      mapConfirmed: '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const coordinates: MapCoordinate | undefined = selectedMapLoc
      ? {
          lat: selectedMapLoc.lat,
          lng: selectedMapLoc.lng,
          zoneLabel: selectedMapLoc.zoneLabel,
        }
      : undefined;

    const payload: IssueSubmissionInput = {
      category,
      title,
      description,
      country_code: INDIA_COUNTRY_CODE,
      state: stateName,
      district,
      city,
      locality,
      pin_code: pinCode,
      latitude: selectedMapLoc?.lat,
      longitude: selectedMapLoc?.lng,
      coordinates,
      mapConfirmed,
      requireMapSelection: true,
      imageUrl: isSupabaseMode ? undefined : imageUrl,
      isAnonymous,
      reporterEmail: currentUser?.email,
    };

    const validation = validateIssueSubmission(payload);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const result = await onSubmitIssue(payload, { imageFile });
      if (!result.ok || !result.issue) {
        setErrors({
          form:
            result.error ??
            'Unable to submit civic report. Verify India location details and network connection.',
        });
        return;
      }
      setSubmittedIssue(result.issue);
      setErrors({});
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setCategory('');
    setTitle('');
    setDescription('');
    setStateName('');
    setDistrict('');
    setCity('');
    setLocality('');
    setPinCode('');
    setSelectedMapLoc(undefined);
    setMapConfirmed(false);
    setImageUrl(undefined);
    setImageFile(null);
    setImageFileName('');
    setIsAnonymous(true);
    setErrors({});
    setSubmittedIssue(null);
  };

  if (submittedIssue) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-[#5E9185] bg-white p-6 sm:p-10 space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#B5D8C7]/45 text-[#254B33]">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
                Report Logged for Verification · India (IN)
              </p>
              <h1 className="font-display text-2xl font-bold text-[#06271A]">
                Thank you for helping care for your neighbourhood
              </h1>
              <p className="text-sm text-[#254B33]">
                {isSupabaseMode
                  ? 'Your report has been saved to the Civilense Supabase database and marked as '
                  : 'Your report has been saved locally in this prototype and marked as '}
                <span className="font-semibold">Submitted</span> (awaiting
                coordinator verification).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#254B33]">
                {isSupabaseMode ? 'Tracking Report Code' : 'Unique Demo Report ID'}
              </span>
              <span className="font-mono-tabular rounded-md border border-[#5E9185] bg-white px-3 py-1 text-base font-bold text-[#06271A]">
                {submittedIssue.id}
              </span>
            </div>
            <div className="grid gap-2 text-sm text-[#254B33] sm:grid-cols-2">
              <p>
                <span className="font-medium text-[#06271A]">Category:</span>{' '}
                {submittedIssue.category}
              </p>
              <p>
                <span className="font-medium text-[#06271A]">State / City:</span>{' '}
                {submittedIssue.city}, {submittedIssue.state}
              </p>
              <p>
                <span className="font-medium text-[#06271A]">Locality &amp; PIN:</span>{' '}
                {submittedIssue.locality} — {submittedIssue.pin_code}
              </p>
              <p>
                <span className="font-medium text-[#06271A]">Privacy:</span>{' '}
                {submittedIssue.isAnonymous
                  ? 'Anonymous submission'
                  : 'Reporter email kept private'}
              </p>
            </div>
          </div>

          {submittedIssue.safetyAdvisoryShown && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <p>
                Because this report involves an electrical or infrastructure hazard,
                please keep clear of the site and also notify your local municipal
                utility helpline directly so qualified technicians can respond safely.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onTrackReport(submittedIssue.id)}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-[#254B33] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06271A]"
            >
              Track This Report
            </button>
            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[#5E9185] bg-white px-5 py-2.5 text-sm font-semibold text-[#254B33] transition-colors hover:bg-[#F5FAF7]"
            >
              Submit Another Report
            </button>
            <button
              type="button"
              onClick={() => onNavigate('community')}
              className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium text-[#254B33] underline decoration-[#5E9185] underline-offset-4 hover:text-[#06271A]"
            >
              Join a Community Activity
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-12">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
          Civic Observation Form · India Only
        </p>
        <h1 className="font-display text-3xl font-bold text-[#06271A] sm:text-4xl">
          Report a Civic Issue
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[#254B33] sm:text-base">
          Share objective details about a public space issue in India. All
          submissions start as <span className="font-semibold">Submitted</span> and
          are verified before appearing as confirmed outcomes.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-[#B5D8C7] bg-white p-6 sm:p-8 space-y-6"
      >
        {errors.form && (
          <p
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
          >
            {errors.form}
          </p>
        )}

        {/* Category */}
        <div className="space-y-1.5">
          <label
            htmlFor="issue-category"
            className="block text-sm font-semibold text-[#06271A]"
          >
            Issue Category <span className="text-red-700">*</span>
          </label>
          <select
            id="issue-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as IssueCategory | '');
              setErrors((prev) => ({ ...prev, category: '' }));
            }}
            aria-invalid={Boolean(errors.category)}
            className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3.5 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
          >
            <option value="">Select a civic issue category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors.category && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errors.category}
            </p>
          )}
        </div>

        {/* Authority Safety Advisory for Hazardous Infrastructure */}
        {showSafetyAdvisory && (
          <div
            role="note"
            className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Safety &amp; Authority Guidance</p>
              <p className="text-xs leading-relaxed">
                Electrical, gas, or structural hazards must only be handled by
                qualified municipal technicians or emergency responders. Never touch
                exposed wiring or attempt DIY repairs—submit this log for escalation
                and maintain a safe perimeter.
              </p>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="issue-title"
            className="block text-sm font-semibold text-[#06271A]"
          >
            Issue Title <span className="text-red-700">*</span>
          </label>
          <input
            id="issue-title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((prev) => ({ ...prev, title: '' }));
            }}
            placeholder="e.g., Overflowing sorting bin near Indiranagar 12th Main"
            aria-invalid={Boolean(errors.title)}
            className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3.5 py-2.5 text-sm text-[#06271A] placeholder:text-[#5E9185]/80 focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
          />
          {errors.title && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errors.title}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label
            htmlFor="issue-description"
            className="block text-sm font-semibold text-[#06271A]"
          >
            Neutral Description <span className="text-red-700">*</span>
          </label>
          <textarea
            id="issue-description"
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((prev) => ({ ...prev, description: '' }));
            }}
            placeholder="Describe the physical condition, accessibility impact, or duration without naming individuals."
            aria-invalid={Boolean(errors.description)}
            className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3.5 py-2.5 text-sm text-[#06271A] placeholder:text-[#5E9185]/80 focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
          />
          {errors.description && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errors.description}
            </p>
          )}
        </div>

        {/* Structured India-Only Location Fields */}
        <div className="rounded-xl border border-[#B5D8C7] bg-[#F8FBF9] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#B5D8C7]/60 pb-3">
            <div>
              <h2 className="font-display text-sm font-bold text-[#06271A]">
                Location Details (India Only)
              </h2>
              <p className="text-xs text-[#254B33]/85">
                Use the India map search below or enter your Indian locality manually,
                then confirm the map pin.
              </p>
            </div>
            <div className="rounded-md border border-[#5E9185] bg-white px-3 py-1 text-xs font-semibold text-[#06271A]">
              Country: India (IN)
            </div>
          </div>

          <IndiaAddressFields
            idPrefix="issue"
            stateName={stateName}
            district={district}
            city={city}
            locality={locality}
            pinCode={pinCode}
            errors={errors}
            onChange={handleAddressFieldChange}
          />

          {errors.coordinates && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errors.coordinates}
            </p>
          )}
        </div>

        {/* India-Restricted Map Pin Selector */}
        <LocationPickerMap
          selected={selectedMapLoc}
          confirmed={mapConfirmed}
          onSelect={handleMapSelect}
          onConfirmChange={(nextConfirmed) => {
            setMapConfirmed(nextConfirmed);
            setErrors((prev) => ({ ...prev, mapConfirmed: '', coordinates: '' }));
          }}
          confirmError={errors.mapConfirmed}
        />

        {/* Image Upload with Validation & Preview */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="issue-image"
              className="block text-sm font-semibold text-[#06271A]"
            >
              Photo Evidence (Optional)
            </label>
            {!imageUrl && !isSupabaseMode && (
              <button
                type="button"
                onClick={() => {
                  setImageUrl(SEED_BEFORE_WASTE_IMAGE);
                  setImageFile(null);
                  setImageFileName('sample-civic-site.jpg');
                  setErrors((prev) => ({ ...prev, image: '' }));
                }}
                className="text-xs font-medium text-[#254B33] underline decoration-[#5E9185] underline-offset-4 hover:text-[#06271A]"
              >
                Use sample inspection photo
              </button>
            )}
          </div>

          {!imageUrl ? (
            <label
              htmlFor="issue-image"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#5E9185] bg-[#F5FAF7] px-4 py-8 text-center transition-colors hover:bg-[#B5D8C7]/25"
            >
              <ImagePlus className="h-6 w-6 text-[#254B33]" aria-hidden="true" />
              <span className="text-sm font-medium text-[#06271A]">
                Click to upload a neighbourhood photo
              </span>
              <span className="text-xs text-[#254B33]/80">
                JPEG, PNG, or WebP up to 2 MB · Focus on the public space, never faces
                or private vehicle plates
              </span>
              <input
                id="issue-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="sr-only"
              />
            </label>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#B5D8C7] bg-[#F5FAF7]">
              <div className="aspect-[16/9] max-h-64 w-full overflow-hidden bg-[#B5D8C7]/20">
                <ResilientImage
                  src={imageUrl}
                  alt="Uploaded issue preview"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate text-xs font-medium text-[#254B33]">
                  {imageFileName || 'Attached inspection preview'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl(undefined);
                    setImageFile(null);
                    setImageFileName('');
                    setErrors((prev) => ({ ...prev, image: '' }));
                  }}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}

          {errors.image && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errors.image}
            </p>
          )}
        </div>

        {/* Anonymous Reporting Toggle */}
        <div className="flex items-start justify-between gap-4 rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#254B33]" aria-hidden="true" />
            <div className="space-y-0.5">
              <label
                htmlFor="anonymous-toggle"
                className="block text-sm font-semibold text-[#06271A]"
              >
                Anonymous Reporting
              </label>
              <p className="text-xs leading-relaxed text-[#254B33]/85">
                Even when turned off, reporter identity is never displayed on public
                issue tracking pages.
              </p>
            </div>
          </div>

          <input
            id="anonymous-toggle"
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="mt-1 h-5 w-5 cursor-pointer rounded border-[#5E9185] accent-[#254B33]"
          />
        </div>

        {/* Submit */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#B5D8C7]/60 pt-5">
          <p className="text-xs text-[#254B33]/80">
            {isSupabaseMode
              ? 'India-only PostGIS & PIN validation enforced · Stored in Supabase'
              : 'India-only PIN & map confirmation enforced · Local Demo Mode'}
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#254B33] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06271A] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#254B33]"
          >
            {submitting ? 'Submitting Report...' : 'Submit Report'}
          </button>
        </div>
      </form>
    </section>
  );
};
