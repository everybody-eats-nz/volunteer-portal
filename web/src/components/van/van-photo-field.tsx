"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import {
  ImagePlus,
  Loader2,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { canOptimiseImage } from "@/lib/van/images";

import "react-image-crop/dist/ReactCrop.css";

/**
 * The photo of a van, chosen from the admin's machine or phone.
 *
 * Every van tile in the fleet grid reserves the same 16:9 frame whether or not
 * a photo exists, so the photo has to arrive at that shape or the grid goes
 * ragged and photos get silently cropped by `object-cover` into whatever the
 * phone happened to shoot. The crop step is therefore not a nicety: it is where
 * the admin decides what gets cut, instead of the layout deciding for them.
 *
 * The file never reaches the server as-is. It is cropped and re-encoded to a
 * ~1600px JPEG in the browser first, which turns a 6MB phone photo into a few
 * hundred KB and keeps the upload inside the platform's request limit.
 */

/** Wide enough for a retina card; small enough to upload over a café wifi. */
const OUTPUT_WIDTH = 1600;
const OUTPUT_QUALITY = 0.82;
const ASPECT = 16 / 9;
/** Before the crop, so HEIC conversion is not handed a 40MB burst frame. */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

function centeredWideCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 100 }, ASPECT, width, height),
    width,
    height
  );
}

/**
 * Draw the selected region, honouring rotation, onto a canvas and return it as
 * a JPEG blob at a fixed 16:9 output size.
 */
async function toWideJpeg(
  image: HTMLImageElement,
  crop: PixelCrop,
  rotation: number
): Promise<Blob> {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const quarterTurn = rotation === 90 || rotation === 270;

  // Rotate the whole image first, then take the crop out of the rotated copy —
  // the crop rectangle the user drew is in rotated space.
  const rotated = document.createElement("canvas");
  rotated.width = quarterTurn ? image.naturalHeight : image.naturalWidth;
  rotated.height = quarterTurn ? image.naturalWidth : image.naturalHeight;
  const rctx = rotated.getContext("2d");
  if (!rctx) throw new Error("No 2d context");
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate((rotation * Math.PI) / 180);
  rctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  const width = Math.min(Math.round(crop.width * scaleX), OUTPUT_WIDTH);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = Math.round(width / ASPECT);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    rotated,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    out.width,
    out.height
  );

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode"))),
      "image/jpeg",
      OUTPUT_QUALITY
    );
  });
}

