'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  JOURNAL_CATEGORIES,
  type JournalCategory,
  type JournalEntry,
} from '@/lib/validation/journal';
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from '@/server/services/journal';

type EditorProps = {
  entry: JournalEntry | null;
  onCancel: () => void;
  onSaved: () => void;
};

function JournalEditor({ entry, onCancel, onSaved }: EditorProps) {
  const t = useTranslations('journal');
  const [title, setTitle] = useState(entry?.title ?? '');
  const [body, setBody] = useState(entry?.body ?? '');
  const [category, setCategory] = useState<JournalCategory>(entry?.category ?? 'general');
  const [tags, setTags] = useState(entry?.tags.join(', ') ?? '');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [body]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorCode(null);

    const input = {
      title,
      body,
      category,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    };

    try {
      const result = entry
        ? await updateJournalEntry({ ...input, id: entry.id })
        : await createJournalEntry(input);
      if (result.status === 'success') onSaved();
      else setErrorCode(result.code ?? 'generic');
    } catch {
      setErrorCode('generic');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="font-heading text-xl font-semibold">
        {entry ? t('editEntry') : t('newEntry')}
      </h2>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Input
          name="title"
          label={t('titleLabel')}
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="space-y-1.5">
          <label htmlFor="journal-body" className="block text-sm font-medium text-ink">
            {t('bodyLabel')}
          </label>
          <textarea
            ref={bodyRef}
            id="journal-body"
            value={body}
            required
            maxLength={10000}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t('bodyPlaceholder')}
            className="min-h-36 w-full resize-none overflow-hidden rounded-xl border border-glass-border bg-glass px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-primary-light focus:ring-2 focus:ring-primary-light/40"
          />
          <p className="text-end text-xs text-muted">
            {t('remainingCharacters', { count: 10000 - body.length })}
          </p>
        </div>
        <Select
          name="category"
          label={t('categoryLabel')}
          value={category}
          onChange={(event) => setCategory(event.target.value as JournalCategory)}
        >
          {JOURNAL_CATEGORIES.map((item) => (
            <option key={item} value={item} className="bg-[#171322]">
              {t(`categories.${item}`)}
            </option>
          ))}
        </Select>
        <Input
          name="tags"
          label={t('tagsLabel')}
          value={tags}
          maxLength={400}
          onChange={(event) => setTags(event.target.value)}
          hint={t('tagsHint')}
        />
        {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function JournalClient({
  initialEntries,
  initialHasMore,
  initialLoadError,
}: {
  initialEntries: JournalEntry[];
  initialHasMore: boolean;
  initialLoadError: boolean;
}) {
  const t = useTranslations('journal');
  const locale = useLocale();
  const [entries, setEntries] = useState(initialEntries);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<JournalCategory | 'all'>('all');
  const [editorEntry, setEditorEntry] = useState<JournalEntry | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(initialLoadError ? 'load_failed' : null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchEntries(nextOffset: number, append: boolean, search = query, filter = category) {
    setLoading(true);
    setErrorCode(null);
    try {
      const result = await listJournalEntries({
        query: search,
        category: filter,
        offset: nextOffset,
      });
      if (result.status === 'error') {
        setErrorCode(result.code);
        return false;
      }
      setEntries((current) => append ? [...current, ...result.entries] : result.entries);
      setHasMore(result.hasMore);
      return true;
    } catch {
      setErrorCode('generic');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessCode(null);
    await fetchEntries(0, false);
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (deletingId) return;
    setDeletingId(id);
    setErrorCode(null);
    setSuccessCode(null);
    try {
      const result = await deleteJournalEntry({ id });
      if (result.status === 'success') {
        setSuccessCode('deleted');
        await fetchEntries(0, false);
      } else {
        setErrorCode(result.code ?? 'generic');
      }
    } catch {
      setErrorCode('generic');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaved() {
    setEditorOpen(false);
    setEditorEntry(null);
    setSuccessCode(editorEntry ? 'updated' : 'created');
    await fetchEntries(0, false);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
    }).format(new Date(value));
  }

  return (
    <div className="space-y-6">
      {successCode && <Alert tone="success">{t(successCode)}</Alert>}
      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}

      <Card>
        <form onSubmit={handleSearch} className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Input
            name="query"
            label={t('searchLabel')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={200}
            placeholder={t('searchPlaceholder')}
          />
          <Select
            name="filterCategory"
            label={t('filterLabel')}
            value={category}
            onChange={(event) => setCategory(event.target.value as JournalCategory | 'all')}
          >
            <option value="all" className="bg-[#171322]">{t('allCategories')}</option>
            {JOURNAL_CATEGORIES.map((item) => (
              <option key={item} value={item} className="bg-[#171322]">
                {t(`categories.${item}`)}
              </option>
            ))}
          </Select>
          <Button type="submit" loading={loading} className="sm:col-span-2 sm:justify-self-start">
            {t('search')}
          </Button>
        </form>
      </Card>

      {!editorOpen ? (
        <Button
          type="button"
          onClick={() => {
            setEditorEntry(null);
            setEditorOpen(true);
            setSuccessCode(null);
          }}
        >
          {t('newEntry')}
        </Button>
      ) : (
        <JournalEditor
          key={editorEntry?.id ?? 'new'}
          entry={editorEntry}
          onCancel={() => {
            setEditorOpen(false);
            setEditorEntry(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {entries.length === 0 && !loading ? (
        <Card>
          <p className="text-sm text-muted">{query || category !== 'all' ? t('noResults') : t('empty')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words font-heading text-lg font-semibold">
                    {entry.title || entry.body.slice(0, 60)}
                    {!entry.title && entry.body.length > 60 ? '…' : ''}
                  </h2>
                  <p className="mt-1 text-xs text-muted">{formatDate(entry.created_at)}</p>
                </div>
                <Badge tone="primary">{t(`categories.${entry.category}`)}</Badge>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-muted">
                {entry.body.length > 240 ? `${entry.body.slice(0, 240)}…` : entry.body}
              </p>
              {entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {entry.tags.map((tag, index) => <Badge key={`${tag}-${index}`}>{tag}</Badge>)}
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-glass-border pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 px-4 text-sm"
                  onClick={() => {
                    setEditorEntry(entry);
                    setEditorOpen(true);
                    setSuccessCode(null);
                  }}
                >
                  {t('edit')}
                </Button>
                <form onSubmit={(event) => void handleDelete(event, entry.id)}>
                  <ConfirmSubmitButton
                    confirmText={t('deleteConfirm')}
                    disabled={deletingId !== null}
                    className="h-10 rounded-pill border border-red-400/30 px-4 text-sm text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {deletingId === entry.id ? t('deleting') : t('delete')}
                  </ConfirmSubmitButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center">
          <Button
            type="button"
            variant="ghost"
            loading={loading}
            disabled={loading}
            onClick={() => void fetchEntries(entries.length, true)}
          >
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
