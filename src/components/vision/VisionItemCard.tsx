'use client';

import { motion, useMotionValue } from 'framer-motion';
import type { RefObject, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import type { VisionItem } from '@/lib/validation/vision';

const SIZE_CLASSES: Record<number, string> = {
  1: 'w-28 min-h-24 text-sm',
  2: 'w-36 min-h-32 text-base',
  3: 'w-44 min-h-40 text-lg',
};

export function VisionItemCard({
  item,
  boardRef,
  busy,
  onPositionChange,
  onBringToFront,
  onDelete,
}: {
  item: VisionItem;
  boardRef: RefObject<HTMLDivElement>;
  busy: boolean;
  onPositionChange: (id: string, x: number, y: number) => void;
  onBringToFront: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations('vision');
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  function handleDragEnd(event: MouseEvent | TouchEvent | PointerEvent) {
    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const itemRect = event.currentTarget instanceof HTMLElement
      ? event.currentTarget.getBoundingClientRect()
      : null;
    if (!itemRect || boardRect.width === 0 || boardRect.height === 0) return;

    const maxLeft = Math.max(0, boardRect.width - itemRect.width);
    const maxTop = Math.max(0, boardRect.height - itemRect.height);
    const left = Math.min(maxLeft, Math.max(0, itemRect.left - boardRect.left));
    const top = Math.min(maxTop, Math.max(0, itemRect.top - boardRect.top));
    const x = Math.round((left / boardRect.width) * 1000) / 10;
    const y = Math.round((top / boardRect.height) * 1000) / 10;
    dragX.set(0);
    dragY.set(0);
    onPositionChange(item.id, x, y);
  }

  function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onDelete(item.id);
  }

  return (
    <motion.div
      drag
      dragConstraints={boardRef}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        zIndex: item.z,
        x: dragX,
        y: dragY,
        backgroundColor: item.color ?? '#4F46E5',
      }}
      className={`absolute flex flex-col gap-2 rounded-2xl border border-white/20 p-3 text-white shadow-xl touch-none select-none ${SIZE_CLASSES[item.size] ?? SIZE_CLASSES[2]}`}
      whileDrag={{ scale: 1.04 }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
          {t(`kinds.${item.kind}`)}
        </span>
        {item.kind === 'emoji' && item.emoji && (
          <span className="text-2xl leading-none" aria-hidden="true">{item.emoji}</span>
        )}
      </div>
      <div
        dir="auto"
        className={`min-h-8 whitespace-pre-wrap break-words leading-snug ${
          item.kind === 'quote' ? 'font-heading italic' : 'font-medium'
        }`}
      >
        {item.kind === 'quote' ? `“${item.content}”` : item.content}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-1 border-t border-white/20 pt-2">
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-[10px] text-white"
          disabled={busy}
          onClick={() => onBringToFront(item.id)}
        >
          {t('bringToFront')}
        </Button>
        <form onSubmit={handleDelete}>
          <ConfirmSubmitButton
            confirmText={t('deleteConfirm')}
            disabled={busy}
            className="h-8 rounded-pill border border-white/30 px-2 text-[10px] text-white transition hover:bg-black/15 disabled:opacity-60"
          >
            {t('delete')}
          </ConfirmSubmitButton>
        </form>
      </div>
    </motion.div>
  );
}