export function VanPhotoField({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [pixelCrop, setPixelCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const closeCropper = useCallback(() => {
    setSource((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    setCrop(undefined);
    setPixelCrop(undefined);
    setRotation(0);
    setPreparing(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  /**
   * Accepts a file from the picker or a drop. HEIC is converted rather than
   * rejected: it is what an iPhone hands over by default, and an admin
   * photographing the van outside the depot is exactly who this is for.
   */
  const accept = useCallback(async (file: File) => {
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("That photo is too large. Anything under 15MB is fine.");
      return;
    }

    setPreparing(true);
    setRotation(0);
    try {
      const objectUrl = URL.createObjectURL(file);
      const renders = await new Promise<boolean>((resolve) => {
        const probe = new window.Image();
        probe.onload = () => resolve(probe.naturalWidth > 0);
        probe.onerror = () => resolve(false);
        probe.src = objectUrl;
      });

      if (renders) {
        setSource(objectUrl);
        return;
      }

      // The browser cannot decode it — almost always an iPhone HEIC. heic2any
      // touches `window` while it loads, so it can only be imported here.
      URL.revokeObjectURL(objectUrl);
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });
      setSource(
        URL.createObjectURL(Array.isArray(converted) ? converted[0] : converted)
      );
    } catch {
      toast.error("Could not read that image. A JPG or PNG will work.");
      setSource(null);
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, []);

  async function upload() {
    if (!imgRef.current || !pixelCrop?.width) return;
    setUploading(true);
    try {
      const blob = await toWideJpeg(imgRef.current, pixelCrop, rotation);
      const body = new FormData();
      body.append("photo", blob, "van.jpg");
      const response = await fetch("/api/admin/van/vehicles/photo", {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error ?? "Could not upload that photo.");
        return;
      }
      onChange(data.url);
      closeCropper();
    } catch {
      toast.error("Could not upload that photo. Try again in a moment.");
    } finally {
      setUploading(false);
    }
  }

  const busy = disabled || preparing;

  return (
    <div className="space-y-2" data-testid="van-photo-field">
      <div
        onDragOver={(event) => {
          if (busy) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (busy) return;
          const file = event.dataTransfer.files?.[0];
          if (file) void accept(file);
        }}
        className={cn(
          "group relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-dashed border-forest-500/25 bg-forest-500/[0.04] transition-colors dark:border-cream-50/20 dark:bg-cream-50/[0.04]",
          dragging && "border-solid border-primary bg-primary/10",
          value && "border-solid border-transparent ring-1 ring-border"
        )}
      >
        {value ? (
          <Image
            src={value}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 480px"
            unoptimized={!canOptimiseImage(value)}
            className="object-cover"
          />
        ) : null}

        {/* One control fills the frame when empty, so the whole panel is the
            target rather than a small link inside it. */}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center transition-colors",
            value
              ? "bg-forest-800/0 text-transparent hover:bg-forest-800/55 hover:text-cream-50 focus-visible:bg-forest-800/55 focus-visible:text-cream-50"
              : "text-forest-600/80 hover:bg-forest-500/[0.06] dark:text-cream-50/70",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
          )}
        >
          {preparing ? (
            <Loader2 className="size-6 animate-spin" aria-hidden />
          ) : value ? (
            <>
              <Upload className="size-5" aria-hidden />
              <span className="text-sm font-semibold">Replace photo</span>
            </>
          ) : (
            <>
              <ImagePlus className="size-7" aria-hidden />
              <span className="text-sm font-semibold text-foreground">
                Add a photo of the van
              </span>
              <span className="text-xs text-muted-foreground">
                Drag one in, or click to choose
              </span>
            </>
          )}
        </button>

        {/* Sits on the frame rather than under it: the caption below is already
            two lines wide in this column, and a button beside it wrapped. */}
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove this photo"
            data-testid="van-photo-remove"
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-forest-800/70 text-cream-50 shadow-sm backdrop-blur-sm transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          data-testid="van-photo-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void accept(file);
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        JPG, PNG or HEIC. You&rsquo;ll crop it to fit the card.
      </p>

      <Dialog
        open={source !== null}
        onOpenChange={(open) => !open && closeCropper()}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Frame the van</DialogTitle>
            <DialogDescription>
              Every van in the fleet list shares the same wide frame, so choose
              what stays in it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[55vh] justify-center overflow-auto rounded-xl bg-forest-800/90 p-2">
            {source && (
              <ReactCrop
                crop={crop}
                aspect={ASPECT}
                keepSelection
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(completed) => setPixelCrop(completed)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={source}
                  alt="The photo you chose, ready to crop"
                  style={{ transform: `rotate(${rotation}deg)` }}
                  onLoad={(event) => {
                    const { width, height } = event.currentTarget;
                    setCrop(centeredWideCrop(width, height));
                  }}
                  className="max-h-[50vh] w-auto"
                />
              </ReactCrop>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <div className="flex gap-1">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Rotate left"
                onClick={() => setRotation((r) => (r + 270) % 360)}
              >
                <RotateCcw aria-hidden />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Rotate right"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw aria-hidden />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={closeCropper}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={uploading || !pixelCrop?.width}
                onClick={() => void upload()}
                data-testid="van-photo-confirm"
              >
                {uploading && <Loader2 className="animate-spin" aria-hidden />}
                {uploading ? "Uploading" : "Use this photo"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
