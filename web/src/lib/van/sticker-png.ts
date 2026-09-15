/**
 * The van sticker, redrawn on a canvas so it can be sent to somebody.
 *
 * Printing covers the dashboard, but a van's drivers are not all Everybody
 * Eats staff — the Sustainability Trust drives one of them — and the only
 * way to get a code to an outside organisation is to email it. A QR rendered as
 * inline SVG cannot be saved from the browser's own "save image" menu, so the
 * office had nothing to attach.
 *
 * The sticker is drawn rather than screenshotted: it comes out identical to
 * the printed card at any resolution, with no html-to-image dependency, and
 * the PNG that lands in the driver's inbox is the same artefact as the one on
 * the dashboard.
 *
 * Browser only — it needs a canvas and the page's loaded fonts.
 */

/** The QR's on-screen size, in CSS pixels. Shared with the printable card. */
export const STICKER_QR_SIZE = 192;

/**
 * How much bigger the PNG is than the card on screen. 4x puts it a little over
 * 1300px wide: enough to print at the ~90mm the sticker is stuck on at, and to
 * stay scannable when a mail client shrinks it into a preview pane.
 */
const SCALE = 4;

const INK = "#0e2a1c"; // forest-700
const EYEBROW_INK = "#1d5337"; // forest-500
/**
 * The card's border. On screen the ring sits on the dialog's grey; a PNG lands
 * on white — in an email, on a page — so it is drawn a shade stronger than
 * `ring-forest-500/15`, or the sticker has no edge to cut along.
 */
const EDGE = "rgba(29, 83, 55, 0.25)";

/**
 * The card's geometry, in CSS pixels, mirroring the printable markup so the two
 * cannot drift apart. `line` is the height of a line box, `gap` the margin
 * above the block.
 */
const CARD = {
  width: 336,
  padX: 20,
  padTop: 24,
  padBottom: 24,
  eyebrow: {
    text: "Everybody Eats · Van Log",
    size: 11,
    line: 16,
    tracking: 0.12,
  },
  name: { size: 24, line: 32, gap: 8, tracking: -0.02, minSize: 14 },
  plate: { size: 13, line: 19, gap: 6, padX: 8, radius: 6, tracking: 0.14 },
  qr: { size: STICKER_QR_SIZE, gap: 16 },
  footer: {
    lines: ["Scan before you drive.", "Scan again when you get back."],
    size: 15,
    line: 21,
    gap: 16,
  },
} as const;

const CARD_HEIGHT =
  CARD.padTop +
  CARD.eyebrow.line +
  CARD.name.gap +
  CARD.name.line +
  CARD.plate.gap +
  CARD.plate.line +
  CARD.qr.gap +
  CARD.qr.size +
  CARD.footer.gap +
  CARD.footer.line * CARD.footer.lines.length +
  CARD.padBottom;

/**
 * Turn the sticker's own `<svg>` QR into an image at PNG resolution.
 *
 * The QR is re-rasterised from the vector rather than scaled up from what is on
 * screen, so every module lands on a whole pixel however big the PNG is. The
 * markup carries no external references, so the data URL leaves the canvas
 * untainted and `toBlob` still works.
 */
async function rasteriseQr(svg: SVGSVGElement, size: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));

  const markup = new XMLSerializer().serializeToString(clone);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  return image;
}

/**
 * A CSS pixel of the card, in the PNG's own pixels.
 *
 * The drawing is scaled here rather than with a transform on the context:
 * Chrome lays a line out at whatever font size it is given and only then
 * applies the transform, so laying out at the card's own 15px and scaling by
 * four magnifies the rounding in every glyph's advance into gaps you can see
 * ("Scan bef ore you drive ."). At the PNG's real size the line is spaced the
 * way the card on screen is.
 */
function px(cssPixels: number) {
  return cssPixels * SCALE;
}

/**
 * One centred line, at the card's size and tracking.
 *
 * Tracking also lands after a line's last letter, which drags a centred line
 * half a space to the left. Put it back.
 */
function centreLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  size: number,
  tracking: number
) {
  const spacing = px(size) * tracking;
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(text, px(CARD.width) / 2 + spacing / 2, y);
  ctx.letterSpacing = "0px";
}

