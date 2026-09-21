// ---------------------------------------------------------------------------
// "/settings" route: the appearance customiser (the whole point of this
// project), plus playback device access and account info.
//
// The user picks three colours; js/theme.js derives everything else from
// them so no combination can render the app unreadable.
// ---------------------------------------------------------------------------

import { apiFetch } from "../api.js";
import { el, clear } from "../dom.js";
import {
  PRESETS,
  FONT_OPTIONS,
  TEXT_SIZES,
  loadSettings,
  applySettings,
  settingsFromPreset,
  defaultSettings,
  resolveTokens,
} from "../theme.js";
import { normalizeHex } from "../color.js";
import { logout } from "../auth.js";
import { renderError } from "../components/async-states.js";
import { open as openDeviceSheet } from "../components/device-sheet.js";
import { icon } from "../icons.js";
import { BUILD_VERSION } from "../version.js";

let settings = null;
let presetRowEl = null;

export function render(container) {
  settings = loadSettings();
  draw(container);
}

// Editing a colour by hand means the appearance no longer matches whatever
// preset was selected. The chips can't be redrawn wholesale here — that
// would pull focus out of the hex field mid-type — so just drop the
// highlight.
function markCustom() {
  if (!presetRowEl) return;
  presetRowEl.querySelectorAll(".preset-chip-active").forEach((chip) => {
    chip.classList.remove("preset-chip-active");
  });
}

// Colour and hex inputs update themselves in place; anything that changes
// what the *other* controls should show (picking a preset, resetting)
// redraws the page. Redrawing on every keystroke would fight the hex field
// for focus.
function update(partial, { redraw = false, container = null } = {}) {
  settings = { ...settings, ...partial };
  applySettings(settings);
  if (redraw && container) draw(container);
}

// A hand-picked colour: apply it and drop the preset highlight, without
// redrawing (which would interrupt typing).
function updateCustom(partial) {
  update({ ...partial, preset: "custom" });
  markCustom();
}

function draw(container) {
  clear(container);

  const page = el("div", { class: "page page-settings" });
  page.appendChild(el("h1", { class: "settings-page-title", text: "Settings" }));

  page.appendChild(buildAppearanceCard(container));
  page.appendChild(buildLookCard(container));
  page.appendChild(buildPlaybackCard());

  const accountCard = buildCard("Account");
  accountCard.appendChild(el("p", { class: "state-message", text: "Loading…" }));
  page.appendChild(accountCard);

  page.appendChild(
    el("button", {
      class: "btn-secondary logout-button",
      type: "button",
      text: "Log out",
      onclick: () => {
        logout();
        window.location.reload();
      },
    })
  );

  page.appendChild(el("p", { class: "build-version", text: `Build ${BUILD_VERSION}` }));
  container.appendChild(page);

  loadAccount(accountCard);
}

// --- building blocks --------------------------------------------------------

function buildCard(title, action) {
  const header = el("div", { class: "settings-card-header" }, [
    el("h2", { class: "settings-card-title", text: title }),
    action || null,
  ]);
  return el("section", { class: "settings-card" }, [header]);
}

function buildRow(label, description, control) {
  return el("div", { class: "setting-row" }, [
    el("div", { class: "setting-label-group" }, [
      el("span", { class: "setting-label", text: label }),
      description ? el("span", { class: "setting-desc", text: description }) : null,
    ]),
    el("div", { class: "setting-control" }, [control]),
  ]);
}

function buildSegmented(options, currentValue, onChange) {
  const group = el("div", { class: "segmented" });
  for (const option of options) {
    group.appendChild(
      el("button", {
        class: `segmented-option${option.value === currentValue ? " segmented-option-active" : ""}`,
        type: "button",
        text: option.label,
        onclick: () => onChange(option.value),
      })
    );
  }
  return group;
}

