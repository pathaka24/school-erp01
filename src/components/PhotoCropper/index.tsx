'use client';

import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Check, X as XIcon } from 'lucide-react';

// PhotoCropper: drag-to-position + scroll-to-zoom with a fixed aspect frame.
// On confirm, produces a cropped JPEG File at the output size.
//
// Usage:
//   <PhotoCropper
//     file={pickedFile}
//     aspect={3/4}            // 3:4 portrait — standard ID photo
//     outputW={600}           // output canvas width in px
//     onCancel={() => ...}
//     onConfirm={(croppedFile) => ...}
//   />

export default function PhotoCropper({
  file,
  aspect = 3 / 4,
  outputW = 600,
  onCancel,
  onConfirm,
}: {
  file: File;
  aspect?: number;
  outputW?: number;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}) {
  const [imgUrl, setImgUrl] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  const STAGE_W = 360;
  const STAGE_H = STAGE_W / aspect;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      // Auto-fit: scale image so smaller side fills the stage
      const scaleW = STAGE_W / img.naturalWidth;
      const scaleH = STAGE_H / img.naturalHeight;
      const initialZoom = Math.max(scaleW, scaleH);
      setZoom(initialZoom);
      // Center
      setOffset({
        x: (STAGE_W - img.naturalWidth * initialZoom) / 2,
        y: (STAGE_H - img.naturalHeight * initialZoom) / 2,
      });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Constrain offset so image always covers the stage
  const constrain = (x: number, y: number, z: number) => {
    const w = naturalSize.w * z;
    const h = naturalSize.h * z;
    const minX = Math.min(0, STAGE_W - w);
    const maxX = Math.max(0, STAGE_W - w);
    const minY = Math.min(0, STAGE_H - h);
    const maxY = Math.max(0, STAGE_H - h);
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset(constrain(e.clientX - dragStart.x, e.clientY - dragStart.y, zoom));
  };
  const onMouseUp = () => setDragging(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setDragging(true);
    setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return;
    setOffset(constrain(e.touches[0].clientX - dragStart.x, e.touches[0].clientY - dragStart.y, zoom));
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    changeZoom(zoom + delta * zoom);
  };

  const changeZoom = (newZoom: number) => {
    const minZoom = Math.max(STAGE_W / naturalSize.w, STAGE_H / naturalSize.h);
    const z = Math.max(minZoom, Math.min(5, newZoom));
    // Keep image centered around the same point when zooming
    const centerX = STAGE_W / 2;
    const centerY = STAGE_H / 2;
    const ratio = z / zoom;
    const newX = centerX - (centerX - offset.x) * ratio;
    const newY = centerY - (centerY - offset.y) * ratio;
    setZoom(z);
    setOffset(constrain(newX, newY, z));
  };

  const reset = () => {
    if (!naturalSize.w) return;
    const scaleW = STAGE_W / naturalSize.w;
    const scaleH = STAGE_H / naturalSize.h;
    const initialZoom = Math.max(scaleW, scaleH);
    setZoom(initialZoom);
    setOffset({
      x: (STAGE_W - naturalSize.w * initialZoom) / 2,
      y: (STAGE_H - naturalSize.h * initialZoom) / 2,
    });
  };

  const confirm = async () => {
    if (!naturalSize.w) return;
    // Crop region in source image coordinates
    const srcX = -offset.x / zoom;
    const srcY = -offset.y / zoom;
    const srcW = STAGE_W / zoom;
    const srcH = STAGE_H / zoom;

    const outputH = Math.round(outputW / aspect);
    const canvas = document.createElement('canvas');
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = async () => {
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.9),
      );
      if (!blob) return;
      const newName = file.name.replace(/\.[^.]+$/, '') + '-cropped.jpg';
      const cropped = new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
      onConfirm(cropped);
    };
    img.src = imgUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Adjust photo</p>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><XIcon className="h-5 w-5" /></button>
        </div>

        <div className="p-5 bg-slate-100">
          <p className="text-xs text-slate-600 mb-3 text-center">
            Drag to reposition · Scroll or use buttons to zoom · Aim to keep the face centred in the frame
          </p>

          <div className="flex justify-center mb-3">
            <div
              ref={stageRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onMouseUp}
              onWheel={onWheel}
              style={{
                width: STAGE_W,
                height: STAGE_H,
                position: 'relative',
                overflow: 'hidden',
                background: '#000',
                borderRadius: 8,
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              {imgUrl && (
                <img
                  src={imgUrl}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: offset.x,
                    top: offset.y,
                    width: naturalSize.w * zoom,
                    height: naturalSize.h * zoom,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {/* Frame guide overlay */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.9), inset 0 0 0 2000px rgba(0,0,0,0)',
              }} />
              {/* Center face guide */}
              <div style={{
                position: 'absolute', left: '50%', top: '40%',
                transform: 'translate(-50%, -50%)',
                width: STAGE_W * 0.45,
                height: STAGE_W * 0.55,
                border: '1px dashed rgba(255,255,255,0.4)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }} />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-center">
            <button onClick={() => changeZoom(zoom * 0.85)}
              className="p-2 bg-white rounded-lg border border-slate-300 hover:bg-slate-50">
              <ZoomOut className="h-4 w-4 text-slate-700" />
            </button>
            <input type="range" min="0.1" max="3" step="0.01" value={zoom}
              onChange={e => changeZoom(parseFloat(e.target.value))}
              className="flex-1 max-w-[200px]" />
            <button onClick={() => changeZoom(zoom * 1.18)}
              className="p-2 bg-white rounded-lg border border-slate-300 hover:bg-slate-50">
              <ZoomIn className="h-4 w-4 text-slate-700" />
            </button>
            <button onClick={reset} title="Reset"
              className="p-2 bg-white rounded-lg border border-slate-300 hover:bg-slate-50">
              <RotateCcw className="h-4 w-4 text-slate-700" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm">
            Cancel
          </button>
          <button onClick={confirm} disabled={!naturalSize.w}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            <Check className="h-4 w-4" /> Use this photo
          </button>
        </div>
      </div>
    </div>
  );
}
