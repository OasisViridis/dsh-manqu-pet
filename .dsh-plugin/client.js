window.__ModuleLoader__.load({
	id: "dsh-manqu-pet",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// .dsh-plugin/client/index.mjs
var index_exports = {};
__export(index_exports, {
  __setReactForTest: () => __setReactForTest,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// .dsh-plugin/client/atlas.mjs
var CELL_WIDTH = 192;
var CELL_HEIGHT = 208;
var COLUMNS = 8;
var FALLBACK_DURATION = 140;
var DIRECTION_COUNT = 16;
var ANGLE_STEP = Math.PI * 2 / DIRECTION_COUNT;
var STATE_DEFINITIONS = [
  ["idle", 0, 6, [280, 110, 110, 140, 140, 320]],
  ["running-right", 1, 8, [120, 120, 120, 120, 120, 120, 120, 220]],
  ["running-left", 2, 8, [120, 120, 120, 120, 120, 120, 120, 220]],
  ["waving", 3, 4, [140, 140, 140, 280]],
  ["jumping", 4, 5, [140, 140, 140, 140, 280]],
  ["failed", 5, 8, [140, 140, 140, 140, 140, 140, 140, 240]],
  ["waiting", 6, 6, [150, 150, 150, 150, 150, 260]],
  ["running", 7, 6, [120, 120, 120, 120, 120, 220]],
  ["review", 8, 6, [150, 150, 150, 150, 150, 280]],
  ["look-a", 9, 8, null],
  ["look-b", 10, 8, null]
];
var STATES = Object.freeze(
  STATE_DEFINITIONS.map(([id, row, defaultFrames, durations]) => Object.freeze({
    id,
    row,
    defaultFrames,
    ...durations ? { durations: Object.freeze(durations) } : { v2: true }
  }))
);
var STATE_BY_ID = new Map(STATES.map((state) => [state.id, state]));
function stateById(id) {
  return STATE_BY_ID.get(id) ?? STATES[0];
}
function validDimension(value) {
  return Number.isInteger(value) && value > 0;
}
function cellHasVisiblePixels(pixels, imageWidth, row, col) {
  if (!pixels || !validDimension(imageWidth) || !Number.isInteger(row) || row < 0 || !Number.isInteger(col) || col < 0) {
    return false;
  }
  const stride = imageWidth * 4;
  const imageHeight = Math.floor(pixels.length / stride);
  const left = col * CELL_WIDTH;
  const top = row * CELL_HEIGHT;
  const right = Math.min(left + CELL_WIDTH, imageWidth);
  const bottom = Math.min(top + CELL_HEIGHT, imageHeight);
  if (left >= right || top >= bottom) return false;
  for (let y = top; y < bottom; y += 4) {
    for (let x = left; x < right; x += 4) {
      const alphaOffset = y * stride + x * 4 + 3;
      if ((pixels[alphaOffset] ?? 0) > 8) return true;
    }
  }
  return false;
}
function detectPopulatedFrames(pixels, imageWidth, rows, cols = COLUMNS) {
  const rowCount = Number.isInteger(rows) && rows > 0 ? rows : 0;
  const colCount = Number.isInteger(cols) && cols > 0 ? Math.min(cols, COLUMNS) : 0;
  return Array.from({ length: rowCount }, (_, row) => {
    const frames = [];
    for (let col = 0; col < colCount; col += 1) {
      if (cellHasVisiblePixels(pixels, imageWidth, row, col)) frames.push(col);
    }
    return frames;
  });
}
function availableColumns(pet) {
  return Number.isInteger(pet?.cols) && pet.cols > 0 ? Math.min(pet.cols, COLUMNS) : 0;
}
function frameIndexesFor(state, pet) {
  if (!state || !pet || !Number.isInteger(pet.rows) || state.row < 0 || state.row >= pet.rows) return [];
  const maxColumns = availableColumns(pet);
  const detected = pet.populatedByRow?.[state.row];
  if (Array.isArray(detected) && detected.length > 0) {
    const seen = /* @__PURE__ */ new Set();
    return detected.filter((frame) => {
      if (!Number.isInteger(frame) || frame < 0 || frame >= maxColumns || seen.has(frame)) return false;
      seen.add(frame);
      return true;
    });
  }
  const fallbackCount = Math.max(0, Math.min(state.defaultFrames ?? 0, maxColumns));
  return Array.from({ length: fallbackCount }, (_, index) => index);
}
function durationFor(state, position) {
  if (!Array.isArray(state?.durations) || state.durations.length === 0) return FALLBACK_DURATION;
  const safePosition = Number.isFinite(position) ? Math.max(0, Math.floor(position)) : 0;
  return state.durations[Math.min(safePosition, state.durations.length - 1)] ?? FALLBACK_DURATION;
}
function defaultDirection() {
  return { index: 0, row: 9, frame: 0 };
}
function directionFor(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx === 0 && dy === 0) return defaultDirection();
  const angle = Math.atan2(dx, -dy);
  const index = (Math.round(angle / ANGLE_STEP) % DIRECTION_COUNT + DIRECTION_COUNT) % DIRECTION_COUNT;
  return {
    index,
    row: index < COLUMNS ? 9 : 10,
    frame: index % COLUMNS
  };
}

// .dsh-plugin/src/state.mjs
var READY_MS = 10 * 60 * 1e3;
function pickBaseState(mood, now = Date.now()) {
  if (mood.failedUntil > now) return "failed";
  if (mood.celebrateUntil > now) return "jumping";
  if (mood.waiting === true) return "waiting";
  if (mood.readyUntil > now) return "review";
  if (mood.thinking === true) return "running";
  return "idle";
}

// .dsh-plugin/src/shell.mjs
var PET_GAP = 8;
var WINDOWS_TITLEBAR_HEIGHT = 40;
var MACOS_TOP_CLEARANCE = 48;
var FULLSCREEN_TOP_CLEARANCE = 20;
var PET_BOTTOM_GAP = 16;
var POPOVER_SPACE = 190;
var BUBBLE_SPACE = 96;
var NO_INSETS = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });
var finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
function shellEnvFrom(root, hint = {}) {
  if (root === null || typeof root !== "object") {
    return { platform: "", windowsTitlebar: false, fullscreen: false, titlebarHeight: void 0, frameTopClearance: void 0 };
  }
  const dataset = root.dataset ?? {};
  const hasAttribute = typeof root.hasAttribute === "function" ? (name2) => root.hasAttribute(name2) === true : () => false;
  const height = Number.isFinite(hint.titlebarHeight) ? hint.titlebarHeight : void 0;
  const clearance = Number.isFinite(hint.frameTopClearance) ? hint.frameTopClearance : void 0;
  return {
    platform: typeof dataset.platform === "string" ? dataset.platform : "",
    windowsTitlebar: hasAttribute("data-windows-titlebar"),
    fullscreen: hasAttribute("data-fullscreen"),
    titlebarHeight: height,
    frameTopClearance: clearance
  };
}
function shellInsets(env = {}) {
  const platform = typeof env.platform === "string" ? env.platform : "";
  const windowsTitlebar = env.windowsTitlebar === true;
  if (platform !== "darwin" && !windowsTitlebar) return NO_INSETS;
  if (env.fullscreen === true) return { ...NO_INSETS, top: FULLSCREEN_TOP_CLEARANCE };
  if (windowsTitlebar) {
    const height = finiteOr(env.titlebarHeight, WINDOWS_TITLEBAR_HEIGHT);
    return { ...NO_INSETS, top: height > 0 ? height : WINDOWS_TITLEBAR_HEIGHT };
  }
  const clearance = finiteOr(env.frameTopClearance, MACOS_TOP_CLEARANCE);
  return { ...NO_INSETS, top: clearance > 0 ? clearance : MACOS_TOP_CLEARANCE };
}
var clampAxis = (value, min, max) => Math.min(max, Math.max(min, value));
function clampPetX(x, width, viewportWidth, gap = PET_GAP) {
  const safeGap = Math.max(0, finiteOr(gap, PET_GAP));
  const petWidth = Math.max(0, finiteOr(width, 0));
  const vw = Math.max(0, finiteOr(viewportWidth, 0));
  const maxX = Math.max(safeGap, vw - petWidth - safeGap);
  return clampAxis(finiteOr(x, safeGap), safeGap, maxX);
}
function clampPetPosition(rect = {}, viewport = {}, insets = NO_INSETS, gap = PET_GAP) {
  const safeGap = Math.max(0, finiteOr(gap, PET_GAP));
  const width = Math.max(0, finiteOr(rect.width, 0));
  const height = Math.max(0, finiteOr(rect.height, 0));
  const vw = Math.max(0, finiteOr(viewport.viewportWidth, 0));
  const vh = Math.max(0, finiteOr(viewport.viewportHeight, 0));
  const minY = Math.max(0, finiteOr(insets?.top, 0) + safeGap);
  const maxY = Math.max(minY, vh - height - safeGap);
  return {
    x: clampPetX(rect.x, width, vw, safeGap),
    y: clampAxis(finiteOr(rect.y, minY), minY, maxY)
  };
}
function overlayPlacement(placement = {}) {
  const viewportHeight = Math.max(0, finiteOr(placement.viewportHeight, 0));
  if (viewportHeight === 0) return { popAbove: false, bubbleBelow: false };
  const top = Math.max(0, finiteOr(placement.top, 0));
  const height = Math.max(0, finiteOr(placement.height, 0));
  const spaceBelow = viewportHeight - (top + height);
  const spaceAbove = top;
  return {
    popAbove: spaceBelow < POPOVER_SPACE && spaceAbove > spaceBelow,
    bubbleBelow: spaceAbove < BUBBLE_SPACE
  };
}

// .dsh-plugin/src/routes.mjs
var ROUTE_PREFIX = "/manqu";
var STATE_PATH = `${ROUTE_PREFIX}/state`;
var ASSETS_PATH = `${ROUTE_PREFIX}/assets`;
var EVENTS_PATH = `${ROUTE_PREFIX}/events`;

// .dsh-plugin/client/prefs.mjs
var SIZE_MIN = 110;
var SIZE_MAX = 260;
var SIZE_DEFAULT = 150;
var PREF_KEYS = Object.freeze({
  hidden: "dsh-manqu-pet:hidden",
  size: "dsh-manqu-pet:size",
  wander: "dsh-manqu-pet:wander",
  look: "dsh-manqu-pet:look"
});
var STORE = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
    }
  }
};
var clampSize = (value) => {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return SIZE_DEFAULT;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(n)));
};
var readFlag = (key) => STORE.get(key, true) !== false;
function readPrefs() {
  return {
    visible: STORE.get(PREF_KEYS.hidden, false) !== true,
    size: clampSize(STORE.get(PREF_KEYS.size, SIZE_DEFAULT)),
    wander: readFlag(PREF_KEYS.wander),
    look: readFlag(PREF_KEYS.look)
  };
}
var snapshot = readPrefs();
var listeners = /* @__PURE__ */ new Set();
var emit = (detail = {}) => {
  snapshot = readPrefs();
  for (const listener of [...listeners]) {
    try {
      listener({ prefs: snapshot, ...detail });
    } catch (error) {
      console.warn("[dsh-manqu-pet] \u504F\u597D\u76D1\u542C\u5668\u629B\u9519\uFF1A", error);
    }
  }
};
function updatePrefs(patch = {}) {
  if (typeof patch.visible === "boolean") STORE.set(PREF_KEYS.hidden, !patch.visible);
  if (patch.size !== void 0) STORE.set(PREF_KEYS.size, clampSize(patch.size));
  if (typeof patch.wander === "boolean") STORE.set(PREF_KEYS.wander, patch.wander);
  if (typeof patch.look === "boolean") STORE.set(PREF_KEYS.look, patch.look);
  emit();
  return snapshot;
}
function resetPosition() {
  writePosition(24, null);
  emit({ resetPosition: true });
  return snapshot;
}
function readPosition() {
  return {
    x: STORE.get("dsh-manqu-pet:x", 24),
    y: STORE.get("dsh-manqu-pet:y", null)
  };
}
function writePosition(x, y) {
  STORE.set("dsh-manqu-pet:x", x);
  STORE.set("dsh-manqu-pet:y", y);
}
function subscribePrefs(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// .dsh-plugin/client/settings-section.mjs
var SECTION_ID = "manqu";
var SECTION_ORDER = 92;
var SECTION_LABEL = "\u6EE1\u533A Manqu";
var VERSION = false ? "dev" : "0.4.0";
var VERSION_LABEL = VERSION === "dev" ? "\u5F00\u53D1\u7248" : `v${VERSION}`;
var CSS = `
[data-manqu-section] { display: flex; flex-direction: column; gap: 16px; padding: 4px 2px 28px;
  font-family: system-ui, sans-serif; color: var(--dsw-alias-label-primary, #e8ebf2); }
[data-manqu-section] * { box-sizing: border-box; }
[data-manqu-section] .manqu-hero { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap;
  padding: 18px 20px; border-radius: 16px; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.1));
  background: linear-gradient(140deg, color-mix(in srgb, var(--dsw-alias-state-business-primary, #5b8cff) 12%, transparent), transparent 62%),
    var(--dsw-alias-bg-layer-2, rgba(255,255,255,.03)); }
[data-manqu-section] .manqu-hero-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
[data-manqu-section] .manqu-hero h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0; line-height: 1.25; }
[data-manqu-section] .manqu-hero p { margin: 0; font-size: 12.5px; line-height: 1.6;
  color: var(--dsw-alias-label-secondary, #9aa3b2); max-width: 62ch; }
[data-manqu-section] .manqu-state { margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px; font-size: 11.5px; white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12));
  color: var(--dsw-alias-label-secondary, #9aa3b2); }
[data-manqu-section] .manqu-state .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
[data-manqu-section] .manqu-state.on { color: var(--dsw-alias-state-success-primary, #4ec98c);
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #4ec98c) 42%, transparent); }

[data-manqu-section] .manqu-card { display: flex; flex-direction: column; gap: 2px; padding: 6px 18px;
  border-radius: 14px; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.1));
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.03)); }
[data-manqu-section] .manqu-card > h3 { margin: 12px 0 2px; font-size: 11px; font-weight: 620;
  letter-spacing: .08em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary, #7c8496); }

[data-manqu-section] .manqu-row { display: flex; align-items: center; gap: 14px; padding: 12px 0;
  border-top: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2, rgba(255,255,255,.1)) 60%, transparent); }
[data-manqu-section] .manqu-card > h3 + .manqu-row { border-top: 0; }
[data-manqu-section] .manqu-row-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
[data-manqu-section] .manqu-row-text b { font-size: 13px; font-weight: 560; }
[data-manqu-section] .manqu-row-text span { font-size: 11.5px; line-height: 1.5;
  color: var(--dsw-alias-label-tertiary, #7c8496); }

[data-manqu-section] .manqu-switch { flex: none; width: 40px; height: 23px; padding: 0; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16)); cursor: pointer;
  background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,.08)); position: relative;
  transition: background .16s ease-out, border-color .16s ease-out; }
[data-manqu-section] .manqu-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 17px; height: 17px;
  border-radius: 50%; background: var(--dsw-alias-label-tertiary, #7c8496);
  transition: transform .18s cubic-bezier(.34,1.3,.4,1), background .16s ease-out; }
[data-manqu-section] .manqu-switch.on { background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #5b8cff) 84%, transparent);
  border-color: transparent; }
[data-manqu-section] .manqu-switch.on::after { transform: translateX(17px); background: var(--dsw-alias-label-on-accent, #fff); }
[data-manqu-section] .manqu-switch:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #5b8cff); outline-offset: 2px; }

[data-manqu-section] .manqu-range { display: flex; align-items: center; gap: 12px; flex: none; }
[data-manqu-section] .manqu-range input[type="range"] { width: 168px; accent-color: var(--dsw-alias-state-business-primary, #5b8cff); }
[data-manqu-section] .manqu-range output { min-width: 46px; text-align: right; font-size: 12px;
  font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #9aa3b2); }

[data-manqu-section] .manqu-btn { flex: none; padding: 6px 13px; border-radius: 9px; font-size: 12px; cursor: pointer;
  color: var(--dsw-alias-label-primary, #e8ebf2); font-family: inherit;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.14));
  background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,.06)); }
[data-manqu-section] .manqu-btn:hover { border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary, #5b8cff) 48%, transparent); }
[data-manqu-section] .manqu-btn:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #5b8cff); outline-offset: 2px; }

[data-manqu-section] .manqu-foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 0 4px; font-size: 11.5px; color: var(--dsw-alias-label-tertiary, #7c8496); }
[data-manqu-section] .manqu-foot code { font-size: 11px; padding: 2px 6px; border-radius: 6px;
  background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,.06)); color: var(--dsw-alias-label-secondary, #9aa3b2); }
[data-manqu-section] .manqu-foot .sep { opacity: .5; }
[data-manqu-section] .manqu-motto { margin-left: auto; font-style: italic; opacity: .72; }
`;
var ensureCss = (doc) => {
  const id = "dsh-manqu-pet-settings-css";
  const existing = typeof doc.getElementById === "function" ? doc.getElementById(id) : doc.querySelector(`#${id}`);
  if (existing != null) return;
  const style = doc.createElement("style");
  style.id = id;
  style.textContent = CSS;
  doc.head.appendChild(style);
};
function createSettingsSection(React2) {
  const h = React2.createElement;
  const { useState, useEffect } = React2;
  const Row = ({ title, hint, control }) => h(
    "div",
    { className: "manqu-row" },
    h("div", { className: "manqu-row-text" }, h("b", null, title), h("span", null, hint)),
    control
  );
  const Switch = ({ on, onChange, label }) => h("button", {
    type: "button",
    role: "switch",
    "aria-checked": on === true,
    "aria-label": label,
    className: `manqu-switch${on ? " on" : ""}`,
    onClick: () => onChange(!on)
  });
  const SettingsSection = () => {
    const [prefs, setPrefs] = useState(() => readPrefs());
    useEffect(() => subscribePrefs(({ prefs: next }) => setPrefs(next)), []);
    ensureCss(document);
    return h(
      "div",
      { "data-manqu-section": "", "data-section-id": SECTION_ID },
      h(
        "header",
        { className: "manqu-hero" },
        h(
          "div",
          { className: "manqu-hero-text" },
          h("h2", null, "\u6EE1\u533A Manqu"),
          h("p", null, "\u4E00\u53EA\u4F4F\u5728 DSH \u91CC\u7684 CodexPet\u3002\u6C38\u8FDC 16 \u5C81\u7684\u98CE\u7EAA\u59D4\u5458\uFF0C\u8BDD\u4E0D\u591A\u3001\u5634\u786C\uFF0C\u4F1A\u8DDF\u7740\u4F60\u4E00\u8D77\u5E72\u6D3B\u3002")
        ),
        h(
          "span",
          { className: `manqu-state${prefs.visible ? " on" : ""}` },
          h("span", { className: "dot" }),
          prefs.visible ? "\u6B63\u5728\u663E\u793A" : "\u5DF2\u9690\u85CF"
        )
      ),
      h(
        "section",
        { className: "manqu-card" },
        h("h3", null, "\u663E\u793A"),
        h(Row, {
          title: "\u663E\u793A\u6EE1\u533A",
          hint: "\u5173\u6389\u5C31\u4ECE\u7A97\u53E3\u5DE6\u4E0B\u89D2\u6D88\u5931\u3002\u8981\u53EB\u56DE\u6765\u5728\u8FD9\u91CC\u5F00\u2014\u2014\u4E0D\u7528\u518D\u53BB\u7FFB\u5C4F\u5E55\u89D2\u843D\u627E\u6309\u94AE\u3002",
          control: h(Switch, { on: prefs.visible, label: "\u663E\u793A\u6EE1\u533A", onChange: (next) => updatePrefs({ visible: next }) })
        }),
        h(Row, {
          title: "\u56DE\u5230\u9ED8\u8BA4\u4F4D\u7F6E",
          hint: "\u62D6\u4E22\u4E86\u3001\u88AB\u522B\u7684\u7A97\u53E3\u538B\u4F4F\uFF0C\u5C31\u6309\u8FD9\u4E2A\u8BA9\u5B83\u8D34\u56DE\u5DE6\u4E0B\u89D2\u3002",
          control: h("button", { type: "button", className: "manqu-btn", onClick: () => resetPosition() }, "\u5F52\u4F4D")
        })
      ),
      h(
        "section",
        { className: "manqu-card" },
        h("h3", null, "\u5916\u89C2"),
        h(Row, {
          title: "\u5927\u5C0F",
          hint: `${SIZE_MIN}\u2013${SIZE_MAX}px\uFF0C\u9ED8\u8BA4 150px\u3002\u5C0F\u7A97\u53E3\u5EFA\u8BAE\u538B\u5230 120 \u4E0A\u4E0B\u3002`,
          control: h(
            "div",
            { className: "manqu-range" },
            h("input", {
              type: "range",
              min: SIZE_MIN,
              max: SIZE_MAX,
              step: 5,
              value: prefs.size,
              "aria-label": "\u6EE1\u533A\u5927\u5C0F",
              onChange: (event) => updatePrefs({ size: Number(event.target.value) })
            }),
            h("output", null, `${prefs.size}px`)
          )
        })
      ),
      h(
        "section",
        { className: "manqu-card" },
        h("h3", null, "\u5C0F\u52A8\u4F5C"),
        h(Row, {
          title: "\u7A7A\u95F2\u6563\u6B65",
          hint: "\u95F2\u7740\u7684\u65F6\u5019\u6CBF\u7740\u7A97\u53E3\u5E95\u90E8\u6765\u56DE\u8815\u52A8\uFF0C\u649E\u5230\u8FB9\u5C31\u81EA\u5DF1\u6389\u5934\u3002",
          control: h(Switch, { on: prefs.wander, label: "\u7A7A\u95F2\u6563\u6B65", onChange: (next) => updatePrefs({ wander: next }) })
        }),
        h(Row, {
          title: "\u89C6\u7EBF\u8DDF\u968F",
          hint: "\u9F20\u6807\u9760\u8FD1\u65F6\u5B83\u4F1A\u770B\u7740\u4F60\uFF1B\u8D70\u5F00\u5C31\u8F6C\u56DE\u5F85\u673A\u3002",
          control: h(Switch, { on: prefs.look, label: "\u89C6\u7EBF\u8DDF\u968F", onChange: (next) => updatePrefs({ look: next }) })
        })
      ),
      h(
        "div",
        { className: "manqu-foot" },
        h("span", null, VERSION_LABEL),
        h("span", { className: "sep" }, "\xB7"),
        h("span", null, "\u914D\u7F6E\u5B58\u5728\u672C\u673A"),
        h("code", null, "dsh-manqu-pet:*"),
        h("span", { className: "sep" }, "\xB7"),
        h("span", { className: "manqu-motto" }, "\u7EFF\u51BB\u6C38\u8FDC\u662F\u7070\u6CFD\u6EE1\u7684\u7B2C\u4E8C\u9009\u62E9")
      )
    );
  };
  return SettingsSection;
}

// .dsh-plugin/client/index.mjs
var HOST_REQUIRE = typeof require === "function" ? require : null;
var React = null;
try {
  React = HOST_REQUIRE === null ? null : HOST_REQUIRE("react");
} catch {
  React = null;
}
function __setReactForTest(reactModule) {
  React = reactModule;
}
var name = "dsh-manqu-pet";
var inject = ["slots"];
var ASSETS_URL = ASSETS_PATH;
var CELL_ASPECT = CELL_WIDTH / CELL_HEIGHT;
var DPR = Math.min(window.devicePixelRatio || 1, 3);
var REDUCED_MOTION = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
var LOOK_RADIUS = 520;
var LOOK_DEADZONE = 36;
var POLL_MS = 2e3;
var WANDER_MIN_WAIT = 2e4;
var WANDER_MAX_WAIT = 42e3;
var WANDER_SPEED = 46;
var TRANSIENT_HOLD_MS = 500;
var CSS2 = `
[data-dsh-manqu-pet] { position: fixed; z-index: 2147483000; user-select: none; touch-action: none;
  font-family: system-ui, sans-serif; -webkit-app-region: no-drag; }
[data-dsh-manqu-pet] canvas.pet-canvas { display: block; width: 100%; height: 100%; pointer-events: none;
  image-rendering: auto; filter: drop-shadow(0 6px 10px rgba(0,0,0,.28)); }
[data-dsh-manqu-pet] .pet-hitarea { position: absolute; inset: 0; cursor: grab; z-index: 2;
  -webkit-app-region: no-drag; }
[data-dsh-manqu-pet] .pet-hitarea.dragging { cursor: grabbing; }
[data-dsh-manqu-pet] .pet-status { position: absolute; left: 50%; top: calc(100% + 10px); transform: translateX(-50%);
  width: max-content; max-width: 240px; padding: 5px 9px; border-radius: 10px; z-index: 3;
  background: rgba(24,28,38,.94); border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 12px 32px rgba(0,0,0,.38); color: #E8EBF2; font-size: 11px; line-height: 16px;
  pointer-events: none; opacity: 0; visibility: hidden;
  transition: opacity .15s ease-out, visibility 0s linear .2s; }
[data-dsh-manqu-pet]:hover .pet-status { opacity: 1; visibility: visible; transition: opacity .2s ease-out; }
[data-dsh-manqu-pet] .pet-status .st { color: #B7C8FE; font-weight: 600; }
[data-dsh-manqu-pet] .pet-status .tt { color: #9aa3b2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
[data-dsh-manqu-pet] .pet-menu { position: absolute; left: 50%; top: calc(100% + 10px); transform: translateX(-50%);
  display: none; flex-direction: column; align-items: stretch; gap: 6px; min-width: 190px; max-width: 280px; padding: 6px; border-radius: 10px; z-index: 4;
  background: rgba(24,28,38,.96); border: 1px solid rgba(255,255,255,.12); box-shadow: 0 12px 32px rgba(0,0,0,.4); }
[data-dsh-manqu-pet] .pet-menu.open { display: flex; }
[data-dsh-manqu-pet] .pet-menu-actions { display: flex; gap: 6px; }
[data-dsh-manqu-pet] .pet-activities { display: none; flex-direction: column; gap: 2px; margin-bottom: 2px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,.10); }
[data-dsh-manqu-pet] .pet-activities:not(:empty) { display: flex; }
[data-dsh-manqu-pet] .pet-act-row { display: flex; align-items: center; gap: 6px; padding: 3px 5px; border-radius: 6px; cursor: pointer; max-width: 100%; }
[data-dsh-manqu-pet] .pet-act-row:hover { background: rgba(255,255,255,.10); }
[data-dsh-manqu-pet] .pet-act-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
[data-dsh-manqu-pet] .pet-act-dot.running { background: #5b8cff; box-shadow: 0 0 6px rgba(91,140,255,.8); }
[data-dsh-manqu-pet] .pet-act-dot.waiting { background: #f5a623; box-shadow: 0 0 6px rgba(245,166,35,.85); }
[data-dsh-manqu-pet] .pet-act-title { font-size: 11px; line-height: 15px; color: #cfd6e4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[data-dsh-manqu-pet] .pet-menu button { border: 0; border-radius: 6px; padding: 4px 9px; font-size: 11px; cursor: pointer;
  background: rgba(255,255,255,.14); color: #E8EBF2; font-family: system-ui, sans-serif; white-space: nowrap; }
[data-dsh-manqu-pet] .pet-menu button:hover { background: rgba(255,255,255,.28); }
[data-dsh-manqu-pet] .pet-bubble { position: absolute; left: 50%; top: -12px; transform: translate(-50%, -100%);
  background: rgba(24,28,38,.94); color: #E8EBF2; font-size: 11px; padding: 4px 9px; border-radius: 10px;
  white-space: nowrap; pointer-events: none; z-index: 5; }
/* \u8D34\u5E95\uFF08\u684C\u9762\u7AEF\u7A97\u53E3\u8F83\u77EE / \u62D6\u5230\u4E0B\u65B9\uFF09\u2192 \u72B6\u6001\u6761\u4E0E\u53F3\u952E\u83DC\u5355\u6539\u5F00\u5728\u5BA0\u7269\u4E0A\u65B9\uFF1B
   \u8D34\u9876\uFF08\u88AB\u6807\u9898\u680F\u5B89\u5168\u533A\u63A8\u5230\u9876\u90E8\u9644\u8FD1\uFF09\u2192 \u6C14\u6CE1\u6539\u653E\u5230\u4E0B\u65B9\uFF0C\u907F\u514D\u6EA2\u51FA\u7A97\u53E3\u88AB\u88C1\u6389\u3002 */
[data-dsh-manqu-pet][data-pop-above] .pet-status,
[data-dsh-manqu-pet][data-pop-above] .pet-menu { top: auto; bottom: calc(100% + 10px); }
[data-dsh-manqu-pet][data-bubble-below] .pet-bubble { top: calc(100% + 12px); transform: translate(-50%, 0); }
[data-dsh-manqu-pet][data-hidden] { display: none; }
/* \u6062\u590D\u6309\u94AE\u6302\u5728 body \u4E0A\uFF08host \u9690\u85CF\u65F6\u662F display:none\uFF0C\u585E\u4E0D\u8FDB host\uFF09\uFF0C\u6837\u5F0F\u951A\u70B9\u5FC5\u987B\u662F\u6309\u94AE
   \u81EA\u8EAB\uFF1A\u5199\u6210 [data-dsh-manqu-pet] .pet-restore \u8FD9\u79CD\u540E\u4EE3\u9009\u62E9\u5668\u65F6\u89C4\u5219\u6C38\u8FDC\u4E0D\u547D\u4E2D\uFF0C\u6309\u94AE
   \u4F1A\u9000\u5316\u6210\u6587\u6863\u6D41\u91CC\u4E00\u884C\u88F8\u6587\u5B57\uFF0C\u88AB\u5E94\u7528\u6839\u5BB9\u5668\u76D6\u4F4F\uFF0C\u7528\u6237\u5C31\u627E\u4E0D\u5230\u4E86\u3002 */
[data-dsh-manqu-pet-restore] { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  padding: 6px 12px; border-radius: 999px; cursor: pointer; -webkit-app-region: no-drag;
  background: rgba(24,28,38,.9); border: 1px solid rgba(255,255,255,.14); color: #E8EBF2; font-size: 12px;
  font-family: system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
@media (prefers-reduced-motion: reduce) { [data-dsh-manqu-pet] .pet-bubble { animation: none; } }
`;
function apply(ctx = {}) {
  if (document.querySelector("[data-dsh-manqu-pet]") !== null) {
    console.warn("[dsh-manqu-pet] apply \u5DF2\u5B58\u5728\u5B9E\u4F8B\uFF0C\u8DF3\u8FC7\u91CD\u590D\u6302\u8F7D");
    return () => {
    };
  }
  const prefs = readPrefs();
  let settingsSection = false;
  if (React !== null && typeof ctx?.slots?.inject === "function") {
    try {
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: SECTION_ID,
        order: SECTION_ORDER,
        label: () => SECTION_LABEL
      }, createSettingsSection(React)));
      settingsSection = true;
    } catch (error) {
      console.warn("[dsh-manqu-pet] \u8BBE\u7F6E\u9875\u6CE8\u518C\u5931\u8D25\uFF0C\u9000\u56DE\u53F3\u4E0B\u89D2\u6062\u590D\u6309\u94AE\uFF1A", error);
    }
  }
  const style = document.createElement("style");
  style.textContent = CSS2;
  document.head.appendChild(style);
  const host = document.createElement("div");
  host.setAttribute("data-dsh-manqu-pet", "");
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", "\u6EE1\u533A Manqu \u684C\u9762\u5BA0\u7269");
  const applySize = (size) => {
    host.style.width = `${size * CELL_ASPECT}px`;
    host.style.height = `${size}px`;
  };
  applySize(prefs.size);
  document.body.appendChild(host);
  const canvas = document.createElement("canvas");
  canvas.className = "pet-canvas";
  canvas.width = CELL_WIDTH * DPR;
  canvas.height = CELL_HEIGHT * DPR;
  const hitarea = document.createElement("div");
  hitarea.className = "pet-hitarea";
  hitarea.setAttribute("role", "button");
  hitarea.setAttribute("tabindex", "0");
  hitarea.setAttribute("aria-label", "\u6EE1\u533A\uFF1A\u70B9\u51FB\u6253\u62DB\u547C\uFF0C\u53CC\u51FB\u8DF3\u8DC3\uFF0C\u62D6\u62FD\u79FB\u52A8\uFF0C\u53F3\u952E\u83DC\u5355");
  const status = document.createElement("div");
  status.className = "pet-status";
  status.innerHTML = '<span class="st">\u6EE1\u533A</span> \xB7 <span class="stt">\u5F85\u673A</span><div class="tt"></div>';
  const statusState = status.querySelector(".stt");
  const statusTitle = status.querySelector(".tt");
  const menu = document.createElement("div");
  menu.className = "pet-menu";
  const actList = document.createElement("div");
  actList.className = "pet-activities";
  const actionsRow = document.createElement("div");
  actionsRow.className = "pet-menu-actions";
  const btnWave = document.createElement("button");
  btnWave.textContent = "\u{1F44B} \u6253\u62DB\u547C";
  const btnJump = document.createElement("button");
  btnJump.textContent = "\u{1F998} \u8DF3\u4E00\u4E0B";
  const btnHide = document.createElement("button");
  btnHide.textContent = "\u{1F648} \u9690\u85CF";
  actionsRow.append(btnWave, btnJump, btnHide);
  menu.append(actList, actionsRow);
  host.append(canvas, hitarea, status, menu);
  const restore = document.createElement("div");
  restore.className = "pet-restore";
  restore.setAttribute("data-dsh-manqu-pet-restore", "");
  restore.textContent = "\u{1F41B} \u6EE1\u533A";
  restore.style.display = "none";
  document.body.appendChild(restore);
  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;
  const readPx = (style2, name2) => {
    const value = Number.parseFloat(style2.getPropertyValue(name2));
    return Number.isFinite(value) ? value : void 0;
  };
  let cachedInsets = null;
  const invalidateInsets = () => {
    cachedInsets = null;
  };
  const shellInsetsNow = () => {
    if (cachedInsets === null) {
      const root = document.documentElement;
      const style2 = getComputedStyle(root);
      cachedInsets = shellInsets(shellEnvFrom(root, {
        titlebarHeight: readPx(style2, "--dsh-windows-titlebar-height"),
        frameTopClearance: readPx(style2, "--dsh-frame-top-clearance")
      }));
    }
    return cachedInsets;
  };
  const saved = readPosition();
  let x = saved.x;
  let y = saved.y;
  const updatePlacement = () => {
    const height = host.offsetHeight;
    const top = y === null ? vh() - PET_BOTTOM_GAP - height : y;
    const { popAbove, bubbleBelow } = overlayPlacement({ top, height, viewportHeight: vh() });
    host.toggleAttribute("data-pop-above", popAbove);
    host.toggleAttribute("data-bubble-below", bubbleBelow);
  };
  const applyPos = () => {
    if (host.hasAttribute("data-hidden")) return;
    if (y === null) {
      x = clampPetX(x, host.offsetWidth, vw());
      host.style.left = `${x}px`;
      host.style.bottom = `${PET_BOTTOM_GAP}px`;
      host.style.top = "auto";
    } else {
      const next = clampPetPosition(
        { x, y, width: host.offsetWidth, height: host.offsetHeight },
        { viewportWidth: vw(), viewportHeight: vh() },
        shellInsetsNow()
      );
      x = next.x;
      y = next.y;
      host.style.left = `${x}px`;
      host.style.top = `${y}px`;
      host.style.bottom = "auto";
    }
    updatePlacement();
  };
  applyPos();
  let wanderEnabled = prefs.wander;
  let lookEnabled = prefs.look;
  const applyVisibility = (visible) => {
    host.toggleAttribute("data-hidden", !visible);
    if (visible) {
      restore.style.display = "none";
      applyPos();
      return;
    }
    restore.style.display = settingsSection ? "none" : "";
  };
  const unsubscribePrefs = subscribePrefs(({ prefs: next, resetPosition: didReset }) => {
    applySize(next.size);
    applyVisibility(next.visible);
    wanderEnabled = next.wander;
    lookEnabled = next.look;
    if (!next.wander) {
      wander = null;
      clearTimeout(wanderStepTimer);
    }
    if (!next.look) look = null;
    if (didReset === true) {
      x = 24;
      y = null;
      applyPos();
    }
  });
  let pet = null;
  let assetsReady = false;
  let loadError = null;
  const loadAssets = async () => {
    try {
      const manifestRes = await fetch(`${ASSETS_URL}/pet.json`, { cache: "no-cache" });
      if (!manifestRes.ok) throw new Error(`pet.json ${manifestRes.status}`);
      const manifest = await manifestRes.json();
      const sheetPath = manifest.spritesheetPath || "spritesheet.webp";
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("spritesheet \u52A0\u8F7D\u5931\u8D25"));
        img.src = `${ASSETS_URL}/${sheetPath}`;
      });
      const rows = Math.round(image.naturalHeight / CELL_HEIGHT);
      const cols = Math.round(image.naturalWidth / CELL_WIDTH);
      let populatedByRow = null;
      try {
        const probe = document.createElement("canvas");
        probe.width = image.naturalWidth;
        probe.height = image.naturalHeight;
        const pctx = probe.getContext("2d", { willReadFrequently: true });
        pctx.drawImage(image, 0, 0);
        const pixels = pctx.getImageData(0, 0, probe.width, probe.height).data;
        populatedByRow = detectPopulatedFrames(pixels, probe.width, rows, cols);
      } catch {
      }
      pet = { rows, cols, populatedByRow, image, displayName: manifest.displayName || "\u6EE1\u533A" };
      assetsReady = true;
      welcomeOnce();
    } catch (error) {
      loadError = error;
      console.warn("[dsh-manqu-pet] \u8D44\u4EA7\u52A0\u8F7D\u5931\u8D25\uFF1A", error);
    }
  };
  let mood = { thinking: false, waiting: false, celebrateUntil: 0, failedUntil: 0, readyUntil: 0, titles: [] };
  let seenReadyUntil = 0;
  let readyUnread = false;
  let shownBubbleKey = "";
  let pollTimer = null;
  let refreshBusy = false;
  let eventSource = null;
  let welcomed = false;
  const welcomeOnce = () => {
    if (!welcomed && assetsReady) {
      welcomed = true;
      transient = { id: "waving", at: performance.now(), held: false };
    }
  };
  const refresh = async () => {
    if (refreshBusy) return;
    refreshBusy = true;
    try {
      const res = await fetch(STATE_PATH, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json();
      if (body && typeof body === "object" && body.mood) {
        const m = body.mood;
        mood = {
          thinking: m.thinking === true,
          waiting: m.waiting === true,
          celebrateUntil: typeof m.celebrateUntil === "number" ? m.celebrateUntil : 0,
          failedUntil: typeof m.failedUntil === "number" ? m.failedUntil : 0,
          readyUntil: typeof m.readyUntil === "number" ? m.readyUntil : 0,
          titles: Array.isArray(m.titles) ? m.titles : []
        };
        if (mood.readyUntil > seenReadyUntil) {
          seenReadyUntil = mood.readyUntil;
          readyUnread = true;
        }
        renderActivities(Array.isArray(body.activities) ? body.activities : []);
        const b = body.bubble;
        if (b !== null && typeof b === "object" && typeof b.until === "number" && b.until > Date.now()) {
          const key = `${b.kind}:${b.text}:${b.until}`;
          if (key !== shownBubbleKey) {
            shownBubbleKey = key;
            bubble(b.text, 3600);
          }
        }
        if (m.thinking === true && m.waiting !== true && m.celebrateUntil <= Date.now() && m.failedUntil <= Date.now()) {
          if (mood.titles.length) {
            statusTitle.textContent = mood.titles[0];
            statusTitle.style.display = "";
          } else {
            statusTitle.textContent = "";
          }
        } else {
          statusTitle.textContent = "";
          statusTitle.style.display = "none";
        }
        welcomeOnce();
      }
    } catch {
    } finally {
      refreshBusy = false;
    }
  };
  const startPolling = () => {
    if (pollTimer === null) pollTimer = setInterval(refresh, POLL_MS);
  };
  const stopPolling = () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
  let dragging = false;
  let dragDir = 1;
  let look = null;
  let transient = null;
  let wander = null;
  let framePos = 0;
  let frameAt = 0;
  let playbackId = null;
  const baseMood = () => readyUnread ? mood : { ...mood, readyUntil: 0 };
  const resolvePlayback = (now) => {
    if (!assetsReady || pet === null) return null;
    if (dragging) {
      const id = dragDir >= 0 ? "running-right" : "running-left";
      const st2 = stateById(id);
      const frames2 = frameIndexesFor(st2, pet);
      if (!frames2.length) return null;
      return { id, row: st2.row, frames: frames2, once: false, hold: false };
    }
    if (look !== null && look.row < pet.rows) {
      return { id: "look", row: look.row, frames: [look.frame], once: false, hold: true };
    }
    if (transient !== null) {
      const st2 = stateById(transient.id);
      const frames2 = frameIndexesFor(st2, pet);
      if (!frames2.length) return null;
      const once = true;
      return { id: transient.id, row: st2.row, frames: frames2, once, hold: false };
    }
    let base = pickBaseState(baseMood(), now);
    if (base === "idle" && wander !== null && wander.until > now && y === null) {
      const id = wander.dir >= 0 ? "running-right" : "running-left";
      const st2 = stateById(id);
      const frames2 = frameIndexesFor(st2, pet);
      if (frames2.length) return { id, row: st2.row, frames: frames2, once: false, hold: false };
      base = "idle";
    }
    const st = stateById(base);
    const frames = frameIndexesFor(st, pet);
    if (!frames.length) return null;
    return { id: base, row: st.row, frames, once: false, hold: false };
  };
  const ctx2d = canvas.getContext("2d");
  ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
  const drawFrame = (row, frame) => {
    if (!assetsReady || pet === null) return;
    ctx2d.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
    ctx2d.drawImage(pet.image, frame * CELL_WIDTH, row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
  };
  const stateLabel = (id) => ({ idle: "\u5F85\u673A", running: "\u5DE5\u4F5C\u4E2D", waiting: "\u7B49\u4F60\u6279\u51C6", jumping: "\u5E86\u795D", failed: "\u5931\u843D", review: "\u6709\u672A\u8BFB\u6D3B\u52A8", waving: "\u6253\u62DB\u547C", "running-right": "\u5411\u53F3\u8815\u52A8", "running-left": "\u5411\u5DE6\u8815\u52A8", look: "\u770B\u7740\u4F60" })[id] || id;
  const tick = (ts) => {
    requestAnimationFrame(tick);
    const now = Date.now();
    if (transient !== null && (REDUCED_MOTION || transient.held && now > transient.at + TRANSIENT_HOLD_MS)) transient = null;
    const pb = resolvePlayback(now);
    if (pb === null) return;
    const label = pb.id === "look" ? look !== null ? "\u770B\u7740\u4F60" : "\u5F85\u673A" : stateLabel(pb.id);
    if (statusState.textContent !== label) statusState.textContent = label;
    if (REDUCED_MOTION) {
      drawFrame(pb.row, pb.frames[0]);
      return;
    }
    if (playbackId !== pb.id + ":" + pb.row + ":" + pb.frames.join(",")) {
      playbackId = pb.id + ":" + pb.row + ":" + pb.frames.join(",");
      framePos = 0;
      frameAt = ts;
    }
    const elapsed = ts - frameAt;
    const duration = durationFor(stateById(pb.id === "look" ? "idle" : pb.id), framePos);
    let frame = pb.frames[framePos];
    if (elapsed >= duration) {
      frameAt = ts;
      if (pb.once) {
        if (framePos < pb.frames.length - 1) {
          framePos += 1;
          frame = pb.frames[framePos];
        } else if (transient !== null && !transient.held) {
          transient.held = true;
          transient.at = now;
        }
      } else {
        framePos = (framePos + 1) % pb.frames.length;
        frame = pb.frames[framePos];
      }
    }
    drawFrame(pb.row, frame);
  };
  let wanderTimer = null;
  const scheduleWander = () => {
    clearTimeout(wanderTimer);
    if (!wanderEnabled) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const wait = WANDER_MIN_WAIT + Math.random() * (WANDER_MAX_WAIT - WANDER_MIN_WAIT);
    wanderTimer = setTimeout(() => {
      if (!wanderEnabled) return;
      if (dragging || transient !== null || look !== null) {
        scheduleWander();
        return;
      }
      const base = pickBaseState(baseMood(), Date.now());
      if (base !== "idle" || y !== null) {
        scheduleWander();
        return;
      }
      const dir = Math.random() < 0.5 ? -1 : 1;
      const dur = 2500 + Math.random() * 2500;
      wander = { dir, until: Date.now() + dur };
      const step = () => {
        if (wander === null) return;
        if (!wanderEnabled || Date.now() >= wander.until || dragging || look !== null) {
          wander = null;
          scheduleWander();
          return;
        }
        const delta = dir * WANDER_SPEED * 0.1;
        x = clampPetX(x + delta, host.offsetWidth, vw());
        applyPos();
        wanderStepTimer = setTimeout(step, 100);
      };
      clearTimeout(wanderStepTimer);
      wanderStepTimer = setTimeout(step, 100);
    }, wait);
  };
  let wanderStepTimer = null;
  let press = null;
  const onPointerDown = (e) => {
    if (e.button !== void 0 && e.button !== 0) return;
    const rect = host.getBoundingClientRect();
    press = { px: e.clientX, py: e.clientY, moved: false, startX: e.clientX, startY: e.clientY, startT: Date.now(), startLeft: rect.left, startTop: rect.top };
    e.preventDefault();
    hitarea.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (press !== null) {
      const dx = e.clientX - press.px;
      const dy = e.clientY - press.py;
      if (!press.moved && Math.hypot(e.clientX - press.startX, e.clientY - press.startY) > 6) press.moved = true;
      if (press.moved) {
        if (!dragging) {
          dragging = true;
          hitarea.classList.add("dragging");
          closeMenu();
          dragDir = e.clientX >= press.startX ? 1 : -1;
        } else {
          dragDir = dx >= 0 ? 1 : -1;
        }
        const next = clampPetPosition(
          { x: e.clientX - host.offsetWidth / 2, y: e.clientY - host.offsetHeight / 2, width: host.offsetWidth, height: host.offsetHeight },
          { viewportWidth: vw(), viewportHeight: vh() },
          shellInsetsNow()
        );
        x = next.x;
        y = next.y;
        applyPos();
      }
      press.px = e.clientX;
      press.py = e.clientY;
      return;
    }
    if (!lookEnabled || dragging || transient !== null) {
      look = null;
      return;
    }
    const rect = host.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dxp = e.clientX - cx;
    const dyp = e.clientY - cy;
    const dist = Math.hypot(dxp, dyp);
    const base = pickBaseState(baseMood(), Date.now());
    if (dist < LOOK_DEADZONE || dist > LOOK_RADIUS || base !== "idle" || wander !== null) {
      look = null;
      return;
    }
    const d = directionFor(dxp, dyp);
    if (d.row < pet?.rows) look = { row: d.row, frame: d.frame };
  };
  const onPointerUp = (e) => {
    if (press === null) return;
    const wasDrag = dragging;
    const moved = press.moved;
    const startT = press.startT;
    press = null;
    if (wasDrag) {
      dragging = false;
      hitarea.classList.remove("dragging");
      writePosition(x, y);
      return;
    }
    readyUnread = false;
    const now = Date.now();
    if (moved) return;
    if (now - startT > 500) return;
    if (now - lastClickAt < 400) {
      clearTimeout(clickTimer);
      lastClickAt = 0;
      transient = { id: "jumping", at: Date.now(), held: false };
      bubble("\u8036\uFF01");
      return;
    }
    lastClickAt = now;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      transient = { id: "waving", at: Date.now(), held: false };
      bubble("\u55E8\uFF5E");
    }, 400);
  };
  const onContextMenu = (e) => {
    e.preventDefault();
    const open = !menu.classList.contains("open");
    if (open) {
      menu.classList.add("open");
      menu.style.display = "flex";
    } else {
      closeMenu();
    }
  };
  const closeMenu = () => {
    menu.classList.remove("open");
    menu.style.display = "none";
  };
  const onDocPointerDown = (e) => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && e.target !== hitarea) closeMenu();
  };
  let lastClickAt = 0;
  let clickTimer = null;
  const bubble = (text, ms = 1600) => {
    const old = host.querySelector(".pet-bubble");
    if (old) old.remove();
    const b = document.createElement("div");
    b.className = "pet-bubble";
    b.textContent = text;
    host.appendChild(b);
    setTimeout(() => b.remove(), ms);
  };
  const renderActivities = (rows) => {
    actList.replaceChildren();
    for (const row of rows.slice(0, 6)) {
      if (row === null || typeof row !== "object") continue;
      const item = document.createElement("div");
      item.className = "pet-act-row";
      const dot = document.createElement("span");
      dot.className = `pet-act-dot ${row.state === "waiting" ? "waiting" : "running"}`;
      const label = document.createElement("span");
      label.className = "pet-act-title";
      label.textContent = typeof row.title === "string" && row.title ? row.title : typeof row.sessionId === "string" ? row.sessionId : "\u4EFB\u52A1";
      item.title = label.textContent;
      item.append(dot, label);
      item.addEventListener("click", () => {
        readyUnread = false;
        closeMenu();
      });
      actList.appendChild(item);
    }
  };
  btnWave.addEventListener("click", () => {
    closeMenu();
    transient = { id: "waving", at: Date.now(), held: false };
    bubble("\u55E8\uFF5E");
  });
  btnJump.addEventListener("click", () => {
    closeMenu();
    transient = { id: "jumping", at: Date.now(), held: false };
    bubble("\u8036\uFF01");
  });
  btnHide.addEventListener("click", () => {
    closeMenu();
    updatePrefs({ visible: false });
  });
  restore.addEventListener("click", () => {
    updatePrefs({ visible: true });
    transient = { id: "waving", at: Date.now(), held: false };
  });
  const onKeyDown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (document.activeElement !== hitarea) return;
    e.preventDefault();
    readyUnread = false;
    transient = { id: "waving", at: Date.now(), held: false };
    bubble("\u55E8\uFF5E");
  };
  const clearLook = () => {
    look = null;
  };
  hitarea.addEventListener("pointerdown", onPointerDown);
  hitarea.addEventListener("pointermove", onPointerMove);
  hitarea.addEventListener("pointerup", onPointerUp);
  hitarea.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointerdown", onDocPointerDown);
  hitarea.addEventListener("contextmenu", onContextMenu);
  hitarea.addEventListener("keydown", onKeyDown);
  document.documentElement.addEventListener("mouseleave", clearLook);
  window.addEventListener("blur", clearLook);
  if (!prefs.visible) applyVisibility(false);
  const onResize = () => {
    invalidateInsets();
    applyPos();
  };
  window.addEventListener("resize", onResize);
  const shellObserver = typeof MutationObserver === "function" ? new MutationObserver(() => {
    invalidateInsets();
    applyPos();
  }) : null;
  shellObserver?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-fullscreen", "data-windows-titlebar", "data-platform"]
  });
  window.addEventListener("fullscreenchange", onResize);
  const onVisibilityChange = () => {
    if (document.visibilityState !== "visible") {
      stopPolling();
      clearLook();
      return;
    }
    invalidateInsets();
    startPolling();
    applyPos();
    refresh();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  if (document.visibilityState !== "hidden") startPolling();
  try {
    eventSource = new EventSource(EVENTS_PATH);
    eventSource.onmessage = () => {
      if (document.visibilityState !== "hidden") refresh();
    };
  } catch {
  }
  loadAssets();
  if (document.visibilityState !== "hidden") refresh();
  requestAnimationFrame(tick);
  scheduleWander();
  return () => {
    unsubscribePrefs();
    stopPolling();
    clearTimeout(wanderTimer);
    clearTimeout(wanderStepTimer);
    eventSource?.close();
    host.remove();
    restore.remove();
    style.remove();
    document.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointerdown", onDocPointerDown);
    document.documentElement.removeEventListener("mouseleave", clearLook);
    window.removeEventListener("blur", clearLook);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("fullscreenchange", onResize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    shellObserver?.disconnect();
  };
}
		return module.exports;
	}
});