// Native colour picker rendered as a swatch, plus an editable hex field so a
// value can be typed or copied exactly.
function buildColorField(value, onChange) {
  const current = normalizeHex(value);

  const swatch = el("input", { class: "color-swatch", type: "color", value: current });
  const hex = el("input", {
    class: "color-hex",
    type: "text",
    value: current,
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    inputmode: "text",
    maxlength: "7",
  });

  swatch.addEventListener("input", () => {
    const next = normalizeHex(swatch.value);
    hex.value = next;
    onChange(next);
  });

  // Only commit once it parses, so half-typed values don't flash the app
  // through nonsense colours on every keystroke.
  hex.addEventListener("input", () => {
    const raw = hex.value.trim();
    if (!/^#?[0-9a-f]{6}$/i.test(raw) && !/^#?[0-9a-f]{3}$/i.test(raw)) return;
    const next = normalizeHex(raw);
    swatch.value = next;
    onChange(next);
  });
  hex.addEventListener("blur", () => {
    hex.value = normalizeHex(hex.value, current);
  });

  return el("div", { class: "color-field" }, [swatch, hex]);
}

// --- appearance card --------------------------------------------------------

function buildAppearanceCard(container) {
  const resetButton = el("button", {
    class: "btn-tiny",
    type: "button",
    text: "Reset",
    onclick: () => update(defaultSettings(), { redraw: true, container }),
  });

  const card = buildCard("App colours", resetButton);

  card.appendChild(
    el("p", {
      class: "settings-card-blurb",
      text:
        "Pick any colours you like — text, borders and button labels are worked out from them, so nothing ends up unreadable. Saved on this device.",
    })
  );

  // Background: solid or gradient
  const backgroundControl = buildSegmented(
    [
      { value: "solid", label: "Solid" },
      { value: "gradient", label: "Gradient" },
    ],
    settings.backgroundMode,
    (mode) => update({ backgroundMode: mode, preset: "custom" }, { redraw: true, container })
  );
  card.appendChild(
    buildRow("Background", "Behind your playlists and tracks.", backgroundControl)
  );

  if (settings.backgroundMode === "gradient") {
    card.appendChild(
      el("div", { class: "color-row" }, [
        // Label and field are grouped so a narrow screen wraps them
        // together rather than orphaning "Bottom" from its swatch.
        el("div", { class: "color-pair" }, [
          el("span", { class: "color-row-label", text: "Top" }),
          buildColorField(settings.backgroundTop, (value) => updateCustom({ backgroundTop: value })),
        ]),
        el("div", { class: "color-pair" }, [
          el("span", { class: "color-row-label", text: "Bottom" }),
          buildColorField(settings.backgroundBottom, (value) =>
            updateCustom({ backgroundBottom: value })
          ),
        ]),
      ])
    );
  } else {
    card.appendChild(
      el("div", { class: "color-row" }, [
        buildColorField(settings.background, (value) =>
          updateCustom({ background: value })
        ),
      ])
    );
  }

  card.appendChild(
    buildRow(
      "Bars",
      "The tab bar and the now-playing bar.",
      buildColorField(settings.bar, (value) => updateCustom({ bar: value }))
    )
  );

  card.appendChild(
    buildRow(
      "Accent",
      "Play button, the playing track and active tabs.",
      buildColorField(settings.accent, (value) => updateCustom({ accent: value }))
    )
  );

  presetRowEl = buildPresetRow(container);
  card.appendChild(presetRowEl);
  return card;
}

function buildPresetRow(container) {
  const row = el("div", { class: "preset-row" });

  for (const preset of PRESETS) {
    // Resolve through the same path the engine uses, so "System" previews
    // whatever it would actually apply right now.
    const resolved = settingsFromPreset(preset.id);
    const tokens = resolveTokens({ ...defaultSettings(), ...resolved });
    const previewBg = resolved.backgroundMode === "gradient" ? resolved.backgroundTop : resolved.background;

    const chip = el(
      "button",
      {
        class: `preset-chip${settings.preset === preset.id ? " preset-chip-active" : ""}`,
        type: "button",
        onclick: () => update(settingsFromPreset(preset.id), { redraw: true, container }),
      },
      [
        el("span", {
          class: "preset-chip-swatch",
          style: {
            backgroundImage: `linear-gradient(135deg, ${previewBg} 0 50%, ${tokens["--color-accent"]} 50% 100%)`,
          },
        }),
        el("span", { class: "preset-chip-label", text: preset.name }),
      ]
    );
    row.appendChild(chip);
  }

  return row;
}

// --- look and feel card -----------------------------------------------------

function buildLookCard(container) {
  const card = buildCard("Look and feel");

  card.appendChild(
    buildRow(
      "Buttons",
      "Glass frosts the bars and blurs what is behind them.",
      buildSegmented(
        [
          { value: "glass", label: "Glass" },
          { value: "solid", label: "Solid" },
        ],
        settings.buttons,
        (value) => update({ buttons: value }, { redraw: true, container })
      )
    )
  );

  card.appendChild(
    buildRow(
      "Font",
      "Only fonts already on this device — nothing is downloaded. Type to search, or name one you installed yourself.",
      buildFontPicker()
    )
  );

  card.appendChild(
    buildRow(
      "Text size",
      "Scales the whole app, not just this screen.",
      buildSegmented(
        TEXT_SIZES.map((size) => ({ value: size.id, label: size.name })),
        settings.textSize,
        (value) => update({ textSize: value }, { redraw: true, container })
      )
    )
  );

  return card;
}

function buildFontPicker() {
  const listId = "font-options";
  const datalist = el("datalist", { id: listId });
  for (const font of FONT_OPTIONS) {
    if (!font.value) continue;
    datalist.appendChild(el("option", { value: font.value }));
  }

  const input = el("input", {
    class: "font-input",
    type: "text",
    list: listId,
    value: settings.font,
    placeholder: "System default",
    spellcheck: "false",
    autocapitalize: "words",
    autocomplete: "off",
  });

  input.addEventListener("input", () => update({ font: input.value.trim() }));

  return el("div", { class: "font-field" }, [input, datalist]);
}

// --- playback + account -----------------------------------------------------

function buildPlaybackCard() {
  const card = buildCard("Playback");
  card.appendChild(
    el("p", {
      class: "settings-card-blurb",
      text: "Audio plays through the Spotify app on one of your devices. It needs to be open there for this to control it.",
    })
  );
  card.appendChild(
    el("button", { class: "btn-secondary settings-device-button", type: "button", onclick: openDeviceSheet }, [
      icon("speaker", { size: 16 }),
      el("span", { text: "Choose playback device" }),
    ])
  );
  return card;
}

async function loadAccount(card) {
  try {
    const profile = await apiFetch("/me");
    const isPremium = profile.product === "premium";
    clear(card);
    card.appendChild(
      el("div", { class: "settings-card-header" }, [el("h2", { class: "settings-card-title", text: "Account" })])
    );
    card.appendChild(
      el("div", { class: "account-card" }, [
        el("p", { class: "account-name", text: profile.display_name || profile.id }),
        el("p", {
          class: isPremium ? "premium-yes" : "premium-no",
          text: isPremium ? "Spotify Premium" : "Not Premium — playback control will not work.",
        }),
      ])
    );
  } catch (err) {
    const body = el("div");
    renderError(body, err, null);
    clear(card);
    card.appendChild(
      el("div", { class: "settings-card-header" }, [el("h2", { class: "settings-card-title", text: "Account" })])
    );
    card.appendChild(body);
  }
}
