"use client";

import { useRef, useCallback, type TouchEvent } from "react";

interface SwipeConfig {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
  swipeOffset: number;
  isSwiping: boolean;
}

export function useSwipeGesture({
  threshold = 80,
  onSwipeLeft,
  onSwipeRight,
}: SwipeConfig): SwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentOffset = useRef(0);
  const isSwiping = useRef(false);
  const isHorizontal = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    currentOffset.current = 0;
    isSwiping.current = false;
    isHorizontal.current = false;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // Determine direction on first significant move
    if (!isHorizontal.current && !isSwiping.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
    }

    if (isHorizontal.current) {
      isSwiping.current = true;
      currentOffset.current = dx;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;

    const offset = currentOffset.current;

    if (Math.abs(offset) >= threshold) {
      if (offset > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (offset < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    currentOffset.current = 0;
    isSwiping.current = false;
    isHorizontal.current = false;
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swipeOffset: currentOffset.current,
    isSwiping: isSwiping.current,
  };
}
