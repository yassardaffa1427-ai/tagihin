"use client";

import { useEffect, useRef, useState } from "react";
import { DoubleArrowRightIcon } from "@/components/icons";

const THUMB_SIZE = 48;
const COMPLETE_THRESHOLD = 0.7; // 70% slide triggers completion smoothly on mobile

export default function SlideToConfirm({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const startXRef = useRef(0);
  const originXRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateWidth = () => {
      // clientWidth is inner width (content width excluding padding if border-box)
      if (track.clientWidth > 0) {
        setTrackWidth(track.clientWidth);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const maxX = Math.max(0, trackWidth - THUMB_SIZE);
  const clamp = (value: number) => Math.min(Math.max(value, 0), maxX);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (settling) return;
    setDragging(true);
    startXRef.current = event.clientX;
    originXRef.current = dragX;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore fallback
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const delta = event.clientX - startXRef.current;
    const next = clamp(originXRef.current + delta);
    setDragX(next);
  };

  const finishDrag = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);

    if (event) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // ignore
      }
    }

    const progress = maxX > 0 ? dragX / maxX : 0;
    setSettling(true);

    if (progress >= COMPLETE_THRESHOLD) {
      setDragX(maxX);
      window.setTimeout(onConfirm, 150);
    } else {
      setDragX(0);
      window.setTimeout(() => setSettling(false), 200);
    }
  };

  const progress = maxX > 0 ? dragX / maxX : 0;

  return (
    <div
      ref={trackRef}
      className="relative w-full max-w-[310px] h-[49px] overflow-hidden rounded-2xl bg-[#242424] p-[5px] select-none touch-none"
    >
      <div
        aria-hidden
        className="absolute inset-y-[5px] left-[5px] rounded-[16px] bg-brand-500 shadow-[inset_0px_0px_14px_0px_rgba(255,255,255,0.25),inset_0px_0px_11.8px_0px_rgba(255,255,255,0.6)]"
        style={{
          width: `${THUMB_SIZE + dragX}px`,
          transition: dragging ? "none" : "width 200ms ease-out",
        }}
      />
      <p
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-[16px] font-extrabold text-white"
        style={{ opacity: 0.45 * (1 - progress) }}
      >
        {label}
      </p>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className="relative z-10 flex h-[39px] w-[48px] cursor-grab items-center justify-center rounded-[14px] border border-white bg-gradient-to-b from-[#bfbfbf] to-white shadow-[0_0_0_3px_#64c416,0_0_12px_2px_rgba(100,196,22,0.55)] active:cursor-grabbing touch-none"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
        }}
      >
        <DoubleArrowRightIcon className="size-6 text-neutral-700 pointer-events-none" />
      </div>
    </div>
  );
}

