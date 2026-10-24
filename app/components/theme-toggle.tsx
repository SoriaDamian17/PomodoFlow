"use client";

import { useEffect } from "react";
import { IconButton } from "@/app/components/icon-button";
import { MoonIcon, SunIcon } from "@/app/components/icons";

const THEME_STORAGE_KEY = "pomodoroflow:theme";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

/**
 * Theme toggle for the sun control in the draft header.
 *
 * The icon is switched purely with CSS from `data-theme`, so there is no state
 * to hydrate and no flash of the wrong icon. The inline script in
 * app/layout.tsx sets the initial attribute before first paint (F024).
 */
export function ThemeToggle() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const handleChange = () => {
      // Follow the OS only while the user has not made an explicit choice.
      try {
        if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {
        return;
      }

      applyTheme(media.matches ? "light" : "dark");
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  function toggle() {
    const current: Theme =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next: Theme = current === "light" ? "dark" : "light";

    applyTheme(next);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the chosen theme still applies for this session.
    }
  }

  return (
    <IconButton label="Toggle color theme" onClick={toggle}>
      <SunIcon className="theme-icon-sun size-[18px]" />
      <MoonIcon className="theme-icon-moon size-[18px]" />
    </IconButton>
  );
}
