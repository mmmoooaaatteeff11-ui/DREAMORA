'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { Swatch } from '@/components/ui/Swatch';
import { CHARACTER_COLORS, type RgbColor } from '@/components/world/palette';
import { saveWorldProfile } from '@/server/services/world';
import { initialActionState } from '@/types/action';
import type { WorldProfile } from '@/lib/validation/world';

type CharacterSection = 'character' | 'companion';
type SwatchOption = { value: number; color: string; label: string };

export function WorldCharacterForm({
  profile,
  section,
  onProfileChange,
}: {
  profile: WorldProfile;
  section: CharacterSection;
  onProfileChange: (profile: WorldProfile) => void;
}) {
  const t = useTranslations('world');
  const [state, formAction] = useFormState(saveWorldProfile, initialActionState);
  const [dirty, setDirty] = useState(false);
  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? t(`errors.${state.fieldErrors[name]}`) : undefined;
  const update = <K extends keyof WorldProfile,>(key: K, value: WorldProfile[K]) => {
    setDirty(true);
    onProfileChange({ ...profile, [key]: value });
  };

  return (
    <form action={formAction} onSubmit={() => setDirty(false)} noValidate className="space-y-4">
      {state.status === 'error' && state.code && (
        <p role="alert" className="flex items-start gap-2 rounded-[10px] border border-[var(--w-danger)] bg-[var(--w-surface)] px-4 py-3 text-sm text-[var(--w-danger)]">
          <ErrorIcon />
          <span>{t(`errors.${state.code}`)}</span>
        </p>
      )}
      {state.status === 'success' && (
        <p role="status" className="rounded-[10px] border border-[var(--w-border)] bg-[var(--w-surface)] px-4 py-3 text-sm text-[var(--w-ink)]">
          {t('character.saved')}
        </p>
      )}

      <fieldset hidden={section !== 'character'} className="space-y-4">
        <legend className="sr-only">{t('character.hero')}</legend>
        <NameField
          name="heroName"
          label={t('character.heroName')}
          value={profile.heroName}
          error={fieldError('heroName')}
          onChange={(value) => update('heroName', value)}
        />
        <input type="hidden" name="heroGender" value={profile.heroGender} />
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--w-ink)]">{t('character.gender')}</p>
          <Segmented
            label={t('character.gender')}
            value={profile.heroGender}
            options={[
              { value: 'm', label: t('character.genderOptions.m') },
              { value: 'f', label: t('character.genderOptions.f') },
            ]}
            onChange={(value) => {
              if (value === 'm' || value === 'f') update('heroGender', value);
            }}
          />
          {fieldError('heroGender') && <FieldError message={fieldError('heroGender')!} />}
        </div>
        <SwatchGroup
          name="heroSkin"
          label={t('character.skin')}
          value={profile.heroSkin}
          colors={CHARACTER_COLORS.skin}
          getLabel={(index) => t('character.swatchLabels.skin', { number: index + 1 })}
          error={fieldError('heroSkin')}
          onChange={(value) => update('heroSkin', value)}
        />
        <SwatchGroup
          name="heroHair"
          label={t('character.hair')}
          value={profile.heroHair}
          colors={CHARACTER_COLORS.hair}
          getLabel={(index) => t('character.swatchLabels.hair', { number: index + 1 })}
          error={fieldError('heroHair')}
          onChange={(value) => update('heroHair', value)}
        />
        <SwatchGroup
          name="heroShirt"
          label={t('character.shirt')}
          value={profile.heroShirt}
          colors={CHARACTER_COLORS.shirt}
          getLabel={(index) => t('character.swatchLabels.shirt', { number: index + 1 })}
          error={fieldError('heroShirt')}
          onChange={(value) => update('heroShirt', value)}
        />
      </fieldset>

      <fieldset hidden={section !== 'companion'} className="space-y-4">
        <legend className="sr-only">{t('character.companion')}</legend>
        <NameField
          name="companionName"
          label={t('character.companionName')}
          value={profile.companionName}
          error={fieldError('companionName')}
          onChange={(value) => update('companionName', value)}
        />
        <input type="hidden" name="companionGender" value={profile.companionGender} />
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--w-ink)]">{t('character.gender')}</p>
          <Segmented
            label={t('character.gender')}
            value={profile.companionGender}
            options={[
              { value: 'm', label: t('character.genderOptions.m') },
              { value: 'f', label: t('character.genderOptions.f') },
            ]}
            onChange={(value) => {
              if (value === 'm' || value === 'f') update('companionGender', value);
            }}
          />
          {fieldError('companionGender') && <FieldError message={fieldError('companionGender')!} />}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[var(--w-ink)]">{t('character.form')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['nur', 'fox', 'spirit'] as const).map((form) => (
              <label key={form} className="cursor-pointer">
                <input
                  type="radio"
                  name="companionForm"
                  value={form}
                  checked={profile.companionForm === form}
                  onChange={() => update('companionForm', form)}
                  className="peer sr-only"
                />
                <span className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-[10px] border border-[var(--w-border)] bg-[var(--w-surface)] p-4 text-center text-sm text-[var(--w-ink)] transition peer-checked:border-[var(--w-primary)] peer-checked:bg-[var(--w-surface-2)] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--w-accent)]">
                  <FormIcon form={form} />
                  {t(`character.formOptions.${form}`)}
                </span>
              </label>
            ))}
          </div>
          {fieldError('companionForm') && <FieldError message={fieldError('companionForm')!} />}
        </fieldset>

        <SwatchGroup
          name="companionTint"
          label={t('character.tint')}
          value={profile.companionTint}
          colors={CHARACTER_COLORS.companion}
          getLabel={(index) => t('character.swatchLabels.companion', { number: index + 1 })}
          error={fieldError('companionTint')}
          onChange={(value) => update('companionTint', value)}
        />

        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--w-ink)]">
          <input
            type="checkbox"
            name="voiceEnabled"
            checked={profile.voiceEnabled}
            onChange={(event) => update('voiceEnabled', event.target.checked)}
            className="h-5 w-5 rounded-[10px] border border-[var(--w-border)] bg-[var(--w-surface)] accent-[var(--w-primary)] focus-visible:ring-2 focus-visible:ring-[var(--w-accent)]"
          />
          {t('character.voice')}
        </label>
      </fieldset>

      {fieldError('form') && <FieldError message={fieldError('form')!} />}
      <SaveButton saved={state.status === 'success' && !dirty} />
    </form>
  );
}

