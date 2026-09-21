// ---------------------------------------------------------------------------
// "/settings" route: theme picker (the whole point of this project) plus
// account info and logout.
// ---------------------------------------------------------------------------

import { apiFetch } from "../api.js";
import { el, clear } from "../dom.js";
import { THEMES, applyTheme, getCurrentTheme } from "../theme.js";
import { logout } from "../auth.js";
import { renderError } from "../components/async-states.js";
import { open as openDeviceSheet } from "../components/device-sheet.js";
import { icon } from "../icons.js";
import { BUILD_VERSION } from "../version.js";

export function render(container) {
  load(container);
}

async function load(container) {
  clear(container);

  const page = el("div", { class: "page page-settings" });
  page.appendChild(el("h1", { class: "detail-header-title detail-header-title-plain", text: "Settings" }));

  page.appendChild(el("h2", { class: "section-heading", text: "Theme" }));
  page.appendChild(buildThemePicker());

  page.appendChild(el("h2", { class: "section-heading", text: "Playback" }));
  page.appendChild(
    el("button", { class: "btn-secondary settings-device-button", type: "button", onclick: openDeviceSheet }, [
      icon("speaker", { size: 16 }),
      el("span", { text: "Choose playback device" }),
    ])
  );

  const accountSection = el("div", { class: "settings-account" }, [
    el("h2", { class: "section-heading", text: "Account" }),
    el("p", { class: "state-message", text: "Loading…" }),
  ]);
  page.appendChild(accountSection);

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

  try {
    const profile = await apiFetch("/me");
    renderAccountInfo(accountSection, profile);
  } catch (err) {
    renderError(accountSection, err, null);
  }
}

function buildThemePicker() {
  const current = getCurrentTheme();
  const row = el("div", { class: "theme-picker" });

  for (const theme of THEMES) {
    const swatch = el(
      "button",
      {
        class: `theme-swatch theme-swatch-${theme.id}${theme.id === current ? " theme-swatch-selected" : ""}`,
        type: "button",
        onclick: () => {
          applyTheme(theme.id);
          row.querySelectorAll(".theme-swatch").forEach((n) => n.classList.remove("theme-swatch-selected"));
          swatch.classList.add("theme-swatch-selected");
        },
      },
      [el("span", { class: "theme-swatch-preview" }), el("span", { class: "theme-swatch-label", text: theme.name })]
    );
    row.appendChild(swatch);
  }

  return row;
}

function renderAccountInfo(container, profile) {
  clear(container);
  const isPremium = profile.product === "premium";
  container.appendChild(el("h2", { class: "section-heading", text: "Account" }));
  container.appendChild(
    el("div", { class: "account-card" }, [
      el("p", { class: "account-name", text: profile.display_name || profile.id }),
      el("p", {
        class: isPremium ? "premium-yes" : "premium-no",
        text: isPremium ? "Spotify Premium" : "Not Premium — playback control will not work.",
      }),
    ])
  );
}
