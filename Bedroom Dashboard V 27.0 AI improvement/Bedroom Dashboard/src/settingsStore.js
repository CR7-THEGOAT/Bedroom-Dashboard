import { useCallback, useState } from 'react';

export const BEDROOM_DASHBOARD_SETTINGS_KEY = 'bedroom-dashboard.settings.v2';
export const BEDROOM_DASHBOARD_SETTINGS_VERSION = 2;
const PRAYER_DUBAI_MIGRATION_KEY = 'Bedroom Dashboard.prayer-dubai-method-migration.v1';

const DEFAULTS = {
  version: BEDROOM_DASHBOARD_SETTINGS_VERSION,
  appearance: {
    look: 'glossy',
    theme: 'auto',
    dashboardTheme: 'black',
    cardTransparency: 88,
    blurStrength: 12,
    shadowStrength: 40,
    widgetRadius: 8,
    widgetSpacing: 12,
    fontScale: 100,
    iconScale: 100,
    animationSpeed: 'normal',
    scrollbarStyle: 'glass'
  },
  dashboard: {
    density: 'comfortable',
    scale: 100,
    editMode: false,
    snapToGrid: true,
    quickAccessVisible: true,
    quickAccessCollapsed: true,
    goalsStyle: 'compact',
    menuStyle: 'vertical'
  },
  widgets: { showBuiltIns: true, movementPanel: true },
  prayer: {
    locationMode: 'manual',
    locationName: 'Ajman, UAE',
    country: 'UAE',
    latitude: 25.4052,
    longitude: 55.5136,
    timezone: 'Asia/Dubai',
    calculationMethod: '16',
    asrMethod: '0',
    offsets: { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 }
  },
  weather: {
    locationMode: 'manual',
    locationName: 'Ajman, UAE',
    country: 'UAE',
    latitude: 25.4052,
    longitude: 55.5136,
    timezone: 'Asia/Dubai',
    unit: 'celsius',
    provider: 'open-meteo'
  },
  gestures: {
    enabled: true,
    touchpadEnabled: true,
    touchEnabled: true,
    swipeSensitivity: 96,
    pinchZoom: false,
    longPressEdit: true
  },
  ai: {
    look: 'glass-compact',
    animation: 'ripple',
    position: 'top-right',
    size: 'normal',
    glow: 55,
    showSubtitles: true,
    idleBehavior: 'hidden',
    onlineMode: 'auto',
    microphoneSensitivity: 55,
    recognitionLanguage: 'en-US'
  },
  music: {
    autoplay: false,
    backgroundMode: false,
    visualizer: true,
    widgetStyle: 'full'
  },
  quickAccess: { items: [] },
  dailyGoals: { style: 'compact' },
  mostUsedApps: { items: [], compact: false },
  browser: {
    fullscreen: true,
    kioskLock: false,
    customTopBar: false,
    homeUrl: 'http://localhost:5173',
    openExternalInside: false,
    autoLaunch: false
  },
  system: { offlineCache: true }
};

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(defaults, value) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? value : clone(defaults);
  if (!isRecord(defaults)) return value === undefined || value === null ? defaults : value;
  const source = isRecord(value) ? value : {};
  return Object.keys(defaults).reduce((next, key) => {
    next[key] = merge(defaults[key], source[key]);
    return next;
  }, {});
}

function legacyLocation() {
  try {
    const value = JSON.parse(localStorage.getItem('nexora.location-settings.v1') || 'null');
    if (!isRecord(value)) return null;
    return {
      locationName: String(value.weatherName || 'Ajman, UAE'),
      latitude: Number(value.weatherLat),
      longitude: Number(value.weatherLon),
      timezone: String(value.weatherTimezone || 'Asia/Dubai')
    };
  } catch {
    return null;
  }
}

function migrateLegacy() {
  const location = legacyLocation();
  const next = clone(DEFAULTS);
  if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
    next.weather = { ...next.weather, ...location };
    next.prayer = { ...next.prayer, ...location };
  }
  try {
    const dashboardTheme = localStorage.getItem('nexora.dashboard-theme.v1');
    if (['black', 'white', 'red'].includes(dashboardTheme)) next.appearance.dashboardTheme = dashboardTheme;
    const look = localStorage.getItem('nexora.look-style.v1');
    if (typeof look === 'string' && look) next.appearance.look = look;
  } catch {
    // LocalStorage may be disabled; defaults still work.
  }
  return next;
}

export function loadBedroom DashboardSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(BEDROOM_DASHBOARD_SETTINGS_KEY) || 'null');
    if (isRecord(stored)) {
      const next = merge(DEFAULTS, stored);
      const locationText = `${next.prayer?.locationName || ''} ${next.prayer?.country || ''}`.toLowerCase();
      const looksUae = locationText.includes('uae') || locationText.includes('ajman') || locationText.includes('dubai');
      const shouldMigratePrayerMethod = looksUae
        && String(next.prayer?.calculationMethod) === '8'
        && localStorage.getItem(PRAYER_DUBAI_MIGRATION_KEY) !== 'true';
      if (shouldMigratePrayerMethod) {
        next.prayer = { ...next.prayer, calculationMethod: '16' };
        localStorage.setItem(PRAYER_DUBAI_MIGRATION_KEY, 'true');
        return saveBedroom DashboardSettings(next);
      }
      return next;
    }
  } catch {
    // Ignore corrupt saved settings and preserve a functional kiosk.
  }
  const migrated = migrateLegacy();
  saveBedroom DashboardSettings(migrated);
  return migrated;
}

export function saveBedroom DashboardSettings(value) {
  const next = merge(DEFAULTS, value);
  try {
    localStorage.setItem(BEDROOM_DASHBOARD_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // The UI remains usable when persistent storage is unavailable.
  }
  return next;
}

export function resetBedroom DashboardSettingsSection(settings, section) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, section)) return settings;
  return saveBedroom DashboardSettings({ ...settings, [section]: clone(DEFAULTS[section]) });
}

export function exportBedroom DashboardSettings(settings) {
  return JSON.stringify(saveBedroom DashboardSettings(settings), null, 2);
}

export function importBedroom DashboardSettings(serialized) {
  const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
  if (!isRecord(parsed)) throw new Error('Settings file is not valid.');
  return saveBedroom DashboardSettings(parsed);
}

export function useBedroom DashboardSettings() {
  const [settings, setSettingsState] = useState(loadBedroom DashboardSettings);

  const updateSettings = useCallback((patch) => {
    setSettingsState((current) => {
      const nextValue = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
      return saveBedroom DashboardSettings(nextValue);
    });
  }, []);

  const updateSection = useCallback((section, patch) => {
    updateSettings((current) => ({
      ...current,
      [section]: {
        ...(current[section] || {}),
        ...(typeof patch === 'function' ? patch(current[section] || {}) : patch)
      }
    }));
  }, [updateSettings]);

  const resetSection = useCallback((section) => {
    setSettingsState((current) => resetBedroom DashboardSettingsSection(current, section));
  }, []);

  return { settings, updateSettings, updateSection, resetSection };
}

export const BEDROOM_DASHBOARD_DEFAULT_SETTINGS = DEFAULTS;
