'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { Input } from '@/components/ui/Input';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
} from '@/lib/letters/date';
import type { ArrivedLetter, LetterDraft, WaitingLetter } from '@/lib/validation/letters';
import {
  createFutureLetter,
  deleteFutureLetter,
  getFutureLetterForEdit,
  openFutureLetter,
  updateFutureLetter,
} from '@/server/services/letters';

const DATE_PRESETS = [
  { key: 'days30', days: 30 },
  { key: 'days90', days: 90 },
  { key: 'months6', months: 6 },
  { key: 'year1', months: 12 },
] as const;

export function LettersClient({
  today,
  minDate,
  maxDate,
  initialWaiting,
  initialArrived,
  loadError,
}: {
  today: string;
  minDate: string;
  maxDate: string;
  initialWaiting: WaitingLetter[];
  initialArrived: ArrivedLetter[];
  loadError: boolean;
}) {
  const t = useTranslations('letters');
  const locale = useLocale();
  const [waiting, setWaiting] = useState(initialWaiting);
  const [arrived, setArrived] = useState(initialArrived);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deliverOn, setDeliverOn] = useState(minDate);
  const [saving, setSaving] = useState(false);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openedLetter, setOpenedLetter] = useState<{ id: string; body: string } | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(loadError ? 'load_failed' : null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  function formatDate(dateKey: string): string {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${dateKey}T12:00:00.000Z`));
  }

  function clearForm() {
    setFormOpen(false);
    setEditingId(null);
    setTitle('');
    setBody('');
    setDeliverOn(minDate);
  }

  function startNewLetter() {
    setErrorCode(null);
    setSuccessCode(null);
    setEditingId(null);
    setTitle('');
    setBody('');
    setDeliverOn(minDate);
    setFormOpen(true);
  }

  async function handleEdit(id: string) {
    if (loadingEditId || saving || deletingId) return;
    setLoadingEditId(id);
    setErrorCode(null);
    setSuccessCode(null);
    try {
      const result = await getFutureLetterForEdit({ id });
      if (result.status === 'success') {
        setEditingId(id);
        setTitle(result.letter.title);
        setBody(result.letter.body);
        setDeliverOn(result.letter.deliver_on);
        setFormOpen(true);
      } else {
        setErrorCode(result.code);
      }
    } catch {
      setErrorCode('generic');
    } finally {
      setLoadingEditId(null);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorCode(null);
    setSuccessCode(null);
    try {
      const fields = { title, body, deliver_on: deliverOn };
      if (editingId) {
        const result = await updateFutureLetter({ ...fields, id: editingId });
        if (result.status === 'error') {
          setErrorCode(result.code);
          return;
        }
        setWaiting((current) =>
          [...current.filter((letter) => letter.id !== editingId), {
            id: editingId,
            title,
            deliver_on: deliverOn,
          }].sort((a, b) => a.deliver_on.localeCompare(b.deliver_on)),
        );
        setSuccessCode('updated');
      } else {
        const result = await createFutureLetter(fields);
        if (result.status === 'error') {
          setErrorCode(result.code);
          return;
        }
        setWaiting((current) =>
          [...current, { id: result.id, title, deliver_on: deliverOn }]
            .sort((a, b) => a.deliver_on.localeCompare(b.deliver_on)),
        );
        setSuccessCode('created');
      }
      clearForm();
    } catch {
      setErrorCode('generic');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (deletingId) return;
    setDeletingId(id);
    setErrorCode(null);
    setSuccessCode(null);
    try {
      const result = await deleteFutureLetter({ id });
      if (result.status === 'success') {
        setWaiting((current) => current.filter((letter) => letter.id !== id));
        if (editingId === id) clearForm();
        setSuccessCode('deleted');
      } else {
        setErrorCode(result.code);
      }
    } catch {
      setErrorCode('generic');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleOpen(letter: ArrivedLetter) {
    if (openingId) return;
    if (openedLetter?.id === letter.id) {
      setOpenedLetter(null);
      return;
    }
    setOpeningId(letter.id);
    setErrorCode(null);
    setSuccessCode(null);
    try {
      const result = await openFutureLetter({ id: letter.id });
      if (result.status === 'success') {
        setOpenedLetter({ id: letter.id, body: result.body });
        setArrived((current) =>
          current.map((item) =>
            item.id === letter.id ? { ...item, delivered_at: result.deliveredAt } : item,
          ),
        );
      } else {
        setErrorCode(result.code);
      }
    } catch {
      setErrorCode('generic');
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="space-y-6">
      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
      {successCode && <Alert tone="success">{t(successCode)}</Alert>}

      {!formOpen ? (
        <Button type="button" onClick={startNewLetter}>{t('newLetter')}</Button>
      ) : (
        <Card>
          <h2 className="font-heading text-xl font-semibold">
            {editingId ? t('editLetter') : t('newLetter')}
          </h2>
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <Input
              name="title"
              label={t('titleLabel')}
              value={title}
              required
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
            />
            <div className="space-y-1.5">
              <label htmlFor="letter-body" className="block text-sm font-medium text-ink">
                {t('bodyLabel')}
              </label>
              <textarea
                id="letter-body"
                value={body}
                required
                maxLength={10000}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t('bodyPlaceholder')}
                className="min-h-40 w-full resize-y rounded-xl border border-glass-border bg-glass px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-primary-light focus:ring-2 focus:ring-primary-light/40"
              />
              <p className="text-end text-xs text-muted">
                {t('remainingCharacters', { count: 10000 - body.length })}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="letter-deliver-on" className="block text-sm font-medium text-ink">
                {t('deliverOnLabel')}
              </label>
              <input
                id="letter-deliver-on"
                type="date"
                value={deliverOn}
                min={minDate}
                max={maxDate}
                required
                onChange={(event) => setDeliverOn(event.target.value)}
                className="h-12 w-full rounded-xl border border-glass-border bg-glass px-4 text-ink outline-none focus:border-primary-light focus:ring-2 focus:ring-primary-light/40"
              />
              <p className="text-xs text-muted">{t('dateRange', { min: formatDate(minDate), max: formatDate(maxDate) })}</p>
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map((preset) => {
                  const presetDate = 'days' in preset
                    ? addDaysToDateKey(today, preset.days)
                    : addMonthsToDateKey(today, preset.months);
                  return (
                    <Button
                      key={preset.key}
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-sm"
                      onClick={() => setDeliverOn(presetDate)}
                    >
                      {t(`presets.${preset.key}`)}
                    </Button>
                  );
                })}
              </div>
            </div>
            {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={saving}>
                {saving ? t('saving') : t('save')}
              </Button>
              <Button type="button" variant="ghost" disabled={saving} onClick={clearForm}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <section className="space-y-3" aria-labelledby="waiting-letters-heading">
        <h2 id="waiting-letters-heading" className="font-heading text-xl font-semibold">
          {t('waitingTitle')}
        </h2>
        {waiting.length === 0 ? (
          <Card><p className="text-sm text-muted">{t('waitingEmpty')}</p></Card>
        ) : (
          waiting.map((letter) => (
            <Card key={letter.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="break-words font-medium">{letter.title}</h3>
                <p className="mt-1 text-sm text-muted">
                  {t('opensOn', { date: formatDate(letter.deliver_on) })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 px-4 text-sm"
                  disabled={loadingEditId !== null || saving || deletingId !== null}
                  loading={loadingEditId === letter.id}
                  onClick={() => void handleEdit(letter.id)}
                >
                  {t('edit')}
                </Button>
                <form onSubmit={(event) => void handleDelete(event, letter.id)}>
                  <ConfirmSubmitButton
                    confirmText={t('deleteConfirm')}
                    disabled={deletingId !== null || saving}
                    className="h-10 rounded-pill border border-red-400/30 px-4 text-sm text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {deletingId === letter.id ? t('deleting') : t('delete')}
                  </ConfirmSubmitButton>
                </form>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3" aria-labelledby="arrived-letters-heading">
        <h2 id="arrived-letters-heading" className="font-heading text-xl font-semibold">
          {t('arrivedTitle')}
        </h2>
        {arrived.length === 0 ? (
          <Card><p className="text-sm text-muted">{t('arrivedEmpty')}</p></Card>
        ) : (
          arrived.map((letter) => (
            <Card key={letter.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">{letter.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {t('arrivedOn', { date: formatDate(letter.deliver_on) })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 px-4 text-sm"
                  loading={openingId === letter.id}
                  disabled={openingId !== null}
                  onClick={() => void handleOpen(letter)}
                >
                  {openedLetter?.id === letter.id ? t('close') : t('open')}
                </Button>
              </div>
              {openedLetter?.id === letter.id && (
                <div className="whitespace-pre-wrap break-words rounded-xl border border-glass-border bg-black/10 p-4 leading-7">
                  {openedLetter.body}
                </div>
              )}
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
