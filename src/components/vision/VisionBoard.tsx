'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useRouter } from '@/i18n/navigation';
import { VISION_COLORS, VISION_KINDS, type VisionItem, type VisionKind } from '@/lib/validation/vision';
import {
  bringVisionItemToFront,
  createVisionItem,
  deleteVisionItem,
  updateVisionPosition,
} from '@/server/services/vision';
import { VisionItemCard } from '@/components/vision/VisionItemCard';

const DEBOUNCE_MS = 350;

export function VisionBoard({ initialItems }: { initialItems: VisionItem[] }) {
  const t = useTranslations('vision');
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saveQueues = useRef(new Map<string, Promise<void>>());
  const saveVersions = useRef(new Map<string, number>());
  const savedPositions = useRef(new Map<string, { x: number; y: number }>());
  const [items, setItems] = useState(initialItems);
  const [kind, setKind] = useState<VisionKind>('text');
  const [content, setContent] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState<(typeof VISION_COLORS)[number]>(VISION_COLORS[0]);
  const [size, setSize] = useState(2);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
    savedPositions.current = new Map(initialItems.map((item) => [item.id, { x: item.x, y: item.y }]));
  }, [initialItems]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || items.length >= 60) return;
    setSaving(true);
    setErrorCode(null);
    try {
      const result = await createVisionItem({
        kind,
        content,
        emoji: emoji || undefined,
        color,
        size,
      });
      if (result.status === 'success') {
        setItems((current) => [...current, result.item]);
        savedPositions.current.set(result.item.id, { x: result.item.x, y: result.item.y });
        setContent('');
        setEmoji('');
        setKind('text');
        router.refresh();
      } else {
        setErrorCode(result.code);
      }
    } catch {
      setErrorCode('generic');
    } finally {
      setSaving(false);
    }
  }

  function handlePositionChange(id: string, x: number, y: number) {
    setErrorCode(null);
    const version = (saveVersions.current.get(id) ?? 0) + 1;
    saveVersions.current.set(id, version);
    setItems((current) => current.map((item) => item.id === id ? { ...item, x, y } : item));

    const priorTimer = timers.current.get(id);
    if (priorTimer) clearTimeout(priorTimer);
    timers.current.set(id, setTimeout(() => {
      timers.current.delete(id);
      const previous = saveQueues.current.get(id) ?? Promise.resolve();
      const next = previous.catch(() => undefined).then(async () => {
        try {
          const result = await updateVisionPosition({ id, x, y });
          if (result.status === 'success') {
            savedPositions.current.set(id, { x, y });
          } else {
            setErrorCode(result.code);
            if (saveVersions.current.get(id) === version) {
              const saved = savedPositions.current.get(id);
              if (saved) {
                setItems((current) => current.map((item) =>
                  item.id === id ? { ...item, x: saved.x, y: saved.y } : item,
                ));
              }
            }
          }
        } catch {
          setErrorCode('generic');
          if (saveVersions.current.get(id) === version) {
            const saved = savedPositions.current.get(id);
            if (saved) {
              setItems((current) => current.map((item) =>
                item.id === id ? { ...item, x: saved.x, y: saved.y } : item,
              ));
            }
          }
        }
      });
      saveQueues.current.set(id, next);
    }, DEBOUNCE_MS));
  }

  async function handleBringToFront(id: string) {
    if (busyId) return;
    setBusyId(id);
    setErrorCode(null);
    const maxZ = items.reduce((highest, item) => Math.max(highest, item.z), -1);
    const previousZ = items.find((item) => item.id === id)?.z;
    setItems((current) => current.map((item) =>
      item.id === id ? { ...item, z: Math.min(maxZ + 1, 1000) } : item,
    ));
    try {
      const result = await bringVisionItemToFront({ id });
      if (result.status !== 'success') {
        setErrorCode(result.code);
        if (previousZ !== undefined) {
          setItems((current) => current.map((item) => item.id === id ? { ...item, z: previousZ } : item));
        }
      } else {
        router.refresh();
      }
    } catch {
      setErrorCode('generic');
      if (previousZ !== undefined) {
        setItems((current) => current.map((item) => item.id === id ? { ...item, z: previousZ } : item));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (busyId) return;
    const pendingTimer = timers.current.get(id);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      timers.current.delete(id);
    }
    setBusyId(id);
    setErrorCode(null);
    try {
      await saveQueues.current.get(id);
      const result = await deleteVisionItem({ id });
      if (result.status === 'success') {
        setItems((current) => current.filter((item) => item.id !== id));
        savedPositions.current.delete(id);
        router.refresh();
      } else {
        setErrorCode(result.code);
      }
    } catch {
      setErrorCode('generic');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl font-semibold">{t('boardTitle')}</h2>
          <p className="text-sm text-muted">{t('itemCount', { count: items.length, max: 60 })}</p>
        </div>
        <div
          ref={boardRef}
          dir="ltr"
          className="relative mx-auto mt-5 aspect-[3/4] w-full max-w-[32rem] overflow-hidden rounded-2xl border border-glass-border bg-gradient-to-br from-primary/10 via-base to-blue-500/10 shadow-inner"
        >
          {items.length === 0 && (
            <p dir="auto" className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted">
              {t('empty')}
            </p>
          )}
          {items.map((item) => (
            <VisionItemCard
              key={item.id}
              item={item}
              boardRef={boardRef}
              busy={busyId !== null}
              onPositionChange={handlePositionChange}
              onBringToFront={(id) => void handleBringToFront(id)}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-xl font-semibold">{t('addTitle')}</h2>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              name="kind"
              label={t('kindLabel')}
              value={kind}
              onChange={(event) => setKind(event.target.value as VisionKind)}
            >
              {VISION_KINDS.map((value) => (
                <option key={value} value={value} className="bg-[#171322]">{t(`kinds.${value}`)}</option>
              ))}
            </Select>
            <Input
              name="emoji"
              label={t('emojiLabel')}
              value={emoji}
              maxLength={16}
              onChange={(event) => setEmoji(event.target.value)}
              hint={t('emojiHint')}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="vision-content" className="block text-sm font-medium text-ink">
              {t('contentLabel')}
            </label>
            <textarea
              id="vision-content"
              value={content}
              required
              maxLength={300}
              onChange={(event) => setContent(event.target.value)}
              placeholder={t('contentPlaceholder')}
              className="min-h-24 w-full resize-y rounded-xl border border-glass-border bg-glass px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-primary-light focus:ring-2 focus:ring-primary-light/40"
            />
            <p className="text-end text-xs text-muted">{t('characters', { count: content.length, max: 300 })}</p>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('colorLabel')}</legend>
            <div className="flex flex-wrap gap-3">
              {VISION_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={t('chooseColor', { color: value })}
                  aria-pressed={color === value}
                  onClick={() => setColor(value)}
                  className={`h-9 w-9 rounded-full border-2 transition ${
                    color === value ? 'border-white ring-2 ring-primary-light' : 'border-white/30'
                  }`}
                  style={{ backgroundColor: value }}
                />
              ))}
            </div>
          </fieldset>
          <Select
            name="size"
            label={t('sizeLabel')}
            value={String(size)}
            onChange={(event) => setSize(Number(event.target.value))}
          >
            {[1, 2, 3].map((value) => (
              <option key={value} value={value} className="bg-[#171322]">{t(`sizes.${value}`)}</option>
            ))}
          </Select>
          <Button type="submit" loading={saving} disabled={items.length >= 60}>
            {items.length >= 60 ? t('limitReached') : t('addItem')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
