'use client';

import { useTranslations } from 'next-intl';
import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { updateProfile } from '@/server/services/profile';
import { initialActionState } from '@/types/action';

export function ProfileForm({
  defaults,
  timezones,
}: {
  defaults: { displayName: string; language: 'ar' | 'en'; timezone: string };
  timezones: string[];
}) {
  const t = useTranslations('settings');
  const [state, formAction] = useFormState(updateProfile, initialActionState);
  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? t(`errors.${state.fieldErrors[name]}`) : undefined;

  const zones = timezones.includes(defaults.timezone) ? timezones : [defaults.timezone, ...timezones];

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.status === 'success' && <Alert tone="success">{t('profile.saved')}</Alert>}
      {state.status === 'error' && state.code && state.code !== 'validation' && (
        <Alert>{t(`errors.${state.code}`)}</Alert>
      )}

      <Input
        name="displayName"
        label={t('profile.displayName')}
        defaultValue={defaults.displayName}
        maxLength={80}
        autoComplete="name"
        error={fieldError('displayName')}
      />
      <Select name="language" label={t('profile.language')} defaultValue={defaults.language} error={fieldError('language')}>
        <option value="ar" className="bg-surface text-ink">
          العربية
        </option>
        <option value="en" className="bg-surface text-ink">
          English
        </option>
      </Select>
      <Select name="timezone" label={t('profile.timezone')} defaultValue={defaults.timezone} error={fieldError('timezone')}>
        {zones.map((zone) => (
          <option key={zone} value={zone} className="bg-surface text-ink">
            {zone}
          </option>
        ))}
      </Select>

      <SubmitButton>{t('profile.save')}</SubmitButton>
    </form>
  );
}
