"use client";

import { useRef, useState } from "react";
import { Camera, Pencil, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatKm, formatOdo } from "@/lib/van/format";

/**
 * Photo first, always. The camera is the primary input and typing is the
 * fallback, because the photo is the only thing that makes a reading auditable
 * later. Shared by the start and end flows so the two feel identical.
 *
 * The upload runs while the driver is still typing the number, so the tap that
 * commits the trip never waits on the network. If it fails, the trip records
 * without a photo and lands on the office's missing-photo exception — a driver
 * stopped in a loading bay by an upload error goes back to the paper book.
 */

type Phase = "capture" | "confirm";

export function OdometerCapture({
  lastReading,
  heading,
  confirmLabel,
  /** End readings must exceed the start reading. The one hard stop. */
  minimum = null,
  busy,
  onConfirm,
}: {
  lastReading: number | null;
  heading: string;
  confirmLabel: string;
  minimum?: number | null;
  busy?: boolean;
  onConfirm: (odo: number, photoUrl: string | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("capture");
  const [value, setValue] = useState("");
  /** A photo was taken, whether or not it survived the upload. */
  const [tookPhoto, setTookPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setTookPhoto(true);
    setPhotoUrl(null);
    setPhase("confirm");
    setUploadFailed(false);
    setUploading(true);

    try {
      const body = new FormData();
      body.append("photo", file);
      const response = await fetch("/api/van/photos", { method: "POST", body });
      if (!response.ok) throw new Error("upload failed");
      const { url } = await response.json();
      setPhotoUrl(url);
    } catch {
      // Soft failure by design. The reading still gets recorded.
      setUploadFailed(true);
    } finally {
      setUploading(false);
    }
  }

  function typeInstead() {
    setTookPhoto(false);
    setPhotoUrl(null);
    setUploadFailed(false);
    setPhase("confirm");
  }

  const odo = Number(value.replace(/\D/g, ""));
  const valid = value !== "" && Number.isFinite(odo) && odo > 0;
  const belowMinimum = minimum !== null && valid && odo <= minimum;
  const distance = minimum !== null && valid ? odo - minimum : null;

  if (phase === "capture") {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className="pt-5 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
          {heading}
        </h1>
        <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">
          Get the whole reading in the frame. It does not have to be a good
          photo.
        </p>

        <div className="mt-5 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl bg-foreground/90 ring-1 ring-border">
          <div className="flex flex-col items-center gap-3 text-background/70">
            <Camera className="size-11" aria-hidden />
            <span className="text-sm font-medium">Point at the dashboard</span>
          </div>
        </div>

        <div className="mt-auto space-y-2.5 pt-6">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            data-testid="odometer-photo-input"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button
            size="xl"
            className="w-full"
            data-testid="odometer-take-photo"
            onClick={() => fileInput.current?.click()}
          >
            <Camera aria-hidden />
            Take photo
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            data-testid="odometer-type-instead"
            onClick={typeInstead}
          >
            <Pencil aria-hidden />
            Type it instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="pt-5 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
        What does it read?
      </h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        Type the number from the dashboard.
      </p>

      {/* The photo as *stored*, not as captured. Showing the local file back
          would reassure a driver whose upload had actually failed, and the
          office can only ever check the number against what was saved. While
          the upload is in flight the frame holds its place so the layout does
          not jump. */}
      {tookPhoto && !uploadFailed && (
        <div className="mt-4 grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-xl bg-muted ring-1 ring-border">
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoUrl}
              alt="The odometer photo that was saved"
              className="size-full object-cover"
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              Saving the photo…
            </span>
          )}
        </div>
      )}

      <label className="mt-4 block">
        <span className="sr-only">Odometer reading in kilometres</span>
        <div
          className={cn(
            "flex items-baseline gap-2 rounded-2xl bg-card px-4 py-4 ring-2 ring-inset transition-colors focus-within:ring-primary",
            belowMinimum ? "ring-destructive" : "ring-border"
          )}
        >
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            value={value === "" ? "" : formatOdo(odo)}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            aria-label="Odometer reading"
            aria-invalid={belowMinimum || undefined}
            data-testid="odometer-reading-input"
            className="w-full min-w-0 bg-transparent text-[40px] font-semibold leading-none tracking-[-0.02em] tabular-nums outline-none placeholder:text-muted-foreground/40"
          />
          <span className="shrink-0 text-lg font-medium text-muted-foreground">
            km
          </span>
        </div>
      </label>

      {lastReading !== null && !belowMinimum && (
        <p className="mt-2 px-1 text-[13px] tabular-nums text-muted-foreground">
          Last recorded reading was {formatOdo(lastReading)} km.
        </p>
      )}

      {!tookPhoto && (
        <Note tone="warn">
          Recorded without a photo. This trip will show up on the office&rsquo;s
          exceptions list.
        </Note>
      )}
      {uploadFailed && (
        <Note tone="warn">
          The photo would not save, so this reading goes down without one. Carry
          on — the office will see it.
        </Note>
      )}
      {belowMinimum && (
        <Note tone="danger">
          Has to be more than {formatOdo(minimum!)}, the reading you started
          with.
        </Note>
      )}
      {distance !== null && !belowMinimum && valid && (
        <p
          className="mt-3 text-center text-sm text-muted-foreground"
          data-testid="odometer-distance-preview"
        >
          That is{" "}
          <strong className="font-semibold tabular-nums text-foreground">
            {formatKm(distance)}
          </strong>{" "}
          for this trip.
        </p>
      )}

      <div className="mt-auto space-y-2.5 pt-6">
        <Button
          size="xl"
          className="w-full"
          data-testid="odometer-confirm"
          disabled={!valid || belowMinimum || busy || uploading}
          onClick={() => onConfirm(odo, photoUrl)}
        >
          {uploading ? "Saving the photo…" : confirmLabel}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="w-full"
          onClick={() => setPhase("capture")}
        >
          {tookPhoto ? "Retake the photo" : "Take a photo instead"}
        </Button>
      </div>
    </div>
  );
}

function Note({
  tone,
  children,
}: {
  tone: "warn" | "danger";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium leading-snug",
        tone === "warn"
          ? "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200"
          : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200"
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