function NameField({
  name,
  label,
  value,
  error,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `world-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--w-ink)]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        maxLength={16}
        dir="auto"
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`h-11 w-full rounded-[10px] border bg-[var(--w-surface)] px-4 text-[var(--w-ink)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--w-accent)] ${
          error ? 'border-[var(--w-danger)]' : 'border-[var(--w-border)]'
        }`}
      />
      {error && <FieldError id={errorId} message={error} />}
    </div>
  );
}

function SwatchGroup({
  name,
  label,
  value,
  colors,
  getLabel,
  error,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  colors: RgbColor[];
  getLabel: (index: number) => string;
  error?: string;
  onChange: (value: number) => void;
}) {
  const locale = useLocale();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const options: SwatchOption[] = colors.map((rgb, index) => ({
    value: index,
    color: `rgb(${rgb.map((channel) => Math.round(channel * 255)).join(' ')})`,
    label: getLabel(index),
  }));
  const selectedIndex = options.findIndex((option) => option.value === value);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const reverse = locale === 'ar';
    const forwardKey = reverse ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = reverse ? 'ArrowRight' : 'ArrowLeft';
    let nextIndex: number | undefined;
    if (event.key === forwardKey || event.key === 'ArrowDown') nextIndex = (selectedIndex + 1) % options.length;
    if (event.key === backwardKey || event.key === 'ArrowUp') {
      nextIndex = (selectedIndex - 1 + options.length) % options.length;
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    onChange(nextIndex);
    buttons.current[nextIndex]?.focus();
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[var(--w-ink)]">{label}</legend>
      <input type="hidden" name={name} value={value} />
      <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="flex flex-wrap gap-2">
        {options.map((option, index) => (
          <Swatch
            ref={(element) => {
              buttons.current[index] = element;
            }}
            key={option.value}
            color={option.color}
            label={option.label}
            selected={option.value === value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
      {error && <FieldError message={error} />}
    </fieldset>
  );
}

function FieldError({ message, id }: { message: string; id?: string }) {
  return (
    <p id={id} className="flex items-center gap-2 text-sm text-[var(--w-danger)]" role="alert">
      <ErrorIcon />
      <span>{message}</span>
    </p>
  );
}

function SaveButton({ saved }: { saved: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations('world');
  return (
    <WorldPrimaryButton loading={pending}>
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--w-border)] border-t-[var(--w-primary-ink)]"
          />
          {t('character.saving')}
        </>
      ) : saved ? (
        <>
          <CheckIcon />
          {t('character.saved')}
        </>
      ) : (
        t('character.save')
      )}
    </WorldPrimaryButton>
  );
}

function WorldPrimaryButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading || undefined}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--w-primary)] px-4 text-base font-semibold text-[var(--w-primary-ink)] transition hover:bg-[var(--w-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w-accent)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function FormIcon({ form }: { form: 'nur' | 'fox' | 'spirit' }) {
  if (form === 'fox') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6" aria-hidden="true">
        <path d="m5 7 3 3-1 8 5-2 5 2-1-8 3-3-5 1-3-3-3 3-3-1Z" />
        <circle cx="9" cy="12" r=".7" fill="currentColor" />
        <circle cx="15" cy="12" r=".7" fill="currentColor" />
      </svg>
    );
  }
  if (form === 'spirit') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6" aria-hidden="true">
        <path d="M12 3a7 7 0 0 0-4 12.7V21l4-2 4 2v-5.3A7 7 0 0 0 12 3Z" />
        <path d="M9 10h.01M15 10h.01M10 13c1.2 1 2.8 1 4 0" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6" aria-hidden="true">
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
