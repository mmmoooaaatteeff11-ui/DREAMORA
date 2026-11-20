'use client';

import { useTranslations } from 'next-intl';
import { useFormState } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Link } from '@/i18n/navigation';
import { requestPasswordReset } from '@/server/services/auth';
import { initialAuthState } from '@/types/auth';
import { SubmitButton } from './SubmitButton';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [state, formAction] = useFormState(requestPasswordReset, initialAuthState);
  const emailError = state.fieldErrors?.email ? t(`validation.${state.fieldErrors.email}`) : undefined;

  return (
    <Card>
      <h1 className="font-heading text-2xl font-semibold">
        {state.status === 'success' ? t('forgot.sentTitle') : t('forgot.title')}
      </h1>

      {state.status === 'success' ? (
        <Alert tone="success" className="mt-5">
          {t('forgot.sentBody')}
        </Alert>
      ) : (
        <>
          <p className="mt-1 text-muted">{t('forgot.subtitle')}</p>
          {state.status === 'error' && state.code && state.code !== 'validation' && (
            <Alert className="mt-5">{t(`errors.${state.code}`)}</Alert>
          )}
          <form action={formAction} noValidate className="mt-6 space-y-4">
            <Input
              name="email"
              type="email"
              label={t('forgot.email')}
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              required
              error={emailError}
            />
            <SubmitButton>{t('forgot.submit')}</SubmitButton>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary-light hover:underline">
          {t('login.submit')}
        </Link>
      </p>
    </Card>
  );
}
