'use client';

import { useTranslations } from 'next-intl';
import { useFormState } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Link } from '@/i18n/navigation';
import { updatePassword } from '@/server/services/auth';
import { initialAuthState } from '@/types/auth';
import { SubmitButton } from './SubmitButton';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const [state, formAction] = useFormState(updatePassword, initialAuthState);
  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? t(`validation.${state.fieldErrors[name]}`) : undefined;

  return (
    <Card>
      <h1 className="font-heading text-2xl font-semibold">{t('reset.title')}</h1>
      <p className="mt-1 text-muted">{t('reset.subtitle')}</p>

      {state.status === 'error' && state.code && state.code !== 'validation' && (
        <Alert className="mt-5">
          {t(`errors.${state.code}`)}
          {state.code === 'session_expired' && (
            <>
              {' '}
              <Link href="/forgot-password" className="font-medium underline">
                {t('reset.requestNew')}
              </Link>
            </>
          )}
        </Alert>
      )}

      <form action={formAction} noValidate className="mt-6 space-y-4">
        <Input
          name="password"
          type="password"
          label={t('reset.password')}
          hint={t('reset.passwordHint')}
          autoComplete="new-password"
          dir="ltr"
          required
          error={fieldError('password')}
        />
        <Input
          name="confirmPassword"
          type="password"
          label={t('reset.confirmPassword')}
          autoComplete="new-password"
          dir="ltr"
          required
          error={fieldError('confirmPassword')}
        />
        <SubmitButton>{t('reset.submit')}</SubmitButton>
      </form>
    </Card>
  );
}
