/*
 * src/lib/js/lightbox.ts — the immersive viewer behavior.
 *
 * Progressive enhancement only. The <dialog> + triggers are installed from
 * a <template>, so without JS there is no dialog and no extra download.
 * Uses the NATIVE <dialog>.showModal() (top-layer, built-in focus trap and
 * Escape); this module adds prev/next, swipe, the mono plaque line, neighbour
 * prefetch, focus restoration and the top-of-plate scroll reset.
 *
 * C direction (2026-10-18): the room scrolls (one plate measure, taller than
 * the viewport for portraits), so navigating re-seats the plate at the top and
 * the empty room around the plate — not the plate itself — closes the viewer.
 */

import { MEDIA_FRAME_SIZES_VALUE as MEDIA_FRAME_SIZES } from "../media";

interface LightboxItem {
  id: string;
  src: string;
  avifSrcset?: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  camera: string;
  lens: string;
  tech: string;
}

/**
 * One horizontal capture line for the plaque plinth (spec §6.3.C):
 * `SONY ILCE-7CR / FE 24-70mm F2.8 GM II / 70mm / ƒ/2.8 / 1/15s / ISO 100`.
 * Camera and lens lead; the settings run keeps its authored parts. Empty
 * fields drop out rather than leaving an orphan separator, so a photo with
 * no sidecar data yields "" (and the plinth keeps only the title + index).
 */
export function plaqueTechLine(item: Pick<LightboxItem, "camera" | "lens" | "tech">): string {
  const parts = [item.camera, item.lens, ...item.tech.split(" · ")];
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" / ");
}

export function initLightbox(): void {
  if (typeof window === "undefined" || typeof HTMLDialogElement === "undefined") return;

  const dialogEl = document.querySelector<HTMLDialogElement>("[data-lightbox]");
  const island = document.querySelector<HTMLScriptElement>("[data-lightbox-data]");
  if (!dialogEl || !island) return;
  const dialog: HTMLDialogElement = dialogEl;

  let items: LightboxItem[] = [];
  try {
    items = JSON.parse(island.textContent ?? "[]") as LightboxItem[];
  } catch {
    return;
  }
  if (items.length === 0) return;

  const $ = <T extends Element>(sel: string): T => dialog!.querySelector(sel) as T;
  const img = $<HTMLImageElement>("[data-lb-img]");
  const avifSource = $<HTMLSourceElement>("[data-lb-avif]");
  const count = $<HTMLElement>("[data-lb-count]");
  const title = $<HTMLElement>("[data-lb-title]");
  const caption = $<HTMLElement>("[data-lb-caption]");
  const room = $<HTMLElement>("[data-lb-stage]");
  const tech = $<HTMLElement>("[data-lb-tech]");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const byId = new Map(items.map((item, i) => [item.id, i]));
  let current = 0;
  let opener: HTMLElement | null = null;

  const figures = Array.from(
    document.querySelectorAll<HTMLElement>(".gallery-figure[data-photo-id]"),
  );

  // Install the transparent keyboard/mouse open control over each figure's
  // MEDIA SLOT only. The overlay is anchored to the media element (never the
  // <figure>), so the figcaption below stays selectable — copyable caption
  // text and EXIF must not be swallowed by the open control.
  for (const figure of figures) {
    const id = figure.dataset.photoId;
    if (id === undefined || !byId.has(id)) continue;
    const media = figure.querySelector<HTMLElement>("picture, .media-slot");
    if (!media) continue;
    if (getComputedStyle(media).position === "static") media.style.position = "relative";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "figure-open";
    button.setAttribute("aria-label", "View photo larger");
    button.addEventListener("click", () => open(byId.get(id)!, button));
    media.appendChild(button);
  }

  function pad(n: number): string {
    return String(n + 1).padStart(2, "0");
  }

  function render(index: number): void {
    const item = items[index]!;
    current = index;

    img.alt = item.alt;
    img.sizes = LIGHTBOX_SIZES;
    img.removeAttribute("srcset"); // single JPEG fallback
    img.src = item.src;
    if (avifSource) {
      avifSource.sizes = LIGHTBOX_SIZES;
      avifSource.srcset = item.avifSrcset ?? "";
    }

    count.textContent = `${pad(index)} / ${pad(items.length - 1)}`;
    title.textContent = dialog.dataset.galleryTitle ?? "";
    caption.textContent = item.caption ?? "";
    caption.hidden = !item.caption;

    // Re-seat the plate: a portrait plate is taller than the viewport, so a
    // navigation must land on the TOP of the new photograph, not mid-frame.
    room.scrollTop = 0;

    // The plinth's single-line capture run: camera / lens / focal / aperture /
    // shutter / ISO. The individual camera and lens labels stay queryable
    // through the title attributes of the parts and the JSON island, and the
    // composed run is what the plaque displays.
    tech.textContent = plaqueTechLine(item);

    if (!reduceMotion) {
      img.classList.add("is-fading");
      const reveal = () => img.classList.remove("is-fading");
      img.decode?.().then(reveal).catch(reveal);
      window.setTimeout(reveal, 250);
    }

    for (const j of [index - 1, index + 1]) {
      const neighbor = items[(j + items.length) % items.length];
      if (neighbor) {
        const pre = new Image();
        pre.src = neighbor.src;
      }
    }
  }

  function open(index: number, from: HTMLElement): void {
    opener = from;
    render(index);
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    $<HTMLElement>("[data-lb-close]").focus();
  }

  function close(): void {
    if (dialog.open) dialog.close();
  }

  function next(): void {
    render((current + 1) % items.length);
  }
  function prev(): void {
    render((current - 1 + items.length) % items.length);
  }

  $("[data-lb-close]").addEventListener("click", close);
  $("[data-lb-next]").addEventListener("click", next);
  $("[data-lb-prev]").addEventListener("click", prev);

  // Click on the empty room (the field around the plate — not the photograph,
  // its caption, the plaque, or any control) closes. The room scrolls, so the
  // rule is "the click is not part of the plate or a control", never a
  // pixel-exact target match against the scroller.
  room.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (target?.closest("figure, a, button")) return;
    close();
  });

  dialog.addEventListener("close", () => {
    document.body.style.overflow = "";
    opener?.focus();
    opener = null;
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    }
  });

  // Touch swipe (left → next, right → prev).
  let startX: number | null = null;
  room.addEventListener(
    "touchstart",
    (event) => {
      startX = event.touches[0]?.clientX ?? null;
    },
    { passive: true },
  );
  room.addEventListener(
    "touchend",
    (event) => {
      if (startX === null) return;
      const endX = event.changedTouches[0]?.clientX ?? startX;
      const dx = endX - startX;
      if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
      startX = null;
    },
    { passive: true },
  );
}

/**
 * Layout-honest slot the plate renders into: the viewer column is the §3.1
 * media frame (lightbox.css mirrors the gallery page's max measure + edge
 * inset), so the ONE shared constant is the authority here too — the
 * candidate the browser consumes is the candidate the plate needs.
 */
const LIGHTBOX_SIZES = MEDIA_FRAME_SIZES;
