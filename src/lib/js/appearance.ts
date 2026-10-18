/*
 * src/lib/js/appearance.ts — appearance preference (visual redesign spec §3).
 *
 * Small, single-purpose progressive enhancement: a stored preference key
 * (`photography.appearance` ∈ system|light|dark) resolved pre-paint by the
 * inline script in Base.astro, and the top-bar radiogroup bound here. No
 * settings framework, no data collection; storage failures degrade to system.
 */

export type Appearance = "system" | "light" | "dark";

export const APPEARANCE_STORAGE_KEY = "photography.appearance";

/** Invalid/absent stored values normalize to system (spec §3.3). */
export function normalizeAppearance(value: string | null): Appearance {
  return value === "light" || value === "dark" ? value : "system";
}

function apply(mode: Appearance): void {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  if (dark) root.dataset.theme = "dark";
  else root.dataset.theme = "light";
  root.style.colorScheme = dark ? "dark" : "light";
}

/** The three modes in the chips' visual order (Day | Night | System) — and
 *  therefore the radiogroup's arrow-key sequence. */
const MODES: readonly Appearance[] = ["light", "dark", "system"];

/**
 * Bind the top-bar Appearance radiogroup. Shows the control only once JS can
 * actually service it (no-JS visitors keep the system theme and never see a
 * dead control — the markup ships `hidden`). Returns a cleanup function.
 *
 * aria-checked and the visual checked state are written by the SAME function
 * so they can never drift apart.
 */
export function bindAppearanceControl(
  group: HTMLElement,
  storage: Storage | null = safeStorage(),
): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const buttons = Array.from(
    group.querySelectorAll<HTMLButtonElement>("[data-appearance-value]"),
  );
  if (buttons.length === 0) return () => {};

  const readStored = (): Appearance => {
    try {
      return normalizeAppearance(storage?.getItem(APPEARANCE_STORAGE_KEY) ?? null);
    } catch {
      return "system";
    }
  };

  /**
   * The mode this page is actually showing. Tracked in memory because storage
   * can be unavailable (private mode / blocked): there `readStored()` always
   * answers "system", so deriving the arrow-key position from storage would
   * snap the user back to Auto on every keypress.
   */
  let active: Appearance = "system";

  /** Single writer for BOTH the ARIA state and (via attribute selector) the paint. */
  const paint = (mode: Appearance): void => {
    for (const button of buttons) {
      const on = button.dataset.appearanceValue === mode;
      button.setAttribute("aria-checked", String(on));
      // Roving tabindex: only the checked radio is in the tab order.
      button.tabIndex = on ? 0 : -1;
    }
  };

  const select = (mode: Appearance): void => {
    try {
      if (mode === "system") storage?.removeItem(APPEARANCE_STORAGE_KEY);
      else storage?.setItem(APPEARANCE_STORAGE_KEY, mode);
    } catch {
      /* storage unavailable: keep applying for this page view */
    }
    active = mode; // in-memory truth, so arrow keys work without storage
    paint(mode);
    apply(mode);
  };

  const onClick = (event: Event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      "[data-appearance-value]",
    );
    if (!button || !group.contains(button)) return;
    select(normalizeAppearance(button.dataset.appearanceValue ?? null));
    button.focus();
  };

  const onKeydown = (event: KeyboardEvent) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = MODES[(MODES.indexOf(active) + step + MODES.length) % MODES.length]!;
    select(next);
    buttons.find((b) => b.dataset.appearanceValue === next)?.focus();
  };

  const onSystemChange = () => {
    if (active === "system") apply("system");
  };

  const initial = readStored();
  active = initial;
  paint(initial);
  apply(initial);
  group.hidden = false;

  group.addEventListener("click", onClick);
  group.addEventListener("keydown", onKeydown);
  media.addEventListener("change", onSystemChange);

  return () => {
    group.removeEventListener("click", onClick);
    group.removeEventListener("keydown", onKeydown);
    media.removeEventListener("change", onSystemChange);
  };
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Auto-bind the top-bar appearance radiogroup. */
export function initAppearance(): void {
  const group = document.querySelector<HTMLElement>("[data-appearance-control]");
  if (group) bindAppearanceControl(group);
}
