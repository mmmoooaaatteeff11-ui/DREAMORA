'use client';

import { useTranslations } from 'next-intl';
import { useFormState } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Link } from '@/i18n/navigation';
import { login } from '@/server/services/auth';
import { initialAuthState } from '@/types/auth';
import { SubmitButton } from './SubmitButton';
import GoogleButton from "@/components/GoogleButton";
export function LoginForm({ next, callbackError }: { next?: string; callbackError?: boolean }) {
  const t = useTranslations('auth');
  const [state, formAction] = useFormState(login, initialAuthState);
  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? t(`validation.${state.fieldErrors[name]}`) : undefined;

  const bannerCode =
    state.status === 'error' && state.code && state.code !== 'validation'
      ? state.code
      : callbackError && state.status === 'idle'
        ? 'auth_callback'
        : null;

  return (
    <Card>
      <h1 className="font-heading text-2xl font-semibold">{t('login.title')}</h1>
      <p className="mt-1 text-muted">{t('login.subtitle')}</p>

      {bannerCode && <Alert className="mt-5">{t(`errors.${bannerCode}`)}</Alert>}

      <form action={formAction} noValidate className="mt-6 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Input
          name="email"
          type="email"
          label={t('login.email')}
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          required
          error={fieldError('email')}
        />
        <Input
          name="password"
          type="password"
          label={t('login.password')}
          autoComplete="current-password"
          dir="ltr"
          required
          error={fieldError('password')}
        />
        <div className="text-end">
          <Link href="/forgot-password" className="text-sm text-primary-light hover:underline">
            {t('login.forgot')}
          </Link>
        </div>
        <SubmitButton>{t('login.submit')}</SubmitButton>
      </form>
      <div className="my-4 text-center text-xs opacity-60">أو</div>
      <GoogleButton label="الدخول بجوجل" />
      <p className="mt-6 text-center text-sm text-muted">
        {t('login.noAccount')}{' '}
        <Link href="/signup" className="font-medium text-primary-light hover:underline">
          {t('login.signupLink')}
        </Link>
      </p>
    </Card>
  );
}
