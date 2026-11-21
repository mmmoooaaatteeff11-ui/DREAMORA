'use client';

import { useTranslations } from 'next-intl';
import { useFormState } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Link } from '@/i18n/navigation';
import { signup } from '@/server/services/auth';
import { initialAuthState } from '@/types/auth';
import { SubmitButton } from './SubmitButton';
import GoogleButton from "@/components/GoogleButton"; 
export function SignupForm() {
  const t = useTranslations('auth');
  const [state, formAction] = useFormState(signup, initialAuthState);
  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? t(`validation.${state.fieldErrors[name]}`) : undefined;

  if (state.status === 'success') {
    return (
      <Card>
        <h1 className="font-heading text-2xl font-semibold">{t('signup.checkEmailTitle')}</h1>
        <Alert tone="success" className="mt-5">
          {t('signup.checkEmailBody')}
        </Alert>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-primary-light hover:underline">
            {t('signup.loginLink')}
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="font-heading text-2xl font-semibold">{t('signup.title')}</h1>
      <p className="mt-1 text-muted">{t('signup.subtitle')}</p>

      {state.status === 'error' && state.code && state.code !== 'validation' && (
        <Alert className="mt-5">{t(`errors.${state.code}`)}</Alert>
      )}

      <form action={formAction} noValidate className="mt-6 space-y-4">
        <Input
          name="displayName"
          type="text"
          label={t('signup.displayName')}
          autoComplete="name"
          maxLength={80}
          error={fieldError('displayName')}
        />
        <Input
          name="email"
          type="email"
          label={t('signup.email')}
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          required
          error={fieldError('email')}
        />
        <Input
          name="password"
          type="password"
          label={t('signup.password')}
          hint={t('signup.passwordHint')}
          autoComplete="new-password"
          dir="ltr"
          required
          error={fieldError('password')}
        />
        <Input
          name="confirmPassword"
          type="password"
          label={t('signup.confirmPassword')}
          autoComplete="new-password"
          dir="ltr"
          required
          error={fieldError('confirmPassword')}
        />
        <SubmitButton>{t('signup.submit')}</SubmitButton>
      </form>      <div className="my-4 text-center text-xs opacity-60">أو</div>
      <GoogleButton label="التسجيل بجوجل" />

      <p className="mt-6 text-center text-sm text-muted">
        {t('signup.haveAccount')}{' '}
        <Link href="/login" className="font-medium text-primary-light hover:underline">
          {t('signup.loginLink')}
        </Link>
      </p>
    </Card>
  );
}
