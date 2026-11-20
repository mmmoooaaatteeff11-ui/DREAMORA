'use client';

import { useTranslations } from 'next-intl';
import { useFormState, useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { cn } from '@/lib/utils';
import { deleteAllMemory, setAiMemory } from '@/server/services/profile';
import { initialActionState } from '@/types/action';

function Switch({ checked, label }: { checked: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={pending}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-pill border transition-colors disabled:opacity-60',
        checked ? 'border-primary bg-primary' : 'border-glass-border bg-white/10',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
          checked ? 'end-0.5' : 'start-0.5',
        )}
      />
    </button>
  );
}

export function PrivacyForm({ enabled, memoryCount }: { enabled: boolean; memoryCount: number }) {
  const t = useTranslations('settings.privacy');
  const te = useTranslations('settings.errors');
  const [state, formAction] = useFormState(setAiMemory, initialActionState);

  return (
    <div className="space-y-4">
      {state.status === 'error' && state.code && <Alert>{te(state.code)}</Alert>}

      <form action={formAction} className="flex items-start justify-between gap-4">
        <input type="hidden" name="enabled" value={String(!enabled)} />
        <div>
          <h3 className="font-medium">{t('memoryTitle')}</h3>
          <p className="mt-1 text-sm text-muted">{t('memoryBody')}</p>
          <p className="mt-2 text-sm text-muted">{t('memoryNote')}</p>
          <p className="mt-2 text-sm">
            <span className={enabled ? 'text-primary-light' : 'text-muted'}>{enabled ? t('memoryOn') : t('memoryOff')}</span>
          </p>
        </div>
        <Switch checked={enabled} label={t('memoryTitle')} />
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-glass-border pt-4">
        <p className="text-sm text-muted">{t('memoryCount', { count: memoryCount })}</p>
        {memoryCount > 0 && (
          <form action={deleteAllMemory}>
            <ConfirmSubmitButton
              confirmText={t('deleteMemoryConfirm')}
              className="rounded-pill border border-red-400/30 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/10"
            >
              {t('deleteMemory')}
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
