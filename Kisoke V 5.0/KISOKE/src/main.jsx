import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import SunCalc from 'suncalc';
import {
  AlarmClock,
  BatteryCharging,
  Bell,
  Bluetooth,
  BookOpen,
  Camera,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  CloudMoon,
  CloudRain,
  CloudSun,
  Cloudy,
  Coffee,
  Cpu,
  Droplets,
  ExternalLink,
  Eye,
  Fuel,
  Gauge,
  GripVertical,
  HardDrive,
  Laptop,
  Lock,
  Mic,
  MicOff,
  Minus,
  Moon,
  Music2,
  Network,
  Newspaper,
  Pause,
  Plane,
  Play,
  Plus,
  Power,
  Radar as RadarIcon,
  RefreshCw,
  Send,
  Shield,
  Shuffle,
  SkipForward,
  Sparkles,
  Settings,
  Sun,
  Target,
  Thermometer,
  Trash2,
  Undo2,
  Unlock,
  Volume2,
  Wind,
  Trophy,
  Wifi,
  X
} from 'lucide-react';
import './styles.css';

const AJMAN = { lat: 25.4052, lon: 55.5136 };
const STORAGE_KEY = 'nexora.todos.v1';
const ALARM_KEY = 'nexora.alarm.v1';
const WORLD_CLOCK_KEY = 'nexora.world-clocks.v1';
const TIME_FORMAT_KEY = 'nexora.time-format.v1';
const CUSTOM_WIDGETS_KEY = 'nexora.custom-widgets.v1';
const DELETED_WIDGETS_KEY = 'nexora.deleted-widgets.v1';
const CUSTOM_SECTIONS_KEY = 'nexora.custom-sections.v1';
const DASHBOARD_LAYOUT_KEY = 'nexora.dashboard-layout.v6';
const NEWS_VIEW_HISTORY_KEY = 'nexora.news-views.v1';
const HYDRATION_KEY = 'nexora.hydration.v1';
const HABITS_KEY = 'nexora.habits.v1';
const QUICK_LINKS_KEY = 'nexora.quick-links.v1';
const AGENDA_KEY = 'nexora.agenda.v1';
const DAILY_GOALS_KEY = 'nexora.daily-goals.v1';
const EXAM_COUNTDOWNS_KEY = 'nexora.exam-countdowns.v1';
const ROOM_MODE_KEY = 'nexora.room-mode.v1';
const CAFFEINE_KEY = 'nexora.caffeine.v1';
const BRAIN_DUMP_KEY = 'nexora.brain-dump.v1';
const FOCUS_LOG_KEY = 'nexora.focus-log.v1';
const SLEEP_MODE_KEY = 'nexora.sleep-mode.v1';
const TIME_DECK_SETTINGS_KEY = 'nexora.time-deck-settings.v1';
const TIME_DECK_ALARMS_KEY = 'nexora.time-deck-alarms.v1';
const ALARM_SOUND_KEY = 'nexora.alarm-sound.v1';
const ASSISTANT_SETTINGS_KEY = 'nexora.assistant-settings.v1';
const ASSISTANT_MODEL_MIGRATION_KEY = 'nexora.assistant-model-migration.four-local-models.v1';
const LOCATION_SETTINGS_KEY = 'nexora.location-settings.v1';
const LOOK_STYLE_KEY = 'nexora.look-style.v1';
const VOICE_ARMED_KEY = 'nexora.voice-armed.v1';
const DASHBOARD_THEME_KEY = 'nexora.dashboard-theme.v1';
const PRESENCE_SETTINGS_KEY = 'nexora.presence-mode.v1';
const COMMAND_HISTORY_KEY = 'nexora.voice-command-history.v1';
const REMOTE_CAMERA_SETTINGS_KEY = 'nexora.remote-camera-settings.v1';
const SECURITY_LOG_KEY = 'nexora.remote-camera-security-log.v1';
const LANGUAGE_SETTINGS_KEY = 'nexora.language-settings.v1';
const PERFORMANCE_MODE_KEY = 'nexora.performance-mode.v1';

function isTypingTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
}

function resolveDeviceApiBase() {
  const configured = import.meta.env?.VITE_BACKEND_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
      if (!localHosts.has(url.hostname)) return configured.replace(/\/$/, '');
    } catch {
      return configured.replace(/\/$/, '');
    }
  }
  return '';
}

const DEVICE_API_BASE = resolveDeviceApiBase();
let backendAutostartPromise = null;
let backendAutostartLastAt = 0;

async function requestBackendAutostart(reason = 'camera', force = false) {
  const now = Date.now();
  if (backendAutostartPromise) return backendAutostartPromise;
  if (!force && now - backendAutostartLastAt < 15000) {
    return { ok: false, skipped: true, message: 'Backend autostart was just requested.' };
  }

  backendAutostartLastAt = now;
  backendAutostartPromise = fetch(`/api/backend/autostart?reason=${encodeURIComponent(reason)}${force ? '&force=1' : ''}`, {
    method: 'POST',
    cache: 'no-store'
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok && data?.ok !== false,
        ...data
      };
    })
    .catch((error) => ({
      ok: false,
      error: error?.message || 'Backend autostart helper is not available.'
    }))
    .finally(() => {
      window.setTimeout(() => {
        backendAutostartPromise = null;
      }, 1000);
    });

  return backendAutostartPromise;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cameraPageClientId() {
  try {
    const key = 'nexora.camera-page-client-id.v1';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function sendCameraPageHeartbeat(page, active = true) {
  const payload = JSON.stringify({
    client_id: cameraPageClientId(),
    page,
    active
  });
  const url = `${DEVICE_API_BASE}/api/local-camera/page-heartbeat`;

  if (!active && navigator.sendBeacon) {
    try {
      const sent = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      if (sent) return Promise.resolve({ ok: true, beacon: true });
    } catch {
      // Fall through to keepalive fetch.
    }
  }

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    cache: 'no-store',
    keepalive: !active
  }).then((response) => readJsonResponse(response, 'Camera heartbeat failed'));
}

async function readJsonResponse(response, fallbackMessage = 'Request failed') {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${fallbackMessage}: empty response from server`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${fallbackMessage}: invalid server response`);
  }
}

function isBackendEmptyOrOfflineError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('empty response from server')
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed')
    || message.includes('backend is not running')
  );
}

async function fetchJsonWithBackendRecovery(url, options = {}, fallbackMessage = 'Request failed', reason = 'CameraRecovery') {
  try {
    const response = await fetch(url, { cache: 'no-store', ...options });
    return await readJsonResponse(response, fallbackMessage);
  } catch (error) {
    if (!isBackendEmptyOrOfflineError(error)) throw error;
    const startResult = await requestBackendAutostart(reason, true);
    await wait(startResult.started ? 2600 : 1300);
    const retry = await fetch(url, { cache: 'no-store', ...options });
    return await readJsonResponse(retry, `${fallbackMessage} retry failed`);
  }
}

function useCameraPageHeartbeat(enabled, page) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!enabled) {
      sendCameraPageHeartbeat(page, false).catch(() => {});
      setStatus(null);
      return undefined;
    }

    let disposed = false;
    const ping = async (active = true) => {
      try {
        const data = await sendCameraPageHeartbeat(page, active);
        if (!disposed && active) setStatus(data);
      } catch {
        if (active) {
          await requestBackendAutostart(`${page}Heartbeat`);
        }
      }
    };

    ping(true);
    const timer = window.setInterval(() => ping(true), 4000);
    const deactivate = () => {
      disposed = true;
      window.clearInterval(timer);
      sendCameraPageHeartbeat(page, false).catch(() => {});
    };

    window.addEventListener('pagehide', deactivate);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', deactivate);
      sendCameraPageHeartbeat(page, false).catch(() => {});
    };
  }, [enabled, page]);

  return status;
}

function returnRemoteCameraToSensorMode() {
  const body = JSON.stringify({ camera_mode: 'sensor' });
  const url = `${DEVICE_API_BASE}/api/remote-camera/settings`;
  try {
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      if (sent) return;
    }
  } catch {
    // Fall through to keepalive fetch.
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {});
}

const AI_MODEL_TIERS = [
  { id: 'auto', label: 'Auto', detail: 'Fast for short commands, hard for bigger questions', model: '' },
  { id: '2.5', label: 'Gemma 2 2B', detail: 'Fast creative writing and quick chatting', model: 'gemma2:2b' },
  { id: '3.5', label: 'Phi-3.5 mini', detail: 'Reasoning, math, and logic tasks', model: 'phi3.5' },
  { id: '4.5', label: 'Llama 3.2 3B', detail: 'General conversation, writing, and summaries', model: 'llama3.2' },
  { id: 'qwen', label: 'Qwen 2.5 3B', detail: 'Coding help and multilingual tasks', model: 'qwen2.5:3b' }
];
const WIDGET_UNDO_WINDOW_MS = 25 * 60 * 1000;
const IDLE_TIMEOUT_MS = 4 * 60 * 1000;
const SWIPE_DISTANCE = 96;
const SWIPE_VERTICAL_TOLERANCE = 1.35;
const DEFAULT_ASSISTANT_SETTINGS = {
  assistantName: 'Nexora',
  introName: 'Sa3doon',
  callNames: 'Saeed, Sa3doon',
  startupCallName: 'Sa3doon',
  modelTier: 'auto',
  model25: 'gemma2:2b',
  model35: 'phi3.5',
  model45: 'llama3.2',
  qwenModel: 'qwen2.5:3b',
  easyModel: 'gemma2:2b',
  hardModel: 'qwen2.5:3b',
  voiceAssistant: true,
  alwaysListen: true,
  voiceReplies: true,
  alwaysShowOrb: true,
  showOrbTranscript: true,
  voiceDebug: false,
  voiceMode: 'wake',
  randomizeCallName: true,
  startupGreetingMode: 'intro',
  customStartupText: '',
  customStartupAudio: ''
};
const TIME_DECK_SECTIONS = [
  { id: 'alarm', label: 'Alarm' },
  { id: 'countdown', label: 'Countdown' },
  { id: 'stopwatch', label: 'Stopwatch' },
  { id: 'world', label: 'World Clock' },
  { id: 'prayer', label: 'Prayer Focus' }
];
const DEFAULT_TIME_DECK_SETTINGS = {
  enabled: true,
  defaultSection: 'alarm',
  scrollSensitivity: 'normal',
  scrollSnap: true,
  touchSwipe: true,
  keyboardNavigation: true,
  showDots: true,
  showNextHint: true,
  clockTimezoneMode: 'Dubai',
  customClockTimezone: 'Asia/Dubai',
  clockStyle: 'glossy',
  moonMode: 'auto',
  manualMoonPhase: 'Full moon',
  sunMode: 'auto',
  manualSunState: 'Morning'
};
const DEFAULT_LOCATION_SETTINGS = {
  weatherName: 'Ajman',
  weatherLat: 25.4052,
  weatherLon: 55.5136,
  weatherTimezone: 'Asia/Dubai',
  clockCity: 'Dubai',
  clockTimezone: 'Asia/Dubai'
};
const DEFAULT_CAMERA_CONTROLS = {
  brightness: 50,
  contrast: 50,
  saturation: 50,
  sharpness: 50,
  gain: 0,
  autoExposure: true,
  exposure: -6,
  autoWhiteBalance: true,
  whiteBalance: 4500
};
const DEFAULT_REMOTE_CAMERA_SETTINGS = {
  mode: 'both',
  cameraMode: 'sensor',
  cameraEnabled: true,
  privacyMode: false,
  highSecurity: false,
  securitySnapshots: false,
  cameraDevice: 1,
  cameraLookMode: 'normal',
  streamProfile: 'reference720',
  streamFps: 24,
  streamQuality: 82,
  streamWidth: 1280,
  streamHeight: 720,
  cameraControls: DEFAULT_CAMERA_CONTROLS,
  backgroundAdaptiveBrightness: false,
  failedAttemptThreshold: 5,
  passwordSet: false
};
const CAMERA_STREAM_PROFILES = [
  { id: 'lowest', label: 'Lowest', detail: '5 FPS / tiny data', fps: 5, quality: 28, width: 320, height: 240 },
  { id: 'low', label: 'Low', detail: '8 FPS / light stream', fps: 8, quality: 38, width: 426, height: 240 },
  { id: 'balanced', label: 'Balanced', detail: '12 FPS / stable', fps: 12, quality: 48, width: 480, height: 360 },
  { id: 'fast30', label: 'Fast 30', detail: '30 FPS / fastest live view', fps: 30, quality: 34, width: 426, height: 240 },
  { id: 'smooth30', label: '30 FPS Decent', detail: '30 FPS / decent quality', fps: 30, quality: 58, width: 640, height: 360 },
  { id: 'reference720', label: 'Reference 720', detail: '24 FPS / clear room view', fps: 24, quality: 82, width: 1280, height: 720 },
  { id: 'high', label: 'High', detail: '30 FPS / sharper', fps: 30, quality: 72, width: 854, height: 480 },
  { id: 'highest', label: 'Highest', detail: '60 FPS / heavy', fps: 60, quality: 86, width: 1280, height: 720 },
  { id: 'custom', label: 'Custom', detail: 'Manual FPS and quality', fps: 12, quality: 48, width: 480, height: 360 }
];
const CAMERA_CONTROL_FIELDS = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 100, unit: '%' },
  { key: 'contrast', label: 'Contrast', min: 0, max: 100, unit: '%' },
  { key: 'saturation', label: 'Saturation', min: 0, max: 100, unit: '%' },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100, unit: '%' },
  { key: 'gain', label: 'Gain', min: 0, max: 100, unit: '%' },
  { key: 'exposure', label: 'Exposure', min: -13, max: 0, step: 0.5, unit: '' },
  { key: 'whiteBalance', label: 'White balance', min: 2800, max: 7000, step: 100, unit: 'K' }
];
const CAMERA_LOOK_MODES = [
  {
    id: 'night-vision',
    label: 'Night Vision',
    detail: 'Digital low-light boost',
    Icon: Moon,
    patch: { brightness: 86, contrast: 64, saturation: 24, sharpness: 60, gain: 36, autoExposure: false, exposure: -2.5, autoWhiteBalance: false, whiteBalance: 5200 }
  },
  {
    id: 'dark-room',
    label: 'Dark Room',
    detail: 'Low light without blown highlights',
    Icon: CloudMoon,
    patch: { brightness: 88, contrast: 52, saturation: 48, sharpness: 54, gain: 34, autoExposure: false, exposure: -2, autoWhiteBalance: false, whiteBalance: 4900 }
  },
  {
    id: 'normal',
    label: 'Normal Mode',
    detail: 'Balanced daylight or room light',
    Icon: Camera,
    patch: { brightness: 50, contrast: 54, saturation: 62, sharpness: 54, gain: 0, autoExposure: false, exposure: -7, autoWhiteBalance: true, whiteBalance: 4500 }
  },
  {
    id: 'bright-room',
    label: 'Bright Room Mode',
    detail: 'Cuts glare and washed highlights',
    Icon: Sun,
    patch: { brightness: 48, contrast: 58, saturation: 48, sharpness: 54, gain: 4, autoExposure: false, exposure: -5, autoWhiteBalance: true, whiteBalance: 4500 }
  },
  {
    id: 'manual',
    label: 'Manual Mode',
    detail: 'Use the sliders below',
    Icon: Gauge,
    patch: null
  }
];
const CAMERA_CONTROL_PRESETS = CAMERA_LOOK_MODES.filter((mode) => mode.patch);
const CAMERA_LOOK_MODE_IDS = CAMERA_LOOK_MODES.map((mode) => mode.id);
const CAMERA_CONTROL_BACKEND_KEYS = {
  autoExposure: 'auto_exposure',
  whiteBalance: 'white_balance',
  autoWhiteBalance: 'auto_white_balance'
};
const DEFAULT_LANGUAGE_SETTINGS = {
  language: 'en',
  dateArabic: false,
  prayerArabic: false
};
const UI_TEXT = {
  en: {
    clock: 'Clock',
    dashboard: 'Dashboard',
    tools: 'Tools',
    settings: 'Settings',
    signalCenter: 'Signal Center',
    remoteCamera: 'Remote Camera',
    cameraLocked: 'Camera locked',
    unlockCamera: 'Unlock camera',
    privacyMode: 'Privacy mode'
  },
  ar: {
    clock: 'الساعة',
    dashboard: 'لوحة المعلومات',
    tools: 'الأدوات',
    settings: 'الإعدادات',
    signalCenter: 'مركز الإشارات',
    remoteCamera: 'الكاميرا عن بعد',
    cameraLocked: 'الكاميرا مقفلة',
    unlockCamera: 'فتح الكاميرا',
    privacyMode: 'وضع الخصوصية'
  }
};
const LOCATION_PRESETS = [
  { city: 'Dubai', timezone: 'Asia/Dubai', lat: 25.2048, lon: 55.2708 },
  { city: 'Ajman', timezone: 'Asia/Dubai', lat: 25.4052, lon: 55.5136 },
  { city: 'China', timezone: 'Asia/Shanghai', lat: 31.2304, lon: 121.4737 },
  { city: 'Bosnia', timezone: 'Europe/Sarajevo', lat: 43.8563, lon: 18.4131 },
  { city: 'London', timezone: 'Europe/London', lat: 51.5072, lon: -0.1276 }
];
const ASSISTANT_TIME_ZONES = [
  ...LOCATION_PRESETS.map((preset) => ({ city: preset.city, timezone: preset.timezone, names: [preset.city] })),
  { city: 'UAE', timezone: 'Asia/Dubai', names: ['uae', 'emirates', 'abu dhabi', 'sharjah'] },
  { city: 'Saudi Arabia', timezone: 'Asia/Riyadh', names: ['saudi', 'saudi arabia', 'riyadh'] },
  { city: 'Qatar', timezone: 'Asia/Qatar', names: ['qatar', 'doha'] },
  { city: 'Kuwait', timezone: 'Asia/Kuwait', names: ['kuwait'] },
  { city: 'Oman', timezone: 'Asia/Muscat', names: ['oman', 'muscat'] },
  { city: 'Egypt', timezone: 'Africa/Cairo', names: ['egypt', 'cairo'] },
  { city: 'Turkey', timezone: 'Europe/Istanbul', names: ['turkey', 'istanbul'] },
  { city: 'India', timezone: 'Asia/Kolkata', names: ['india', 'mumbai', 'delhi', 'kolkata'] },
  { city: 'Pakistan', timezone: 'Asia/Karachi', names: ['pakistan', 'karachi', 'islamabad'] },
  { city: 'Japan', timezone: 'Asia/Tokyo', names: ['japan', 'tokyo'] },
  { city: 'Korea', timezone: 'Asia/Seoul', names: ['korea', 'south korea', 'seoul'] },
  { city: 'Paris', timezone: 'Europe/Paris', names: ['paris', 'france'] },
  { city: 'Germany', timezone: 'Europe/Berlin', names: ['germany', 'berlin'] },
  { city: 'New York', timezone: 'America/New_York', names: ['new york', 'nyc', 'america east', 'us east'] },
  { city: 'Los Angeles', timezone: 'America/Los_Angeles', names: ['los angeles', 'la', 'california'] },
  { city: 'Toronto', timezone: 'America/Toronto', names: ['toronto', 'canada'] },
  { city: 'Australia', timezone: 'Australia/Sydney', names: ['australia', 'sydney'] }
];
const LOOK_STYLES = [
  { id: 'natural', label: 'Natural' },
  { id: 'glossy', label: 'Glossy / Glassy' },
  { id: 'hacker', label: 'Hacker' },
  { id: 'normal', label: 'Normal' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'ethereal', label: 'Ethereal' },
  { id: 'pixel', label: 'Pixel Art' },
  { id: 'sketch', label: 'Conceptual Sketch' },
  { id: 'luxury', label: 'Luxury Typography' },
  { id: 'japandi', label: 'Japandi' },
  { id: 'memphis', label: 'Memphis' },
  { id: 'bohemian', label: 'Bohemian' }
];
const TODO_TYPES = [
  { id: 'morning', label: 'Morning' },
  { id: 'night', label: 'Night' },
  { id: 'general', label: 'General' }
];

const WIDGET_TYPES = [
  { id: 'note', label: 'Note' },
  { id: 'number', label: 'Number' },
  { id: 'meter', label: 'Meter' },
  { id: 'link', label: 'Link' }
];

const WIDGET_ACCENTS = ['green', 'amber', 'red', 'blue'];
const ROOM_MODES = [
  { id: 'sleep', label: 'Sleep' },
  { id: 'study', label: 'Study' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'prayer', label: 'Prayer' },
  { id: 'morning-school', label: 'Morning school' },
  { id: 'guest', label: 'Guest' },
  { id: 'focus', label: 'Focus' },
  { id: 'movie', label: 'Movie' },
  { id: 'low-power', label: 'Low power' },
  { id: 'relax', label: 'Relax' },
  { id: 'away', label: 'Away' }
];
const DEFAULT_PRESENCE_SETTINGS = {
  enabled: false,
  manualOverride: false,
  wakeStart: '08:00',
  wakeEnd: '20:00',
  nightBlackoutAt: '21:00',
  idleDimMinutes: 5,
  allowNightBlackout: false,
  allowIdleSleep: false
};
const DASHBOARD_WIDGET_PLACEMENTS = [
  'news', 'prayer', 'assistant', 'market', 'device-controls', 'smart-brief', 'weather', 'daily-goals',
  'reminders', 'room-mode', 'quick-links', 'air', 'hydration', 'habits',
  'sleep-readiness', 'agenda', 'exams', 'system', 'lists', 'music',
  'ambient', 'camera-wake', 'noise', 'focus-actions'
];
const DASHBOARD_PLACEMENT_ALIASES = {
  command: 'smart-brief',
  wellness: 'hydration',
  planning: 'daily-goals',
  sleep: 'music'
};
const LEGACY_DASHBOARD_SECTION_EXPANSIONS = {
  command: ['smart-brief', 'reminders', 'room-mode', 'quick-links'],
  weather: ['weather', 'air'],
  wellness: ['hydration', 'habits', 'sleep-readiness'],
  planning: ['daily-goals', 'agenda', 'exams'],
  sleep: ['music', 'ambient', 'camera-wake', 'noise', 'focus-actions']
};
const DEFAULT_DASHBOARD_ORDER = [
  'news', 'prayer', 'assistant',
  'weather', 'market', 'device-controls',
  'daily-goals', 'smart-brief',
  'air', 'hydration', 'habits',
  'reminders', 'agenda', 'lists',
  'sleep-readiness', 'exams', 'system',
  'music', 'ambient', 'room-mode',
  'quick-links', 'camera-wake', 'noise', 'focus-actions'
];
const BUILT_IN_SECTIONS = [
  { id: 'news', title: 'Daily News', detail: 'Gulf News daily brief' },
  { id: 'assistant', title: 'AI Assistant', detail: 'Voice and text command control' },
  { id: 'prayer', title: 'Prayer', detail: 'Countdown and daily times' },
  { id: 'market', title: 'Market', detail: 'Gold and fuel prices' },
  { id: 'device-controls', title: 'Device Controls', detail: 'Display, sound, Wi-Fi, Bluetooth' },
  { id: 'weather', title: 'Weather', detail: 'Ajman forecast and moon' },
  { id: 'daily-goals', title: 'Daily Goals', detail: 'Three main tasks' },
  { id: 'smart-brief', title: 'Smart Brief', detail: 'Local room command summary' },
  { id: 'air', title: 'Air Quality', detail: 'AQI, humidity, and dust watch' },
  { id: 'hydration', title: 'Hydration', detail: 'Water tracker' },
  { id: 'habits', title: 'Habit Streaks', detail: 'Daily habit tracking' },
  { id: 'reminders', title: 'Smart Reminders', detail: 'Room notifications' },
  { id: 'agenda', title: 'Today Agenda', detail: 'Schedule and reminders' },
  { id: 'lists', title: 'Lists', detail: 'Morning, night, and general tasks' },
  { id: 'sleep-readiness', title: 'Sleep Readiness', detail: 'Night readiness meter' },
  { id: 'exams', title: 'Exam Countdown', detail: 'Countdown board' },
  { id: 'system', title: 'System', detail: 'Linux host telemetry' },
  { id: 'music', title: 'Music', detail: 'Local audio player' },
  { id: 'ambient', title: 'Ambient State', detail: 'Sleep and idle controls' },
  { id: 'room-mode', title: 'Room Mode', detail: 'Focus, sleep, prayer, away' },
  { id: 'quick-links', title: 'Quick Links', detail: 'Local browser shortcuts' },
  { id: 'camera-wake', title: 'Camera Wake', detail: 'Presence wake control' },
  { id: 'noise', title: 'Noise Monitor', detail: 'Room dB monitor' },
  { id: 'focus-actions', title: 'Focus Actions', detail: 'Focus timer and quick actions' }
];
const STARTUP_MOODS = ['space', 'hacker', 'natural', 'calm', 'storm'];

const fuelPrices = [
  { label: 'Super 98', value: '--', unit: 'AED/L', delta: 'load' },
  { label: 'Special 95', value: '--', unit: 'AED/L', delta: 'load' },
  { label: 'E-Plus 91', value: '--', unit: 'AED/L', delta: 'load' },
  { label: 'Diesel', value: '--', unit: 'AED/L', delta: 'load' }
];

const metals = [
  { label: '24K Gold', value: '--', unit: 'AED/g', delta: 'load' },
  { label: '22K Gold', value: '--', unit: 'AED/g', delta: 'load' },
  { label: '21K Gold', value: '--', unit: 'AED/g', delta: 'load' },
  { label: '18K Gold', value: '--', unit: 'AED/g', delta: 'load' }
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    let timer = 0;
    let disposed = false;
    const schedule = () => {
      const delay = Math.max(250, 1000 - (Date.now() % 1000));
      timer = window.setTimeout(() => {
        if (disposed) return;
        setNow(new Date());
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, []);
  return now;
}

function readJsonSetting(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === 'object' ? { ...fallback, ...value } : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeLocationSettings(value) {
  const merged = { ...DEFAULT_LOCATION_SETTINGS, ...(value || {}) };
  return {
    weatherName: String(merged.weatherName || DEFAULT_LOCATION_SETTINGS.weatherName),
    weatherLat: Number.isFinite(Number(merged.weatherLat)) ? Number(merged.weatherLat) : DEFAULT_LOCATION_SETTINGS.weatherLat,
    weatherLon: Number.isFinite(Number(merged.weatherLon)) ? Number(merged.weatherLon) : DEFAULT_LOCATION_SETTINGS.weatherLon,
    weatherTimezone: String(merged.weatherTimezone || DEFAULT_LOCATION_SETTINGS.weatherTimezone),
    clockCity: String(merged.clockCity || DEFAULT_LOCATION_SETTINGS.clockCity),
    clockTimezone: String(merged.clockTimezone || DEFAULT_LOCATION_SETTINGS.clockTimezone)
  };
}

function useWeather(location = DEFAULT_LOCATION_SETTINGS, enabled = true) {
  const safeLocation = sanitizeLocationSettings(location);
  const [weather, setWeather] = useState({
    source: 'Open-Meteo',
    temp: 34,
    feels: 41,
    humidity: 58,
    wind: 13,
    windDirection: 0,
    cloud: 0,
    rain: 0,
    precipitation: 0,
    uv: 7,
    sunrise: null,
    sunset: null,
    hourly: [],
    code: 0,
    loaded: false,
    locationName: safeLocation.weatherName,
    lastUpdated: null
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let ignore = false;
    async function load() {
      try {
        const params = new URLSearchParams({
          latitude: String(safeLocation.weatherLat),
          longitude: String(safeLocation.weatherLon),
          current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation',
          hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,visibility,cloud_cover,precipitation_probability',
          daily: 'uv_index_max,sunrise,sunset',
          timezone: safeLocation.weatherTimezone,
          forecast_days: '3'
        });
        const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
        const response = await fetch(url);
        const data = await readJsonResponse(response, 'USB camera sensor failed');
        if (ignore) return;
        const now = new Date();
        const hourly = data.hourly.time
          .map((time, index) => ({
            time: new Date(time),
            temp: Math.round(data.hourly.temperature_2m[index]),
            feels: Math.round(data.hourly.apparent_temperature[index]),
            code: data.hourly.weather_code[index],
            humidity: data.hourly.relative_humidity_2m[index],
            wind: Math.round(data.hourly.wind_speed_10m[index]),
            windDirection: data.hourly.wind_direction_10m[index],
            cloud: Math.round(data.hourly.cloud_cover?.[index] ?? 0),
            rain: Math.round(data.hourly.precipitation_probability?.[index] ?? 0),
            visibilityKm: Math.round((data.hourly.visibility[index] / 1000) * 10) / 10
          }))
          .filter((hour) => hour.time >= new Date(now.getTime() - 30 * 60 * 1000))
          .slice(0, 24);
        setWeather({
          source: 'Open-Meteo',
          temp: Math.round(data.current.temperature_2m),
          feels: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m,
          wind: Math.round(data.current.wind_speed_10m),
          windDirection: data.current.wind_direction_10m,
          cloud: Math.round(data.current.cloud_cover ?? hourly[0]?.cloud ?? 0),
          rain: Math.round(Math.max((data.current.precipitation ?? 0) >= 0.2 ? 100 : 0, hourly[0]?.rain ?? 0)),
          precipitation: Math.round(Number(data.current.precipitation ?? 0) * 10) / 10,
          uv: Math.round(data.daily.uv_index_max[0]),
          sunrise: data.daily.sunrise[0],
          sunset: data.daily.sunset[0],
          hourly,
          code: data.current.weather_code,
          loaded: true,
          locationName: safeLocation.weatherName,
          lastUpdated: Date.now()
        });
      } catch {
        if (!ignore) setWeather((current) => ({ ...current, loaded: false, locationName: safeLocation.weatherName }));
      }
    }
    load();
    const timer = setInterval(load, 15 * 60 * 1000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [enabled, safeLocation.weatherLat, safeLocation.weatherLon, safeLocation.weatherTimezone, safeLocation.weatherName]);

  return weather;
}

function useAirQuality(location = DEFAULT_LOCATION_SETTINGS) {
  const safeLocation = sanitizeLocationSettings(location);
  const [air, setAir] = useState({
    loaded: false,
    aqi: null,
    pm10: null,
    pm25: null,
    fetchedAt: null,
    error: ''
  });

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const params = new URLSearchParams({
          latitude: String(safeLocation.weatherLat),
          longitude: String(safeLocation.weatherLon),
          current: 'pm10,pm2_5,us_aqi',
          timezone: safeLocation.weatherTimezone
        });
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();
        if (ignore) return;
        setAir({
          loaded: true,
          aqi: Math.round(data.current.us_aqi),
          pm10: Math.round(data.current.pm10),
          pm25: Math.round(data.current.pm2_5),
          fetchedAt: Date.now(),
          error: ''
        });
      } catch (error) {
        if (!ignore) setAir((current) => ({ ...current, loaded: false, error: error.message }));
      }
    }

    load();
    const timer = setInterval(load, 30 * 60 * 1000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [safeLocation.weatherLat, safeLocation.weatherLon, safeLocation.weatherTimezone]);

  return air;
}

function useGoldPrices() {
  const [gold, setGold] = useState({
    rates: metals,
    loaded: false,
    cached: false,
    error: '',
    fetchedAt: null
  });

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const response = await fetch('/api/gold');
        const data = await response.json();
        if (ignore) return;

        if (!response.ok || !data.rates?.length) {
          throw new Error(data.error || 'Gold feed failed');
        }

        setGold({
          rates: data.rates,
          loaded: true,
          cached: data.cached,
          error: data.error || '',
          fetchedAt: data.fetchedAt
        });
      } catch (error) {
        if (!ignore) {
          setGold((current) => ({
            ...current,
            loaded: false,
            error: error.message
          }));
        }
      }
    }

    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  return gold;
}

function useFuelPrices() {
  const [fuel, setFuel] = useState({
    rates: fuelPrices,
    loaded: false,
    cached: false,
    error: '',
    fetchedAt: null
  });

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const response = await fetch('/api/fuel');
        const data = await response.json();
        if (ignore) return;

        if (!response.ok || !data.rates?.length) {
          throw new Error(data.error || 'Fuel feed failed');
        }

        setFuel({
          rates: data.rates,
          loaded: true,
          cached: data.cached,
          error: data.error || '',
          fetchedAt: data.fetchedAt
        });
      } catch (error) {
        if (!ignore) {
          setFuel((current) => ({
            ...current,
            loaded: false,
            error: error.message
          }));
        }
      }
    }

    load();
    const timer = setInterval(load, 60 * 60 * 1000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  return fuel;
}

function useNewsFeed() {
  const [news, setNews] = useState({
    items: [],
    history: [],
    loaded: false,
    cached: false,
    error: '',
    fetchedAt: null,
    source: 'https://gulfnews.com/'
  });
  const [viewHistory, setViewHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(NEWS_VIEW_HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/news');
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.items)) {
        throw new Error(data.error || 'News feed failed');
      }
      setNews({
        items: data.items,
        history: Array.isArray(data.history) ? data.history : [],
        loaded: data.items.length > 0,
        cached: Boolean(data.cached),
        error: data.error || '',
        fetchedAt: data.fetchedAt,
        source: data.source || 'https://gulfnews.com/'
      });
    } catch (error) {
      setNews((current) => ({
        ...current,
        loaded: current.items.length > 0,
        error: error.message
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60 * 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(NEWS_VIEW_HISTORY_KEY, JSON.stringify(viewHistory.slice(0, 40)));
  }, [viewHistory]);

  function recordView(story) {
    setViewHistory((current) => [
      {
        id: `${story.id}-${Date.now()}`,
        title: story.title,
        url: story.url,
        category: story.category,
        viewedAt: Date.now()
      },
      ...current.filter((item) => item.url !== story.url)
    ].slice(0, 40));
  }

  return { ...news, viewHistory, refresh, recordView };
}

function useSystemInfo() {
  const [system, setSystem] = useState({
    loaded: false,
    platform: 'Linux host',
    cpuModel: 'CPU',
    cpuCores: 0,
    cpuPercent: 0,
    tempC: null,
    ram: { usedGb: 0, totalGb: 0, percent: 0 },
    disk: { usedGb: 0, totalGb: 0, percent: 0 },
    uptimeSeconds: 0,
    pingMs: null
  });

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const response = await fetch('/api/system');
        const data = await response.json();
        if (!ignore && response.ok) setSystem({ ...data, loaded: true });
      } catch {
        if (!ignore) setSystem((current) => ({ ...current, loaded: false }));
      }
    }

    load();
    const timer = setInterval(load, 5000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  return system;
}

function useMusicLibrary(enabled = true) {
  const [library, setLibrary] = useState({
    tracks: [],
    loaded: false,
    error: '',
    fetchedAt: null
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let ignore = false;
    async function load() {
      try {
        const response = await fetch('/api/music');
        const data = await response.json();
        if (!ignore && response.ok) {
          setLibrary({
            tracks: Array.isArray(data.tracks) ? data.tracks : [],
            loaded: true,
            error: data.error || '',
            fetchedAt: data.fetchedAt
          });
        }
      } catch (error) {
        if (!ignore) setLibrary((current) => ({ ...current, loaded: false, error: error.message }));
      }
    }

    load();
    const timer = setInterval(load, 15000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return library;
}

function useAlarmSoundLibrary(enabled = true) {
  const [library, setLibrary] = useState({
    tracks: [],
    loaded: false,
    error: '',
    directory: '',
    fetchedAt: null
  });
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let ignore = false;
    async function load() {
      try {
        const response = await fetch(`/api/alarm-sounds?refresh=${Date.now()}`);
        const data = await readJsonResponse(response, 'USB camera sensor failed');
        if (!ignore && response.ok) {
          setLibrary({
            tracks: Array.isArray(data.tracks) ? data.tracks : [],
            loaded: true,
            error: data.error || '',
            directory: data.directory || 'Custome Alarm Sounds',
            fetchedAt: data.fetchedAt
          });
        }
      } catch (error) {
        if (!ignore) setLibrary((current) => ({ ...current, loaded: false, error: error.message }));
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [enabled, refreshToken]);

  return { ...library, refresh };
}

function useVideoIntroLibrary(enabled = true) {
  const [library, setLibrary] = useState({
    videos: [],
    loaded: false,
    error: '',
    directory: '',
    fetchedAt: null
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let ignore = false;
    async function load() {
      try {
        const response = await fetch(`/api/video-intros?refresh=${Date.now()}`);
        const data = await response.json();
        if (!ignore && response.ok) {
          setLibrary({
            videos: Array.isArray(data.videos) ? data.videos : [],
            loaded: true,
            error: data.error || '',
            directory: data.directory || 'Custome Video Intro',
            fetchedAt: data.fetchedAt
          });
        }
      } catch (error) {
        if (!ignore) setLibrary((current) => ({ ...current, loaded: false, error: error.message }));
      }
    }

    load();
    const timer = setInterval(load, 30000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return library;
}

function useNetworkAccess() {
  const [network, setNetwork] = useState({ loaded: false, urls: [], localUrl: '', primaryUrl: '', primaryCameraUrl: '', hostname: '', hint: '', error: '' });

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/network?refresh=${Date.now()}`);
      const data = await response.json();
      setNetwork({
        loaded: true,
        urls: Array.isArray(data.urls) ? data.urls : [],
        localUrl: data.localUrl || '',
        primaryUrl: data.primaryUrl || '',
        primaryCameraUrl: data.primaryCameraUrl || '',
        hostname: data.hostname || '',
        hint: data.hint || '',
        error: data.error || ''
      });
    } catch (error) {
      setNetwork((current) => ({ ...current, loaded: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  return { ...network, refresh: load };
}

function networkAccessLabels(network) {
  const urls = (Array.isArray(network?.urls) ? network.urls : [])
    .filter((item) => item?.address && !String(item.address).startsWith('169.254.'));
  const wifi = urls.find((item) => ['wifi', 'ethernet'].includes(item.kind) || /wi-?fi|wlan|ethernet/i.test(item.name || ''));
  const tailscale = urls.find((item) => item.kind === 'tailscale' || /tailscale/i.test(item.name || ''));
  const primary = wifi || tailscale || { name: 'This device', url: network?.primaryUrl || network?.localUrl || 'Checking...', cameraUrl: network?.primaryCameraUrl || `${network?.localUrl || ''}/localhost-camera` };
  const secondary = primary === wifi && tailscale ? tailscale : null;
  return { primary, secondary };
}

function playBuiltInAlert() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return Promise.reject(new Error('AudioContext not supported'));
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.26, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.15);

    [0, 0.18, 0.36].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(index === 1 ? 880 : 660, context.currentTime + offset);
      oscillator.connect(gain);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.16);
    });

    window.setTimeout(() => context.close().catch(() => {}), 1500);
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

function playKioskAlertSound(soundUrl) {
  stopKioskAlertSound();
  if (soundUrl) {
    const audio = new Audio(soundUrl);
    audio.volume = 1;
    audio.preload = 'auto';
    window.__nexoraAlertAudio = audio;
    return audio.play();
  }
  return playBuiltInAlert();
}

function stopKioskAlertSound() {
  const audio = window.__nexoraAlertAudio;
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // Audio may already be gone.
  }
  window.__nexoraAlertAudio = null;
}

function useMusicPlayer(library) {
  const audioRef = useRef(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(() => Number(localStorage.getItem('nexora.music.volume') || 0.45));

  const tracks = library.tracks || [];
  const currentTrack = tracks[trackIndex] || tracks[0] || null;

  useEffect(() => {
    if (trackIndex >= tracks.length) setTrackIndex(0);
  }, [tracks.length, trackIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = currentTrack.url;
    audio.load();
    if (playing) {
      audio.play().catch(() => setPlaying(false));
    }
  }, [currentTrack?.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing && currentTrack) audio.play().catch(() => setPlaying(false));
    if (!playing) audio.pause();
  }, [playing, currentTrack]);

  function setVolume(nextVolume) {
    const clean = Math.max(0, Math.min(1, Number(nextVolume)));
    setVolumeState(clean);
    localStorage.setItem('nexora.music.volume', String(clean));
  }

  function nextTrack() {
    if (!tracks.length) return;
    setTrackIndex((index) => (index + 1) % tracks.length);
    setPlaying(true);
  }

  function shuffleTrack() {
    if (!tracks.length) return;
    setTrackIndex(Math.floor(Math.random() * tracks.length));
    setPlaying(true);
  }

function togglePlay() {
    if (!tracks.length) return;
    setPlaying((value) => !value);
  }

  function pause() {
    setPlaying(false);
  }

  function selectTrack(index) {
    setTrackIndex(index);
    setPlaying(true);
  }

  return {
    audioRef,
    tracks,
    currentTrack,
    trackIndex,
    playing,
    volume,
    setVolume,
    togglePlay,
    pause,
    nextTrack,
    shuffleTrack,
    selectTrack
  };
}

function useCameraWake(enabled, onWake) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState(enabled ? 'Starting camera wake' : 'Camera wake off');
  const lastWakeRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setStatus('Camera wake off');
      return undefined;
    }

    let cancelled = false;
    const setStableStatus = (nextStatus) => {
      setStatus((current) => (current === nextStatus ? current : nextStatus));
    };

    async function pollSensor() {
      try {
        const response = await fetch(`${DEVICE_API_BASE}/api/local-camera/sensor`, { cache: 'no-store' });
        const data = await response.json();
        if (cancelled) return;
        const camera = data.camera || {};
        const motion = data.motion || {};
        const brightness = data.brightness || {};
        if (!camera.connected) {
          setStableStatus(camera.error || 'Camera sensor waiting');
          return;
        }
        if (motion.motion) {
          const nowMs = Date.now();
          setStableStatus(`Movement detected: ${motion.zone || 'room'}`);
          if (nowMs - lastWakeRef.current > 5000) {
            lastWakeRef.current = nowMs;
            onWake();
          }
          return;
        }
        setStableStatus(`Watching sensor / ${brightness.brightness ?? '--'}% ${brightness.level || 'light'}`);
      } catch {
        if (!cancelled) setStableStatus('Backend camera sensor offline');
      }
    }

    fetch(`${DEVICE_API_BASE}/api/local-camera/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'sensor' })
    }).catch(() => {});
    pollSensor();
    const timer = window.setInterval(pollSensor, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled, onWake]);

  return { videoRef, status };
}

function useIdlePresence(timeoutMs = IDLE_TIMEOUT_MS, enabled = true) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return undefined;
    }
    let timer = null;

    function markAwake() {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), timeoutMs);
    }

    const passive = { passive: true };
    window.addEventListener('pointerdown', markAwake, passive);
    window.addEventListener('touchstart', markAwake, passive);
    window.addEventListener('keydown', markAwake);
    markAwake();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', markAwake);
      window.removeEventListener('touchstart', markAwake);
      window.removeEventListener('keydown', markAwake);
    };
  }, [timeoutMs, enabled]);

  return idle;
}

function useBrainDump() {
  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(BRAIN_DUMP_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState('');

  useEffect(() => {
    localStorage.setItem(BRAIN_DUMP_KEY, JSON.stringify(notes.slice(0, 80)));
  }, [notes]);

  function saveNote(text = draft) {
    const clean = text.trim();
    if (!clean) return;
    setNotes((current) => [{ id: Date.now(), text: clean, createdAt: Date.now() }, ...current].slice(0, 80));
    setDraft('');
    playSoftChime();
  }

  function deleteNote(id) {
    setNotes((current) => current.filter((note) => note.id !== id));
  }

  return { notes, draft, setDraft, saveNote, deleteNote };
}

function getFocusStats(log) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const next = new Date(date);
    next.setDate(date.getDate() + 1);
    const minutes = log
      .filter((item) => item.completedAt >= date.getTime() && item.completedAt < next.getTime())
      .reduce((sum, item) => sum + item.minutes, 0);
    return {
      label: date.toLocaleDateString('en-AE', { weekday: 'short' }).slice(0, 2),
      minutes
    };
  });

  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index].minutes <= 0) break;
    streak += 1;
  }

  return {
    todayMinutes: days[days.length - 1].minutes,
    weekMinutes: days.reduce((sum, day) => sum + day.minutes, 0),
    streak,
    days
  };
}

function useFocusSession(enabled = true) {
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FOCUS_LOG_KEY)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(FOCUS_LOG_KEY, JSON.stringify(log.slice(0, 160)));
  }, [log]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          const minutes = Math.max(1, Math.round(duration / 60));
          setRunning(false);
          setLog((current) => [{ id: Date.now(), minutes, completedAt: Date.now() }, ...current].slice(0, 160));
          playSoftChime();
          return duration;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [duration, running, enabled]);

  function start(minutes = 25) {
    const seconds = Math.max(60, minutes * 60);
    setDuration(seconds);
    setRemaining(seconds);
    setRunning(true);
  }

  function toggle() {
    setRunning((value) => !value);
  }

  function reset() {
    setRunning(false);
    setRemaining(duration);
  }

  const stats = useMemo(() => getFocusStats(log), [log]);

  return { duration, remaining, running, log, stats, start, toggle, reset };
}

function useNoiseMonitor(enabled) {
  const [noise, setNoise] = useState({
    enabled,
    level: 'Off',
    db: 0,
    value: 0,
    status: 'Mic off'
  });

  useEffect(() => {
    if (!enabled) {
      setNoise({ enabled: false, level: 'Off', db: 0, value: 0, status: 'Mic off' });
      return undefined;
    }

    let stream = null;
    let context = null;
    let frame = 0;
    let cancelled = false;
    let lastReport = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);

        function tick(time = performance.now()) {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) {
            const centered = (samples[index] - 128) / 128;
            sum += centered * centered;
          }
          const rms = Math.sqrt(sum / samples.length);
          const value = Math.min(100, Math.round(rms * 420));
          const db = Math.max(30, Math.min(100, Math.round(34 + (value * 0.72))));
          const level = db >= 76 ? 'High' : db >= 56 ? 'Medium' : 'Quiet';
          if (time - lastReport > 300) {
            lastReport = time;
            setNoise({
              enabled: true,
              level,
              db,
              value,
              status: level === 'High' ? 'Room is loud' : level === 'Medium' ? 'Normal room sound' : 'Bedroom quiet'
            });
          }
          frame = window.requestAnimationFrame(tick);
        }

        tick();
      } catch {
        setNoise({ enabled: false, level: 'Permission', db: 0, value: 0, status: 'Microphone permission needed' });
      }
    }

    start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (context) context.close();
    };
  }, [enabled]);

  return noise;
}

function useHydrationTracker() {
  const today = localDateKey();
  const [hydration, setHydration] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HYDRATION_KEY));
      return {
        goal: Number(saved?.goal) || 2500,
        records: saved?.records && typeof saved.records === 'object' ? saved.records : {}
      };
    } catch {
      return { goal: 2500, records: {} };
    }
  });

  useEffect(() => {
    localStorage.setItem(HYDRATION_KEY, JSON.stringify(hydration));
  }, [hydration]);

  const amount = Number(hydration.records[today]) || 0;
  const week = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return {
      key,
      label: weekdayLabel(date).slice(0, 2),
      amount: Number(hydration.records[key]) || 0
    };
  });

  function addWater(ml) {
    setHydration((current) => ({
      ...current,
      records: {
        ...current.records,
        [today]: Math.max(0, Math.min(8000, (Number(current.records[today]) || 0) + ml))
      }
    }));
  }

  function setGoal(goal) {
    setHydration((current) => ({ ...current, goal: Math.max(500, Math.min(6000, Number(goal) || 2500)) }));
  }

  function resetToday() {
    setHydration((current) => ({ ...current, records: { ...current.records, [today]: 0 } }));
  }

  return { amount, goal: hydration.goal, week, addWater, setGoal, resetToday };
}

function defaultHabits() {
  return [
    { id: 1, title: 'Studying', history: {} },
    { id: 2, title: 'Sleep on time', history: {} },
    { id: 3, title: 'Water goal', history: {} },
    { id: 4, title: 'Workout', history: {} },
    { id: 5, title: 'Quran', history: {} },
    { id: 6, title: 'Projects', history: {} }
  ];
}

function habitStreak(habit) {
  let streak = 0;
  for (let offset = 0; offset < 90; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    if (!habit.history?.[localDateKey(date)]) break;
    streak += 1;
  }
  return streak;
}

function useHabitTracker() {
  const today = localDateKey();
  const [habits, setHabits] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HABITS_KEY));
      return Array.isArray(saved) && saved.length ? saved : defaultHabits();
    } catch {
      return defaultHabits();
    }
  });
  const [draft, setDraft] = useState('');

  useEffect(() => {
    localStorage.setItem(HABITS_KEY, JSON.stringify(habits.slice(0, 12)));
  }, [habits]);

  function toggleHabit(id) {
    setHabits((current) => current.map((habit) => habit.id === id ? {
      ...habit,
      history: { ...habit.history, [today]: !habit.history?.[today] }
    } : habit));
  }

  function addHabit(event) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setHabits((current) => [{ id: Date.now(), title: title.slice(0, 32), history: {} }, ...current].slice(0, 12));
    setDraft('');
  }

  function removeHabit(id) {
    setHabits((current) => current.filter((habit) => habit.id !== id));
  }

  const completed = habits.filter((habit) => habit.history?.[today]).length;
  return { habits, completed, draft, setDraft, toggleHabit, addHabit, removeHabit, today };
}

function defaultQuickLinks() {
  return [
    { id: 1, label: 'Gulf News', url: 'https://gulfnews.com/' },
    { id: 2, label: 'Open-Meteo', url: 'https://open-meteo.com/' },
    { id: 3, label: 'YouTube', url: 'https://www.youtube.com/' }
  ];
}

function useQuickLinks() {
  const [links, setLinks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(QUICK_LINKS_KEY));
      return Array.isArray(saved) && saved.length ? saved : defaultQuickLinks();
    } catch {
      return defaultQuickLinks();
    }
  });
  const [draft, setDraft] = useState({ label: '', url: '' });

  useEffect(() => {
    localStorage.setItem(QUICK_LINKS_KEY, JSON.stringify(links.slice(0, 16)));
  }, [links]);

  function addLink(event) {
    event.preventDefault();
    const label = draft.label.trim();
    let url = draft.url.trim();
    if (!label || !url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setLinks((current) => [{ id: Date.now(), label: label.slice(0, 24), url }, ...current].slice(0, 16));
    setDraft({ label: '', url: '' });
  }

  function removeLink(id) {
    setLinks((current) => current.filter((link) => link.id !== id));
  }

  return { links, draft, setDraft, addLink, removeLink };
}

function defaultAgenda() {
  return [
    { id: 1, title: 'Review dashboard', time: '18:30', date: localDateKey() },
    { id: 2, title: 'Sleep wind-down', time: '23:00', date: localDateKey() }
  ];
}

function useAgenda() {
  const today = localDateKey();
  const [entries, setEntries] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(AGENDA_KEY));
      return Array.isArray(saved) && saved.length ? saved : defaultAgenda();
    } catch {
      return defaultAgenda();
    }
  });
  const [draft, setDraft] = useState({ title: '', time: '18:00' });

  useEffect(() => {
    localStorage.setItem(AGENDA_KEY, JSON.stringify(entries.slice(0, 80)));
  }, [entries]);

  const todayEntries = entries
    .filter((entry) => entry.date === today)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));

  function addEntry(event) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    setEntries((current) => [{ id: Date.now(), title: title.slice(0, 46), time: draft.time || '18:00', date: today }, ...current]);
    setDraft({ title: '', time: draft.time || '18:00' });
  }

  function removeEntry(id) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  return { entries: todayEntries, allEntries: entries, draft, setDraft, addEntry, removeEntry };
}

function defaultDailyGoals() {
  return [
    { id: 1, title: 'Study main subject', done: false },
    { id: 2, title: 'Finish one project step', done: false },
    { id: 3, title: 'Prepare for tomorrow', done: false }
  ];
}

function useDailyGoals() {
  const today = localDateKey();
  const [state, setState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DAILY_GOALS_KEY));
      return saved?.date === today && Array.isArray(saved.goals) ? saved : { date: today, goals: defaultDailyGoals() };
    } catch {
      return { date: today, goals: defaultDailyGoals() };
    }
  });

  useEffect(() => {
    if (state.date !== today) setState({ date: today, goals: defaultDailyGoals() });
  }, [state.date, today]);

  useEffect(() => {
    localStorage.setItem(DAILY_GOALS_KEY, JSON.stringify(state));
  }, [state]);

  function toggleGoal(id) {
    setState((current) => ({
      ...current,
      goals: current.goals.map((goal) => goal.id === id ? { ...goal, done: !goal.done } : goal)
    }));
  }

  function updateGoal(id, title) {
    setState((current) => ({
      ...current,
      goals: current.goals.map((goal) => goal.id === id ? { ...goal, title: title.slice(0, 46) } : goal)
    }));
  }

  function resetGoals() {
    setState({ date: today, goals: defaultDailyGoals() });
  }

  const completed = state.goals.filter((goal) => goal.done).length;
  const progress = Math.round((completed / state.goals.length) * 100);
  return { goals: state.goals, completed, progress, toggleGoal, updateGoal, resetGoals };
}

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function defaultExamCountdowns() {
  return [
    { id: 1, title: 'Math exam', date: futureDate(7), tone: 'red' },
    { id: 2, title: 'English project', date: futureDate(14), tone: 'amber' },
    { id: 3, title: 'Holiday', date: futureDate(30), tone: 'green' }
  ];
}

function useExamCountdowns() {
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(EXAM_COUNTDOWNS_KEY));
      return Array.isArray(saved) && saved.length ? saved : defaultExamCountdowns();
    } catch {
      return defaultExamCountdowns();
    }
  });
  const [draft, setDraft] = useState({ title: '', date: futureDate(7) });

  useEffect(() => {
    localStorage.setItem(EXAM_COUNTDOWNS_KEY, JSON.stringify(items.slice(0, 20)));
  }, [items]);

  function addCountdown(event) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title || !draft.date) return;
    setItems((current) => [{ id: Date.now(), title: title.slice(0, 40), date: draft.date, tone: 'amber' }, ...current].slice(0, 20));
    setDraft({ title: '', date: draft.date });
  }

  function removeCountdown(id) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return { items, draft, setDraft, addCountdown, removeCountdown };
}

function useRoomMode() {
  const [roomMode, setRoomModeState] = useState(() => {
    const saved = localStorage.getItem(ROOM_MODE_KEY);
    return ROOM_MODES.some((mode) => mode.id === saved) ? saved : 'relax';
  });

  function setRoomMode(nextMode) {
    setRoomModeState(nextMode);
    localStorage.setItem(ROOM_MODE_KEY, nextMode);
  }

  return [roomMode, setRoomMode];
}

function useCaffeineTimer() {
  const [lastAt, setLastAt] = useState(() => Number(localStorage.getItem(CAFFEINE_KEY)) || 0);

  function logCaffeine() {
    const value = Date.now();
    setLastAt(value);
    localStorage.setItem(CAFFEINE_KEY, String(value));
  }

  function clearCaffeine() {
    setLastAt(0);
    localStorage.removeItem(CAFFEINE_KEY);
  }

  return { lastAt, logCaffeine, clearCaffeine };
}

function normalizePresenceSettings(value) {
  const merged = { ...DEFAULT_PRESENCE_SETTINGS, ...(value || {}) };
  return {
    enabled: Boolean(merged.enabled),
    manualOverride: Boolean(merged.manualOverride),
    wakeStart: /^\d{2}:\d{2}$/.test(merged.wakeStart) ? merged.wakeStart : DEFAULT_PRESENCE_SETTINGS.wakeStart,
    wakeEnd: /^\d{2}:\d{2}$/.test(merged.wakeEnd) ? merged.wakeEnd : DEFAULT_PRESENCE_SETTINGS.wakeEnd,
    nightBlackoutAt: /^\d{2}:\d{2}$/.test(merged.nightBlackoutAt) ? merged.nightBlackoutAt : DEFAULT_PRESENCE_SETTINGS.nightBlackoutAt,
    idleDimMinutes: clampNumber(merged.idleDimMinutes, 1, 60),
    allowNightBlackout: Boolean(merged.allowNightBlackout),
    allowIdleSleep: Boolean(merged.allowIdleSleep)
  };
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map((part) => Number(part) || 0);
  return (hours * 60) + minutes;
}

function isMinuteBetween(value, start, end) {
  const current = timeToMinutes(value);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes <= endMinutes) return current >= startMinutes && current < endMinutes;
  return current >= startMinutes || current < endMinutes;
}

function usePresenceSettings() {
  const [settings, setSettingsState] = useState(() => normalizePresenceSettings(readJsonSetting(PRESENCE_SETTINGS_KEY, DEFAULT_PRESENCE_SETTINGS)));

  function setSettings(patch) {
    setSettingsState((current) => {
      const next = normalizePresenceSettings(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
      localStorage.setItem(PRESENCE_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return [settings, setSettings];
}

function useCommandHistory() {
  const [history, setHistoryState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COMMAND_HISTORY_KEY));
      return Array.isArray(saved) ? saved.slice(0, 50) : [];
    } catch {
      return [];
    }
  });

  function addHistory(entry) {
    setHistoryState((current) => {
      const next = [{ id: Date.now(), timestamp: Date.now(), ...entry }, ...current].slice(0, 50);
      localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearHistory() {
    setHistoryState([]);
    localStorage.removeItem(COMMAND_HISTORY_KEY);
  }

  return { history, addHistory, clearHistory };
}

function normalizeRemoteCameraSettings(value) {
  const merged = { ...DEFAULT_REMOTE_CAMERA_SETTINGS, ...(value || {}) };
  const streamProfile = CAMERA_STREAM_PROFILES.some((profile) => profile.id === merged.streamProfile) ? merged.streamProfile : 'reference720';
  return {
    mode: ['disabled', 'local', 'tailscale', 'both'].includes(merged.mode) ? merged.mode : 'both',
    cameraMode: ['off', 'sensor', 'privacy', 'live'].includes(merged.cameraMode) ? merged.cameraMode : 'sensor',
    cameraEnabled: Boolean(merged.cameraEnabled),
    privacyMode: Boolean(merged.privacyMode),
    highSecurity: Boolean(merged.highSecurity),
    securitySnapshots: Boolean(merged.securitySnapshots),
    cameraDevice: clampNumber(merged.cameraDevice, 0, 8),
    cameraLookMode: CAMERA_LOOK_MODE_IDS.includes(merged.cameraLookMode) ? merged.cameraLookMode : 'normal',
    streamProfile,
    streamFps: clampNumber(merged.streamFps, 1, 150),
    streamQuality: clampNumber(merged.streamQuality, 20, 95),
    streamWidth: clampNumber(merged.streamWidth, 160, 1920),
    streamHeight: clampNumber(merged.streamHeight, 120, 1080),
    cameraControls: normalizeCameraControls(merged.cameraControls),
    backgroundAdaptiveBrightness: Boolean(merged.backgroundAdaptiveBrightness),
    failedAttemptThreshold: clampNumber(merged.failedAttemptThreshold, 1, 20),
    passwordSet: Boolean(merged.passwordSet)
  };
}

function normalizeCameraControls(value) {
  const merged = { ...DEFAULT_CAMERA_CONTROLS, ...(value || {}) };
  return {
    brightness: clampNumber(merged.brightness, 0, 100),
    contrast: clampNumber(merged.contrast, 0, 100),
    saturation: clampNumber(merged.saturation, 0, 100),
    sharpness: clampNumber(merged.sharpness, 0, 100),
    gain: clampNumber(merged.gain, 0, 100),
    autoExposure: Boolean(merged.autoExposure),
    exposure: clampNumber(merged.exposure, -13, 0),
    autoWhiteBalance: Boolean(merged.autoWhiteBalance),
    whiteBalance: clampNumber(merged.whiteBalance, 2800, 7000)
  };
}

function cameraControlsFromBackend(value) {
  const source = value || {};
  return normalizeCameraControls({
    brightness: source.brightness,
    contrast: source.contrast,
    saturation: source.saturation,
    sharpness: source.sharpness,
    gain: source.gain,
    autoExposure: source.auto_exposure,
    exposure: source.exposure,
    autoWhiteBalance: source.auto_white_balance,
    whiteBalance: source.white_balance
  });
}

function cameraControlsToBackend(value) {
  const controls = normalizeCameraControls(value);
  return {
    brightness: controls.brightness,
    contrast: controls.contrast,
    saturation: controls.saturation,
    sharpness: controls.sharpness,
    gain: controls.gain,
    auto_exposure: controls.autoExposure,
    exposure: controls.exposure,
    auto_white_balance: controls.autoWhiteBalance,
    white_balance: controls.whiteBalance
  };
}

function cameraPresetForBrightness(brightnessPercent) {
  if (brightnessPercent == null) return null;
  const value = Number(brightnessPercent);
  if (!Number.isFinite(value)) return CAMERA_CONTROL_PRESETS.find((preset) => preset.id === 'normal');
  if (value <= 18) return CAMERA_CONTROL_PRESETS.find((preset) => preset.id === 'night-vision');
  if (value <= 42) return CAMERA_CONTROL_PRESETS.find((preset) => preset.id === 'dark-room');
  if (value >= 78) return CAMERA_CONTROL_PRESETS.find((preset) => preset.id === 'bright-room');
  return CAMERA_CONTROL_PRESETS.find((preset) => preset.id === 'normal');
}

function cameraStreamPatchForProfile(profileId) {
  const profile = CAMERA_STREAM_PROFILES.find((item) => item.id === profileId) || CAMERA_STREAM_PROFILES.find((item) => item.id === 'reference720');
  return {
    streamProfile: profile.id,
    streamFps: profile.fps,
    streamQuality: profile.quality,
    streamWidth: profile.width,
    streamHeight: profile.height
  };
}

function CameraStreamControls({ settings, onChange, compact = false }) {
  const [draft, setDraft] = useState(settings);
  const commitTimer = useRef(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings.streamProfile, settings.streamFps, settings.streamQuality, settings.streamWidth, settings.streamHeight]);

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  function commitStreamPatch(patch, immediate = false) {
    setDraft((current) => ({ ...current, ...patch }));
    window.clearTimeout(commitTimer.current);
    if (immediate) {
      onChange(patch);
      return;
    }
    commitTimer.current = window.setTimeout(() => onChange(patch), 260);
  }

  return (
    <div className={compact ? 'camera-stream-controls compact' : 'camera-stream-controls'}>
      <div className="camera-stream-presets">
        {CAMERA_STREAM_PROFILES.map((profile) => (
          <button
            type="button"
            key={profile.id}
            className={draft.streamProfile === profile.id ? 'active' : ''}
            onClick={() => commitStreamPatch(cameraStreamPatchForProfile(profile.id), true)}
          >
            <strong>{profile.label}</strong>
            <span>{profile.detail}</span>
          </button>
        ))}
      </div>
      <div className="camera-stream-sliders">
        <label>FPS <strong>{draft.streamFps}</strong>
          <input
            type="range"
            min="1"
            max="150"
            value={draft.streamFps}
            onChange={(event) => commitStreamPatch({ streamProfile: 'custom', streamFps: Number(event.target.value) })}
          />
        </label>
        <label>Quality <strong>{draft.streamQuality}</strong>
          <input
            type="range"
            min="20"
            max="95"
            value={draft.streamQuality}
            onChange={(event) => commitStreamPatch({ streamProfile: 'custom', streamQuality: Number(event.target.value) })}
          />
        </label>
        <label>Width
          <input
            type="number"
            min="160"
            max="1920"
            value={draft.streamWidth}
            onChange={(event) => commitStreamPatch({ streamProfile: 'custom', streamWidth: Number(event.target.value) })}
          />
        </label>
        <label>Height
          <input
            type="number"
            min="120"
            max="1080"
            value={draft.streamHeight}
            onChange={(event) => commitStreamPatch({ streamProfile: 'custom', streamHeight: Number(event.target.value) })}
          />
        </label>
      </div>
      <p className="camera-stream-note">
        Current stream: {draft.streamWidth}x{draft.streamHeight} / {draft.streamFps} FPS / quality {draft.streamQuality}. Actual FPS still depends on the camera and laptop load.
      </p>
    </div>
  );
}

function CameraModeControls({ settings, onChange, compact = false }) {
  const [draft, setDraft] = useState(() => normalizeCameraControls(settings.cameraControls));
  const commitTimer = useRef(null);

  useEffect(() => {
    setDraft(normalizeCameraControls(settings.cameraControls));
  }, [settings.cameraControls]);

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  function commitPatch(patch, immediate = false) {
    const nextControls = normalizeCameraControls({ ...draft, ...patch.cameraControls });
    setDraft(nextControls);
    window.clearTimeout(commitTimer.current);
    const payload = { ...patch, cameraControls: nextControls };
    if (immediate) {
      onChange(payload);
      return;
    }
    commitTimer.current = window.setTimeout(() => onChange(payload), 160);
  }

  function applyMode(mode) {
    if (mode.id === 'manual') {
      onChange({ cameraLookMode: 'manual' });
      return;
    }
    commitPatch({
      cameraLookMode: mode.id,
      cameraControls: mode.patch,
      ...cameraStreamPatchForProfile(mode.id === 'normal' ? 'reference720' : 'smooth30')
    }, true);
  }

  const currentMode = settings.cameraLookMode || 'normal';

  return (
    <div className={compact ? 'camera-mode-controls compact' : 'camera-mode-controls'}>
      <div className="camera-control-header">
        <div>
          <strong>Camera Modes</strong>
          <span>Calibrated presets for your laptop camera environment.</span>
        </div>
        <button type="button" onClick={() => applyMode(CAMERA_LOOK_MODES.find((mode) => mode.id === 'normal'))}>Reset to normal</button>
      </div>
      <div className="camera-control-presets">
        {CAMERA_LOOK_MODES.map((mode) => {
          const Icon = mode.Icon || Camera;
          return (
            <button type="button" key={mode.id} className={currentMode === mode.id ? 'active' : ''} onClick={() => applyMode(mode)}>
              <Icon size={18} />
              <strong>{mode.label}</strong>
              <span>{mode.detail}</span>
            </button>
          );
        })}
      </div>
      <div className="camera-toggle-row">
        <button type="button" className={draft.autoExposure ? 'active' : ''} onClick={() => commitPatch({ cameraLookMode: 'manual', cameraControls: { autoExposure: !draft.autoExposure } }, true)}>
          Auto exposure {draft.autoExposure ? 'on' : 'off'}
        </button>
        <button type="button" className={draft.autoWhiteBalance ? 'active' : ''} onClick={() => commitPatch({ cameraLookMode: 'manual', cameraControls: { autoWhiteBalance: !draft.autoWhiteBalance } }, true)}>
          Auto white balance {draft.autoWhiteBalance ? 'on' : 'off'}
        </button>
      </div>
      <div className="camera-control-sliders">
        {CAMERA_CONTROL_FIELDS.map((field) => {
          const disabled = (field.key === 'exposure' && draft.autoExposure) || (field.key === 'whiteBalance' && draft.autoWhiteBalance);
          return (
            <label key={field.key}>
              <span>{field.label} <strong>{draft[field.key]}{field.unit}</strong></span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step || 1}
                value={draft[field.key]}
                disabled={disabled}
                onChange={(event) => commitPatch({ cameraLookMode: 'manual', cameraControls: { [field.key]: Number(event.target.value) } })}
              />
              {disabled ? <em>Controlled automatically.</em> : null}
            </label>
          );
        })}
      </div>
      <p className="camera-stream-note">
        Use <strong>Night Vision</strong> only for very dark rooms, <strong>Bright Room</strong> for washed-out light, and <strong>Manual</strong> when you want exact control.
      </p>
    </div>
  );
}

function cameraControlUnsupported(driverStatus, key) {
  const backendKey = CAMERA_CONTROL_BACKEND_KEYS[key] || key;
  return Boolean(driverStatus?.unsupported?.includes(backendKey));
}

function cameraPreviewVars(controls) {
  const normalized = normalizeCameraControls(controls);
  return {
    '--camera-preview-brightness': (0.72 + (normalized.brightness / 100) * 1.05).toFixed(2),
    '--camera-preview-contrast': (0.78 + (normalized.contrast / 100) * 0.72).toFixed(2),
    '--camera-preview-saturation': (0.24 + (normalized.saturation / 100) * 1.76).toFixed(2)
  };
}

function CameraPictureControls({ settings, onChange, compact = false, brightnessPercent = null, driverStatus = null }) {
  const [draft, setDraft] = useState(() => ({
    cameraLookMode: settings.cameraLookMode || 'normal',
    cameraControls: normalizeCameraControls(settings.cameraControls)
  }));
  const commitTimer = useRef(null);
  const activeMode = CAMERA_LOOK_MODES.find((mode) => mode.id === draft.cameraLookMode) || CAMERA_LOOK_MODES.find((mode) => mode.id === 'normal');
  const recommendedPreset = cameraPresetForBrightness(brightnessPercent);

  useEffect(() => {
    setDraft({
      cameraLookMode: settings.cameraLookMode || 'normal',
      cameraControls: normalizeCameraControls(settings.cameraControls)
    });
  }, [settings.cameraLookMode, settings.cameraControls]);

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  function commitPicturePatch(patch, immediate = false) {
    const nextPatch = {
      ...patch,
      ...(patch.cameraControls ? { cameraControls: normalizeCameraControls(patch.cameraControls) } : {})
    };
    setDraft((current) => ({ ...current, ...nextPatch }));
    window.clearTimeout(commitTimer.current);
    if (immediate) {
      onChange(nextPatch);
      return;
    }
    commitTimer.current = window.setTimeout(() => onChange(nextPatch), 220);
  }

  function applyLookMode(mode) {
    const nextControls = mode.patch
      ? normalizeCameraControls({ ...draft.cameraControls, ...mode.patch })
      : normalizeCameraControls({ ...draft.cameraControls, autoExposure: false, autoWhiteBalance: false });
    commitPicturePatch({ cameraLookMode: mode.id, cameraControls: nextControls }, true);
  }

  function updateControl(key, value) {
    const patch = { [key]: Number(value) };
    if (key === 'gain' || key === 'exposure') patch.autoExposure = false;
    if (key === 'whiteBalance') patch.autoWhiteBalance = false;
    commitPicturePatch({
      cameraLookMode: 'manual',
      cameraControls: normalizeCameraControls({ ...draft.cameraControls, ...patch })
    });
  }

  function toggleControl(key) {
    commitPicturePatch({
      cameraLookMode: 'manual',
      cameraControls: normalizeCameraControls({ ...draft.cameraControls, [key]: !draft.cameraControls[key] })
    }, true);
  }

  return (
    <div className={compact ? 'camera-picture-controls compact' : 'camera-picture-controls'}>
      <div className="camera-control-header">
        <div>
          <strong>{activeMode?.label || 'Manual Mode'}</strong>
          <span>Brightness {draft.cameraControls.brightness}% / contrast {draft.cameraControls.contrast}% / gain {draft.cameraControls.gain}%</span>
        </div>
        {recommendedPreset ? (
          <button type="button" onClick={() => applyLookMode(recommendedPreset)}>
            Apply {recommendedPreset.label}
          </button>
        ) : null}
      </div>

      <div className="camera-control-presets">
        {CAMERA_LOOK_MODES.map((mode) => {
          const Icon = mode.Icon;
          return (
            <button
              type="button"
              key={mode.id}
              className={draft.cameraLookMode === mode.id ? 'active' : ''}
              onClick={() => applyLookMode(mode)}
            >
              <strong>{Icon ? <Icon size={16} /> : null}{mode.label}</strong>
              <span>{mode.detail}</span>
            </button>
          );
        })}
      </div>

      <div className="camera-toggle-row">
        <button type="button" className={draft.cameraControls.autoExposure ? 'active' : ''} onClick={() => toggleControl('autoExposure')}>
          {draft.cameraControls.autoExposure ? 'Auto exposure on' : 'Manual exposure'}
        </button>
        <button type="button" className={draft.cameraControls.autoWhiteBalance ? 'active' : ''} onClick={() => toggleControl('autoWhiteBalance')}>
          {draft.cameraControls.autoWhiteBalance ? 'Auto white balance on' : 'Manual white balance'}
        </button>
      </div>

      <div className="camera-control-sliders">
        {CAMERA_CONTROL_FIELDS.map((field) => {
          const autoDisabled = (field.key === 'gain' || field.key === 'exposure') && draft.cameraControls.autoExposure;
          const whiteBalanceDisabled = field.key === 'whiteBalance' && draft.cameraControls.autoWhiteBalance;
          const disabled = autoDisabled || whiteBalanceDisabled;
          const unsupported = cameraControlUnsupported(driverStatus, field.key);
          const value = draft.cameraControls[field.key];
          return (
            <label key={field.key} className={unsupported ? 'unsupported' : ''}>
              <span>{field.label}<strong>{value}{field.unit}</strong></span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step || 1}
                value={value}
                disabled={disabled}
                onChange={(event) => updateControl(field.key, event.target.value)}
              />
              <em>{unsupported ? 'Driver limited' : disabled ? 'Automatic' : 'Manual'}</em>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function useRemoteCameraSettings() {
  const [settings, setSettingsState] = useState(() => normalizeRemoteCameraSettings(readJsonSetting(REMOTE_CAMERA_SETTINGS_KEY, DEFAULT_REMOTE_CAMERA_SETTINGS)));

  const setSettings = useCallback((patch) => {
    setSettingsState((current) => {
      const next = normalizeRemoteCameraSettings(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
      localStorage.setItem(REMOTE_CAMERA_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return [settings, setSettings];
}

function useUsbCameraSensor(enabled = true, options = {}) {
  const sensorIntervalMs = Number(options.sensorIntervalMs || 3000);
  const logIntervalMs = Number(options.logIntervalMs || 15000);
  const autoStartBackend = options.autoStartBackend !== false;
  const autoStartReason = options.autoStartReason || 'camera-sensor';
  const lastLogFetchRef = useRef(0);
  const [sensor, setSensor] = useState({
    ok: false,
    loading: true,
    error: '',
    camera: null,
    motion: null,
    brightness: null,
    face: null,
    logs: []
  });

  const readSensor = useCallback(async (forceLogs = false) => {
    const response = await fetch(`${DEVICE_API_BASE}/api/local-camera/sensor`, { cache: 'no-store' });
    const data = await response.json();
    let logs = null;
    const shouldRefreshLogs = forceLogs || Date.now() - lastLogFetchRef.current > logIntervalMs;
    if (shouldRefreshLogs) {
      try {
        const logResponse = await fetch(`${DEVICE_API_BASE}/api/local-camera/logs`, { cache: 'no-store' });
        const logData = await readJsonResponse(logResponse, 'Camera log failed');
        logs = logData.logs || [];
        lastLogFetchRef.current = Date.now();
      } catch {
        logs = [];
      }
    }
    return { data, logs };
  }, [logIntervalMs]);

  const refreshSensor = useCallback(async (forceLogs = false) => {
    if (!enabled) {
      setSensor((current) => ({ ...current, loading: false }));
      return;
    }
    try {
      const { data, logs } = await readSensor(forceLogs);
      setSensor((current) => ({
        ok: !data?.camera?.error,
        loading: false,
        error: data?.camera?.error || '',
        camera: data.camera || null,
        motion: data.motion || null,
        brightness: data.brightness || null,
        face: data.face || null,
        logs: logs ?? current.logs
      }));
    } catch (error) {
      if (autoStartBackend) {
        const baseMessage = error?.message || 'Local camera sensor backend is offline.';
        setSensor((current) => ({
          ...current,
          ok: false,
          loading: true,
          error: `${baseMessage} Starting backend...`
        }));

        const startResult = await requestBackendAutostart(autoStartReason);
        if (startResult.ok || startResult.started || startResult.skipped) {
          await wait(startResult.started ? 1800 : 900);
          try {
            const { data, logs } = await readSensor(true);
            setSensor((current) => ({
              ok: !data?.camera?.error,
              loading: false,
              error: data?.camera?.error || '',
              camera: data.camera || null,
              motion: data.motion || null,
              brightness: data.brightness || null,
              face: data.face || null,
              logs: logs ?? current.logs
            }));
            return;
          } catch (retryError) {
            setSensor((current) => ({
              ...current,
              ok: false,
              loading: false,
              error: retryError?.message || startResult.message || 'Backend autostart did not recover the camera sensor.'
            }));
            return;
          }
        }

        setSensor((current) => ({
          ...current,
          ok: false,
          loading: false,
          error: startResult.error || startResult.message || 'Backend autostart failed.'
        }));
        return;
      }

      setSensor((current) => ({
        ...current,
        ok: false,
        loading: false,
        error: error?.message || 'Local camera sensor backend is offline.'
      }));
    }
  }, [autoStartBackend, autoStartReason, enabled, readSensor]);

  useEffect(() => {
    refreshSensor(true);
    if (!enabled) return undefined;
    const timer = window.setInterval(() => refreshSensor(false), sensorIntervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, refreshSensor, sensorIntervalMs]);

  return { sensor, refreshSensor: () => refreshSensor(true) };
}

function useSecurityLog() {
  const [entries, setEntries] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SECURITY_LOG_KEY));
      return Array.isArray(saved) ? saved.slice(0, 100) : [];
    } catch {
      return [];
    }
  });

  function add(entry) {
    setEntries((current) => {
      const next = [{ id: Date.now(), timestamp: Date.now(), ...entry }, ...current].slice(0, 100);
      localStorage.setItem(SECURITY_LOG_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clear() {
    setEntries([]);
    localStorage.removeItem(SECURITY_LOG_KEY);
  }

  function exportLog() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kisoke-security-log-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return { entries, add, clear, exportLog };
}

function normalizeLanguageSettings(value) {
  const merged = { ...DEFAULT_LANGUAGE_SETTINGS, ...(value || {}) };
  return {
    language: ['en', 'ar'].includes(merged.language) ? merged.language : 'en',
    dateArabic: Boolean(merged.dateArabic),
    prayerArabic: Boolean(merged.prayerArabic)
  };
}

function useLanguageSettings() {
  const [settings, setSettingsState] = useState(() => normalizeLanguageSettings(readJsonSetting(LANGUAGE_SETTINGS_KEY, DEFAULT_LANGUAGE_SETTINGS)));

  function setSettings(patch) {
    setSettingsState((current) => {
      const next = normalizeLanguageSettings(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
      localStorage.setItem(LANGUAGE_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return [settings, setSettings];
}

function useBatteryStatus() {
  const [battery, setBattery] = useState({ supported: false, level: null, charging: null });

  useEffect(() => {
    let manager = null;
    let cancelled = false;

    function update() {
      if (!manager || cancelled) return;
      setBattery({
        supported: true,
        level: Math.round(manager.level * 100),
        charging: manager.charging
      });
    }

    if (!navigator.getBattery) return undefined;
    navigator.getBattery().then((nextManager) => {
      if (cancelled) return;
      manager = nextManager;
      update();
      manager.addEventListener('levelchange', update);
      manager.addEventListener('chargingchange', update);
    }).catch(() => setBattery({ supported: false, level: null, charging: null }));

    return () => {
      cancelled = true;
      if (manager) {
        manager.removeEventListener('levelchange', update);
        manager.removeEventListener('chargingchange', update);
      }
    };
  }, []);

  return battery;
}

function useBackendBatteryStatus(enabled = true) {
  const [battery, setBattery] = useState({ supported: false, level: null, charging: null, runtime: 0, source: 'browser' });

  useEffect(() => {
    if (!enabled) return undefined;
    let ignore = false;
    async function loadBattery() {
      try {
        const response = await fetch(`${DEVICE_API_BASE}/api/device/battery`);
        const data = await response.json();
        if (ignore || !data.ok) return;
        setBattery((current) => ({
          ...current,
          supported: data.supported !== false,
          level: data.percent ?? current.level,
          charging: data.charging ?? current.charging,
          source: data.tool || 'backend'
        }));
      } catch {
        // Browser battery fallback is handled separately.
      }
    }

    async function loadRuntime() {
      try {
        const response = await fetch(`${DEVICE_API_BASE}/api/device/runtime`);
        const data = await response.json();
        if (!ignore && data.ok) {
          setBattery((current) => ({ ...current, runtime: data.seconds || 0 }));
        }
      } catch {
        // Backend may be off; keep the UI quiet.
      }
    }

    loadBattery();
    loadRuntime();
    const batteryTimer = setInterval(loadBattery, 60 * 1000);
    const runtimeTimer = setInterval(loadRuntime, 2 * 60 * 1000);
    return () => {
      ignore = true;
      clearInterval(batteryTimer);
      clearInterval(runtimeTimer);
    };
  }, [enabled]);

  return battery;
}

function useSignalCenterStatus() {
  const [status, setStatus] = useState({
    loaded: false,
    error: '',
    sdr: null,
    radio: null,
    aircraft: null,
    updatedAt: null
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/signal/status`);
      const data = await readJsonResponse(response, 'Device status failed');
      setStatus({
        loaded: true,
        error: data.ok === false ? (data.error || 'Signal backend unavailable') : '',
        sdr: data.sdr || null,
        radio: data.radio || null,
        aircraft: data.aircraft || null,
        updatedAt: Date.now()
      });
    } catch {
      setStatus((current) => ({
        ...current,
        loaded: true,
        error: 'Backend is not running on port 8787.',
        updatedAt: Date.now()
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { ...status, refresh };
}

function normalizeAssistantSettings(value) {
  const merged = { ...DEFAULT_ASSISTANT_SETTINGS, ...(value || {}) };
  return {
    ...merged,
    assistantName: String(merged.assistantName || DEFAULT_ASSISTANT_SETTINGS.assistantName).trim(),
    introName: String(merged.introName || DEFAULT_ASSISTANT_SETTINGS.introName).trim(),
    callNames: String(merged.callNames || DEFAULT_ASSISTANT_SETTINGS.callNames).trim(),
    startupCallName: String(merged.startupCallName || DEFAULT_ASSISTANT_SETTINGS.startupCallName).trim(),
    modelTier: AI_MODEL_TIERS.some((tier) => tier.id === merged.modelTier) ? merged.modelTier : DEFAULT_ASSISTANT_SETTINGS.modelTier,
    model25: String(merged.model25 || DEFAULT_ASSISTANT_SETTINGS.model25).trim(),
    model35: String(merged.model35 || DEFAULT_ASSISTANT_SETTINGS.model35).trim(),
    model45: String(merged.model45 || DEFAULT_ASSISTANT_SETTINGS.model45).trim(),
    qwenModel: String(merged.qwenModel || DEFAULT_ASSISTANT_SETTINGS.qwenModel).trim(),
    easyModel: String(merged.easyModel || DEFAULT_ASSISTANT_SETTINGS.easyModel).trim(),
    hardModel: String(merged.hardModel || DEFAULT_ASSISTANT_SETTINGS.hardModel).trim(),
    voiceAssistant: Boolean(merged.voiceAssistant),
    alwaysListen: Boolean(merged.alwaysListen),
    voiceReplies: Boolean(merged.voiceReplies),
    alwaysShowOrb: Boolean(merged.alwaysShowOrb),
    showOrbTranscript: Boolean(merged.showOrbTranscript),
    voiceDebug: Boolean(merged.voiceDebug),
    voiceMode: ['off', 'press', 'wake'].includes(merged.voiceMode) ? merged.voiceMode : DEFAULT_ASSISTANT_SETTINGS.voiceMode,
    randomizeCallName: merged.randomizeCallName !== false,
    startupGreetingMode: ['intro', 'random', 'custom', 'audio', 'silent'].includes(merged.startupGreetingMode) ? merged.startupGreetingMode : DEFAULT_ASSISTANT_SETTINGS.startupGreetingMode,
    customStartupText: String(merged.customStartupText || '').trim(),
    customStartupAudio: String(merged.customStartupAudio || '').trim()
  };
}

function readInitialAssistantSettings() {
  const stored = readJsonSetting(ASSISTANT_SETTINGS_KEY, DEFAULT_ASSISTANT_SETTINGS);
  const needsModelMigration = (
    stored.easyModel === 'llama3.2:1b'
    || stored.hardModel === 'qwen3:4b'
    || stored.model45 === 'qwen3:4b'
    || !stored.qwenModel
  );
  if (needsModelMigration && localStorage.getItem(ASSISTANT_MODEL_MIGRATION_KEY) !== 'true') {
    const migrated = normalizeAssistantSettings({
      ...stored,
      model25: DEFAULT_ASSISTANT_SETTINGS.model25,
      model35: DEFAULT_ASSISTANT_SETTINGS.model35,
      model45: DEFAULT_ASSISTANT_SETTINGS.model45,
      qwenModel: DEFAULT_ASSISTANT_SETTINGS.qwenModel,
      easyModel: DEFAULT_ASSISTANT_SETTINGS.easyModel,
      hardModel: DEFAULT_ASSISTANT_SETTINGS.hardModel
    });
    localStorage.setItem(ASSISTANT_MODEL_MIGRATION_KEY, 'true');
    localStorage.setItem(ASSISTANT_SETTINGS_KEY, JSON.stringify(migrated));
    return migrated;
  }
  return stored;
}

function useAssistantSettings() {
  const [settings, setSettingsState] = useState(() => normalizeAssistantSettings(readInitialAssistantSettings()));

  function setSettings(patch) {
    setSettingsState((current) => {
      const next = normalizeAssistantSettings(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
      localStorage.setItem(ASSISTANT_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return [settings, setSettings];
}

function useLocationSettings() {
  const [settings, setSettingsState] = useState(() => sanitizeLocationSettings(readJsonSetting(LOCATION_SETTINGS_KEY, DEFAULT_LOCATION_SETTINGS)));

  function setSettings(patch) {
    setSettingsState((current) => {
      const next = sanitizeLocationSettings(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
      localStorage.setItem(LOCATION_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return [settings, setSettings];
}

function normalizeTimeDeckSettings(value) {
  const merged = { ...DEFAULT_TIME_DECK_SETTINGS, ...(value || {}) };
  const sectionIds = TIME_DECK_SECTIONS.map((section) => section.id);
  return {
    enabled: merged.enabled !== false,
    defaultSection: sectionIds.includes(merged.defaultSection) ? merged.defaultSection : DEFAULT_TIME_DECK_SETTINGS.defaultSection,
    scrollSensitivity: ['low', 'normal', 'high'].includes(merged.scrollSensitivity) ? merged.scrollSensitivity : 'normal',
    scrollSnap: merged.scrollSnap !== false,
    touchSwipe: merged.touchSwipe !== false,
    keyboardNavigation: merged.keyboardNavigation !== false,
    showDots: merged.showDots !== false,
    showNextHint: merged.showNextHint !== false,
    clockTimezoneMode: ['auto', 'Dubai', 'China', 'custom'].includes(merged.clockTimezoneMode) ? merged.clockTimezoneMode : 'Dubai',
    customClockTimezone: String(merged.customClockTimezone || 'Asia/Dubai').trim(),
    clockStyle: ['minimal', 'glossy', 'luxury', 'hacker', 'aurora', 'red-night'].includes(merged.clockStyle) ? merged.clockStyle : 'glossy',
    moonMode: ['auto', 'manual', 'disabled'].includes(merged.moonMode) ? merged.moonMode : 'auto',
    manualMoonPhase: String(merged.manualMoonPhase || 'Full moon'),
    sunMode: ['auto', 'timezone', 'manual'].includes(merged.sunMode) ? merged.sunMode : 'auto',
    manualSunState: String(merged.manualSunState || 'Morning')
  };
}

function useTimeDeckSettings() {
  const [settings, setSettingsState] = useState(() => normalizeTimeDeckSettings(readJsonSetting(TIME_DECK_SETTINGS_KEY, DEFAULT_TIME_DECK_SETTINGS)));

  function setSettings(patch) {
    setSettingsState((current) => {
      const next = normalizeTimeDeckSettings(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
      localStorage.setItem(TIME_DECK_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return [settings, setSettings];
}

function useLookStyle() {
  const [lookStyle, setLookStyleState] = useState(() => localStorage.getItem(LOOK_STYLE_KEY) || 'glossy');

  function setLookStyle(nextStyle) {
    const valid = LOOK_STYLES.some((style) => style.id === nextStyle) ? nextStyle : 'glossy';
    setLookStyleState(valid);
    localStorage.setItem(LOOK_STYLE_KEY, valid);
  }

  return [lookStyle, setLookStyle];
}

function usePerformanceMode() {
  const [mode, setModeState] = useState(() => {
    const saved = localStorage.getItem(PERFORMANCE_MODE_KEY);
    return ['balanced', 'lite', 'full'].includes(saved) ? saved : 'balanced';
  });

  function setPerformanceMode(nextMode) {
    const valid = ['balanced', 'lite', 'full'].includes(nextMode) ? nextMode : 'balanced';
    setModeState(valid);
    localStorage.setItem(PERFORMANCE_MODE_KEY, valid);
  }

  return [mode, setPerformanceMode];
}

function assistantNames(settings) {
  return String(settings.callNames || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function pickUserName(settings) {
  const names = assistantNames(settings);
  if (settings?.randomizeCallName === false) return names[0] || settings?.startupCallName || 'Saeed';
  return names[Math.floor(Math.random() * names.length)] || 'Saeed';
}

function modelForTier(settings, tierId) {
  if (tierId === '2.5') return settings.model25 || 'gemma2:2b';
  if (tierId === '3.5') return settings.model35 || 'phi3.5';
  if (tierId === '4.5') return settings.model45 || 'llama3.2';
  if (tierId === 'qwen') return settings.qwenModel || 'qwen2.5:3b';
  return '';
}

function chooseAssistantModel(settings, command = '') {
  const tier = settings.modelTier || 'auto';
  const text = String(command || '');
  const useHard = text.length > 80 || /\b(explain|analyze|plan|compare|why|how|write|build|debug|fix|research)\b/i.test(text);
  if (tier !== 'auto') {
    return {
      tier,
      label: AI_MODEL_TIERS.find((item) => item.id === tier)?.label || tier,
      model: modelForTier(settings, tier) || settings.hardModel || 'qwen2.5:3b',
      auto: false
    };
  }
  return {
    tier: useHard ? '4.5' : '2.5',
    label: useHard ? 'Auto hard' : 'Auto fast',
    model: useHard ? (settings.hardModel || modelForTier(settings, '4.5')) : (settings.easyModel || modelForTier(settings, '2.5')),
    auto: true
  };
}

function speakClient(text, settings) {
  if (!settings.voiceReplies || !window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.96;
    utterance.volume = 0.75;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis can be unavailable until browser audio is unlocked.
  }
}

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((title, detail = '', tone = 'green') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [{ id, title, detail, tone }, ...current].slice(0, 3));
    playSoftChime();
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3400);
  }, []);

  return { toasts, pushToast };
}

function useVoiceAssistant(settings, onCommand, pushToast) {
  const [state, setState] = useState({
    supported: false,
    listening: false,
    wakeActive: false,
    transcript: '',
    error: '',
    phase: 'idle'
  });
  const recognitionRef = useRef(null);
  const manualListenRef = useRef(false);
  const shouldListenRef = useRef(false);
  const micBlockedRef = useRef(false);
  const lastVoiceErrorToastRef = useRef(0);
  const pendingManualGreetingRef = useRef(false);
  const commandRef = useRef(onCommand);
  const settingsRef = useRef(settings);

  useEffect(() => {
    commandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const startListening = useCallback((manual = false) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.voiceAssistant || currentSettings.voiceMode === 'off') {
      const message = currentSettings.voiceMode === 'off' ? 'Voice mode is off in settings.' : 'Voice assistant is turned off in settings.';
      setState((current) => ({ ...current, listening: false, wakeActive: false, phase: 'idle', error: message }));
      if (manual) pushToast('Voice is off', message, 'amber');
      return;
    }
    if (!manual && micBlockedRef.current) {
      setState((current) => ({
        ...current,
        listening: false,
        wakeActive: false,
        phase: 'error',
        error: 'Microphone permission is blocked for this page.'
      }));
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState((current) => ({ ...current, supported: false, phase: 'error', error: 'Voice recognition is not supported in this browser.' }));
      if (manual) pushToast('Voice unavailable', 'Chrome or Edge with microphone permission is required.', 'amber');
      return;
    }
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = currentSettings.voiceMode === 'wake';
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setState((current) => ({ ...current, supported: true, listening: true, phase: 'listening', error: '' }));
        if (pendingManualGreetingRef.current) {
          pendingManualGreetingRef.current = false;
          const reply = `How can I help you today ${pickUserName(settingsRef.current)}?`;
          speakClient(reply, settingsRef.current);
          pushToast(settingsRef.current.assistantName, reply, 'blue');
        }
      };
      recognition.onerror = (event) => {
        pendingManualGreetingRef.current = false;
        const blocked = event.error === 'not-allowed' || event.error === 'service-not-allowed';
        if (blocked) {
          shouldListenRef.current = false;
          micBlockedRef.current = true;
          localStorage.removeItem(VOICE_ARMED_KEY);
        }
        const message = blocked
          ? 'Microphone permission is blocked for this page.'
          : `Voice error: ${event.error || 'unknown'}`;
        setState((current) => ({ ...current, supported: true, listening: false, wakeActive: false, phase: 'error', error: message }));
        const now = Date.now();
        if (manualListenRef.current || now - lastVoiceErrorToastRef.current > 45000) {
          lastVoiceErrorToastRef.current = now;
          pushToast('Voice stopped', message, 'amber');
        }
      };
      recognition.onend = () => {
        pendingManualGreetingRef.current = false;
        setState((current) => ({ ...current, listening: false, wakeActive: false, phase: current.error ? current.phase : 'idle' }));
        if (!micBlockedRef.current && shouldListenRef.current && settingsRef.current.voiceAssistant && settingsRef.current.voiceMode === 'wake' && settingsRef.current.alwaysListen) {
          window.setTimeout(() => {
            try {
              recognition.continuous = true;
              recognition.start();
            } catch {
              // Chrome throws when start is called while still closing.
            }
          }, 650);
        }
      };
      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const text = event.results[index][0].transcript.trim();
          if (event.results[index].isFinal) finalText += ` ${text}`;
          else interimText += ` ${text}`;
        }
        const transcript = (finalText || interimText).trim();
        if (transcript) setState((current) => ({ ...current, transcript, phase: 'listening' }));
        if (!finalText.trim()) return;

        const currentSettings = settingsRef.current;
        const lower = finalText.toLowerCase();
        const wakeName = currentSettings.assistantName.toLowerCase();
        const wakePhrases = [`hey ${wakeName}`, `hi ${wakeName}`, `ok ${wakeName}`, wakeName];
        const matchedWake = wakePhrases.find((phrase) => lower.includes(phrase));
        const manualMode = manualListenRef.current;
        if (!manualMode && !matchedWake) return;
        setState((current) => ({ ...current, wakeActive: Boolean(matchedWake), phase: matchedWake ? 'heard wake word' : 'listening' }));

        let command = finalText.trim();
        if (matchedWake) {
          command = command.replace(new RegExp(matchedWake, 'i'), '').trim();
        }
        if (!command) {
          const reply = `How can I help you today ${pickUserName(currentSettings)}?`;
          speakClient(reply, currentSettings);
          pushToast(currentSettings.assistantName, reply, 'blue');
          setState((current) => ({ ...current, phase: 'speaking' }));
          window.setTimeout(() => setState((current) => ({ ...current, phase: current.listening ? 'listening' : 'idle' })), 1200);
          return;
        }
        manualListenRef.current = false;
        setState((current) => ({ ...current, phase: 'thinking' }));
        Promise.resolve(commandRef.current(command))
          .then(() => setState((current) => ({ ...current, phase: 'speaking' })))
          .catch(() => setState((current) => ({ ...current, phase: 'error', error: 'Assistant command failed.' })))
          .finally(() => window.setTimeout(() => setState((current) => ({ ...current, wakeActive: false, phase: current.listening ? 'listening' : 'idle' })), 1200));
      };

      recognitionRef.current = recognition;
    }

    manualListenRef.current = manual;
    shouldListenRef.current = currentSettings.voiceMode === 'wake' && currentSettings.alwaysListen;
    if (manual) localStorage.setItem(VOICE_ARMED_KEY, 'true');
    if (recognitionRef.current) recognitionRef.current.continuous = currentSettings.voiceMode === 'wake';
    if (manual) micBlockedRef.current = false;
    setState((current) => ({ ...current, supported: true, wakeActive: manual, phase: manual ? 'listening' : current.phase, error: '' }));
    pendingManualGreetingRef.current = manual;
    try {
      recognitionRef.current.start();
    } catch (error) {
      pendingManualGreetingRef.current = false;
      const message = String(error?.message || error || 'Voice could not start.');
      setState((current) => current.listening
        ? current
        : { ...current, listening: false, wakeActive: false, phase: 'error', error: message });
      if (manual) pushToast('Voice stopped', message, 'amber');
    }
  }, [pushToast]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    manualListenRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
    setState((current) => ({ ...current, listening: false, wakeActive: false, phase: 'idle' }));
  }, []);

  useEffect(() => {
    if (!state.transcript) return undefined;
    const timer = window.setTimeout(() => {
      setState((current) => current.transcript ? { ...current, transcript: '' } : current);
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [state.transcript]);

  useEffect(() => {
    if (!settings.voiceAssistant || !settings.alwaysListen || settings.voiceMode !== 'wake') {
      stopListening();
      return undefined;
    }

    if (localStorage.getItem(VOICE_ARMED_KEY) === 'true') {
      startListening(false);
      return undefined;
    }

    const armAfterGesture = () => {
      localStorage.setItem(VOICE_ARMED_KEY, 'true');
      startListening(false);
    };
    window.addEventListener('pointerdown', armAfterGesture, { once: true, passive: true });
    window.addEventListener('keydown', armAfterGesture, { once: true });
    return () => {
      shouldListenRef.current = false;
      window.removeEventListener('pointerdown', armAfterGesture);
      window.removeEventListener('keydown', armAfterGesture);
    };
  }, [settings.voiceAssistant, settings.alwaysListen, settings.voiceMode, startListening, stopListening]);

  return { ...state, startListening, stopListening };
}

function clampNumber(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function minutesUntil(date, now = new Date()) {
  if (!date) return Infinity;
  return Math.ceil((new Date(date).getTime() - now.getTime()) / 60000);
}

function daysUntilDate(dateKey, now = new Date()) {
  const target = new Date(`${dateKey}T23:59:59`);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function getAirQualityStatus(air) {
  if (!air.loaded || air.aqi == null) return { label: 'Loading', tone: 'neutral', detail: 'Waiting for live AQI' };
  if (air.aqi <= 50) return { label: 'Good', tone: 'green', detail: 'Outdoor air is clean' };
  if (air.aqi <= 100) return { label: 'Moderate', tone: 'amber', detail: 'Fine for most people' };
  if (air.aqi <= 150) return { label: 'Unhealthy sensitive', tone: 'amber', detail: 'Dust may bother breathing' };
  return { label: 'Unhealthy', tone: 'red', detail: 'Limit dusty outdoor time' };
}

function getSmartReminders({ now, weather, prayer, hydration, habits, agenda, dailyGoals, exams, air, battery, system, roomMode, caffeine }) {
  const reminders = [];
  const prayerMinutes = minutesUntil(prayer.time, now);
  const hydrationPct = clampNumber((hydration.amount / hydration.goal) * 100);
  const incompleteHabits = habits.habits.filter((habit) => !habit.history?.[habits.today]).length;
  const soonExam = exams.items
    .map((item) => ({ ...item, daysLeft: daysUntilDate(item.date, now) }))
    .filter((item) => item.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];
  const caffeineHours = caffeine.lastAt ? (now.getTime() - caffeine.lastAt) / 3600000 : Infinity;
  const airStatus = getAirQualityStatus(air);

  if (prayerMinutes <= 10) {
    reminders.push({ id: 'prayer', title: `${prayer.name} in ${Math.max(0, prayerMinutes)} min`, detail: 'Ambient dim and pause loud audio soon', tone: 'green', Icon: Moon });
  }

  if (weather.feels >= 38 || hydrationPct < 55) {
    reminders.push({
      id: 'water',
      title: hydrationPct < 55 ? 'Drink water' : 'Heat warning',
      detail: `${Math.round(hydrationPct)}% of goal / feels ${weather.feels}C`,
      tone: weather.feels >= 40 ? 'red' : 'amber',
      Icon: Droplets
    });
  }

  if (soonExam && soonExam.daysLeft <= 14) {
    reminders.push({
      id: 'exam',
      title: soonExam.daysLeft <= 1 ? `${soonExam.title} tomorrow` : `${soonExam.title} in ${soonExam.daysLeft} days`,
      detail: soonExam.daysLeft <= 3 ? 'High priority study window' : 'Countdown board is tracking it',
      tone: soonExam.daysLeft <= 3 ? 'red' : 'amber',
      Icon: CalendarDays
    });
  }

  if (dailyGoals.progress < 100 && now.getHours() >= 18) {
    reminders.push({
      id: 'goals',
      title: 'Daily goals unfinished',
      detail: `${dailyGoals.completed}/${dailyGoals.goals.length} complete before sleep`,
      tone: dailyGoals.progress < 40 ? 'red' : 'amber',
      Icon: Target
    });
  }

  if (now.getHours() >= 21 && incompleteHabits > 0) {
    reminders.push({ id: 'habit', title: `${incompleteHabits} habits left`, detail: 'Finish streaks before wind-down', tone: 'amber', Icon: Trophy });
  }

  if (agenda.entries.some((entry) => {
    const [hours, minutes] = entry.time.split(':').map(Number);
    const entryTime = new Date(now);
    entryTime.setHours(hours || 0, minutes || 0, 0, 0);
    const diff = minutesUntil(entryTime, now);
    return diff >= 0 && diff <= 20;
  })) {
    const nextEntry = agenda.entries.find((entry) => {
      const [hours, minutes] = entry.time.split(':').map(Number);
      const entryTime = new Date(now);
      entryTime.setHours(hours || 0, minutes || 0, 0, 0);
      return minutesUntil(entryTime, now) >= 0;
    });
    reminders.push({ id: 'agenda', title: nextEntry?.title || 'Plan soon', detail: 'Upcoming agenda item', tone: 'green', Icon: Clock3 });
  }

  if (battery.supported && battery.level != null && battery.level <= 25 && !battery.charging) {
    reminders.push({ id: 'battery', title: 'Laptop battery low', detail: `${battery.level}% remaining - plug in charger`, tone: 'red', Icon: BatteryCharging });
  }

  if (system.tempC >= 78 || system.cpuPercent >= 86) {
    reminders.push({
      id: 'system',
      title: system.tempC >= 78 ? 'Laptop is hot' : 'CPU load high',
      detail: `${system.tempC ?? '--'}C / CPU ${system.cpuPercent}%`,
      tone: 'red',
      Icon: Cpu
    });
  }

  if (air.loaded && air.aqi >= 120) {
    reminders.push({ id: 'air', title: 'Dust / AQI warning', detail: `${airStatus.label} AQI ${air.aqi}`, tone: air.aqi >= 151 ? 'red' : 'amber', Icon: Cloud });
  }

  if (now.getHours() >= 22 && roomMode !== 'sleep') {
    reminders.push({ id: 'sleep', title: 'Sleep early', detail: 'Switch room mode to Sleep for dim UI', tone: 'amber', Icon: Moon });
  }

  if (caffeineHours < 8 && now.getHours() >= 18) {
    reminders.push({ id: 'caffeine', title: 'Caffeine still active', detail: `${Math.ceil(8 - caffeineHours)}h left before sleep-safe`, tone: 'amber', Icon: Coffee });
  }

  if (!reminders.length) {
    reminders.push({ id: 'steady', title: 'Room is steady', detail: 'No urgent reminders right now', tone: 'green', Icon: Shield });
  }

  return reminders.slice(0, 3);
}

function getSleepReadiness({ now, weather, hydration, caffeine, dailyGoals, roomMode }) {
  const hour = now.getHours() + now.getMinutes() / 60;
  const hydrationPct = clampNumber((hydration.amount / hydration.goal) * 100);
  const caffeineHours = caffeine.lastAt ? (now.getTime() - caffeine.lastAt) / 3600000 : Infinity;
  const caffeineActive = caffeineHours < 8;
  const sleepStart = 22;
  const sleepEnd = 6.5;
  const windDownStart = 20.5;
  const inSleepWindow = hour >= sleepStart || hour < sleepEnd;
  const inWindDown = hour >= windDownStart || hour < sleepEnd;
  const heatStress = (weather?.humidity ?? 0) >= 70 || (weather?.feels ?? 0) >= 36;
  const hoursUntilSleepWindow = hour < sleepStart ? sleepStart - hour : 0;
  const sleepWindowText = inSleepWindow
    ? 'Sleep window is active'
    : inWindDown
      ? `Sleep window in ${Math.max(1, Math.round(hoursUntilSleepWindow * 60))} min`
      : `Wind-down starts around ${formatHourLabel(windDownStart)}`;

  let score = inWindDown ? 70 : 48;
  if (inSleepWindow) score += 18;
  if (roomMode === 'sleep') score += 8;
  if (hydrationPct < 55) score -= 8;
  if (hydrationPct > 90 && inWindDown) score += 4;
  if (dailyGoals.progress < 67 && hour >= 20) score -= 8;
  if (caffeineActive) score -= 18;
  if (heatStress) score -= 7;
  score = Math.round(clampNumber(score));

  const label = score >= 82 ? 'Good sleep window' : score >= 62 ? 'Prepare for sleep' : 'Not ready yet';
  const factors = [
    sleepWindowText,
    caffeineActive ? `${Math.ceil(8 - caffeineHours)}h caffeine fade left` : 'No active caffeine logged',
    `${Math.round(hydrationPct)}% water goal`,
    heatStress ? 'Heat/humidity may disturb sleep' : 'Room climate looks sleep-safe',
    roomMode === 'sleep' ? 'Sleep mode active' : 'Sleep mode available'
  ];
  const actions = [
    score < 82 ? 'Dim screen and reduce audio' : 'Keep the room quiet',
    hydrationPct < 80 ? 'Drink small water now' : 'Hydration looks fine',
    caffeineActive ? 'Avoid more caffeine tonight' : 'No caffeine warning',
    !inWindDown ? 'This is daytime readiness, not bedtime yet' : 'Start wind-down routine'
  ];

  return { score, label, factors: factors.slice(0, 4), actions: actions.slice(0, 4), caffeineActive };
}

function formatHourLabel(hourValue) {
  const hours = Math.floor(hourValue);
  const minutes = Math.round((hourValue - hours) * 60);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' });
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function solarTime(date, zenith, sunrise) {
  const lngHour = AJMAN.lon / 15;
  const n = dayOfYear(date);
  const t = n + ((sunrise ? 6 : 18) - lngHour) / 24;
  const m = (0.9856 * t) - 3.289;
  let l = m + (1.916 * Math.sin((Math.PI / 180) * m)) + (0.020 * Math.sin((Math.PI / 180) * 2 * m)) + 282.634;
  l = (l + 360) % 360;
  let ra = (180 / Math.PI) * Math.atan(0.91764 * Math.tan((Math.PI / 180) * l));
  ra = (ra + 360) % 360;
  ra += (Math.floor(l / 90) * 90) - (Math.floor(ra / 90) * 90);
  ra /= 15;
  const sinDec = 0.39782 * Math.sin((Math.PI / 180) * l);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos((Math.PI / 180) * zenith) - (sinDec * Math.sin((Math.PI / 180) * AJMAN.lat))) / (cosDec * Math.cos((Math.PI / 180) * AJMAN.lat));
  if (cosH > 1 || cosH < -1) return null;
  let h = sunrise ? 360 - (180 / Math.PI) * Math.acos(cosH) : (180 / Math.PI) * Math.acos(cosH);
  h /= 15;
  const local = h + ra - (0.06571 * t) - 6.622 - lngHour + 4;
  return (local + 24) % 24;
}

function timeFromHours(date, hours) {
  const value = new Date(date);
  value.setHours(Math.floor(hours), Math.round((hours % 1) * 60), 0, 0);
  return value;
}

function getPrayerTimes(date) {
  const sunrise = solarTime(date, 90.833, true);
  const sunset = solarTime(date, 90.833, false);
  const fajr = solarTime(date, 108, true);
  const isha = solarTime(date, 108, false);
  const dhuhr = (sunrise + sunset) / 2 + 0.08;
  const asr = dhuhr + ((sunset - dhuhr) * 0.58);
  const maghrib = sunset + 0.05;
  return [
    ['Fajr', fajr],
    ['Sunrise', sunrise],
    ['Dhuhr', dhuhr],
    ['Asr', asr],
    ['Maghrib', maghrib],
    ['Isha', isha]
  ].map(([name, hours]) => ({ name, time: timeFromHours(date, hours) }));
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSingleClockTime(date, timeFormat, options = {}) {
  const withSeconds = options.seconds ?? false;
  if (timeFormat === '12') {
    return date.toLocaleTimeString('en-AE', {
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: true
    });
  }
  const base = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base;
}

function formatClockTime(date, timeFormat, options = {}) {
  if (timeFormat === 'both') {
    return `${formatSingleClockTime(date, '24', options)} / ${formatSingleClockTime(date, '12', options)}`;
  }
  return formatSingleClockTime(date, timeFormat, options);
}

function formatTimeZone(date, timeZone, timeFormat, options = {}) {
  const safeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatZone = (format) => {
    try {
      return date.toLocaleTimeString('en-AE', {
        timeZone: safeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: options.seconds ? '2-digit' : undefined,
        hour12: format === '12'
      });
    } catch {
      return formatSingleClockTime(date, format, options);
    }
  };

  if (timeFormat === 'both') return `${formatZone('24')} / ${formatZone('12')}`;
  return formatZone(timeFormat);
}

function formatDateForZone(date, timeZone) {
  try {
    return date.toLocaleDateString('en-AE', {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return date.toLocaleDateString('en-AE', { weekday: 'long', month: 'long', day: 'numeric' });
  }
}

function formatAlarmLabel(value, timeFormat) {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return formatClockTime(date, timeFormat);
}

function formatShortTime(value, timeFormat) {
  if (!value) return '--';
  return formatClockTime(new Date(value), timeFormat);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'waiting';
  const diff = Date.now() - Number(timestamp);
  if (!Number.isFinite(diff) || diff < 60 * 1000) return 'just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' });
}

function windDirectionLabel(degrees = 0) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function isNightAt(date, sunrise, sunset) {
  if (!date) return false;
  if (!sunrise || !sunset) {
    const hour = date.getHours();
    return hour < 6 || hour >= 18;
  }
  return date < new Date(sunrise) || date >= new Date(sunset);
}

function weatherCondition(code = 0, night = false) {
  if (code === 0) return night ? { label: 'Clear night', Icon: Moon, tone: 'night' } : { label: 'Sunny', Icon: Sun, tone: 'sun' };
  if ([1, 2].includes(code)) return night ? { label: 'Partly cloudy night', Icon: CloudMoon, tone: 'night partly' } : { label: 'Partly cloudy', Icon: CloudSun, tone: 'partly' };
  if (code === 3) return { label: 'Cloudy', Icon: Cloudy, tone: 'cloud' };
  if ([45, 48].includes(code)) return { label: 'Fog', Icon: Cloud, tone: 'cloud' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Rain', Icon: CloudRain, tone: 'rain' };
  if (code >= 95) return { label: 'Thunderstorm', Icon: CloudRain, tone: 'storm' };
  return { label: 'Cloudy', Icon: Cloud, tone: 'cloud' };
}

function getFallbackAmbientPhase(now) {
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < 5) return { id: 'midnight', label: 'Midnight red', mode: 'night', detail: 'Ultra dim sleep display' };
  if (hour < 6.4) return { id: 'dawn', label: 'Dawn', mode: 'white', detail: 'Soft pre-sunrise glow' };
  if (hour < 7.6) return { id: 'sunrise', label: 'Sunrise', mode: 'white', detail: 'Low sun and morning rays' };
  if (hour < 9) return { id: 'morning', label: 'Morning glow', mode: 'white', detail: 'Clean warm morning light' };
  if (hour < 12) return { id: 'late-morning', label: 'Late morning', mode: 'white', detail: 'Bright clear room light' };
  if (hour < 15) return { id: 'noon', label: 'Noon peak', mode: 'white', detail: 'Highest daylight level' };
  if (hour < 16) return { id: 'afternoon', label: 'Afternoon soft', mode: 'white', detail: 'Light starts to soften' };
  if (hour < 18.55) return { id: 'asr', label: 'Asr golden', mode: 'white', detail: 'Warm daylight, not night mode' };
  if (hour < 19.35) return { id: 'sunset', label: 'Sunset amber', mode: 'slate', detail: 'Low orange horizon' };
  if (hour < 20.5) return { id: 'dusk', label: 'Dusk', mode: 'slate', detail: 'Purple after-sunset sky' };
  return { id: 'evening', label: 'Evening calm', mode: 'slate', detail: 'Dim bedroom dashboard' };
}

function parseWeatherSunTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAmbientPhase(now, weather) {
  const sunrise = parseWeatherSunTime(weather?.sunrise);
  const sunset = parseWeatherSunTime(weather?.sunset);
  if (!sunrise || !sunset) return getFallbackAmbientPhase(now);

  const minute = 60 * 1000;
  const time = now.getTime();
  const sunriseMs = sunrise.getTime();
  const sunsetMs = sunset.getTime();
  const dawnStart = sunriseMs - 90 * minute;
  const sunriseStart = sunriseMs - 8 * minute;
  const sunriseEnd = sunriseMs + 75 * minute;
  const sunsetStart = sunsetMs - 50 * minute;
  const sunsetEnd = sunsetMs + 12 * minute;
  const duskEnd = sunsetMs + 95 * minute;
  const noonStart = sunriseMs + ((sunsetMs - sunriseMs) * 0.42);
  const noonEnd = sunriseMs + ((sunsetMs - sunriseMs) * 0.62);
  const afternoonEnd = sunsetMs - 155 * minute;

  if (time < dawnStart) return { id: 'midnight', label: 'Midnight red', mode: 'night', detail: 'Before live dawn window' };
  if (time < sunriseStart) return { id: 'dawn', label: 'Dawn', mode: 'white', detail: `Before sunrise at ${formatShortTime(sunrise)}` };
  if (time < sunriseEnd) return { id: 'sunrise', label: 'Sunrise', mode: 'white', detail: `Sunrise from weather feed: ${formatShortTime(sunrise)}` };
  if (time < noonStart) return { id: 'morning', label: 'Morning glow', mode: 'white', detail: 'After live sunrise' };
  if (time < noonEnd) return { id: 'noon', label: 'Noon peak', mode: 'white', detail: 'Highest daylight level' };
  if (time < afternoonEnd) return { id: 'afternoon', label: 'Afternoon soft', mode: 'white', detail: 'Light starts to soften' };
  if (time < sunsetStart) return { id: 'asr', label: 'Asr golden', mode: 'white', detail: `Before sunset at ${formatShortTime(sunset)}` };
  if (time < sunsetEnd) return { id: 'sunset', label: 'Sunset amber', mode: 'slate', detail: `Sunset from weather feed: ${formatShortTime(sunset)}` };
  if (time < duskEnd) return { id: 'dusk', label: 'Dusk', mode: 'slate', detail: 'After live sunset' };
  return { id: 'evening', label: 'Evening calm', mode: 'slate', detail: 'After live dusk window' };
}

function getWeatherMood(weather, night = false) {
  const condition = weatherCondition(weather.code, night);
  const windy = Number(weather.wind) >= 28;
  const activeWetWeather = Number(weather?.precipitation ?? 0) >= 0.2 || Number(weather?.rain ?? 0) >= 70;
  if (condition.tone === 'storm') {
    if (activeWetWeather) return { id: windy ? 'storm-wind' : 'storm', label: condition.label, warning: windy ? 'Thunder and wind outside' : 'Thunderstorm ambience ready' };
    if (windy) return { id: 'windy', label: 'Windy', warning: 'Storm code reported, no active rain' };
    if (Number(weather?.cloud ?? 0) >= 35) return { id: 'cloudy', label: night ? 'Cloudy night' : 'Cloudy', warning: 'Storm code reported, no active rain' };
    return { id: night ? 'clear-night' : 'clear', label: night ? 'Clear night' : 'Clear', warning: 'Storm code reported, no active rain' };
  }
  if (condition.tone === 'rain') {
    if (activeWetWeather) return { id: 'rain', label: condition.label, warning: 'Rain ambience ready' };
    return {
      id: Number(weather?.cloud ?? 0) >= 35 ? 'cloudy' : 'partly-cloudy',
      label: Number(weather?.cloud ?? 0) >= 35 ? (night ? 'Cloudy night' : 'Cloudy') : (night ? 'Partly cloudy night' : 'Partly cloudy'),
      warning: 'Rain code reported, no active rain'
    };
  }
  if (windy) return { id: 'windy', label: 'Windy', warning: 'Dust risk if visibility drops' };
  if (condition.tone.includes('partly')) return { id: 'partly-cloudy', label: condition.label, warning: '' };
  if (weather.feels >= 38) return { id: 'hot', label: 'UAE heat', warning: 'High heat index - hydrate' };
  if (weather.humidity >= 70) return { id: 'humid', label: 'Humid air', warning: 'Humidity is high tonight' };
  if (condition.tone === 'cloud') return { id: 'cloudy', label: condition.label, warning: '' };
  return { id: night ? 'clear-night' : 'clear', label: condition.label, warning: '' };
}

function getWeatherBackgroundSelection(weather, now = new Date()) {
  const night = isNightAt(now, weather?.sunrise, weather?.sunset);
  const condition = weatherCondition(weather?.code, night);
  const activeWetWeather = Number(weather?.precipitation ?? 0) >= 0.2 || Number(weather?.rain ?? 0) >= 70;
  const stale = !weather?.lastUpdated || Date.now() - Number(weather.lastUpdated) > 45 * 60 * 1000;
  if (stale || !weather?.loaded) return night ? 'time fallback: moon and stars' : `time fallback: ${getAmbientPhase(now, weather).label}`;
  if (night && condition.tone === 'rain' && activeWetWeather) return 'rainy night, moon faint';
  if (night && condition.tone === 'storm' && activeWetWeather) return 'storm night, moon hidden';
  if (night && ['rain', 'storm'].includes(condition.tone)) return 'storm/rain nearby, no active precipitation';
  if (night && condition.tone.includes('partly')) return 'partly cloudy moon';
  if (night && condition.tone === 'cloud') return 'cloudy moon';
  if (night) return 'clear night with real moon phase';
  if (condition.tone === 'rain' && activeWetWeather) return 'animated rainy day';
  if (condition.tone === 'storm' && activeWetWeather) return 'animated thunder day';
  if (['rain', 'storm'].includes(condition.tone)) return `${getAmbientPhase(now, weather).label} sun state / storm nearby`;
  if (condition.tone.includes('partly')) return 'sun with moving clouds';
  if (condition.tone === 'cloud') return 'animated cloud day';
  if (Number(weather?.wind) >= 28) return 'windy animated day';
  return `${getAmbientPhase(now, weather).label} sun state`;
}

function classNameFromLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getSkyVisualState(weather, now = new Date()) {
  const night = isNightAt(now, weather?.sunrise, weather?.sunset);
  const condition = weatherCondition(weather?.code, night);
  const windy = Number(weather?.wind) >= 28;
  const activeWetWeather = Number(weather?.precipitation ?? 0) >= 0.2 || Number(weather?.rain ?? 0) >= 70;
  if (condition.tone === 'storm' && activeWetWeather) return windy ? 'storm-wind' : 'storm';
  if (condition.tone === 'rain' && activeWetWeather) return night ? 'rain-night' : 'rain';
  if (['rain', 'storm'].includes(condition.tone) && !activeWetWeather) {
    if (Number(weather?.cloud ?? 0) >= 35) return night ? 'cloud-night' : 'cloudy';
    return windy ? (night ? 'wind-night' : 'windy') : (night ? 'partly-night' : 'partly-cloudy');
  }
  if (condition.tone.includes('partly')) return night ? 'partly-night' : 'partly-cloudy';
  if (condition.tone === 'cloud') return night ? 'cloud-night' : 'cloudy';
  if (windy) return night ? 'wind-night' : 'windy';
  return night ? 'clear-night' : 'clear-day';
}

function forceDaySkyState(state) {
  const map = {
    'clear-night': 'clear-day',
    'partly-night': 'partly-cloudy',
    'cloud-night': 'cloudy',
    'rain-night': 'rain',
    'wind-night': 'windy'
  };
  return map[state] || state;
}

function getCelestialLabel({ night, moon, weatherMood, ambientPhase }) {
  if (night) {
    if (weatherMood?.id === 'rain') return 'Rainy night / moon faint';
    if (weatherMood?.id === 'storm' || weatherMood?.id === 'storm-wind') return 'Storm night / moon hidden';
    if (weatherMood?.id === 'cloudy') return 'Cloudy moon';
    if (weatherMood?.id === 'partly-cloudy') return `Partly cloudy ${moon?.phase || 'moon'}`;
    return moon?.phase || 'Moon phase';
  }
  if (weatherMood?.id === 'rain') return 'Rainy sun';
  if (weatherMood?.id === 'storm' || weatherMood?.id === 'storm-wind') return 'Thunder sky';
  if (weatherMood?.id === 'cloudy') return 'Cloud-covered sun';
  if (weatherMood?.id === 'partly-cloudy') return 'Partly cloudy sun';
  if (weatherMood?.id === 'windy') return 'Windy sun';
  return ambientPhase?.label || 'Sun state';
}

function normalizeAssistantText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findAssistantTimeZone(command) {
  const text = ` ${normalizeAssistantText(command)} `;
  return ASSISTANT_TIME_ZONES.find((item) => {
    const terms = [item.city, ...(item.names || [])].map(normalizeAssistantText).filter(Boolean);
    return terms.some((term) => text.includes(` ${term} `));
  });
}

function isAssistantTimeQuestion(command) {
  const text = normalizeAssistantText(command);
  if (/\b(timer|countdown|stopwatch)\b/.test(text)) return false;
  return /\b(time|clock|hour)\b/.test(text);
}

function isAssistantWeatherQuestion(command) {
  return /\b(weather|temperature|temp|rain|raining|cloud|cloudy|humid|humidity|wind|forecast)\b/.test(normalizeAssistantText(command));
}

function parseSpokenTime(command) {
  const text = normalizeAssistantText(command);
  const match = text.match(/\b(\d{1,2})(?::|\s+)?(\d{2})?\s*(am|pm)?\b/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return `${pad(hours)}:${pad(minutes)}`;
}

function formatAssistantWeather(weather, locationSettings, now) {
  const place = weather?.locationName || locationSettings?.weatherName || 'your weather location';
  const night = isNightAt(now, weather?.sunrise, weather?.sunset);
  const condition = weatherCondition(weather?.code, night).label;
  const parts = [`${condition} in ${place}`];
  if (Number.isFinite(Number(weather?.temp))) parts.push(`${weather.temp}C`);
  if (Number.isFinite(Number(weather?.feels))) parts.push(`feels like ${weather.feels}C`);
  if (Number.isFinite(Number(weather?.humidity))) parts.push(`${weather.humidity}% humidity`);
  if (Number.isFinite(Number(weather?.wind))) parts.push(`${weather.wind} km/h wind ${windDirectionLabel(weather.windDirection)}`);
  if (Number.isFinite(Number(weather?.uv))) parts.push(`UV ${weather.uv}`);
  return parts.join(', ');
}

function buildAssistantLivePrompt(command, { assistantSettings, locationSettings, weather, now, timeFormat, browserLocation }) {
  const assistantName = assistantSettings?.assistantName || 'Nexora';
  const userNames = assistantNames(assistantSettings || {}).join(', ') || 'Saeed, Sa3doon';
  const clockCity = locationSettings?.clockCity || 'Dubai';
  const clockTimezone = locationSettings?.clockTimezone || 'Asia/Dubai';
  const weatherPlace = locationSettings?.weatherName || weather?.locationName || 'Ajman';
  const weatherTimezone = locationSettings?.weatherTimezone || clockTimezone;
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || clockTimezone;
  const currentClockTime = formatTimeZone(now, clockTimezone, timeFormat, { seconds: true });
  const currentDeviceTime = formatTimeZone(now, deviceTimezone, timeFormat, { seconds: true });
  const currentWeatherTime = formatTimeZone(now, weatherTimezone, timeFormat, { seconds: false });
  const weatherLine = formatAssistantWeather(weather, locationSettings, now);
  const liveLocationLine = browserLocation
    ? `${browserLocation.lat.toFixed(5)}, ${browserLocation.lon.toFixed(5)} with about ${Math.round(browserLocation.accuracy || 0)}m accuracy`
    : 'not available from browser permission; use configured kiosk/weather location';

  return [
    `You are ${assistantName}, a local bedroom kiosk assistant.`,
    `The user names are: ${userNames}. Use one name naturally when helpful.`,
    'Use the live context below. Do not invent live weather, time, or location data that is not provided.',
    '',
    'Live kiosk context:',
    `- Browser live location: ${liveLocationLine}`,
    `- Device/browser timezone: ${deviceTimezone}`,
    `- Device/browser time now: ${currentDeviceTime}`,
    `- Clock location: ${clockCity} (${clockTimezone})`,
    `- Clock time now: ${currentClockTime}`,
    `- Weather location: ${weatherPlace} (${weatherTimezone})`,
    `- Weather time now: ${currentWeatherTime}`,
    `- Live weather: ${weatherLine}`,
    `- Weather feed status: ${weather?.loaded ? 'live Open-Meteo data' : 'cached fallback data'}`,
    '',
    'User request:',
    command,
    '',
    'Answer briefly and clearly. If the user asks for another country time and it is not in the provided context, answer from your timezone knowledge and mention the city/timezone you used.'
  ].join('\n');
}

function readBrowserLocation(maxWaitMs = 2500) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, maxWaitMs);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: maxWaitMs }
    );
  });
}

function playSoftChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, context.currentTime);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.62);
    filter.connect(gain);
    gain.connect(context.destination);
    [523.25, 659.25, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.08);
      oscillator.connect(filter);
      oscillator.start(context.currentTime + index * 0.08);
      oscillator.stop(context.currentTime + 0.44 + index * 0.08);
    });
    window.setTimeout(() => context.close(), 850);
  } catch {
    // Audio can be blocked until the first user gesture.
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
}

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatUndoTimeLeft(deletedAt) {
  const remaining = Math.max(0, WIDGET_UNDO_WINDOW_MS - (Date.now() - deletedAt));
  const minutes = Math.ceil(remaining / 60000);
  return `${minutes}m left`;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekdayLabel(date) {
  return date.toLocaleDateString('en-AE', { weekday: 'short' });
}

function shortDateLabel(date) {
  return date.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' });
}

function getMoonPhase(date) {
  const synodicMonth = 29.530588853;
  const illuminationData = SunCalc.getMoonIllumination(date);
  const phaseValue = ((illuminationData.phase % 1) + 1) % 1;
  const age = phaseValue * synodicMonth;
  const illumination = Math.round(Math.max(0, Math.min(1, illuminationData.fraction)) * 100);
  const phases = [
    { min: 0.96875, max: 1, name: 'New Moon' },
    { min: 0, max: 0.03125, name: 'New Moon' },
    { min: 0.03125, max: 0.21875, name: 'Waxing Crescent' },
    { min: 0.21875, max: 0.28125, name: 'First Quarter' },
    { min: 0.28125, max: 0.46875, name: 'Waxing Gibbous' },
    { min: 0.46875, max: 0.53125, name: 'Full Moon' },
    { min: 0.53125, max: 0.71875, name: 'Waning Gibbous' },
    { min: 0.71875, max: 0.78125, name: 'Last Quarter' },
    { min: 0.78125, max: 0.96875, name: 'Waning Crescent' }
  ];
  const phase = phases.find((item) => phaseValue >= item.min && phaseValue < item.max)?.name || 'New Moon';
  let daysToFull = ((0.5 - phaseValue + 1) % 1) * synodicMonth;
  if (daysToFull < 0.2) daysToFull += synodicMonth;
  const nextFullMoon = new Date(date.getTime() + daysToFull * 86400000);
  return {
    phase,
    age: age.toFixed(1),
    illumination,
    nextFullMoon,
    phaseValue,
    angle: illuminationData.angle
  };
}

function getMoonTimes(date, location = DEFAULT_LOCATION_SETTINGS) {
  const safeLocation = sanitizeLocationSettings(location);
  const times = SunCalc.getMoonTimes(date, safeLocation.weatherLat, safeLocation.weatherLon);
  return {
    rise: times.rise || null,
    set: times.set || null
  };
}

function nextPrayer(now) {
  const today = getPrayerTimes(now);
  const upcoming = today.find((item) => item.time > now);
  const target = upcoming || getPrayerTimes(new Date(now.getTime() + 86400000))[0];
  const diff = Math.max(0, target.time - now);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return { ...target, countdown: `${hours}h ${pad(minutes)}m`, minutesLeft: Math.ceil(diff / 60000) };
}

function defaultTodoLists() {
  return {
    morning: [
      { id: 1, text: 'Water bottle ready', done: false },
      { id: 2, text: 'Charge phone', done: true },
      { id: 3, text: 'Set morning alarm', done: false }
    ],
    night: [
      { id: 4, text: 'Set room to red mode', done: false },
      { id: 5, text: 'Plug in laptop', done: false }
    ],
    general: []
  };
}

function normalizeTodoLists(saved) {
  if (Array.isArray(saved)) {
    return { ...defaultTodoLists(), morning: saved };
  }

  const defaults = defaultTodoLists();
  return TODO_TYPES.reduce((lists, type) => {
    lists[type.id] = Array.isArray(saved?.[type.id]) ? saved[type.id] : defaults[type.id];
    return lists;
  }, {});
}

function useTodoLists() {
  const [todoLists, setTodoLists] = useState(() => {
    try {
      return normalizeTodoLists(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return defaultTodoLists();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todoLists));
  }, [todoLists]);

  return [todoLists, setTodoLists];
}

function defaultCustomWidgets() {
  return [
    {
      id: 1,
      title: 'Room reminder',
      value: 'Water and charger',
      detail: 'Tap settings to replace this',
      type: 'note',
      accent: 'green',
      placement: 'weather',
      order: 1000
    },
    {
      id: 2,
      title: 'Sleep target',
      value: '23:30',
      detail: 'Personal bedtime',
      type: 'number',
      accent: 'blue',
      placement: 'sleep',
      order: 1000
    }
  ];
}

function normalizeWidget(widget, index = 0) {
  return {
    id: widget?.id || Date.now() + index,
    title: String(widget?.title || 'Custom widget').slice(0, 42),
    value: String(widget?.value || '--').slice(0, 64),
    detail: String(widget?.detail || '').slice(0, 80),
    type: WIDGET_TYPES.some((type) => type.id === widget?.type) ? widget.type : 'note',
    accent: WIDGET_ACCENTS.includes(widget?.accent) ? widget.accent : 'green',
    placement: typeof widget?.placement === 'string' && widget.placement.trim() ? widget.placement : 'weather',
    order: Number.isFinite(Number(widget?.order)) ? Number(widget.order) : (Date.now() + index),
    locked: Boolean(widget?.locked)
  };
}

function normalizeSection(section, index = 0) {
  const fallbackTitle = `Section ${index + 1}`;
  const title = String(section?.title || fallbackTitle).trim().slice(0, 32) || fallbackTitle;
  const id = String(section?.id || `section-${Date.now()}-${index}`).replace(/[^a-zA-Z0-9_-]/g, '-');
  return {
    id,
    title,
    detail: String(section?.detail || 'Custom dashboard section').trim().slice(0, 80),
    order: Number.isFinite(Number(section?.order)) ? Number(section.order) : (Date.now() + index)
  };
}

function useCustomSections() {
  const [sections, setSections] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_SECTIONS_KEY));
      return Array.isArray(saved) ? saved.map(normalizeSection) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CUSTOM_SECTIONS_KEY, JSON.stringify(sections));
  }, [sections]);

  return [sections, setSections];
}

function normalizeDashboardLayout(order, sections) {
  const available = sections.map((section) => section.id);
  const availableSet = new Set(available);
  const base = (Array.isArray(order) && order.length ? order.map(String) : DEFAULT_DASHBOARD_ORDER)
    .flatMap((id) => {
      const mapped = DASHBOARD_PLACEMENT_ALIASES[id] || id;
      if (availableSet.has(mapped)) return [mapped];
      return LEGACY_DASHBOARD_SECTION_EXPANSIONS[mapped] || [mapped];
    });
  const seen = new Set();
  const clean = [];

  base.forEach((id) => {
    if (available.includes(id) && !seen.has(id)) {
      seen.add(id);
      clean.push(id);
    }
  });
  available.forEach((id) => {
    if (!seen.has(id)) clean.push(id);
  });

  return clean;
}

function useDashboardLayout(sections) {
  const sectionKey = sections.map((section) => section.id).join('|');
  const [order, setOrder] = useState(() => {
    try {
      return normalizeDashboardLayout(JSON.parse(localStorage.getItem(DASHBOARD_LAYOUT_KEY)), sections);
    } catch {
      return normalizeDashboardLayout(null, sections);
    }
  });

  useEffect(() => {
    setOrder((current) => normalizeDashboardLayout(current, sections));
  }, [sectionKey]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(order));
  }, [order]);

  return [order, setOrder];
}

function widgetTemplate(typeId, placement = 'weather') {
  const templates = {
    note: { title: 'New note', value: 'Write something', detail: 'Custom reminder', type: 'note', accent: 'green' },
    number: { title: 'Counter', value: '0', detail: 'Your number', type: 'number', accent: 'blue' },
    meter: { title: 'Progress', value: '50', detail: '0 to 100 meter', type: 'meter', accent: 'amber' },
    link: { title: 'Quick link', value: 'https://example.com', detail: 'Tap to open', type: 'link', accent: 'green' }
  };
  return normalizeWidget({ ...templates[typeId], id: Date.now(), placement });
}

function widgetPlacement(widget) {
  const placement = typeof widget?.placement === 'string' && widget.placement.trim() ? widget.placement : 'weather';
  return DASHBOARD_PLACEMENT_ALIASES[placement] || placement;
}

function orderedPlacementWidgets(widgets, placement) {
  return widgets
    .filter((widget) => widgetPlacement(widget) === placement)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function placeWidgetInDashboard(currentWidgets, widget, placement, insertIndex = Infinity) {
  const normalized = normalizeWidget({ ...widget, placement });
  const movingId = String(normalized.id);
  const currentTarget = orderedPlacementWidgets(currentWidgets, placement);
  const oldIndex = currentTarget.findIndex((item) => String(item.id) === movingId);
  const withoutMoving = currentWidgets.filter((item) => String(item.id) !== movingId).map(normalizeWidget);
  const target = orderedPlacementWidgets(withoutMoving, placement);
  let nextIndex = Number.isFinite(insertIndex) ? insertIndex : target.length;
  if (oldIndex >= 0 && oldIndex < nextIndex) nextIndex -= 1;
  nextIndex = Math.max(0, Math.min(nextIndex, target.length));
  target.splice(nextIndex, 0, { ...normalized, placement });
  const reorderedTarget = target.map((item, index) => ({ ...item, placement, order: (index + 1) * 1000 }));
  return [
    ...withoutMoving.filter((item) => widgetPlacement(item) !== placement),
    ...reorderedTarget
  ];
}

function useCustomWidgets() {
  const [widgets, setWidgets] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_WIDGETS_KEY));
      return Array.isArray(saved) ? saved.map(normalizeWidget) : defaultCustomWidgets();
    } catch {
      return defaultCustomWidgets();
    }
  });

  useEffect(() => {
    localStorage.setItem(CUSTOM_WIDGETS_KEY, JSON.stringify(widgets));
  }, [widgets]);

  return [widgets, setWidgets];
}

function pruneDeletedWidgets(widgets) {
  const cutoff = Date.now() - WIDGET_UNDO_WINDOW_MS;
  return widgets.filter((widget) => widget.deletedAt >= cutoff);
}

function useDeletedWidgets() {
  const [deletedWidgets, setDeletedWidgets] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DELETED_WIDGETS_KEY));
      return Array.isArray(saved) ? pruneDeletedWidgets(saved.map((widget) => ({ ...normalizeWidget(widget), deletedAt: widget.deletedAt || Date.now() }))) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const pruned = pruneDeletedWidgets(deletedWidgets);
    if (pruned.length !== deletedWidgets.length) {
      setDeletedWidgets(pruned);
      return;
    }
    localStorage.setItem(DELETED_WIDGETS_KEY, JSON.stringify(pruned));
  }, [deletedWidgets]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDeletedWidgets((current) => pruneDeletedWidgets(current));
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  return [deletedWidgets, setDeletedWidgets];
}

function defaultWorldClocks() {
  return [
    { city: 'Dubai', zone: 'Asia/Dubai' },
    { city: 'China', zone: 'Asia/Shanghai' },
    { city: 'London', zone: 'Europe/London' },
    { city: 'New York', zone: 'America/New_York' }
  ];
}

function normalizeWorldClock(clock) {
  return {
    city: String(clock?.city || 'City').slice(0, 32),
    zone: String(clock?.zone || clock?.timezone || 'Asia/Dubai').slice(0, 64)
  };
}

function useWorldClocks() {
  const [worldClocks, setWorldClocksState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WORLD_CLOCK_KEY));
      return Array.isArray(saved) && saved.length ? saved.map(normalizeWorldClock) : defaultWorldClocks();
    } catch {
      return defaultWorldClocks();
    }
  });

  function setWorldClocks(nextValue) {
    setWorldClocksState((current) => {
      const next = typeof nextValue === 'function' ? nextValue(current) : nextValue;
      const clean = Array.isArray(next) && next.length ? next.map(normalizeWorldClock).slice(0, 16) : defaultWorldClocks();
      localStorage.setItem(WORLD_CLOCK_KEY, JSON.stringify(clean));
      return clean;
    });
  }

  return [worldClocks, setWorldClocks];
}

function useTimeDeckAlarms(mainAlarm, setMainAlarm) {
  const [alarms, setAlarms] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TIME_DECK_ALARMS_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {
      // Fall back below.
    }
    return [{ id: 1, time: mainAlarm || '06:30', enabled: true, repeat: 'daily', sound: 'Soft chime' }];
  });

  useEffect(() => {
    localStorage.setItem(TIME_DECK_ALARMS_KEY, JSON.stringify(alarms.slice(0, 20)));
  }, [alarms]);

  function addAlarm(time, repeat = 'daily', sound = 'Soft chime', soundUrl = '') {
    const cleanTime = /^\d{2}:\d{2}$/.test(time) ? time : mainAlarm || '06:30';
    const nextAlarm = { id: Date.now(), time: cleanTime, enabled: true, repeat, sound, soundUrl };
    setAlarms((current) => [nextAlarm, ...current].slice(0, 20));
    setMainAlarm(cleanTime);
  }

  function toggleAlarm(id) {
    setAlarms((current) => current.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item));
  }

  function deleteAlarm(id) {
    setAlarms((current) => current.filter((item) => item.id !== id));
  }

  function deleteAllAlarms() {
    setAlarms([]);
  }

  return { alarms, addAlarm, toggleAlarm, deleteAlarm, deleteAllAlarms };
}

function secondsProgress(now) {
  return ((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * 100;
}

function ChronoHub({ now, mode, timeFormat, alarm, setManualMode, blackout, setBlackout, ambientPhase, weatherMood, weather, locationSettings, sleepMode, idle, goTimeDesk, goDashboard, goSettings }) {
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const tapSwipeRef = useRef(null);
  const modes = ['white', 'slate', 'night'];
  const rawClockIsNight = isNightAt(now, weather?.sunrise, weather?.sunset);
  const forceDayOrb = ['sunrise', 'sunset'].includes(ambientPhase?.id);
  const clockIsNight = rawClockIsNight && !forceDayOrb;
  const moon = useMemo(() => getMoonPhase(now), [now.toDateString()]);
  const moonPhaseClass = moon.phase.toLowerCase().replace(/\s+/g, '-');
  const celestialLabel = getCelestialLabel({ night: clockIsNight, moon, weatherMood, ambientPhase });

  useEffect(() => {
    const timer = setInterval(() => {
      setShift({
        x: Math.round((Math.random() - 0.5) * 12),
        y: Math.round((Math.random() - 0.5) * 12)
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  function startTapSwipe(event) {
    if (event.target?.closest?.('.chrono-footer')) return;
    const point = event.touches?.[0] || event.changedTouches?.[0] || event;
    const node = event.currentTarget || event.target?.closest?.('.chrono');
    if (node?.dataset) {
      node.dataset.swipeX = String(point.clientX);
      node.dataset.swipeY = String(point.clientY);
    }
    tapSwipeRef.current = { x: point.clientX, y: point.clientY };
  }

  function endTapSwipe(event) {
    const node = event.currentTarget || event.target?.closest?.('.chrono');
    const storedX = Number(node?.dataset?.swipeX);
    const storedY = Number(node?.dataset?.swipeY);
    const start = Number.isFinite(storedX) && Number.isFinite(storedY)
      ? { x: storedX, y: storedY }
      : tapSwipeRef.current;
    tapSwipeRef.current = null;
    if (node?.dataset) {
      delete node.dataset.swipeX;
      delete node.dataset.swipeY;
    }
    if (!start) return;
    const point = event.changedTouches?.[0] || event.touches?.[0] || event;
    const deltaX = point.clientX - start.x;
    const deltaY = point.clientY - start.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (Math.abs(deltaX) >= 80 && Math.abs(deltaX) >= Math.abs(deltaY) * 1.15) return;
    if (distance <= 16) {
      const zone = Math.min(modes.length - 1, Math.max(0, Math.floor((point.clientX / window.innerWidth) * modes.length)));
      setManualMode(modes[zone]);
    }
  }

  const time = locationSettings?.clockTimezone
    ? formatTimeZone(now, locationSettings.clockTimezone, timeFormat, { seconds: false })
    : formatClockTime(now, timeFormat);
  const date = formatDateForZone(now, locationSettings?.clockTimezone);

  if (blackout) {
    return (
      <button className="blackout" onDoubleClick={() => setBlackout(false)} aria-label="Disable blackout">
        <span />
      </button>
    );
  }

  return (
    <section
      className={`chrono ${mode} phase-${ambientPhase.id} weather-${weatherMood.id} ${clockIsNight ? 'astro-night' : 'astro-day'} moon-${moonPhaseClass} ${sleepMode ? 'sleep-mode' : ''} ${idle ? 'ambient-idle' : ''}`}
      onPointerDown={startTapSwipe}
      onPointerUp={endTapSwipe}
      onPointerCancel={() => { tapSwipeRef.current = null; }}
      onMouseDown={startTapSwipe}
      onMouseUp={endTapSwipe}
      onTouchStart={startTapSwipe}
      onTouchEnd={endTapSwipe}
    >
      <div className="chrono-depth chrono-sky">
        <CelestialScene now={now} weather={weather} weatherMood={weatherMood} ambientPhase={ambientPhase} moon={moon} />
      </div>
      <div className="chrono-depth chrono-particles" aria-hidden="true" />
      <div className="chrono-depth chrono-glow" aria-hidden="true" />
      <div className="seconds-ring" style={{ '--progress': `${secondsProgress(now)}%` }} />
      <div className="tap-zones" aria-hidden="true">
        {modes.map((item) => <span key={item} />)}
      </div>
      <motion.div
        className="chrono-content"
        animate={{ x: shift.x, y: shift.y }}
        transition={{ type: 'spring', stiffness: 18, damping: 12 }}
        onDoubleClick={() => setBlackout(true)}
      >
        <div className={`chrono-time ${timeFormat === 'both' ? 'dual-time' : ''}`}>{time}</div>
        <div className="chrono-seconds">{pad(now.getSeconds())}</div>
        <div className="chrono-date">{date}</div>
      </motion.div>
      <div className="chrono-footer">
        <button type="button" className="chrono-alarm-link" onPointerDown={(event) => { event.stopPropagation(); goTimeDesk(); }} onClick={goTimeDesk} aria-label="Open timers and alarm">
          <ChevronLeft size={18} />
          <AlarmClock size={18} />
          <span>{formatAlarmLabel(alarm, timeFormat)}</span>
        </button>
        <div className="chrono-status"><WeatherSymbol code={weather?.code} night={clockIsNight} size={18} /> {locationSettings?.clockCity || 'Device'} time / {weather?.locationName || 'Ajman'} {weatherMood.label} / {celestialLabel}</div>
        <div className="footer-actions">
          <button type="button" onPointerDown={(event) => { event.stopPropagation(); goSettings(); }} onClick={goSettings} aria-label="Open tools"><Settings size={20} /></button>
          <button type="button" onPointerDown={(event) => { event.stopPropagation(); goDashboard(); }} onClick={goDashboard} aria-label="Dashboard"><span>Dashboard</span><ChevronRight size={22} /></button>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, unit, tone = 'green' }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}<span>{unit}</span></strong>
      </div>
    </div>
  );
}

function WeatherSymbol({ code, night = false, size = 28 }) {
  const { label, Icon, tone } = weatherCondition(code, night);
  return (
    <span className={`weather-symbol ${tone}`} aria-label={label} title={label}>
      <Icon size={size} />
    </span>
  );
}

function CelestialScene({ now, weather, weatherMood, ambientPhase, moon }) {
  const rawNight = isNightAt(now, weather?.sunrise, weather?.sunset);
  const forceDayOrb = ['sunrise', 'sunset'].includes(ambientPhase?.id);
  const night = rawNight && !forceDayOrb;
  const skyState = forceDayOrb ? forceDaySkyState(getSkyVisualState(weather, now)) : getSkyVisualState(weather, now);
  const phaseClass = classNameFromLabel(moon?.phase);
  const moonLightClass = moon?.illumination >= 95 ? 'moon-bright' : moon?.illumination <= 8 ? 'moon-dark' : '';
  const label = getCelestialLabel({ night, moon, weatherMood, ambientPhase });
  const showClouds = ['cloudy', 'partly-cloudy', 'rain', 'storm', 'storm-wind', 'cloud-night', 'partly-night', 'rain-night', 'windy', 'wind-night'].includes(skyState);
  const showRain = ['rain', 'rain-night', 'storm', 'storm-wind'].includes(skyState);
  const showLightning = ['storm', 'storm-wind'].includes(skyState);

  return (
    <div
      className={`celestial-live ${night ? 'night' : 'day'} sky-${skyState} moon-${phaseClass}`}
      style={{ '--moon-lit': `${moon?.illumination ?? 0}%` }}
      aria-label={label}
      title={label}
    >
      <div className={`celestial-orb ${night ? 'moon' : 'sun'} phase-${phaseClass} ${moonLightClass}`}>
        {night ? (
          <>
            <span className="moon-base" />
            <span className="moon-mare mare-one" />
            <span className="moon-mare mare-two" />
            <span className="moon-mare mare-three" />
            <span className="moon-mare mare-four" />
            <span className="moon-shadow" />
            <span className="moon-crater crater-one" />
            <span className="moon-crater crater-two" />
            <span className="moon-crater crater-three" />
            <span className="moon-crater crater-four" />
            <span className="moon-crater crater-five" />
            <span className="moon-crater crater-six" />
            <span className="moon-crater crater-seven" />
            <span className="moon-rim" />
          </>
        ) : (
          <>
            <span className="sun-halo" />
            <span className="sun-ray ray-one" />
            <span className="sun-ray ray-two" />
            <span className="sun-ray ray-three" />
            <span className="sun-ray ray-four" />
            <span className="sun-core" />
            <span className="sun-texture" />
            <span className="sun-spot spot-one" />
            <span className="sun-spot spot-two" />
            <span className="sun-spot spot-three" />
            <span className="sun-shine" />
          </>
        )}
      </div>
      {showClouds && (
        <div className="celestial-clouds" aria-hidden="true">
          <span className="cloud-one" />
          <span className="cloud-two" />
          <span className="cloud-three" />
        </div>
      )}
      {showRain && <div className="celestial-rain" aria-hidden="true" />}
      {showLightning && <div className="celestial-lightning" aria-hidden="true" />}
      <em>{label}</em>
    </div>
  );
}

function MoonPhoto({ moon }) {
  const phaseClass = moon.phase.toLowerCase().replace(/\s+/g, '-');
  const moonLightClass = moon.illumination >= 95 ? 'moon-bright' : moon.illumination <= 8 ? 'moon-dark' : '';
  return (
    <div className={`moon-photo phase-${phaseClass} ${moonLightClass}`} style={{ '--lit': `${moon.illumination}%` }} aria-label={`${moon.phase}, ${moon.illumination}% lit`}>
      <span className="moon-photo-base" />
      <span className="moon-photo-mare mare-one" />
      <span className="moon-photo-mare mare-two" />
      <span className="moon-photo-mare mare-three" />
      <span className="moon-photo-shadow" />
      <span className="moon-photo-crater crater-one" />
      <span className="moon-photo-crater crater-two" />
      <span className="moon-photo-crater crater-three" />
      <span className="moon-photo-crater crater-four" />
      <span className="moon-photo-crater crater-five" />
      <span className="moon-photo-rim" />
    </div>
  );
}

function WelcomeExperience({ mode, mood = 'space', now, timeFormat, assistantSettings, locationSettings, videoIntroLibrary, performanceMode = 'balanced', onDismiss }) {
  const canvasRef = useRef(null);
  const customIntro = videoIntroLibrary?.videos?.[0] || null;
  const useWebglIntro = performanceMode === 'full' && !customIntro?.url;
  const statusItems = [
    ['Weather', 'live'],
    ['Prayer', 'synced'],
    ['Gold', 'ready']
  ];

  useEffect(() => {
    if (!useWebglIntro) return undefined;
    let disposed = false;
    let cleanupScene = () => {};

    import('three').then((THREE) => {
      if (disposed || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const performanceLite = performanceMode !== 'full' || (navigator.hardwareConcurrency || 4) <= 4 || window.matchMedia?.('(max-width: 760px)').matches;
      const targetFrameMs = performanceMode === 'full' ? 16 : performanceMode === 'lite' ? 66 : 42;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
    camera.position.set(0, 0, 6.8);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !performanceLite, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, performanceLite ? 1 : 1.35));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const moodPalette = {
      hacker: [0x22c55e, 0x86efac],
      natural: [0x34d399, 0xf4c95d],
      calm: [0x7dd3fc, 0xbae6fd],
      space: [0x8b5cf6, 0x7dd3fc],
      storm: [0xff3030, 0xf4c95d]
    }[mood] || [0x86efac, 0xb8f7c8];
    const accent = mode === 'night' ? 0xff1717 : mode === 'white' ? moodPalette[0] : 0x86efac;
    const softAccent = mode === 'night' ? 0xff4b4b : mode === 'white' ? moodPalette[1] : 0xb8f7c8;
    const group = new THREE.Group();
    const tickGroup = new THREE.Group();
    const satelliteGroup = new THREE.Group();
    scene.add(group);
    group.add(tickGroup, satelliteGroup);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.PointLight(softAccent, 3.2, 18);
    key.position.set(2.8, 3.2, 4);
    const rim = new THREE.PointLight(0xffffff, 1.4, 14);
    rim.position.set(-4, -2, 3);
    const pulse = new THREE.PointLight(accent, 3.4, 16);
    pulse.position.set(0, 0, 3.4);
    scene.add(ambient, key, rim, pulse);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, performanceLite ? 2 : 3),
      new THREE.MeshStandardMaterial({
        color: mode === 'night' ? 0x240404 : 0x111a16,
        emissive: accent,
        emissiveIntensity: mode === 'night' ? 0.38 : 0.18,
        metalness: 0.25,
        roughness: 0.36
      })
    );
    group.add(core);

    const inner = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.72, 0.032, performanceLite ? 88 : 128, 10, 2, 5),
      new THREE.MeshStandardMaterial({
        color: softAccent,
        emissive: accent,
        emissiveIntensity: 0.95,
        metalness: 0.58,
        roughness: 0.2
      })
    );
    group.add(inner);

    const glassShell = new THREE.Mesh(
      new THREE.SphereGeometry(1.42, performanceLite ? 32 : 44, performanceLite ? 16 : 22),
      new THREE.MeshBasicMaterial({
        color: softAccent,
        transparent: true,
        opacity: mode === 'night' ? 0.07 : 0.1,
        wireframe: true
      })
    );
    group.add(glassShell);

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.8,
      metalness: 0.55,
      roughness: 0.2
    });

    const rings = [
      new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.018, 14, performanceLite ? 72 : 96), ringMaterial),
      new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.012, 14, performanceLite ? 72 : 96), ringMaterial),
      new THREE.Mesh(new THREE.TorusGeometry(2.56, 0.01, 14, performanceLite ? 72 : 96), ringMaterial),
      new THREE.Mesh(
        new THREE.TorusGeometry(3.08, 0.006, 10, performanceLite ? 90 : 128),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: mode === 'night' ? 0.18 : 0.28 })
      )
    ];
    rings[0].rotation.x = Math.PI / 2.65;
    rings[1].rotation.y = Math.PI / 2.35;
    rings[2].rotation.x = Math.PI / 2;
    rings[2].rotation.y = Math.PI / 5.5;
    rings[3].rotation.x = Math.PI / 1.85;
    rings.forEach((ring) => group.add(ring));

    const tickGeometry = new THREE.BoxGeometry(0.018, 0.2, 0.018);
    const tickMaterial = new THREE.MeshBasicMaterial({ color: softAccent, transparent: true, opacity: 0.52 });
    const tickCount = performanceLite ? 28 : 36;
    for (let index = 0; index < tickCount; index += 1) {
      const tick = new THREE.Mesh(tickGeometry, tickMaterial);
      const angle = (index / tickCount) * Math.PI * 2;
      const radius = index % 4 === 0 ? 3.03 : 2.88;
      tick.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      tick.rotation.z = angle;
      tick.scale.y = index % 4 === 0 ? 1.25 : 0.58;
      tickGroup.add(tick);
    }

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, performanceLite ? 20 : 28, performanceLite ? 16 : 22),
      new THREE.MeshStandardMaterial({
        color: 0xf5f1e8,
        emissive: 0x302a23,
        metalness: 0.02,
        roughness: 0.78
      })
    );
    moon.position.set(2.4, 0, 0);
    group.add(moon);

    const gold = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, performanceLite ? 16 : 22, performanceLite ? 12 : 18),
      new THREE.MeshStandardMaterial({
        color: 0xf4c95d,
        emissive: 0x8a5a05,
        emissiveIntensity: 0.55,
        metalness: 0.8,
        roughness: 0.18
      })
    );
    gold.position.set(-2.18, 0.4, 0.35);
    group.add(gold);

    const weatherOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, performanceLite ? 16 : 22, performanceLite ? 12 : 18),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.62,
        metalness: 0.08,
        roughness: 0.34
      })
    );
    weatherOrb.position.set(0.1, -2.22, 0.22);
    satelliteGroup.add(moon, gold, weatherOrb);

    const starCount = performanceLite ? 150 : 240;
    const starPositions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.2 + Math.random() * 7.2;
      starPositions[index * 3] = Math.cos(angle) * radius;
      starPositions[index * 3 + 1] = Math.sin(angle) * radius * 0.62;
      starPositions[index * 3 + 2] = -7 + Math.random() * 7.5;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: mode === 'night' ? 0xff4b4b : 0xdfffe8,
        size: 0.025,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      })
    );
    scene.add(stars);

    const pointer = { x: 0, y: 0 };
    function onPointerMove(event) {
      pointer.x = ((event.clientX / window.innerWidth) - 0.5) * 0.38;
      pointer.y = ((event.clientY / window.innerHeight) - 0.5) * 0.28;
    }

    function resize() {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      const compact = width < 640;
      camera.aspect = width / height;
      camera.position.z = compact ? 8.4 : 6.7;
      camera.updateProjectionMatrix();
      group.scale.setScalar(compact ? 0.68 : 0.92);
      group.position.y = compact ? 0.72 : 0.28;
      renderer.setSize(width, height, false);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove);
    resize();

    let frame = 0;
    let lastRender = 0;
    let tickFrame = 0;
    const start = performance.now();
    function animate(time = performance.now()) {
      if (time - lastRender < targetFrameMs) {
        frame = requestAnimationFrame(animate);
        return;
      }
      lastRender = time;
      const elapsed = (time - start) / 1000;
      const intro = Math.min(1, elapsed / 1.35);
      const easeOut = 1 - Math.pow(1 - intro, 3);
      const baseScale = (canvas.clientWidth < 640 ? 0.68 : 0.92) * (0.7 + easeOut * 0.3) * (1 + Math.sin(elapsed * 2.4) * 0.022);
      group.scale.setScalar(baseScale);
      group.rotation.y = elapsed * 0.26 + pointer.x;
      group.rotation.x += (pointer.y - group.rotation.x) * 0.04;
      group.rotation.z = Math.sin(elapsed * 0.8) * 0.045;
      core.rotation.x = elapsed * 0.42;
      core.rotation.y = elapsed * 0.7;
      inner.rotation.x = elapsed * 0.76;
      inner.rotation.y = -elapsed * 0.52;
      glassShell.rotation.y = -elapsed * 0.17;
      rings[0].rotation.z = elapsed * 0.42;
      rings[1].rotation.x = Math.PI / 2.35 + elapsed * 0.32;
      rings[2].rotation.y = Math.PI / 5.5 - elapsed * 0.28;
      rings[3].rotation.z = -elapsed * 0.22;
      tickGroup.rotation.z = elapsed * 0.18;
      tickFrame += 1;
      if (!performanceLite || tickFrame % 4 === 0) {
        tickGroup.children.forEach((tick, index) => {
          tick.material.opacity = 0.24 + Math.sin(elapsed * 3.2 + index * 0.32) * 0.18 + (index % 6 === 0 ? 0.16 : 0);
        });
      }
      moon.position.x = Math.cos(elapsed * 0.74) * 2.4;
      moon.position.z = Math.sin(elapsed * 0.74) * 0.7;
      moon.position.y = Math.sin(elapsed * 1.1) * 0.28;
      gold.position.x = Math.cos(elapsed * 0.9 + 2.4) * 2.18;
      gold.position.y = Math.sin(elapsed * 0.9 + 2.4) * 0.76;
      weatherOrb.position.x = Math.cos(elapsed * 1.1 + 4.8) * 1.74;
      weatherOrb.position.y = Math.sin(elapsed * 1.1 + 4.8) * 1.28;
      pulse.intensity = 3.4 + Math.sin(elapsed * 3) * 1.2;
      stars.rotation.y = -elapsed * 0.022;
      stars.rotation.x = elapsed * 0.006;
      stars.rotation.z = elapsed * 0.012;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) renderer.render(scene, camera);
    else animate();

    cleanupScene = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };

    }).catch(() => {});

    return () => {
      disposed = true;
      cleanupScene();
    };
  }, [mode, performanceMode, useWebglIntro]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;
    if (assistantSettings.startupGreetingMode === 'silent') return undefined;
    const timer = window.setTimeout(() => {
      try {
        const audioPath = assistantSettings.customStartupAudio;
        if (assistantSettings.startupGreetingMode === 'audio' && audioPath) {
          const audio = new Audio(audioPath);
          audio.volume = 0.7;
          audio.play().catch(() => {});
          return;
        }
        const spokenName = assistantSettings.startupGreetingMode === 'random' ? pickUserName(assistantSettings) : (assistantSettings.startupCallName || assistantSettings.introName);
        const text = assistantSettings.startupGreetingMode === 'custom' && assistantSettings.customStartupText
          ? assistantSettings.customStartupText
          : `Welcome home ${spokenName}`;
        const voice = new SpeechSynthesisUtterance(text);
        voice.rate = 0.9;
        voice.pitch = 0.92;
        voice.volume = 0.68;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(voice);
      } catch {
        // Browsers may block speech until the first user gesture.
      }
    }, 550);
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <motion.button
      type="button"
      className={`welcome-stage ${mode} mood-${mood} ${useWebglIntro ? 'webgl-intro' : 'css-intro'}`}
      onClick={onDismiss}
      aria-label="Dismiss welcome animation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
    >
      {customIntro?.url ? (
        <video
          className="welcome-video-intro"
          src={customIntro.url}
          muted
          autoPlay
          loop
          playsInline
          aria-hidden="true"
        />
      ) : null}
      {useWebglIntro ? (
        <canvas ref={canvasRef} className="welcome-canvas" />
      ) : (
        <div className="welcome-css-core" aria-hidden="true">
          <span className="welcome-css-orb" />
          <span className="welcome-css-ring ring-one" />
          <span className="welcome-css-ring ring-two" />
          <span className="welcome-css-ring ring-three" />
        </div>
      )}
      <div className="welcome-aurora" />
      <div className="welcome-grid" />
      <div className="welcome-scan" />
      <motion.div
        className="welcome-system"
        aria-hidden="true"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.45, duration: 0.55 }}
      >
        <span>BOOT</span>
        <span>{mood.toUpperCase()} CORE</span>
        <span>{formatClockTime(now, timeFormat)}</span>
      </motion.div>
      <motion.div
        className="welcome-copy"
        initial={{ y: 42, opacity: 0, rotateX: 18, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.span
          className="welcome-kicker"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.42 }}
        >
          {assistantSettings.assistantName} is awake
        </motion.span>
        <strong><span>Welcome home</span> {assistantSettings.introName}</strong>
        <em>{formatClockTime(now, timeFormat)} / {locationSettings.weatherName} kiosk online</em>
        {customIntro ? <small className="welcome-custom-video">Custom video intro: {customIntro.title}</small> : null}
        <div className="welcome-loader" aria-hidden="true"><span /></div>
      </motion.div>
      <div className="welcome-data-rail" aria-hidden="true">
        {statusItems.map(([label, value]) => (
          <span key={label}><small>{label}</small><strong>{value}</strong></span>
        ))}
      </div>
      <span className="welcome-hint">Tap anywhere to enter</span>
    </motion.button>
  );
}

function PriceRow({ item }) {
  const up = item.delta.startsWith('+');
  const live = item.delta === 'live';
  const cached = item.delta === 'cached' || item.delta === 'load';
  return (
    <div className="price-row">
      <span>{item.label}</span>
      <strong>{item.value} <small>{item.unit}</small></strong>
      <em className={live ? 'live' : cached ? 'cached' : up ? 'up' : 'down'}>{item.delta}</em>
    </div>
  );
}

function widgetIcon(type) {
  if (type === 'meter') return Gauge;
  if (type === 'link') return Network;
  if (type === 'number') return Clock3;
  return Bell;
}

function WidgetTile({ widget, onRemove, onToggleLock, draggable = false, onDragStart, dragHandleProps = null }) {
  const Icon = widget.Icon || widgetIcon(widget.type);
  const meterValue = widget.type === 'meter' ? Math.max(0, Math.min(100, Number(widget.value) || 0)) : 0;
  const isLink = widget.type === 'link' && /^https?:\/\//i.test(widget.value);

  return (
    <div className={`widget-tile ${widget.accent || 'green'} ${widget.locked ? 'locked' : ''}`} draggable={draggable} onDragStart={onDragStart}>
      <div className="widget-topline">
        {dragHandleProps && (
          <button
            type="button"
            className="widget-drag-handle"
            aria-label={`Move ${widget.title}`}
            title="Move widget"
            {...dragHandleProps}
          >
            <GripVertical size={14} />
          </button>
        )}
        <span><Icon size={17} /> {widget.title}</span>
        {(onToggleLock || onRemove) && (
          <div className="widget-actions">
            {onToggleLock && (
              <button type="button" onClick={() => onToggleLock(widget.id)} aria-label={`${widget.locked ? 'Unlock' : 'Lock'} ${widget.title}`}>
                {widget.locked ? <Lock size={15} /> : <Unlock size={15} />}
              </button>
            )}
            {onRemove && <button type="button" onClick={() => onRemove(widget.id)} aria-label={`Remove ${widget.title}`}><Trash2 size={15} /></button>}
          </div>
        )}
      </div>
      {isLink ? (
        <a className="widget-value" href={widget.value} target="_blank" rel="noreferrer">{widget.value.replace(/^https?:\/\//i, '')}</a>
      ) : (
        <strong className="widget-value">{widget.value}</strong>
      )}
      {widget.type === 'meter' && <div className="widget-meter"><span style={{ width: `${meterValue}%` }} /></div>}
      {widget.detail && <em>{widget.detail}</em>}
    </div>
  );
}

function getSmartWidgets({ now, weather, system, prayer, moon, alarm, timeFormat }) {
  const redMode = now.getHours() < 6;
  const nextMode = redMode ? 'White at 06:00' : 'Red at 00:00';
  const comfort = weather.feels >= 38 ? 'Very hot' : weather.humidity >= 70 ? 'Humid' : weather.wind >= 24 ? 'Breezy' : 'Stable';
  const storageFree = system.disk?.totalGb ? Math.max(0, system.disk.totalGb - system.disk.usedGb).toFixed(1) : '--';

  return [
    { id: 'mode', title: 'Screen mode', value: nextMode, detail: redMode ? 'Night-safe display active' : 'Day display active', type: 'note', accent: redMode ? 'red' : 'green', Icon: Sun },
    { id: 'comfort', title: 'Room read', value: comfort, detail: `Feels ${weather.feels}C / humidity ${weather.humidity}%`, type: 'note', accent: weather.feels >= 38 ? 'red' : 'green', Icon: CloudSun },
    { id: 'prayer', title: 'Next prayer', value: `${prayer.name} ${prayer.countdown}`, detail: 'Ajman local calculation', type: 'note', accent: 'green', Icon: Moon },
    { id: 'alarm', title: 'Alarm', value: formatAlarmLabel(alarm, timeFormat), detail: 'Saved on this kiosk', type: 'number', accent: 'blue', Icon: AlarmClock },
    { id: 'storage', title: 'Storage free', value: `${storageFree} GB`, detail: `${system.disk?.percent ?? 0}% used`, type: 'meter', accent: system.disk?.percent > 85 ? 'red' : 'amber', Icon: HardDrive },
    { id: 'gateway', title: 'Gateway ping', value: system.pingMs == null ? '--' : `${system.pingMs} ms`, detail: system.pingMs == null ? 'Waiting for local feed' : 'Local Wi-Fi check', type: 'number', accent: system.pingMs > 45 ? 'amber' : 'green', Icon: Network },
    { id: 'moon', title: 'Moon light', value: `${moon.illumination}%`, detail: moon.phase, type: 'meter', accent: 'blue', Icon: Moon }
  ];
}

function Dashboard({ now, weather, timeFormat, alarm, customWidgets, setCustomWidgets, customSections, setCustomSections, deletedWidgets, deleteCustomWidget, toggleWidgetLock, restoreDeletedWidget, restoreAllDeletedWidgets, musicLibrary, musicPlayer, cameraWakeEnabled, setCameraWakeEnabled, cameraWakeStatus, cameraVideoRef, ambientPhase, weatherMood, dashboardTheme, sleepMode, setSleepMode, idle, noiseEnabled, setNoiseEnabled, noise, focus, roomMode, setRoomMode, focusLock, setFocusLock, battery, caffeine, assistantSettings, voiceAssistant, runAssistantCommand, pushToast, locationSettings, performanceMode, setPerformanceMode, openBrainDump, openQuickControls, goClock, goSettings, goSignal, goRadar, goRemoteCamera }) {
  const gold = useGoldPrices();
  const fuel = useFuelPrices();
  const news = useNewsFeed();
  const system = useSystemInfo();
  const air = useAirQuality(locationSettings);
  const hydration = useHydrationTracker();
  const habits = useHabitTracker();
  const quickLinks = useQuickLinks();
  const agenda = useAgenda();
  const dailyGoals = useDailyGoals();
  const exams = useExamCountdowns();
  const [todoLists, setTodoLists] = useTodoLists();
  const [activeTodoType, setActiveTodoType] = useState('morning');
  const [draft, setDraft] = useState('');
  const [showWidgetTray, setShowWidgetTray] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const [dashboardDragType, setDashboardDragType] = useState('');
  const [dashboardDragWidgetId, setDashboardDragWidgetId] = useState('');
  const [dashboardDropTarget, setDashboardDropTarget] = useState('');
  const [dashboardDragSectionId, setDashboardDragSectionId] = useState('');
  const [dashboardSectionDropIndex, setDashboardSectionDropIndex] = useState(null);
  const hourlyRef = useRef(null);
  const dashboardRef = useRef(null);
  const prayer = nextPrayer(now);
  const prayers = useMemo(() => getPrayerTimes(now), [now.toDateString()]);
  const moon = useMemo(() => getMoonPhase(now), [now.toDateString()]);
  const moonTimes = useMemo(() => getMoonTimes(now, locationSettings), [now.toDateString(), locationSettings.weatherLat, locationSettings.weatherLon]);
  const todos = todoLists[activeTodoType] || [];
  const smartWidgets = getSmartWidgets({ now, weather, system, prayer, moon, alarm, timeFormat });
  const smartReminders = useMemo(() => getSmartReminders({ now, weather, prayer, hydration, habits, agenda, dailyGoals, exams, air, battery, system, roomMode, caffeine }), [now, weather, prayer, hydration, habits, agenda, dailyGoals, exams, air, battery, system, roomMode, caffeine]);
  const sleepReadiness = useMemo(() => getSleepReadiness({ now, weather, hydration, caffeine, dailyGoals, roomMode }), [now, weather, hydration, caffeine, dailyGoals, roomMode]);
  const currentIsNight = isNightAt(now, weather.sunrise, weather.sunset);
  const dashboardSections = useMemo(() => [
    ...BUILT_IN_SECTIONS,
    ...customSections.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  ], [customSections]);
  const [dashboardLayoutOrder, setDashboardLayoutOrder] = useDashboardLayout(dashboardSections);
  const sectionById = useMemo(() => new Map(dashboardSections.map((section) => [section.id, section])), [dashboardSections]);
  const widgetsByPlacement = useMemo(() => (
    dashboardSections.reduce((groups, section) => ({
      ...groups,
      [section.id]: orderedPlacementWidgets(customWidgets, section.id)
    }), {})
  ), [customWidgets, dashboardSections]);

  function addTodo(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setTodoLists({
      ...todoLists,
      [activeTodoType]: [{ id: Date.now(), text, done: false }, ...todos]
    });
    setDraft('');
  }

  function updateTodoList(nextTodos) {
    setTodoLists({ ...todoLists, [activeTodoType]: nextTodos });
  }

  function scrollHourly(direction) {
    hourlyRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  }

  function addDashboardTemplateWidget(typeId, placement = 'weather', insertIndex = Infinity) {
    setCustomWidgets((current) => placeWidgetInDashboard(current, widgetTemplate(typeId, placement), placement, insertIndex));
  }

  function addQuickSection() {
    const nextIndex = customSections.length + 1;
    const title = window.prompt('Section name', `Section ${nextIndex}`);
    if (!title?.trim()) return;
    const section = normalizeSection({
      id: `section-${Date.now()}`,
      title: title.trim(),
      detail: 'Drop widgets inside this section',
      order: Date.now()
    });
    setCustomSections((current) => [...current, section]);
  }

  function startDashboardTemplateDrag(event, typeId) {
    setDashboardDragType(typeId);
    setDashboardDragWidgetId('');
    setDashboardDragSectionId('');
    setDashboardSectionDropIndex(null);
    event.dataTransfer.setData('application/x-nexora-widget-type', typeId);
    event.dataTransfer.setData('text/plain', `template:${typeId}`);
    event.dataTransfer.effectAllowed = 'copy';
  }

  function startDashboardTemplatePointer(typeId) {
    setDashboardDragType(typeId);
    setDashboardDragWidgetId('');
    setDashboardDragSectionId('');
    setDashboardSectionDropIndex(null);
  }

  function startExistingWidgetDrag(event, widgetId) {
    setDashboardDragWidgetId(String(widgetId));
    setDashboardDragType('');
    setDashboardDragSectionId('');
    setDashboardSectionDropIndex(null);
    event.dataTransfer.setData('application/x-nexora-widget-id', String(widgetId));
    event.dataTransfer.setData('text/plain', `widget:${widgetId}`);
    event.dataTransfer.effectAllowed = 'move';
  }

  function startExistingWidgetPointer(event, widgetId) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setDashboardDragWidgetId(String(widgetId));
    setDashboardDragType('');
    setDashboardDragSectionId('');
    setDashboardSectionDropIndex(null);
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    let lastTarget = widgetDropTargetFromCoordinates(event.clientX, event.clientY, String(widgetId));
    if (lastTarget) setDashboardDropTarget(widgetDropKey(lastTarget.placement, lastTarget.insertIndex));
    handle.setPointerCapture?.(pointerId);

    const updateTarget = (clientX, clientY) => {
      const target = widgetDropTargetFromCoordinates(clientX, clientY, String(widgetId));
      if (target) {
        lastTarget = target;
        setDashboardDropTarget(widgetDropKey(target.placement, target.insertIndex));
      }
    };

    const stopListening = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      handle.releasePointerCapture?.(pointerId);
    };

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      autoScrollDashboard(moveEvent.clientY);
      updateTarget(moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      upEvent.preventDefault();
      updateTarget(upEvent.clientX, upEvent.clientY);
      applyDashboardWidgetDrop(lastTarget);
      stopListening();
    };

    const onCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      clearDashboardDrag();
      stopListening();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onCancel, { passive: false });
  }

  function startDashboardSectionDrag(event, sectionId) {
    event.stopPropagation();
    setDashboardDragType('');
    setDashboardDragWidgetId('');
    setDashboardDropTarget('');
    setDashboardDragSectionId(sectionId);
    setDashboardSectionDropIndex(dashboardLayoutOrder.indexOf(sectionId));
    event.dataTransfer.setData('application/x-nexora-section-id', sectionId);
    event.dataTransfer.setData('text/plain', `section:${sectionId}`);
    event.dataTransfer.effectAllowed = 'move';
  }

  function startDashboardSectionPointer(event, sectionId) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setDashboardDragType('');
    setDashboardDragWidgetId('');
    setDashboardDropTarget('');
    setDashboardDragSectionId(sectionId);
    const pointerId = event.pointerId;
    const handle = event.currentTarget;
    let lastIndex = dashboardLayoutOrder.indexOf(sectionId);
    setDashboardSectionDropIndex(lastIndex);
    handle.setPointerCapture?.(pointerId);

    const updateTarget = (clientX, clientY) => {
      const nextIndex = sectionDropIndexFromCoordinates(clientX, clientY, sectionId);
      if (Number.isFinite(nextIndex)) {
        lastIndex = nextIndex;
        setDashboardSectionDropIndex((current) => (current === nextIndex ? current : nextIndex));
      }
    };

    const stopListening = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      handle.releasePointerCapture?.(pointerId);
    };

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      autoScrollDashboard(moveEvent.clientY);
      updateTarget(moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      upEvent.preventDefault();
      updateTarget(upEvent.clientX, upEvent.clientY);
      moveDashboardSectionToIndex(sectionId, lastIndex);
      clearDashboardSectionDrag();
      stopListening();
    };

    const onCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      clearDashboardSectionDrag();
      stopListening();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onCancel, { passive: false });
  }

  function widgetDropKey(placement, insertIndex = Infinity) {
    return `${placement}:${Number.isFinite(insertIndex) ? insertIndex : 'end'}`;
  }

  function parseWidgetDropKey(dropKey) {
    if (!dropKey) return null;
    const [placement, indexText] = dropKey.split(':');
    if (!placement) return null;
    const insertIndex = indexText === 'end' ? Infinity : Number(indexText);
    return { placement, insertIndex: Number.isFinite(insertIndex) ? insertIndex : Infinity };
  }

  function dashboardStackFromCoordinates(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    const directStack = element?.closest?.('[data-section-id]');
    if (directStack) return directStack;

    const stacks = Array.from(document.querySelectorAll('.dashboard-stack[data-section-id]'));
    if (!stacks.length) return null;

    const grid = document.querySelector('.dash-grid');
    const gridRect = grid?.getBoundingClientRect();
    if (gridRect && (
      clientX < gridRect.left - 40 ||
      clientX > gridRect.right + 40 ||
      clientY < gridRect.top - 80 ||
      clientY > gridRect.bottom + 80
    )) {
      return null;
    }

    let closest = null;
    let closestScore = Infinity;
    stacks.forEach((stack) => {
      const rect = stack.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (clientX - centerX) / Math.max(rect.width, 1);
      const dy = (clientY - centerY) / Math.max(rect.height, 1);
      const score = dx * dx + dy * dy;
      if (score < closestScore) {
        closest = stack;
        closestScore = score;
      }
    });

    return closest;
  }

  function autoScrollDashboard(clientY) {
    const scroller = dashboardRef.current;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const edge = 92;
    const maxStep = 24;
    let delta = 0;

    if (clientY < rect.top + edge) {
      delta = -Math.ceil(((rect.top + edge - clientY) / edge) * maxStep);
    } else if (clientY > rect.bottom - edge) {
      delta = Math.ceil(((clientY - (rect.bottom - edge)) / edge) * maxStep);
    }

    if (delta) scroller.scrollBy({ top: delta, left: 0, behavior: 'auto' });
  }

  function widgetDropTargetFromCoordinates(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    const dropLine = element?.closest?.('[data-widget-drop-placement]');
    if (dropLine) {
      const insertIndex = Number(dropLine.dataset.widgetDropIndex);
      return {
        placement: dropLine.dataset.widgetDropPlacement,
        insertIndex: Number.isFinite(insertIndex) ? insertIndex : Infinity
      };
    }

    const stack = dashboardStackFromCoordinates(clientX, clientY);
    const placement = stack?.dataset.sectionId;
    if (!placement) return null;

    const widgetPanel = element?.closest?.('[data-widget-id]');
    if (widgetPanel && stack.contains(widgetPanel)) {
      const widgets = widgetsByPlacement[placement] || [];
      const widgetIndex = widgets.findIndex((item) => String(item.id) === String(widgetPanel.dataset.widgetId));
      if (widgetIndex >= 0) {
        const rect = widgetPanel.getBoundingClientRect();
        return {
          placement,
          insertIndex: clientY > rect.top + rect.height / 2 ? widgetIndex + 1 : widgetIndex
        };
      }
    }

    const widgets = widgetsByPlacement[placement] || [];
    const widgetPanels = Array.from(stack.querySelectorAll('[data-widget-id]'));
    for (const widget of widgets) {
      const panel = widgetPanels.find((node) => String(node.dataset.widgetId) === String(widget.id));
      if (!panel) continue;
      const rect = panel.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return { placement, insertIndex: widgets.findIndex((item) => String(item.id) === String(widget.id)) };
      }
    }

    return { placement, insertIndex: (widgetsByPlacement[placement] || []).length };
  }

  function widgetDropTargetFromPoint(event) {
    return widgetDropTargetFromCoordinates(event.clientX, event.clientY);
  }

  function updateDashboardWidgetPointer(event) {
    if (!dashboardDragWidgetId && !dashboardDragType) return;
    const target = widgetDropTargetFromPoint(event);
    setDashboardDropTarget(target ? widgetDropKey(target.placement, target.insertIndex) : '');
  }

  function applyDashboardWidgetDrop(target) {
    if (!target) return false;
    const { placement, insertIndex } = target;
    if (dashboardDragWidgetId) {
      setCustomWidgets((current) => {
        const widget = current.find((item) => String(item.id) === String(dashboardDragWidgetId));
        return widget ? placeWidgetInDashboard(current, widget, placement, insertIndex) : current;
      });
      clearDashboardDrag();
      return true;
    }
    if (dashboardDragType) {
      addDashboardTemplateWidget(dashboardDragType, placement, insertIndex);
      clearDashboardDrag();
      return true;
    }
    return false;
  }

  function finishDashboardWidgetPointer(event) {
    if (!dashboardDragWidgetId && !dashboardDragType) return;
    event.stopPropagation();
    const target = widgetDropTargetFromPoint(event) || parseWidgetDropKey(dashboardDropTarget);
    applyDashboardWidgetDrop(target);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function sectionDropIndexFromCoordinates(clientX, clientY, sourceId = dashboardDragSectionId) {
    const grid = document.querySelector('.dash-grid');
    const gridRect = grid?.getBoundingClientRect();
    if (gridRect) {
      if (clientY < gridRect.top) return 0;
      if (clientY > gridRect.bottom) return dashboardLayoutOrder.length;
    }

    const element = document.elementFromPoint(clientX, clientY);
    const dropLine = element?.closest?.('[data-section-drop-index]');
    if (dropLine) {
      const insertIndex = Number(dropLine.dataset.sectionDropIndex);
      return Number.isFinite(insertIndex) ? insertIndex : null;
    }

    const stacks = Array.from(document.querySelectorAll('.dashboard-stack[data-section-id]'))
      .map((stack) => ({
        stack,
        sectionId: stack.dataset.sectionId,
        sectionIndex: dashboardLayoutOrder.indexOf(stack.dataset.sectionId),
        rect: stack.getBoundingClientRect()
      }))
      .filter((item) => item.sectionId && item.sectionIndex >= 0);

    if (!stacks.length) return null;

    let closest = null;
    let closestScore = Infinity;
    stacks.forEach((item) => {
      const centerX = item.rect.left + item.rect.width / 2;
      const centerY = item.rect.top + item.rect.height / 2;
      const dx = (clientX - centerX) / Math.max(item.rect.width, 1);
      const dy = (clientY - centerY) / Math.max(item.rect.height, 1);
      const sourcePenalty = item.sectionId === sourceId ? 0.08 : 0;
      const score = dx * dx + dy * dy + sourcePenalty;
      if (score < closestScore) {
        closest = item;
        closestScore = score;
      }
    });

    if (!closest) return null;

    const centerY = closest.rect.top + closest.rect.height / 2;
    const insertAfter = clientY > centerY;
    return closest.sectionIndex + (insertAfter ? 1 : 0);
  }

  function sectionDropIndexFromPoint(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const stack = element?.closest?.('[data-section-id]');
    const sectionId = stack?.dataset.sectionId;
    return sectionDropIndexFromCoordinates(event.clientX, event.clientY, sectionId || dashboardDragSectionId);
  }

  function updateDashboardSectionPointer(event) {
    if (!dashboardDragSectionId) return;
    setDashboardSectionDropIndex(sectionDropIndexFromPoint(event));
  }

  function finishDashboardSectionPointer(event) {
    if (!dashboardDragSectionId) return;
    event.stopPropagation();
    const insertIndex = sectionDropIndexFromPoint(event);
    moveDashboardSectionToIndex(dashboardDragSectionId, insertIndex ?? dashboardSectionDropIndex);
    clearDashboardSectionDrag();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function clearDashboardSectionDrag() {
    setDashboardDragSectionId('');
    setDashboardSectionDropIndex(null);
    setDashboardDropTarget('');
  }

  function moveDashboardSectionToIndex(sourceId, insertIndex) {
    if (!sourceId || !Number.isFinite(insertIndex)) return;
    setDashboardLayoutOrder((current) => {
      const normalized = normalizeDashboardLayout(current, dashboardSections);
      const sourceIndex = normalized.indexOf(sourceId);
      if (sourceIndex < 0) return normalized;
      const withoutSource = normalized.filter((id) => id !== sourceId);
      let nextIndex = Math.max(0, Math.min(insertIndex, normalized.length));
      if (sourceIndex < nextIndex) nextIndex -= 1;
      nextIndex = Math.max(0, Math.min(nextIndex, withoutSource.length));
      const next = [...withoutSource];
      next.splice(nextIndex, 0, sourceId);
      return next;
    });
  }

  function clearDashboardDrag() {
    setDashboardDragType('');
    setDashboardDragWidgetId('');
    setDashboardDropTarget('');
  }

  function allowDashboardTemplateDrop(event, dropKey) {
    event.preventDefault();
    const types = Array.from(event.dataTransfer.types || []);
    if (types.includes('application/x-nexora-section-id') || dashboardDragSectionId) {
      setDashboardSectionDropIndex(sectionDropIndexFromPoint(event));
      event.dataTransfer.dropEffect = 'move';
      return;
    }
    setDashboardDropTarget(dropKey);
    event.dataTransfer.dropEffect = types.includes('application/x-nexora-widget-id') || dashboardDragWidgetId ? 'move' : 'copy';
  }

  function dropDashboardTemplateWidget(event, placement = 'weather', insertIndex = Infinity) {
    event.preventDefault();
    event.stopPropagation();
    const textPayload = event.dataTransfer.getData('text/plain') || '';
    const sectionId = event.dataTransfer.getData('application/x-nexora-section-id') || (textPayload.startsWith('section:') ? textPayload.slice(8) : '') || dashboardDragSectionId;
    if (sectionId) {
      moveDashboardSectionToIndex(sectionId, sectionDropIndexFromPoint(event) ?? dashboardSectionDropIndex);
      clearDashboardSectionDrag();
      return;
    }
    const widgetId = event.dataTransfer.getData('application/x-nexora-widget-id') || (textPayload.startsWith('widget:') ? textPayload.slice(7) : '') || dashboardDragWidgetId;
    const typeId = event.dataTransfer.getData('application/x-nexora-widget-type') || (textPayload.startsWith('template:') ? textPayload.slice(9) : '') || dashboardDragType;
    clearDashboardDrag();
    if (widgetId) {
      setCustomWidgets((current) => {
        const widget = current.find((item) => String(item.id) === String(widgetId));
        return widget ? placeWidgetInDashboard(current, widget, placement, insertIndex) : current;
      });
      return;
    }
    if (typeId) addDashboardTemplateWidget(typeId, placement, insertIndex);
  }

  function pointerDropDashboardItem(event, placement = 'weather', insertIndex = Infinity) {
    if (dashboardDragSectionId) {
      moveDashboardSectionToIndex(dashboardDragSectionId, sectionDropIndexFromPoint(event) ?? dashboardSectionDropIndex);
      clearDashboardSectionDrag();
      return;
    }
    if (dashboardDragWidgetId || dashboardDragType) {
      applyDashboardWidgetDrop(widgetDropTargetFromPoint(event) || { placement, insertIndex });
      return;
    }
  }

  function dropProps(placement, insertIndex = Infinity) {
    const dropKey = widgetDropKey(placement, insertIndex);
    return {
      onPointerUp: (event) => pointerDropDashboardItem(event, placement, insertIndex),
      onDragEnter: (event) => {
        event.preventDefault();
        const types = Array.from(event.dataTransfer.types || []);
        if (types.includes('application/x-nexora-section-id') || dashboardDragSectionId) {
          setDashboardSectionDropIndex(sectionDropIndexFromPoint(event));
          return;
        }
        setDashboardDropTarget(dropKey);
      },
      onDragLeave: () => {
        setDashboardDropTarget('');
      },
      onDragOver: (event) => allowDashboardTemplateDrop(event, dropKey),
      onDrop: (event) => dropDashboardTemplateWidget(event, placement, insertIndex)
    };
  }

  function sectionDropProps(insertIndex) {
    return {
      onDragEnter: (event) => {
        event.preventDefault();
        const types = Array.from(event.dataTransfer.types || []);
        if (types.includes('application/x-nexora-section-id') || dashboardDragSectionId) {
          setDashboardSectionDropIndex(insertIndex);
        }
      },
      onDragOver: (event) => {
        event.preventDefault();
        const types = Array.from(event.dataTransfer.types || []);
        if (types.includes('application/x-nexora-section-id') || dashboardDragSectionId) {
          setDashboardSectionDropIndex(insertIndex);
          event.dataTransfer.dropEffect = 'move';
        }
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const textPayload = event.dataTransfer.getData('text/plain') || '';
        const sectionId = event.dataTransfer.getData('application/x-nexora-section-id') || (textPayload.startsWith('section:') ? textPayload.slice(8) : '') || dashboardDragSectionId;
        if (sectionId) moveDashboardSectionToIndex(sectionId, insertIndex);
        clearDashboardSectionDrag();
      }
    };
  }

  function renderDropLine(placement, insertIndex) {
    const dropKey = widgetDropKey(placement, insertIndex);
    return (
      <div
        className={`widget-drop-line ${dashboardDropTarget === dropKey ? 'ready' : ''}`}
        key={`${placement}-drop-${insertIndex}`}
        data-widget-drop-placement={placement}
        data-widget-drop-index={insertIndex}
        {...dropProps(placement, insertIndex)}
      >
        <span />
      </div>
    );
  }

  function renderSectionDropLine(insertIndex, key) {
    return (
      <div
        className={`section-drop-line ${dashboardDragSectionId ? 'active' : ''} ${dashboardSectionDropIndex === insertIndex ? 'ready' : ''}`}
        key={key}
        data-section-drop-index={insertIndex}
        {...sectionDropProps(insertIndex)}
      >
        <span />
      </div>
    );
  }

  function renderPlacedWidgets(placement) {
    const widgets = widgetsByPlacement[placement] || [];
    return (
      <AnimatePresence initial={false}>
        {renderDropLine(placement, 0)}
        {widgets.map((widget, index) => (
          <React.Fragment key={widget.id}>
            <motion.div
              className={`dashboard-widget-panel ${String(dashboardDragWidgetId) === String(widget.id) ? 'moving' : ''}`}
              data-widget-id={widget.id}
              layout
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              <WidgetTile
                widget={widget}
                onRemove={deleteCustomWidget}
                onToggleLock={toggleWidgetLock}
                draggable
                onDragStart={(event) => startExistingWidgetDrag(event, widget.id)}
                dragHandleProps={{
                  onPointerDown: (event) => startExistingWidgetPointer(event, widget.id),
                  onPointerCancel: clearDashboardDrag
                }}
              />
            </motion.div>
            {renderDropLine(placement, index + 1)}
          </React.Fragment>
        ))}
      </AnimatePresence>
    );
  }

  function renderDashboardStack(sectionId, content, extraClass = '') {
    const section = sectionById.get(sectionId);
    const layoutIndex = dashboardLayoutOrder.indexOf(sectionId);
    const dropReady = dashboardDropTarget.startsWith(`${sectionId}:`);
    const sectionReady = dashboardSectionDropIndex === layoutIndex || dashboardSectionDropIndex === layoutIndex + 1;

    return (
      <motion.div
        className={`dashboard-stack ${extraClass} ${dropReady ? 'ready' : ''} ${sectionReady ? 'section-ready' : ''} ${dashboardDragSectionId === sectionId ? 'section-moving' : ''}`}
        key={sectionId}
        data-section-id={sectionId}
        data-section-index={layoutIndex}
        layout
        transition={{ type: 'spring', stiffness: 210, damping: 26, mass: 0.72 }}
        {...dropProps(sectionId)}
      >
        {renderSectionDropLine(layoutIndex, `${sectionId}-section-before`)}
        <button
          type="button"
          className="section-drag-handle"
          draggable
          onDragStart={(event) => startDashboardSectionDrag(event, sectionId)}
          onPointerDown={(event) => startDashboardSectionPointer(event, sectionId)}
          onPointerCancel={clearDashboardSectionDrag}
          aria-label={`Drag ${section?.title || sectionId} widget section`}
          title="Drag this widget section"
        >
          <GripVertical size={16} />
        </button>
        {content}
        {renderPlacedWidgets(sectionId)}
        {renderSectionDropLine(layoutIndex + 1, `${sectionId}-section-after`)}
      </motion.div>
    );
  }

  function renderCustomSection(section) {
    const count = (widgetsByPlacement[section.id] || []).length;
    return renderDashboardStack(
      section.id,
      (
        <section className="panel custom-section-panel">
          <div className="panel-heading">
            <Gauge size={22} />
            <div>
              <h2>{section.title}</h2>
              <p>{section.detail}</p>
            </div>
          </div>
          <div className="section-empty-hint">
            <span>{count ? `${count} widget${count === 1 ? '' : 's'} inside` : 'Drop widgets here'}</span>
            <button type="button" onClick={() => addDashboardTemplateWidget('note', section.id)}>Add note</button>
          </div>
        </section>
      ),
      'custom-section-stack'
    );
  }

  function renderDashboardSection(sectionId) {
    const customSection = customSections.find((section) => section.id === sectionId);
    if (customSection) return renderCustomSection(customSection);

    if (sectionId === 'news') {
      return renderDashboardStack('news', <NewsPanel news={news} timeFormat={timeFormat} />);
    }

    if (sectionId === 'smart-brief') {
      return renderDashboardStack('smart-brief', (
        <SmartBriefPanel
          now={now}
          weather={weather}
          weatherMood={weatherMood}
          prayer={prayer}
          news={news}
          system={system}
          todoLists={todoLists}
          hydration={hydration}
          habits={habits}
          agenda={agenda}
          dailyGoals={dailyGoals}
          roomMode={roomMode}
        />
      ));
    }

    if (sectionId === 'reminders') {
      return renderDashboardStack('reminders', <SmartReminderPanel reminders={smartReminders} />);
    }

    if (sectionId === 'room-mode') {
      return renderDashboardStack('room-mode', <RoomModePanel roomMode={roomMode} setRoomMode={setRoomMode} />);
    }

    if (sectionId === 'quick-links') {
      return renderDashboardStack('quick-links', <QuickLinksPanel links={quickLinks} />);
    }

    if (sectionId === 'assistant') {
      return renderDashboardStack('assistant', (
        <AssistantPanel
          settings={assistantSettings}
          voice={voiceAssistant}
          onCommand={runAssistantCommand}
        />
      ));
    }

    if (sectionId === 'prayer') {
      return renderDashboardStack('prayer', (
        <section className={`panel prayer-panel ${prayer.minutesLeft <= 15 ? 'prayer-soon' : ''}`}>
          <div className="panel-heading">
            <Moon size={22} />
            <div>
              <h2>Prayer Countdown</h2>
              <p>Calculated locally for Ajman, not official live feed</p>
            </div>
          </div>
          <div className="next-prayer">
            <span>{prayer.name}</span>
            <strong>{prayer.countdown}</strong>
          </div>
          <div className="prayer-list">
            {prayers.map((item) => (
              <div key={item.name}><span>{item.name}</span><strong>{formatClockTime(item.time, timeFormat)}</strong></div>
            ))}
          </div>
        </section>
      ));
    }

    if (sectionId === 'weather') {
      return renderDashboardStack('weather', (
        <section className="weather-panel panel">
          <div className="panel-heading">
            <CloudSun size={24} />
            <div>
              <h2>{weather.locationName || locationSettings.weatherName || 'Ajman'} Weather</h2>
              <p>{weather.loaded ? 'Open-Meteo live, no key' : 'Cached fallback'}</p>
            </div>
          </div>
          <div className="weather-main">
            <div className="weather-temp-row">
              <WeatherSymbol code={weather.code} night={currentIsNight} size={40} />
              <strong>{weather.temp}C</strong>
            </div>
            <div>
              <span>{weatherCondition(weather.code, currentIsNight).label}</span>
              <span>Feels {weather.feels}C</span>
              <span>Wind {weather.wind} km/h {windDirectionLabel(weather.windDirection)}</span>
            </div>
          </div>
          <div className="weather-bars">
            <MetricCard icon={Droplets} label="Humidity" value={weather.humidity} unit="%" />
            <MetricCard icon={Wind} label="Wind speed" value={`${weather.wind} km/h ${windDirectionLabel(weather.windDirection)}`} unit="" />
            <MetricCard icon={Sun} label="UV index" value={weather.uv} unit="" tone="amber" />
            <div className="metric-card moon-metric">
              <MoonPhoto moon={moon} />
              <div>
                <p>Moon</p>
                <strong>{moon.phase}</strong>
              </div>
            </div>
          </div>
          <div className="core-console-weather">
            <span>CORE CONSOLE</span>
            <strong>{weatherCondition(weather.code, currentIsNight).label}</strong>
            <em>{weather.humidity}% humidity / {weather.wind} km/h {windDirectionLabel(weather.windDirection)} / {weather.hourly[0]?.visibilityKm ?? '--'} km visibility</em>
          </div>
          <div className="astro-grid">
            <div><span>Sunrise</span><strong>{formatShortTime(weather.sunrise, timeFormat)}</strong></div>
            <div><span>Sunset</span><strong>{formatShortTime(weather.sunset, timeFormat)}</strong></div>
            <div><span>Moonrise</span><strong>{moonTimes.rise ? formatClockTime(moonTimes.rise, timeFormat) : '--'}</strong></div>
            <div><span>Moonset</span><strong>{moonTimes.set ? formatClockTime(moonTimes.set, timeFormat) : '--'}</strong></div>
            <div><span>Next full moon</span><strong>{moon.nextFullMoon.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}</strong></div>
          </div>
          <div className="weather-detail"><Moon size={15} /> {moon.illumination}% lit / lunar age {moon.age} days</div>
          <div className={`ambient-strip ${weatherMood.warning ? 'warning' : ''}`}>
            <div>
              <strong>{weatherMood.label}</strong>
              <span>{weatherMood.warning || ambientPhase.detail}</span>
            </div>
            <em>{ambientPhase.label}</em>
          </div>
          <div className="hourly-heading">
            <h3>Next 24 Hours</h3>
            <div>
              <button onClick={() => scrollHourly(-1)} aria-label="Scroll forecast left"><ChevronLeft size={18} /></button>
              <button onClick={() => scrollHourly(1)} aria-label="Scroll forecast right"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="hourly-strip" ref={hourlyRef}>
            {weather.hourly.map((hour) => (
              <div className="hour-card" key={hour.time.toISOString()}>
                <strong>{formatClockTime(hour.time, timeFormat)}</strong>
                <WeatherSymbol code={hour.code} night={isNightAt(hour.time, weather.sunrise, weather.sunset)} size={24} />
                <span>{hour.temp}C</span>
                <small>{weatherCondition(hour.code, isNightAt(hour.time, weather.sunrise, weather.sunset)).label}</small>
                <small>{hour.wind} {windDirectionLabel(hour.windDirection)}</small>
                <small>{hour.humidity}% / {hour.visibilityKm} km</small>
              </div>
            ))}
          </div>
        </section>
      ));
    }

    if (sectionId === 'device-controls') {
      return renderDashboardStack('device-controls', <DeviceControlsPanel pushToast={pushToast} />);
    }

    if (sectionId === 'air') {
      return renderDashboardStack('air', <AirQualityPanel air={air} weather={weather} />);
    }

    if (sectionId === 'hydration') {
      return renderDashboardStack('hydration', <HydrationPanel hydration={hydration} />);
    }

    if (sectionId === 'habits') {
      return renderDashboardStack('habits', <HabitPanel habits={habits} />);
    }

    if (sectionId === 'sleep-readiness') {
      return renderDashboardStack('sleep-readiness', <SleepReadinessPanel readiness={sleepReadiness} caffeine={caffeine} />);
    }

    if (sectionId === 'market') {
      return renderDashboardStack('market', (
        <section className={`panel market-panel ${gold.loaded || fuel.loaded ? 'market-live' : ''}`}>
          <div className="panel-heading">
            <Fuel size={22} />
            <div>
              <h2>UAE Market Watch</h2>
              <p>{gold.loaded && fuel.loaded ? 'Live gold and UAE fuel feeds' : 'Loading live market feeds'}</p>
            </div>
          </div>
          <div className="prices">
            {[...gold.rates, ...fuel.rates].map((item) => <PriceRow key={item.label} item={item} />)}
          </div>
          <div className="scrape-health"><RefreshCw size={14} /> Gold {gold.loaded ? formatClockTime(new Date(gold.fetchedAt), timeFormat) : 'waiting'} / Fuel {fuel.loaded ? formatClockTime(new Date(fuel.fetchedAt), timeFormat) : 'waiting'}</div>
        </section>
      ));
    }

    if (sectionId === 'daily-goals') {
      return renderDashboardStack('daily-goals', <DailyGoalsPanel dailyGoals={dailyGoals} />);
    }

    if (sectionId === 'agenda') {
      return renderDashboardStack('agenda', <AgendaPanel agenda={agenda} timeFormat={timeFormat} now={now} />);
    }

    if (sectionId === 'exams') {
      return renderDashboardStack('exams', <ExamCountdownPanel exams={exams} now={now} />);
    }

    if (sectionId === 'system') {
      return renderDashboardStack('system', (
        <section className="panel telemetry">
          <div className="panel-heading">
            <Cpu size={22} />
            <div>
              <h2>Linux Host</h2>
              <p>{system.loaded ? system.platform : 'Waiting for local system feed'}</p>
            </div>
          </div>
          <div className="telemetry-grid">
            <GaugeBar icon={Cpu} label="CPU load" value={system.cpuPercent} unit="%" detail={`${system.cpuCores} cores`} />
            <GaugeBar icon={Thermometer} label="Core temp" value={system.tempC ?? 'n/a'} unit={system.tempC == null ? '' : 'C'} />
            <GaugeBar icon={BatteryCharging} label="RAM" value={system.ram.percent} unit="%" detail={`${system.ram.usedGb.toFixed(1)} / ${system.ram.totalGb.toFixed(1)} GB`} />
            <GaugeBar icon={HardDrive} label="Storage" value={system.disk?.percent ?? 0} unit="%" detail={system.disk ? `${system.disk.usedGb.toFixed(1)} / ${system.disk.totalGb.toFixed(1)} GB` : 'unavailable'} />
            <GaugeBar icon={Network} label="Gateway" value={system.pingMs ?? 0} unit={system.pingMs == null ? 'n/a' : 'ms'} max={80} />
            <GaugeBar icon={Wifi} label="Uptime" value={Math.min(100, Math.round((system.uptimeSeconds / 86400) * 100))} unit="%" detail={formatUptime(system.uptimeSeconds)} />
          </div>
        </section>
      ));
    }

    if (sectionId === 'software-needed') {
      return renderDashboardStack('software-needed', <SoftwareNeededPanel compact />);
    }

    if (sectionId === 'lists') {
      return renderDashboardStack('lists', (
        <section className="panel todo-panel">
          <div className="panel-heading">
            <Check size={22} />
            <div>
              <h2>Lists</h2>
              <p>Morning, night, and general tasks saved on this device</p>
            </div>
          </div>
          <div className="todo-tabs" aria-label="List type">
            {TODO_TYPES.map((type) => (
              <button key={type.id} className={activeTodoType === type.id ? 'active' : ''} onClick={() => setActiveTodoType(type.id)}>
                {type.label}
              </button>
            ))}
          </div>
          <form onSubmit={addTodo} className="todo-form">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Add ${TODO_TYPES.find((type) => type.id === activeTodoType)?.label.toLowerCase()} task`} />
            <button aria-label="Add task"><Plus size={20} /></button>
          </form>
          <div className="todo-list">
            {todos.map((todo) => (
              <div className={todo.done ? 'todo done' : 'todo'} key={todo.id}>
                <button onClick={() => updateTodoList(todos.map((item) => item.id === todo.id ? { ...item, done: !item.done } : item))}><Check size={15} /></button>
                <span>{todo.text}</span>
                <button onClick={() => updateTodoList(todos.filter((item) => item.id !== todo.id))}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </section>
      ));
    }

    if (sectionId === 'music') {
      return renderDashboardStack('music', (
        <section className="panel sound-panel music-card-panel">
          <div className="panel-heading">
            <Music2 size={22} />
            <div>
              <h2>Music</h2>
              <p>Local audio and atmosphere controls</p>
            </div>
          </div>
          <MusicPanel library={musicLibrary} player={musicPlayer} />
        </section>
      ));
    }

    if (sectionId === 'ambient') {
      return renderDashboardStack('ambient', (
        <section className="panel sound-panel ambient-card-panel">
          <div className="panel-heading">
            <Gauge size={22} />
            <div>
              <h2>Ambient State</h2>
              <p>Idle, sleep, and room atmosphere</p>
            </div>
          </div>
          <AmbientPanel ambientPhase={ambientPhase} weatherMood={weatherMood} sleepMode={sleepMode} setSleepMode={setSleepMode} idle={idle} openQuickControls={openQuickControls} />
        </section>
      ));
    }

    if (sectionId === 'camera-wake') {
      return renderDashboardStack('camera-wake', (
        <section className="panel sound-panel camera-card-panel">
          <div className="panel-heading">
            <Camera size={22} />
            <div>
              <h2>Camera Wake</h2>
              <p>Presence detection and screen wake</p>
            </div>
          </div>
          <div className="camera-wake-row">
            <video ref={cameraVideoRef} muted playsInline aria-hidden="true" />
            <div>
              <strong>{cameraWakeEnabled ? 'Camera wake armed' : 'Camera wake off'}</strong>
              <span>{cameraWakeStatus}</span>
            </div>
            <button type="button" onClick={() => setCameraWakeEnabled(!cameraWakeEnabled)}>
              <Camera size={18} /> {cameraWakeEnabled ? 'Stop' : 'Start'}
            </button>
          </div>
          <div className="uptime">Camera wake clears blackout when camera motion is detected. No face identity is used.</div>
        </section>
      ));
    }

    if (sectionId === 'noise') {
      return renderDashboardStack('noise', (
        <section className="panel sound-panel noise-card-panel">
          <div className="panel-heading">
            <Volume2 size={22} />
            <div>
              <h2>Noise Monitor</h2>
              <p>Quiet, medium, or high room noise</p>
            </div>
          </div>
          <NoisePanel noise={noise} enabled={noiseEnabled} setEnabled={setNoiseEnabled} />
        </section>
      ));
    }

    if (sectionId === 'focus-actions') {
      return renderDashboardStack('focus-actions', (
        <section className="panel sound-panel focus-card-panel">
          <div className="panel-heading">
            <Target size={22} />
            <div>
              <h2>Focus Actions</h2>
              <p>Quick study, sleep, and cleaning controls</p>
            </div>
          </div>
          <FocusPanel focus={focus} />
          <div className="dock">
            <button type="button" onClick={openBrainDump}>Brain dump</button>
            <button type="button" onClick={() => focus.start(25)}>Focus 25</button>
            <button type="button" className={focusLock ? 'active' : ''} onClick={() => setFocusLock(!focusLock)}>{focusLock ? 'Unlock focus' : 'Focus lock'}</button>
            <button type="button" onClick={() => setSleepMode(!sleepMode)}>{sleepMode ? 'Wake UI' : 'Sleep mode'}</button>
            <button>Clean 30s</button>
          </div>
        </section>
      ));
    }

    return null;
  }

  function focusAssistantPanel() {
    const node = dashboardRef.current?.querySelector?.('[data-section-id="assistant"]');
    node?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    const input = node?.querySelector?.('.assistant-command-row input');
    window.setTimeout(() => input?.focus?.(), 260);
  }

  function cyclePerformanceMode() {
    const nextMode = performanceMode === 'balanced' ? 'lite' : performanceMode === 'lite' ? 'full' : 'balanced';
    setPerformanceMode(nextMode);
  }

  return (
    <section ref={dashboardRef} className={`dashboard dashboard-theme-${dashboardTheme} phase-${ambientPhase.id} weather-${weatherMood.id} ${sleepMode ? 'sleep-mode' : ''} ${idle ? 'ambient-idle' : ''}`}>
      <header className="dash-top">
        <button className="icon-button menu-equals-button" onClick={() => setShowPageMenu((value) => !value)} aria-label="Open pages menu">=</button>
        <div>
          <h1>Project Nexora</h1>
          <span className="ambient-kicker">{ambientPhase.label} / {weatherMood.label}</span>
          <p>Ajman room kiosk / {now.toLocaleDateString('en-AE', { weekday: 'short', month: 'short', day: 'numeric' })} / swipe right for Clock</p>
        </div>
        <div className="top-actions">
          <button className={musicPlayer.playing ? 'icon-button active' : 'icon-button'} onClick={musicPlayer.togglePlay} aria-label={musicPlayer.playing ? 'Pause music' : 'Play music'} disabled={!musicPlayer.tracks.length}>
            {musicPlayer.playing ? <Pause size={21} /> : <Play size={21} />}
          </button>
          <button className={cameraWakeEnabled ? 'icon-button active' : 'icon-button'} onClick={() => setCameraWakeEnabled(!cameraWakeEnabled)} aria-label="Toggle camera wake"><Camera size={21} /></button>
          <button
            className={performanceMode === 'lite' ? 'icon-button active perf-toggle-button' : 'icon-button perf-toggle-button'}
            onClick={cyclePerformanceMode}
            aria-label={`Kiosk optimizer ${performanceMode}`}
            title={`Kiosk optimizer: ${performanceMode}`}
          >
            <Cpu size={21} />
          </button>
          <button className="icon-button" onClick={openQuickControls} aria-label="Quick controls"><Gauge size={21} /></button>
          <button className="assistant-top-helper" onClick={focusAssistantPanel} aria-label="Open AI helper">
            <Sparkles size={18} />
            <span>AI</span>
            <em>{assistantSettings.modelTier}</em>
          </button>
          <button className="icon-button" onClick={() => setShowWidgetTray(true)} aria-label="Show widgets"><Plus size={22} /></button>
          <button className="icon-button" onClick={() => setShowWidgetTray(false)} aria-label="Hide widgets"><Minus size={22} /></button>
          {deletedWidgets.length > 0 && (
            <button className="icon-button undo-top-button" onClick={restoreAllDeletedWidgets} aria-label="Restore deleted widgets"><Undo2 size={22} /></button>
          )}
          <button className="icon-button" onClick={goSettings} aria-label="Open tools"><Settings size={22} /></button>
          <div className="status-pill"><Shield size={17} /> Kiosk online</div>
        </div>
      </header>

      <AnimatePresence>
        {showPageMenu && (
          <motion.div
            className="page-menu-panel"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <button type="button" onClick={() => { setShowPageMenu(false); goSignal(); }}>
              <Network size={18} />
              <span>Signal Center</span>
              <em>Radio + Aircraft tracker</em>
            </button>
            <button type="button" onClick={() => { setShowPageMenu(false); goRadar(); }}>
              <RadarIcon size={18} />
              <span>Radar</span>
              <em>Laptop camera motion radar + future ESP32 distance sensor</em>
            </button>
            <button type="button" onClick={() => { setShowPageMenu(false); goRemoteCamera(); }}>
              <Camera size={18} />
              <span>Localhost Camera View Live</span>
              <em>Choose camera device and private remote view</em>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWidgetTray && (
          <motion.div
            className="top-widget-tray"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            <div className="top-widget-heading">
              <strong>Widgets</strong>
              <div>
                <button type="button" onClick={addQuickSection}><Plus size={16} /> Section</button>
                <button type="button" onClick={goSettings}><Plus size={16} /> Custom</button>
                <button type="button" onClick={() => setDashboardLayoutOrder(normalizeDashboardLayout(DEFAULT_DASHBOARD_ORDER, dashboardSections))}><RefreshCw size={16} /> Reset layout</button>
              </div>
            </div>
            <div className="dashboard-widget-templates" aria-label="Dashboard widget templates">
              {WIDGET_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  draggable
                  onDragStart={(event) => startDashboardTemplateDrag(event, type.id)}
                  onPointerDown={() => startDashboardTemplatePointer(type.id)}
                  onPointerCancel={clearDashboardDrag}
                  onClick={() => {
                    addDashboardTemplateWidget(type.id);
                    clearDashboardDrag();
                  }}
                >
                  <GripVertical size={15} />
                  <span>{type.label}</span>
                  <Plus size={15} />
                </button>
              ))}
            </div>
            <div className="top-widget-strip">
              {smartWidgets.map((widget) => <WidgetTile key={widget.id} widget={widget} />)}
            </div>
            {deletedWidgets.length > 0 && (
              <div className="widget-recovery">
                <span>{deletedWidgets.length} deleted widget{deletedWidgets.length === 1 ? '' : 's'} saved for undo</span>
                <button type="button" onClick={() => restoreDeletedWidget(deletedWidgets[0].id)}>
                  <Undo2 size={15} /> Undo last ({formatUndoTimeLeft(deletedWidgets[0].deletedAt)})
                </button>
                <button type="button" onClick={restoreAllDeletedWidgets}>Restore all</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`dash-grid ${dashboardDragSectionId ? 'section-dragging' : ''} ${dashboardDragWidgetId || dashboardDragType ? 'widget-dragging' : ''}`}>
        {dashboardLayoutOrder.map((sectionId) => renderDashboardSection(sectionId))}
      </main>
    </section>
  );
}

function SignalCenterPage({ now, goDashboard, goClock, openQuickControls }) {
  const signal = useSignalCenterStatus();
  const sdr = signal.sdr || {};
  const radio = signal.radio || {};
  const aircraft = signal.aircraft || {};
  const aircraftList = Array.isArray(aircraft.aircraft) ? aircraft.aircraft.slice(0, 8) : [];
  const presets = radio.presets?.length ? radio.presets : [
    { frequency: '88.7', name: 'Preset 1' },
    { frequency: '92.0', name: 'Preset 2' },
    { frequency: '96.7', name: 'Preset 3' },
    { frequency: '104.8', name: 'Preset 4' }
  ];
  const hardwareReady = Boolean(sdr.connected);
  const adsbReady = Boolean(aircraft.available);
  const radioReady = Boolean(radio.available && hardwareReady);

  return (
    <section className="signal-center">
      <header className="signal-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div>
          <h1>Signal Center</h1>
          <p>RTL-SDR radio and local ADS-B aircraft tracking</p>
        </div>
        <div className="signal-top-actions">
          <button type="button" onClick={signal.refresh}><RefreshCw size={17} /> Refresh</button>
          <button type="button" onClick={openQuickControls}><Gauge size={17} /> Quick</button>
          <button type="button" onClick={goClock}>Clock <ChevronRight size={17} /></button>
        </div>
      </header>

      <main className="signal-grid">
        <section className="signal-status-card">
          <div>
            <span>SDR receiver</span>
            <strong>{hardwareReady ? 'Connected' : 'Unavailable'}</strong>
            <em>{sdr.label || 'RTL-SDR Blog V4 / compatible SDR'}</em>
          </div>
          <div>
            <span>Receiver health</span>
            <strong>{sdr.health || (hardwareReady ? 'Ready' : 'Disconnected')}</strong>
            <em>{signal.error || sdr.message || 'Graceful fallback keeps KISOKE running'}</em>
          </div>
          <div>
            <span>Data source</span>
            <strong>{aircraft.source || 'Local SDR services'}</strong>
            <em>dump1090 / readsb compatible</em>
          </div>
        </section>

        <section className="signal-panel radio-panel">
          <div className="panel-heading">
            <Network size={22} />
            <div>
              <h2>FM Radio</h2>
              <p>{radioReady ? 'RTL-SDR FM receiver ready' : (radio.message || 'Connect RTL-SDR hardware to enable tuning')}</p>
            </div>
            <span className={radioReady ? 'signal-badge live' : 'signal-badge'}>{radioReady ? 'live' : 'disabled'}</span>
          </div>
          <div className="radio-frequency">
            <span>Frequency</span>
            <strong>{radio.frequency || '96.70'} <small>MHz</small></strong>
            <em>{radio.station || 'No station selected'}</em>
          </div>
          <div className="signal-meter">
            <span style={{ width: `${clampNumber(radio.signal_strength ?? (hardwareReady ? 42 : 0), 0, 100)}%` }} />
          </div>
          <div className="radio-controls">
            <button type="button" disabled={!radioReady}>Scan</button>
            <button type="button" disabled={!radioReady}>Tune -</button>
            <button type="button" disabled={!radioReady}>Tune +</button>
            <label>Volume<input type="range" min="0" max="100" defaultValue="42" disabled={!radioReady} /></label>
          </div>
          <div className="preset-grid">
            {presets.map((preset) => (
              <button type="button" key={`${preset.frequency}-${preset.name}`} disabled={!radioReady}>
                <strong>{preset.frequency}</strong>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
          <div className="signal-footnote">Favorites and presets are UI-ready; real tuning needs `rtl_fm` and an RTL-SDR receiver.</div>
        </section>

        <section className="signal-panel aircraft-panel">
          <div className="panel-heading">
            <Plane size={22} />
            <div>
              <h2>Aircraft Tracker</h2>
              <p>{adsbReady ? 'Reading local ADS-B aircraft feed' : (aircraft.message || 'Install/run dump1090 or readsb for live aircraft')}</p>
            </div>
            <span className={adsbReady ? 'signal-badge live' : 'signal-badge'}>{adsbReady ? `${aircraftList.length} nearby` : 'offline'}</span>
          </div>
          <div className="aircraft-map" aria-label="Live aircraft map placeholder">
            <div className="radar-sweep" />
            {aircraftList.slice(0, 6).map((plane, index) => (
              <span
                key={plane.hex || plane.flight || index}
                className="aircraft-dot"
                style={{
                  left: `${18 + ((index * 19) % 68)}%`,
                  top: `${20 + ((index * 13) % 58)}%`
                }}
                title={plane.flight || plane.hex || 'Aircraft'}
              >
                <Plane size={15} />
              </span>
            ))}
          </div>
          <div className="aircraft-list">
            {aircraftList.length ? aircraftList.map((plane, index) => (
              <div key={plane.hex || plane.flight || index}>
                <strong>{plane.flight || plane.hex || 'Unknown flight'}</strong>
                <span>{plane.altitude ?? plane.alt_baro ?? '--'} ft</span>
                <span>{plane.speed ?? plane.gs ?? '--'} kt</span>
                <span>{plane.distance ?? '--'} km</span>
                <em>{plane.direction ?? plane.track ?? '--'} deg</em>
                <small>{plane.route || 'Route unavailable'}</small>
              </div>
            )) : (
              <div className="aircraft-empty">
                <strong>No local aircraft feed yet</strong>
                <span>Install dump1090/readsb and connect an ADS-B antenna. The page stays usable while hardware is missing.</span>
              </div>
            )}
          </div>
        </section>

        <section className="signal-panel signal-hardware-panel">
          <div className="panel-heading">
            <Shield size={22} />
            <div>
              <h2>Hardware Support</h2>
              <p>Built for RTL-SDR Blog V4 USB SDR Receiver and compatible antennas.</p>
            </div>
          </div>
          <div className="dependency-list compact">
            {(sdr.dependencies || []).map((item) => (
              <div key={item.name}>
                <strong>{item.name}</strong>
                <span>{item.available ? 'Installed' : item.install}</span>
              </div>
            ))}
          </div>
          <div className="signal-footnote">Last checked {signal.updatedAt ? new Date(signal.updatedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) : formatClockTime(now, '24')}</div>
        </section>
      </main>
    </section>
  );
}

function RadarPage({ now, goDashboard, goRemoteCamera }) {
  const cameraPagePresence = useCameraPageHeartbeat(true, 'radar');
  const { sensor, refreshSensor } = useUsbCameraSensor(true, {
    sensorIntervalMs: 850,
    logIntervalMs: 12000,
    autoStartReason: 'Radar'
  });
  const network = useNetworkAccess();
  const access = networkAccessLabels(network);
  const camera = sensor.camera || {};
  const motion = sensor.motion || {};
  const brightness = sensor.brightness || {};
  const face = sensor.face || {};
  const motionActive = Boolean(motion.motion);
  const faceActive = Boolean(face.face_detected || face.stable);
  const motionX = Number.isFinite(motion.x) ? Math.max(8, Math.min(92, motion.x * 100)) : 50;
  const motionY = Number.isFinite(motion.y) ? Math.max(8, Math.min(92, motion.y * 100)) : 50;
  const faceX = Number.isFinite(face.x) ? Math.max(8, Math.min(92, (face.x + (face.w || 0) / 2) * 100)) : 50;
  const faceY = Number.isFinite(face.y) ? Math.max(8, Math.min(92, (face.y + (face.h || 0) / 2) * 100)) : 50;
  const motionStrength = Math.round((motion.strength || 0) * 100);
  const brightnessPercent = Math.round(brightness.brightness || 0);
  const cameraStatus = camera.connected ? 'scanning' : sensor.loading ? 'starting' : 'offline';
  const laptopDetail = camera.connected
    ? `Device ${camera.camera_index} / ${camera.width}x${camera.height} / ${camera.actual_fps || '--'} FPS`
    : sensor.error || camera.error || 'Camera sensor is waiting for the backend.';
  const futureModules = [
    {
      name: 'ESP32 HC-SR04 ultrasonic',
      status: 'future module',
      detail: 'Distance, direction estimate, and near-object warning will attach here when an ESP32 bridge is added.'
    },
    {
      name: 'USB camera / laptop camera',
      status: camera.connected ? 'available' : 'waiting',
      detail: 'KISOKE uses one shared OpenCV sensor loop, so Radar does not create a second camera stream.'
    },
    {
      name: 'Future endpoint',
      status: '/api/radar/ultrasonic',
      detail: 'ESP32 can later post distance_cm, zone, confidence, and sensor health to the local backend.'
    }
  ];

  return (
    <section className="radar-page">
      <header className="signal-top radar-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div>
          <h1>Radar</h1>
          <p>Laptop camera motion radar now. ESP32 + HC-SR04 ultrasonic support prepared for later.</p>
        </div>
        <div className="signal-top-actions">
          <button type="button" onClick={refreshSensor}><RefreshCw size={17} /> Refresh sensor</button>
          <button type="button" onClick={goRemoteCamera}><Camera size={17} /> Camera setup</button>
        </div>
      </header>

      <main className="radar-grid">
        <section className="radar-scope-panel">
          <div className="panel-heading">
            <RadarIcon size={24} />
            <div>
              <h2>Room Sensor Scope</h2>
              <p>No recording, no identity matching, no saved frames.</p>
            </div>
            <span className={camera.connected ? 'signal-badge live' : 'signal-badge'}>{cameraStatus}</span>
          </div>

          <div
            className={`radar-scope ${motionActive ? 'motion-active' : ''} ${faceActive ? 'face-active' : ''}`}
            style={{
              '--motion-x': `${motionX}%`,
              '--motion-y': `${motionY}%`,
              '--face-x': `${faceX}%`,
              '--face-y': `${faceY}%`,
              '--motion-strength': `${Math.max(0.18, motionStrength / 100)}`
            }}
          >
            <div className="radar-gridlines" />
            <div className="radar-rings" />
            <div className="radar-crosshair" />
            <div className="radar-sweep" />
            <span className="radar-origin"><Laptop size={20} /></span>
            <span className="radar-blip motion" title="Motion position" />
            <span className="radar-blip face" title="Face presence position" />
            <div className="radar-range-labels">
              <span>left</span>
              <span>center</span>
              <span>right</span>
            </div>
          </div>

          <div className="radar-status-strip">
            <div>
              <span>Motion</span>
              <strong>{motionActive ? 'detected' : 'clear'}</strong>
              <em>{motion.zone || 'none'} / strength {motionStrength}%</em>
            </div>
            <div>
              <span>Brightness</span>
              <strong>{brightnessPercent}%</strong>
              <em>{brightness.level || 'unknown'} / raw {brightness.raw ?? '--'}</em>
            </div>
            <div>
              <span>Face presence</span>
              <strong>{faceActive ? (face.face_detected ? 'detected' : 'recent') : 'none'}</strong>
              <em>{face.position || 'none'} / {face.distance || 'unknown'} / no recognition</em>
            </div>
          </div>
        </section>

        <section className="radar-panel">
          <div className="panel-heading">
            <Camera size={22} />
            <div>
              <h2>Camera Sensor</h2>
              <p>Uses the selected laptop/computer camera through the local backend.</p>
            </div>
          </div>
          <div className="radar-readout-grid">
            <span>Camera <strong>{camera.connected ? 'connected' : 'offline'}</strong></span>
            <span>Device <strong>{camera.camera_index ?? 0}</strong></span>
            <span>Resolution <strong>{camera.width || '--'}x{camera.height || '--'}</strong></span>
            <span>FPS <strong>{camera.actual_fps || '--'}</strong></span>
            <span>Page clients <strong>{cameraPagePresence?.active_page_count ?? 1}</strong></span>
            <span>Last frame <strong>{camera.last_frame_time ? new Date(camera.last_frame_time * 1000).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'none'}</strong></span>
            <span>Backend <strong>{access.primary.backendUrl || DEVICE_API_BASE}</strong></span>
          </div>
          <div className="radar-camera-note">
            <strong>{laptopDetail}</strong>
            <span>Radar reads brightness, motion position, and face presence only. It does not identify anyone.</span>
          </div>
        </section>

        <section className="radar-panel">
          <div className="panel-heading">
            <Gauge size={22} />
            <div>
              <h2>Future Hardware Bay</h2>
              <p>Prepared for ESP32, HC-SR04 ultrasonic distance, USB camera, and laptop camera sensor fusion.</p>
            </div>
          </div>
          <div className="radar-module-list">
            {futureModules.map((module) => (
              <div key={module.name}>
                <strong>{module.name}</strong>
                <span>{module.status}</span>
                <em>{module.detail}</em>
              </div>
            ))}
          </div>
          <div className="radar-ultrasonic-card">
            <span>Ultrasonic distance</span>
            <strong>waiting</strong>
            <em>HC-SR04 data is not connected yet.</em>
          </div>
        </section>

        <section className="radar-panel radar-log-panel">
          <div className="panel-heading">
            <Newspaper size={22} />
            <div>
              <h2>Sensor Log</h2>
              <p>Local camera health messages from the backend.</p>
            </div>
          </div>
          <div className="camera-log-list">
            {(sensor.logs || []).slice(0, 8).map((entry, index) => (
              <code key={`${entry.time}-${index}`}>{entry.level}: {entry.message}</code>
            ))}
            {!(sensor.logs || []).length ? <code>No camera sensor logs yet.</code> : null}
          </div>
          <div className="signal-footnote">Updated {now.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        </section>
      </main>
    </section>
  );
}

function RemoteCameraPage({ now, settings, setSettings, securityLog, goSettings, goClock, pushToast }) {
  const [status, setStatus] = useState(null);
  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [token, setToken] = useState(() => sessionStorage.getItem('nexora.remote-camera-token') || '');
  const [error, setError] = useState('');
  const [motionStatus, setMotionStatus] = useState('No movement detected');
  const [lastMotion, setLastMotion] = useState(null);
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [cameraPermission, setCameraPermission] = useState('unknown');
  const [browserCameras, setBrowserCameras] = useState([]);
  const [selectedBrowserCamera, setSelectedBrowserCamera] = useState(() => localStorage.getItem('nexora.local-camera-device.v1') || '');
  const [backendCameras, setBackendCameras] = useState([]);
  const [localPreviewStatus, setLocalPreviewStatus] = useState('Waiting for camera permission');
  const [streamVersion, setStreamVersion] = useState(0);
  const [streamBroken, setStreamBroken] = useState(false);
  const [snapshotBroken, setSnapshotBroken] = useState(false);
  const [pendingCameraFrame, setPendingCameraFrame] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const lastFrameRef = useRef(null);
  const localStreamRef = useRef(null);
  const autoLiveRequestedRef = useRef(false);
  const cameraRecoveryAtRef = useRef(0);
  const streamRefreshLoopRef = useRef(0);
  const isRemoteClient = !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const network = useNetworkAccess();
  const access = networkAccessLabels(network);
  const liveViewEnabled = settings.cameraMode === 'live' && settings.cameraEnabled && !settings.privacyMode;
  const backendLiveNeeded = isRemoteClient || Boolean(token);
  const sensorEnabled = settings.cameraEnabled && !settings.privacyMode && (settings.cameraMode === 'sensor' || (settings.cameraMode === 'live' && backendLiveNeeded));
  const cameraPagePresence = useCameraPageHeartbeat(sensorEnabled || (liveViewEnabled && backendLiveNeeded), 'remote-camera');
  const { sensor, refreshSensor } = useUsbCameraSensor(sensorEnabled, {
    sensorIntervalMs: liveViewEnabled ? 3000 : 2500,
    logIntervalMs: 15000,
    autoStartReason: 'RemoteCamera'
  });
  const cameraStatus = sensor.camera || {};
  const brightness = sensor.brightness || {};
  const motion = sensor.motion || {};
  const face = sensor.face || {};
  const brightnessPercent = Number.isFinite(Number(brightness.brightness)) ? Math.round(Number(brightness.brightness)) : null;
  const activeLookMode = CAMERA_LOOK_MODES.find((mode) => mode.id === settings.cameraLookMode) || CAMERA_LOOK_MODES.find((mode) => mode.id === 'normal');
  const cameraControlStatus = status?.camera_control_status || cameraStatus.camera_control_status || {};

  const streamUrl = liveViewEnabled && token ? `${DEVICE_API_BASE}/api/remote-camera/stream?token=${encodeURIComponent(token)}&camera=${settings.cameraDevice}&v=${streamVersion}` : '';
  const locked = !token;
  const blockedByHighSecurity = settings.highSecurity && !isRemoteClient && cameraPermission === 'denied';

  useEffect(() => {
    function returnToNormalCameraMode() {
      returnRemoteCameraToSensorMode();
    }
    window.addEventListener('pagehide', returnToNormalCameraMode);
    return () => {
      window.removeEventListener('pagehide', returnToNormalCameraMode);
      returnToNormalCameraMode();
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await fetchJsonWithBackendRecovery(
        `${DEVICE_API_BASE}/api/remote-camera/status`,
        {},
        'Remote camera status failed',
        'RemoteCameraStatus'
      );
      setStatus(data);
      if (typeof data.privacy_mode === 'boolean') setSettings({ privacyMode: data.privacy_mode });
      if (typeof data.camera_enabled === 'boolean') setSettings({ cameraEnabled: data.camera_enabled });
      if (typeof data.camera_device === 'number') setSettings({ cameraDevice: data.camera_device });
      if (data.camera_mode) setSettings({ cameraMode: data.camera_mode });
      if (typeof data.background_adaptive_brightness === 'boolean') setSettings({ backgroundAdaptiveBrightness: data.background_adaptive_brightness });
      if (data.stream_settings) {
        setSettings({
          streamProfile: data.stream_settings.profile,
          streamFps: data.stream_settings.fps,
          streamQuality: data.stream_settings.quality,
          streamWidth: data.stream_settings.width,
          streamHeight: data.stream_settings.height
        });
      }
      if (data.camera_controls) setSettings({ cameraControls: cameraControlsFromBackend(data.camera_controls) });
      if (data.camera_look_mode) setSettings({ cameraLookMode: data.camera_look_mode });
      if (data.mode) setSettings({ mode: data.mode });
      if (typeof data.password_set === 'boolean') setSettings({ passwordSet: data.password_set });
    } catch {
      const startResult = await requestBackendAutostart('RemoteCameraStatus');
      if (startResult.ok || startResult.started || startResult.skipped) {
        await wait(startResult.started ? 1800 : 900);
        try {
          const response = await fetch(`${DEVICE_API_BASE}/api/remote-camera/status`, { cache: 'no-store' });
          const data = await readJsonResponse(response, 'Remote camera status retry failed');
          setStatus(data);
          return;
        } catch {
          // Fall through to the offline status below.
        }
      }
      setStatus({ ok: false, message: 'Remote camera backend is offline.', active_connections: [] });
    }
  }, [setSettings]);

  const refreshCameraDevices = useCallback(async (force = false) => {
    const browserList = [];
    if (!isRemoteClient) {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) throw new Error('Browser camera list is unavailable.');
        const devices = await navigator.mediaDevices.enumerateDevices();
        devices
          .filter((device) => device.kind === 'videoinput')
          .forEach((device, index) => browserList.push({
            id: device.deviceId,
            label: device.label || `Browser camera ${index + 1}`
          }));
        setBrowserCameras(browserList);
        if (!selectedBrowserCamera && browserList.length) {
          const preferred = browserList.find((camera) => /lenovo|fhd/i.test(camera.label)) || browserList[0];
          if (preferred?.id) {
            setSelectedBrowserCamera(preferred.id);
            localStorage.setItem('nexora.local-camera-device.v1', preferred.id);
          }
        }
      } catch {
        setBrowserCameras([]);
      }
    } else {
      setBrowserCameras([]);
    }

    try {
      const data = await fetchJsonWithBackendRecovery(
        `${DEVICE_API_BASE}/api/remote-camera/devices${force ? `?refresh=${Date.now()}` : ''}`,
        {},
        'Camera device list failed',
        'CameraDevices'
      );
      setBackendCameras(data.devices || []);
      if (typeof data.selected === 'number') setSettings({ cameraDevice: data.selected });
    } catch {
      setBackendCameras([]);
    }
  }, [isRemoteClient, selectedBrowserCamera, setSettings]);

  function changeBrowserCamera(deviceId) {
    const cleanId = String(deviceId || '');
    setSelectedBrowserCamera(cleanId);
    if (cleanId) {
      localStorage.setItem('nexora.local-camera-device.v1', cleanId);
    } else {
      localStorage.removeItem('nexora.local-camera-device.v1');
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalPreviewStatus('Switching local preview camera...');
    setStreamVersion((value) => value + 1);
  }

  useEffect(() => {
    refreshStatus();
    refreshCameraDevices();
    const timer = setInterval(refreshStatus, 15000);
    return () => clearInterval(timer);
  }, [refreshStatus, refreshCameraDevices]);

  useEffect(() => {
    setStreamBroken(false);
  }, [streamUrl, settings.privacyMode, settings.cameraMode]);

  useEffect(() => {
    if (!settings.cameraEnabled || settings.privacyMode || !['sensor', 'live'].includes(settings.cameraMode)) return undefined;
    const timer = window.setInterval(async () => {
      const lastFrameMs = Number(cameraStatus.last_frame_time || 0) * 1000;
      const stale = !lastFrameMs || Date.now() - lastFrameMs > 16000;
      if (!stale) return;
      if (Date.now() - cameraRecoveryAtRef.current < 30000) return;
      cameraRecoveryAtRef.current = Date.now();
      try {
        setLocalPreviewStatus('Camera frames stalled. Restarting camera loop...');
        await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/local-camera/restart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camera_index: settings.cameraDevice })
        }, 'Camera loop restart failed', 'CameraNoFrameUpdate');
        await wait(1200);
        await sendCameraPageHeartbeat('remote-camera', true).catch(() => {});
        refreshSensor();
        refreshStatus();
        setStreamBroken(false);
        setStreamVersion((value) => value + 1);
      } catch {
        setLocalPreviewStatus('Camera backend recovery failed. Check backend logs.');
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [settings.cameraEnabled, settings.privacyMode, settings.cameraMode, cameraStatus.last_frame_time, refreshSensor, refreshStatus]);

  useEffect(() => {
    let disposed = false;

    async function startLocalCameraPreview() {
      if (isRemoteClient) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
        }
        setCameraPermission('not needed');
        setLocalPreviewStatus('Remote client: using the laptop backend camera only.');
        return;
      }
      if (!liveViewEnabled) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
        }
        setCameraPermission('not needed');
        setLocalPreviewStatus('Sensor mode uses the shared backend camera. Browser preview is off to avoid webcam conflicts.');
        return;
      }
      if (!settings.cameraEnabled) {
        setLocalPreviewStatus('Camera is disabled.');
        return;
      }
      if (token) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
        }
        setCameraPermission('not needed');
        setLocalPreviewStatus('Backend stream unlocked. Local browser preview paused to avoid webcam conflicts.');
        return;
      }
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser camera is not supported here.');
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
        }
        const videoConstraint = selectedBrowserCamera
          ? { deviceId: { exact: selectedBrowserCamera }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false });
        if (disposed) return;
        localStreamRef.current = stream;
        setCameraPermission('granted');
        setLocalPreviewStatus(selectedBrowserCamera ? 'Local camera preview running' : 'Default local camera preview running');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraPermission('denied');
        setLocalPreviewStatus('Camera permission denied or camera unavailable.');
      }
    }

    startLocalCameraPreview();
    return () => {
      disposed = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [isRemoteClient, settings.cameraEnabled, selectedBrowserCamera, streamVersion, refreshCameraDevices, token, liveViewEnabled]);

  useEffect(() => {
    if (!settings.cameraEnabled || isRemoteClient || !liveViewEnabled || token) return undefined;
    const timer = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      canvas.width = 96;
      canvas.height = 64;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      if (lastFrameRef.current) {
        let diff = 0;
        for (let index = 0; index < pixels.length; index += 16) {
          diff += Math.abs(pixels[index] - lastFrameRef.current[index]);
        }
        if (diff > 18000) {
          const stamp = Date.now();
          setMotionStatus('Motion detected');
          setLastMotion(stamp);
          securityLog.add({ type: 'motion', status: 'ok', detail: 'Local browser motion difference detected. No frame stored.' });
        }
      }
      lastFrameRef.current = new Uint8ClampedArray(pixels);
    }, 1200);
    return () => clearInterval(timer);
  }, [isRemoteClient, settings.cameraEnabled, securityLog, liveViewEnabled, token]);

  useEffect(() => {
    if (!streamBroken || !token || !liveViewEnabled) return undefined;
    const timer = window.setTimeout(() => {
      setStreamBroken(false);
      setStreamVersion((value) => value + 1);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [streamBroken, token, liveViewEnabled]);

  useEffect(() => {
    if (!pendingCameraFrame || !token || !liveViewEnabled) return undefined;
    let disposed = false;
    let attempts = 0;
    const selectedCamera = Number(pendingCameraFrame);
    setLocalPreviewStatus(`Refreshing camera ${selectedCamera} stream until a new frame loads...`);
    const timer = window.setInterval(() => {
      if (disposed) return;
      attempts += 1;
      setStreamBroken(false);
      setStreamVersion((value) => value + 1);
      refreshSensor();
      refreshStatus();
      setLocalPreviewStatus(`Refreshing camera ${selectedCamera} stream... ${attempts}`);
      if (attempts >= 45) {
        window.clearInterval(timer);
        setLocalPreviewStatus(`Camera ${selectedCamera} stream is still waiting. Press Refresh stream or switch camera again.`);
      }
    }, 750);
    streamRefreshLoopRef.current = Number(timer);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      if (streamRefreshLoopRef.current === Number(timer)) streamRefreshLoopRef.current = 0;
    };
  }, [pendingCameraFrame, token, liveViewEnabled, refreshSensor, refreshStatus]);

  async function handleLiveFrameError() {
    setStreamBroken(true);
    if (!token) return;
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/remote-camera/snapshot?token=${encodeURIComponent(token)}&camera=${settings.cameraDevice}&check=${Date.now()}`, {
        cache: 'no-store'
      });
      const type = response.headers.get('content-type') || '';
      if (response.status === 401 || !type.includes('image')) {
        setToken('');
        sessionStorage.removeItem('nexora.remote-camera-token');
        setError('Camera session expired. Enter the password again.');
      }
    } catch {
      setError('Camera frame failed. Refresh the stream or check the backend.');
    }
  }

  async function waitForSelectedCameraFrame(cameraIndex, maxAttempts = 28) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      setLocalPreviewStatus(`Waiting for camera ${cameraIndex} frame... ${attempt}/${maxAttempts}`);
      try {
        await sendCameraPageHeartbeat('remote-camera', true).catch(() => {});
        const data = await fetchJsonWithBackendRecovery(
          `${DEVICE_API_BASE}/api/local-camera/sensor?cameraSwitch=${Date.now()}`,
          {},
          'Camera frame check failed',
          `CameraFrameWait${cameraIndex}`
        );
        const camera = data.camera || {};
        const selected = Number(camera.camera_index);
        const hasFreshFrame = Boolean(camera.last_frame_time) && selected === Number(cameraIndex) && camera.connected !== false;
        refreshSensor();
        refreshStatus();
        setStreamBroken(false);
        setStreamVersion((value) => value + 1);
        if (hasFreshFrame) {
          setLocalPreviewStatus(`Camera ${cameraIndex} has a fresh frame. Enter password again.`);
          return true;
        }
      } catch (error) {
        setLocalPreviewStatus(`Camera ${cameraIndex} still starting...`);
      }
      await wait(attempt < 8 ? 700 : 1200);
    }
    setLocalPreviewStatus(`Camera ${cameraIndex} did not return a fresh frame yet. Login and press Refresh stream.`);
    return false;
  }

  async function syncSettings(patch) {
    const next = { ...settings, ...patch };
    const cameraDeviceChanged = 'cameraDevice' in patch && Number(patch.cameraDevice) !== Number(settings.cameraDevice);
    setSettings(next);
    const shouldRefreshStreamNow = ['streamProfile', 'streamFps', 'streamQuality', 'streamWidth', 'streamHeight', 'cameraDevice'].some((key) => key in patch);
    if (shouldRefreshStreamNow) {
      setStreamBroken(false);
      setStreamVersion((value) => value + 1);
      if (cameraDeviceChanged) {
        setToken('');
        sessionStorage.removeItem('nexora.remote-camera-token');
        setSnapshotUrl('');
        setError('');
        setPendingCameraFrame(next.cameraDevice);
        setLocalPreviewStatus(`Camera ${next.cameraDevice} selected. Restarting backend; enter password again.`);
        securityLog.add({ type: 'camera-switch', status: 'restart', detail: `Switched to backend camera ${next.cameraDevice}. Session cleared.` });
      }
    }
    try {
      const payload = {
        mode: next.mode,
        camera_mode: next.cameraMode,
        camera_enabled: next.cameraEnabled,
        privacy_mode: next.privacyMode,
        high_security: next.highSecurity,
        security_snapshots: next.securitySnapshots,
        camera_device: next.cameraDevice,
        background_adaptive_brightness: next.backgroundAdaptiveBrightness,
        camera_look_mode: next.cameraLookMode,
        stream_profile: next.streamProfile,
        stream_fps: next.streamFps,
        stream_quality: next.streamQuality,
        stream_width: next.streamWidth,
        stream_height: next.streamHeight,
        camera_controls: cameraControlsToBackend(next.cameraControls),
        failed_attempt_threshold: next.failedAttemptThreshold
      };
      const data = await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/remote-camera/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 'Remote camera settings failed', 'RemoteCameraSettings');
      if (!data.ok) throw new Error(data.error || 'Remote camera settings failed');
      if (cameraDeviceChanged) {
        await requestBackendAutostart(`CameraSwitch${next.cameraDevice}`, true);
        await wait(1400);
        setStreamBroken(false);
        setStreamVersion((value) => value + 1);
        setLocalPreviewStatus(`Backend restarted. Waiting for camera ${next.cameraDevice} frame...`);
        await refreshCameraDevices(true);
        await refreshStatus();
        await waitForSelectedCameraFrame(next.cameraDevice);
        return;
      }
      if (typeof data.settings?.background_adaptive_brightness === 'boolean') {
        setSettings({ backgroundAdaptiveBrightness: data.settings.background_adaptive_brightness });
      }
      if (data.settings?.stream_settings) {
        setSettings({
          streamProfile: data.settings.stream_settings.profile,
          streamFps: data.settings.stream_settings.fps,
          streamQuality: data.settings.stream_settings.quality,
          streamWidth: data.settings.stream_settings.width,
          streamHeight: data.settings.stream_settings.height
        });
      }
      if (data.settings?.camera_controls) {
        setSettings({ cameraControls: cameraControlsFromBackend(data.settings.camera_controls) });
      }
      if (data.settings?.camera_look_mode) {
        setSettings({ cameraLookMode: data.settings.camera_look_mode });
      }
      if (shouldRefreshStreamNow) {
        setStreamBroken(false);
        window.setTimeout(() => {
          refreshSensor();
          refreshStatus();
          setStreamVersion((value) => value + 1);
        }, 900);
      }
      refreshStatus();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (autoLiveRequestedRef.current) return undefined;
    if (!settings.cameraEnabled || settings.privacyMode || settings.cameraMode !== 'sensor') return undefined;
    autoLiveRequestedRef.current = true;
    const timer = window.setTimeout(() => {
      setLocalPreviewStatus('Opening live camera view from the laptop backend.');
      syncSettings({ cameraMode: 'live', cameraEnabled: true, privacyMode: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [settings.cameraEnabled, settings.privacyMode, settings.cameraMode]);

  async function setRemotePassword() {
    if (!password.trim()) return;
    try {
      const data = await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/remote-camera/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, old_password: oldPassword })
      }, 'Password save failed', 'RemoteCameraPassword');
      if (!data.ok) throw new Error(data.error || 'Password save failed');
      setSettings({ passwordSet: true });
      setPassword('');
      setOldPassword('');
      securityLog.add({ type: 'password', status: 'ok', detail: 'Remote camera password changed locally.' });
    } catch (err) {
      setError(err.message);
      securityLog.add({ type: 'password', status: 'failed', detail: err.message });
    }
  }

  async function login(event) {
    event.preventDefault();
    if (blockedByHighSecurity) {
      setError('Access denied. Camera permission is required before password login.');
      return;
    }
    try {
      const data = await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/remote-camera/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      }, 'Camera login failed', 'RemoteCameraLogin');
      if (!data.ok) throw new Error(data.error || 'Camera login failed');
      setToken(data.token);
      sessionStorage.setItem('nexora.remote-camera-token', data.token);
      setPassword('');
      setError('');
      setStreamBroken(false);
      setStreamVersion((value) => value + 1);
      if (pendingCameraFrame !== null) {
        setLocalPreviewStatus(`Logged in. Refreshing camera ${pendingCameraFrame} stream until it shows.`);
      }
      securityLog.add({ type: 'login', status: 'ok', detail: `Access from ${data.client_kind || 'private client'}` });
      refreshStatus();
    } catch (err) {
      setError(err.message);
      securityLog.add({ type: 'login', status: 'failed', detail: err.message });
    }
  }

  async function captureSnapshot() {
    if (!token) {
      setError('Unlock camera first.');
      return;
    }
    const url = `${DEVICE_API_BASE}/api/remote-camera/snapshot?token=${encodeURIComponent(token)}&camera=${settings.cameraDevice}&t=${Date.now()}`;
    setSnapshotBroken(false);
    setSnapshotUrl(url);
    securityLog.add({ type: 'snapshot', status: 'local', detail: 'Snapshot requested. No cloud upload.' });
  }

  function logout() {
    setToken('');
    sessionStorage.removeItem('nexora.remote-camera-token');
    setSnapshotUrl('');
    securityLog.add({ type: 'logout', status: 'ok', detail: 'Remote camera session cleared.' });
  }

  return (
    <section className="remote-camera-page">
      <header className="signal-top remote-camera-top">
        <button className="icon-button" type="button" onClick={goClock} aria-label="Back to clock"><ChevronLeft size={24} /></button>
        <div>
          <h1>Remote Camera</h1>
          <p>Local/Tailscale only. Password required. No cloud, no third-party camera service.</p>
        </div>
        <div className="signal-top-actions">
          <button type="button" onClick={refreshStatus}><RefreshCw size={17} /> Refresh</button>
          <button type="button" onClick={goSettings}><Settings size={17} /> Settings</button>
        </div>
      </header>

      <main className="remote-camera-grid">
        <section className="remote-camera-view panel">
          <div className="panel-heading">
            <Camera size={22} />
            <div>
              <h2>KISOKE Live Camera View</h2>
              <p>{localPreviewStatus} / {status?.message || 'Waiting for local backend status'}</p>
            </div>
            <span className={status?.network_allowed ? 'signal-badge live' : 'signal-badge'}>{status?.network_allowed ? status.client_kind : 'blocked'}</span>
          </div>

          <div className="camera-source-controls">
            <div className="camera-source-note">
              <strong>{isRemoteClient ? 'Phone remote view' : 'Computer/laptop camera sensor'}</strong>
              <span>{isRemoteClient ? 'This uses the kiosk computer or laptop camera through the local backend. Use HTTPS or Tailscale HTTPS for phone access in Chrome.' : 'One shared local camera loop is used. Pick the built-in laptop camera or any connected webcam.'}</span>
            </div>
            <label>Backend remote device
              <select
                value={settings.cameraDevice}
                onChange={(event) => syncSettings({ cameraDevice: Number(event.target.value) })}
              >
                {(backendCameras.length ? backendCameras : [0, 1, 2, 3, 4, 5].map((id) => ({ id, label: `Device ${id}` }))).map((camera) => (
                  <option key={camera.id} value={camera.id}>{camera.label || `Device ${camera.id}`}</option>
                ))}
              </select>
            </label>
            {!isRemoteClient && !liveViewEnabled ? (
              <label>Local preview camera
                <select
                  value={selectedBrowserCamera}
                  onChange={(event) => changeBrowserCamera(event.target.value)}
                >
                  <option value="">Auto / browser default</option>
                  {browserCameras.map((camera, index) => (
                    <option key={camera.id || index} value={camera.id}>{camera.label || `Camera ${index + 1}`}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="button" onClick={() => { refreshCameraDevices(true); setStreamVersion((value) => value + 1); }}><RefreshCw size={16} /> Refresh cameras</button>
          </div>

          <div className={`camera-sensor-panel ${cameraStatus.connected ? 'active' : ''}`}>
            <div className="camera-mode-status">
              <span className={sensorEnabled ? 'camera-live-dot active' : 'camera-live-dot'} />
              <div>
                <strong>Camera: {settings.privacyMode ? 'Privacy' : settings.cameraMode === 'live' ? 'Live view' : settings.cameraMode === 'sensor' ? 'Sensor Mode' : 'Off'}</strong>
                <em>{cameraStatus.connected ? `Device ${cameraStatus.camera_index} / stream ${settings.streamWidth}x${settings.streamHeight} / target ${settings.streamFps} FPS / actual ${cameraStatus.actual_fps || '--'} FPS` : sensor.error || 'Camera sensor is waiting.'}</em>
              </div>
            <button type="button" onClick={() => { refreshSensor(); refreshStatus(); }}><RefreshCw size={16} /> Refresh sensor</button>
            </div>
            <div className="sensor-stat-grid">
              <span>Brightness <strong>{brightness.brightness ?? 0}%</strong><em>{brightness.level || 'unknown'} / raw {brightness.raw ?? 0}</em></span>
              <span>Motion <strong>{motion.motion ? 'detected' : 'none'}</strong><em>{motion.zone || 'none'} / strength {Math.round((motion.strength || 0) * 100)}%</em></span>
              <span>Face presence <strong>{face.face_detected ? 'yes' : face.stable ? 'recent' : 'no'}</strong><em>{face.position || 'none'} / {face.distance || 'unknown'} / stable {face.stable ? 'yes' : 'no'}</em></span>
              <span>Last frame <strong>{cameraStatus.last_frame_time ? new Date(cameraStatus.last_frame_time * 1000).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'none'}</strong><em>{settings.cameraMode === 'sensor' ? 'No video shown in sensor mode' : localPreviewStatus}</em></span>
            </div>
          </div>

          {!liveViewEnabled ? (
            <div className="camera-sensor-only-shell">
              <Camera size={40} />
              <strong>{settings.cameraMode === 'off' || !settings.cameraEnabled ? 'Camera is off' : settings.privacyMode || settings.cameraMode === 'privacy' ? 'Privacy mode is active' : 'Sensor-only mode active'}</strong>
              <span>There is no live video in this mode. KISOKE only reads simple room sensor values from the selected local camera: brightness, motion, motion position, and face presence.</span>
              {settings.cameraEnabled && !settings.privacyMode ? (
                <button type="button" onClick={() => syncSettings({ cameraMode: 'live', cameraEnabled: true, privacyMode: false })}>
                  <Eye size={18} /> Start Live View
                </button>
              ) : (
                <button type="button" onClick={() => syncSettings({ cameraMode: 'live', cameraEnabled: true, privacyMode: false })}>
                  <Eye size={18} /> Enable Camera Live View
                </button>
              )}
            </div>
          ) : blockedByHighSecurity ? (
            <div className="camera-lock-panel denied">
              <Lock size={34} />
              <strong>Access denied</strong>
              <span>High Security Mode requires camera permission before the password screen.</span>
            </div>
          ) : locked ? (
            <form className="camera-lock-panel" onSubmit={login}>
              <Lock size={34} />
              <strong>Enter camera password</strong>
              <span>The camera sensor is working. Enter the password to open the authenticated live camera view.</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Camera password" />
              <button type="submit"><Unlock size={17} /> Unlock camera</button>
              {error ? <em>{error}</em> : null}
            </form>
          ) : (
            <div
              className={`camera-live-shell camera-look-${settings.cameraLookMode || 'normal'}`}
              style={cameraPreviewVars(settings.cameraControls)}
            >
              {settings.privacyMode ? (
                <div className="camera-privacy-shield">
                  <Shield size={40} />
                  <strong>Privacy shield active</strong>
                  <span>Turn off Privacy Mode in settings to view the stream.</span>
                </div>
              ) : (
                streamUrl && !streamBroken ? (
                  <img
                    ref={frameRef}
                    src={streamUrl}
                    alt="Local authenticated camera stream"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    onLoad={() => {
                      if (streamBroken) setStreamBroken(false);
                      if (pendingCameraFrame !== null) {
                        setLocalPreviewStatus(`Camera ${settings.cameraDevice} stream loaded.`);
                        setPendingCameraFrame(null);
                      }
                    }}
                    onError={handleLiveFrameError}
                  />
                ) : (
                  <div className="camera-privacy-shield camera-stream-empty">
                    <Camera size={38} />
                    <strong>Live frame refreshing</strong>
                    <span>If this stays here, unlock again or choose another camera device.</span>
                  </div>
                )
              )}
              <div className="camera-live-actions">
                <button type="button" onClick={captureSnapshot}><Camera size={17} /> Snapshot</button>
                <button type="button" onClick={() => { setStreamBroken(false); setStreamVersion((value) => value + 1); }}><RefreshCw size={17} /> Refresh stream</button>
                <button type="button" onClick={() => syncSettings({ privacyMode: !settings.privacyMode })}><Shield size={17} /> {settings.privacyMode ? 'Disable privacy shield' : 'Enable privacy shield'}</button>
                <button type="button" onClick={logout}><Lock size={17} /> Lock</button>
              </div>
              {snapshotUrl && !snapshotBroken ? (
                <img
                  className="camera-snapshot-preview"
                  src={snapshotUrl}
                  alt="Local security snapshot preview"
                  onError={() => setSnapshotBroken(true)}
                />
              ) : null}
            </div>
          )}
        </section>

        <section className="panel remote-camera-status">
          <div className="panel-heading">
            <Eye size={22} />
            <div>
              <h2>Status</h2>
              <p>Motion only. No face recognition, identity matching, or person tracking.</p>
            </div>
          </div>
          <div className="console-grid">
            <span>Phone camera URL <strong>{access.primary.cameraUrl || `${access.primary.url}/localhost-camera`}</strong></span>
            <span>Backend API <strong>{access.primary.backendUrl || `${access.primary.url?.replace(':5173', ':8787')}`}</strong></span>
            <span>Access mode <strong>{settings.mode}</strong></span>
            <span>Camera mode <strong>{settings.cameraMode}</strong></span>
            <span>Stream profile <strong>{settings.streamProfile}</strong></span>
            <span>Stream target <strong>{settings.streamWidth}x{settings.streamHeight} / {settings.streamFps} FPS</strong></span>
            <span>Camera actual FPS <strong>{cameraStatus.actual_fps || '--'}</strong></span>
            <span>Picture mode <strong>{activeLookMode?.label || 'Manual Mode'}</strong></span>
            <span>Picture controls <strong>{cameraControlStatus.unsupported?.length ? `${cameraControlStatus.unsupported.length} limited` : 'active'}</strong></span>
            <span>Connection <strong>{status?.network_allowed ? 'allowed private client' : 'blocked/off'}</strong></span>
            <span>Camera <strong>{settings.cameraEnabled ? 'enabled' : 'disabled'}</strong></span>
            <span>Privacy shield <strong>{settings.privacyMode ? 'on' : 'off'}</strong></span>
            <span>Backend device <strong>{settings.cameraDevice}</strong></span>
            <span>Camera permission <strong>{cameraPermission}</strong></span>
            <span>Motion <strong>{motion.motion ? `${motion.zone} ${Math.round((motion.strength || 0) * 100)}%` : motionStatus}</strong></span>
            <span>Room brightness <strong>{brightness.brightness ?? 0}% / {brightness.level || 'unknown'}</strong></span>
            <span>Face presence <strong>{face.face_detected ? face.distance : face.stable ? 'recent' : 'none'}</strong></span>
            <span>Last motion <strong>{motion.last_seen ? new Date(motion.last_seen * 1000).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) : lastMotion ? new Date(lastMotion).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) : 'none'}</strong></span>
            <span>Security snapshots <strong>{settings.securitySnapshots ? 'enabled locally' : 'disabled'}</strong></span>
            <span>Active connections <strong>{status?.active_connections?.length || 0}</strong></span>
            <span>Camera page clients <strong>{status?.camera_page?.active_page_count ?? cameraPagePresence?.active_page_count ?? 0}</strong></span>
            <span>Adaptive background <strong>{settings.backgroundAdaptiveBrightness ? 'on' : 'off'}</strong></span>
            <span>Snapshot files <strong>{status?.snapshot_count ?? 0}</strong></span>
          </div>
          <div className="device-warning camera-access-hint">{network.hint || 'Phone access works only on the same Wi-Fi or private Tailscale. Do not use public internet exposure.'}</div>
          <div className="active-connection-list">
            {status?.active_connections?.length ? status.active_connections.map((connection, index) => (
              <span key={`${connection.client}-${connection.created_at || index}`}>{connection.kind}: {connection.client}</span>
            )) : <span>No active remote camera sessions.</span>}
          </div>
          <div className="camera-log-list">
            {(sensor.logs || []).slice(0, 6).map((entry, index) => (
              <code key={`${entry.time}-${index}`}>{entry.level}: {entry.message}</code>
            ))}
            {!(sensor.logs || []).length ? <code>No camera sensor logs yet.</code> : null}
          </div>
          <canvas ref={canvasRef} hidden />
        </section>

        <section className="panel remote-camera-settings-card">
          <div className="panel-heading">
            <Shield size={22} />
            <div>
              <h2>Access Controls</h2>
              <p>Camera stream must never be public. Use local network or private Tailscale only.</p>
            </div>
          </div>
          <div className="dock compact">
            <button className={settings.cameraMode === 'off' || !settings.cameraEnabled ? 'active' : ''} onClick={() => syncSettings({ cameraMode: 'off', cameraEnabled: false })}>Camera Off</button>
            <button className={settings.cameraMode === 'sensor' ? 'active' : ''} onClick={() => syncSettings({ cameraMode: 'sensor', cameraEnabled: true, privacyMode: false })}>Sensor Only</button>
            <button className={settings.cameraMode === 'live' ? 'active' : ''} onClick={() => syncSettings({ cameraMode: 'live', cameraEnabled: true, privacyMode: false })}>Live View</button>
            <button className={settings.cameraMode === 'privacy' || settings.privacyMode ? 'active' : ''} onClick={() => syncSettings({ cameraMode: 'privacy', privacyMode: true })}>Privacy</button>
            <button className={settings.mode === 'local' ? 'active' : ''} onClick={() => syncSettings({ mode: 'local' })}>Enable Local Access</button>
            <button className={settings.mode === 'tailscale' ? 'active' : ''} onClick={() => syncSettings({ mode: 'tailscale' })}>Enable Tailscale Access</button>
            <button className={settings.mode === 'both' ? 'active' : ''} onClick={() => syncSettings({ mode: 'both' })}>Enable Local + Tailscale</button>
            <button className={settings.mode === 'disabled' ? 'active' : ''} onClick={() => syncSettings({ mode: 'disabled' })}>Disable All Remote Access</button>
            <button className={settings.cameraEnabled ? 'active' : ''} onClick={() => syncSettings({ cameraEnabled: !settings.cameraEnabled })}>{settings.cameraEnabled ? 'Camera enabled' : 'Camera disabled'}</button>
            <button className={settings.backgroundAdaptiveBrightness ? 'active' : ''} onClick={() => syncSettings({ backgroundAdaptiveBrightness: !settings.backgroundAdaptiveBrightness })}>{settings.backgroundAdaptiveBrightness ? 'Adaptive brightness on' : 'Adaptive brightness off'}</button>
            <button className={settings.highSecurity ? 'active' : ''} onClick={() => syncSettings({ highSecurity: !settings.highSecurity })}>{settings.highSecurity ? 'High security on' : 'High security off'}</button>
            <button className={settings.securitySnapshots ? 'active' : ''} onClick={() => syncSettings({ securitySnapshots: !settings.securitySnapshots })}>{settings.securitySnapshots ? 'Security snapshots on' : 'Security snapshots off'}</button>
          </div>
          <CameraPictureControls
            settings={settings}
            onChange={syncSettings}
            brightnessPercent={brightnessPercent}
            driverStatus={cameraControlStatus}
          />
          <CameraStreamControls settings={settings} onChange={syncSettings} />
          <div className="settings-form-grid">
            <label>Backend camera device
              <select value={settings.cameraDevice} onChange={(event) => syncSettings({ cameraDevice: Number(event.target.value) })}>
                {(backendCameras.length ? backendCameras : [0, 1, 2, 3, 4, 5].map((id) => ({ id, label: `Device ${id}` }))).map((camera) => (
                  <option key={camera.id} value={camera.id}>{camera.label || `Device ${camera.id}`}</option>
                ))}
              </select>
            </label>
            {!isRemoteClient && !liveViewEnabled ? (
              <label>Local preview camera
                <select value={selectedBrowserCamera} onChange={(event) => changeBrowserCamera(event.target.value)}>
                  <option value="">Auto / browser default</option>
                  {browserCameras.map((camera, index) => (
                    <option key={camera.id || index} value={camera.id}>{camera.label || `Camera ${index + 1}`}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {settings.passwordSet ? <label>Current camera password<input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} placeholder="Required to change password" /></label> : null}
            <label>New camera password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={settings.passwordSet ? 'Enter new password' : 'Required before access'} /></label>
            <label>Failed attempt threshold<input type="number" min="1" max="20" value={settings.failedAttemptThreshold} onChange={(event) => syncSettings({ failedAttemptThreshold: Number(event.target.value) })} /></label>
          </div>
          <button type="button" onClick={setRemotePassword}><Lock size={17} /> Save camera password</button>
        </section>

        <section className="panel remote-security-log">
          <div className="panel-heading">
            <Newspaper size={22} />
            <div>
              <h2>Security Log</h2>
              <p>Stored locally only. No cloud uploads.</p>
            </div>
            <button type="button" onClick={securityLog.exportLog}>Export</button>
            <button type="button" onClick={securityLog.clear}>Clear</button>
          </div>
          <div className="command-history-list">
            {securityLog.entries.length ? securityLog.entries.slice(0, 10).map((entry) => (
              <div key={entry.id}>
                <strong>{entry.type}</strong>
                <span>{entry.status}</span>
                <em>{new Date(entry.timestamp).toLocaleString('en-AE')}</em>
                <code>{entry.detail}</code>
              </div>
            )) : <p>No security events yet.</p>}
          </div>
        </section>
      </main>
    </section>
  );
}

const assistantSuggestions = [
  'open settings',
  'open dashboard',
  'open clock',
  'switch to red mode',
  'switch to dark mode',
  'switch to light mode',
  'start 10 minute timer',
  'show weather',
  'mute music',
  'study mode',
  'sleep mode',
  'set volume to 30 percent',
  'turn brightness to 50 percent',
  'turn on night light'
];

function AssistantPanel({ settings, voice, onCommand }) {
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState(`Say "Hey ${settings.assistantName}" or tap the mic.`);
  const selectedModel = chooseAssistantModel(settings, draft);

  async function submit(command = draft) {
    const clean = command.trim();
    if (!clean) return;
    setDraft('');
    const nextReply = await onCommand(clean);
    setReply(nextReply);
  }

  return (
    <section className="panel assistant-panel">
      <div className="panel-heading">
        <Sparkles size={22} />
        <div>
          <h2>{settings.assistantName} AI Help Bot</h2>
          <p>{voice.listening ? 'Always-listening while this page is open' : 'Tap mic or type a command'}</p>
        </div>
      </div>
      <div className="assistant-status">
        <span className={voice.listening ? 'live' : 'cached'}>{voice.listening ? 'Listening' : 'Idle'}</span>
        <span>{voice.supported ? 'Chrome voice ready' : 'Voice may need Chrome/Edge'}</span>
        <span>{selectedModel.label}: {selectedModel.model}</span>
      </div>
      {voice.error && <div className="assistant-error">{voice.error}</div>}
      <div className="assistant-reply">{reply}</div>
      <form className="assistant-command-row" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <button type="button" className={voice.listening ? 'active' : ''} onClick={() => voice.startListening(true)} aria-label="Start voice command">
          {voice.listening ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Ask ${settings.assistantName} or type a command`} />
        <button type="submit" aria-label="Send assistant command"><Send size={18} /></button>
      </form>
      {voice.transcript && <div className="assistant-transcript">Heard: {voice.transcript}</div>}
      <div className="assistant-suggestions">
        {assistantSuggestions.slice(0, 10).map((item) => (
          <button type="button" key={item} onClick={() => submit(item)}>{item}</button>
        ))}
      </div>
    </section>
  );
}

function deviceText(value, fallback = 'Unavailable') {
  if (value == null || value === '') return fallback;
  return String(value);
}

function safePercent(value, fallback = null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(clampNumber(number, 0, 100));
}

function DeviceControlsPanel({ pushToast }) {
  const [tab, setTab] = useState('display');
  const [status, setStatus] = useState(null);
  const network = useNetworkAccess();
  const [loading, setLoading] = useState(false);
  const [brightnessDraft, setBrightnessDraft] = useState(null);
  const [volumeDraft, setVolumeDraft] = useState(null);
  const [wifiNetworks, setWifiNetworks] = useState([]);
  const [bluetoothDevices, setBluetoothDevices] = useState([]);
  const [selectedWifi, setSelectedWifi] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const brightnessWriteTimer = useRef(null);
  const volumeWriteTimer = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/device/status`);
      const data = await readJsonResponse(response, 'Device command failed');
      setStatus(data);
    } catch {
      setStatus({ ok: false, error: 'Backend is not running on port 8787.' });
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const statusTimer = setInterval(loadStatus, 60 * 1000);
    const runtimeTimer = setInterval(loadStatus, 2 * 60 * 1000);
    return () => {
      clearInterval(statusTimer);
      clearInterval(runtimeTimer);
      window.clearTimeout(brightnessWriteTimer.current);
      window.clearTimeout(volumeWriteTimer.current);
    };
  }, [loadStatus]);

  async function post(path, body = {}, options = {}) {
    const silent = Boolean(options.silent);
    const refresh = options.refresh !== false;
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${DEVICE_API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await readJsonResponse(response, 'Wi-Fi scan failed');
      if (data.ok === false && !silent) pushToast('Device control', data.error || data.message || 'Device update failed.', 'amber');
      if (refresh) await loadStatus();
      return data;
    } catch {
      if (!silent) pushToast('Device control', 'Backend is not running on port 8787.', 'amber');
      return { ok: false };
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function scheduleFastPost(timerRef, path, body) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      post(path, body, { silent: true, refresh: false });
    }, 70);
  }

  async function scanWifi() {
    setLoading(true);
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/device/wifi/scan`);
      const data = await readJsonResponse(response, 'Bluetooth scan failed');
      setWifiNetworks(data.networks || []);
      if (data.ok === false) pushToast('Wi-Fi scan', data.error || data.message || 'Wi-Fi scan failed.', 'amber');
    } catch {
      pushToast('Wi-Fi scan', 'Backend is not running on port 8787.', 'amber');
    } finally {
      setLoading(false);
    }
  }

  async function scanBluetooth() {
    setLoading(true);
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/device/bluetooth/scan`);
      const data = await response.json();
      setBluetoothDevices(data.devices || []);
      if (data.ok === false) pushToast('Bluetooth scan', data.error || data.message || 'Bluetooth scan failed.', 'amber');
    } catch {
      pushToast('Bluetooth scan', 'Backend is not running on port 8787.', 'amber');
    } finally {
      setLoading(false);
    }
  }

  const brightness = status?.brightness || {};
  const volume = status?.volume || {};
  const battery = status?.battery || {};
  const runtime = status?.runtime || {};
  const brightnessPercent = safePercent(brightness.percent, null);
  const brightnessSupported = brightness.supported !== false && brightnessPercent != null;
  const brightnessSliderValue = brightnessDraft ?? brightnessPercent ?? 50;
  const volumePercent = safePercent(volume.percent, null);
  const volumeSupported = volume.supported !== false && volume.ok !== false && volumePercent != null;
  const volumeSliderValue = volumeDraft ?? volumePercent ?? 50;
  const access = networkAccessLabels(network);

  useEffect(() => {
    if (brightnessPercent != null) setBrightnessDraft(brightnessPercent);
  }, [brightnessPercent]);

  useEffect(() => {
    if (volumePercent != null) setVolumeDraft(volumePercent);
  }, [volumePercent]);

  return (
    <section className="panel device-panel">
      <div className="panel-heading">
        <Laptop size={22} />
        <div>
          <h2>Device Controls</h2>
          <p>{status?.ok ? 'Local backend controls this laptop' : (status?.error || 'Checking backend')}</p>
        </div>
        <button type="button" onClick={loadStatus} disabled={loading}><RefreshCw size={15} /></button>
      </div>

      <div className="device-summary">
        <span>OS <strong>{status?.os?.name || 'Unknown'}</strong></span>
        <span>Battery <strong>{battery.percent ?? 'n/a'}%</strong></span>
        <span>Runtime <strong>{runtime.seconds ? formatUptime(runtime.seconds) : 'n/a'}</strong></span>
        <span>Power <strong>{status?.power?.mode || 'n/a'}</strong></span>
      </div>

      <div className="device-tabs">
        {['display', 'sound', 'wifi', 'bluetooth', 'system'].map((item) => (
          <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>

      {tab === 'display' && (
        <div className="device-tab-panel">
          <label>Brightness <strong>{brightnessSupported ? `${brightnessSliderValue}%` : 'not available'}</strong></label>
          <input
            type="range"
            min="1"
            max="100"
            value={brightnessSliderValue}
            disabled={!brightnessSupported}
            onChange={(event) => {
              const percent = Number(event.target.value);
              setBrightnessDraft(percent);
              scheduleFastPost(brightnessWriteTimer, '/api/device/brightness', { percent });
            }}
          />
          {!brightnessSupported && <div className="device-warning">{brightness.error || 'Brightness control is not available on this device.'}</div>}
          <div className="dock compact">
            <button disabled={!brightnessSupported || loading} onClick={() => { setBrightnessDraft(15); post('/api/device/brightness', { percent: 15 }); }}>Dim</button>
            <button disabled={!brightnessSupported || loading} onClick={() => { setBrightnessDraft(55); post('/api/device/brightness', { percent: 55 }); }}>Normal</button>
            <button disabled={!brightnessSupported || loading} onClick={() => { setBrightnessDraft(90); post('/api/device/brightness', { percent: 90 }); }}>Bright</button>
          </div>
          <label className="switch-row"><span>Night Light</span><button disabled={status?.night_light?.ok === false || loading} onClick={() => post('/api/device/night-light', { enabled: !status?.night_light?.enabled })}>{status?.night_light?.enabled ? 'On' : 'Off'}</button></label>
          {status?.night_light?.ok === false && <div className="device-warning">{status.night_light.error}</div>}
        </div>
      )}

      {tab === 'sound' && (
        <div className="device-tab-panel">
          <label>Volume <strong>{volumeSupported ? `${volumeSliderValue}%` : 'not available'}</strong></label>
          <input
            type="range"
            min="0"
            max="100"
            value={volumeSliderValue}
            disabled={!volumeSupported}
            onChange={(event) => {
              const percent = Number(event.target.value);
              setVolumeDraft(percent);
              scheduleFastPost(volumeWriteTimer, '/api/device/volume', { percent });
            }}
          />
          {volume.ok === false && <div className="device-warning">{volume.error}</div>}
          <div className="dock compact">
            <button disabled={!volumeSupported || loading} onClick={() => post('/api/device/volume/mute', { muted: !volume.muted })}>{volume.muted ? 'Unmute' : 'Mute'}</button>
            <button disabled={!volumeSupported || loading} onClick={() => { const next = Math.max(0, volumeSliderValue - 10); setVolumeDraft(next); post('/api/device/volume', { percent: next }); }}>- Volume</button>
            <button disabled={!volumeSupported || loading} onClick={() => { const next = Math.min(100, volumeSliderValue + 10); setVolumeDraft(next); post('/api/device/volume', { percent: next }); }}>+ Volume</button>
          </div>
        </div>
      )}

      {tab === 'wifi' && (
        <div className="device-tab-panel">
          <div className="local-access-card">
            <span>Open on phone</span>
            <strong>{access.primary.url}</strong>
            <small>Camera: {access.primary.cameraUrl || `${access.primary.url}/localhost-camera`}</small>
            {access.secondary ? <small>{access.secondary.name}: {access.secondary.url}</small> : null}
            {network.hint ? <small>{network.hint}</small> : null}
            <button type="button" onClick={network.refresh}><RefreshCw size={14} /> Refresh IP</button>
          </div>
          <div className="switch-row"><span>Wi-Fi: {status?.wifi?.enabled ? 'On' : 'Off'} / {status?.wifi?.ssid || 'not connected'}</span><button onClick={() => post('/api/device/wifi/toggle', { enabled: !status?.wifi?.enabled })}>Toggle</button></div>
          <button onClick={scanWifi} disabled={loading}><Wifi size={16} /> Scan Wi-Fi</button>
          <select value={selectedWifi} onChange={(event) => setSelectedWifi(event.target.value)}>
            <option value="">Choose network</option>
            {wifiNetworks.map((network) => <option key={`${network.ssid}-${network.signal}`} value={network.ssid}>{network.ssid} {network.signal}%</option>)}
          </select>
          <input type="password" value={wifiPassword} onChange={(event) => setWifiPassword(event.target.value)} placeholder="Wi-Fi password if needed" />
          <button onClick={() => selectedWifi && post('/api/device/wifi/connect', { ssid: selectedWifi, password: wifiPassword })}>Connect</button>
        </div>
      )}

      {tab === 'bluetooth' && (
        <div className="device-tab-panel">
          <div className="switch-row"><span>Bluetooth: {status?.bluetooth?.enabled ? 'On' : 'Off'}</span><button onClick={() => post('/api/device/bluetooth/toggle', { enabled: !status?.bluetooth?.enabled })}>Toggle</button></div>
          <button onClick={scanBluetooth} disabled={loading}><Bluetooth size={16} /> Scan Bluetooth</button>
          <div className="device-list">
            {bluetoothDevices.map((device) => (
              <div key={device.address}>
                <span>{device.name || device.address}</span>
                <button onClick={() => post('/api/device/bluetooth/connect', { address: device.address })}>Connect</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'system' && (
        <div className="device-tab-panel">
          <div className="tool-readout">Detected OS: {status?.os?.name || 'Unknown'}{status?.os?.supported === false ? ' / some controls may not work' : ''}</div>
          <div className="power-mode-row">
            {[
              ['performance', 'Performance'],
              ['normal', 'Balanced'],
              ['battery-saver', 'Power saver']
            ].map(([value, label]) => (
              <button key={value} className={status?.power?.mode === value ? 'active' : ''} onClick={() => post('/api/device/power', { mode: value })}>{label}</button>
            ))}
          </div>
          <div className="quick-toggle-grid">
            <button onClick={() => post('/api/device/dnd', { enabled: !status?.do_not_disturb?.enabled })}><Bell size={16} /> DND</button>
            <button onClick={() => post('/api/device/airplane', { enabled: !status?.airplane?.enabled })}><Plane size={16} /> Airplane</button>
            <button onClick={() => post('/api/device/tailscale', { enabled: !status?.tailscale?.enabled })}><Shield size={16} /> Tailscale</button>
            <button onClick={() => post('/api/device/tailscale', { enabled: true, serve: true })}><Shield size={16} /> Serve</button>
            <button onClick={() => post('/api/device/tailscale', { enabled: false, serve: false })}><Shield size={16} /> Stop VPN</button>
            <button disabled={!brightnessSupported || loading} onClick={() => { const next = Math.max(1, brightnessSliderValue - 10); setBrightnessDraft(next); post('/api/device/brightness', { percent: next }); }}>Dim</button>
            <button disabled={!brightnessSupported || loading} onClick={() => { const next = Math.min(100, brightnessSliderValue + 10); setBrightnessDraft(next); post('/api/device/brightness', { percent: next }); }}>Bright</button>
            <button disabled={!volumeSupported || loading} onClick={() => post('/api/device/volume/mute', { muted: !volume.muted })}>Mute</button>
          </div>
        </div>
      )}

      {status?.dependencies && (
        <details className="dependency-details">
          <summary>Missing software</summary>
          {Object.entries(status.dependencies).filter(([, value]) => !value.available).slice(0, 6).map(([name, value]) => (
            <div key={name}><strong>{name}</strong><span>{value.install}</span></div>
          ))}
        </details>
      )}
    </section>
  );
}

function SoftwareNeededPanel({ compact = false, openPage }) {
  const isWindowsClient = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
  const installCode = isWindowsClient
    ? `cd C:\\Users\\saeed\\OneDrive\\Documents\\KISOKE\npowershell -ExecutionPolicy Bypass -File .\\code-needed-to-download-windows.ps1\npowershell -ExecutionPolicy Bypass -File .\\run_local_windows.ps1`
    : `cd ~/Documents/KISOKE\nchmod +x code-needed-to-download.sh\n./code-needed-to-download.sh\nALLOW_DEVICE_CONTROL=true bash start-kiosk.sh`;
  return (
    <section className="panel software-panel">
      <div className="panel-heading">
        <Power size={22} />
        <div>
          <h2>Software Needed</h2>
          <p>One installer for display, sound, Night Light, Wi-Fi, Bluetooth, Tailscale, Ollama, AI, backend</p>
        </div>
      </div>
      <pre>{installCode}</pre>
      {openPage && <button type="button" onClick={openPage}>Open full software page</button>}
      {!compact && (
        <div className="software-list">
          <span>brightnessctl</span>
          <span>network-manager</span>
          <span>bluetooth / bluez</span>
          <span>pulseaudio-utils / wireplumber</span>
          <span>power-profiles-daemon</span>
          <span>upower</span>
          <span>tailscale</span>
          <span>rtl-sdr</span>
          <span>dump1090 / readsb</span>
          <span>ollama</span>
        </div>
      )}
    </section>
  );
}

function SoftwareNeededPage({ goBack }) {
  const isWindowsClient = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
  const rows = [
    { group: 'Required', name: 'Node.js + npm', purpose: 'Runs the Vite kiosk frontend', command: 'sudo apt install -y nodejs npm' },
    { group: 'Required', name: 'Python 3 + pip + venv', purpose: 'Runs the FastAPI local backend', command: 'sudo apt install -y python3 python3-venv python3-pip' },
    { group: 'Required', name: 'FastAPI backend deps', purpose: 'AI, device control, and system status server', command: 'cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt' },
    { group: 'Required', name: 'Ollama', purpose: 'Local AI models with no cloud key', command: 'curl -fsSL https://ollama.com/install.sh | sh' },
    { group: 'Required', name: 'llama3.2', purpose: 'General conversation, writing, and summaries', command: 'ollama pull llama3.2' },
    { group: 'Required', name: 'phi3.5', purpose: 'Strong reasoning, math, and logic tasks', command: 'ollama pull phi3.5' },
    { group: 'Required', name: 'gemma2:2b', purpose: 'Fast creative writing and follow-up chatting', command: 'ollama pull gemma2:2b' },
    { group: 'Required', name: 'qwen2.5:3b', purpose: 'Coding help and multilingual tasks', command: 'ollama pull qwen2.5:3b' },
    { group: 'Required', name: 'brightnessctl', purpose: 'Screen brightness control on Ubuntu', command: 'sudo apt install -y brightnessctl' },
    { group: 'Required', name: 'NetworkManager / nmcli', purpose: 'Wi-Fi scan and connect controls', command: 'sudo apt install -y network-manager' },
    { group: 'Required', name: 'PulseAudio / WirePlumber tools', purpose: 'Volume and mute controls', command: 'sudo apt install -y pulseaudio-utils wireplumber' },
    { group: 'Optional', name: 'BlueZ + Blueman', purpose: 'Bluetooth scan, pair, connect, remove', command: 'sudo apt install -y bluetooth bluez blueman' },
    { group: 'Optional', name: 'espeak-ng + ffmpeg', purpose: 'Backend speech and audio helpers', command: 'sudo apt install -y espeak-ng ffmpeg' },
    { group: 'Optional', name: 'Tailscale', purpose: 'Private remote access from phone/laptop', command: 'curl -fsSL https://tailscale.com/install.sh | sh' },
    { group: 'Optional', name: 'power-profiles-daemon + upower', purpose: 'Power profile, battery, and runtime status', command: 'sudo apt install -y power-profiles-daemon upower' },
    { group: 'Optional', name: 'rtl-sdr', purpose: 'RTL-SDR Blog V4 hardware detection and FM radio tools', command: 'sudo apt install -y rtl-sdr' },
    { group: 'Optional', name: 'dump1090 / readsb', purpose: 'Local ADS-B aircraft tracking feed for Signal Center', command: 'sudo apt install -y dump1090-mutability || true' }
  ];
  const fullCommand = isWindowsClient
    ? `powershell -ExecutionPolicy Bypass -File .\\code-needed-to-download-windows.ps1\npowershell -ExecutionPolicy Bypass -File .\\run_local_windows.ps1`
    : `chmod +x code-needed-to-download.sh\n./code-needed-to-download.sh`;
  return (
    <section className="tools-page software-needed-page">
      <header className="dash-top tools-top">
        <button className="icon-button" onClick={goBack} aria-label="Back"><ChevronLeft size={24} /></button>
        <div>
          <h1>Software Needed</h1>
          <p>Everything KISOKE needs for display, sound, AI, Wi-Fi, Bluetooth, Tailscale, and device control.</p>
        </div>
      </header>
      <main className="software-needed-grid">
        <section className="panel software-panel hero-software-panel">
          <div className="panel-heading">
            <Power size={22} />
            <div>
              <h2>One Code To Install</h2>
              <p>Run this inside the KISOKE folder on {isWindowsClient ? 'Windows' : 'Ubuntu'}.</p>
            </div>
          </div>
          <pre>{fullCommand}</pre>
        </section>
        {rows.map((row) => (
          <section className="panel software-row-panel" key={`${row.group}-${row.name}`}>
            <span>{row.group}</span>
            <h2>{row.name}</h2>
            <p>{row.purpose}</p>
            <code>{row.command}</code>
          </section>
        ))}
      </main>
    </section>
  );
}

function ToastStack({ toasts }) {
  const [expandedId, setExpandedId] = useState(null);
  return (
    <div className="toast-stack" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            type="button"
            key={toast.id}
            className={`tiny-toast ${toast.tone || 'green'} ${expandedId === toast.id ? 'expanded' : ''}`}
            onClick={() => setExpandedId((current) => current === toast.id ? null : toast.id)}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            <span />
            <div>
              <strong>{toast.title}</strong>
              {toast.detail && <p>{toast.detail}</p>}
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ListeningOrb({ settings, voice }) {
  if (!settings.voiceAssistant && !settings.alwaysShowOrb) return null;
  const phase = voice.phase || (voice.error ? 'error' : voice.listening ? (voice.wakeActive ? 'heard wake word' : 'listening') : 'idle');
  const label = settings.voiceMode === 'off' || !settings.voiceAssistant ? 'idle' : phase;
  return (
    <button
      className={`listening-orb ${voice.listening ? 'listening' : ''} ${voice.wakeActive ? 'awake' : ''} phase-${String(label).replace(/\s+/g, '-')}`}
      type="button"
      onClick={() => voice.listening ? voice.stopListening() : voice.startListening(true)}
      aria-label={voice.listening ? 'Stop listening' : 'Start listening'}
    >
      <span className="orb-core" />
      <span className="orb-ring one" />
      <span className="orb-ring two" />
      <span className="orb-ring three" />
      <em>{settings.assistantName}</em>
      <small>{label}</small>
      {settings.showOrbTranscript && voice.transcript && <b>{voice.transcript}</b>}
    </button>
  );
}

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    window.__KISOKE_ERRORS__ = [{ message: error?.message, stack: error?.stack, info }, ...(window.__KISOKE_ERRORS__ || [])].slice(0, 5);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="panel app-error-panel">
          <div className="panel-heading">
            <Shield size={22} />
            <div>
              <h2>KISOKE view error</h2>
              <p>The app caught this instead of leaving a black screen.</p>
            </div>
          </div>
          <pre>{this.state.error.message}</pre>
          <button type="button" onClick={() => this.setState({ error: null })}>Try again</button>
        </section>
      );
    }
    return this.props.children;
  }
}

function SmartBriefPanel({ now, weather, weatherMood, prayer, news, system, todoLists, hydration, habits, agenda, dailyGoals, roomMode }) {
  const openTasks = Object.values(todoLists).flat().filter((todo) => !todo.done).length;
  const agendaNext = agenda.entries.find((entry) => {
    const [hours, minutes] = entry.time.split(':').map(Number);
    const date = new Date(now);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date >= now;
  });
  const hydrationPct = Math.min(100, Math.round((hydration.amount / hydration.goal) * 100));
  const systemStatus = system.cpuPercent > 80 || system.ram.percent > 86 ? 'Host is busy' : system.pingMs == null ? 'Network check pending' : 'Host is steady';
  const advice = [
    weather.feels >= 38 ? 'Heat is high outside. Keep water nearby.' : weather.humidity >= 70 ? 'Humidity is high. Keep the room cool.' : 'Weather is stable.',
    `${prayer.name} in ${prayer.countdown}.`,
    agendaNext ? `Next plan: ${agendaNext.time} ${agendaNext.title}.` : 'No more agenda items today.',
    `${openTasks} open task${openTasks === 1 ? '' : 's'}, hydration ${hydrationPct}%, habits ${habits.completed}/${habits.habits.length}.`,
    `Room mode ${ROOM_MODES.find((mode) => mode.id === roomMode)?.label || roomMode}, daily goals ${dailyGoals.progress}%.`
  ];

  return (
    <section className="panel smart-brief-panel">
      <div className="panel-heading">
        <Gauge size={22} />
        <div>
          <h2>Smart Brief</h2>
          <p>Local command summary for the room</p>
        </div>
      </div>
      <div className="brief-hero">
        <span>{weatherMood.label}</span>
        <strong>{systemStatus}</strong>
        <em>{now.toLocaleDateString('en-AE', { weekday: 'long', month: 'short', day: 'numeric' })}</em>
      </div>
      <div className="brief-list">
        {advice.map((item) => <div key={item}>{item}</div>)}
      </div>
    </section>
  );
}

function SmartReminderPanel({ reminders }) {
  return (
    <section className="panel smart-reminder-panel">
      <div className="panel-heading">
        <Bell size={22} />
        <div>
          <h2>Smart Reminders</h2>
          <p>Prayer, study, sleep, water, and laptop alerts</p>
        </div>
      </div>
      <div className="reminder-list">
        {reminders.map((reminder) => {
          const Icon = reminder.Icon || Bell;
          return (
            <div key={reminder.id} className={`reminder-row ${reminder.tone || 'green'}`}>
              <Icon size={18} />
              <div>
                <strong>{reminder.title}</strong>
                <span>{reminder.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoomModePanel({ roomMode, setRoomMode }) {
  return (
    <section className="panel room-mode-panel">
      <div className="panel-heading">
        <Shield size={22} />
        <div>
          <h2>Room Activity State</h2>
          <p>Focus, relax, sleep, gaming, prayer, or away</p>
        </div>
      </div>
      <div className="room-mode-grid">
        {ROOM_MODES.map((mode) => (
          <button key={mode.id} type="button" className={roomMode === mode.id ? 'active' : ''} onClick={() => setRoomMode(mode.id)}>
            {mode.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function QuickLinksPanel({ links }) {
  return (
    <section className="panel quick-links-panel">
      <div className="panel-heading">
        <Network size={22} />
        <div>
          <h2>Quick Links</h2>
          <p>Fast browser launch buttons saved locally</p>
        </div>
      </div>
      <form className="quick-link-form" onSubmit={links.addLink}>
        <input value={links.draft.label} onChange={(event) => links.setDraft({ ...links.draft, label: event.target.value })} placeholder="Name" />
        <input value={links.draft.url} onChange={(event) => links.setDraft({ ...links.draft, url: event.target.value })} placeholder="https:// site" />
        <button type="submit" aria-label="Add quick link"><Plus size={18} /></button>
      </form>
      <div className="quick-link-grid">
        {links.links.map((link) => (
          <div key={link.id} className="quick-link">
            <a href={link.url} target="_blank" rel="noreferrer">{link.label}<ExternalLink size={13} /></a>
            <button type="button" onClick={() => links.removeLink(link.id)} aria-label={`Remove ${link.label}`}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AirQualityPanel({ air, weather }) {
  const status = getAirQualityStatus(air);
  const dustWatch = weather.wind >= 24 || weather.humidity >= 70 || (air.loaded && air.pm10 >= 70);

  return (
    <section className={`panel air-panel ${status.tone}`}>
      <div className="panel-heading">
        <Cloud size={22} />
        <div>
          <h2>Air Quality</h2>
          <p>{air.loaded ? 'Open-Meteo live AQI' : 'Waiting for outdoor air feed'}</p>
        </div>
      </div>
      <div className="air-score">
        <span>AQI</span>
        <strong>{air.aqi ?? '--'}</strong>
        <em>{status.label}</em>
      </div>
      <div className="air-metrics">
        <div><span>PM10</span><strong>{air.pm10 ?? '--'}</strong><em>ug/m3</em></div>
        <div><span>PM2.5</span><strong>{air.pm25 ?? '--'}</strong><em>ug/m3</em></div>
        <div><span>Humidity</span><strong>{weather.humidity}%</strong><em>{weather.humidity >= 70 ? 'sticky' : 'ok'}</em></div>
      </div>
      <div className={dustWatch ? 'air-warning active' : 'air-warning'}>
        <Wind size={15} />
        <span>{dustWatch ? 'Dust or humidity watch active' : status.detail}</span>
      </div>
    </section>
  );
}

function DailyGoalsPanel({ dailyGoals }) {
  return (
    <section className="panel daily-goals-panel">
      <div className="panel-heading">
        <Target size={22} />
        <div>
          <h2>Daily Goals</h2>
          <p>Three main tasks with progress</p>
        </div>
      </div>
      <div className="goals-progress">
        <div><span style={{ width: `${dailyGoals.progress}%` }} /></div>
        <strong>{dailyGoals.progress}%</strong>
      </div>
      <div className="goal-panel-list">
        {dailyGoals.goals.map((goal, index) => (
          <label key={goal.id} className={goal.done ? 'goal-row-panel done' : 'goal-row-panel'}>
            <button type="button" onClick={() => dailyGoals.toggleGoal(goal.id)} aria-label={`${goal.done ? 'Clear' : 'Complete'} goal ${index + 1}`}>
              <Check size={15} />
            </button>
            <input value={goal.title} onChange={(event) => dailyGoals.updateGoal(goal.id, event.target.value)} aria-label={`Goal ${index + 1}`} />
          </label>
        ))}
      </div>
      <button type="button" className="panel-reset-button" onClick={dailyGoals.resetGoals}>Reset today</button>
    </section>
  );
}

function ExamCountdownPanel({ exams, now }) {
  const [expanded, setExpanded] = useState(null);
  const sorted = exams.items
    .map((item) => ({ ...item, daysLeft: daysUntilDate(item.date, now) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <section className="panel exam-panel">
      <div className="panel-heading">
        <CalendarDays size={22} />
        <div>
          <h2>Exam Countdown</h2>
          <p>Exams, projects, holidays, Eid, Ramadan</p>
        </div>
      </div>
      <form className="exam-form" onSubmit={exams.addCountdown}>
        <input value={exams.draft.title} onChange={(event) => exams.setDraft({ ...exams.draft, title: event.target.value })} placeholder="Countdown title" />
        <input type="date" value={exams.draft.date} onChange={(event) => exams.setDraft({ ...exams.draft, date: event.target.value })} />
        <button type="submit"><Plus size={18} /></button>
      </form>
      <div className="exam-grid">
        {sorted.map((item) => (
          <div
            key={item.id}
            className={`exam-card ${item.daysLeft <= 3 ? 'urgent' : item.daysLeft <= 14 ? 'soon' : 'steady'}`}
            role="button"
            tabIndex={0}
            onClick={() => setExpanded(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setExpanded(item);
              }
            }}
          >
            <span>{item.title}</span>
            <strong>{item.daysLeft < 0 ? 'Done' : item.daysLeft}</strong>
            <em>{item.daysLeft === 1 ? 'day left' : 'days left'}</em>
            <small>{new Date(`${item.date}T12:00:00`).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}</small>
            <button
              type="button"
              aria-label={`Remove ${item.title}`}
              onClick={(event) => {
                event.stopPropagation();
                exams.removeCountdown(item.id);
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div className="exam-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExpanded(null)}>
            <motion.div
              className={`exam-modal ${expanded.daysLeft <= 3 ? 'urgent' : expanded.daysLeft <= 14 ? 'soon' : 'steady'}`}
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 18, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <span>{expanded.title}</span>
              <strong>{expanded.daysLeft < 0 ? 'Finished' : expanded.daysLeft}</strong>
              <em>{expanded.daysLeft === 1 ? 'day left' : 'days left'}</em>
              <p>{new Date(`${expanded.date}T12:00:00`).toLocaleDateString('en-AE', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <button type="button" onClick={() => setExpanded(null)}>Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function AgendaPanel({ agenda, timeFormat, now }) {
  const nextId = agenda.entries.find((entry) => {
    const [hours, minutes] = entry.time.split(':').map(Number);
    const date = new Date(now);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date >= now;
  })?.id;

  return (
    <section className="panel agenda-panel">
      <div className="panel-heading">
        <Clock3 size={22} />
        <div>
          <h2>Today Agenda</h2>
          <p>{shortDateLabel(now)} schedule and reminders</p>
        </div>
      </div>
      <form className="agenda-form" onSubmit={agenda.addEntry}>
        <input type="time" value={agenda.draft.time} onChange={(event) => agenda.setDraft({ ...agenda.draft, time: event.target.value })} />
        <input value={agenda.draft.title} onChange={(event) => agenda.setDraft({ ...agenda.draft, title: event.target.value })} placeholder="Add plan" />
        <button type="submit"><Plus size={18} /></button>
      </form>
      <div className="agenda-list">
        {agenda.entries.map((entry) => {
          const [hours, minutes] = entry.time.split(':').map(Number);
          const date = new Date(now);
          date.setHours(hours || 0, minutes || 0, 0, 0);
          return (
            <div key={entry.id} className={entry.id === nextId ? 'agenda-row next' : 'agenda-row'}>
              <time>{formatClockTime(date, timeFormat)}</time>
              <span>{entry.title}</span>
              <button type="button" onClick={() => agenda.removeEntry(entry.id)} aria-label={`Remove ${entry.title}`}><Trash2 size={14} /></button>
            </div>
          );
        })}
        {!agenda.entries.length && <p className="panel-empty">No plans for today.</p>}
      </div>
    </section>
  );
}

function HydrationPanel({ hydration }) {
  const pct = Math.min(100, Math.round((hydration.amount / hydration.goal) * 100));

  return (
    <section className="panel hydration-panel">
      <div className="panel-heading">
        <Droplets size={22} />
        <div>
          <h2>Hydration</h2>
          <p>Daily water tracker</p>
        </div>
      </div>
      <div className="hydration-ring" style={{ '--water': `${pct}%` }}>
        <strong>{hydration.amount}</strong>
        <span>ml / {hydration.goal}</span>
      </div>
      <div className="hydration-actions">
        <button type="button" onClick={() => hydration.addWater(250)}>+250</button>
        <button type="button" onClick={() => hydration.addWater(500)}>+500</button>
        <button type="button" onClick={hydration.resetToday}>Reset</button>
      </div>
      <label className="goal-row">
        <span>Goal</span>
        <input type="number" min="500" max="6000" step="100" value={hydration.goal} onChange={(event) => hydration.setGoal(event.target.value)} />
      </label>
      <div className="mini-week">
        {hydration.week.map((day) => (
          <span key={day.key} style={{ '--level': Math.min(1, day.amount / hydration.goal) }}>
            <em>{day.label}</em>
            <strong>{Math.round((day.amount / hydration.goal) * 100) || 0}%</strong>
          </span>
        ))}
      </div>
    </section>
  );
}

function HabitPanel({ habits }) {
  return (
    <section className="panel habit-panel">
      <div className="panel-heading">
        <Check size={22} />
        <div>
          <h2>Habit Streaks</h2>
          <p>{habits.completed}/{habits.habits.length} done today</p>
        </div>
      </div>
      <form className="habit-form" onSubmit={habits.addHabit}>
        <input value={habits.draft} onChange={(event) => habits.setDraft(event.target.value)} placeholder="New habit" />
        <button type="submit"><Plus size={18} /></button>
      </form>
      <div className="habit-list">
        {habits.habits.map((habit) => {
          const done = Boolean(habit.history?.[habits.today]);
          return (
            <div key={habit.id} className={done ? 'habit-row done' : 'habit-row'}>
              <button type="button" onClick={() => habits.toggleHabit(habit.id)} aria-label={`${done ? 'Clear' : 'Complete'} ${habit.title}`}><Check size={15} /></button>
              <span>{habit.title}</span>
              <em>{habitStreak(habit)}d</em>
              <button type="button" onClick={() => habits.removeHabit(habit.id)} aria-label={`Remove ${habit.title}`}><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SleepReadinessPanel({ readiness, caffeine }) {
  return (
    <section className={`panel sleep-readiness-panel ${readiness.score >= 82 ? 'ready' : readiness.score >= 62 ? 'prepare' : 'blocked'}`}>
      <div className="panel-heading">
        <Moon size={22} />
        <div>
          <h2>Sleep Readiness</h2>
          <p>Caffeine, hydration, time, and room mode</p>
        </div>
      </div>
      <div className="sleep-score" style={{ '--sleep': `${readiness.score}%` }}>
        <strong>{readiness.score}</strong>
        <span>{readiness.label}</span>
      </div>
      <div className="sleep-factors">
        {readiness.factors.map((factor) => <span key={factor}>{factor}</span>)}
      </div>
      <div className="sleep-actions">
        {readiness.actions.map((action) => <em key={action}>{action}</em>)}
      </div>
      <div className="caffeine-controls">
        <button type="button" onClick={caffeine.logCaffeine}><Coffee size={15} /> Log caffeine</button>
        <button type="button" onClick={caffeine.clearCaffeine}>Clear</button>
        <span>{caffeine.lastAt ? `Logged ${formatRelativeTime(caffeine.lastAt)}` : 'No caffeine logged'}</span>
      </div>
    </section>
  );
}

function NewsPanel({ news, timeFormat }) {
  const [showHistory, setShowHistory] = useState(false);
  const topStory = news.items[0];
  const sideStories = news.items.slice(1, 4);
  const viewedToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return news.viewHistory.filter((item) => item.viewedAt >= start.getTime());
  }, [news.viewHistory]);

  return (
    <section className="panel news-panel">
      <div className="panel-heading news-heading">
        <Newspaper size={22} />
        <div>
          <h2>Daily News Brief</h2>
          <p>{news.loaded ? 'Gulf News feed, refreshes every 1 min' : 'Loading Gulf News'}</p>
        </div>
        <div className="news-actions">
          <button type="button" onClick={news.refresh} aria-label="Refresh news"><RefreshCw size={15} /> Refresh</button>
          <button type="button" className={showHistory ? 'active' : ''} onClick={() => setShowHistory(!showHistory)} aria-label="Show news history"><Eye size={15} /> History</button>
        </div>
      </div>

      {topStory ? (
        <a className="lead-story" href={topStory.url} target="_blank" rel="noreferrer" onClick={() => news.recordView(topStory)}>
          <span>{topStory.category}</span>
          <strong>{topStory.title}</strong>
          {topStory.summary && <em>{topStory.summary}</em>}
          <small>{formatRelativeTime(topStory.publishedAt)} <ExternalLink size={13} /></small>
        </a>
      ) : (
        <div className="news-empty">News is waiting for the local server feed.</div>
      )}

      <div className="news-list">
        {sideStories.map((story) => (
          <a key={story.id} href={story.url} target="_blank" rel="noreferrer" onClick={() => news.recordView(story)}>
            <span>{story.category}</span>
            <strong>{story.title}</strong>
            <em>{formatRelativeTime(story.publishedAt)}</em>
          </a>
        ))}
      </div>

      <div className="news-footer">
        <span>{news.fetchedAt ? `Updated ${formatClockTime(new Date(news.fetchedAt), timeFormat)}` : 'Waiting for first update'}</span>
        <span>{news.cached ? 'cached' : 'live'}</span>
        <span>{viewedToday.length} viewed today</span>
      </div>

      {showHistory && (
        <div className="news-history">
          <strong>View History</strong>
          {(news.viewHistory.length ? news.viewHistory : news.history).slice(0, 5).map((item) => (
            <a key={item.id || item.fetchedAt} href={item.url || news.source} target="_blank" rel="noreferrer">
              <span>{item.category || 'Refresh'}</span>
              <em>{item.title || item.top}</em>
              <small>{formatRelativeTime(item.viewedAt || item.fetchedAt)}</small>
            </a>
          ))}
          {!news.viewHistory.length && !news.history.length && <p>No views yet. Open a story and it appears here.</p>}
        </div>
      )}

      {news.error && <div className="news-error">{news.error}</div>}
    </section>
  );
}

function GaugeBar({ icon: Icon, label, value, unit, detail, max = 100 }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const pct = numeric ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="gauge-row">
      <div className="gauge-label"><Icon size={16} /><span>{label}</span><strong>{value}{unit}</strong></div>
      <div className="bar"><span style={{ width: `${pct}%` }} /></div>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function AmbientPanel({ ambientPhase, weatherMood, sleepMode, setSleepMode, idle, openQuickControls }) {
  return (
    <div className="ambient-panel">
      <div>
        <span>Ambient state</span>
        <strong>{ambientPhase.label}</strong>
        <em>{weatherMood.warning || weatherMood.label}</em>
      </div>
      <div className="ambient-flags">
        <button type="button" className={sleepMode ? 'active' : ''} onClick={() => setSleepMode(!sleepMode)}>
          {sleepMode ? 'Sleep on' : 'Sleep off'}
        </button>
        <button type="button" className={idle ? 'active' : ''} onClick={openQuickControls}>
          {idle ? 'Idle fade' : 'Awake'}
        </button>
      </div>
    </div>
  );
}

function NoisePanel({ noise, enabled, setEnabled }) {
  const dbLabel = noise.db ? `dB ${noise.db}` : 'dB --';
  return (
    <div className={`noise-panel ${noise.level.toLowerCase()}`}>
      <div>
        <span>Noise level</span>
        <strong>{dbLabel}</strong>
        <em>{noise.level} / {noise.status}</em>
      </div>
      <div className="noise-meter" aria-hidden="true"><span style={{ width: `${noise.value}%` }} /></div>
      <button type="button" onClick={() => setEnabled(!enabled)}>{enabled ? 'Stop mic' : 'Start mic'}</button>
    </div>
  );
}

function FocusPanel({ focus }) {
  const pct = Math.round(((focus.duration - focus.remaining) / focus.duration) * 100);

  return (
    <div className="focus-panel">
      <div className="focus-topline">
        <div>
          <span>Smart focus</span>
          <strong>{formatDuration(focus.remaining)}</strong>
          <em>{focus.stats.todayMinutes} min today / {focus.stats.streak} day streak</em>
        </div>
        <div className="focus-actions">
          <button type="button" onClick={() => focus.start(25)}>25</button>
          <button type="button" onClick={() => focus.start(50)}>50</button>
          <button type="button" onClick={focus.toggle}>{focus.running ? 'Pause' : 'Resume'}</button>
        </div>
      </div>
      <div className="focus-progress"><span style={{ width: `${pct}%` }} /></div>
      <div className="focus-heatmap" aria-label="Study heatmap">
        {focus.stats.days.map((day) => (
          <span key={day.label} style={{ '--level': Math.min(1, day.minutes / 120) }}>
            <em>{day.label}</em>
            <strong>{day.minutes}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function MusicPanel({ library, player }) {
  const track = player.currentTrack;
  const shortTitle = track?.title || (library.loaded ? 'No music found' : 'Scanning music folder');

  return (
    <div className={player.playing ? 'music-widget playing' : 'music-widget'}>
      <div className="music-now">
        <div className="album-art" aria-hidden="true">
          <Music2 size={30} />
          <span />
        </div>
        <div>
          <p>{library.loaded ? `${player.tracks.length} local track${player.tracks.length === 1 ? '' : 's'}` : 'Loading library'}</p>
          <strong>{shortTitle}</strong>
          <em>{track ? 'Auto-scans KISOKE/music every 15 seconds' : 'Drop MP3 files into the music folder'}</em>
        </div>
      </div>
      <div className="visualizer" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => <span key={index} style={{ '--i': index }} />)}
      </div>
      <div className="music-controls">
        <button type="button" onClick={player.togglePlay} disabled={!player.tracks.length} aria-label={player.playing ? 'Pause music' : 'Play music'}>
          {player.playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button type="button" onClick={player.nextTrack} disabled={!player.tracks.length} aria-label="Next track"><SkipForward size={20} /></button>
        <button type="button" onClick={player.shuffleTrack} disabled={!player.tracks.length} aria-label="Shuffle music"><Shuffle size={20} /></button>
        <label className="volume-control">
          <Volume2 size={18} />
          <input type="range" min="0" max="1" step="0.01" value={player.volume} onChange={(event) => player.setVolume(event.target.value)} />
        </label>
      </div>
      {player.tracks.length > 0 && (
        <select className="music-select" value={player.trackIndex} onChange={(event) => player.selectTrack(Number(event.target.value))}>
          {player.tracks.map((item, index) => <option key={item.file} value={index}>{item.title}</option>)}
        </select>
      )}
    </div>
  );
}

function QuickControls({ open, onClose, ambientPhase, weatherMood, sleepMode, setSleepMode, musicPlayer, noiseEnabled, setNoiseEnabled, focus, roomMode, setRoomMode, focusLock, setFocusLock, openBrainDump, setManualMode, pushToast }) {
  const [quickBrightness, setQuickBrightness] = useState(55);
  const [quickVolume, setQuickVolume] = useState(45);
  const network = useNetworkAccess();
  const access = networkAccessLabels(network);
  const quickBrightnessTimer = useRef(null);
  const quickVolumeTimer = useRef(null);

  async function quickPost(path, body, title = 'Quick control', silent = false) {
    try {
      const response = await fetch(`${DEVICE_API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!silent) {
        pushToast?.(title, data.message || data.error || 'Updated.', data.ok === false ? 'amber' : 'green');
      }
      return data;
    } catch {
      if (!silent) {
        pushToast?.(title, 'Backend is not running on port 8787.', 'amber');
      }
      return { ok: false };
    }
  }

  function scheduleQuickPost(timerRef, path, body, title) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      quickPost(path, body, title, true);
    }, 60);
  }

  useEffect(() => () => {
    window.clearTimeout(quickBrightnessTimer.current);
    window.clearTimeout(quickVolumeTimer.current);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="quick-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.aside
            className="quick-panel"
            initial={{ y: -24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -18, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 230, damping: 24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quick-heading">
              <div>
                <h2>Quick Controls</h2>
                <p>{ambientPhase.label} / {weatherMood.warning || weatherMood.label}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close quick controls"><ChevronLeft size={20} /></button>
            </div>
            <div className="quick-grid">
              <button type="button" onClick={() => setManualMode('white')}>
                <Sun size={19} /> Light
              </button>
              <button type="button" onClick={() => setManualMode('slate')}>
                <Moon size={19} /> Dark
              </button>
              <button type="button" onClick={() => setManualMode('night')}>
                <Moon size={19} /> Red night
              </button>
              <button type="button" className={sleepMode ? 'active' : ''} onClick={() => setSleepMode(!sleepMode)}>
                <Moon size={19} /> {sleepMode ? 'Sleep on' : 'Sleep mode'}
              </button>
              <button type="button" onClick={openBrainDump}>
                <Bell size={19} /> Brain dump
              </button>
              <button type="button" className={noiseEnabled ? 'active' : ''} onClick={() => setNoiseEnabled(!noiseEnabled)}>
                <Gauge size={19} /> {noiseEnabled ? 'Mic on' : 'Noise monitor'}
              </button>
              <button type="button" onClick={() => focus.start(25)}>
                <Clock3 size={19} /> Focus 25
              </button>
              <button type="button" className={focusLock ? 'active' : ''} onClick={() => setFocusLock(!focusLock)}>
                <Target size={19} /> {focusLock ? 'Focus locked' : 'Focus lock'}
              </button>
              <button type="button" onClick={() => quickPost('/api/device/wifi/toggle', {}, 'Wi-Fi')}>
                <Wifi size={19} /> Wi-Fi
              </button>
              <button type="button" onClick={() => quickPost('/api/device/restart-backend', {}, 'Backend')}>
                <RefreshCw size={19} /> Restart backend
              </button>
            </div>
            <div className="quick-mode-row" aria-label="Room mode">
              {ROOM_MODES.map((mode) => (
                <button key={mode.id} type="button" className={roomMode === mode.id ? 'active' : ''} onClick={() => setRoomMode(mode.id)}>
                  {mode.label}
                </button>
              ))}
            </div>
            <label className="quick-slider">
              <span><Volume2 size={18} /> Music volume</span>
              <input type="range" min="0" max="1" step="0.01" value={musicPlayer.volume} onChange={(event) => musicPlayer.setVolume(event.target.value)} />
            </label>
            <label className="quick-slider">
              <span><Sun size={18} /> Screen brightness</span>
              <input type="range" min="1" max="100" value={quickBrightness} onChange={(event) => {
                const percent = Number(event.target.value);
                setQuickBrightness(percent);
                scheduleQuickPost(quickBrightnessTimer, '/api/device/brightness', { percent }, 'Brightness');
              }} />
            </label>
            <label className="quick-slider">
              <span><Volume2 size={18} /> System volume</span>
              <input type="range" min="0" max="100" value={quickVolume} onChange={(event) => {
                const percent = Number(event.target.value);
                setQuickVolume(percent);
                scheduleQuickPost(quickVolumeTimer, '/api/device/volume', { percent }, 'Volume');
              }} />
            </label>
            <div className="quick-status">
              <div><span>Focus</span><strong>{focus.running ? formatDuration(focus.remaining) : `${focus.stats.todayMinutes} min today`}</strong></div>
              <div><span>Weather</span><strong>{weatherMood.label}</strong></div>
              <div className="quick-access-url">
                <span>Phone URL</span>
                <strong>{access.primary.url}</strong>
                <small>Camera: {access.primary.cameraUrl || `${access.primary.url}/localhost-camera`}</small>
                {access.secondary ? <small>{access.secondary.name}: {access.secondary.url}</small> : null}
                <button type="button" onClick={network.refresh}>Refresh IP</button>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BrainDumpOverlay({ open, onClose, brainDump }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="brain-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.section
            className="brain-panel"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          >
            <div className="brain-heading">
              <div>
                <h2>Brain Dump</h2>
                <p>Fast local notes, saved on this kiosk.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close brain dump"><ChevronLeft size={20} /></button>
            </div>
            <textarea
              ref={inputRef}
              value={brainDump.draft}
              onChange={(event) => brainDump.setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') brainDump.saveNote();
                if (event.key === 'Escape') onClose();
              }}
              placeholder="Type the idea immediately..."
            />
            <div className="brain-actions">
              <button type="button" onClick={() => brainDump.saveNote()}>Save note</button>
              <button type="button" onClick={onClose}>Done</button>
            </div>
            <div className="brain-list">
              {brainDump.notes.slice(0, 6).map((note) => (
                <div key={note.id}>
                  <span>{new Date(note.createdAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</span>
                  <p>{note.text}</p>
                  <button type="button" onClick={() => brainDump.deleteNote(note.id)} aria-label="Delete note"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FocusLockOverlay({ open, focus, onExit, roomMode, weatherMood }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`focus-lock-overlay mode-${roomMode}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.section
            className="focus-lock-panel"
            initial={{ y: 34, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 180, damping: 23 }}
          >
            <div className="focus-lock-orbit" aria-hidden="true"><span /></div>
            <span>Focus Lock</span>
            <strong className="focus-lock-time">{formatDuration(focus.remaining)}</strong>
            <em>{focus.running ? 'Deep work active' : 'Ready for a study session'} / {weatherMood.label}</em>
            <div className="focus-lock-progress"><span style={{ width: `${Math.round(((focus.duration - focus.remaining) / focus.duration) * 100)}%` }} /></div>
            <div className="focus-lock-actions">
              <button type="button" onClick={() => focus.start(25)}>Start 25</button>
              <button type="button" onClick={() => focus.start(50)}>Start 50</button>
              <button type="button" onClick={focus.toggle}>{focus.running ? 'Pause' : 'Resume'}</button>
              <button type="button" onClick={onExit}>Exit</button>
            </div>
            <small>Notifications stay quiet and the dashboard stays hidden until you exit.</small>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AmbientRotation({ idle, now, weather, prayer, focus }) {
  if (!idle) return null;
  const minute = Math.floor(now.getMinutes() / 1);
  const mode = minute % 4;
  const slides = [
    { label: 'Clock', value: formatClockTime(now, '24'), detail: now.toLocaleDateString('en-AE', { weekday: 'long', month: 'short', day: 'numeric' }), Icon: Clock3 },
    { label: 'Weather', value: `${weather.temp}C`, detail: `${weatherCondition(weather.code, isNightAt(now, weather.sunrise, weather.sunset)).label} / feels ${weather.feels}C`, Icon: CloudSun },
    { label: 'Prayer', value: prayer.name, detail: prayer.countdown, Icon: Moon },
    { label: 'Focus', value: `${focus.stats.todayMinutes}m`, detail: `${focus.stats.weekMinutes}m this week`, Icon: Target }
  ];
  const slide = slides[mode];
  const Icon = slide.Icon;

  return (
    <motion.div
      className="ambient-rotation"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      aria-hidden="true"
    >
      <Icon size={24} />
      <div>
        <span>{slide.label}</span>
        <strong>{slide.value}</strong>
        <em>{slide.detail}</em>
      </div>
    </motion.div>
  );
}

function useTimeDesk(enabled = true) {
  const [countdownMinutes, setCountdownMinutes] = useState(10);
  const [countdownLeft, setCountdownLeft] = useState(0);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [stopwatch, setStopwatch] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const [finished, setFinished] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const interval = window.setInterval(() => {
      if (countdownRunning) setCountdownLeft((value) => Math.max(0, value - 1));
      if (timerRunning) setTimerLeft((value) => Math.max(0, value - 1));
      if (stopwatchRunning) setStopwatch((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [countdownRunning, timerRunning, stopwatchRunning, enabled]);

  useEffect(() => {
    if (countdownRunning && countdownLeft <= 0) {
      setCountdownRunning(false);
      setFinished({ id: Date.now(), type: 'countdown' });
    }
  }, [countdownLeft, countdownRunning]);

  useEffect(() => {
    if (timerRunning && timerLeft <= 0) {
      setTimerRunning(false);
      setFinished({ id: Date.now(), type: 'timer' });
    }
  }, [timerLeft, timerRunning]);

  const startCountdown = useCallback((minutes = countdownMinutes) => {
    const seconds = Math.max(1, Math.round(Number(minutes) || 1)) * 60;
    setCountdownLeft(seconds);
    setCountdownRunning(true);
  }, [countdownMinutes]);

  const startTimer = useCallback((minutes = timerMinutes) => {
    const seconds = Math.max(1, Math.round(Number(minutes) || 1)) * 60;
    setTimerLeft(seconds);
    setTimerRunning(true);
  }, [timerMinutes]);

  return {
    countdownMinutes,
    setCountdownMinutes,
    countdownLeft,
    countdownRunning,
    startCountdown,
    pauseCountdown: () => setCountdownRunning(false),
    resumeCountdown: () => countdownLeft > 0 && setCountdownRunning(true),
    resetCountdown: () => {
      setCountdownRunning(false);
      setCountdownLeft(0);
    },
    timerMinutes,
    setTimerMinutes,
    timerLeft,
    timerRunning,
    finished,
    startTimer,
    pauseTimer: () => setTimerRunning(false),
    resumeTimer: () => timerLeft > 0 && setTimerRunning(true),
    resetTimer: () => {
      setTimerRunning(false);
      setTimerLeft(0);
    },
    stopwatch,
    stopwatchRunning,
    toggleStopwatch: () => setStopwatchRunning((value) => !value),
    startStopwatch: () => setStopwatchRunning(true),
    pauseStopwatch: () => setStopwatchRunning(false),
    addLap: () => setLaps((current) => [{ id: Date.now(), value: stopwatch }, ...current].slice(0, 12)),
    laps,
    resetStopwatch: () => {
      setStopwatchRunning(false);
      setStopwatch(0);
      setLaps([]);
    }
  };
}

function TimeControlPanel({ title, detail, icon: Icon, value, progress = 0, children, tone = 'green' }) {
  return (
    <section className={`panel time-card tone-${tone}`}>
      <div className="panel-heading">
        <Icon size={22} />
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
      </div>
      <div className="time-card-readout">{value}</div>
      <div className="time-card-progress" aria-hidden="true"><span style={{ width: `${clampNumber(progress, 0, 100)}%` }} /></div>
      <div className="time-card-controls">{children}</div>
    </section>
  );
}

function TimeDeskPage({ now, mode, timeFormat, alarm, setAlarm, timeDesk, goClock, goDashboard, goSettings }) {
  const countdownTotal = Math.max(1, Number(timeDesk.countdownMinutes) * 60);
  const timerTotal = Math.max(1, Number(timeDesk.timerMinutes) * 60);
  const countdownProgress = timeDesk.countdownLeft ? ((countdownTotal - timeDesk.countdownLeft) / countdownTotal) * 100 : 0;
  const timerProgress = timeDesk.timerLeft ? ((timerTotal - timeDesk.timerLeft) / timerTotal) * 100 : 0;

  return (
    <section className={`tools-page time-desk ${mode}`}>
      <header className="dash-top tools-top time-desk-top">
        <button className="icon-button" onClick={goClock} aria-label="Back to clock"><ChevronRight size={24} /></button>
        <div>
          <h1>Time Desk</h1>
          <p>Swipe left to return to the clock. Alarm, countdown, timer, and stopwatch stay here.</p>
        </div>
        <div className="time-desk-actions">
          <button type="button" onClick={goClock}>Clock</button>
          <button type="button" onClick={goDashboard}>Dashboard</button>
          <button type="button" onClick={goSettings} aria-label="Open settings"><Settings size={19} /></button>
        </div>
      </header>

      <main className="time-desk-grid">
        <section className="panel time-hero-card">
          <div>
            <span>Now</span>
            <strong>{formatClockTime(now, timeFormat, { seconds: true })}</strong>
            <em>{now.toLocaleDateString('en-AE', { weekday: 'long', month: 'long', day: 'numeric' })}</em>
          </div>
          <div>
            <span>Next alarm</span>
            <strong>{formatAlarmLabel(alarm, timeFormat)}</strong>
            <em>Saved on this kiosk</em>
          </div>
        </section>

        <section className="panel time-card alarm-card">
          <div className="panel-heading">
            <AlarmClock size={22} />
            <div>
              <h2>Alarm</h2>
              <p>Main wake-up alarm</p>
            </div>
          </div>
          <input className="big-input" type="time" value={alarm} onChange={(event) => setAlarm(event.target.value)} />
          <div className="tool-readout"><Bell size={18} /> Rings at {formatAlarmLabel(alarm, timeFormat)}</div>
        </section>

        <TimeControlPanel
          title="Countdown"
          detail="One-shot countdown"
          icon={Clock3}
          value={formatDuration(timeDesk.countdownLeft)}
          progress={countdownProgress}
          tone="amber"
        >
          <div className="number-row">
            <input type="number" min="1" value={timeDesk.countdownMinutes} onChange={(event) => timeDesk.setCountdownMinutes(Number(event.target.value))} />
            <button type="button" onClick={() => timeDesk.startCountdown()}>Start</button>
            <button type="button" onClick={timeDesk.resetCountdown}>Reset</button>
          </div>
          <div className="dock compact">
            <button type="button" onClick={timeDesk.pauseCountdown}>Pause</button>
            <button type="button" onClick={timeDesk.resumeCountdown}>Resume</button>
          </div>
        </TimeControlPanel>

        <TimeControlPanel
          title="Timer"
          detail="Reusable focus or sleep timer"
          icon={Target}
          value={formatDuration(timeDesk.timerLeft)}
          progress={timerProgress}
          tone="green"
        >
          <div className="number-row">
            <input type="number" min="1" value={timeDesk.timerMinutes} onChange={(event) => timeDesk.setTimerMinutes(Number(event.target.value))} />
            <button type="button" onClick={() => timeDesk.startTimer()}>Start</button>
            <button type="button" onClick={timeDesk.resetTimer}>Reset</button>
          </div>
          <div className="dock compact">
            <button type="button" onClick={() => timeDesk.startTimer(10)}>10 min</button>
            <button type="button" onClick={() => timeDesk.startTimer(25)}>25 min</button>
            <button type="button" onClick={timeDesk.timerRunning ? timeDesk.pauseTimer : timeDesk.resumeTimer}>{timeDesk.timerRunning ? 'Pause' : 'Resume'}</button>
          </div>
        </TimeControlPanel>

        <TimeControlPanel
          title="Stopwatch"
          detail="Tap once, keep it running while you swipe"
          icon={Clock3}
          value={formatDuration(timeDesk.stopwatch)}
          progress={(timeDesk.stopwatch % 60) / 60 * 100}
          tone="blue"
        >
          <div className="dock compact">
            <button type="button" onClick={timeDesk.toggleStopwatch}>{timeDesk.stopwatchRunning ? 'Pause' : 'Start'}</button>
            <button type="button" onClick={timeDesk.resetStopwatch}>Reset</button>
          </div>
        </TimeControlPanel>
      </main>
    </section>
  );
}

function sectionIndexById(id) {
  return Math.max(0, TIME_DECK_SECTIONS.findIndex((section) => section.id === id));
}

function TimeDeck({ now, mode, timeFormat, alarm, setAlarm, alarms, timeAlarms, timeDeck, timeDeckSettings, activeSection, setActiveSection, worldClocks, setWorldClocks, weather, weatherMood, ambientPhase, locationSettings, battery, prayer, setManualMode, sleepMode, idle, alarmSoundLibrary, alarmSoundUrl, setAlarmSoundUrl, goClock, goSettings }) {
  const deckRef = useRef(null);
  const touchRef = useRef(null);
  const wheelLockRef = useRef(false);
  const [alarmDraft, setAlarmDraft] = useState(alarm || '06:30');
  const [alarmRepeat, setAlarmRepeat] = useState('daily');
  const [cityDraft, setCityDraft] = useState('');
  const [zoneDraft, setZoneDraft] = useState('');
  const clockIsNight = isNightAt(now, weather?.sunrise, weather?.sunset);
  const moon = useMemo(() => getMoonPhase(now), [now.toDateString()]);
  const moonPhase = timeDeckSettings.moonMode === 'manual' ? timeDeckSettings.manualMoonPhase : moon.phase;
  const moonPhaseClass = String(moonPhase || moon.phase).toLowerCase().replace(/\s+/g, '-');
  const timeDeckMoon = { ...moon, phase: moonPhase || moon.phase };
  const clockZone = timeDeckSettings.clockTimezoneMode === 'China'
    ? 'Asia/Shanghai'
    : timeDeckSettings.clockTimezoneMode === 'custom'
      ? timeDeckSettings.customClockTimezone
      : timeDeckSettings.clockTimezoneMode === 'auto'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : locationSettings.clockTimezone || 'Asia/Dubai';
  const clockLabel = timeDeckSettings.clockTimezoneMode === 'China'
    ? 'China'
    : timeDeckSettings.clockTimezoneMode === 'custom'
      ? 'Custom'
      : timeDeckSettings.clockTimezoneMode === 'auto'
        ? 'Device'
        : locationSettings.clockCity || 'Dubai';
  const displayTime = formatTimeZone(now, clockZone, timeFormat, { seconds: false });
  const date = formatDateForZone(now, clockZone);
  const currentIndex = sectionIndexById(activeSection);
  const nextSection = TIME_DECK_SECTIONS[Math.min(TIME_DECK_SECTIONS.length - 1, currentIndex + 1)];
  const countdownTotal = Math.max(1, Number(timeDeck.countdownMinutes) * 60);
  const countdownProgress = timeDeck.countdownLeft ? ((countdownTotal - timeDeck.countdownLeft) / countdownTotal) * 100 : 0;
  const scrollThreshold = timeDeckSettings.scrollSensitivity === 'high' ? 28 : timeDeckSettings.scrollSensitivity === 'low' ? 92 : 54;

  const goSection = useCallback((sectionId, behavior = 'smooth') => {
  const cleanId = TIME_DECK_SECTIONS.some((section) => section.id === sectionId) ? sectionId : 'alarm';
    setActiveSection(cleanId);
    const node = deckRef.current?.querySelector(`[data-time-section="${cleanId}"]`);
    if (node) node.scrollIntoView({ block: 'start', behavior });
  }, [setActiveSection]);

  useEffect(() => {
    window.__nexoraTimeDeckGo = goSection;
    return () => {
      if (window.__nexoraTimeDeckGo === goSection) delete window.__nexoraTimeDeckGo;
    };
  }, [goSection]);

  useEffect(() => {
    goSection(activeSection || timeDeckSettings.defaultSection || 'alarm', 'auto');
  }, []);

  function stepSection(delta) {
    const nextIndex = Math.max(0, Math.min(TIME_DECK_SECTIONS.length - 1, currentIndex + delta));
    goSection(TIME_DECK_SECTIONS[nextIndex].id);
  }

  function onWheel(event) {
    if (!timeDeckSettings.enabled) return;
    if (Math.abs(event.deltaY) < scrollThreshold || wheelLockRef.current) return;
    event.preventDefault();
    wheelLockRef.current = true;
    stepSection(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLockRef.current = false; }, 540);
  }

  function onScroll() {
    const deck = deckRef.current;
    if (!deck) return;
    const deckTop = deck.getBoundingClientRect().top;
    let best = TIME_DECK_SECTIONS[0].id;
    let bestDistance = Infinity;
    TIME_DECK_SECTIONS.forEach((section) => {
      const node = deck.querySelector(`[data-time-section="${section.id}"]`);
      if (!node) return;
      const distance = Math.abs(node.getBoundingClientRect().top - deckTop);
      if (distance < bestDistance) {
        best = section.id;
        bestDistance = distance;
      }
    });
    if (best !== activeSection) setActiveSection(best);
  }

  function onTouchStart(event) {
    if (!timeDeckSettings.touchSwipe) return;
    const touch = event.touches?.[0];
    if (touch) touchRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event) {
    if (!timeDeckSettings.touchSwipe || !touchRef.current) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const deltaY = touch.clientY - touchRef.current.y;
    const deltaX = touch.clientX - touchRef.current.x;
    touchRef.current = null;
    if (Math.abs(deltaY) < 74 || Math.abs(deltaY) < Math.abs(deltaX) * 1.2) return;
    stepSection(deltaY < 0 ? 1 : -1);
  }

  function addWorldClock(event) {
    event.preventDefault();
    const city = cityDraft.trim();
    const zone = zoneDraft.trim();
    if (!city || !zone) return;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
      setWorldClocks((current) => [{ city, zone }, ...current]);
      setCityDraft('');
      setZoneDraft('');
    } catch {
      setZoneDraft('Asia/Dubai');
    }
  }

  function onKeyDown(event) {
    if (!timeDeckSettings.keyboardNavigation) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      stepSection(1);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      stepSection(-1);
    }
  }

  const currentTool = TIME_DECK_SECTIONS.some((section) => section.id === activeSection) ? activeSection : 'alarm';
  const selectedAlarmTrack = alarmSoundLibrary?.tracks?.find((track) => track.url === alarmSoundUrl) || null;
  const selectedAlarmLabel = selectedAlarmTrack?.title || 'Built-in chime';
  const alarmSoundPicker = (
    <div className="alarm-sound-picker">
      <select value={alarmSoundUrl} onChange={(event) => setAlarmSoundUrl(event.target.value)} aria-label="Alarm sound">
        <option value="">Built-in chime</option>
        {(alarmSoundLibrary?.tracks || []).map((track) => (
          <option key={track.url} value={track.url}>{track.title}</option>
        ))}
      </select>
      <button type="button" onClick={alarmSoundLibrary?.refresh}>
        <RefreshCw size={17} /> Change audio from file
      </button>
      <span>{alarmSoundLibrary?.tracks?.length ? `${alarmSoundLibrary.tracks.length} custom sounds` : 'Add audio files to Custome Alarm Sounds'}</span>
    </div>
  );

  return (
    <section
      className={`time-deck chrono ${mode} style-${timeDeckSettings.clockStyle} phase-${ambientPhase.id} weather-${weatherMood.id} ${clockIsNight ? 'astro-night' : 'astro-day'} moon-${moonPhaseClass} ${sleepMode ? 'sleep-mode' : ''} ${idle ? 'ambient-idle' : ''}`}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <div className="chrono-depth chrono-sky">
        <CelestialScene now={now} weather={weather} weatherMood={weatherMood} ambientPhase={ambientPhase} moon={timeDeckMoon} />
      </div>
      <div className="chrono-depth chrono-particles" aria-hidden="true" />
      <div className="chrono-depth chrono-glow" aria-hidden="true" />
      <div className="seconds-ring time-deck-seconds-ring" style={{ '--progress': `${secondsProgress(now)}%` }} />

      <div className="time-deck-board clock-tools-layout" ref={deckRef}>
        <aside className="time-deck-column time-deck-tools">
          <div className="time-deck-column-title">
                <span>Clock Tools</span>
            <button type="button" onClick={goSettings} aria-label="Open settings"><Settings size={18} /></button>
          </div>
          <nav aria-label="Clock tools">
            {TIME_DECK_SECTIONS.map((section) => (
              <button key={section.id} type="button" className={currentTool === section.id ? 'active' : ''} onClick={() => goSection(section.id)} title={section.label} aria-label={section.label}>
                <span className="time-tool-dot" aria-hidden="true" />
                <span className="time-tool-label">{section.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="time-deck-column time-deck-main">
          <div className="time-deck-column-title">
            <span>Selected Tool</span>
            <em>Swipe left for Clock</em>
            <button type="button" onClick={goClock}>Clock <ChevronRight size={16} /></button>
          </div>

          {currentTool === 'alarm' && (
            <TimeDeckSection id="alarm" eyebrow="Wake schedule" title="Alarm">
              <div className="time-deck-form">
                <input className="time-input-xl" type="time" value={alarmDraft} onChange={(event) => setAlarmDraft(event.target.value)} />
                <select value={alarmRepeat} onChange={(event) => setAlarmRepeat(event.target.value)}>
                  <option>once</option>
                  <option>daily</option>
                  <option>school days</option>
                  <option>custom days</option>
                </select>
                <button type="button" onClick={() => timeAlarms.addAlarm(alarmDraft, alarmRepeat, selectedAlarmLabel, alarmSoundUrl)}><Plus size={18} /> Add alarm</button>
                {alarmSoundPicker}
              </div>
              <div className="time-deck-list">
                {alarms.length ? alarms.map((item) => (
                  <div key={item.id}>
                    <button type="button" className={item.enabled ? 'alarm-toggle active' : 'alarm-toggle'} onClick={() => timeAlarms.toggleAlarm(item.id)}>{item.enabled ? 'On' : 'Off'}</button>
                    <strong>{formatAlarmLabel(item.time, timeFormat)}</strong>
                    <span>{item.repeat} / {item.sound}</span>
                    <button type="button" className="time-delete-button" onClick={() => timeAlarms.deleteAlarm(item.id)} aria-label="Delete alarm"><Trash2 size={17} /></button>
                  </div>
                )) : <p>No active alarms yet.</p>}
              </div>
            </TimeDeckSection>
          )}

          {currentTool === 'countdown' && (
            <TimeDeckSection id="countdown" eyebrow="Countdown" title={formatDuration(timeDeck.countdownLeft)}>
              <div className="time-ring" style={{ '--progress': `${countdownProgress}%` }}><span>{Math.round(countdownProgress)}%</span></div>
              <div className="preset-row">
                {[5, 10, 15, 30, 60].map((minutes) => <button type="button" key={minutes} onClick={() => timeDeck.startCountdown(minutes)}>{minutes === 60 ? '1 hour' : `${minutes} min`}</button>)}
              </div>
              <div className="number-row time-deck-number-row">
                <input type="number" min="1" value={timeDeck.countdownMinutes} onChange={(event) => timeDeck.setCountdownMinutes(Number(event.target.value))} />
                <button type="button" onClick={() => timeDeck.startCountdown()}>Start</button>
                <button type="button" onClick={timeDeck.countdownRunning ? timeDeck.pauseCountdown : timeDeck.resumeCountdown}>{timeDeck.countdownRunning ? 'Pause' : 'Resume'}</button>
                <button type="button" onClick={timeDeck.resetCountdown}>Reset</button>
              </div>
              {alarmSoundPicker}
            </TimeDeckSection>
          )}

          {currentTool === 'stopwatch' && (
            <TimeDeckSection id="stopwatch" eyebrow="Stopwatch" title={formatDuration(timeDeck.stopwatch)}>
              <div className="time-deck-actions-row">
                <button type="button" onClick={timeDeck.toggleStopwatch}>{timeDeck.stopwatchRunning ? 'Pause' : 'Start'}</button>
                <button type="button" onClick={timeDeck.addLap}>Lap</button>
                <button type="button" onClick={timeDeck.resetStopwatch}>Reset</button>
              </div>
              <div className="time-deck-list compact-list">
                {timeDeck.laps.length ? timeDeck.laps.map((lap, index) => (
                  <div key={lap.id}><strong>Lap {timeDeck.laps.length - index}</strong><span>{formatDuration(lap.value)}</span></div>
                )) : <p>No laps yet.</p>}
              </div>
            </TimeDeckSection>
          )}

          {currentTool === 'world' && (
            <TimeDeckSection id="world" eyebrow="World Clock" title="Cities">
              <div className="world-clock-wall">
                {worldClocks.map((clock) => (
                  <div key={`${clock.city}-${clock.zone}`}>
                    <strong>{clock.city}</strong>
                    <span>{clock.zone}</span>
                    <em>{formatTimeZone(now, clock.zone, timeFormat)}</em>
                    <button type="button" className="time-delete-button x-delete-button" onClick={() => setWorldClocks((current) => current.filter((item) => item.city !== clock.city || item.zone !== clock.zone))} aria-label={`Delete ${clock.city}`}><X size={17} /></button>
                  </div>
                ))}
              </div>
              <form className="world-form time-world-form" onSubmit={addWorldClock}>
                <input value={cityDraft} onChange={(event) => setCityDraft(event.target.value)} placeholder="City" />
                <input value={zoneDraft} onChange={(event) => setZoneDraft(event.target.value)} placeholder="Asia/Shanghai" />
                <button>Add</button>
              </form>
            </TimeDeckSection>
          )}

          {currentTool === 'prayer' && (
            <TimeDeckSection id="prayer" eyebrow="Prayer Time Focus" title={prayer.name}>
              <div className={prayer.minutesLeft <= 15 ? 'prayer-focus-card soon' : 'prayer-focus-card'}>
                <strong>{prayer.countdown}</strong>
                <span>until {prayer.name}</span>
                <em>{formatShortTime(prayer.time, timeFormat)}</em>
              </div>
              <div className="time-deck-strip">
                {getPrayerTimes(now).map((item) => <span key={item.name}>{item.name} {formatShortTime(item.time, timeFormat)}</span>)}
              </div>
            </TimeDeckSection>
          )}
        </main>
      </div>
    </section>
  );
}

function TimeDeckSection({ id, eyebrow, title, children }) {
  return (
    <section className="time-deck-section" data-time-section={id}>
      <div className="time-section-inner">
        <span>{eyebrow}</span>
        {title ? <h1>{title}</h1> : null}
        {children}
      </div>
    </section>
  );
}

function blocksPageSwipe(target) {
  if (target?.closest?.('.tap-zones')) return false;
  return Boolean(target?.closest?.([
    'input',
    'textarea',
    'select',
    'a',
    '[contenteditable="true"]',
    '.widget-drag-handle',
    '.section-drag-handle',
    '.quick-overlay',
    '.brain-overlay',
    '.focus-lock-overlay',
    '.listening-orb',
    '.toast-stack'
  ].join(',')));
}

function ToolsPage({ now, mode, manualMode, autoColor, setManualMode, dashboardTheme, setDashboardTheme, alarm, setAlarm, timeFormat, setTimeFormat, customWidgets, setCustomWidgets, customSections, setCustomSections, deletedWidgets, setDeletedWidgets, deleteCustomWidget, toggleWidgetLock, restoreDeletedWidget, restoreAllDeletedWidgets, resetCustomWidgets, goBack, goSoftware, goRemoteCamera, setAutoColor, setRoomMode, assistantSettings, setAssistantSettings, voiceAssistant, locationSettings, setLocationSettings, lookStyle, setLookStyle, timeDeckSettings, setTimeDeckSettings, activeTimeDeckSection, setActiveTimeDeckSection, worldClocks, setWorldClocks, currentPage, weather, weatherMood, battery, lastCommand, lastError, pushToast, presenceSettings, setPresenceSettings, commandHistory, clearCommandHistory, remoteCameraSettings, setRemoteCameraSettings, securityLog, languageSettings, setLanguageSettings }) {
  const [countdownMinutes, setCountdownMinutes] = useState(10);
  const [countdownLeft, setCountdownLeft] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerLeft, setTimerLeft] = useState(0);
  const [stopwatch, setStopwatch] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [healthResults, setHealthResults] = useState([]);
  const [cameraLogEntries, setCameraLogEntries] = useState([]);
  const [sectionDraft, setSectionDraft] = useState('');
  const [widgetDraft, setWidgetDraft] = useState({
    title: '',
    value: '',
    detail: '',
    type: 'note',
    accent: 'green',
    placement: 'weather'
  });
  const [dragTemplateType, setDragTemplateType] = useState('');
  const [remotePasswordDraft, setRemotePasswordDraft] = useState('');
  const [remoteOldPasswordDraft, setRemoteOldPasswordDraft] = useState('');
  const allSections = useMemo(() => [
    ...BUILT_IN_SECTIONS,
    ...customSections.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  ], [customSections]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownLeft((value) => Math.max(0, value - 1));
      setTimerLeft((value) => Math.max(0, value - 1));
      if (stopwatchRunning) setStopwatch((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [stopwatchRunning]);

  function addClock(event) {
    event.preventDefault();
    const cleanCity = city.trim();
    const cleanZone = zone.trim();
    if (!cleanCity || !cleanZone) return;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: cleanZone }).format(new Date());
      setWorldClocks([{ city: cleanCity, zone: cleanZone }, ...worldClocks]);
      setCity('');
      setZone('');
    } catch {
      setZone('Europe/Sarajevo');
    }
  }

  function updateWidgetDraft(field, value) {
    setWidgetDraft({ ...widgetDraft, [field]: value });
  }

  function addCustomWidget(event) {
    event.preventDefault();
    const title = widgetDraft.title.trim();
    const value = widgetDraft.value.trim();
    if (!title || !value) return;
    setCustomWidgets([
      normalizeWidget({
        ...widgetDraft,
        id: Date.now(),
        title,
        value,
        detail: widgetDraft.detail.trim()
      }),
      ...customWidgets
    ]);
    setWidgetDraft({ title: '', value: '', detail: '', type: 'note', accent: 'green', placement: widgetDraft.placement || 'weather' });
  }

  function addTemplateWidget(typeId, placement = widgetDraft.placement || 'weather') {
    setCustomWidgets((current) => [widgetTemplate(typeId, placement), ...current]);
  }

  function addSection(event) {
    event.preventDefault();
    const title = sectionDraft.trim();
    if (!title) return;
    setCustomSections((current) => [
      ...current,
      normalizeSection({
        id: `section-${Date.now()}`,
        title,
        detail: 'Custom section for your widgets',
        order: Date.now()
      })
    ]);
    setSectionDraft('');
  }

  function removeSection(id) {
    setCustomSections((current) => current.filter((section) => section.id !== id));
    setCustomWidgets((current) => current.map((widget) => widget.placement === id ? { ...widget, placement: 'weather' } : widget));
    if (widgetDraft.placement === id) updateWidgetDraft('placement', 'weather');
  }

  function startTemplateDrag(event, typeId) {
    setDragTemplateType(typeId);
    event.dataTransfer.setData('application/x-nexora-widget-type', typeId);
    event.dataTransfer.effectAllowed = 'copy';
  }

  function allowTemplateDrop(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function dropTemplateWidget(event) {
    event.preventDefault();
    const typeId = event.dataTransfer.getData('application/x-nexora-widget-type') || dragTemplateType;
    setDragTemplateType('');
    if (!typeId) return;
    addTemplateWidget(typeId);
  }

  function dropPointerTemplate() {
    if (!dragTemplateType) return;
    addTemplateWidget(dragTemplateType);
    setDragTemplateType('');
  }

  function resetSettings() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ALARM_KEY);
    localStorage.removeItem(WORLD_CLOCK_KEY);
    localStorage.removeItem(TIME_FORMAT_KEY);
    localStorage.removeItem(CUSTOM_WIDGETS_KEY);
    localStorage.removeItem(DELETED_WIDGETS_KEY);
    localStorage.removeItem(CUSTOM_SECTIONS_KEY);
    localStorage.removeItem(DASHBOARD_LAYOUT_KEY);
    localStorage.removeItem('nexora.dashboard-layout.v1');
    localStorage.removeItem('nexora.dashboard-layout.v2');
    localStorage.removeItem('nexora.dashboard-layout.v3');
    localStorage.removeItem('nexora.dashboard-layout.v4');
    localStorage.removeItem(NEWS_VIEW_HISTORY_KEY);
    localStorage.removeItem(HYDRATION_KEY);
    localStorage.removeItem(HABITS_KEY);
    localStorage.removeItem(QUICK_LINKS_KEY);
    localStorage.removeItem(AGENDA_KEY);
    localStorage.removeItem(DAILY_GOALS_KEY);
    localStorage.removeItem(EXAM_COUNTDOWNS_KEY);
    localStorage.removeItem(ROOM_MODE_KEY);
    localStorage.removeItem(CAFFEINE_KEY);
    localStorage.removeItem(BRAIN_DUMP_KEY);
    localStorage.removeItem(FOCUS_LOG_KEY);
    localStorage.removeItem(SLEEP_MODE_KEY);
    localStorage.removeItem(TIME_DECK_SETTINGS_KEY);
    localStorage.removeItem(TIME_DECK_ALARMS_KEY);
    localStorage.removeItem(ASSISTANT_SETTINGS_KEY);
    localStorage.removeItem(LOCATION_SETTINGS_KEY);
    localStorage.removeItem(LOOK_STYLE_KEY);
    localStorage.removeItem(DASHBOARD_THEME_KEY);
    localStorage.removeItem(PRESENCE_SETTINGS_KEY);
    localStorage.removeItem(COMMAND_HISTORY_KEY);
    localStorage.removeItem(REMOTE_CAMERA_SETTINGS_KEY);
    localStorage.removeItem(SECURITY_LOG_KEY);
    localStorage.removeItem(LANGUAGE_SETTINGS_KEY);
    localStorage.removeItem('nexora.clock.mode');
    localStorage.removeItem('nexora.clock.auto');
    setAlarm('06:30');
    setTimeFormat('24');
    setWorldClocks(defaultWorldClocks());
    setCustomWidgets(defaultCustomWidgets());
    setCustomSections([]);
    setDeletedWidgets([]);
    setAutoColor(true);
    setRoomMode('relax');
    setAssistantSettings(DEFAULT_ASSISTANT_SETTINGS);
    setLocationSettings(DEFAULT_LOCATION_SETTINGS);
    setLookStyle('glossy');
    setDashboardTheme('black');
    setTimeDeckSettings(DEFAULT_TIME_DECK_SETTINGS);
    setPresenceSettings(DEFAULT_PRESENCE_SETTINGS);
    setRemoteCameraSettings(DEFAULT_REMOTE_CAMERA_SETTINGS);
    setLanguageSettings(DEFAULT_LANGUAGE_SETTINGS);
    securityLog.clear();
    clearCommandHistory();
    setActiveTimeDeckSection(DEFAULT_TIME_DECK_SETTINGS.defaultSection);
  }

  function updateAssistant(field, value) {
    setAssistantSettings((current) => ({ ...current, [field]: value }));
  }

  function updateLocation(field, value) {
    setLocationSettings((current) => ({ ...current, [field]: value }));
  }

  function applyLocationPreset(city) {
    const preset = LOCATION_PRESETS.find((item) => item.city === city);
    if (!preset) return;
    setLocationSettings((current) => ({
      ...current,
      weatherName: preset.city,
      weatherLat: preset.lat,
      weatherLon: preset.lon,
      weatherTimezone: preset.timezone,
      clockCity: preset.city,
      clockTimezone: preset.timezone
    }));
  }

  async function syncRemoteCameraSettings(patch) {
    const next = { ...remoteCameraSettings, ...patch };
    setRemoteCameraSettings(next);
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/remote-camera/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: next.mode,
          camera_mode: next.cameraMode,
          camera_enabled: next.cameraEnabled,
          privacy_mode: next.privacyMode,
          high_security: next.highSecurity,
          security_snapshots: next.securitySnapshots,
        camera_device: next.cameraDevice,
        background_adaptive_brightness: next.backgroundAdaptiveBrightness,
        camera_look_mode: next.cameraLookMode,
        stream_profile: next.streamProfile,
          stream_fps: next.streamFps,
          stream_quality: next.streamQuality,
          stream_width: next.streamWidth,
          stream_height: next.streamHeight,
          camera_controls: cameraControlsToBackend(next.cameraControls),
          failed_attempt_threshold: next.failedAttemptThreshold,
          password: patch.password || '',
          old_password: patch.oldPassword || ''
        })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Remote camera setting failed');
      if (typeof data.settings?.background_adaptive_brightness === 'boolean') {
        setRemoteCameraSettings({ backgroundAdaptiveBrightness: data.settings.background_adaptive_brightness });
      }
      if (data.settings?.stream_settings) {
        setRemoteCameraSettings({
          streamProfile: data.settings.stream_settings.profile,
          streamFps: data.settings.stream_settings.fps,
          streamQuality: data.settings.stream_settings.quality,
          streamWidth: data.settings.stream_settings.width,
          streamHeight: data.settings.stream_settings.height
        });
      }
      if (data.settings?.camera_controls) {
        setRemoteCameraSettings({ cameraControls: cameraControlsFromBackend(data.settings.camera_controls) });
      }
      if (data.settings?.camera_look_mode) {
        setRemoteCameraSettings({ cameraLookMode: data.settings.camera_look_mode });
      }
      if (patch.password) setRemoteCameraSettings({ passwordSet: true });
    } catch (error) {
      pushToast('Remote camera settings', error.message || 'Backend sync failed.', 'amber');
    }
  }

  async function permissionState(name) {
    try {
      if (!navigator.permissions?.query) return 'unknown';
      const result = await navigator.permissions.query({ name });
      return result.state;
    } catch {
      return 'unknown';
    }
  }

  async function runHealthCheck() {
    const results = [];
    let backendStatus = null;
    let deviceStatus = null;
    let signalStatus = null;
    let remoteCameraStatus = null;
    let usbCameraSensor = null;
    let usbCameraLogs = [];
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/status`);
      backendStatus = await response.json();
      results.push({ label: 'Backend online', status: backendStatus.ok ? 'Passed' : 'Failed', fix: 'Run backend on port 8787.' });
    } catch {
      results.push({ label: 'Backend online', status: 'Failed', fix: 'Run: ALLOW_DEVICE_CONTROL=true bash start-kiosk.sh' });
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/device/status`);
      deviceStatus = await response.json();
    } catch {
      deviceStatus = null;
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/signal/status`);
      signalStatus = await response.json();
    } catch {
      signalStatus = null;
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/remote-camera/status`);
      remoteCameraStatus = await response.json();
    } catch {
      remoteCameraStatus = null;
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/local-camera/sensor`);
      usbCameraSensor = await response.json();
      const logResponse = await fetch(`${DEVICE_API_BASE}/api/local-camera/logs`);
      const logData = await logResponse.json();
      usbCameraLogs = logData.logs || [];
      setCameraLogEntries(usbCameraLogs);
    } catch {
      usbCameraSensor = null;
      setCameraLogEntries([{ time: Date.now() / 1000, level: 'error', message: 'Local camera sensor backend is offline.' }]);
    }
    const models = backendStatus?.ollama?.models || [];
    const modelInstalled = (model) => {
      const clean = String(model || '').trim();
      if (!clean) return false;
      return models.includes(clean) || models.includes(`${clean}:latest`) || models.some((item) => item.split(':')[0] === clean.split(':')[0]);
    };
    results.push({ label: 'Ollama online', status: backendStatus?.ollama?.ok ? 'Passed' : 'Failed', fix: 'Run: ollama serve' });
    [
      ['2.5 model exists', assistantSettings.model25],
      ['3.5 model exists', assistantSettings.model35],
      ['4.5 model exists', assistantSettings.model45],
      ['Qwen coding model exists', assistantSettings.qwenModel],
      ['Auto fast model exists', assistantSettings.easyModel],
      ['Auto hard model exists', assistantSettings.hardModel]
    ].forEach(([label, model]) => {
      results.push({ label, status: modelInstalled(model) ? 'Passed' : 'Failed', fix: `OLLAMA_MODELS="C:\\Users\\saeed\\OneDrive\\Documents\\KISOKE\\ollama" ollama pull ${model}` });
    });
    const mic = await permissionState('microphone');
    const camera = await permissionState('camera');
    results.push({ label: 'Mic permission', status: mic === 'granted' ? 'Passed' : mic === 'denied' ? 'Failed' : 'Warning', fix: 'Allow microphone in Chrome site settings.' });
    results.push({ label: 'Camera permission', status: camera === 'granted' ? 'Passed' : camera === 'denied' ? 'Failed' : 'Warning', fix: 'Allow camera in Chrome site settings.' });
    results.push({ label: 'Speech recognition support', status: (window.SpeechRecognition || window.webkitSpeechRecognition) ? 'Passed' : 'Failed', fix: 'Use Chrome or Edge.' });
    results.push({ label: 'Speech synthesis support', status: window.speechSynthesis ? 'Passed' : 'Failed', fix: 'Use a browser with speech synthesis.' });
    results.push({ label: 'Battery API/backend', status: battery?.level != null || battery?.supported ? 'Passed' : 'Warning', fix: 'Install upower or use supported browser battery API.' });
    results.push({ label: 'Weather source', status: weather?.loaded ? 'Passed' : 'Warning', fix: 'Check internet and Open-Meteo access.' });
    results.push({ label: 'Drag layout saving', status: localStorage.getItem(DASHBOARD_LAYOUT_KEY) != null ? 'Passed' : 'Warning', fix: 'Move one widget/section once to save layout.' });
    results.push({ label: 'Notification small mode', status: 'Passed', fix: 'Notifications stay top-right and under 90px unless expanded.' });
    results.push({ label: 'Tailscale detected', status: deviceStatus?.tailscale?.available || deviceStatus?.dependencies?.tailscale?.available ? 'Passed' : 'Warning', fix: 'curl -fsSL https://tailscale.com/install.sh | sh' });
    results.push({ label: 'Signal Center hardware', status: signalStatus?.sdr?.connected ? 'Passed' : 'Warning', fix: signalStatus?.sdr?.message || 'Connect RTL-SDR hardware for live radio/ADS-B.' });
    results.push({ label: 'RTL-SDR status', status: signalStatus?.sdr?.dependencies?.some?.((item) => item.name === 'rtl_test' && item.available) ? 'Passed' : 'Warning', fix: 'sudo apt install -y rtl-sdr' });
    results.push({ label: 'Remote camera local status', status: remoteCameraStatus?.network_allowed ? 'Passed' : 'Warning', fix: remoteCameraStatus?.message || 'Enable Local or Tailscale mode and set a password.' });
    results.push({ label: 'Local camera sensor', status: usbCameraSensor?.camera?.connected ? 'Passed' : 'Warning', fix: usbCameraSensor?.camera?.error || 'Set camera mode to Sensor and confirm no other app is using the webcam.' });
    results.push({ label: 'Room brightness sensor', status: usbCameraSensor?.brightness?.last_updated ? 'Passed' : 'Warning', fix: 'Sensor mode must be active and OpenCV must read frames.' });
    results.push({ label: 'Motion sensor', status: usbCameraSensor?.motion ? 'Passed' : 'Warning', fix: 'Move in front of the selected laptop/computer camera, then rerun health check.' });
    results.push({ label: 'Face presence sensor', status: usbCameraSensor?.face ? 'Passed' : 'Warning', fix: 'Face presence uses Haar fallback only; no identity recognition.' });
    results.push({ label: 'Language system', status: ['en', 'ar'].includes(languageSettings.language) ? 'Passed' : 'Warning', fix: 'Choose English or Arabic in Settings.' });
    const missing = Object.entries(deviceStatus?.dependencies || {}).filter(([, value]) => !value.available);
    results.push({ label: 'Device dependencies', status: missing.length ? 'Warning' : 'Passed', fix: missing[0] ? missing[0][1].install : 'All detected tools are installed.' });
    setHealthResults(results);
    pushToast('Health check', `${results.filter((item) => item.status === 'Passed').length}/${results.length} passed`, 'blue');
  }

  return (
    <section className={`tools-page ${mode}`}>
      <header className="dash-top tools-top">
        <button className="icon-button" onClick={goBack} aria-label="Back"><ChevronLeft size={24} /></button>
        <div>
          <h1>Nexora Tools</h1>
          <p>Timers, world clocks, alarm, stopwatch, and kiosk settings</p>
        </div>
        <div className="tools-top-actions">
          <button type="button" onClick={runHealthCheck}>Health page</button>
          <button type="button" onClick={goSoftware}>Auto add system tools</button>
          <button className="danger-button" onClick={resetSettings}>Reset settings</button>
        </div>
      </header>

      <main className="tools-grid">
        <section className="panel tool-panel theme-panel">
          <div className="panel-heading">
            <Sun size={22} />
            <div>
              <h2>Theme</h2>
              <p>Pick Auto, White, Middle/Dark, or Red</p>
            </div>
          </div>
          <div className="theme-mode-grid" aria-label="Theme mode">
            <button type="button" className={autoColor ? 'active auto' : 'auto'} onClick={() => setAutoColor(true)}>
              <span />
              <strong>Auto</strong>
              <em>Time based</em>
            </button>
            <button type="button" className={!autoColor && manualMode === 'white' ? 'active white' : 'white'} onClick={() => setManualMode('white')}>
              <span />
              <strong>White</strong>
              <em>Bright day</em>
            </button>
            <button type="button" className={!autoColor && manualMode === 'slate' ? 'active slate' : 'slate'} onClick={() => setManualMode('slate')}>
              <span />
              <strong>Middle</strong>
              <em>Dark slate</em>
            </button>
            <button type="button" className={!autoColor && manualMode === 'night' ? 'active red' : 'red'} onClick={() => setManualMode('night')}>
              <span />
              <strong>Red</strong>
              <em>Night safe</em>
            </button>
          </div>
          <div className="tool-readout">Current theme: {autoColor ? `Auto / ${mode}` : manualMode}</div>
        </section>

        <section className="panel tool-panel dashboard-theme-panel">
          <div className="panel-heading">
            <Gauge size={22} />
            <div>
              <h2>Dashboard Colors</h2>
              <p>Only changes the dashboard page</p>
            </div>
          </div>
          <div className="theme-mode-grid dashboard-theme-grid" aria-label="Dashboard colors">
            {['black', 'white', 'red'].map((theme) => (
              <button key={theme} type="button" className={dashboardTheme === theme ? `active ${theme}` : theme} onClick={() => setDashboardTheme(theme)}>
                <span />
                <strong>{theme[0].toUpperCase() + theme.slice(1)}</strong>
                <em>{theme === 'black' ? 'Default dark' : theme === 'white' ? 'Bright dashboard' : 'Red night dashboard'}</em>
              </button>
            ))}
          </div>
          <div className="tool-readout">Dashboard color: {dashboardTheme}</div>
        </section>

        <section className="panel tool-panel time-deck-settings-panel">
          <div className="panel-heading">
            <Clock3 size={22} />
            <div>
              <h2>Time Deck</h2>
              <p>Left page clock tools. Live Clock stays in the middle.</p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label>Default section
              <select value={timeDeckSettings.defaultSection} onChange={(event) => setTimeDeckSettings({ defaultSection: event.target.value })}>
                {TIME_DECK_SECTIONS.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
              </select>
            </label>
            <label>Scroll sensitivity
              <select value={timeDeckSettings.scrollSensitivity} onChange={(event) => setTimeDeckSettings({ scrollSensitivity: event.target.value })}>
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
              </select>
            </label>
            <label>Main clock timezone
              <select value={timeDeckSettings.clockTimezoneMode} onChange={(event) => setTimeDeckSettings({ clockTimezoneMode: event.target.value })}>
                <option value="auto">auto</option>
                <option value="Dubai">Dubai</option>
                <option value="China">China</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <label>Custom timezone<input value={timeDeckSettings.customClockTimezone} onChange={(event) => setTimeDeckSettings({ customClockTimezone: event.target.value })} placeholder="Asia/Dubai" /></label>
            <label>Clock style
              <select value={timeDeckSettings.clockStyle} onChange={(event) => setTimeDeckSettings({ clockStyle: event.target.value })}>
                {['minimal', 'glossy', 'luxury', 'hacker', 'aurora', 'red-night'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>Moon mode
              <select value={timeDeckSettings.moonMode} onChange={(event) => setTimeDeckSettings({ moonMode: event.target.value })}>
                <option value="auto">automatic real moon phase</option>
                <option value="manual">manual moon phase</option>
                <option value="disabled">disable moon visuals</option>
              </select>
            </label>
            <label>Manual moon phase<input value={timeDeckSettings.manualMoonPhase} onChange={(event) => setTimeDeckSettings({ manualMoonPhase: event.target.value })} /></label>
            <label>Sun mode
              <select value={timeDeckSettings.sunMode} onChange={(event) => setTimeDeckSettings({ sunMode: event.target.value })}>
                <option value="auto">auto by local time</option>
                <option value="timezone">custom city timezone</option>
                <option value="manual">manual preview</option>
              </select>
            </label>
          </div>
          <div className="dock compact">
            <button className={timeDeckSettings.enabled ? 'active' : ''} onClick={() => setTimeDeckSettings({ enabled: !timeDeckSettings.enabled })}>Time Deck {timeDeckSettings.enabled ? 'on' : 'off'}</button>
            <button className={timeDeckSettings.scrollSnap ? 'active' : ''} onClick={() => setTimeDeckSettings({ scrollSnap: !timeDeckSettings.scrollSnap })}>Snap</button>
            <button className={timeDeckSettings.touchSwipe ? 'active' : ''} onClick={() => setTimeDeckSettings({ touchSwipe: !timeDeckSettings.touchSwipe })}>Touch swipe</button>
            <button className={timeDeckSettings.keyboardNavigation ? 'active' : ''} onClick={() => setTimeDeckSettings({ keyboardNavigation: !timeDeckSettings.keyboardNavigation })}>Arrow keys</button>
            <button className={timeDeckSettings.showDots ? 'active' : ''} onClick={() => setTimeDeckSettings({ showDots: !timeDeckSettings.showDots })}>Dots</button>
            <button className={timeDeckSettings.showNextHint ? 'active' : ''} onClick={() => setTimeDeckSettings({ showNextHint: !timeDeckSettings.showNextHint })}>Hint</button>
          </div>
          <div className="tool-readout">Current section: {TIME_DECK_SECTIONS.find((section) => section.id === activeTimeDeckSection)?.label || 'Alarm'}</div>
        </section>

        <section className="panel tool-panel assistant-settings-panel">
          <div className="panel-heading">
            <Sparkles size={22} />
            <div>
              <h2>AI Names & Voice</h2>
              <p>Controls what the assistant is called and what it calls you</p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label>AI name<input value={assistantSettings.assistantName} onChange={(event) => updateAssistant('assistantName', event.target.value)} /></label>
            <label>Intro name<input value={assistantSettings.introName} onChange={(event) => updateAssistant('introName', event.target.value)} /></label>
            <label>AI calls me<input value={assistantSettings.callNames} onChange={(event) => updateAssistant('callNames', event.target.value)} /></label>
            <label>Startup call name<input value={assistantSettings.startupCallName} onChange={(event) => updateAssistant('startupCallName', event.target.value)} /></label>
            <label>AI model mode
              <select value={assistantSettings.modelTier} onChange={(event) => updateAssistant('modelTier', event.target.value)}>
                {AI_MODEL_TIERS.map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
              </select>
            </label>
            <label>2.5 model<input value={assistantSettings.model25} onChange={(event) => updateAssistant('model25', event.target.value)} /></label>
            <label>3.5 model<input value={assistantSettings.model35} onChange={(event) => updateAssistant('model35', event.target.value)} /></label>
            <label>4.5 model<input value={assistantSettings.model45} onChange={(event) => updateAssistant('model45', event.target.value)} /></label>
            <label>Qwen coding model<input value={assistantSettings.qwenModel} onChange={(event) => updateAssistant('qwenModel', event.target.value)} /></label>
            <label>Auto fast model<input value={assistantSettings.easyModel} onChange={(event) => updateAssistant('easyModel', event.target.value)} /></label>
            <label>Auto hard model<input value={assistantSettings.hardModel} onChange={(event) => updateAssistant('hardModel', event.target.value)} /></label>
            <label>Custom startup audio<input value={assistantSettings.customStartupAudio} onChange={(event) => updateAssistant('customStartupAudio', event.target.value)} placeholder="C:\\...\\audio.mp3 or leave empty" /></label>
            <label>Voice mode
              <select value={assistantSettings.voiceMode} onChange={(event) => updateAssistant('voiceMode', event.target.value)}>
                <option value="off">Off</option>
                <option value="press">Press-to-talk</option>
                <option value="wake">Wake word mode</option>
              </select>
            </label>
            <label>Startup greeting
              <select value={assistantSettings.startupGreetingMode} onChange={(event) => updateAssistant('startupGreetingMode', event.target.value)}>
                <option value="intro">use intro phrase</option>
                <option value="random">use random name</option>
                <option value="custom">custom text</option>
                <option value="audio">custom audio</option>
                <option value="silent">silent startup</option>
              </select>
            </label>
            <label>Custom startup text<input value={assistantSettings.customStartupText} onChange={(event) => updateAssistant('customStartupText', event.target.value)} /></label>
          </div>
          <div className="model-tier-grid">
            {AI_MODEL_TIERS.map((tier) => {
              const modelName = tier.id === 'auto' ? `${assistantSettings.easyModel} / ${assistantSettings.hardModel}` : modelForTier(assistantSettings, tier.id);
              return (
                <button type="button" key={tier.id} className={assistantSettings.modelTier === tier.id ? 'active' : ''} onClick={() => updateAssistant('modelTier', tier.id)}>
                  <strong>{tier.label}</strong>
                  <span>{modelName}</span>
                  <em>{tier.detail}</em>
                </button>
              );
            })}
          </div>
          <div className="dock compact">
            <button className={assistantSettings.voiceAssistant ? 'active' : ''} onClick={() => updateAssistant('voiceAssistant', !assistantSettings.voiceAssistant)}>{assistantSettings.voiceAssistant ? 'Voice on' : 'Voice off'}</button>
            <button className={assistantSettings.alwaysListen ? 'active' : ''} onClick={() => updateAssistant('alwaysListen', !assistantSettings.alwaysListen)}>{assistantSettings.alwaysListen ? 'Always listen on' : 'Always listen off'}</button>
            <button className={assistantSettings.voiceReplies ? 'active' : ''} onClick={() => updateAssistant('voiceReplies', !assistantSettings.voiceReplies)}>{assistantSettings.voiceReplies ? 'Talk back on' : 'Talk back off'}</button>
            <button className={assistantSettings.alwaysShowOrb ? 'active' : ''} onClick={() => updateAssistant('alwaysShowOrb', !assistantSettings.alwaysShowOrb)}>{assistantSettings.alwaysShowOrb ? 'Orb always on' : 'Orb auto'}</button>
            <button className={assistantSettings.showOrbTranscript ? 'active' : ''} onClick={() => updateAssistant('showOrbTranscript', !assistantSettings.showOrbTranscript)}>{assistantSettings.showOrbTranscript ? 'Transcript on' : 'Transcript off'}</button>
            <button className={assistantSettings.voiceDebug ? 'active' : ''} onClick={() => updateAssistant('voiceDebug', !assistantSettings.voiceDebug)}>{assistantSettings.voiceDebug ? 'Debug on' : 'Debug off'}</button>
            <button className={assistantSettings.randomizeCallName ? 'active' : ''} onClick={() => updateAssistant('randomizeCallName', !assistantSettings.randomizeCallName)}>{assistantSettings.randomizeCallName ? 'Random names' : 'Fixed name'}</button>
            <button onClick={() => voiceAssistant.startListening(true)}><Mic size={16} /> Test mic</button>
          </div>
          <div className="tool-readout">{voiceAssistant.error || (voiceAssistant.listening ? `Listening for "Hey ${assistantSettings.assistantName}"` : 'Voice is idle')}</div>
        </section>

        <section className="panel tool-panel core-console-panel">
          <div className="panel-heading">
            <Shield size={22} />
            <div>
              <h2>Core Console</h2>
              <p>Mic, camera, AI, backend, weather, battery, notifications, and device health</p>
            </div>
            <button type="button" onClick={runHealthCheck}>Run Health Check</button>
          </div>
          <div className="console-grid">
            <span>Mic permission <strong>{healthResults.find((item) => item.label === 'Mic permission')?.status || 'Run check'}</strong></span>
            <span>Speech recognition <strong>{(window.SpeechRecognition || window.webkitSpeechRecognition) ? 'supported' : 'not supported'}</strong></span>
            <span>Camera permission <strong>{healthResults.find((item) => item.label === 'Camera permission')?.status || 'Run check'}</strong></span>
            <span>Ollama status <strong>{healthResults.find((item) => item.label === 'Ollama online')?.status || 'Run check'}</strong></span>
            <span>Backend status <strong>{healthResults.find((item) => item.label === 'Backend online')?.status || 'Run check'}</strong></span>
            <span>Current route <strong>{currentPage}</strong></span>
            <span>Current theme <strong>{autoColor ? `auto / ${mode}` : manualMode}</strong></span>
            <span>Current weather mode <strong>{weatherMood.id}</strong></span>
            <span>Current brightness <strong>backend check</strong></span>
            <span>Current battery % <strong>{battery?.level ?? battery?.percent ?? 'n/a'}%</strong></span>
            <span>Current layout profile <strong>{lookStyle}</strong></span>
            <span>Last voice transcript <strong>{voiceAssistant.transcript || 'none'}</strong></span>
            <span>Last command detected <strong>{lastCommand || 'none'}</strong></span>
            <span>Last error <strong>{lastError || voiceAssistant.error || 'none'}</strong></span>
            <span>Signal Center hardware <strong>{healthResults.find((item) => item.label === 'Signal Center hardware')?.status || 'Run check'}</strong></span>
            <span>RTL-SDR status <strong>{healthResults.find((item) => item.label === 'RTL-SDR status')?.status || 'Run check'}</strong></span>
            <span>Remote camera local status <strong>{healthResults.find((item) => item.label === 'Remote camera local status')?.status || 'Run check'}</strong></span>
            <span>Local camera sensor <strong>{healthResults.find((item) => item.label === 'Local camera sensor')?.status || 'Run check'}</strong></span>
            <span>Language system status <strong>{healthResults.find((item) => item.label === 'Language system')?.status || languageSettings.language}</strong></span>
          </div>
          <div className="camera-log-list">
            {cameraLogEntries.slice(0, 8).map((entry, index) => (
              <code key={`${entry.time}-${index}`}>{entry.level}: {entry.message}</code>
            ))}
            {!cameraLogEntries.length ? <code>Run Health Check to load camera sensor logs.</code> : null}
          </div>
          <div className="notification-preview-grid">
            {[
              ['Success preview', 'Saved cleanly.', 'green'],
              ['Warning preview', 'Something needs attention.', 'amber'],
              ['Error preview', 'A service is offline.', 'red'],
              ['AI reply preview', 'How can I help you today Saeed?', 'blue'],
              ['Timer preview', 'Countdown finished.', 'green'],
              ['Prayer preview', 'Maghrib is soon.', 'amber']
            ].map(([title, detail, tone]) => (
              <button type="button" key={title} onClick={() => pushToast(title, detail, tone)}>{title}</button>
            ))}
          </div>
          {healthResults.length > 0 && (
            <div className="health-results">
              {healthResults.map((item) => (
                <div key={item.label} className={item.status.toLowerCase()}>
                  <strong>{item.status}</strong>
                  <span>{item.label}</span>
                  <code>{item.fix}</code>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel tool-panel presence-settings-panel">
          <div className="panel-heading">
            <Eye size={22} />
            <div>
              <h2>Presence Mode</h2>
              <p>Camera brightness and motion only. No face identity or recognition.</p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label>Wake window start<input type="time" value={presenceSettings.wakeStart} onChange={(event) => setPresenceSettings({ wakeStart: event.target.value })} /></label>
            <label>Wake window end<input type="time" value={presenceSettings.wakeEnd} onChange={(event) => setPresenceSettings({ wakeEnd: event.target.value })} /></label>
            <label>Black/off-looking at<input type="time" value={presenceSettings.nightBlackoutAt} onChange={(event) => setPresenceSettings({ nightBlackoutAt: event.target.value })} /></label>
            <label>Dim after minutes<input type="number" min="1" max="60" value={presenceSettings.idleDimMinutes} onChange={(event) => setPresenceSettings({ idleDimMinutes: Number(event.target.value) })} /></label>
          </div>
          <div className="dock compact">
            <button className={presenceSettings.enabled ? 'active' : ''} onClick={() => setPresenceSettings({ enabled: !presenceSettings.enabled })}>{presenceSettings.enabled ? 'Presence on' : 'Presence off'}</button>
            <button className={presenceSettings.manualOverride ? 'active' : ''} onClick={() => setPresenceSettings({ manualOverride: !presenceSettings.manualOverride })}>{presenceSettings.manualOverride ? 'Manual override on' : 'Manual override off'}</button>
            <button className={presenceSettings.allowNightBlackout ? 'active' : ''} onClick={() => setPresenceSettings({ allowNightBlackout: !presenceSettings.allowNightBlackout })}>{presenceSettings.allowNightBlackout ? 'Night blackout allowed' : 'Night blackout blocked'}</button>
            <button className={presenceSettings.allowIdleSleep ? 'active' : ''} onClick={() => setPresenceSettings({ allowIdleSleep: !presenceSettings.allowIdleSleep })}>{presenceSettings.allowIdleSleep ? 'Idle sleep allowed' : 'Idle sleep blocked'}</button>
          </div>
          <div className="automation-rule-list">
            <span>8:00 AM-8:00 PM motion - wake screen</span>
            <span>No movement - dim screen only when Idle sleep is allowed</span>
            <span>Dark room - red/night mode when backend brightness is available</span>
            <span>9:00 PM blackout is blocked unless Night blackout is allowed</span>
          </div>
        </section>

        <section className="panel tool-panel remote-camera-settings-panel">
          <div className="panel-heading">
            <Camera size={22} />
            <div>
              <h2>Remote Camera Access</h2>
              <p>Local/Tailscale only. Password required. No cloud, no third-party camera provider.</p>
            </div>
            <button type="button" onClick={goRemoteCamera}>Open Remote Camera</button>
          </div>
          <div className="dock compact">
            <button className={remoteCameraSettings.cameraMode === 'off' || !remoteCameraSettings.cameraEnabled ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ cameraMode: 'off', cameraEnabled: false })}>Camera Off</button>
            <button className={remoteCameraSettings.cameraMode === 'sensor' ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ cameraMode: 'sensor', cameraEnabled: true, privacyMode: false })}>Sensor Only</button>
            <button className={remoteCameraSettings.cameraMode === 'live' ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ cameraMode: 'live', cameraEnabled: true, privacyMode: false })}>Live View</button>
            <button className={remoteCameraSettings.cameraMode === 'privacy' || remoteCameraSettings.privacyMode ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ cameraMode: 'privacy', privacyMode: true })}>Privacy</button>
            <button className={remoteCameraSettings.mode === 'local' ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ mode: 'local' })}>Enable Local Access</button>
            <button className={remoteCameraSettings.mode === 'tailscale' ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ mode: 'tailscale' })}>Enable Tailscale Access</button>
            <button className={remoteCameraSettings.mode === 'both' ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ mode: 'both' })}>Enable Local + Tailscale</button>
            <button className={remoteCameraSettings.mode === 'disabled' ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ mode: 'disabled' })}>Disable All Remote Access</button>
            <button className={remoteCameraSettings.cameraEnabled ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ cameraEnabled: !remoteCameraSettings.cameraEnabled })}>{remoteCameraSettings.cameraEnabled ? 'Camera enabled' : 'Camera disabled'}</button>
            <button className={remoteCameraSettings.privacyMode ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ privacyMode: !remoteCameraSettings.privacyMode })}>{remoteCameraSettings.privacyMode ? 'Privacy shield on' : 'Privacy shield off'}</button>
            <button className={remoteCameraSettings.backgroundAdaptiveBrightness ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ backgroundAdaptiveBrightness: !remoteCameraSettings.backgroundAdaptiveBrightness })}>{remoteCameraSettings.backgroundAdaptiveBrightness ? 'Adaptive brightness on' : 'Adaptive brightness off'}</button>
            <button className={remoteCameraSettings.highSecurity ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ highSecurity: !remoteCameraSettings.highSecurity })}>{remoteCameraSettings.highSecurity ? 'High security on' : 'High security off'}</button>
            <button className={remoteCameraSettings.securitySnapshots ? 'active' : ''} onClick={() => syncRemoteCameraSettings({ securitySnapshots: !remoteCameraSettings.securitySnapshots })}>{remoteCameraSettings.securitySnapshots ? 'Security snapshots on' : 'Security snapshots off'}</button>
          </div>
          <CameraModeControls settings={remoteCameraSettings} onChange={syncRemoteCameraSettings} compact />
          <CameraStreamControls settings={remoteCameraSettings} onChange={syncRemoteCameraSettings} compact />
          <div className="settings-form-grid">
            <label>Backend camera device
              <select value={remoteCameraSettings.cameraDevice} onChange={(event) => syncRemoteCameraSettings({ cameraDevice: Number(event.target.value) })}>
                {[0, 1, 2, 3, 4, 5].map((id) => <option key={id} value={id}>Device {id}</option>)}
              </select>
            </label>
            {remoteCameraSettings.passwordSet ? <label>Current camera password<input type="password" value={remoteOldPasswordDraft} onChange={(event) => setRemoteOldPasswordDraft(event.target.value)} placeholder="Required to change password" /></label> : null}
            <label>New camera password<input type="password" value={remotePasswordDraft} onChange={(event) => setRemotePasswordDraft(event.target.value)} placeholder={remoteCameraSettings.passwordSet ? 'Enter new password' : 'Required'} /></label>
            <label>Failed attempt threshold<input type="number" min="1" max="20" value={remoteCameraSettings.failedAttemptThreshold} onChange={(event) => syncRemoteCameraSettings({ failedAttemptThreshold: Number(event.target.value) })} /></label>
          </div>
          <div className="dock compact">
            <button type="button" onClick={() => { syncRemoteCameraSettings({ password: remotePasswordDraft, oldPassword: remoteOldPasswordDraft }); setRemotePasswordDraft(''); setRemoteOldPasswordDraft(''); }}><Lock size={16} /> Save password</button>
            <button type="button" onClick={securityLog.clear}>Clear Security Log</button>
            <button type="button" onClick={securityLog.exportLog}>Export Security Log</button>
          </div>
          <div className="automation-rule-list">
            <span>Camera stream must never be publicly accessible.</span>
            <span>Only private localhost, private Wi-Fi, or private Tailscale clients are accepted.</span>
            <span>No cloud uploads, no face recognition, no identity matching, no person tracking.</span>
          </div>
        </section>

        <section className="panel tool-panel language-settings-panel">
          <div className="panel-heading">
            <BookOpen size={22} />
            <div>
              <h2>Language</h2>
              <p>English and Arabic with RTL layout support.</p>
            </div>
          </div>
          <div className="dock compact">
            <button className={languageSettings.language === 'en' ? 'active' : ''} onClick={() => setLanguageSettings({ language: 'en' })}>English</button>
            <button className={languageSettings.language === 'ar' ? 'active' : ''} onClick={() => setLanguageSettings({ language: 'ar' })}>العربية</button>
            <button className={languageSettings.dateArabic ? 'active' : ''} onClick={() => setLanguageSettings({ dateArabic: !languageSettings.dateArabic })}>Arabic dates</button>
            <button className={languageSettings.prayerArabic ? 'active' : ''} onClick={() => setLanguageSettings({ prayerArabic: !languageSettings.prayerArabic })}>Arabic prayer names</button>
          </div>
          <div className="console-grid language-preview">
            <span>Clock <strong>الساعة</strong></span>
            <span>Dashboard <strong>لوحة المعلومات</strong></span>
            <span>Tools <strong>الأدوات</strong></span>
            <span>Signal Center <strong>مركز الإشارات</strong></span>
            <span>Remote Camera <strong>الكاميرا عن بعد</strong></span>
            <span>Presence Mode <strong>وضع التواجد</strong></span>
          </div>
        </section>

        <section className="panel tool-panel command-history-panel">
          <div className="panel-heading">
            <Mic size={22} />
            <div>
              <h2>Voice Command History</h2>
              <p>What Nexora heard, command route, model used, status, and errors.</p>
            </div>
            <button type="button" onClick={clearCommandHistory}>Clear</button>
          </div>
          <div className="command-history-list">
            {commandHistory.length ? commandHistory.slice(0, 12).map((entry) => (
              <div key={entry.id}>
                <strong>{entry.heard || entry.command}</strong>
                <span>{entry.detectedCommand || 'local command'} / {entry.modelUsed || 'none'}</span>
                <em>{entry.success === false ? 'failed' : 'ok'} / {new Date(entry.timestamp).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</em>
                {entry.error ? <code>{entry.error}</code> : null}
              </div>
            )) : <p>No commands recorded yet.</p>}
          </div>
        </section>

        <section className="panel tool-panel location-settings-panel">
          <div className="panel-heading">
            <CloudSun size={22} />
            <div>
              <h2>Clock & Weather Place</h2>
              <p>Choose the clock timezone and weather location</p>
            </div>
          </div>
          <div className="preset-row">
            {LOCATION_PRESETS.map((preset) => <button type="button" key={preset.city} onClick={() => applyLocationPreset(preset.city)}>{preset.city}</button>)}
          </div>
          <div className="settings-form-grid">
            <label>Clock city<input value={locationSettings.clockCity} onChange={(event) => updateLocation('clockCity', event.target.value)} /></label>
            <label>Clock timezone<input value={locationSettings.clockTimezone} onChange={(event) => updateLocation('clockTimezone', event.target.value)} placeholder="Asia/Dubai" /></label>
            <label>Weather place<input value={locationSettings.weatherName} onChange={(event) => updateLocation('weatherName', event.target.value)} /></label>
            <label>Weather timezone<input value={locationSettings.weatherTimezone} onChange={(event) => updateLocation('weatherTimezone', event.target.value)} /></label>
            <label>Latitude<input type="number" step="0.0001" value={locationSettings.weatherLat} onChange={(event) => updateLocation('weatherLat', event.target.value)} /></label>
            <label>Longitude<input type="number" step="0.0001" value={locationSettings.weatherLon} onChange={(event) => updateLocation('weatherLon', event.target.value)} /></label>
          </div>
          <div className="tool-readout">Clock: {formatTimeZone(now, locationSettings.clockTimezone, timeFormat)} / Weather: {locationSettings.weatherName}</div>
        </section>

        <section className="panel tool-panel weather-debug-panel">
          <div className="panel-heading">
            <CloudSun size={22} />
            <div>
              <h2>Weather Debug</h2>
              <p>Shows why the clock background picked sun, moon, rain, cloud, or fallback</p>
            </div>
          </div>
          <div className="console-grid">
            <span>Weather source <strong>{weather.source || 'Open-Meteo'}</strong></span>
            <span>Weather city <strong>{weather.locationName || locationSettings.weatherName}</strong></span>
            <span>Condition text <strong>{weatherCondition(weather.code, isNightAt(now, weather.sunrise, weather.sunset)).label}</strong></span>
            <span>Weather code <strong>{weather.code}</strong></span>
            <span>Temperature <strong>{weather.temp}C</strong></span>
            <span>Cloud % <strong>{weather.cloud ?? 0}%</strong></span>
            <span>Rain % <strong>{weather.rain ?? 0}%</strong></span>
            <span>Precipitation <strong>{weather.precipitation ?? 0} mm</strong></span>
            <span>Wind speed <strong>{weather.wind} km/h</strong></span>
            <span>Live sunrise <strong>{formatShortTime(weather.sunrise, timeFormat)}</strong></span>
            <span>Live sunset <strong>{formatShortTime(weather.sunset, timeFormat)}</strong></span>
            <span>Time phase <strong>{getAmbientPhase(now, weather).label}</strong></span>
            <span>Last updated <strong>{weather.lastUpdated ? formatClockTime(new Date(weather.lastUpdated), timeFormat) : 'cached fallback'}</strong></span>
            <span>Background selected <strong>{getWeatherBackgroundSelection(weather, now)}</strong></span>
          </div>
        </section>

        <section className="panel tool-panel look-settings-panel">
          <div className="panel-heading">
            <Gauge size={22} />
            <div>
              <h2>Layout Look</h2>
              <p>Natural, glossy, hacker, aurora, ethereal, pixel, luxury, Japandi, Memphis, Bohemian</p>
            </div>
          </div>
          <div className="look-style-grid">
            {LOOK_STYLES.map((style) => (
              <button type="button" key={style.id} className={lookStyle === style.id ? 'active' : ''} onClick={() => setLookStyle(style.id)}>
                <span />
                <strong>{style.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="panel tool-panel room-mode-settings-panel">
          <div className="panel-heading">
            <Target size={22} />
            <div>
              <h2>Room Modes & Timeline</h2>
              <p>Sleep, Study, Prayer, Morning school, Guest, Focus, Movie, and Low power presets</p>
            </div>
          </div>
          <div className="look-style-grid room-mode-grid">
            {ROOM_MODES.map((room) => (
              <button type="button" key={room.id} onClick={() => setRoomMode(room.id)}>
                <span />
                <strong>{room.label}</strong>
              </button>
            ))}
          </div>
          <div className="automation-rule-list">
            <span>5:30 AM - Morning mode</span>
            <span>Maghrib - Prayer mode</span>
            <span>10:30 PM - Sleep mode</span>
            <span>Dark room - red-night</span>
            <span>Battery below 20% - Low power</span>
            <span>"study mode" voice command - hide distractions</span>
          </div>
        </section>

        <SoftwareNeededPanel openPage={goSoftware} />

        <section className="panel tool-panel">
          <div className="panel-heading">
            <AlarmClock size={22} />
            <div>
              <h2>Alarm</h2>
              <p>Saved locally on this kiosk</p>
            </div>
          </div>
          <input className="big-input" type="time" value={alarm} onChange={(event) => setAlarm(event.target.value)} />
          <div className="tool-readout"><Bell size={18} /> Next alarm {formatAlarmLabel(alarm, timeFormat)}</div>
        </section>

        <section className="panel tool-panel">
          <div className="panel-heading">
            <Clock3 size={22} />
            <div>
              <h2>Countdown</h2>
              <p>Custom one-shot countdown</p>
            </div>
          </div>
          <div className="number-row">
            <input type="number" min="1" value={countdownMinutes} onChange={(event) => setCountdownMinutes(Number(event.target.value))} />
            <button onClick={() => setCountdownLeft(countdownMinutes * 60)}>Start</button>
            <button onClick={() => setCountdownLeft(0)}>Reset</button>
          </div>
          <div className="large-readout">{formatDuration(countdownLeft)}</div>
        </section>

        <section className="panel tool-panel">
          <div className="panel-heading">
            <Clock3 size={22} />
            <div>
              <h2>Timer</h2>
              <p>Reusable focus or sleep timer</p>
            </div>
          </div>
          <div className="number-row">
            <input type="number" min="1" value={timerMinutes} onChange={(event) => setTimerMinutes(Number(event.target.value))} />
            <button onClick={() => setTimerLeft(timerMinutes * 60)}>Start</button>
            <button onClick={() => setTimerLeft(0)}>Stop</button>
          </div>
          <div className="large-readout">{formatDuration(timerLeft)}</div>
        </section>

        <section className="panel tool-panel">
          <div className="panel-heading">
            <Clock3 size={22} />
            <div>
              <h2>Stopwatch</h2>
              <p>Simple touch stopwatch</p>
            </div>
          </div>
          <div className="large-readout">{formatDuration(stopwatch)}</div>
          <div className="dock compact">
            <button onClick={() => setStopwatchRunning(!stopwatchRunning)}>{stopwatchRunning ? 'Pause' : 'Start'}</button>
            <button onClick={() => { setStopwatchRunning(false); setStopwatch(0); }}>Reset</button>
          </div>
        </section>

        <section className="panel tool-panel world-panel">
          <div className="panel-heading">
            <Sun size={22} />
            <div>
              <h2>World Clock</h2>
              <p>Dubai, Bosnia, and your own cities</p>
            </div>
          </div>
          <form className="world-form" onSubmit={addClock}>
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City name" />
            <input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Europe/Sarajevo" />
            <button>Add</button>
          </form>
          <div className="world-list">
            {worldClocks.map((clock) => (
              <div key={`${clock.city}-${clock.zone}`} className="world-row">
                <div>
                  <strong>{clock.city}</strong>
                  <span>{clock.zone}</span>
                </div>
                <em>{formatTimeZone(now, clock.zone, timeFormat)}</em>
                <button className="x-delete-button" onClick={() => setWorldClocks(worldClocks.filter((item) => item !== clock))} aria-label={`Delete ${clock.city}`}><X size={16} /></button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel tool-panel custom-widget-editor">
          <div className="panel-heading">
            <Gauge size={22} />
            <div>
              <h2>Custom Widgets</h2>
              <p>Add sections, then place widgets inside the section you want</p>
            </div>
          </div>
          <form className="section-builder" onSubmit={addSection}>
            <input value={sectionDraft} onChange={(event) => setSectionDraft(event.target.value)} placeholder="New section name" />
            <button type="submit"><Plus size={16} /> Add section</button>
          </form>
          <div className="section-list">
            {allSections.map((section) => (
              <div key={section.id} className={DASHBOARD_WIDGET_PLACEMENTS.includes(section.id) ? 'section-row built-in' : 'section-row'}>
                <div>
                  <strong>{section.title}</strong>
                  <em>{section.detail}</em>
                </div>
                {!DASHBOARD_WIDGET_PLACEMENTS.includes(section.id) && (
                  <button type="button" onClick={() => removeSection(section.id)} aria-label={`Remove ${section.title}`}><Trash2 size={15} /></button>
                )}
              </div>
            ))}
          </div>
          <div className="widget-template-row" aria-label="Widget templates">
            {WIDGET_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                draggable
                onPointerDown={() => setDragTemplateType(type.id)}
                onDragStart={(event) => startTemplateDrag(event, type.id)}
                onClick={() => {
                  addTemplateWidget(type.id);
                  setDragTemplateType('');
                }}
              >
                <GripVertical size={16} />
                <span>{type.label}</span>
                <Plus size={16} />
              </button>
            ))}
          </div>
          <form className="widget-form" onSubmit={addCustomWidget}>
            <input value={widgetDraft.title} onChange={(event) => updateWidgetDraft('title', event.target.value)} placeholder="Widget title" />
            <input value={widgetDraft.value} onChange={(event) => updateWidgetDraft('value', event.target.value)} placeholder="Value or https:// link" />
            <input value={widgetDraft.detail} onChange={(event) => updateWidgetDraft('detail', event.target.value)} placeholder="Small detail text" />
            <select value={widgetDraft.type} onChange={(event) => updateWidgetDraft('type', event.target.value)}>
              {WIDGET_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
            <select value={widgetDraft.placement} onChange={(event) => updateWidgetDraft('placement', event.target.value)} aria-label="Widget section">
              {allSections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
            </select>
            <select value={widgetDraft.accent} onChange={(event) => updateWidgetDraft('accent', event.target.value)}>
              {WIDGET_ACCENTS.map((accent) => <option key={accent} value={accent}>{accent}</option>)}
            </select>
            <button type="submit">Add widget</button>
          </form>
          <div className="widget-reset-row">
            <button type="button" onClick={resetCustomWidgets}>Reset widgets</button>
            <span>Current widgets move to Recovery for 25 minutes.</span>
          </div>
          <div className={`custom-widget-list widget-drop-zone ${dragTemplateType ? 'ready' : ''}`} onPointerUp={dropPointerTemplate} onDragOver={allowTemplateDrop} onDrop={dropTemplateWidget}>
            {customWidgets.map((widget) => (
              <WidgetTile
                key={widget.id}
                widget={widget}
                onRemove={deleteCustomWidget}
                onToggleLock={toggleWidgetLock}
              />
            ))}
          </div>
          {deletedWidgets.length > 0 && (
            <div className="deleted-widget-list">
              <div className="widget-recovery">
                <span>Deleted widgets can be restored for 25 minutes</span>
                <button type="button" onClick={restoreAllDeletedWidgets}>Restore all</button>
              </div>
              {deletedWidgets.map((widget) => (
                <div className="deleted-widget-row" key={`${widget.id}-${widget.deletedAt}`}>
                  <span>{widget.title}</span>
                  <em>{formatUndoTimeLeft(widget.deletedAt)}</em>
                  <button type="button" onClick={() => restoreDeletedWidget(widget.id)}><Undo2 size={15} /> Undo</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel tool-panel">
          <div className="panel-heading">
            <Clock3 size={22} />
            <div>
              <h2>Time Format</h2>
              <p>Choose how clocks are displayed</p>
            </div>
          </div>
          <div className="dock compact">
            <button className={timeFormat === '12' ? 'active' : ''} onClick={() => setTimeFormat('12')}>12 hour</button>
            <button className={timeFormat === '24' ? 'active' : ''} onClick={() => setTimeFormat('24')}>24 hour</button>
            <button className={timeFormat === 'both' ? 'active' : ''} onClick={() => setTimeFormat('both')}>Both</button>
          </div>
          <div className="tool-readout">Preview: {formatClockTime(now, timeFormat, { seconds: true })}</div>
        </section>
      </main>
    </section>
  );
}

function App() {
  const shellRef = useRef(null);
  const pageSwipeRef = useRef(null);
  const lastPageSwipeRef = useRef(0);
  const alarmMinuteRef = useRef('');
  const finishedAlertRef = useRef(null);
  const cameraFocusWasActiveRef = useRef(false);
  const now = useNow();
  const [assistantSettings, setAssistantSettings] = useAssistantSettings();
  const [locationSettings, setLocationSettings] = useLocationSettings();
  const [timeDeckSettings, setTimeDeckSettings] = useTimeDeckSettings();
  const [presenceSettings, setPresenceSettings] = usePresenceSettings();
  const [remoteCameraSettings, setRemoteCameraSettings] = useRemoteCameraSettings();
  const [languageSettings, setLanguageSettings] = useLanguageSettings();
  const [lookStyle, setLookStyle] = useLookStyle();
  const [performanceMode, setPerformanceMode] = usePerformanceMode();
  const [page, setPage] = useState(() => {
    if (window.location.pathname === '/settings') return 'settings';
    if (window.location.pathname === '/tools') return 'settings';
    if (window.location.pathname === '/dashboard') return 'dashboard';
    if (window.location.pathname === '/clock') return 'clock';
    if (window.location.pathname === '/software-needed') return 'software';
    if (window.location.pathname === '/signal-center') return 'signal';
    if (window.location.pathname === '/radar') return 'radar';
    if (window.location.pathname === '/localhost-camera') return 'localCamera';
    if (window.location.pathname === '/remote-camera') return 'remoteCamera';
    return 'clock';
  });
  const cameraFocusMode = page === 'localCamera' || page === 'remoteCamera' || page === 'radar';
  const weather = useWeather(locationSettings, !cameraFocusMode);
  const { toasts, pushToast } = useToasts();
  const [activeTimeDeckSection, setActiveTimeDeckSection] = useState(() => timeDeckSettings.defaultSection || 'alarm');
  const [showWelcome, setShowWelcome] = useState(() => {
    const cameraRoute = window.location.pathname === '/localhost-camera' || window.location.pathname === '/remote-camera';
    return !cameraRoute && !new URLSearchParams(window.location.search).has('skipIntro');
  });
  const [manualMode, setManualModeState] = useState(() => localStorage.getItem('nexora.clock.mode') || 'slate');
  const [autoColor, setAutoColorState] = useState(true);
  const [dashboardTheme, setDashboardThemeState] = useState(() => localStorage.getItem(DASHBOARD_THEME_KEY) || 'black');
  const [timeFormat, setTimeFormatState] = useState(() => localStorage.getItem(TIME_FORMAT_KEY) || '24');
  const [alarm, setAlarmState] = useState(() => localStorage.getItem(ALARM_KEY) || '06:30');
  const [worldClocks, setWorldClocks] = useWorldClocks();
  const [customWidgets, setCustomWidgets] = useCustomWidgets();
  const [customSections, setCustomSections] = useCustomSections();
  const [deletedWidgets, setDeletedWidgets] = useDeletedWidgets();
  const [blackout, setBlackout] = useState(false);
  const [startupMood] = useState(() => STARTUP_MOODS[Math.floor(Math.random() * STARTUP_MOODS.length)]);
  const [cameraWakeEnabled, setCameraWakeEnabled] = useState(() => localStorage.getItem('nexora.cameraWake') === 'true');
  const [sleepMode, setSleepModeState] = useState(() => localStorage.getItem(SLEEP_MODE_KEY) === 'true');
  const [noiseEnabled, setNoiseEnabled] = useState(false);
  const [roomMode, setRoomMode] = useRoomMode();
  const [focusLock, setFocusLock] = useState(false);
  const [quickControlsOpen, setQuickControlsOpen] = useState(false);
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const [lastError, setLastError] = useState('');
  const musicLibrary = useMusicLibrary(!cameraFocusMode);
  const alarmSoundLibrary = useAlarmSoundLibrary(!cameraFocusMode);
  const videoIntroLibrary = useVideoIntroLibrary(!cameraFocusMode);
  const musicPlayer = useMusicPlayer(musicLibrary);
  const [alarmSoundUrl, setAlarmSoundUrlState] = useState(() => localStorage.getItem(ALARM_SOUND_KEY) || '');
  const idle = useIdlePresence(IDLE_TIMEOUT_MS, !cameraFocusMode);
  const ambientPhase = useMemo(() => getAmbientPhase(now, weather), [now.getHours(), now.getMinutes(), weather.sunrise, weather.sunset, weather.loaded]);
  const weatherMood = useMemo(() => getWeatherMood(weather, isNightAt(now, weather.sunrise, weather.sunset)), [
    weather.code,
    weather.feels,
    weather.humidity,
    weather.wind,
    weather.rain,
    weather.precipitation,
    weather.cloud,
    weather.sunrise,
    weather.sunset,
    now.getHours()
  ]);
  const effectiveSleepMode = sleepMode || ambientPhase.id === 'midnight' || roomMode === 'sleep';
  const currentMinuteLabel = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const presenceBlackoutActive = !cameraFocusMode
    && presenceSettings.enabled
    && !presenceSettings.manualOverride
    && presenceSettings.allowNightBlackout
    && (timeToMinutes(currentMinuteLabel) >= timeToMinutes(presenceSettings.nightBlackoutAt) || now.getHours() < 5);
  const noise = useNoiseMonitor(noiseEnabled && !cameraFocusMode);
  const focus = useFocusSession(!cameraFocusMode);
  const browserBattery = useBatteryStatus();
  const backendBattery = useBackendBatteryStatus(!cameraFocusMode);
  const battery = backendBattery.level == null ? browserBattery : { ...browserBattery, ...backendBattery };
  const caffeine = useCaffeineTimer();
  const timeDesk = useTimeDesk(!cameraFocusMode);
  const timeAlarms = useTimeDeckAlarms(alarm, setAlarm);
  const commandHistory = useCommandHistory();
  const securityLog = useSecurityLog();
  const brainDump = useBrainDump();
  const prayer = useMemo(() => nextPrayer(now), [now]);
  const handleCameraWake = useCallback(() => {
    setBlackout(false);
    setShowWelcome(false);
  }, []);
  const cameraWakeCaptureEnabled = cameraWakeEnabled && !cameraFocusMode && remoteCameraSettings.backgroundAdaptiveBrightness;
  const { videoRef: cameraVideoRef, status: rawCameraWakeStatus } = useCameraWake(cameraWakeCaptureEnabled, handleCameraWake);
  const cameraWakeStatus = cameraWakeEnabled && !cameraWakeCaptureEnabled
    ? (cameraFocusMode ? 'Camera wake paused while camera page is open' : 'Camera wake needs Adaptive brightness on')
    : rawCameraWakeStatus;
  const mode = autoColor ? ambientPhase.mode : manualMode;

  useEffect(() => {
    if (!cameraFocusMode) return;
    setShowWelcome(false);
    setQuickControlsOpen(false);
    setBrainDumpOpen(false);
    setFocusLock(false);
    musicPlayer.pause();
  }, [cameraFocusMode]);

  useEffect(() => {
    if (cameraFocusWasActiveRef.current && !cameraFocusMode) {
      returnRemoteCameraToSensorMode();
      setRemoteCameraSettings({ cameraMode: 'sensor' });
    }
    cameraFocusWasActiveRef.current = cameraFocusMode;
  }, [cameraFocusMode, setRemoteCameraSettings]);

  useEffect(() => {
    setAutoColorState(true);
    localStorage.setItem('nexora.clock.auto', 'true');
  }, []);

  useEffect(() => {
    if (!presenceSettings.allowNightBlackout && !presenceSettings.allowIdleSleep && roomMode !== 'sleep') {
      setSleepMode(false);
      setBlackout(false);
    }
  }, [presenceSettings.allowNightBlackout, presenceSettings.allowIdleSleep, roomMode]);

  useEffect(() => {
    if (cameraFocusMode) return;
    if (!presenceSettings.enabled || presenceSettings.manualOverride) return;
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const inWakeWindow = isMinuteBetween(hhmm, presenceSettings.wakeStart, presenceSettings.wakeEnd);
    const shouldBlackout = presenceSettings.allowNightBlackout
      && (timeToMinutes(hhmm) >= timeToMinutes(presenceSettings.nightBlackoutAt) || now.getHours() < 5);
    const motionDetected = /motion|movement/i.test(cameraWakeStatus);

    if (motionDetected && inWakeWindow) {
      setBlackout(false);
      setSleepMode(false);
      return;
    }

    if (shouldBlackout) {
      setManualMode('night');
      setSleepMode(true);
      if (page === 'clock') setBlackout(true);
      return;
    }

    if (idle && presenceSettings.allowIdleSleep) setSleepMode(true);
  }, [cameraFocusMode, presenceSettings, now.getHours(), now.getMinutes(), cameraWakeStatus, idle, page]);

  function setAlarmSoundUrl(nextUrl) {
    const clean = String(nextUrl || '');
    setAlarmSoundUrlState(clean);
    localStorage.setItem(ALARM_SOUND_KEY, clean);
  }

  const playAlert = useCallback((label, soundUrl = alarmSoundUrl) => {
    playKioskAlertSound(soundUrl).catch(() => {
      playBuiltInAlert().catch(() => {});
    });
    pushToast(label, alarmSoundLibrary.tracks?.length ? 'Playing selected alarm sound.' : 'Playing built-in chime.', 'blue');
  }, [alarmSoundUrl, alarmSoundLibrary.tracks?.length, pushToast]);

  useEffect(() => {
    if (!timeDesk.finished?.id || finishedAlertRef.current === timeDesk.finished.id) return;
    finishedAlertRef.current = timeDesk.finished.id;
    const label = timeDesk.finished.type === 'timer' ? 'Timer finished' : 'Countdown finished';
    playAlert(label);
  }, [timeDesk.finished?.id, timeDesk.finished?.type, playAlert]);

  useEffect(() => {
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const minuteKey = `${now.toDateString()}-${hhmm}`;
    if (alarmMinuteRef.current === minuteKey) return;

    const day = now.getDay();
    const dueAlarm = timeAlarms.alarms.find((item) => {
      if (!item.enabled || item.time !== hhmm) return false;
      if (item.repeat === 'school days') return day >= 1 && day <= 5;
      return true;
    });

    if (!dueAlarm) return;
    alarmMinuteRef.current = minuteKey;
    playAlert(`Alarm ${formatAlarmLabel(dueAlarm.time, timeFormat)}`, dueAlarm.soundUrl || alarmSoundUrl);
    if (dueAlarm.repeat === 'once') timeAlarms.toggleAlarm(dueAlarm.id);
  }, [now, timeAlarms, alarmSoundUrl, playAlert, timeFormat]);

  function setManualMode(nextMode) {
    setManualModeState(nextMode);
    setAutoColorState(false);
    localStorage.setItem('nexora.clock.mode', nextMode);
    localStorage.setItem('nexora.clock.auto', 'false');
  }

  function setAutoColor(enabled) {
    setAutoColorState(enabled);
    localStorage.setItem('nexora.clock.auto', String(enabled));
  }

  function setDashboardTheme(nextTheme) {
    const validTheme = ['black', 'white', 'red'].includes(nextTheme) ? nextTheme : 'black';
    setDashboardThemeState(validTheme);
    localStorage.setItem(DASHBOARD_THEME_KEY, validTheme);
  }

  function setTimeFormat(nextFormat) {
    setTimeFormatState(nextFormat);
    localStorage.setItem(TIME_FORMAT_KEY, nextFormat);
  }

  function setAlarm(nextAlarm) {
    setAlarmState(nextAlarm);
    localStorage.setItem(ALARM_KEY, nextAlarm);
  }

  function setSleepMode(nextValue) {
    setSleepModeState(nextValue);
    localStorage.setItem(SLEEP_MODE_KEY, String(nextValue));
  }

  function movePageBySwipe(deltaX) {
    if (deltaX > SWIPE_DISTANCE) {
      if (page === 'timeTools') setPage('clock');
      else if (page === 'clock') setPage('dashboard');
      else if (page === 'dashboard') setPage('signal');
      else if (page === 'radar') setPage('dashboard');
    } else if (deltaX < -SWIPE_DISTANCE) {
      if (page === 'signal') setPage('dashboard');
      else if (page === 'radar') setPage('dashboard');
      else if (page === 'dashboard') setPage('clock');
      else if (page === 'clock') {
        setActiveTimeDeckSection('alarm');
        setPage('timeTools');
      }
    }
  }

  function pageSwipePoint(event) {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (touch) return { id: 'touch', x: touch.clientX, y: touch.clientY };
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    return { id: event.pointerId ?? 'mouse', x: event.clientX, y: event.clientY };
  }

  function handlePagePointerDown(event) {
    if ((event.pointerType === 'mouse' || event.type === 'mousedown') && event.button !== 0) return;
    if (quickControlsOpen || brainDumpOpen || focusLock) return;
    const protectedControl = Boolean(event.target?.closest?.('input, textarea, select, [contenteditable="true"], .widget-drag-handle, .section-drag-handle'));
    const forceTimeToolSwipe = page === 'timeTools' && Boolean(event.target?.closest?.('.time-deck'));
    const forceDashboardSwipe = page === 'dashboard' && Boolean(event.target?.closest?.('.dashboard')) && !protectedControl;
    if (blocksPageSwipe(event.target) && !forceTimeToolSwipe && !forceDashboardSwipe) return;
    if (event.type === 'mousedown' && pageSwipeRef.current?.source === 'pointer') return;
    const point = pageSwipePoint(event);
    if (!point) return;
    pageSwipeRef.current = {
      id: point.id,
      source: event.type?.startsWith?.('pointer') ? 'pointer' : 'mouse',
      x: point.x,
      y: point.y
    };
  }

  function handlePagePointerUp(event) {
    const start = pageSwipeRef.current;
    const point = pageSwipePoint(event);
    if (!start || !point) return;
    if (start.id !== point.id) {
      const compatibleMouseFinish = event.type === 'mouseup' && start.source === 'pointer';
      if (event.type === 'pointerup' && start.source === 'mouse') return;
      if (!compatibleMouseFinish) {
        pageSwipeRef.current = null;
        return;
      }
    }
    pageSwipeRef.current = null;
    const deltaX = point.x - start.x;
    const deltaY = point.y - start.y;
    if (
      start.y < 130 &&
      deltaY > SWIPE_DISTANCE &&
      Math.abs(deltaY) > Math.abs(deltaX) * 1.25
    ) {
      setQuickControlsOpen(true);
      return;
    }
    if (Math.abs(deltaX) < SWIPE_DISTANCE) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_VERTICAL_TOLERANCE) return;
    const nowMs = Date.now();
    if (nowMs - lastPageSwipeRef.current < 220) return;
    lastPageSwipeRef.current = nowMs;
    movePageBySwipe(deltaX);
  }

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    const down = (event) => handlePagePointerDown(event);
    const up = (event) => handlePagePointerUp(event);
    const cancel = () => { pageSwipeRef.current = null; };
    const touchOptions = { capture: true, passive: true };

    shell.addEventListener('pointerdown', down, true);
    shell.addEventListener('mousedown', down, true);
    shell.addEventListener('touchstart', down, touchOptions);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('mouseup', up, true);
    window.addEventListener('touchend', up, touchOptions);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('touchcancel', cancel, true);

    return () => {
      shell.removeEventListener('pointerdown', down, true);
      shell.removeEventListener('mousedown', down, true);
      shell.removeEventListener('touchstart', down, touchOptions);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('mouseup', up, true);
      window.removeEventListener('touchend', up, touchOptions);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('touchcancel', cancel, true);
    };
  }, [page, quickControlsOpen, brainDumpOpen, focusLock]);

  const runAssistantCommand = useCallback(async (rawCommand) => {
    const command = String(rawCommand || '').trim();
    if (!command) return '';
    setLastCommand(command);
    setLastError('');
    const lower = command.toLowerCase();
    const name = pickUserName(assistantSettings);
    const selectedHistoryModel = chooseAssistantModel(assistantSettings, command);
    commandHistory.addHistory({
      heard: command,
      detectedCommand: lower,
      modelUsed: selectedHistoryModel.model,
      success: true
    });

    async function devicePost(path, body, success) {
      try {
        const response = await fetch(`${DEVICE_API_BASE}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await response.json();
        const reply = data.ok === false ? (data.error || 'Device control failed.') : success;
        if (data.ok === false) pushToast('Device control', reply, 'amber');
        speakClient(reply, assistantSettings);
        return reply;
      } catch {
        const reply = 'The local backend on port 8787 is not running.';
        setLastError(reply);
        pushToast('Backend offline', reply, 'amber');
        speakClient(reply, assistantSettings);
        return reply;
      }
    }

    async function askLocalAI() {
      try {
        const selectedModel = chooseAssistantModel(assistantSettings, command);
        const browserLocation = await readBrowserLocation();
        const prompt = buildAssistantLivePrompt(command, { assistantSettings, locationSettings, weather, now, timeFormat, browserLocation });
        const response = await fetch(`${DEVICE_API_BASE}/api/ai/${selectedModel.tier === '4.5' ? 'hard' : 'easy'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: selectedModel.model
          })
        });
        const data = await response.json();
        const backendReply = data.reply || data.response || data.message || data.error || `I heard "${command}".`;
        const modelLabel = `${assistantSettings.assistantName} ${selectedModel.label}`;
        pushToast(modelLabel, backendReply, data.ok === false || data.error ? 'amber' : 'blue');
        speakClient(backendReply, assistantSettings);
        return backendReply;
      } catch {
        const fallback = `I heard "${command}", but the local AI backend on port 8787 is not running.`;
        setLastError(fallback);
        pushToast('Local AI offline', fallback, 'amber');
        speakClient(fallback, assistantSettings);
        return fallback;
      }
    }

    let reply = `Done ${name}.`;
    const percentMatch = lower.match(/(\d{1,3})\s*(percent|%)/);
    const percent = percentMatch ? clampNumber(percentMatch[1], 0, 100) : null;
    const asksTime = isAssistantTimeQuestion(command);
    const asksWeather = isAssistantWeatherQuestion(command);

    if (asksTime) {
      const detectedTarget = findAssistantTimeZone(command);
      if (!detectedTarget && /\b(in|for|at)\b/.test(lower)) return askLocalAI();
      const target = detectedTarget || { city: locationSettings.clockCity || 'your kiosk clock', timezone: locationSettings.clockTimezone };
      reply = `Hi ${name}, the time in ${target.city} is ${formatTimeZone(now, target.timezone, timeFormat, { seconds: true })}.`;
    } else if (asksWeather && !lower.includes('show weather')) {
      reply = `Hi ${name}, ${formatAssistantWeather(weather, locationSettings, now)}.`;
    } else if (lower.includes('open settings') || lower.includes('show settings')) {
      setPage('settings');
      reply = `Hi ${name}, opening settings.`;
    } else if (lower.includes('open dashboard') || lower.includes('show dashboard')) {
      setPage('dashboard');
      reply = `Hi ${name}, opening dashboard.`;
    } else if (lower.includes('open signal') || lower.includes('show signal') || lower.includes('open radio') || lower.includes('aircraft tracker')) {
      setPage('signal');
      reply = `Hi ${name}, opening Signal Center.`;
    } else if (lower.includes('open radar') || lower === 'radar' || lower.includes('camera radar') || lower.includes('motion radar')) {
      window.history.pushState(null, '', '/radar');
      setPage('radar');
      reply = `Hi ${name}, opening Radar.`;
    } else if (lower.includes('remote camera') || lower.includes('open camera')) {
      window.history.pushState(null, '', '/localhost-camera');
      setPage('localCamera');
      reply = `Hi ${name}, opening Localhost Camera View Live.`;
    } else if (lower.includes('open clock') || lower.includes('show clock')) {
      setPage('clock');
      reply = `Hi ${name}, opening the live clock.`;
    } else if (lower.includes('red mode') || lower.includes('red night')) {
      setManualMode('night');
      reply = `Done ${name}, switching to red night mode.`;
    } else if (lower.includes('dark mode') || lower.includes('middle mode')) {
      setManualMode('slate');
      reply = `Done ${name}, switching to dark mode.`;
    } else if (lower.includes('light mode') || lower.includes('white mode')) {
      setManualMode('white');
      reply = `Done ${name}, switching to light mode.`;
    } else if (lower.includes('auto theme') || lower === 'auto') {
      setAutoColor(true);
      reply = `Done ${name}, auto theme is back on.`;
    } else if (lower.includes('study mode')) {
      setRoomMode('focus');
      setSleepMode(false);
      setPage('dashboard');
      reply = `Okay ${name}, study mode is ready.`;
    } else if (lower.includes('sleep mode')) {
      setRoomMode('sleep');
      setSleepMode(true);
      setManualMode('night');
      setPage('clock');
      reply = `Okay ${name}, sleep mode is ready.`;
    } else if (lower.includes('show weather')) {
      setPage('dashboard');
      reply = `Done ${name}, weather is on the dashboard.`;
    } else if (lower.includes('show prayer')) {
      setPage('dashboard');
      reply = `Done ${name}, prayer times are on the dashboard.`;
    } else if (lower.includes('open alarm') || lower.includes('show alarm')) {
      setPage('timeTools');
      setActiveTimeDeckSection('alarm');
      reply = `Done ${name}, opening alarms.`;
    } else if (lower.includes('open countdown') || lower.includes('show countdown')) {
      setPage('timeTools');
      setActiveTimeDeckSection('countdown');
      reply = `Done ${name}, opening countdown.`;
    } else if (lower.includes('open stopwatch') || lower.includes('show stopwatch')) {
      setPage('timeTools');
      setActiveTimeDeckSection('stopwatch');
      reply = `Done ${name}, opening stopwatch.`;
    } else if (lower.includes('open world clock') || lower.includes('show world clock')) {
      setPage('timeTools');
      setActiveTimeDeckSection('world');
      reply = `Done ${name}, opening world clock.`;
    } else if (lower.includes('open prayer focus') || lower.includes('show prayer focus') || lower.includes('open prayer time focus')) {
      setPage('timeTools');
      setActiveTimeDeckSection('prayer');
      reply = `Done ${name}, opening prayer focus.`;
    } else if (lower.includes('set alarm')) {
      const nextAlarm = parseSpokenTime(command);
      if (nextAlarm) {
        setAlarm(nextAlarm);
        timeAlarms.addAlarm(nextAlarm, 'daily', 'Soft chime');
        setPage('timeTools');
        setActiveTimeDeckSection('alarm');
        reply = `Done ${name}, alarm set for ${formatAlarmLabel(nextAlarm, timeFormat)}.`;
      } else {
        reply = `I heard set alarm, but I need a clear time.`;
      }
    } else if (lower.includes('delete my alarm') || lower.includes('delete alarm')) {
      timeAlarms.deleteAllAlarms();
      setPage('timeTools');
      setActiveTimeDeckSection('alarm');
      reply = `Done ${name}, alarms deleted.`;
    } else if (lower.includes('turn off alarm')) {
      timeAlarms.alarms.filter((item) => item.enabled).forEach((item) => timeAlarms.toggleAlarm(item.id));
      setPage('timeTools');
      setActiveTimeDeckSection('alarm');
      reply = `Done ${name}, active alarms are off.`;
    } else if (lower.includes('stop alarm') || lower.includes('silence alarm') || /يا\s+نكسورا\s+وقف\s+المنبه/.test(command)) {
      stopKioskAlertSound();
      reply = `Done ${name}, alarm sound stopped.`;
    } else if (lower.match(/\bstart\s+(\d{1,3})\s*(minute|minutes|min)\s*(timer|countdown)?\b/)) {
      const minutes = clampNumber(lower.match(/\bstart\s+(\d{1,3})\s*(minute|minutes|min)\s*(timer|countdown)?\b/)?.[1], 1, 180);
      if (lower.includes('countdown')) {
        timeDesk.startCountdown(minutes);
        reply = `Done ${name}, countdown started for ${minutes} minutes.`;
        setActiveTimeDeckSection('countdown');
      } else {
        timeDesk.startTimer(minutes);
        reply = `Done ${name}, timer started for ${minutes} minutes.`;
        setActiveTimeDeckSection('countdown');
      }
      setPage('timeTools');
    } else if (lower.includes('pause countdown')) {
      timeDesk.pauseCountdown();
      setPage('timeTools');
      setActiveTimeDeckSection('countdown');
      reply = `Done ${name}, countdown paused.`;
    } else if (lower.includes('reset countdown')) {
      timeDesk.resetCountdown();
      setPage('timeTools');
      setActiveTimeDeckSection('countdown');
      reply = `Done ${name}, countdown reset.`;
    } else if (lower.includes('start stopwatch')) {
      timeDesk.startStopwatch();
      setPage('timeTools');
      setActiveTimeDeckSection('stopwatch');
      reply = `Done ${name}, stopwatch started.`;
    } else if (lower.includes('stop stopwatch') || lower.includes('pause stopwatch')) {
      timeDesk.pauseStopwatch();
      setPage('timeTools');
      setActiveTimeDeckSection('stopwatch');
      reply = `Done ${name}, stopwatch paused.`;
    } else if (lower.includes('reset stopwatch')) {
      timeDesk.resetStopwatch();
      setPage('timeTools');
      setActiveTimeDeckSection('stopwatch');
      reply = `Done ${name}, stopwatch reset.`;
    } else if (lower === 'lap' || lower.includes(' stopwatch lap')) {
      timeDesk.addLap();
      setPage('timeTools');
      setActiveTimeDeckSection('stopwatch');
      reply = `Lap saved ${name}.`;
    } else if (lower.includes('mute music') || lower.includes('mute volume')) {
      return devicePost('/api/device/volume/mute', { muted: true }, `Done ${name}, audio is muted.`);
    } else if (lower.includes('set volume') && percent != null) {
      return devicePost('/api/device/volume', { percent }, `Done ${name}, volume set to ${percent} percent.`);
    } else if ((lower.includes('brightness') || lower.includes('screen')) && percent != null) {
      return devicePost('/api/device/brightness', { percent: Math.max(1, percent) }, `Done ${name}, brightness set to ${percent} percent.`);
    } else if (lower.includes('make screen brighter') || lower.includes('brighter')) {
      return devicePost('/api/device/brightness', { percent: 85 }, `Done ${name}, screen is brighter.`);
    } else if (lower.includes('dim the screen') || lower.includes('dim screen')) {
      return devicePost('/api/device/brightness', { percent: 15 }, `Done ${name}, screen is dim.`);
    } else if (lower.includes('turn on night light')) {
      return devicePost('/api/device/night-light', { enabled: true }, `Night Light is now on.`);
    } else if (lower.includes('turn off night light')) {
      return devicePost('/api/device/night-light', { enabled: false }, `Night Light is now off.`);
    } else if (lower.includes('turn off bluetooth')) {
      return devicePost('/api/device/bluetooth/toggle', { enabled: false }, `Bluetooth is now off.`);
    } else if (lower.includes('turn on bluetooth')) {
      return devicePost('/api/device/bluetooth/toggle', { enabled: true }, `Bluetooth is now on.`);
    } else if (lower.includes('airplane')) {
      return devicePost('/api/device/airplane', { enabled: !lower.includes('off') }, `Airplane mode updated.`);
    } else if (lower.includes('tailscale')) {
      return devicePost('/api/device/tailscale', { enabled: !lower.includes('off') }, `Tailscale VPN updated.`);
    } else if (lower.includes('scan wifi') || lower.includes('scan wi-fi')) {
      setPage('dashboard');
      reply = 'Wi-Fi scan is available inside Device Controls.';
    } else if (lower.includes('scan bluetooth')) {
      setPage('dashboard');
      reply = 'Bluetooth scan is available inside Device Controls.';
    } else {
      return askLocalAI();
    }

    pushToast(assistantSettings.assistantName, reply, 'blue');
    speakClient(reply, assistantSettings);
    return reply;
  }, [assistantSettings, locationSettings, weather, now, timeFormat, timeDesk, timeAlarms, pushToast, setRoomMode, commandHistory]);

  const activeAssistantSettings = useMemo(() => (
    cameraFocusMode
      ? {
        ...assistantSettings,
        voiceAssistant: false,
        alwaysListen: false,
        alwaysShowOrb: false,
        showOrbTranscript: false
      }
      : assistantSettings
  ), [assistantSettings, cameraFocusMode]);
  const voiceAssistant = useVoiceAssistant(activeAssistantSettings, runAssistantCommand, pushToast);

  function deleteCustomWidget(id) {
    const widget = customWidgets.find((item) => item.id === id);
    if (!widget) return;
    if (widget.locked) {
      const code = window.prompt('Widget is locked. Enter code 2012 to unlock and delete.');
      if (code !== '2012') return;
    }
    setCustomWidgets(customWidgets.filter((item) => item.id !== id));
    setDeletedWidgets([{ ...widget, deletedAt: Date.now() }, ...deletedWidgets]);
  }

  function toggleWidgetLock(id) {
    const widget = customWidgets.find((item) => item.id === id);
    if (!widget) return;
    if (widget.locked) {
      const code = window.prompt('Enter code 2012 to unlock this widget.');
      if (code !== '2012') return;
    }
    setCustomWidgets(customWidgets.map((item) => item.id === id ? { ...item, locked: !item.locked } : item));
  }

  function restoreDeletedWidget(id) {
    const widget = deletedWidgets.find((item) => item.id === id);
    if (!widget) return;
    const restored = normalizeWidget(widget);
    setCustomWidgets([restored, ...customWidgets.filter((item) => item.id !== restored.id)]);
    setDeletedWidgets(deletedWidgets.filter((item) => item.id !== id));
  }

  function restoreAllDeletedWidgets() {
    if (!deletedWidgets.length) return;
    const existingIds = new Set(customWidgets.map((widget) => widget.id));
    const restored = deletedWidgets
      .map((widget) => normalizeWidget(widget))
      .filter((widget) => !existingIds.has(widget.id));
    setCustomWidgets([...restored, ...customWidgets]);
    setDeletedWidgets([]);
  }

  function resetCustomWidgets() {
    const nowDeleted = Date.now();
    const recoveryWidgets = customWidgets.map((widget) => ({ ...widget, deletedAt: nowDeleted }));
    setCustomWidgets(defaultCustomWidgets());
    setDeletedWidgets([...recoveryWidgets, ...deletedWidgets]);
  }

  useEffect(() => {
    localStorage.setItem('nexora.cameraWake', String(cameraWakeEnabled));
  }, [cameraWakeEnabled]);

  useEffect(() => {
    function onKey(event) {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowRight') {
        if (page === 'timeTools') setPage('clock');
        else if (page === 'clock') setPage('dashboard');
        else if (page === 'dashboard') setPage('signal');
        else if (page === 'radar') setPage('dashboard');
      }
      if (event.key === 'ArrowLeft') {
        if (page === 'signal') setPage('dashboard');
        else if (page === 'radar') setPage('dashboard');
        else if (page === 'dashboard') setPage('clock');
        else if (page === 'clock') {
          setActiveTimeDeckSection('alarm');
          setPage('timeTools');
        }
      }
      if (page === 'timeTools' && timeDeckSettings.keyboardNavigation && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        const currentIndex = sectionIndexById(activeTimeDeckSection);
        const nextIndex = Math.max(0, Math.min(TIME_DECK_SECTIONS.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)));
        const nextSection = TIME_DECK_SECTIONS[nextIndex].id;
        setActiveTimeDeckSection(nextSection);
        window.__nexoraTimeDeckGo?.(nextSection);
      }
      if (event.key.toLowerCase() === 's') setPage('settings');
      if (event.key.toLowerCase() === 'q') setQuickControlsOpen((value) => !value);
      if (event.key.toLowerCase() === 'n') setBrainDumpOpen(true);
      if (event.key === 'Escape') setBlackout(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, activeTimeDeckSection, timeDeckSettings.keyboardNavigation]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), performanceMode === 'full' ? 3200 : 2200);
    return () => clearTimeout(timer);
  }, [performanceMode]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    let frame = 0;
    function moveDepth(event) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        shell.style.setProperty('--parallax-x', `${((event.clientX / window.innerWidth) - 0.5).toFixed(3)}`);
        shell.style.setProperty('--parallax-y', `${((event.clientY / window.innerHeight) - 0.5).toFixed(3)}`);
      });
    }
    window.addEventListener('pointermove', moveDepth, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', moveDepth);
    };
  }, []);

  return (
    <div
      ref={shellRef}
      className={`app-shell look-${lookStyle} perf-${performanceMode} lang-${languageSettings.language} phase-${ambientPhase.id} weather-${weatherMood.id} room-${roomMode} ${cameraFocusMode ? 'camera-focus-mode' : ''} ${blackout ? 'blackout-on' : ''} ${effectiveSleepMode ? 'sleep-mode' : ''} ${focusLock ? 'focus-lock-on' : ''} ${idle ? 'ambient-idle' : ''} ${quickControlsOpen ? 'quick-open' : ''}`}
      dir={languageSettings.language === 'ar' ? 'rtl' : 'ltr'}
      lang={languageSettings.language === 'ar' ? 'ar' : 'en'}
    >
      <audio ref={musicPlayer.audioRef} onEnded={musicPlayer.nextTrack} preload="metadata" />
      <div className="depth-layer depth-background" aria-hidden="true" />
      <div className="depth-layer depth-particles" aria-hidden="true" />
      <div className="depth-layer depth-glow" aria-hidden="true" />
      <ToastStack toasts={toasts} />
      {!cameraFocusMode && !blackout && <ListeningOrb settings={activeAssistantSettings} voice={voiceAssistant} />}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeExperience mode={mode} mood={startupMood} now={now} timeFormat={timeFormat} assistantSettings={assistantSettings} locationSettings={locationSettings} videoIntroLibrary={videoIntroLibrary} performanceMode={performanceMode} onDismiss={() => setShowWelcome(false)} />
        )}
      </AnimatePresence>
      <QuickControls
        open={quickControlsOpen}
        onClose={() => setQuickControlsOpen(false)}
        ambientPhase={ambientPhase}
        weatherMood={weatherMood}
        sleepMode={effectiveSleepMode}
        setSleepMode={setSleepMode}
        musicPlayer={musicPlayer}
        noiseEnabled={noiseEnabled}
        setNoiseEnabled={setNoiseEnabled}
        focus={focus}
        roomMode={roomMode}
        setRoomMode={setRoomMode}
        focusLock={focusLock}
        setFocusLock={setFocusLock}
        setManualMode={setManualMode}
        pushToast={pushToast}
        openBrainDump={() => setBrainDumpOpen(true)}
      />
      <BrainDumpOverlay open={brainDumpOpen} onClose={() => setBrainDumpOpen(false)} brainDump={brainDump} />
      <FocusLockOverlay open={focusLock} focus={focus} onExit={() => setFocusLock(false)} roomMode={roomMode} weatherMood={weatherMood} />
      <AnimatePresence>
        {presenceBlackoutActive && page !== 'clock' && (
          <motion.button
            type="button"
            className="presence-blackout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDoubleClick={() => setPresenceSettings({ manualOverride: true })}
            aria-label="Presence blackout active"
          >
            <span>Presence Mode</span>
            <em>Double tap to override. Alarms still run.</em>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        <AmbientRotation idle={!cameraFocusMode && idle && !showWelcome && !quickControlsOpen && !brainDumpOpen && !focusLock} now={now} weather={weather} prayer={prayer} focus={focus} />
      </AnimatePresence>
      <AnimatePresence mode="sync" initial={false}>
        {page === 'timeTools' ? (
          <motion.div
            className="page-shell"
            key="time-tools"
            initial={{ x: -56, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: -56, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="time-tools-error"><TimeDeck now={now} mode={mode} timeFormat={timeFormat} alarm={alarm} setAlarm={setAlarm} alarms={timeAlarms.alarms} timeAlarms={timeAlarms} timeDeck={timeDesk} timeDeckSettings={timeDeckSettings} activeSection={activeTimeDeckSection} setActiveSection={setActiveTimeDeckSection} worldClocks={worldClocks} setWorldClocks={setWorldClocks} weather={weather} weatherMood={weatherMood} ambientPhase={ambientPhase} locationSettings={locationSettings} battery={battery} prayer={prayer} setManualMode={setManualMode} sleepMode={effectiveSleepMode} idle={idle} alarmSoundLibrary={alarmSoundLibrary} alarmSoundUrl={alarmSoundUrl} setAlarmSoundUrl={setAlarmSoundUrl} goClock={() => setPage('clock')} goSettings={() => setPage('settings')} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'clock' ? (
          <motion.div
            className="page-shell"
            key="clock"
            initial={{ x: 0, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 0, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="clock-error"><ChronoHub now={now} mode={mode} timeFormat={timeFormat} alarm={alarm} setManualMode={setManualMode} blackout={blackout} setBlackout={setBlackout} ambientPhase={ambientPhase} weatherMood={weatherMood} weather={weather} locationSettings={locationSettings} sleepMode={effectiveSleepMode} idle={idle} goTimeDesk={() => { setActiveTimeDeckSection('alarm'); setPage('timeTools'); }} goDashboard={() => setPage('dashboard')} goSettings={() => setPage('settings')} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'dashboard' ? (
          <motion.div
            className="page-shell"
            key="dashboard"
            initial={{ x: 56, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 56, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="dashboard-error"><Dashboard now={now} weather={weather} timeFormat={timeFormat} alarm={alarm} customWidgets={customWidgets} setCustomWidgets={setCustomWidgets} customSections={customSections} setCustomSections={setCustomSections} deletedWidgets={deletedWidgets} deleteCustomWidget={deleteCustomWidget} toggleWidgetLock={toggleWidgetLock} restoreDeletedWidget={restoreDeletedWidget} restoreAllDeletedWidgets={restoreAllDeletedWidgets} musicLibrary={musicLibrary} musicPlayer={musicPlayer} cameraWakeEnabled={cameraWakeEnabled} setCameraWakeEnabled={setCameraWakeEnabled} cameraWakeStatus={cameraWakeStatus} cameraVideoRef={cameraVideoRef} ambientPhase={ambientPhase} weatherMood={weatherMood} dashboardTheme={dashboardTheme} sleepMode={effectiveSleepMode} setSleepMode={setSleepMode} idle={idle} noiseEnabled={noiseEnabled} setNoiseEnabled={setNoiseEnabled} noise={noise} focus={focus} roomMode={roomMode} setRoomMode={setRoomMode} focusLock={focusLock} setFocusLock={setFocusLock} battery={battery} caffeine={caffeine} assistantSettings={assistantSettings} voiceAssistant={voiceAssistant} runAssistantCommand={runAssistantCommand} pushToast={pushToast} locationSettings={locationSettings} performanceMode={performanceMode} setPerformanceMode={setPerformanceMode} openBrainDump={() => setBrainDumpOpen(true)} openQuickControls={() => setQuickControlsOpen(true)} goClock={() => setPage('clock')} goSettings={() => setPage('settings')} goSignal={() => setPage('signal')} goRadar={() => { window.history.pushState(null, '', '/radar'); setPage('radar'); }} goRemoteCamera={() => { window.history.pushState(null, '', '/localhost-camera'); setPage('localCamera'); }} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'signal' ? (
          <motion.div
            className="page-shell"
            key="signal"
            initial={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="signal-error"><SignalCenterPage now={now} goDashboard={() => setPage('dashboard')} goClock={() => setPage('clock')} openQuickControls={() => setQuickControlsOpen(true)} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'radar' ? (
          <motion.div
            className="page-shell"
            key="radar"
            initial={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="radar-error">
              <RadarPage
                now={now}
                goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }}
                goRemoteCamera={() => { window.history.pushState(null, '', '/localhost-camera'); setPage('localCamera'); }}
              />
            </PageErrorBoundary>
          </motion.div>
        ) : page === 'remoteCamera' || page === 'localCamera' ? (
          <motion.div
            className="page-shell"
            key="remote-camera"
            initial={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="remote-camera-error">
              <RemoteCameraPage
                now={now}
                settings={remoteCameraSettings}
                setSettings={setRemoteCameraSettings}
                securityLog={securityLog}
                goSettings={() => { window.history.pushState(null, '', '/settings'); setPage('settings'); }}
                goClock={() => { window.history.pushState(null, '', '/'); setPage('clock'); }}
                pushToast={pushToast}
              />
            </PageErrorBoundary>
          </motion.div>
        ) : page === 'settings' ? (
          <motion.div
            className="page-shell"
            key="settings"
            initial={{ y: 42, opacity: 0, filter: 'blur(3px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: 42, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="settings-error"><ToolsPage now={now} mode={mode} manualMode={manualMode} autoColor={autoColor} setManualMode={setManualMode} dashboardTheme={dashboardTheme} setDashboardTheme={setDashboardTheme} alarm={alarm} setAlarm={setAlarm} timeFormat={timeFormat} setTimeFormat={setTimeFormat} customWidgets={customWidgets} setCustomWidgets={setCustomWidgets} customSections={customSections} setCustomSections={setCustomSections} deletedWidgets={deletedWidgets} setDeletedWidgets={setDeletedWidgets} deleteCustomWidget={deleteCustomWidget} toggleWidgetLock={toggleWidgetLock} restoreDeletedWidget={restoreDeletedWidget} restoreAllDeletedWidgets={restoreAllDeletedWidgets} resetCustomWidgets={resetCustomWidgets} goBack={() => setPage('clock')} goSoftware={() => { window.history.pushState(null, '', '/software-needed'); setPage('software'); }} goRemoteCamera={() => { window.history.pushState(null, '', '/remote-camera'); setPage('remoteCamera'); }} setAutoColor={setAutoColor} setRoomMode={setRoomMode} assistantSettings={assistantSettings} setAssistantSettings={setAssistantSettings} voiceAssistant={voiceAssistant} locationSettings={locationSettings} setLocationSettings={setLocationSettings} lookStyle={lookStyle} setLookStyle={setLookStyle} timeDeckSettings={timeDeckSettings} setTimeDeckSettings={setTimeDeckSettings} activeTimeDeckSection={activeTimeDeckSection} setActiveTimeDeckSection={setActiveTimeDeckSection} worldClocks={worldClocks} setWorldClocks={setWorldClocks} currentPage={page} weather={weather} weatherMood={weatherMood} battery={battery} lastCommand={lastCommand} lastError={lastError} pushToast={pushToast} presenceSettings={presenceSettings} setPresenceSettings={setPresenceSettings} commandHistory={commandHistory.history} clearCommandHistory={commandHistory.clearHistory} remoteCameraSettings={remoteCameraSettings} setRemoteCameraSettings={setRemoteCameraSettings} securityLog={securityLog} languageSettings={languageSettings} setLanguageSettings={setLanguageSettings} /></PageErrorBoundary>
          </motion.div>
        ) : (
          <motion.div className="page-shell" key="software" initial={{ y: 42, opacity: 0, filter: 'blur(3px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ y: 42, opacity: 0, filter: 'blur(3px)' }} transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}>
            <PageErrorBoundary key="software-error"><SoftwareNeededPage goBack={() => { window.history.pushState(null, '', '/'); setPage('settings'); }} /></PageErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const rootElement = document.getElementById('root');
const root = window.__nexoraRoot || createRoot(rootElement);
window.__nexoraRoot = root;
root.render(<App />);
