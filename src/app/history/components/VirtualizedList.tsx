'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  itemHeight: number;
  viewportHeight: number;
  threshold?: number;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  renderSpacer: (height: number) => ReactNode;
}

/** Renders a window of list items while preserving the caller's list semantics. */
export function VirtualizedList<T>({
  items,
  scrollContainerRef,
  itemHeight,
  viewportHeight: estimatedViewportHeight,
  threshold = 100,
  overscan = 5,
  renderItem,
  renderSpacer,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(estimatedViewportHeight);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || items.length <= threshold) return;

    const updateScrollPosition = () => setScrollTop(container.scrollTop);
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => setViewportHeight(container.clientHeight));
    resizeObserver?.observe(container);
    updateScrollPosition();

    container.addEventListener('scroll', updateScrollPosition, { passive: true });
    return () => {
      container.removeEventListener('scroll', updateScrollPosition);
      resizeObserver?.disconnect();
    };
  }, [items.length, scrollContainerRef, threshold]);

  if (items.length <= threshold) {
    return <>{items.map(renderItem)}</>;
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan,
  );
  const bottomHeight = (items.length - endIndex) * itemHeight;

  return (
    <>
      {startIndex > 0 && renderSpacer(startIndex * itemHeight)}
      {items
        .slice(startIndex, endIndex)
        .map((item, offset) => renderItem(item, startIndex + offset))}
      {bottomHeight > 0 && renderSpacer(bottomHeight)}
    </>
  );
}