export interface StickerPngInput {
  /** The QR already rendered in the dialog. */
  qr: SVGSVGElement;
  name: string;
  rego: string;
  /** Computed `font-family` off the card, so the PNG uses the page's fonts. */
  headingFont: string;
  bodyFont: string;
}

/** Draw the sticker and hand back a PNG. */
export async function renderStickerPng({
  qr,
  name,
  rego,
  headingFont,
  bodyFont,
}: StickerPngInput): Promise<Blob> {
  // Fraunces is self-hosted and Jakarta comes from next/font: both can still be
  // loading when the dialog opens, and canvas silently falls back to a system
  // face rather than waiting.
  await document.fonts.ready;
  const qrImage = await rasteriseQr(qr, px(CARD.qr.size));

  const canvas = document.createElement("canvas");
  canvas.width = px(CARD.width);
  canvas.height = px(CARD_HEIGHT);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the sticker.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = px(1);
  ctx.beginPath();
  ctx.roundRect(
    px(0.5),
    px(0.5),
    canvas.width - px(1),
    canvas.height - px(1),
    px(12)
  );
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // `y` walks down the card in its own CSS pixels, the same ones the markup
  // lays the printable card out in.
  let y = CARD.padTop;

  ctx.font = `600 ${px(CARD.eyebrow.size)}px ${bodyFont}`;
  ctx.fillStyle = EYEBROW_INK;
  centreLine(
    ctx,
    CARD.eyebrow.text.toUpperCase(),
    px(y + CARD.eyebrow.line / 2),
    CARD.eyebrow.size,
    CARD.eyebrow.tracking
  );
  y += CARD.eyebrow.line;

  // A long van name is shrunk to fit rather than run off the card: names are
  // free text, and "Everybody Eats Wellington Kombi" is a plausible one.
  y += CARD.name.gap;
  let nameSize = CARD.name.size;
  const setNameFont = () => {
    ctx.letterSpacing = `${px(nameSize) * CARD.name.tracking}px`;
    ctx.font = `600 ${px(nameSize)}px ${headingFont}`;
  };
  setNameFont();
  while (
    ctx.measureText(name).width > px(CARD.width - CARD.padX * 2) &&
    nameSize > CARD.name.minSize
  ) {
    nameSize -= 1;
    setNameFont();
  }
  ctx.letterSpacing = "0px";
  ctx.fillStyle = INK;
  centreLine(
    ctx,
    name,
    px(y + CARD.name.line / 2),
    nameSize,
    CARD.name.tracking
  );
  y += CARD.name.line;

  y += CARD.plate.gap;
  const plate = rego.toUpperCase();
  ctx.font = `700 ${px(CARD.plate.size)}px ${bodyFont}`;
  ctx.letterSpacing = `${px(CARD.plate.size) * CARD.plate.tracking}px`;
  const plateWidth = ctx.measureText(plate).width + px(CARD.plate.padX * 2);
  ctx.letterSpacing = "0px";
  ctx.beginPath();
  ctx.roundRect(
    (canvas.width - plateWidth) / 2,
    px(y),
    plateWidth,
    px(CARD.plate.line),
    px(CARD.plate.radius)
  );
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "rgba(14, 42, 28, 0.4)";
  ctx.stroke();
  ctx.fillStyle = INK;
  centreLine(
    ctx,
    plate,
    px(y + CARD.plate.line / 2),
    CARD.plate.size,
    CARD.plate.tracking
  );
  y += CARD.plate.line;

  y += CARD.qr.gap;
  ctx.drawImage(
    qrImage,
    (canvas.width - px(CARD.qr.size)) / 2,
    px(y),
    px(CARD.qr.size),
    px(CARD.qr.size)
  );
  y += CARD.qr.size;

  y += CARD.footer.gap;
  ctx.font = `600 ${px(CARD.footer.size)}px ${bodyFont}`;
  ctx.fillStyle = INK;
  for (const line of CARD.footer.lines) {
    ctx.fillText(line, canvas.width / 2, px(y + CARD.footer.line / 2));
    y += CARD.footer.line;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("The sticker did not render.")),
      "image/png"
    );
  });
}

/**
 * What the file is called once it is in somebody's downloads. It is forwarded
 * on by hand, so it has to say which van it belongs to without being opened.
 */
export function stickerFileName(name: string, rego: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = ["van-sticker", slug(name), slug(rego)].filter(Boolean);
  return `${parts.join("-")}.png`;
}
