import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import SunCalc from 'suncalc';
import {
  exportKisokeSettings,
  importKisokeSettings,
  useKisokeSettings
} from './settingsStore';
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
  Gamepad2,
  Gauge,
  GripVertical,
  HardDrive,
  Laptop,
  Lock,
  Mic,
  MicOff,
  Minus,
  Moon,
  MoveHorizontal,
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
  Star,
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
  WifiOff,
  X
} from 'lucide-react';
import './styles.css';
import './theme-engine.css';
import './assistant-visuals.css';

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
const MUSIC_VOLUME_KEY = 'nexora.music.volume';
const MUSIC_PLAYLIST_KEY = 'nexora.music.playlist.v1';
const MUSIC_FAVORITES_KEY = 'nexora.music.favorites.v1';
const MUSIC_ALARM_TRACK_KEY = 'nexora.music.alarm-track.v1';
const MUSIC_LIBRARY_CACHE_KEY = 'nexora.music-library-cache.v1';
const PROJECTS_KEY = 'nexora.projects.v1';
const WEATHER_CACHE_KEY = 'nexora.weather-cache.v1';
const PRAYER_CACHE_KEY = 'nexora.prayer-cache.v2';
const NEWS_CACHE_KEY = 'nexora.news-cache.v1';
const ESP32_CACHE_KEY = 'nexora.esp32-cache.v1';
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
const BACKGROUND_SERVICES_KEY = 'nexora.background-services.v1';
const BRIGHTNESS_HISTORY_KEY = 'nexora.room-brightness-history.v1';
const BEDROOM_CONTEXT_PATTERN = /\b(room|bedroom|esp32|indoor)\b.*\b(temp(?:erature)?|humidity|sensor|reading|climate|hot|cold|humid)\b|\b(temp(?:erature)?|humidity|hot|cold|humid)\b.*\b(room|bedroom|esp32|indoor)\b/i;
const CAMERA_DEVICE_FALLBACKS = Array.from({ length: 13 }, (_, id) => ({ id, label: `Device ${id}` }));

function isTypingTarget(target) {
  const selector = 'input, textarea, select, [contenteditable="true"]';
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  return Boolean(
    target?.closest?.(selector)
    || active?.closest?.(selector)
    || active?.shadowRoot?.activeElement?.closest?.(selector)
  );
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
const ATHAN_PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const DEFAULT_ATHAN_PER_PRAYER = {
  Fajr: true,
  Dhuhr: true,
  Asr: true,
  Maghrib: true,
  Isha: true
};
const ARABIC_PRAYER_NAMES = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء'
};
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
  offlineVoice: true,
  offlineVoiceAutostart: true,
  offlineVoiceEngine: 'vosk',
  offlineVoiceModelDir: 'models/vosk-model-small-en-us-0.15',
  offlineVoiceDevice: '',
  offlineVoiceSampleRate: 16000,
  offlineVoiceWakeTimeout: 8,
  recognitionLanguage: 'en-US',
  customWakePhrase: 'Hey Nexora',
  replyLanguage: 'both',
  randomizeCallName: true,
  startupGreetingMode: 'intro',
  customStartupText: '',
  customStartupAudio: '',
  alarmStartsMusic: true,
  alarmBrightnessRamp: true,
  athanEnabled: true,
  athanVoiceEnabled: true,
  athanLanguage: 'both',
  athanPerPrayer: { ...DEFAULT_ATHAN_PER_PRAYER }
};
const AI_VISUAL_LOOKS = [
  { id: 'glass-compact', title: 'Glassy compact', detail: 'Small polished dock' },
  { id: 'galaxy', title: 'Galaxy AI', detail: 'Compact energy core' },
  { id: 'siri-pill', title: 'Siri Pill', detail: 'Floating voice wave' },
  { id: 'siri-top', title: 'Siri Top', detail: 'Top glass response' },
  { id: 'google', title: 'Google Prompt', detail: 'Gradient command bar' },
  { id: 'aurora-bar', title: 'Aurora bar', detail: 'Soft moving glass' },
  { id: 'minimal-orb', title: 'Minimal orb', detail: 'Tiny status bubble' }
];
const AI_ANIMATION_STYLES = [
  { id: 'ripple', label: 'Ripple' },
  { id: 'wave', label: 'Voice wave' },
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'calm', label: 'Calm pulse' }
];
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
const DEFAULT_PRAYER_SETTINGS = {
  locationMode: 'manual',
  locationName: 'Ajman, UAE',
  country: 'UAE',
  latitude: 25.4052,
  longitude: 55.5136,
  timezone: 'Asia/Dubai',
  calculationMethod: '16',
  asrMethod: '0',
  offsets: { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 }
};
const PRAYER_CALCULATION_METHODS = [
  { id: '16', label: 'Dubai / UAE' },
  { id: '8', label: 'Gulf Region' },
  { id: '4', label: 'Umm Al-Qura, Makkah' },
  { id: '3', label: 'Muslim World League' },
  { id: '2', label: 'Islamic Society of North America' },
  { id: '5', label: 'Egyptian General Authority' }
];
const ASR_METHODS = [
  { id: '0', label: 'Standard (Shafi, Maliki, Hanbali)' },
  { id: '1', label: 'Hanafi' }
];
const DEFAULT_BACKGROUND_SERVICES = {
  news: false,
  system: false,
  weatherExtras: false,
  cameraSensors: false,
  musicScan: true,
  videoIntroScan: false,
  battery: true,
  backendHealth: true
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
  { id: 'natural', label: 'Natural', description: 'Calm forest light' },
  { id: 'glossy', label: 'Glossy / Glassy', description: 'Deep translucent glass' },
  { id: 'hacker', label: 'Hacker', description: 'Focused command grid' },
  { id: 'normal', label: 'Normal', description: 'Quiet neutral workspace' },
  { id: 'aurora', label: 'Aurora', description: 'Slow northern light color' },
  { id: 'ethereal', label: 'Ethereal', description: 'Soft mist and light' },
  { id: 'pixel', label: 'Pixel Art', description: 'Crisp retro console' },
  { id: 'sketch', label: 'Conceptual Sketch', description: 'Ink and paper contrast' },
  { id: 'luxury', label: 'Luxury Typography', description: 'Editorial gold contrast' },
  { id: 'japandi', label: 'Japandi', description: 'Warm minimal calm' },
  { id: 'memphis', label: 'Memphis', description: 'Playful geometric color' },
  { id: 'bohemian', label: 'Bohemian', description: 'Rich woven warmth' },
  { id: 'ios27', label: 'iOS 27', description: 'Fluid color glass' }
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
  { id: 'link', label: 'Link' },
  { id: 'embed', label: 'Embed' }
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
const GAME_LIBRARY = [
  { id: 'tic-tac-toe', title: 'XO Tic-Tac-Toe', type: 'Board', detail: 'Classic 3x3 XO with AI or local two-player.' },
  { id: 'connect-four', title: 'Connect Four', type: 'Board', detail: 'Drop discs, connect 4, play AI or a friend.' },
  { id: 'gomoku', title: 'Gomoku', type: 'Board', detail: 'Five-in-a-row strategy on a larger board.' },
  { id: 'mega-xo', title: 'Mega XO', type: 'Board', detail: '4x4 XO with connect 4 pressure.' },
  { id: 'mini-connect', title: 'Mini Connect', type: 'Board', detail: 'Small fast connect-3 board.' },
  { id: 'pyramid-drops', title: 'Pyramid Drops', type: 'Board', detail: 'Gravity line game with compact columns.' },
  { id: 'pong', title: 'Ping Pong', type: 'Arcade', detail: 'Classic paddle duel, AI or two-player.' },
  { id: 'table-tennis', title: 'Table Tennis', type: 'Arcade', detail: 'Fast clean pong variant.' },
  { id: 'air-hockey', title: 'Air Hockey', type: 'Arcade', detail: 'Paddle duel with slick neon motion.' },
  { id: 'brick-pong', title: 'Brick Pong', type: 'Arcade', detail: 'Pong feel with heavier rebounds.' },
  { id: 'wall-ball', title: 'Wall Ball', type: 'Arcade', detail: 'Compact paddle reflex game.' },
  { id: 'snake', title: 'Snake', type: 'Grid', detail: 'Food race with AI snake or local friend.' },
  { id: 'worm-race', title: 'Worm Race', type: 'Grid', detail: 'Two snakes race for food.' },
  { id: 'light-cycles', title: 'Light Cycles', type: 'Grid', detail: 'Tron-style trail survival.' },
  { id: 'food-dash', title: 'Food Dash', type: 'Grid', detail: 'Short snake sprint rounds.' },
  { id: 'grid-racer', title: 'Grid Racer', type: 'Grid', detail: 'Fast grid chase with a rival.' },
  { id: 'memory-match', title: 'Memory Match', type: 'Puzzle', detail: 'Card pairs with score turns.' },
  { id: 'emoji-pairs', title: 'Emoji Pairs', type: 'Puzzle', detail: 'Emoji memory with AI turn support.' },
  { id: 'color-pairs', title: 'Color Pairs', type: 'Puzzle', detail: 'Color matching memory board.' },
  { id: 'number-pairs', title: 'Number Pairs', type: 'Puzzle', detail: 'Number pair memory challenge.' },
  { id: 'space-pairs', title: 'Space Pairs', type: 'Puzzle', detail: 'Space icon memory game.' },
  { id: 'space-dodge', title: 'Space Dodge', type: 'Action', detail: 'Dodge falling hazards and outscore AI.' },
  { id: 'coin-collector', title: 'Coin Collector', type: 'Action', detail: 'Catch coins, avoid danger.' },
  { id: 'falling-blocks', title: 'Falling Blocks', type: 'Action', detail: 'Survive falling blocks.' },
  { id: 'lane-runner', title: 'Lane Runner', type: 'Action', detail: 'Move lanes, avoid traffic.' },
  { id: 'comet-dodge', title: 'Comet Dodge', type: 'Action', detail: 'Space survival with quick movement.' },
  { id: 'reaction-duel', title: 'Reaction Duel', type: 'Reflex', detail: 'Tap target faster than AI or friend.' },
  { id: 'target-tap', title: 'Target Tap', type: 'Reflex', detail: 'Score quick target hits.' },
  { id: 'whack-dot', title: 'Whack Dot', type: 'Reflex', detail: 'Whack the moving dot.' },
  { id: 'speed-clicker', title: 'Speed Clicker', type: 'Reflex', detail: 'Ten-second tap score battle.' }
];
const DEFAULT_PROJECTS = {
  activeTabId: 'arduino',
  tabs: [
    {
      id: 'arduino',
      title: 'Arduino',
      sections: [
        {
          id: 'esp32-code',
          title: 'ESP32 code',
          items: [
            { id: 'esp32-hub-link', title: 'ESP32 Sensor Hub', type: 'link', value: 'http://192.168.4.51/', note: 'Bedroom sensor hub on SALIM1-5G' }
          ]
        },
        { id: 'arduino-files', title: 'Arduino project files', items: [] }
      ]
    },
    {
      id: 'projects',
      title: 'Projects',
      sections: [
        { id: 'project-esp32', title: 'Project 1: ESP32 project', items: [] },
        { id: 'project-arduino', title: 'Project 2: Arduino project', items: [] }
      ]
    }
  ]
};

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
    if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
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

function parseZonedDateTime(value, timezone) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, year, month, day, hour, minute] = match;
  const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0);
  const guessDate = new Date(utcGuess);
  const actual = zoneDateParts(guessDate, timezone);
  const observedLocalUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0);
  return new Date(utcGuess - (observedLocalUtc - utcGuess));
}

function useWeather(location = DEFAULT_LOCATION_SETTINGS, enabled = true) {
  const safeLocation = sanitizeLocationSettings(location);
  const defaultWeather = {
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
    cached: false,
    error: '',
    locationName: safeLocation.weatherName,
    lastUpdated: null
  };
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [weather, setWeather] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY));
      if (cached?.lastUpdated) {
        const hourly = Array.isArray(cached.hourly)
          ? cached.hourly
              .map((hour) => ({ ...hour, time: new Date(hour.time) }))
              .filter((hour) => hour.time instanceof Date && !Number.isNaN(hour.time.getTime()))
          : [];
        return { ...defaultWeather, ...cached, hourly, loaded: true, cached: true, locationName: safeLocation.weatherName };
      }
    } catch {
      // Ignore corrupt offline cache.
    }
    return defaultWeather;
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
        const data = await readJsonResponse(response, 'Weather source failed');
        if (ignore) return;
        const now = new Date();
        const hourly = data.hourly.time
          .map((time, index) => ({
            time: parseZonedDateTime(time, safeLocation.weatherTimezone),
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
          .filter((hour) => hour.time instanceof Date && !Number.isNaN(hour.time.getTime()) && hour.time >= new Date(now.getTime() - 30 * 60 * 1000))
          .slice(0, 24);
        const sunrise = parseZonedDateTime(data.daily.sunrise[0], safeLocation.weatherTimezone);
        const sunset = parseZonedDateTime(data.daily.sunset[0], safeLocation.weatherTimezone);
        const nextWeather = {
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
          sunrise: sunrise ? sunrise.toISOString() : null,
          sunset: sunset ? sunset.toISOString() : null,
          hourly,
          code: data.current.weather_code,
          loaded: true,
          cached: false,
          error: '',
          locationName: safeLocation.weatherName,
          lastUpdated: Date.now()
        };
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(nextWeather));
        setWeather(nextWeather);
      } catch (error) {
        if (!ignore) {
          setWeather((current) => ({
            ...current,
            loaded: current.hourly?.length > 0 || Boolean(current.lastUpdated),
            cached: Boolean(current.lastUpdated),
            error: error.message || 'Weather source offline',
            locationName: safeLocation.weatherName
          }));
        }
      }
    }
    load();
    const timer = setInterval(load, 15 * 60 * 1000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [enabled, safeLocation.weatherLat, safeLocation.weatherLon, safeLocation.weatherTimezone, safeLocation.weatherName, refreshNonce]);

  return { ...weather, refresh: () => setRefreshNonce((value) => value + 1) };
}

function usePrayerTimes(now, settings = DEFAULT_PRAYER_SETTINGS, enabled = true) {
  const prayerSettings = normalizePrayerSettings(settings);
  const dateParts = zoneDateParts(now, prayerSettings.timezone);
  const dayKey = `${dateParts.year}-${pad(dateParts.month)}-${pad(dateParts.day)}`;
  // Offsets are part of the calculation. Include them so an offline cache can never
  // override a newly chosen manual adjustment with yesterday's saved value.
  const offsetsKey = JSON.stringify(prayerSettings.offsets);
  const cacheKey = `${dayKey}:${prayerSettings.latitude.toFixed(4)}:${prayerSettings.longitude.toFixed(4)}:${prayerSettings.calculationMethod}:${prayerSettings.asrMethod}:${prayerSettings.timezone}:${offsetsKey}`;
  const prayerDate = useMemo(() => new Date(now.getTime()), [dayKey]);
  const fallback = useMemo(() => getPrayerTimes(prayerDate, prayerSettings), [dayKey, prayerDate, prayerSettings.latitude, prayerSettings.longitude, prayerSettings.asrMethod, offsetsKey]);
  const [state, setState] = useState(() => ({
    times: fallback,
    loaded: false,
    cached: false,
    source: 'Local solar fallback',
    locationName: prayerSettings.locationName,
    methodName: PRAYER_CALCULATION_METHODS.find((method) => method.id === prayerSettings.calculationMethod)?.label || 'Gulf Region',
    lastUpdated: null,
    error: ''
  }));

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [apiYear, apiMonth, apiDay] = dayKey.split('-');
      const apiDate = `${apiDay}-${apiMonth}-${apiYear}`;
      const url = new URL(`https://api.aladhan.com/v1/timings/${apiDate}`);
      url.searchParams.set('latitude', String(prayerSettings.latitude));
      url.searchParams.set('longitude', String(prayerSettings.longitude));
      url.searchParams.set('method', prayerSettings.calculationMethod);
      url.searchParams.set('school', prayerSettings.asrMethod);
      const response = await fetch(url, { cache: 'no-store' });
      const payload = await readJsonResponse(response, 'Prayer source failed');
      const timings = payload?.data?.timings;
      if (!timings) throw new Error('Prayer source returned no timings.');
      const entries = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
        .map((name) => ({
          name,
          time: parsePrayerTime(prayerDate, timings[name], prayerSettings.timezone, prayerSettings.offsets[name] || 0)
        }))
        .filter((entry) => entry.time instanceof Date && !Number.isNaN(entry.time.getTime()));
      if (entries.length < 5) throw new Error('Prayer source returned incomplete timings.');
      const next = {
        key: cacheKey,
        times: entries.map((entry) => ({ ...entry, timestamp: entry.time.getTime() })),
        source: 'AlAdhan',
        locationName: prayerSettings.locationName,
        methodName: payload?.data?.meta?.method?.name || PRAYER_CALCULATION_METHODS.find((method) => method.id === prayerSettings.calculationMethod)?.label || 'Selected method',
        lastUpdated: Date.now()
      };
      localStorage.setItem(PRAYER_CACHE_KEY, JSON.stringify(next));
      setState({ ...next, times: entries, loaded: true, cached: false, error: '' });
    } catch (error) {
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(PRAYER_CACHE_KEY) || 'null'); } catch { cached = null; }
      if (cached?.key === cacheKey && Array.isArray(cached.times)) {
        const times = cached.times.map((entry) => ({ ...entry, time: new Date(entry.timestamp || entry.time) }));
        setState({ ...cached, times, loaded: true, cached: true, error: error.message || 'Prayer source offline' });
      } else {
        setState({
          times: fallback,
          loaded: false,
          cached: false,
          source: 'Local solar fallback',
          locationName: prayerSettings.locationName,
          methodName: PRAYER_CALCULATION_METHODS.find((method) => method.id === prayerSettings.calculationMethod)?.label || 'Selected method',
          lastUpdated: null,
          error: error.message || 'Prayer source offline'
        });
      }
    }
  }, [enabled, cacheKey, dayKey, prayerDate, prayerSettings.latitude, prayerSettings.longitude, prayerSettings.calculationMethod, prayerSettings.asrMethod, prayerSettings.timezone, prayerSettings.locationName, offsetsKey, fallback]);

  useEffect(() => {
    refresh();
    if (!enabled) return undefined;
    const timer = window.setInterval(refresh, 6 * 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh, enabled]);

  return { ...state, refresh, settings: prayerSettings };
}

function useAirQuality(location = DEFAULT_LOCATION_SETTINGS, enabled = true) {
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
    if (!enabled) return undefined;
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
  }, [enabled, safeLocation.weatherLat, safeLocation.weatherLon, safeLocation.weatherTimezone]);

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

function useNewsFeed(enabled = true) {
  const [news, setNews] = useState(() => {
    const fallback = {
      items: [],
      history: [],
      loaded: false,
      cached: false,
      error: '',
      fetchedAt: null,
      source: 'https://gulfnews.com/'
    };
    try {
      const cached = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY));
      if (cached?.items?.length) {
        return { ...fallback, ...cached, loaded: true, cached: true };
      }
    } catch {
      // Ignore corrupt offline cache.
    }
    return fallback;
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
      localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({
        items: data.items,
        history: Array.isArray(data.history) ? data.history : [],
        fetchedAt: data.fetchedAt,
        source: data.source || 'https://gulfnews.com/'
      }));
    } catch (error) {
      setNews((current) => ({
        ...current,
        loaded: current.items.length > 0,
        cached: current.items.length > 0,
        error: error.message
      }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(refresh, 60 * 1000);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

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

function useSystemInfo(enabled = true) {
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
    if (!enabled) return undefined;
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
  }, [enabled]);

  return system;
}

function useMusicLibrary(enabled = true) {
  const [library, setLibrary] = useState(() => {
    const fallback = {
      tracks: [],
      playlists: [],
      loaded: false,
      error: '',
      directory: '',
      fetchedAt: null,
      cached: false
    };
    try {
      const cached = JSON.parse(localStorage.getItem(MUSIC_LIBRARY_CACHE_KEY));
      if (cached?.tracks?.length) return { ...fallback, ...cached, loaded: true, cached: true };
    } catch {
      // Ignore corrupt music cache.
    }
    return fallback;
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
        const response = await fetch(`/api/music?refresh=${Date.now()}`);
        const data = await readJsonResponse(response, 'Music library scan failed');
        if (!ignore && response.ok) {
          const nextLibrary = {
            tracks: Array.isArray(data.tracks) ? data.tracks : [],
            playlists: Array.isArray(data.playlists) ? data.playlists : [],
            loaded: true,
            error: data.error || '',
            directory: data.directory || 'music',
            fetchedAt: data.fetchedAt,
            cached: false
          };
          setLibrary(nextLibrary);
          localStorage.setItem(MUSIC_LIBRARY_CACHE_KEY, JSON.stringify(nextLibrary));
        }
      } catch (error) {
        if (!ignore) {
          setLibrary((current) => {
            if (current.tracks.length) {
              return { ...current, loaded: true, cached: true, error: error.message };
            }
            try {
              const cached = JSON.parse(localStorage.getItem(MUSIC_LIBRARY_CACHE_KEY));
              if (cached?.tracks?.length) {
                return { ...cached, loaded: true, cached: true, error: error.message };
              }
            } catch {
              // Ignore corrupt music cache.
            }
            return { ...current, loaded: false, cached: false, error: error.message };
          });
        }
      }
    }

    load();
    const timer = setInterval(load, 15000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [enabled, refreshToken]);

  return { ...library, refresh };
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
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    let ignore = false;
    async function load() {
      try {
        const response = await fetch(`/api/alarm-sounds?refresh=${Date.now()}`);
        const data = await readJsonResponse(response, 'Alarm sound scan failed');
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
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let ignore = false;
    async function load() {
      try {
        const response = await fetch(`/api/video-intros?refresh=${Date.now()}`);
        const data = await readJsonResponse(response, 'Video intro scan failed');
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
  }, [enabled, refreshToken]);

  return { ...library, refresh };
}

function useNetworkAccess(enabled = true) {
  const [network, setNetwork] = useState({ loaded: false, urls: [], localUrl: '', primaryUrl: '', primaryCameraUrl: '', hostname: '', hint: '', error: '' });

  const load = useCallback(async () => {
    if (!enabled) {
      setNetwork((current) => ({ ...current, loaded: false, error: 'Paused by Background Services' }));
      return;
    }
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
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [enabled, load]);

  return { ...network, refresh: load };
}

function useConnectionStatus(enabled = true) {
  const [status, setStatus] = useState({
    browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    backendOnline: null,
    lastChecked: 0,
    error: ''
  });

  const check = useCallback(async () => {
    const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!enabled) {
      setStatus((current) => ({ ...current, browserOnline, lastChecked: Date.now() }));
      return;
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/kiosk/health?brief=${Date.now()}`, { cache: 'no-store' });
      const data = await readJsonResponse(response, 'Backend health failed');
      setStatus({ browserOnline, backendOnline: Boolean(data.ok), lastChecked: Date.now(), error: data.ok ? '' : (data.error || 'Backend health failed') });
    } catch (error) {
      setStatus({ browserOnline, backendOnline: false, lastChecked: Date.now(), error: error.message || 'Backend offline' });
    }
  }, [enabled]);

  useEffect(() => {
    check();
    const onOnlineChange = () => check();
    window.addEventListener('online', onOnlineChange);
    window.addEventListener('offline', onOnlineChange);
    const timer = window.setInterval(check, 15000);
    return () => {
      window.removeEventListener('online', onOnlineChange);
      window.removeEventListener('offline', onOnlineChange);
      window.clearInterval(timer);
    };
  }, [check]);

  return status;
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
  const [volume, setVolumeState] = useState(() => Number(localStorage.getItem(MUSIC_VOLUME_KEY) || 0.45));
  const [playlist, setPlaylistState] = useState(() => localStorage.getItem(MUSIC_PLAYLIST_KEY) || 'all');
  const [favoriteFiles, setFavoriteFiles] = useState(() => new Set(readJsonSetting(MUSIC_FAVORITES_KEY, [])));
  const [alarmTrackUrl, setAlarmTrackUrlState] = useState(() => localStorage.getItem(MUSIC_ALARM_TRACK_KEY) || '');
  const [visualTick, setVisualTick] = useState(0);

  const allTracks = library.tracks || [];
  const tracks = useMemo(() => {
    if (playlist === 'favorites') return allTracks.filter((track) => favoriteFiles.has(track.file));
    if (playlist.startsWith('playlist:')) {
      const selected = playlist.slice('playlist:'.length);
      return allTracks.filter((track) => (track.playlist || track.folder || 'Root') === selected);
    }
    return allTracks;
  }, [allTracks, playlist, favoriteFiles]);
  const currentTrack = tracks[trackIndex] || tracks[0] || null;
  const visualLevels = useMemo(() => (
    Array.from({ length: 18 }, (_, index) => {
      if (!playing) return 0.18 + ((index % 5) * 0.035);
      const wave = Math.sin((visualTick * 0.72) + index * 0.85);
      const pulse = Math.cos((visualTick * 0.31) + index * 0.28);
      return Math.max(0.2, Math.min(1, 0.34 + Math.abs(wave) * 0.46 + Math.max(0, pulse) * 0.18));
    })
  ), [playing, visualTick]);

  useEffect(() => {
    if (trackIndex >= tracks.length) setTrackIndex(0);
  }, [tracks.length, trackIndex]);

  useEffect(() => {
    if (playlist !== 'favorites' && playlist.startsWith('playlist:')) {
      const selected = playlist.slice('playlist:'.length);
      const exists = (library.playlists || []).some((item) => item.name === selected);
      if (!exists) setPlaylist('all');
    }
  }, [playlist, library.playlists]);

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

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setVisualTick((value) => (value + 1) % 10000), 180);
    return () => window.clearInterval(timer);
  }, [playing]);

  function setVolume(nextVolume) {
    const clean = Math.max(0, Math.min(1, Number(nextVolume)));
    setVolumeState(clean);
    localStorage.setItem(MUSIC_VOLUME_KEY, String(clean));
  }

  function setPlaylist(nextPlaylist) {
    const clean = String(nextPlaylist || 'all');
    setPlaylistState(clean);
    setTrackIndex(0);
    localStorage.setItem(MUSIC_PLAYLIST_KEY, clean);
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

  function toggleFavorite(file = currentTrack?.file) {
    if (!file) return;
    setFavoriteFiles((current) => {
      const next = new Set(current);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      localStorage.setItem(MUSIC_FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function setAlarmTrack(url) {
    const clean = String(url || '');
    setAlarmTrackUrlState(clean);
    if (clean) localStorage.setItem(MUSIC_ALARM_TRACK_KEY, clean);
    else localStorage.removeItem(MUSIC_ALARM_TRACK_KEY);
  }

  return {
    audioRef,
    tracks,
    allTracks,
    currentTrack,
    trackIndex,
    playing,
    volume,
    playlist,
    favoriteFiles,
    alarmTrackUrl,
    visualLevels,
    setVolume,
    setPlaylist,
    togglePlay,
    pause,
    nextTrack,
    shuffleTrack,
    selectTrack,
    toggleFavorite,
    setAlarmTrack
  };
}

function projectId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function withUniqueIds(items, prefix = 'item') {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.map((item, index) => {
    const base = item && typeof item === 'object' ? item : {};
    let id = base.id ?? '';
    const key = String(id);
    if (!key || seen.has(key)) {
      id = projectId(`${prefix}-${index}`);
    }
    seen.add(String(id));
    return { ...base, id };
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.readAsDataURL(file);
  });
}

async function saveProjectRecord(payload) {
  const response = await fetch('/api/projects/save-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await readJsonResponse(response, 'Project save failed');
  if (!data.ok) throw new Error(data.error || 'Project save failed.');
  return data;
}

function fireProjectFolderCreate(url, payload) {
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function normalizeProjects(value) {
  const source = value && Array.isArray(value.tabs) ? value : DEFAULT_PROJECTS;
  const tabs = source.tabs
    .map((tab, tabIndex) => ({
      id: String(tab.id || `tab-${tabIndex}`).replace(/[^a-zA-Z0-9_-]/g, '-'),
      title: String(tab.title || `Project ${tabIndex + 1}`).slice(0, 42),
      sections: Array.isArray(tab.sections) ? tab.sections.map((section, sectionIndex) => ({
        id: String(section.id || `section-${sectionIndex}`).replace(/[^a-zA-Z0-9_-]/g, '-'),
        title: String(section.title || `Section ${sectionIndex + 1}`).slice(0, 54),
        items: Array.isArray(section.items) ? section.items.map((item, itemIndex) => ({
          id: String(item.id || `item-${itemIndex}`).replace(/[^a-zA-Z0-9_-]/g, '-'),
          title: String(item.title || `Item ${itemIndex + 1}`).slice(0, 70),
          type: ['link', 'pdf', 'file', 'note', 'code'].includes(item.type) ? item.type : 'link',
          value: String(item.value || '').slice(0, 500),
          note: String(item.note || '').slice(0, 180),
          localPath: String(item.localPath || '').slice(0, 900),
          url: String(item.url || '').slice(0, 900),
          fileName: String(item.fileName || '').slice(0, 220),
          savedAt: Number(item.savedAt || 0)
        })) : []
      })) : []
    }))
    .filter((tab) => tab.title);

  const safeTabs = tabs.length ? tabs : DEFAULT_PROJECTS.tabs;
  const activeTabId = safeTabs.some((tab) => tab.id === source.activeTabId) ? source.activeTabId : safeTabs[0].id;
  return { activeTabId, tabs: safeTabs };
}

function useProjects() {
  const [projects, setProjectsState] = useState(() => normalizeProjects(readJsonSetting(PROJECTS_KEY, DEFAULT_PROJECTS)));

  const saveProjects = useCallback((updater) => {
    setProjectsState((current) => {
      const next = normalizeProjects(typeof updater === 'function' ? updater(current) : updater);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setActiveTab = useCallback((tabId) => {
    saveProjects((current) => ({ ...current, activeTabId: tabId }));
  }, [saveProjects]);

  const addTab = useCallback((title) => {
    const clean = String(title || '').trim();
    if (!clean) return;
    const id = projectId('tab');
    saveProjects((current) => ({
      activeTabId: id,
      tabs: [
        ...current.tabs,
        { id, title: clean.slice(0, 42), sections: [{ id: projectId('section'), title: 'General', items: [] }] }
      ]
    }));
  }, [saveProjects]);

  const removeTab = useCallback((tabId) => {
    saveProjects((current) => {
      const tabs = current.tabs.filter((tab) => tab.id !== tabId);
      return {
        activeTabId: current.activeTabId === tabId ? (tabs[0]?.id || DEFAULT_PROJECTS.activeTabId) : current.activeTabId,
        tabs: tabs.length ? tabs : DEFAULT_PROJECTS.tabs
      };
    });
  }, [saveProjects]);

  const addSection = useCallback((tabId, title) => {
    const clean = String(title || '').trim();
    if (!clean) return;
    saveProjects((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => tab.id === tabId
        ? { ...tab, sections: [...tab.sections, { id: projectId('section'), title: clean.slice(0, 54), items: [] }] }
        : tab)
    }));
  }, [saveProjects]);

  const removeSection = useCallback((tabId, sectionId) => {
    saveProjects((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        const sections = tab.sections.filter((section) => section.id !== sectionId);
        return { ...tab, sections: sections.length ? sections : [{ id: projectId('section'), title: 'General', items: [] }] };
      })
    }));
  }, [saveProjects]);

  const addItem = useCallback((tabId, sectionId, item) => {
    const title = String(item.title || '').trim();
    if (!title) return;
    const cleanItem = {
      id: projectId('item'),
      title: title.slice(0, 70),
      type: ['link', 'pdf', 'file', 'note', 'code'].includes(item.type) ? item.type : 'link',
      value: String(item.value || '').trim().slice(0, 500),
      note: String(item.note || '').trim().slice(0, 180),
      localPath: String(item.localPath || '').trim().slice(0, 900),
      url: String(item.url || '').trim().slice(0, 900),
      fileName: String(item.fileName || '').trim().slice(0, 220),
      savedAt: Number(item.savedAt || Date.now())
    };
    saveProjects((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => tab.id === tabId
        ? {
            ...tab,
            sections: tab.sections.map((section) => section.id === sectionId
              ? { ...section, items: [cleanItem, ...section.items].slice(0, 80) }
              : section)
          }
        : tab)
    }));
  }, [saveProjects]);

  const removeItem = useCallback((tabId, sectionId, itemId) => {
    saveProjects((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => tab.id === tabId
        ? {
            ...tab,
            sections: tab.sections.map((section) => section.id === sectionId
              ? { ...section, items: section.items.filter((item) => item.id !== itemId) }
              : section)
          }
        : tab)
    }));
  }, [saveProjects]);

  return { projects, setActiveTab, addTab, removeTab, addSection, removeSection, addItem, removeItem };
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
        const data = await readJsonResponse(response, 'Local AI request failed');
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
      return withUniqueIds(JSON.parse(localStorage.getItem(BRAIN_DUMP_KEY)) || [], 'note');
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
    setNotes((current) => [{ id: projectId('note'), text: clean, createdAt: Date.now() }, ...current].slice(0, 80));
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
      return withUniqueIds(JSON.parse(localStorage.getItem(FOCUS_LOG_KEY)) || [], 'focus');
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
          setLog((current) => [{ id: projectId('focus'), minutes, completedAt: Date.now() }, ...current].slice(0, 160));
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
      return Array.isArray(saved) && saved.length ? withUniqueIds(saved, 'habit') : defaultHabits();
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
    setHabits((current) => [{ id: projectId('habit'), title: title.slice(0, 32), history: {} }, ...current].slice(0, 12));
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
      return Array.isArray(saved) && saved.length ? withUniqueIds(saved, 'quick-link') : defaultQuickLinks();
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
    setLinks((current) => [{ id: projectId('quick-link'), label: label.slice(0, 24), url }, ...current].slice(0, 16));
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
      return Array.isArray(saved) && saved.length ? withUniqueIds(saved, 'agenda') : defaultAgenda();
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
    setEntries((current) => [{ id: projectId('agenda'), title: title.slice(0, 46), time: draft.time || '18:00', date: today }, ...current]);
    setDraft({ title: '', time: draft.time || '18:00' });
  }

  function removeEntry(id) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  return { entries: todayEntries, allEntries: entries, draft, setDraft, addEntry, removeEntry };
}

function defaultDailyGoals() {
  return [
    { id: 1, title: 'Study main subject', type: 'checkbox', target: 1, value: 0, done: false, streak: 0 },
    { id: 2, title: 'Finish one project step', type: 'checkbox', target: 1, value: 0, done: false, streak: 0 },
    { id: 3, title: 'Prepare for tomorrow', type: 'checkbox', target: 1, value: 0, done: false, streak: 0 }
  ];
}

function normalizeDailyGoal(goal) {
  const type = ['checkbox', 'number', 'timer', 'habit'].includes(goal?.type) ? goal.type : 'checkbox';
  const target = Math.max(1, Number(goal?.target) || 1);
  const value = Math.max(0, Number(goal?.value) || 0);
  return {
    id: goal?.id || `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: String(goal?.title || 'New goal').slice(0, 46),
    type,
    target,
    value,
    done: type === 'checkbox' ? Boolean(goal?.done) : value >= target || Boolean(goal?.done),
    streak: Math.max(0, Number(goal?.streak) || 0)
  };
}

function useDailyGoals() {
  const today = localDateKey();
  const [state, setState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DAILY_GOALS_KEY));
      return saved?.date === today && Array.isArray(saved.goals) ? { ...saved, goals: withUniqueIds(saved.goals.map(normalizeDailyGoal), 'goal') } : { date: today, goals: defaultDailyGoals() };
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
      goals: current.goals.map((goal) => {
        if (goal.id !== id) return goal;
        const done = !goal.done;
        return { ...goal, done, value: goal.type === 'checkbox' ? (done ? goal.target : 0) : goal.value, streak: done && !goal.done ? goal.streak + 1 : goal.streak };
      })
    }));
  }

  function updateGoal(id, title) {
    setState((current) => ({
      ...current,
      goals: current.goals.map((goal) => goal.id === id ? normalizeDailyGoal({ ...goal, title }) : goal)
    }));
  }

  function updateGoalPatch(id, patch) {
    setState((current) => ({
      ...current,
      goals: current.goals.map((goal) => {
        if (goal.id !== id) return goal;
        const next = normalizeDailyGoal({ ...goal, ...patch });
        return { ...next, done: next.type === 'checkbox' ? next.done : next.value >= next.target };
      })
    }));
  }

  function addGoal(title = 'New daily goal') {
    setState((current) => ({
      ...current,
      goals: [...current.goals, normalizeDailyGoal({ id: projectId('goal'), title })]
    }));
  }

  function removeGoal(id) {
    setState((current) => ({ ...current, goals: current.goals.filter((goal) => goal.id !== id) }));
  }

  function moveGoal(id, direction) {
    setState((current) => {
      const index = current.goals.findIndex((goal) => goal.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.goals.length) return current;
      const goals = [...current.goals];
      [goals[index], goals[target]] = [goals[target], goals[index]];
      return { ...current, goals };
    });
  }

  function resetGoals() {
    setState({ date: today, goals: defaultDailyGoals() });
  }

  const completed = state.goals.filter((goal) => goal.done).length;
  const progress = state.goals.length ? Math.round((completed / state.goals.length) * 100) : 0;
  return { goals: state.goals, completed, progress, toggleGoal, updateGoal, updateGoalPatch, addGoal, removeGoal, moveGoal, resetGoals };
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
      return Array.isArray(saved) && saved.length ? withUniqueIds(saved, 'exam') : defaultExamCountdowns();
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
    setItems((current) => [{ id: projectId('exam'), title: title.slice(0, 40), date: draft.date, tone: 'amber' }, ...current].slice(0, 20));
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

  function updateGoalPatch(id, patch) {
    setState((current) => ({
      ...current,
      goals: current.goals.map((goal) => goal.id === id ? normalizeDailyGoal({ ...goal, ...patch }) : goal)
    }));
  }

  function addGoal(title = 'New goal', type = 'checkbox') {
    setState((current) => ({ ...current, goals: [...current.goals, normalizeDailyGoal({ title, type })] }));
  }

  function removeGoal(id) {
    setState((current) => ({ ...current, goals: current.goals.filter((goal) => goal.id !== id) }));
  }

  function moveGoal(id, direction) {
    setState((current) => {
      const index = current.goals.findIndex((goal) => goal.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.goals.length) return current;
      const goals = [...current.goals];
      [goals[index], goals[nextIndex]] = [goals[nextIndex], goals[index]];
      return { ...current, goals };
    });
  }

  return [settings, setSettings];
}

function useCommandHistory() {
  const [history, setHistoryState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COMMAND_HISTORY_KEY));
      return Array.isArray(saved) ? withUniqueIds(saved.slice(0, 50), 'command') : [];
    } catch {
      return [];
    }
  });

  function addHistory(entry) {
    setHistoryState((current) => {
      const next = [{ id: projectId('command'), timestamp: Date.now(), ...entry }, ...current].slice(0, 50);
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
      return Array.isArray(saved) ? withUniqueIds(saved.slice(0, 100), 'security') : [];
    } catch {
      return [];
    }
  });

  function add(entry) {
    setEntries((current) => {
      const next = [{ id: projectId('security'), timestamp: Date.now(), ...entry }, ...current].slice(0, 100);
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

function normalizeAthanPerPrayer(value) {
  const source = value && typeof value === 'object' ? value : {};
  return ATHAN_PRAYER_NAMES.reduce((acc, prayerName) => {
    acc[prayerName] = source[prayerName] !== false;
    return acc;
  }, {});
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
    offlineVoice: merged.offlineVoice !== false,
    offlineVoiceAutostart: Boolean(merged.offlineVoiceAutostart),
    offlineVoiceEngine: ['vosk'].includes(merged.offlineVoiceEngine) ? merged.offlineVoiceEngine : DEFAULT_ASSISTANT_SETTINGS.offlineVoiceEngine,
    offlineVoiceModelDir: String(merged.offlineVoiceModelDir || DEFAULT_ASSISTANT_SETTINGS.offlineVoiceModelDir).trim(),
    offlineVoiceDevice: String(merged.offlineVoiceDevice || '').trim(),
    offlineVoiceSampleRate: Math.max(8000, Math.min(48000, Number(merged.offlineVoiceSampleRate) || DEFAULT_ASSISTANT_SETTINGS.offlineVoiceSampleRate)),
    offlineVoiceWakeTimeout: Math.max(2, Math.min(30, Number(merged.offlineVoiceWakeTimeout) || DEFAULT_ASSISTANT_SETTINGS.offlineVoiceWakeTimeout)),
    recognitionLanguage: ['en-US', 'ar-SA', 'en-GB'].includes(merged.recognitionLanguage) ? merged.recognitionLanguage : DEFAULT_ASSISTANT_SETTINGS.recognitionLanguage,
    customWakePhrase: String(merged.customWakePhrase || `Hey ${merged.assistantName || DEFAULT_ASSISTANT_SETTINGS.assistantName}`).trim(),
    replyLanguage: ['en', 'ar', 'both'].includes(merged.replyLanguage) ? merged.replyLanguage : DEFAULT_ASSISTANT_SETTINGS.replyLanguage,
    randomizeCallName: merged.randomizeCallName !== false,
    startupGreetingMode: ['intro', 'random', 'custom', 'audio', 'silent'].includes(merged.startupGreetingMode) ? merged.startupGreetingMode : DEFAULT_ASSISTANT_SETTINGS.startupGreetingMode,
    customStartupText: String(merged.customStartupText || '').trim(),
    customStartupAudio: String(merged.customStartupAudio || '').trim(),
    alarmStartsMusic: merged.alarmStartsMusic !== false,
    alarmBrightnessRamp: merged.alarmBrightnessRamp !== false,
    athanEnabled: merged.athanEnabled !== false,
    athanVoiceEnabled: merged.athanVoiceEnabled !== false,
    athanLanguage: ['en', 'ar', 'both'].includes(merged.athanLanguage) ? merged.athanLanguage : DEFAULT_ASSISTANT_SETTINGS.athanLanguage,
    athanPerPrayer: normalizeAthanPerPrayer(merged.athanPerPrayer)
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

function weatherStoreToLocationSettings(weatherSettings) {
  return {
    weatherName: weatherSettings?.locationName || DEFAULT_LOCATION_SETTINGS.weatherName,
    weatherLat: weatherSettings?.latitude ?? DEFAULT_LOCATION_SETTINGS.weatherLat,
    weatherLon: weatherSettings?.longitude ?? DEFAULT_LOCATION_SETTINGS.weatherLon,
    weatherTimezone: weatherSettings?.timezone || DEFAULT_LOCATION_SETTINGS.weatherTimezone
  };
}

function locationSettingsToWeatherStore(settings) {
  return {
    locationName: settings.weatherName,
    latitude: settings.weatherLat,
    longitude: settings.weatherLon,
    timezone: settings.weatherTimezone
  };
}

function useLocationSettings(globalWeatherSettings, updateWeatherSettings) {
  const [settings, setSettingsState] = useState(() => sanitizeLocationSettings({
    ...readJsonSetting(LOCATION_SETTINGS_KEY, DEFAULT_LOCATION_SETTINGS),
    ...weatherStoreToLocationSettings(globalWeatherSettings)
  }));

  useEffect(() => {
    if (!globalWeatherSettings) return;
    setSettingsState((current) => sanitizeLocationSettings({ ...current, ...weatherStoreToLocationSettings(globalWeatherSettings) }));
  }, [globalWeatherSettings?.locationName, globalWeatherSettings?.latitude, globalWeatherSettings?.longitude, globalWeatherSettings?.timezone]);

  function setSettings(patch) {
    setSettingsState((current) => {
      const next = sanitizeLocationSettings(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
      localStorage.setItem(LOCATION_SETTINGS_KEY, JSON.stringify(next));
      updateWeatherSettings?.(locationSettingsToWeatherStore(next));
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

function useLookStyle(globalAppearance, updateAppearance) {
  const getValidLook = (value) => LOOK_STYLES.some((style) => style.id === value) ? value : 'glossy';
  const [lookStyle, setLookStyleState] = useState(() => getValidLook(globalAppearance?.look || localStorage.getItem(LOOK_STYLE_KEY)));

  useEffect(() => {
    const nextLook = getValidLook(globalAppearance?.look);
    setLookStyleState((current) => current === nextLook ? current : nextLook);
  }, [globalAppearance?.look]);

  const setLookStyle = useCallback((nextStyle) => {
    const valid = getValidLook(nextStyle);
    setLookStyleState(valid);
    localStorage.setItem(LOOK_STYLE_KEY, valid);
    updateAppearance?.({ look: valid });
  }, [updateAppearance]);

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

function normalizeBackgroundServices(value) {
  const merged = { ...DEFAULT_BACKGROUND_SERVICES, ...(value || {}) };
  return Object.fromEntries(
    Object.keys(DEFAULT_BACKGROUND_SERVICES).map((key) => [key, Boolean(merged[key])])
  );
}

function useBackgroundServices() {
  const [services, setServicesState] = useState(() => normalizeBackgroundServices(readJsonSetting(BACKGROUND_SERVICES_KEY, DEFAULT_BACKGROUND_SERVICES)));

  const setServices = useCallback((patch) => {
    setServicesState((current) => {
      const next = normalizeBackgroundServices(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
      localStorage.setItem(BACKGROUND_SERVICES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return [services, setServices];
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

function isMicrophoneSecureOrigin() {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function normalizeSpeechText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueSpeechPhrases(phrases) {
  return [...new Set(phrases.map(normalizeSpeechText).filter(Boolean))];
}

function wakePhraseCandidates(settings) {
  const assistantName = normalizeSpeechText(settings?.assistantName || DEFAULT_ASSISTANT_SETTINGS.assistantName);
  const customWake = normalizeSpeechText(settings?.customWakePhrase || '');
  const nameVariants = [assistantName];
  if (assistantName === 'nexora') nameVariants.push('next sora', 'nextsora', 'next aura', 'nex aura', 'nixora', 'nix ora');
  if (assistantName === 'd') nameVariants.push('dee');
  const commandPrefixes = ['hey', 'hi', 'ok', 'okay'];
  return uniqueSpeechPhrases([
    customWake,
    ...nameVariants.flatMap((name) => [
      ...commandPrefixes.map((prefix) => `${prefix} ${name}`),
      name
    ])
  ]).sort((a, b) => b.length - a.length);
}

function findWakePhrase(text, settings) {
  const normalized = normalizeSpeechText(text);
  if (!normalized) return '';
  return wakePhraseCandidates(settings).find((phrase) => {
    if (phrase.length <= 3) return normalized === phrase;
    return ` ${normalized} `.includes(` ${phrase} `);
  }) || '';
}

function stripWakePhrase(text, matchedPhrase, settings) {
  if (!matchedPhrase) return String(text || '').trim();
  const raw = String(text || '');
  const candidates = wakePhraseCandidates(settings);
  for (const phrase of candidates) {
    const words = phrase.split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = words.join('\\s+');
    const next = raw.replace(new RegExp(`(^|\\s)${pattern}(?=\\s|$|[,.!?])`, 'i'), ' ').replace(/^[\s,.:;!?-]+/, '').trim();
    if (normalizeSpeechText(next) !== normalizeSpeechText(raw)) return next;
  }
  return raw.trim();
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

function athanSpeechText(prayerName, settings, userName = '') {
  const cleanPrayer = String(prayerName || '').trim();
  const arabicName = ARABIC_PRAYER_NAMES[cleanPrayer] || cleanPrayer;
  const suffix = userName ? `, ${userName}` : '';
  const english = `It is time for ${cleanPrayer} prayer${suffix}.`;
  const arabic = `حان الآن وقت صلاة ${arabicName}.`;
  if (settings?.athanLanguage === 'ar') return arabic;
  if (settings?.athanLanguage === 'both') return `${english} ${arabic}`;
  return english;
}

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((title, detail = '', tone = 'green') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [{ id, title, detail, tone }, ...current].slice(0, 3));
    playSoftChime();
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title, detail, tone, route: window.location.pathname })
    }).catch(() => {});
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
    armed: false,
    transcript: '',
    error: '',
    phase: 'idle',
    micPermission: 'unknown',
    secureContext: true,
    lastEvent: 'Waiting for microphone permission',
    restartCount: 0
  });
  const recognitionRef = useRef(null);
  const manualListenRef = useRef(false);
  const shouldListenRef = useRef(false);
  const micBlockedRef = useRef(false);
  const micPermissionRef = useRef('unknown');
  const recognitionRunningRef = useRef(false);
  const recognitionStartingRef = useRef(false);
  const restartTimerRef = useRef(null);
  const previewTimerRef = useRef(null);
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

  const requestMicAccess = useCallback(async (manual = false) => {
    if (!isMicrophoneSecureOrigin()) {
      const message = 'Microphone requires HTTPS or localhost. Open KISOKE with https://localhost:5174, https://LAPTOP-IP:5174, or http://localhost:5173.';
      setState((current) => ({ ...current, secureContext: false, micPermission: 'blocked', phase: 'error', error: message, lastEvent: 'Blocked by insecure origin' }));
      if (manual) pushToast('Microphone blocked', message, 'amber');
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((current) => ({ ...current, micPermission: 'unavailable', lastEvent: 'Browser did not expose microphone permissions' }));
      return true;
    }

    try {
      const sensitivity = Number(settingsRef.current.microphoneSensitivity ?? 55);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: sensitivity < 78,
          autoGainControl: sensitivity >= 35,
          channelCount: 1
        }
      });
      stream.getTracks().forEach((track) => track.stop());
      micBlockedRef.current = false;
      micPermissionRef.current = 'allowed';
      setState((current) => ({ ...current, secureContext: true, micPermission: 'allowed', error: '', lastEvent: 'Microphone permission allowed' }));
      return true;
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      const message = denied
        ? 'Microphone permission is blocked for this page. Use the browser lock icon to allow it, then try again.'
        : `Microphone check failed: ${error?.message || error?.name || 'unknown error'}`;
      micBlockedRef.current = denied;
      micPermissionRef.current = denied ? 'blocked' : 'error';
      setState((current) => ({ ...current, micPermission: micPermissionRef.current, listening: false, wakeActive: false, phase: 'error', error: message, lastEvent: message }));
      if (manual) pushToast('Microphone unavailable', message, 'amber');
      return false;
    }
  }, [pushToast]);

  const startListening = useCallback(async (manual = false, forcedSettings = null) => {
    const currentSettings = { ...settingsRef.current, ...(forcedSettings || {}) };
    if (!currentSettings.voiceAssistant || currentSettings.voiceMode === 'off') {
      const message = currentSettings.voiceMode === 'off' ? 'Voice mode is off in settings.' : 'Voice assistant is turned off in settings.';
      setState((current) => ({ ...current, listening: false, wakeActive: false, armed: false, phase: 'idle', error: message, lastEvent: message }));
      if (manual) pushToast('Voice is off', message, 'amber');
      return;
    }
    if (!manual && micBlockedRef.current) {
      setState((current) => ({
        ...current,
        listening: false,
        wakeActive: false,
        phase: 'error',
        error: 'Microphone permission is blocked for this page.',
        micPermission: 'blocked',
        lastEvent: 'Waiting for microphone permission'
      }));
      return;
    }
    if (micPermissionRef.current !== 'allowed') {
      const allowed = await requestMicAccess(manual);
      if (!allowed) return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState((current) => ({ ...current, supported: false, phase: 'error', error: 'Voice recognition is not supported in this browser.', lastEvent: 'Speech recognition unavailable' }));
      if (manual) pushToast('Voice unavailable', 'Chrome or Edge with microphone permission is required.', 'amber');
      return;
    }
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = currentSettings.voiceMode === 'wake';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = currentSettings.recognitionLanguage || 'en-US';

      recognition.onstart = () => {
        recognitionStartingRef.current = false;
        recognitionRunningRef.current = true;
        setState((current) => ({
          ...current,
          supported: true,
          listening: true,
          armed: shouldListenRef.current || current.armed,
          phase: 'listening',
          error: '',
          lastEvent: shouldListenRef.current ? 'Wake-word listener is armed' : 'Listening for voice command'
        }));
        if (pendingManualGreetingRef.current) {
          pendingManualGreetingRef.current = false;
          const greetingSettings = settingsRef.current;
          const name = pickUserName(greetingSettings);
          const reply = assistantReply(greetingSettings, `How can I help you today ${name}?`, `كيف أقدر أساعدك اليوم يا ${name}؟`);
          speakClient(reply, settingsRef.current);
          pushToast(settingsRef.current.assistantName, reply, 'blue');
        }
      };
      recognition.onerror = (event) => {
        pendingManualGreetingRef.current = false;
        const blocked = event.error === 'not-allowed' || event.error === 'service-not-allowed';
        const transient = event.error === 'no-speech' || event.error === 'aborted';
        if (blocked) {
          shouldListenRef.current = false;
          micBlockedRef.current = true;
          micPermissionRef.current = 'blocked';
          localStorage.removeItem(VOICE_ARMED_KEY);
        }
        const message = blocked
          ? 'Microphone permission is blocked for this page.'
          : event.error === 'network'
            ? 'Chrome voice recognition needs network right now. Type commands to use local Ollama offline.'
            : transient
              ? 'Waiting for speech...'
              : `Voice error: ${event.error || 'unknown'}`;
        setState((current) => ({
          ...current,
          supported: true,
          listening: false,
          wakeActive: false,
          armed: blocked ? false : current.armed,
          micPermission: blocked ? 'blocked' : current.micPermission,
          phase: transient ? 'listening' : 'error',
          error: transient ? '' : message,
          lastEvent: message
        }));
        const now = Date.now();
        if (!transient && (manualListenRef.current || now - lastVoiceErrorToastRef.current > 45000)) {
          lastVoiceErrorToastRef.current = now;
          pushToast('Voice stopped', message, 'amber');
        }
      };
      recognition.onend = () => {
        pendingManualGreetingRef.current = false;
        recognitionStartingRef.current = false;
        recognitionRunningRef.current = false;
        if (!micBlockedRef.current && shouldListenRef.current && settingsRef.current.voiceAssistant !== false) {
          setState((current) => ({
            ...current,
            listening: false,
            wakeActive: false,
            armed: true,
            phase: current.error ? current.phase : 'listening',
            lastEvent: 'Wake listener paused; restarting'
          }));
          window.clearTimeout(restartTimerRef.current);
          restartTimerRef.current = window.setTimeout(() => {
            if (recognitionRunningRef.current || recognitionStartingRef.current) return;
            try {
              recognition.continuous = true;
              recognition.lang = settingsRef.current.recognitionLanguage || 'en-US';
              recognitionStartingRef.current = true;
              recognition.start();
              setState((current) => ({ ...current, restartCount: current.restartCount + 1, lastEvent: 'Restarting wake-word listener' }));
            } catch (error) {
              recognitionStartingRef.current = false;
              setState((current) => ({ ...current, phase: 'error', error: `Voice restart failed: ${error?.message || 'unknown'}`, lastEvent: 'Voice restart failed' }));
            }
          }, 280);
        } else {
          setState((current) => ({ ...current, listening: false, wakeActive: false, phase: current.error ? current.phase : 'idle', lastEvent: 'Speech session ended' }));
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
        if (transcript) setState((current) => ({ ...current, transcript, phase: 'listening', lastEvent: finalText.trim() ? 'Speech detected' : 'Hearing speech' }));
        if (!finalText.trim()) return;

        const currentSettings = settingsRef.current;
        const matchedWake = findWakePhrase(finalText, currentSettings);
        const manualMode = manualListenRef.current;
        if (!manualMode && !matchedWake) return;
        setState((current) => ({ ...current, wakeActive: Boolean(matchedWake), phase: matchedWake ? 'heard wake word' : 'listening' }));

        let command = finalText.trim();
        if (matchedWake) {
          command = stripWakePhrase(command, matchedWake, currentSettings);
        }
        if (!command) {
          const name = pickUserName(currentSettings);
          const reply = assistantReply(currentSettings, `How can I help you today ${name}?`, `كيف أقدر أساعدك اليوم يا ${name}؟`);
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

    if (recognitionRunningRef.current || recognitionStartingRef.current) {
      if (manual) setState((current) => ({ ...current, wakeActive: true, phase: 'listening', lastEvent: 'Microphone is already listening' }));
      return;
    }
    manualListenRef.current = manual;
    shouldListenRef.current = currentSettings.voiceMode === 'wake' && currentSettings.alwaysListen;
    if (shouldListenRef.current) localStorage.setItem(VOICE_ARMED_KEY, 'true');
    if (recognitionRef.current) {
      recognitionRef.current.continuous = currentSettings.voiceMode === 'wake';
      recognitionRef.current.lang = currentSettings.recognitionLanguage || 'en-US';
    }
    if (manual) micBlockedRef.current = false;
    setState((current) => ({
      ...current,
      supported: true,
      armed: shouldListenRef.current || current.armed,
      wakeActive: manual,
      phase: manual ? 'listening' : current.phase,
      error: '',
      lastEvent: shouldListenRef.current ? 'Starting wake-word microphone' : 'Starting microphone'
    }));
    pendingManualGreetingRef.current = manual;
    try {
      recognitionStartingRef.current = true;
      recognitionRef.current.start();
    } catch (error) {
      recognitionStartingRef.current = false;
      pendingManualGreetingRef.current = false;
      const message = String(error?.message || error || 'Voice could not start.');
      setState((current) => current.listening
        ? current
        : { ...current, listening: false, wakeActive: false, phase: 'error', error: message });
      if (manual) pushToast('Voice stopped', message, 'amber');
    }
  }, [pushToast, requestMicAccess]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    manualListenRef.current = false;
    recognitionStartingRef.current = false;
    window.clearTimeout(restartTimerRef.current);
    localStorage.removeItem(VOICE_ARMED_KEY);
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
    setState((current) => ({ ...current, listening: false, wakeActive: false, armed: false, phase: 'idle', lastEvent: 'Voice listener stopped' }));
  }, []);

  const armWakeWord = useCallback((forcedSettings = null) => {
    const wakeSettings = { ...settingsRef.current, ...(forcedSettings || {}), voiceAssistant: true, voiceMode: 'wake', alwaysListen: true };
    localStorage.setItem(VOICE_ARMED_KEY, 'true');
    shouldListenRef.current = true;
    micBlockedRef.current = false;
    setState((current) => ({ ...current, armed: true, error: '', lastEvent: 'Wake word armed; starting microphone' }));
    return startListening(true, wakeSettings);
  }, [startListening]);

  const preview = useCallback(() => {
    window.clearTimeout(previewTimerRef.current);
    setState((current) => ({ ...current, wakeActive: true, phase: 'thinking', error: '', lastEvent: 'Previewing assistant animation' }));
    previewTimerRef.current = window.setTimeout(() => {
      setState((current) => ({ ...current, phase: 'speaking', lastEvent: 'Previewing assistant reply' }));
      previewTimerRef.current = window.setTimeout(() => {
        setState((current) => ({ ...current, wakeActive: false, phase: current.listening ? 'listening' : 'idle', lastEvent: current.listening ? 'Listening for wake phrase' : 'Preview finished' }));
      }, 1200);
    }, 900);
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
      setState((current) => ({ ...current, armed: true, lastEvent: 'Wake listener armed from saved setting' }));
      startListening(false);
      return undefined;
    }

    const armAfterGesture = () => {
      localStorage.setItem(VOICE_ARMED_KEY, 'true');
      setState((current) => ({ ...current, armed: true, lastEvent: 'Wake listener armed by first interaction' }));
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

  useEffect(() => () => {
    window.clearTimeout(restartTimerRef.current);
    window.clearTimeout(previewTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
  }, []);

  return { ...state, startListening, stopListening, armWakeWord, preview };
}

function backendOfflineVoiceSettings(settings) {
  return {
    assistantName: settings.assistantName,
    assistant_name: settings.assistantName,
    customWakePhrase: settings.customWakePhrase,
    custom_wake_phrase: settings.customWakePhrase,
    offlineVoice: settings.offlineVoice,
    offline_voice_enabled: settings.offlineVoice,
    offlineVoiceAutostart: settings.offlineVoiceAutostart,
    offline_voice_autostart: settings.offlineVoiceAutostart,
    offlineVoiceEngine: settings.offlineVoiceEngine,
    offline_voice_engine: settings.offlineVoiceEngine,
    offlineVoiceModelDir: settings.offlineVoiceModelDir,
    offline_voice_model_dir: settings.offlineVoiceModelDir,
    offlineVoiceDevice: settings.offlineVoiceDevice || null,
    offline_voice_device: settings.offlineVoiceDevice || null,
    offlineVoiceSampleRate: settings.offlineVoiceSampleRate,
    offline_voice_sample_rate: settings.offlineVoiceSampleRate,
    offlineVoiceWakeTimeout: settings.offlineVoiceWakeTimeout,
    offline_voice_wake_timeout: settings.offlineVoiceWakeTimeout
  };
}

function offlineVoiceStatusTone(status) {
  if (!status) return 'warning';
  if (status.running) return 'live';
  if (status.dependencies?.missing?.length || status.model_present === false || status.last_error) return 'warning';
  return 'warning';
}

function useBackendOfflineVoice(settings, onCommand, pushToast) {
  const [state, setState] = useState({
    checked: false,
    running: false,
    enabled: Boolean(settings.offlineVoice),
    status: null,
    devices: [],
    transcript: '',
    lastCommand: '',
    lastEvent: '',
    error: '',
    phase: 'idle'
  });
  const commandRef = useRef(onCommand);
  const settingsRef = useRef(settings);
  const eventIdRef = useRef(0);
  const autostartedRef = useRef(false);

  useEffect(() => {
    commandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const refreshStatus = useCallback(async () => {
    if (!settingsRef.current.offlineVoice) {
      setState((current) => ({ ...current, enabled: false, running: false, checked: true, phase: 'idle', lastEvent: 'Backend offline voice disabled' }));
      return { ok: false, disabled: true };
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/voice/offline/status`, { cache: 'no-store' });
      const data = await readJsonResponse(response, 'Offline voice status failed');
      setState((current) => ({
        ...current,
        checked: true,
        enabled: Boolean(data.enabled),
        running: Boolean(data.running),
        status: data,
        error: data.last_error || '',
        phase: data.running ? 'listening' : current.phase === 'listening' ? 'idle' : current.phase,
        lastEvent: data.message || current.lastEvent
      }));
      return data;
    } catch (error) {
      setState((current) => ({
        ...current,
        checked: true,
        running: false,
        status: null,
        phase: 'error',
        error: error?.message || 'Backend offline voice status failed.',
        lastEvent: 'Backend voice API unavailable'
      }));
      return { ok: false, error: error?.message || 'Backend unavailable' };
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/voice/offline/devices`, { cache: 'no-store' });
      const data = await readJsonResponse(response, 'Offline voice device scan failed');
      setState((current) => ({ ...current, devices: data.devices || [] }));
      return data.devices || [];
    } catch {
      setState((current) => ({ ...current, devices: [] }));
      return [];
    }
  }, []);

  const sendSettings = useCallback(async () => {
    try {
      await fetch(`${DEVICE_API_BASE}/api/voice/offline/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: backendOfflineVoiceSettings(settingsRef.current) })
      });
    } catch {
      // Status polling will surface backend availability.
    }
  }, []);

  const start = useCallback(async (manual = true) => {
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/voice/offline/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: backendOfflineVoiceSettings(settingsRef.current) })
      });
      const data = await readJsonResponse(response, 'Offline voice start failed');
      setState((current) => ({
        ...current,
        checked: true,
        running: Boolean(data.running),
        status: data,
        phase: data.running ? 'listening' : 'error',
        error: data.running ? '' : (data.last_error || data.message || 'Offline voice did not start.'),
        lastEvent: data.message || 'Offline voice start requested'
      }));
      if (manual) {
        pushToast(data.running ? 'Offline voice started' : 'Offline voice blocked', data.message || data.last_error || 'Check the model/dependencies.', data.running ? 'green' : 'amber');
      }
      return data;
    } catch (error) {
      const message = error?.message || 'Backend is not running.';
      setState((current) => ({ ...current, running: false, phase: 'error', error: message, lastEvent: message }));
      if (manual) pushToast('Offline voice failed', message, 'amber');
      return { ok: false, error: message };
    }
  }, [pushToast]);

  const stop = useCallback(async (manual = true) => {
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/voice/offline/stop`, { method: 'POST' });
      const data = await readJsonResponse(response, 'Offline voice stop failed');
      setState((current) => ({ ...current, running: false, status: data, phase: 'idle', lastEvent: 'Offline voice stopped' }));
      if (manual) pushToast('Offline voice stopped', 'Backend microphone listener is off.', 'blue');
      return data;
    } catch (error) {
      const message = error?.message || 'Backend is not running.';
      setState((current) => ({ ...current, error: message, phase: 'error' }));
      if (manual) pushToast('Offline voice failed', message, 'amber');
      return { ok: false, error: message };
    }
  }, [pushToast]);

  useEffect(() => {
    refreshStatus();
    refreshDevices();
    const statusTimer = window.setInterval(refreshStatus, 5000);
    return () => window.clearInterval(statusTimer);
  }, [refreshStatus, refreshDevices]);

  useEffect(() => {
    sendSettings();
    if (settings.offlineVoice && settings.offlineVoiceAutostart && !autostartedRef.current) {
      autostartedRef.current = true;
      start(false);
    }
  }, [
    settings.offlineVoice,
    settings.offlineVoiceAutostart,
    settings.offlineVoiceModelDir,
    settings.offlineVoiceDevice,
    settings.offlineVoiceSampleRate,
    settings.offlineVoiceWakeTimeout,
    settings.assistantName,
    settings.customWakePhrase,
    sendSettings,
    start
  ]);

  useEffect(() => {
    if (!settings.offlineVoice) return undefined;
    let cancelled = false;
    const pollEvents = async () => {
      try {
        const response = await fetch(`${DEVICE_API_BASE}/api/voice/offline/events?since=${eventIdRef.current}`, { cache: 'no-store' });
        const data = await readJsonResponse(response, 'Offline voice events failed');
        const events = data.events || [];
        if (data.last_event_id != null) eventIdRef.current = Number(data.last_event_id) || eventIdRef.current;
        for (const event of events) {
          eventIdRef.current = Math.max(eventIdRef.current, Number(event.id || 0));
          if (cancelled) return;
          if (event.type === 'transcript') {
            setState((current) => ({ ...current, transcript: event.text || '', phase: event.partial ? 'listening' : current.phase, lastEvent: event.partial ? 'Hearing offline speech' : 'Offline speech detected' }));
          } else if (event.type === 'wake') {
            const name = pickUserName(settingsRef.current);
            const reply = assistantReply(settingsRef.current, `How can I help you today ${name}?`, `كيف أقدر أساعدك اليوم يا ${name}؟`);
            setState((current) => ({ ...current, transcript: event.text || current.transcript, phase: 'heard wake word', lastEvent: 'Offline wake word detected' }));
            speakClient(reply, settingsRef.current);
          } else if (event.type === 'command') {
            const command = event.command || event.text || '';
            setState((current) => ({ ...current, lastCommand: command, phase: 'thinking', lastEvent: 'Offline command received' }));
            Promise.resolve(commandRef.current(command))
              .then(() => setState((current) => ({ ...current, phase: current.running ? 'listening' : 'idle', lastEvent: 'Offline command handled' })))
              .catch(() => setState((current) => ({ ...current, phase: 'error', error: 'Offline command failed.' })));
          } else if (event.type === 'error') {
            setState((current) => ({ ...current, error: event.text || 'Offline voice error', phase: 'error', lastEvent: event.text || 'Offline voice error' }));
          } else if (event.type === 'status') {
            setState((current) => ({ ...current, lastEvent: event.text || current.lastEvent }));
          }
        }
      } catch {
        // Status polling reports backend availability; event polling stays quiet.
      }
    };
    pollEvents();
    const eventTimer = window.setInterval(pollEvents, 900);
    return () => {
      cancelled = true;
      window.clearInterval(eventTimer);
    };
  }, [settings.offlineVoice]);

  useEffect(() => {
    if (!state.transcript) return undefined;
    const timer = window.setTimeout(() => {
      setState((current) => current.transcript ? { ...current, transcript: '' } : current);
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [state.transcript]);

  return { ...state, refreshStatus, refreshDevices, start, stop, sendSettings };
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

function useRoomBrightnessHistory(enabled = true) {
  const [state, setState] = useState(() => {
    try {
      const samples = JSON.parse(localStorage.getItem(BRIGHTNESS_HISTORY_KEY)) || [];
      return { samples: samples.slice(-96), status: 'Waiting for sensor', latest: null, error: '' };
    } catch {
      return { samples: [], status: 'Waiting for sensor', latest: null, error: '' };
    }
  });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState((current) => ({ ...current, status: 'Sensor paused', error: '' }));
      return null;
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/local-camera/sensor`, { cache: 'no-store' });
      const data = await readJsonResponse(response, 'Room brightness sensor failed');
      const brightness = data?.brightness || {};
      const percent = clampNumber(brightness.brightness ?? brightness.percent ?? 0, 0, 100);
      const sample = {
        at: Date.now(),
        brightness: Math.round(percent),
        level: brightness.level || 'unknown',
        motion: Boolean(data?.motion?.motion),
        face: Boolean(data?.face?.face_detected || data?.face?.stable)
      };
      setState((current) => {
        const samples = [...current.samples, sample].slice(-96);
        localStorage.setItem(BRIGHTNESS_HISTORY_KEY, JSON.stringify(samples));
        return {
          samples,
          latest: sample,
          status: data?.camera?.connected ? 'Sensor live' : (data?.camera?.error || 'Camera sensor offline'),
          error: ''
        };
      });
      return sample;
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'Sensor offline',
        error: error?.message || 'Camera sensor did not answer.'
      }));
      return null;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    let disposed = false;
    const tick = async () => {
      if (!disposed) await refresh();
    };
    tick();
    const timer = window.setInterval(tick, 10000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  return { ...state, refresh };
}

function getWeatherDangerAlerts(weather, air, now = new Date()) {
  const alerts = [];
  const night = isNightAt(now, weather?.sunrise, weather?.sunset);
  const condition = weatherCondition(weather?.code, night);
  const heat = Number(weather?.feels ?? weather?.temp ?? 0);
  const humidity = Number(weather?.humidity ?? 0);
  const wind = Number(weather?.wind ?? 0);
  const rainChance = Number(weather?.rain ?? 0);
  const precip = Number(weather?.precipitation ?? 0);
  const pm10 = Number(air?.pm10 ?? 0);
  const aqi = Number(air?.aqi ?? 0);

  if (heat >= 42) alerts.push({ id: 'heat-high', tone: 'red', title: 'Extreme heat', detail: `${heat}C feels-like. Hydrate and avoid long outdoor time.`, Icon: Thermometer });
  else if (heat >= 38) alerts.push({ id: 'heat', tone: 'amber', title: 'Heat warning', detail: `${heat}C feels-like. Keep water nearby.`, Icon: Thermometer });
  if (humidity >= 75) alerts.push({ id: 'humidity', tone: 'amber', title: 'Humidity high', detail: `${humidity}% humidity. Room may feel warmer than the temperature.`, Icon: Droplets });
  if (pm10 >= 75 || aqi >= 120 || wind >= 30) alerts.push({ id: 'dust', tone: 'amber', title: 'Dust watch', detail: `AQI ${air?.aqi ?? '--'} / PM10 ${air?.pm10 ?? '--'} / wind ${wind} km/h.`, Icon: Wind });
  if (condition.tone === 'storm') alerts.push({ id: 'storm', tone: 'red', title: 'Thunder risk', detail: 'Storm weather code detected. Watch outdoor conditions.', Icon: CloudRain });
  else if (rainChance >= 60 || precip >= 0.2 || condition.tone === 'rain') alerts.push({ id: 'rain', tone: 'blue', title: 'Rain chance', detail: `${rainChance || '--'}% rain chance. Carry an umbrella if leaving.`, Icon: CloudRain });

  return alerts.slice(0, 4);
}

function getMoonCalendar(date = new Date(), days = 8) {
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(date);
    day.setDate(date.getDate() + index);
    const moon = getMoonPhase(day);
    return {
      key: localDateKey(day),
      label: index === 0 ? 'Today' : day.toLocaleDateString('en-AE', { weekday: 'short' }),
      date: day,
      ...moon
    };
  });
}

function getSunTimeline(weather, now, timeFormat) {
  const sunrise = parseWeatherSunTime(weather?.sunrise);
  const sunset = parseWeatherSunTime(weather?.sunset);
  if (!sunrise || !sunset) return [];
  const solarNoon = new Date((sunrise.getTime() + sunset.getTime()) / 2);
  const dawn = new Date(sunrise.getTime() - 90 * 60000);
  const dusk = new Date(sunset.getTime() + 90 * 60000);
  return [
    { id: 'dawn', label: 'Dawn', time: dawn },
    { id: 'sunrise', label: 'Sunrise', time: sunrise },
    { id: 'noon', label: 'Solar noon', time: solarNoon },
    { id: 'sunset', label: 'Sunset', time: sunset },
    { id: 'dusk', label: 'Dusk', time: dusk }
  ].map((item) => ({
    ...item,
    display: formatClockTime(item.time, timeFormat),
    active: Math.abs(item.time.getTime() - now.getTime()) < 45 * 60000
  }));
}

function outfitRecommendation(weather) {
  const temp = Number(weather?.temp ?? 0);
  const feels = Number(weather?.feels ?? temp);
  const rain = Number(weather?.rain ?? 0);
  const humidity = Number(weather?.humidity ?? 0);
  if (rain >= 55 || Number(weather?.precipitation ?? 0) >= 0.2) {
    return { en: 'Rain expected. Bring an umbrella.', ar: 'قد تمطر اليوم. خذ مظلة.' };
  }
  if (feels >= 38) {
    return { en: 'It is hot today. Wear light clothing and keep water nearby.', ar: 'الجو حار اليوم. ارتدِ ملابس خفيفة وخذ ماء.' };
  }
  if (temp <= 20) {
    return { en: 'It is cooler today. Consider a light jacket.', ar: 'الجو بارد قليلاً. خذ جاكيت خفيف.' };
  }
  if (humidity >= 75) {
    return { en: 'Humidity is high. Choose breathable clothes.', ar: 'الرطوبة عالية. اختر ملابس مريحة وخفيفة.' };
  }
  return { en: 'Weather looks normal. Dress comfortably.', ar: 'الطقس مناسب. ارتدِ ملابس مريحة.' };
}

function assistantReply(settings, english, arabic) {
  const mode = settings?.replyLanguage || 'both';
  if (mode === 'ar') return arabic || english;
  if (mode === 'both' && arabic) return `${english} / ${arabic}`;
  return english;
}

async function postDeviceBrightness(percent) {
  const clean = Math.max(1, Math.min(100, Math.round(Number(percent) || 1)));
  const response = await fetch(`${DEVICE_API_BASE}/api/device/brightness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ percent: clean })
  });
  return readJsonResponse(response, 'Brightness ramp failed');
}

function startAlarmBrightnessRamp(ref, start = 8, end = 72, seconds = 75) {
  window.clearInterval(ref.current);
  let step = 0;
  const steps = 12;
  const apply = () => {
    const percent = Math.round(start + ((end - start) * (step / steps)));
    postDeviceBrightness(percent).catch(() => {});
    step += 1;
    if (step > steps) {
      window.clearInterval(ref.current);
      ref.current = null;
    }
  };
  apply();
  ref.current = window.setInterval(apply, Math.max(2500, Math.round((seconds * 1000) / steps)));
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

function normalizePrayerSettings(value) {
  const merged = { ...DEFAULT_PRAYER_SETTINGS, ...(value || {}) };
  const lat = Number(merged.latitude);
  const lon = Number(merged.longitude);
  const offsets = merged.offsets && typeof merged.offsets === 'object' ? merged.offsets : {};
  return {
    ...merged,
    locationName: String(merged.locationName || DEFAULT_PRAYER_SETTINGS.locationName).trim(),
    country: String(merged.country || DEFAULT_PRAYER_SETTINGS.country).trim(),
    latitude: Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : DEFAULT_PRAYER_SETTINGS.latitude,
    longitude: Number.isFinite(lon) && lon >= -180 && lon <= 180 ? lon : DEFAULT_PRAYER_SETTINGS.longitude,
    timezone: String(merged.timezone || DEFAULT_PRAYER_SETTINGS.timezone).trim(),
    calculationMethod: PRAYER_CALCULATION_METHODS.some((method) => method.id === String(merged.calculationMethod)) ? String(merged.calculationMethod) : DEFAULT_PRAYER_SETTINGS.calculationMethod,
    asrMethod: ASR_METHODS.some((method) => method.id === String(merged.asrMethod)) ? String(merged.asrMethod) : DEFAULT_PRAYER_SETTINGS.asrMethod,
    offsets: ATHAN_PRAYER_NAMES.reduce((next, prayerName) => ({
      ...next,
      [prayerName]: clampNumber(Number(offsets[prayerName]) || 0, -30, 30)
    }), {})
  };
}

function zoneDateParts(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
  } catch {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
  }
}

function dateAtZone(date, hour, minute, timezone) {
  const parts = zoneDateParts(date, timezone);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0);
  const guessDate = new Date(utcGuess);
  const actual = zoneDateParts(guessDate, timezone);
  const observedLocalUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0);
  return new Date(utcGuess - (observedLocalUtc - utcGuess));
}

function parsePrayerTime(date, value, timezone, offset = 0) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const time = dateAtZone(date, Number(match[1]), Number(match[2]), timezone);
  return new Date(time.getTime() + Number(offset || 0) * 60000);
}

function getPrayerTimes(date, settings = DEFAULT_PRAYER_SETTINGS) {
  const prayerSettings = normalizePrayerSettings(settings);
  const solar = SunCalc.getTimes(date, prayerSettings.latitude, prayerSettings.longitude);
  const sunrise = solar.sunrise || new Date(date.setHours(5, 30, 0, 0));
  const sunset = solar.sunset || new Date(date.setHours(18, 45, 0, 0));
  const noon = solar.solarNoon || new Date((sunrise.getTime() + sunset.getTime()) / 2);
  const afternoonRatio = prayerSettings.asrMethod === '1' ? 0.68 : 0.58;
  const asr = new Date(noon.getTime() + (sunset.getTime() - noon.getTime()) * afternoonRatio);
  const fallback = {
    Fajr: solar.dawn || new Date(sunrise.getTime() - 90 * 60000),
    Sunrise: sunrise,
    Dhuhr: new Date(noon.getTime() + 5 * 60000),
    Asr: asr,
    Maghrib: sunset,
    Isha: solar.night || new Date(sunset.getTime() + 90 * 60000)
  };
  return Object.entries(fallback).map(([name, time]) => ({
    name,
    time: new Date(time.getTime() + Number(prayerSettings.offsets[name] || 0) * 60000),
    fallback: true
  }));
}

function nextPrayer(now, prayerTimes = getPrayerTimes(now), prayerSettings = DEFAULT_PRAYER_SETTINGS) {
  const upcoming = prayerTimes.find((item) => item.time > now);
  const fallbackFirst = getPrayerTimes(new Date(now.getTime() + 86400000), prayerSettings)[0];
  const target = upcoming || fallbackFirst;
  const diff = Math.max(0, target.time - now);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return { ...target, countdown: `${hours}h ${pad(minutes)}m`, minutesLeft: Math.ceil(diff / 60000) };
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTemperature(value, unit = 'celsius') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  if (unit === 'fahrenheit') return `${Math.round((numeric * 9) / 5 + 32)}F`;
  return `${Math.round(numeric)}C`;
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

function commandNeedsBedroomContext(command) {
  return BEDROOM_CONTEXT_PATTERN.test(String(command || ''));
}

function normalizeBedroomAssistantReading(payload, source = 'live') {
  const data = payload?.data || payload || {};
  const temperatureC = data.temperature_c == null ? null : Number(data.temperature_c);
  const humidityPercent = data.humidity_percent == null ? null : Number(data.humidity_percent);
  const wifiDbm = data.wifi_dbm == null ? null : Number(data.wifi_dbm);
  return {
    available: Number.isFinite(temperatureC) || Number.isFinite(humidityPercent),
    temperatureC: Number.isFinite(temperatureC) ? temperatureC : null,
    humidityPercent: Number.isFinite(humidityPercent) ? humidityPercent : null,
    wifiDbm: Number.isFinite(wifiDbm) ? wifiDbm : null,
    source,
    fetchedAt: Number(payload?.fetched_at || payload?.cached_at || Date.now() / 1000),
    error: payload?.error || ''
  };
}

function cachedBedroomAssistantReading() {
  try {
    const cached = JSON.parse(localStorage.getItem(ESP32_CACHE_KEY) || 'null');
    const reading = normalizeBedroomAssistantReading(cached, 'cached');
    return reading.available ? reading : null;
  } catch {
    return null;
  }
}

async function fetchBedroomAssistantReading() {
  try {
    const response = await fetch(`${DEVICE_API_BASE}/api/bedroom/sensor?assistant=${Date.now()}`, {
      cache: 'no-store',
      signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(7500) : undefined
    });
    const payload = await readJsonResponse(response, 'Bedroom ESP32 reading failed');
    const live = normalizeBedroomAssistantReading(payload, 'live');
    if (payload.ok && live.available) {
      localStorage.setItem(ESP32_CACHE_KEY, JSON.stringify({ ...payload, cached_at: Date.now() }));
      return live;
    }
    const cached = cachedBedroomAssistantReading();
    if (cached) return { ...cached, error: payload.error || 'ESP32 is offline; using the last saved reading.' };
    return { ...live, source: 'offline', error: payload.error || 'ESP32 is offline and no saved reading is available.' };
  } catch (error) {
    const cached = cachedBedroomAssistantReading();
    if (cached) return { ...cached, error: error?.message || 'ESP32 is offline; using the last saved reading.' };
    return {
      available: false,
      temperatureC: null,
      humidityPercent: null,
      wifiDbm: null,
      source: 'offline',
      fetchedAt: Date.now() / 1000,
      error: error?.message || 'ESP32 is offline and no saved reading is available.'
    };
  }
}

function bedroomAssistantContextLine(reading) {
  if (!reading?.available) return `Bedroom ESP32: unavailable (${reading?.error || 'no live or cached reading'}). Do not invent a room temperature.`;
  const parts = [];
  if (reading.temperatureC != null) parts.push(`${reading.temperatureC.toFixed(1)}C`);
  if (reading.humidityPercent != null) parts.push(`${reading.humidityPercent.toFixed(1)}% humidity`);
  if (reading.wifiDbm != null) parts.push(`Wi-Fi ${Math.round(reading.wifiDbm)} dBm`);
  return `Bedroom ESP32 (${reading.source}): ${parts.join(', ')}.`;
}

function bedroomAssistantReply(reading) {
  if (!reading?.available) return `I cannot read the bedroom ESP32 right now. ${reading?.error || 'Connect the kiosk and ESP32 to SALIM1-5G, then try again.'}`;
  const parts = [];
  if (reading.temperatureC != null) parts.push(`the room temperature is ${reading.temperatureC.toFixed(1)} degrees Celsius`);
  if (reading.humidityPercent != null) parts.push(`humidity is ${reading.humidityPercent.toFixed(1)} percent`);
  const source = reading.source === 'live' ? 'live from the ESP32' : 'from the last saved ESP32 reading';
  return `${parts.join(' and ')}. This reading is ${source}.`;
}

function buildAssistantLivePrompt(command, { assistantSettings, locationSettings, weather, now, timeFormat, browserLocation, bedroomReading }) {
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
    `Reply language mode: ${assistantSettings?.replyLanguage || 'both'} (en = English, ar = Arabic, both = English plus Arabic).`,
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
    `- ${bedroomAssistantContextLine(bedroomReading)}`,
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
    id: widget?.id || projectId(`widget-${index}`),
    title: String(widget?.title || 'Custom widget').slice(0, 42),
    value: String(widget?.value || '--').slice(0, 64),
    detail: String(widget?.detail || '').slice(0, 80),
    type: WIDGET_TYPES.some((type) => type.id === widget?.type) ? widget.type : 'note',
    accent: WIDGET_ACCENTS.includes(widget?.accent) ? widget.accent : 'green',
    placement: typeof widget?.placement === 'string' && widget.placement.trim() ? widget.placement : 'weather',
    order: Number.isFinite(Number(widget?.order)) ? Number(widget.order) : ((index + 1) * 1000),
    locked: Boolean(widget?.locked)
  };
}

function normalizeSection(section, index = 0) {
  const fallbackTitle = `Section ${index + 1}`;
  const title = String(section?.title || fallbackTitle).trim().slice(0, 32) || fallbackTitle;
  const id = String(section?.id || projectId(`section-${index}`)).replace(/[^a-zA-Z0-9_-]/g, '-');
  return {
    id,
    title,
    detail: String(section?.detail || 'Custom dashboard section').trim().slice(0, 80),
    order: Number.isFinite(Number(section?.order)) ? Number(section.order) : ((index + 1) * 1000)
  };
}

function useCustomSections() {
  const [sections, setSections] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_SECTIONS_KEY));
      return Array.isArray(saved) ? withUniqueIds(saved.map(normalizeSection), 'section') : [];
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
    link: { title: 'Quick link', value: 'https://example.com', detail: 'Tap to open', type: 'link', accent: 'green' },
    embed: { title: 'Embedded page', value: 'https://example.com', detail: 'Loads inside your dashboard', type: 'embed', accent: 'blue' }
  };
  return normalizeWidget({ ...templates[typeId], id: projectId('widget'), placement });
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
      return Array.isArray(saved) ? withUniqueIds(saved.map(normalizeWidget), 'widget') : defaultCustomWidgets();
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
      return Array.isArray(saved) ? pruneDeletedWidgets(withUniqueIds(saved.map((widget) => ({ ...normalizeWidget(widget), deletedAt: widget.deletedAt || Date.now() })), 'deleted-widget')) : [];
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
      if (Array.isArray(saved) && saved.length) return withUniqueIds(saved, 'alarm');
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
    const nextAlarm = { id: projectId('alarm'), time: cleanTime, enabled: true, repeat, sound, soundUrl };
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
  if (type === 'embed') return ExternalLink;
  if (type === 'number') return Clock3;
  return Bell;
}

function WidgetTile({ widget, onRemove, onToggleLock, onEdit, draggable = false, onDragStart, dragHandleProps = null }) {
  const Icon = widget.Icon || widgetIcon(widget.type);
  const meterValue = widget.type === 'meter' ? Math.max(0, Math.min(100, Number(widget.value) || 0)) : 0;
  const isLink = widget.type === 'link' && /^https?:\/\//i.test(widget.value);
  const isEmbed = widget.type === 'embed' && /^https?:\/\//i.test(widget.value);

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
            {onEdit && <button type="button" onClick={() => onEdit(widget.id)} aria-label={`Edit ${widget.title}`}><Settings size={15} /></button>}
            {onRemove && <button type="button" onClick={() => onRemove(widget.id)} aria-label={`Remove ${widget.title}`}><Trash2 size={15} /></button>}
          </div>
        )}
      </div>
      {isEmbed ? (
        <div className="widget-embed">
          <iframe title={widget.title} src={widget.value} loading="lazy" referrerPolicy="no-referrer" />
          <a href={widget.value} target="_blank" rel="noreferrer">Open embed <ExternalLink size={14} /></a>
        </div>
      ) : isLink ? (
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
    { id: 'prayer', title: 'Next prayer', value: `${prayer.name} ${prayer.countdown}`, detail: 'Selected prayer calculation', type: 'note', accent: 'green', Icon: Moon },
    { id: 'alarm', title: 'Alarm', value: formatAlarmLabel(alarm, timeFormat), detail: 'Saved on this kiosk', type: 'number', accent: 'blue', Icon: AlarmClock },
    { id: 'storage', title: 'Storage free', value: `${storageFree} GB`, detail: `${system.disk?.percent ?? 0}% used`, type: 'meter', accent: system.disk?.percent > 85 ? 'red' : 'amber', Icon: HardDrive },
    { id: 'gateway', title: 'Gateway ping', value: system.pingMs == null ? '--' : `${system.pingMs} ms`, detail: system.pingMs == null ? 'Waiting for local feed' : 'Local Wi-Fi check', type: 'number', accent: system.pingMs > 45 ? 'amber' : 'green', Icon: Network },
    { id: 'moon', title: 'Moon light', value: `${moon.illumination}%`, detail: moon.phase, type: 'meter', accent: 'blue', Icon: Moon }
  ];
}

function useDashboardMasonry(gridRef) {
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return undefined;

    let frame = 0;
    const observed = new Set();
    const itemObserver = new ResizeObserver(() => scheduleLayout());

    function applyLayout() {
      frame = 0;
      const compact = window.matchMedia('(max-width: 760px)').matches;
      const style = window.getComputedStyle(grid);
      const rowHeight = Number.parseFloat(style.gridAutoRows);
      const rowGap = Number.parseFloat(style.rowGap) || 0;

      Array.from(grid.children).forEach((item) => {
        item.style.gridRowEnd = 'auto';
        if (compact || !Number.isFinite(rowHeight) || rowHeight <= 0) return;
        const height = item.getBoundingClientRect().height;
        const span = Math.max(1, Math.ceil((height + rowGap) / (rowHeight + rowGap)));
        item.style.gridRowEnd = `span ${span}`;
      });
    }

    function scheduleLayout() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applyLayout);
    }

    function observeItems() {
      Array.from(grid.children).forEach((item) => {
        if (observed.has(item)) return;
        observed.add(item);
        itemObserver.observe(item);
      });
      scheduleLayout();
    }

    const mutationObserver = new MutationObserver(observeItems);
    mutationObserver.observe(grid, { childList: true });
    window.addEventListener('resize', scheduleLayout, { passive: true });
    observeItems();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      itemObserver.disconnect();
      window.removeEventListener('resize', scheduleLayout);
    };
  }, [gridRef]);
}

function Dashboard({ now, weather, weatherUnit = 'celsius', prayer, prayerData, prayerSettings, timeFormat, alarm, customWidgets, setCustomWidgets, customSections, setCustomSections, deletedWidgets, deleteCustomWidget, toggleWidgetLock, restoreDeletedWidget, restoreAllDeletedWidgets, musicLibrary, musicPlayer, cameraWakeEnabled, setCameraWakeEnabled, cameraWakeStatus, cameraVideoRef, ambientPhase, weatherMood, dashboardTheme, sleepMode, setSleepMode, idle, noiseEnabled, setNoiseEnabled, noise, focus, roomMode, setRoomMode, focusLock, setFocusLock, battery, caffeine, assistantSettings, voiceAssistant, offlineVoice, runAssistantCommand, pushToast, locationSettings, performanceMode, setPerformanceMode, backgroundServices, setBackgroundServices, openBrainDump, openQuickControls, goClock, goSettings, goSignal, goRadar, goBedroom, goGames, goMusic, goProjects, goOllama, goRemoteCamera, goQuickAccess, goApps, goBrowser, goDashboardCustomisation, kioskSettings }) {
  const gold = useGoldPrices();
  const fuel = useFuelPrices();
  const news = useNewsFeed(backgroundServices.news);
  const system = useSystemInfo(backgroundServices.system);
  const air = useAirQuality(locationSettings, backgroundServices.weatherExtras);
  const brightnessHistory = useRoomBrightnessHistory(cameraWakeEnabled && backgroundServices.cameraSensors);
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
  const [movePanelWidgetId, setMovePanelWidgetId] = useState('');
  const hourlyRef = useRef(null);
  const dashboardRef = useRef(null);
  const dashboardGridRef = useRef(null);
  const prayers = prayerData?.times?.length ? prayerData.times : getPrayerTimes(now, prayerSettings);
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
  useDashboardMasonry(dashboardGridRef);
  const sectionById = useMemo(() => new Map(dashboardSections.map((section) => [section.id, section])), [dashboardSections]);
  const widgetsByPlacement = useMemo(() => (
    dashboardSections.reduce((groups, section) => ({
      ...groups,
      [section.id]: orderedPlacementWidgets(customWidgets, section.id)
    }), {})
  ), [customWidgets, dashboardSections]);
  const movePanelWidget = customWidgets.find((widget) => String(widget.id) === String(movePanelWidgetId)) || null;

  function addTodo(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setTodoLists({
      ...todoLists,
      [activeTodoType]: [{ id: projectId('todo'), text, done: false }, ...todos]
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
      id: projectId('section'),
      title: title.trim(),
      detail: 'Drop widgets inside this section',
      order: customSections.length ? Math.max(...customSections.map((item) => Number(item.order) || 0)) + 1000 : 1000
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

  function moveWidgetByIndex(widgetId, direction) {
    setCustomWidgets((current) => {
      const widget = current.find((item) => String(item.id) === String(widgetId));
      if (!widget) return current;
      const placement = widgetPlacement(widget);
      const ordered = orderedPlacementWidgets(current, placement);
      const index = ordered.findIndex((item) => String(item.id) === String(widgetId));
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) return current;
      return placeWidgetInDashboard(current, widget, placement, target);
    });
  }

  function moveWidgetToAdjacentSection(widgetId, direction) {
    setCustomWidgets((current) => {
      const widget = current.find((item) => String(item.id) === String(widgetId));
      if (!widget) return current;
      const fromIndex = dashboardLayoutOrder.indexOf(widgetPlacement(widget));
      const targetIndex = fromIndex + direction;
      const targetPlacement = dashboardLayoutOrder[targetIndex];
      if (!targetPlacement) return current;
      return placeWidgetInDashboard(current, widget, targetPlacement, Infinity);
    });
  }

  function duplicateDashboardWidget(widgetId) {
    setCustomWidgets((current) => {
      const widget = current.find((item) => String(item.id) === String(widgetId));
      if (!widget) return current;
      return [...current, normalizeWidget({ ...widget, id: projectId('widget'), title: `${widget.title} copy`, order: Date.now() })];
    });
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
                onEdit={(widgetId) => setMovePanelWidgetId(String(widgetId))}
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
          offlineVoice={offlineVoice}
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
              <p>{prayerData?.source || 'Prayer source'} / {prayerData?.locationName || prayerSettings.locationName}</p>
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
          <div className="tool-readout">{prayerData?.methodName || 'Selected calculation method'}{prayerData?.cached ? ' / cached while offline' : ''}{prayerData?.error ? ` / ${prayerData.error}` : ''}</div>
        </section>
      ));
    }

    if (sectionId === 'weather') {
      return renderDashboardStack('weather', (
        <>
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
                <strong>{formatTemperature(weather.temp, weatherUnit)}</strong>
              </div>
              <div>
                <span>{weatherCondition(weather.code, currentIsNight).label}</span>
                <span>Feels {formatTemperature(weather.feels, weatherUnit)}</span>
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
                  <span>{formatTemperature(hour.temp, weatherUnit)}</span>
                  <small>{weatherCondition(hour.code, isNightAt(hour.time, weather.sunrise, weather.sunset)).label}</small>
                  <small>{hour.wind} {windDirectionLabel(hour.windDirection)}</small>
                  <small>{hour.humidity}% / {hour.visibilityKm} km</small>
                </div>
              ))}
            </div>
          </section>
          <WeatherDangerPanel weather={weather} air={air} now={now} />
          <SunMoonSkyPanel now={now} weather={weather} weatherMood={weatherMood} ambientPhase={ambientPhase} moon={moon} moonTimes={moonTimes} timeFormat={timeFormat} />
        </>
      ));
    }

    if (sectionId === 'device-controls') {
      return renderDashboardStack('device-controls', <DeviceControlsPanel pushToast={pushToast} enabled={backgroundServices.system} />);
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
        <RoomSensorPanel enabled={cameraWakeEnabled} setEnabled={setCameraSensorEnabled} status={cameraWakeStatus} history={brightnessHistory} />
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

  function setCameraSensorEnabled(enabled) {
    setCameraWakeEnabled(enabled);
    if (enabled) setBackgroundServices?.({ cameraSensors: true });
  }

  return (
    <section ref={dashboardRef} className={`dashboard dashboard-theme-${dashboardTheme} phase-${ambientPhase.id} weather-${weatherMood.id} ${sleepMode ? 'sleep-mode' : ''} ${idle ? 'ambient-idle' : ''}`}>
      <header className="dash-top">
        <button className="icon-button menu-equals-button" onClick={() => setShowPageMenu((value) => !value)} aria-label="Open pages menu">=</button>
        <div>
          <h1>Project Nexora</h1>
          <span className="ambient-kicker">{ambientPhase.label} / {weatherMood.label}</span>
          <p>{locationSettings.weatherName || 'Selected location'} room kiosk / {now.toLocaleDateString('en-AE', { weekday: 'short', month: 'short', day: 'numeric' })} / swipe right for Clock</p>
        </div>
        <div className="top-actions">
          <button className={musicPlayer.playing ? 'icon-button active' : 'icon-button'} onClick={musicPlayer.togglePlay} aria-label={musicPlayer.playing ? 'Pause music' : 'Play music'} disabled={!musicPlayer.tracks.length}>
            {musicPlayer.playing ? <Pause size={21} /> : <Play size={21} />}
          </button>
          <button className={cameraWakeEnabled ? 'icon-button active' : 'icon-button'} onClick={() => setCameraSensorEnabled(!cameraWakeEnabled)} aria-label="Toggle camera wake"><Camera size={21} /></button>
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
            <button type="button" onClick={() => { setShowPageMenu(false); goDashboardCustomisation?.(); }}>
              <Gauge size={18} />
              <span>Dashboard</span>
              <em>Customisation, widgets, layout, and theme</em>
            </button>
            <button type="button" onClick={() => { setShowPageMenu(false); goQuickAccess?.(); }}>
              <Sparkles size={18} />
              <span>Quick Access</span>
              <em>Shortcuts, AI, music, and room actions</em>
            </button>
            <button type="button" onClick={() => { setShowPageMenu(false); goApps?.(); }}>
              <ExternalLink size={18} />
              <span>Most Used Apps</span>
              <em>Saved links and pinned browser shortcuts</em>
            </button>
            <button type="button" onClick={() => { setShowPageMenu(false); goBrowser?.(); }}>
              <Laptop size={18} />
              <span>Browser</span>
              <em>Fullscreen Chromium shell settings</em>
            </button>
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
            <button type="button" onClick={() => { setShowPageMenu(false); goBedroom(); }}>
              <Thermometer size={18} />
              <span>My Bedroom</span>
              <em>ESP32 Sensor Hub from 192.168.4.51 on SALIM1-5G</em>
            </button>
            <button type="button" onClick={() => { setShowPageMenu(false); goGames(); }}>
              <Gamepad2 size={18} />
              <span>Gaming</span>
              <em>30 offline local classic games</em>
            </button>
            <button type="button" onClick={() => { setShowPageMenu(false); goMusic(); }}>
              <Music2 size={18} />
              <span>Music</span>
              <em>Local folder scan, playlists, favorites, alarm music</em>
            </button>
            <button type="button" onClick={() => { setShowPageMenu(false); goProjects(); }}>
              <BookOpen size={18} />
              <span>Projects</span>
              <em>Project tabs for files, PDFs, links, code, and notes</em>
            </button>
            <button type="button" onClick={() => { setShowPageMenu(false); goOllama(); }}>
              <Sparkles size={18} />
              <span>Ollama AI</span>
              <em>Offline local models, chat, and model health</em>
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

      <main ref={dashboardGridRef} className={`dash-grid ${dashboardDragSectionId ? 'section-dragging' : ''} ${dashboardDragWidgetId || dashboardDragType ? 'widget-dragging' : ''}`}>
        {dashboardLayoutOrder.map((sectionId) => renderDashboardSection(sectionId))}
      </main>
      {movePanelWidget && (
        <aside className="widget-movement-panel" aria-label={`Move ${movePanelWidget.title}`}>
          <div className="widget-movement-heading">
            <div><strong>Move widget</strong><span>{movePanelWidget.title}</span></div>
            <button type="button" onClick={() => setMovePanelWidgetId('')} aria-label="Close widget movement panel"><X size={17} /></button>
          </div>
          <div className="widget-movement-grid">
            <button type="button" onClick={() => moveWidgetByIndex(movePanelWidget.id, -1)}>Move up</button>
            <button type="button" onClick={() => moveWidgetByIndex(movePanelWidget.id, 1)}>Move down</button>
            <button type="button" onClick={() => moveWidgetToAdjacentSection(movePanelWidget.id, -1)}>Previous section</button>
            <button type="button" onClick={() => moveWidgetToAdjacentSection(movePanelWidget.id, 1)}>Next section</button>
            <button type="button" onClick={() => duplicateDashboardWidget(movePanelWidget.id)}>Duplicate</button>
            <button type="button" onClick={() => toggleWidgetLock(movePanelWidget.id)}>{movePanelWidget.locked ? 'Unlock' : 'Lock'}</button>
            <button type="button" onClick={() => { deleteCustomWidget(movePanelWidget.id); setMovePanelWidgetId(''); }}>Delete</button>
          </div>
          <p>Use the grip on a widget for direct drag. This panel is the simpler touch-friendly alternative.</p>
        </aside>
      )}
      <QuickAccessDock
        visible={kioskSettings?.settings?.dashboard?.quickAccessVisible !== false}
        collapsed={kioskSettings?.settings?.dashboard?.quickAccessCollapsed !== false}
        apps={kioskSettings?.settings?.mostUsedApps?.items || []}
        onCollapsedChange={(quickAccessCollapsed) => kioskSettings?.updateSection('dashboard', { quickAccessCollapsed })}
        onOpenControls={openQuickControls}
        onOpenMusic={goMusic}
        onOpenSettings={goSettings}
        onOpenApps={goApps}
        onOpenAI={goOllama}
      />
    </section>
  );
}

function QuickAccessDock({ visible, collapsed, apps, onCollapsedChange, onOpenControls, onOpenMusic, onOpenSettings, onOpenApps, onOpenAI }) {
  if (!visible) return null;
  const pinned = (Array.isArray(apps) ? apps : []).map(normalizeAppShortcut).filter((app) => app.pinned).slice(0, 5);
  const actions = [
    { id: 'ai', label: 'AI', action: onOpenAI, Icon: Sparkles },
    { id: 'music', label: 'Music', action: onOpenMusic, Icon: Music2 },
    { id: 'controls', label: 'Controls', action: onOpenControls, Icon: Gauge },
    { id: 'settings', label: 'Settings', action: onOpenSettings, Icon: Settings }
  ];
  return (
    <aside className={collapsed ? 'quick-access-dock collapsed' : 'quick-access-dock'} aria-label="Quick Access">
      <button className="quick-access-toggle" type="button" onClick={() => onCollapsedChange?.(!collapsed)} aria-label={collapsed ? 'Open Quick Access' : 'Close Quick Access'}>{collapsed ? <ChevronLeft size={19} /> : <ChevronRight size={19} />}</button>
      {!collapsed && <>
        <div className="quick-access-heading"><strong>Quick Access</strong><button type="button" onClick={onOpenApps}>Edit</button></div>
        <div className="quick-access-actions">
          {actions.map(({ id, label, action, Icon }) => <button type="button" key={id} onClick={action}><Icon size={16} /><span>{label}</span></button>)}
          {pinned.map((app) => <button type="button" key={app.id} onClick={() => app.openMode === 'inside' ? window.location.assign(app.url) : window.open(app.url, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /><span>{app.name}</span></button>)}
        </div>
      </>}
    </aside>
  );
}

function OllamaAiPage({ goDashboard, assistantSettings, setAssistantSettings, pushToast }) {
  const [models, setModels] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState('Ask a local model anything, or use it to understand a kiosk request that is not built into the command router yet.');
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);

  const refreshModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/ai/models?refresh=${Date.now()}`, { cache: 'no-store' });
      const data = await readJsonResponse(response, 'Ollama model check failed');
      setModels(data);
    } catch (error) {
      setModels({ ok: false, error: error?.message || 'Ollama is unavailable.', models: [], disk_models: [] });
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  const selectedModel = chooseAssistantModel(assistantSettings, prompt);
  const availableModels = useMemo(() => [...new Set([
    ...(models?.models || []),
    ...(models?.disk_models || [])
  ])].filter(Boolean).sort(), [models]);

  async function submit(nextPrompt = prompt) {
    const cleanPrompt = String(nextPrompt || '').trim();
    if (!cleanPrompt || loading) return;
    const target = chooseAssistantModel(assistantSettings, cleanPrompt);
    setPrompt('');
    setLoading(true);
    setReply(`Using ${target.label}: ${target.model}...`);
    try {
      const bedroomReading = commandNeedsBedroomContext(cleanPrompt)
        ? await fetchBedroomAssistantReading()
        : null;
      if (bedroomReading && !bedroomReading.available) {
        setReply(bedroomAssistantReply(bedroomReading));
        return;
      }
      const contextualPrompt = bedroomReading
        ? `${cleanPrompt}\n\nLive kiosk sensor context:\n${bedroomAssistantContextLine(bedroomReading)}`
        : cleanPrompt;
      const response = await fetch(`${DEVICE_API_BASE}/api/ai/${target.tier === '4.5' ? 'hard' : 'easy'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: contextualPrompt, model: target.model })
      });
      const data = await readJsonResponse(response, 'Ollama request failed');
      const nextReply = data.reply || data.response || data.error || 'The local model returned no text.';
      setReply(nextReply);
      if (data.ok === false || data.error) pushToast('Ollama AI', nextReply, 'amber');
    } catch (error) {
      const message = error?.message || 'Ollama is unavailable. Start Ollama, then refresh models.';
      setReply(message);
      pushToast('Ollama AI offline', message, 'amber');
    } finally {
      setLoading(false);
    }
  }

  function selectTier(tier) {
    setAssistantSettings((current) => ({ ...current, modelTier: tier }));
  }

  return (
    <section className="music-page ollama-ai-page">
      <header className="gaming-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div>
          <span className="section-kicker">Local-first assistant</span>
          <h1>Ollama AI</h1>
          <p>Private chat and kiosk understanding using the models installed on this computer.</p>
        </div>
        <button className="gaming-index-link" type="button" onClick={refreshModels} disabled={loadingModels} style={{ marginRight: 76 }}>
          <RefreshCw size={18} /> Refresh models
        </button>
      </header>

      <main className="music-page-grid">
        <section className="music-hero-card assistant-panel">
          <div className="panel-heading">
            <Sparkles size={22} />
            <div>
              <h2>{assistantSettings.assistantName} local chat</h2>
              <p>Selected: {selectedModel.label} / {selectedModel.model}</p>
            </div>
          </div>
          <div className="assistant-status">
            <span className={models?.ok ? 'live' : 'cached'}>{models?.ok ? 'Ollama online' : 'Ollama offline'}</span>
            <span>{availableModels.length} detected local model{availableModels.length === 1 ? '' : 's'}</span>
            <span>{models?.url || DEVICE_API_BASE}</span>
          </div>
          <div className="assistant-reply">{reply}</div>
          <form className="assistant-command-row" onSubmit={(event) => { event.preventDefault(); submit(); }}>
            <button type="button" aria-label="Local AI chat" disabled><Sparkles size={18} /></button>
            <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask a local model, for example: explain today's weather" disabled={loading} />
            <button type="submit" aria-label="Send to Ollama" disabled={loading || !prompt.trim()}><Send size={18} /></button>
          </form>
          <div className="assistant-suggestions">
            {['What is my room temperature?', 'Summarize kiosk health', 'Explain my room weather', 'Help me plan study time', 'Open dashboard', 'Switch to auto model'].map((item) => (
              <button type="button" key={item} onClick={() => submit(item)} disabled={loading}>{item}</button>
            ))}
          </div>
        </section>

        <section className="music-side-card">
          <div className="panel-heading compact-heading">
            <Cpu size={21} />
            <div>
              <h2>Model mode</h2>
              <p>Auto picks a model from the request length and intent.</p>
            </div>
          </div>
          <div className="quick-model-switch">
            {AI_MODEL_TIERS.map((tier) => (
              <button type="button" key={tier.id} className={assistantSettings.modelTier === tier.id ? 'active' : ''} onClick={() => selectTier(tier.id)}>
                {tier.label}
              </button>
            ))}
          </div>
          <div className="model-manager-list">
            {availableModels.length ? availableModels.map((model) => (
              <div key={model}>
                <strong>{model}</strong>
                <span>{model === selectedModel.model ? 'Selected for the current mode' : 'Available locally'}</span>
                <em>Stored on this kiosk</em>
              </div>
            )) : (
              <div>
                <strong>No running models found</strong>
                <span>Ollama may be stopped, or the model library is not available.</span>
                <em>{models?.error || 'Refresh after starting Ollama.'}</em>
              </div>
            )}
          </div>
        </section>
      </main>
    </section>
  );
}

function MusicPage({ goDashboard, library, player }) {
  const playlistOptions = [
    { id: 'all', name: 'All tracks', count: player.allTracks.length },
    { id: 'favorites', name: 'Favorites', count: player.allTracks.filter((track) => player.favoriteFiles.has(track.file)).length },
    ...(library.playlists || []).map((playlist) => ({ id: `playlist:${playlist.name}`, name: playlist.name, count: playlist.count }))
  ];
  const currentSource = playlistOptions.find((item) => item.id === player.playlist) || playlistOptions[0];

  return (
    <section className="music-page">
      <header className="gaming-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div>
          <span className="section-kicker">Local audio center</span>
          <h1>Music</h1>
          <p>Auto-scans the KISOKE music folder, supports subfolder playlists, favorites, alarm music, and a lightweight visualizer.</p>
        </div>
        <button className="gaming-index-link music-rescan-button" type="button" onClick={library.refresh}>
          <RefreshCw size={18} />
          Rescan music
        </button>
      </header>

      <main className="music-page-grid">
        <section className="music-hero-card">
          <MusicPanel library={library} player={player} />
        </section>
        <section className="music-side-card">
          <div className="music-stat-grid">
            <div><span>Total tracks</span><strong>{player.allTracks.length}</strong></div>
            <div><span>Playlists</span><strong>{library.playlists?.length || 0}</strong></div>
            <div><span>Favorites</span><strong>{playlistOptions.find((item) => item.id === 'favorites')?.count || 0}</strong></div>
            <div><span>Alarm music</span><strong>{player.alarmTrackUrl ? 'Set' : 'None'}</strong></div>
          </div>
          <div className="music-playlist-list">
            <strong>Playlists</strong>
            {playlistOptions.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className={player.playlist === playlist.id ? 'active' : ''}
                onClick={() => player.setPlaylist(playlist.id)}
              >
                <span>{playlist.name}</span>
                <em>{playlist.count} track{playlist.count === 1 ? '' : 's'}</em>
              </button>
            ))}
          </div>
          {library.error && <div className="device-warning">{library.error}</div>}
          <p className="music-folder-hint">Folder: {library.directory || 'music'} / Last scan: {library.fetchedAt ? new Date(library.fetchedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) : 'waiting'}</p>
        </section>
        <section className="music-track-card">
          <div className="panel-heading">
            <Music2 size={22} />
            <div>
              <h2>{currentSource?.name || 'Tracks'}</h2>
              <p>Tap a track to play. Star tracks for Favorites or set one as alarm music.</p>
            </div>
          </div>
          <div className="music-track-list">
            {player.tracks.length ? player.tracks.map((track, index) => (
              <div key={track.file} className={index === player.trackIndex ? 'active' : ''}>
                <button type="button" onClick={() => player.selectTrack(index)}>
                  {index === player.trackIndex && player.playing ? <Pause size={17} /> : <Play size={17} />}
                  <span>{track.title}</span>
                  <em>{track.playlist || track.folder || 'Root'}</em>
                </button>
                <button type="button" onClick={() => player.toggleFavorite(track.file)}>{player.favoriteFiles.has(track.file) ? 'Saved' : 'Favorite'}</button>
                <button type="button" onClick={() => player.setAlarmTrack(track.url)}>Alarm</button>
              </div>
            )) : (
              <div className="music-empty-state">
                <Music2 size={28} />
                <strong>No music found</strong>
                <span>Put audio files in the KISOKE music folder, then press Rescan music.</span>
              </div>
            )}
          </div>
        </section>
      </main>
    </section>
  );
}

function ProjectsPage({ goDashboard, pushToast }) {
  const { projects, setActiveTab, addTab, removeTab, addSection, removeSection, addItem, removeItem } = useProjects();
  const activeTab = projects.tabs.find((tab) => tab.id === projects.activeTabId) || projects.tabs[0];
  const [tabDraft, setTabDraft] = useState('');
  const [sectionDraft, setSectionDraft] = useState('');
  const [fileDraft, setFileDraft] = useState(null);
  const [savingProject, setSavingProject] = useState(false);
  const [projectStatus, setProjectStatus] = useState('');
  const [itemDraft, setItemDraft] = useState({
    sectionId: activeTab?.sections?.[0]?.id || '',
    title: '',
    type: 'link',
    value: '',
    note: ''
  });

  useEffect(() => {
    setItemDraft((current) => ({
      ...current,
      sectionId: activeTab?.sections?.some((section) => section.id === current.sectionId)
        ? current.sectionId
        : activeTab?.sections?.[0]?.id || ''
    }));
  }, [activeTab?.id, activeTab?.sections]);

  function submitTab(event) {
    event.preventDefault();
    const title = tabDraft.trim();
    if (!title) return;
    fireProjectFolderCreate('/api/projects/tab', { title });
    addTab(title);
    setProjectStatus(`Created folder for ${title}.`);
    setTabDraft('');
  }

  function submitSection(event) {
    event.preventDefault();
    if (!activeTab) return;
    const title = sectionDraft.trim();
    if (!title) return;
    fireProjectFolderCreate('/api/projects/section', { tabTitle: activeTab.title, sectionTitle: title });
    addSection(activeTab.id, title);
    setProjectStatus(`Created ${activeTab.title}\\${title}.`);
    setSectionDraft('');
  }

  async function submitItem(event) {
    event.preventDefault();
    if (!activeTab || !itemDraft.sectionId) return;
    const form = event.currentTarget;
    const section = activeTab.sections.find((item) => item.id === itemDraft.sectionId) || activeTab.sections[0];
    const file = fileDraft;
    const title = itemDraft.title.trim() || file?.name || '';
    if (!title) return;

    setSavingProject(true);
    try {
      const uploadPayload = file ? {
        fileName: file.name,
        dataUrl: await fileToDataUrl(file),
        mime: file.type || 'application/octet-stream'
      } : {};
      const saved = await saveProjectRecord({
        ...itemDraft,
        ...uploadPayload,
        title,
        tabTitle: activeTab.title,
        sectionTitle: section?.title || 'General'
      });
      addItem(activeTab.id, itemDraft.sectionId, {
        ...itemDraft,
        title,
        value: saved.url || saved.relativePath || itemDraft.value,
        note: itemDraft.note,
        localPath: saved.localPath,
        url: saved.url,
        fileName: saved.fileName,
        savedAt: Date.now()
      });
      setProjectStatus(`Saved copy to Projects\\${saved.tabFolder}\\${saved.sectionFolder}\\${saved.fileName}.`);
      pushToast?.('Project saved', `${title} copied into ${saved.tabFolder}\\${saved.sectionFolder}.`, 'green');
      setFileDraft(null);
      form.reset();
      setItemDraft((current) => ({ ...current, title: '', value: '', note: '' }));
    } catch (error) {
      const message = error.message || 'Project save failed.';
      setProjectStatus(message);
      pushToast?.('Project save failed', message, 'red');
    } finally {
      setSavingProject(false);
    }
  }

  return (
    <section className="projects-page">
      <header className="gaming-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div>
          <span className="section-kicker">Local project organizer</span>
          <h1>Projects</h1>
          <p>Add Arduino, ESP32, PDF, file, link, code, and note sections. Copies save into KISOKE\Projects by tab.</p>
        </div>
        <form className="project-add-tab" onSubmit={submitTab}>
          <input value={tabDraft} onChange={(event) => setTabDraft(event.target.value)} placeholder="New tab" />
          <button type="submit"><Plus size={16} /> Tab</button>
        </form>
      </header>

      <main className="projects-layout">
        <aside className="project-tabs">
          {projects.tabs.map((tab) => (
            <button key={tab.id} type="button" className={activeTab?.id === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
              <BookOpen size={18} />
              <span>{tab.title}</span>
              <em>{tab.sections.reduce((count, section) => count + section.items.length, 0)} items</em>
            </button>
          ))}
        </aside>

        <section className="project-workspace">
          <div className="project-toolbar">
            <div>
              <strong>{activeTab?.title || 'Projects'}</strong>
              <span>{activeTab?.sections?.length || 0} section{activeTab?.sections?.length === 1 ? '' : 's'} / folder: Projects\{activeTab?.title || 'Projects'}</span>
            </div>
            {activeTab && projects.tabs.length > 1 && (
              <button type="button" className="danger-lite" onClick={() => removeTab(activeTab.id)}><X size={16} /> Delete tab</button>
            )}
          </div>
          {projectStatus && <p className="project-save-status">{projectStatus}</p>}

          <div className="project-forms">
            <form onSubmit={submitSection}>
              <input value={sectionDraft} onChange={(event) => setSectionDraft(event.target.value)} placeholder="New section, example ESP32 code" />
              <button type="submit"><Plus size={16} /> Section</button>
            </form>
            <form onSubmit={submitItem}>
              <input value={itemDraft.title} onChange={(event) => setItemDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Item title" />
              <select value={itemDraft.type} onChange={(event) => setItemDraft((current) => ({ ...current, type: event.target.value }))}>
                <option value="link">Link</option>
                <option value="pdf">PDF</option>
                <option value="file">File</option>
                <option value="code">Code note</option>
                <option value="note">Note</option>
              </select>
              <select value={itemDraft.sectionId} onChange={(event) => setItemDraft((current) => ({ ...current, sectionId: event.target.value }))}>
                {(activeTab?.sections || []).map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
              </select>
              <input value={itemDraft.value} onChange={(event) => setItemDraft((current) => ({ ...current, value: event.target.value }))} placeholder="URL, file path, PDF path, or code snippet" />
              <input value={itemDraft.note} onChange={(event) => setItemDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" />
              <label className="project-file-picker">
                <input
                  type="file"
                  accept={itemDraft.type === 'pdf' ? 'application/pdf,.pdf' : undefined}
                  onChange={(event) => setFileDraft(event.target.files?.[0] || null)}
                />
                <span>{fileDraft ? fileDraft.name : 'Choose file'}</span>
              </label>
              <button type="submit" disabled={savingProject}><Plus size={16} /> {savingProject ? 'Saving...' : 'Add item'}</button>
            </form>
          </div>

          <div className="project-section-grid">
            {(activeTab?.sections || []).map((section) => (
              <section key={section.id} className="project-section-card">
                <header>
                  <div>
                    <strong>{section.title}</strong>
                    <span>{section.items.length} item{section.items.length === 1 ? '' : 's'}</span>
                  </div>
                  {activeTab.sections.length > 1 && (
                    <button type="button" onClick={() => removeSection(activeTab.id, section.id)} aria-label={`Delete ${section.title}`}><X size={16} /></button>
                  )}
                </header>
                <div className="project-item-list">
                  {section.items.length ? section.items.map((item) => {
                    const isUrl = /^https?:\/\//i.test(item.value);
                    return (
                      <article key={item.id} className={`project-item ${item.type}`}>
                        <div>
                          <span>{item.type}</span>
                          <strong>{item.title}</strong>
                          {(item.url || item.value) && ((item.url || isUrl)
                            ? <a href={item.url || item.value} target="_blank" rel="noreferrer">{item.fileName || item.value}</a>
                            : null)}
                          {item.value && !item.url && !isUrl
                            ? <code>{item.value}</code>
                            : null}
                          {item.localPath && <code>{item.localPath}</code>}
                          {item.note && <em>{item.note}</em>}
                        </div>
                        <button type="button" onClick={() => removeItem(activeTab.id, section.id, item.id)} aria-label={`Delete ${item.title}`}><X size={16} /></button>
                      </article>
                    );
                  }) : <p className="panel-empty">No items yet. Add files, links, PDFs, code notes, or sections above.</p>}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
    </section>
  );
}

function GamingPage({ goDashboard }) {
  const groupedGames = useMemo(() => GAME_LIBRARY.reduce((groups, game) => {
    const key = game.type || 'Classic';
    return { ...groups, [key]: [...(groups[key] || []), game] };
  }, {}), []);

  return (
    <section className="gaming-page">
      <header className="gaming-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div>
          <span className="section-kicker">Offline local arcade</span>
          <h1>Gaming</h1>
          <p>Classic games stored in the KISOKE <strong>GAME</strong> folder. No internet, no accounts, no cloud.</p>
        </div>
        <a className="gaming-index-link" href="/GAME/index.html">
          <Gamepad2 size={18} />
          Open game folder
        </a>
      </header>

      <main className="gaming-layout">
        <section className="gaming-hero">
          <Gamepad2 size={34} />
          <div>
            <h2>{GAME_LIBRARY.length} playable classics</h2>
            <p>Every game is a separate HTML file. Most include Player vs AI and 2-player local modes with keyboard, mouse, or touch controls.</p>
          </div>
          <div className="game-mode-pills">
            <span>Offline</span>
            <span>AI vs P1</span>
            <span>2 Player</span>
            <span>Touch ready</span>
          </div>
        </section>

        {Object.entries(groupedGames).map(([group, games]) => (
          <section className="game-group" key={group}>
            <div className="game-group-heading">
              <h2>{group}</h2>
              <span>{games.length} games</span>
            </div>
            <div className="game-library-grid">
              {games.map((game, index) => (
                <a className="game-card" href={`/GAME/${game.id}.html`} key={game.id}>
                  <span className="game-number">{String(index + 1).padStart(2, '0')}</span>
                  <strong>{game.title}</strong>
                  <em>{game.detail}</em>
                  <small><ExternalLink size={14} /> Open {game.type.toLowerCase()} game</small>
                </a>
              ))}
            </div>
          </section>
        ))}
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

function MyBedroomPage({ now, goDashboard }) {
  const [bedroom, setBedroom] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(ESP32_CACHE_KEY));
      if (cached?.data) {
        return { loading: false, ok: false, cached: true, ...cached, error: cached.error || 'Showing last good ESP32 reading.' };
      }
    } catch {
      // Ignore corrupt ESP32 cache.
    }
    return { loading: true, ok: false, data: {}, error: '' };
  });
  const [matrixPixels, setMatrixPixels] = useState(() => Array.from({ length: 64 }, () => false));
  const [matrixStatus, setMatrixStatus] = useState('');
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [photoSlot, setPhotoSlot] = useState(1);
  const [screenStatus, setScreenStatus] = useState('');
  const [screenLoading, setScreenLoading] = useState(false);
  const [screenTouched, setScreenTouched] = useState(false);
  const [screenConfig, setScreenConfig] = useState(() => ({
    screen_title: 'ESP32 SMART HUB',
    dashboard_bg: '#000000',
    dashboard_text: '#FFFFFF',
    dashboard_accent: '#00FF00',
    custom_title: 'CUSTOM SCREEN',
    custom_line1: 'Manual screen',
    custom_line2: 'Change this text',
    custom_line3: 'from the app',
    custom_bg: '#000000',
    custom_text: '#FFFFFF',
    custom_accent: '#00FF00'
  }));

  const refreshBedroom = useCallback(async () => {
    setBedroom((current) => ({ ...current, loading: true }));
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/bedroom/sensor?refresh=${Date.now()}`, { cache: 'no-store' });
      const data = await readJsonResponse(response, 'Bedroom ESP32 failed');
      setBedroom({ loading: false, ok: Boolean(data.ok), ...data });
      if (data.ok && data.data) {
        localStorage.setItem(ESP32_CACHE_KEY, JSON.stringify({ ...data, cached_at: Date.now() }));
      }
      return data;
    } catch (error) {
      try {
        const cached = JSON.parse(localStorage.getItem(ESP32_CACHE_KEY));
        if (cached?.data) {
          const fallback = {
            loading: false,
            ok: false,
            cached: true,
            ...cached,
            error: error.message || 'Showing cached ESP32 reading because the live sensor is offline.'
          };
          setBedroom(fallback);
          return fallback;
        }
      } catch {
        // Ignore corrupt ESP32 cache.
      }
      const fallback = {
        loading: false,
        ok: false,
        source: 'http://192.168.4.51/',
        wifi_name: 'SALIM1-5G',
        data: {},
        error: error.message || 'Bedroom ESP32 is offline.'
      };
      setBedroom(fallback);
      return fallback;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const schedule = (delay) => {
      timer = window.setTimeout(async () => {
        const result = await refreshBedroom();
        if (!cancelled) schedule(result?.ok ? 10000 : 30000);
      }, delay);
    };
    refreshBedroom();
    schedule(30000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshBedroom]);

  const data = bedroom.data || {};
  const controls = data.controls || {};
  const currentScreenConfig = data.screen_config || null;
  const espNumber = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text || text === '--') return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  };
  const tempValue = espNumber(data.temperature_c);
  const humidityValue = espNumber(data.humidity_percent);
  const wifiValue = espNumber(data.wifi_dbm);
  const ramValue = espNumber(data.free_ram_kb);
  const temp = tempValue !== null ? `${tempValue.toFixed(1)} °C` : '--';
  const humidity = humidityValue !== null ? `${humidityValue.toFixed(1)} %` : '--';
  const wifi = wifiValue !== null ? `${wifiValue.toFixed(0)} dBm` : '--';
  const ram = ramValue !== null ? `${Math.round(ramValue)} KB` : '--';
  const hasGraphData = Boolean(data.has_24h_graph_data && tempValue !== null);
  const fetchedAt = bedroom.fetched_at ? new Date(bedroom.fetched_at * 1000).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'waiting';
  const photoSummary = data.photo_summary || `1 ${data.photo1_available ? 'ready' : 'empty'} | 2 ${data.photo2_available ? 'ready' : 'empty'} | 3 ${data.photo3_available ? 'ready' : 'empty'}`;
  const staleReading = Boolean(data.stale);
  const staleSource = data.stale_source ? ` from ${data.stale_source}` : '';

  useEffect(() => {
    if (!screenTouched && currentScreenConfig && Object.keys(currentScreenConfig).length) {
      setScreenConfig((current) => ({ ...current, ...currentScreenConfig }));
    }
  }, [currentScreenConfig, screenTouched]);

  const heartPattern = useMemo(() => ([
    0, 1, 1, 0, 0, 1, 1, 0,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    0, 1, 1, 1, 1, 1, 1, 0,
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 0, 0, 1, 1, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0
  ].map(Boolean)), []);

  function toggleMatrixPixel(index) {
    setMatrixPixels((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value));
  }

  function clearMatrix() {
    setMatrixPixels(Array.from({ length: 64 }, () => false));
    setMatrixStatus('Matrix cleared locally. Press Send to update ESP32.');
  }

  function setHeartMatrix() {
    setMatrixPixels(heartPattern);
    setMatrixStatus('Heart loaded locally. Press Send to update ESP32.');
  }

  async function sendMatrix() {
    setMatrixLoading(true);
    setMatrixStatus('Sending matrix to ESP32...');
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/bedroom/matrix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixels: matrixPixels, pattern: 'custom' })
      });
      const result = await readJsonResponse(response, 'Matrix send failed');
      setMatrixStatus(result.ok ? (result.message || 'Matrix sent.') : (result.error || 'Matrix endpoint failed.'));
    } catch (error) {
      setMatrixStatus(error.message || 'Matrix send failed because ESP32 is offline.');
    } finally {
      setMatrixLoading(false);
    }
  }

  function updateScreenConfig(key, value) {
    setScreenTouched(true);
    setScreenConfig((current) => ({ ...current, [key]: value }));
  }

  async function switchScreenMode(mode, slotOverride = photoSlot) {
    setScreenLoading(true);
    setScreenStatus(`Switching ESP32 screen to ${mode === 'photo' ? `Photo ${slotOverride}` : mode}...`);
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/bedroom/screen-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, slot: slotOverride })
      });
      const result = await readJsonResponse(response, 'Screen mode failed');
      setScreenStatus(result.ok ? (result.message || 'Screen updated.') : (result.error || 'Screen mode failed.'));
      if (result.ok) refreshBedroom();
    } catch (error) {
      setScreenStatus(error.message || 'Screen mode failed because ESP32 is offline.');
    } finally {
      setScreenLoading(false);
    }
  }

  async function saveScreenCustomization(show = false) {
    setScreenLoading(true);
    setScreenStatus(show ? 'Saving and showing custom screen...' : 'Saving screen customization...');
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/bedroom/screen-customize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screen_title: screenConfig.screen_title,
          dash_bg: screenConfig.dashboard_bg,
          dash_text: screenConfig.dashboard_text,
          dash_accent: screenConfig.dashboard_accent,
          custom_title: screenConfig.custom_title,
          line1: screenConfig.custom_line1,
          line2: screenConfig.custom_line2,
          line3: screenConfig.custom_line3,
          custom_bg: screenConfig.custom_bg,
          custom_text: screenConfig.custom_text,
          custom_accent: screenConfig.custom_accent,
          show
        })
      });
      const result = await readJsonResponse(response, 'Screen customization failed');
      setScreenStatus(result.ok ? (result.message || 'Screen customization saved.') : (result.error || 'Screen customization failed.'));
      if (result.ok) {
        setScreenTouched(false);
        refreshBedroom();
      }
    } catch (error) {
      setScreenStatus(error.message || 'Screen customization failed because ESP32 is offline.');
    } finally {
      setScreenLoading(false);
    }
  }

  async function uploadScreenImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setUploadStatus(`Preparing ${file.name}...`);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.readAsDataURL(file);
      });
      const dataBase64 = dataUrl.split(',')[1] || '';
      const response = await fetch(`${DEVICE_API_BASE}/api/bedroom/screen-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          data_base64: dataBase64,
          slot: photoSlot
        })
      });
      const result = await readJsonResponse(response, 'Screen upload failed');
      setUploadStatus(result.ok ? (result.message || 'Image uploaded to screen.') : (result.error || 'ESP32 upload endpoint failed.'));
      if (result.ok) refreshBedroom();
    } catch (error) {
      setUploadStatus(error.message || 'Image upload failed because ESP32 is offline.');
    } finally {
      setUploadLoading(false);
      event.target.value = '';
    }
  }

  return (
    <section className="bedroom-page">
      <header className="signal-top bedroom-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div>
          <h1>My Bedroom</h1>
          <p>ESP32 Sensor Hub from <strong>{bedroom.source || 'http://192.168.4.51/'}</strong> via {bedroom.wifi_name || 'SALIM1-5G'}.</p>
        </div>
        <div className="signal-top-actions">
          <button type="button" onClick={refreshBedroom}><RefreshCw size={17} /> Refresh</button>
          <a href="http://192.168.4.51/" target="_blank" rel="noreferrer"><ExternalLink size={17} /> ESP32 page</a>
        </div>
      </header>

      <main className="bedroom-grid">
        <section className={bedroom.ok ? 'bedroom-hero online' : 'bedroom-hero offline'}>
          <div>
            <span>{bedroom.ok ? (staleReading ? 'ESP32 cached reading' : 'ESP32 online') : 'ESP32 offline'}</span>
            <h2>{data.title || 'ESP32 Sensor Hub'}</h2>
            <p>{bedroom.ok ? (staleReading ? `Showing last good reading${staleSource}. ESP32 was slow ${data.stale_age_seconds || 0}s ago.` : `Live sensor update at ${fetchedAt}`) : (bedroom.error || `Could not reach the ESP32. Connect this laptop to ${bedroom.wifi_name || 'SALIM1-5G'} or check power.`)}</p>
          </div>
          <strong>{bedroom.ok ? (staleReading ? 'CACHED' : 'LIVE') : 'OFFLINE'}</strong>
        </section>

        <section className="bedroom-stat-card temp">
          <Thermometer size={30} />
          <span>Temperature</span>
          <strong>{temp}</strong>
          <em>Bedroom air</em>
        </section>
        <section className="bedroom-stat-card humidity">
          <Droplets size={30} />
          <span>Humidity</span>
          <strong>{humidity}</strong>
          <em>Room moisture</em>
        </section>
        <section className="bedroom-stat-card wifi">
          <Wifi size={30} />
          <span>ESP32 Wi-Fi</span>
          <strong>{wifi}</strong>
          <em>{data.wifi_quality || (bedroom.ok ? 'RSSI not reported' : 'offline')}</em>
        </section>
        <section className="bedroom-stat-card uptime">
          <Cpu size={30} />
          <span>ESP32 uptime</span>
          <strong>{data.uptime || '--'}</strong>
          <em>Free RAM: {ram}</em>
        </section>

        <section className="bedroom-panel">
          <div className="panel-heading">
            <Gauge size={22} />
            <div>
              <h2>24h Temperature Graph</h2>
              <p>{hasGraphData ? 'ESP32 reports graph data available.' : 'No data for last 24 hours.'}</p>
            </div>
          </div>
          <div className={hasGraphData ? 'bedroom-graph-line active' : 'bedroom-graph-line'}>
            <span />
          </div>
        </section>

        <section className="bedroom-panel">
          <div className="panel-heading">
            <Target size={22} />
            <div>
              <h2>ESP32 Features</h2>
              <p>Detected features from the ESP32 page. Controls below proxy through the local backend.</p>
            </div>
          </div>
          <div className="bedroom-feature-grid">
            <span className={data.matrix_editor ? 'active' : ''}>8x8 Matrix Editor <strong>{data.matrix_editor ? 'ready' : 'missing'}</strong></span>
            <span className={data.screen_upload ? 'active' : ''}>ST7789 Upload <strong>{data.screen_upload ? 'ready' : 'missing'}</strong></span>
            <span className={controls.buzzer ? 'active' : ''}>Buzzer <strong>{controls.buzzer ? 'ready' : 'missing'}</strong></span>
            <span className={controls.ir_ac1 ? 'active' : ''}>IR AC1 <strong>{controls.ir_ac1 ? 'ready' : 'missing'}</strong></span>
          </div>
        </section>

        <section className="bedroom-panel bedroom-screen-panel">
          <div className="panel-heading">
            <Camera size={22} />
            <div>
              <h2>ST7789 Screen</h2>
              <p>Current screen: {data.screen_mode || '--'} / Photo slots: {photoSummary}</p>
            </div>
          </div>
          <div className="bedroom-screen-status-grid">
            <span>Mode <strong>{data.screen_mode || '--'}</strong></span>
            <span>Photo 1 <strong>{data.photo1_available ? 'ready' : 'empty'}</strong></span>
            <span>Photo 2 <strong>{data.photo2_available ? 'ready' : 'empty'}</strong></span>
            <span>Photo 3 <strong>{data.photo3_available ? 'ready' : 'empty'}</strong></span>
          </div>
          <div className="bedroom-action-row bedroom-screen-actions">
            <button type="button" onClick={() => switchScreenMode('dashboard')} disabled={screenLoading}>Dashboard</button>
            <button type="button" onClick={() => switchScreenMode('custom')} disabled={screenLoading}>Custom</button>
            <button type="button" onClick={() => switchScreenMode('photo', 1)} disabled={screenLoading}>Photo 1</button>
            <button type="button" onClick={() => switchScreenMode('photo', 2)} disabled={screenLoading}>Photo 2</button>
            <button type="button" onClick={() => switchScreenMode('photo', 3)} disabled={screenLoading}>Photo 3</button>
          </div>
          <div className="bedroom-form-grid">
            <label>
              Dashboard title
              <input type="text" maxLength={23} value={screenConfig.screen_title} onChange={(event) => updateScreenConfig('screen_title', event.target.value)} />
            </label>
            <label>
              Dashboard background
              <input type="color" value={screenConfig.dashboard_bg} onChange={(event) => updateScreenConfig('dashboard_bg', event.target.value)} />
            </label>
            <label>
              Dashboard text
              <input type="color" value={screenConfig.dashboard_text} onChange={(event) => updateScreenConfig('dashboard_text', event.target.value)} />
            </label>
            <label>
              Dashboard accent
              <input type="color" value={screenConfig.dashboard_accent} onChange={(event) => updateScreenConfig('dashboard_accent', event.target.value)} />
            </label>
            <label>
              Custom title
              <input type="text" maxLength={23} value={screenConfig.custom_title} onChange={(event) => updateScreenConfig('custom_title', event.target.value)} />
            </label>
            <label>
              Custom line 1
              <input type="text" maxLength={31} value={screenConfig.custom_line1} onChange={(event) => updateScreenConfig('custom_line1', event.target.value)} />
            </label>
            <label>
              Custom line 2
              <input type="text" maxLength={31} value={screenConfig.custom_line2} onChange={(event) => updateScreenConfig('custom_line2', event.target.value)} />
            </label>
            <label>
              Custom line 3
              <input type="text" maxLength={31} value={screenConfig.custom_line3} onChange={(event) => updateScreenConfig('custom_line3', event.target.value)} />
            </label>
            <label>
              Custom background
              <input type="color" value={screenConfig.custom_bg} onChange={(event) => updateScreenConfig('custom_bg', event.target.value)} />
            </label>
            <label>
              Custom text
              <input type="color" value={screenConfig.custom_text} onChange={(event) => updateScreenConfig('custom_text', event.target.value)} />
            </label>
            <label>
              Custom accent
              <input type="color" value={screenConfig.custom_accent} onChange={(event) => updateScreenConfig('custom_accent', event.target.value)} />
            </label>
          </div>
          <div className="bedroom-action-row">
            <button type="button" onClick={() => saveScreenCustomization(false)} disabled={screenLoading}>Save customization</button>
            <button type="button" onClick={() => saveScreenCustomization(true)} disabled={screenLoading}>Save + show custom</button>
            <button type="button" onClick={refreshBedroom}>Reload ESP32 data</button>
          </div>
          <div className="bedroom-status-line">{screenStatus || 'Ready. Changes are manual; the ESP32 will not auto-rotate screens.'}</div>
        </section>

        <section className="bedroom-panel bedroom-matrix-panel">
          <div className="panel-heading">
            <Gauge size={22} />
            <div>
              <h2>8x8 Matrix Editor</h2>
              <p>Tap pixels, then send the pattern to the ESP32 LED matrix.</p>
            </div>
          </div>
          <div className="matrix-editor-grid" aria-label="8 by 8 LED matrix editor">
            {matrixPixels.map((active, index) => (
              <button
                type="button"
                key={index}
                className={active ? 'active' : ''}
                onClick={() => toggleMatrixPixel(index)}
                aria-label={`Pixel ${index + 1} ${active ? 'on' : 'off'}`}
              />
            ))}
          </div>
          <div className="bedroom-action-row">
            <button type="button" onClick={clearMatrix}>Clear</button>
            <button type="button" onClick={setHeartMatrix}>Heart</button>
            <button type="button" onClick={sendMatrix} disabled={matrixLoading}>{matrixLoading ? 'Sending...' : 'Send to Matrix'}</button>
          </div>
          <div className="bedroom-status-line">{matrixStatus || 'Ready. If the ESP32 is offline, send will show a clean error.'}</div>
        </section>

        <section className="bedroom-panel bedroom-upload-panel">
          <div className="panel-heading">
            <Camera size={22} />
            <div>
              <h2>Upload Picture to ST7789</h2>
              <p>Choose an image locally. KISOKE sends it to the ESP32 screen through the backend.</p>
            </div>
          </div>
          <div className="bedroom-upload-options">
            <label>
              Photo slot
              <select value={photoSlot} onChange={(event) => setPhotoSlot(Number(event.target.value))}>
                <option value={1}>Photo 1</option>
                <option value={2}>Photo 2</option>
                <option value={3}>Photo 3</option>
              </select>
            </label>
            <button type="button" onClick={() => switchScreenMode('photo', photoSlot)} disabled={screenLoading}>Show Photo {photoSlot}</button>
          </div>
          <label className="bedroom-file-upload">
            <input type="file" accept="image/*" onChange={uploadScreenImage} disabled={uploadLoading} />
            <span>{uploadLoading ? 'Uploading...' : `Choose image for Photo ${photoSlot}`}</span>
          </label>
          <div className="bedroom-status-line">{uploadStatus || 'Image is live only if your ESP32 firmware stores it that way.'}</div>
        </section>

        <section className="bedroom-panel bedroom-debug">
          <div className="panel-heading">
            <Shield size={22} />
            <div>
              <h2>Connection</h2>
              <p>Last check {fetchedAt} / latency {bedroom.latency_ms ?? '--'} ms</p>
            </div>
          </div>
          <code>{data.connection_error_short || bedroom.error || data.connection_error || bedroom.error_detail || data.raw_text_sample || 'Waiting for ESP32 data...'}</code>
        </section>
      </main>
    </section>
  );
}

function RadarPage({ now, goDashboard, goRemoteCamera }) {
  const cameraPagePresence = useCameraPageHeartbeat(true, 'radar');
  const browserRadarVideoRef = useRef(null);
  const browserRadarCanvasRef = useRef(null);
  const browserRadarStreamRef = useRef(null);
  const browserRadarFrameRef = useRef(0);
  const browserRadarPreviousRef = useRef(null);
  const [radarFeed, setRadarFeed] = useState(null);
  const [radarLoading, setRadarLoading] = useState(true);
  const [radarError, setRadarError] = useState('');
  const [radarCameras, setRadarCameras] = useState([]);
  const [selectedRadarCamera, setSelectedRadarCamera] = useState('');
  const [radarSwitching, setRadarSwitching] = useState(false);
  const [radarCameraMessage, setRadarCameraMessage] = useState('');
  const [browserRadarEnabled, setBrowserRadarEnabled] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia));
  const [browserRadarDevices, setBrowserRadarDevices] = useState([]);
  const [selectedBrowserRadarDevice, setSelectedBrowserRadarDevice] = useState('');
  const [browserRadarMessage, setBrowserRadarMessage] = useState('');
  const [targetTrail, setTargetTrail] = useState([]);
  const network = useNetworkAccess();
  const access = networkAccessLabels(network);
  const camera = radarFeed?.camera || {};
  const motion = radarFeed?.motion || {};
  const brightness = radarFeed?.brightness || {};
  const face = radarFeed?.face || {};
  const radarLogs = Array.isArray(radarFeed?.logs) ? radarFeed.logs : [];
  const ultrasonic = radarFeed?.ultrasonic || {};
  const motionActive = Boolean(motion.motion);
  const faceActive = Boolean(face.face_detected || face.stable);
  const motionX = Number.isFinite(motion.x) ? Math.max(8, Math.min(92, motion.x * 100)) : 50;
  const motionY = Number.isFinite(motion.y) ? Math.max(8, Math.min(92, motion.y * 100)) : 50;
  const faceX = Number.isFinite(face.x) ? Math.max(8, Math.min(92, (face.x + (face.w || 0) / 2) * 100)) : 50;
  const faceY = Number.isFinite(face.y) ? Math.max(8, Math.min(92, (face.y + (face.h || 0) / 2) * 100)) : 50;
  const motionStrength = Math.round((motion.strength || 0) * 100);
  const brightnessPercent = Math.round(brightness.brightness || 0);
  const radarMeta = radarFeed?.radar || {};
  const estimatedDistanceM = Number.isFinite(Number(radarMeta.estimated_distance_m)) ? Number(radarMeta.estimated_distance_m) : null;
  const faceWidth = Number.isFinite(Number(face.w)) ? Number(face.w) : 0;
  const distanceLabel = radarMeta.distance_label || face.distance || (faceActive ? 'unknown' : 'none');
  const distanceConfidence = radarMeta.distance_confidence || (faceActive ? 'warming-up' : motionActive ? 'motion-only' : 'none');
  const distanceScore = estimatedDistanceM === null ? 0 : Math.max(0, Math.min(1, estimatedDistanceM / 4.5));
  const faceMarkerScale = faceActive
    ? distanceLabel === 'far'
      ? 1.75
      : distanceLabel === 'close'
        ? 1.35
        : 1.15
    : 1;
  const faceRangeText = estimatedDistanceM === null ? 'waiting for face' : `~${estimatedDistanceM.toFixed(1)} m`;
  const frameAgeMs = camera.last_frame_time ? Math.max(0, Date.now() - camera.last_frame_time * 1000) : null;
  const frameFresh = camera.connected && frameAgeMs !== null && frameAgeMs < 3500;
  const cameraStatus = camera.connected ? 'scanning' : radarLoading ? 'starting' : 'offline';
  const browserRadarSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const radarUsingBrowser = browserRadarEnabled && browserRadarSupported;
  const cameraOptions = radarUsingBrowser
    ? (browserRadarDevices.length ? browserRadarDevices : [{ id: '', deviceId: '', label: 'Default Chrome camera', available: true }])
    : (radarCameras.length ? radarCameras : CAMERA_DEVICE_FALLBACKS);
  const selectedCameraOption = cameraOptions.find((item) => Number(item.id) === Number(selectedRadarCamera || camera.camera_index || 0));
  const laptopDetail = camera.connected
    ? `Device ${camera.camera_index} / ${camera.width}x${camera.height} / ${camera.actual_fps || '--'} FPS`
    : radarError || camera.error || 'Camera sensor is waiting for the backend.';
  const futureModules = [
    {
      name: 'ESP32 HC-SR04 ultrasonic',
      status: 'future module',
      detail: 'Distance, direction estimate, and near-object warning will attach here when an ESP32 bridge is added.'
    },
    {
      name: 'USB camera / laptop camera',
      status: camera.connected ? 'available' : 'waiting',
      detail: radarUsingBrowser
        ? 'Radar is using Chrome camera access, so any camera visible to the browser can be selected and the stream stops when you leave this page.'
        : 'Backend OpenCV camera mode is kept as a fallback when browser camera access is not available.'
    },
    {
      name: 'Future endpoint',
      status: '/api/radar/ultrasonic',
      detail: 'ESP32 can later post distance_cm, zone, confidence, and sensor health to the local backend.'
    }
  ];
  const zoneCells = ['left', 'center-left', 'center', 'center-right', 'right'];
  const radarLevelForBrightness = useCallback((percent) => {
    if (percent <= 20) return 'very_dark';
    if (percent <= 40) return 'dark';
    if (percent <= 65) return 'dim';
    if (percent <= 85) return 'bright';
    return 'very_bright';
  }, []);

  const radarZoneForPoint = useCallback((x) => {
    if (x < 0.25) return 'left';
    if (x < 0.45) return 'center-left';
    if (x <= 0.55) return 'center';
    if (x <= 0.75) return 'center-right';
    return 'right';
  }, []);

  const refreshBrowserRadarCameras = useCallback(async () => {
    if (!browserRadarSupported) {
      setBrowserRadarMessage('Chrome camera access is not supported here.');
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          id: device.deviceId || String(index),
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
          available: true,
          source: 'browser'
        }));
      setBrowserRadarDevices(cameras);
      if (!selectedBrowserRadarDevice && cameras[0]?.deviceId) setSelectedBrowserRadarDevice(cameras[0].deviceId);
      setBrowserRadarMessage(cameras.length ? `Chrome sees ${cameras.length} camera(s).` : 'No Chrome camera devices found yet.');
    } catch (error) {
      setBrowserRadarMessage(error?.message || 'Could not list Chrome camera devices.');
    }
  }, [browserRadarSupported, selectedBrowserRadarDevice]);

  useEffect(() => {
    if (!radarUsingBrowser) return undefined;
    let cancelled = false;
    let lastProcess = 0;
    setRadarLoading(true);
    setRadarError('');

    async function startBrowserRadar() {
      try {
        if (browserRadarStreamRef.current) {
          browserRadarStreamRef.current.getTracks().forEach((track) => track.stop());
          browserRadarStreamRef.current = null;
        }
        browserRadarPreviousRef.current = null;
        const videoConstraints = {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 30 }
        };
        if (selectedBrowserRadarDevice) {
          videoConstraints.deviceId = { exact: selectedBrowserRadarDevice };
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        browserRadarStreamRef.current = stream;
        const video = browserRadarVideoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          await video.play().catch(() => {});
        }
        await refreshBrowserRadarCameras();
        setBrowserRadarMessage('Browser Radar active. Camera runs only while this page is open.');
        setRadarLoading(false);

        const processFrame = () => {
          if (cancelled || !browserRadarVideoRef.current || !browserRadarCanvasRef.current) return;
          const nowMs = Date.now();
          browserRadarFrameRef.current = window.requestAnimationFrame(processFrame);
          if (nowMs - lastProcess < 135) return;
          lastProcess = nowMs;
          const currentVideo = browserRadarVideoRef.current;
          if (!currentVideo.videoWidth || !currentVideo.videoHeight) return;
          const canvas = browserRadarCanvasRef.current;
          const width = 96;
          const height = 72;
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) return;
          context.drawImage(currentVideo, 0, 0, width, height);
          const image = context.getImageData(0, 0, width, height);
          const data = image.data;
          let brightnessTotal = 0;
          let changed = 0;
          let motionXTotal = 0;
          let motionYTotal = 0;
          const previous = browserRadarPreviousRef.current;
          const gray = new Uint8Array(width * height);
          for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
            const luma = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            gray[p] = luma;
            brightnessTotal += luma;
            if (previous && Math.abs(luma - previous[p]) > 26) {
              changed += 1;
              motionXTotal += p % width;
              motionYTotal += Math.floor(p / width);
            }
          }
          browserRadarPreviousRef.current = gray;
          const rawBrightness = Math.round(brightnessTotal / gray.length);
          const brightness = Math.round((rawBrightness / 255) * 100);
          const strength = Math.min(1, changed / 850);
          const motionDetected = changed > 45;
          const x = motionDetected ? motionXTotal / changed / width : null;
          const y = motionDetected ? motionYTotal / changed / height : null;
          const zone = motionDetected ? radarZoneForPoint(x) : 'none';
          const ts = Date.now() / 1000;
          setRadarFeed({
            ok: true,
            source: 'browser-camera',
            camera: {
              connected: true,
              camera_index: selectedBrowserRadarDevice ? 'browser-selected' : 'browser-default',
              width: currentVideo.videoWidth,
              height: currentVideo.videoHeight,
              fps: 15,
              actual_fps: 7,
              sensor_active: true,
              mode: 'browser-radar',
              last_frame_time: ts,
              error: null
            },
            motion: {
              motion: motionDetected,
              x,
              y,
              zone,
              strength: Number(strength.toFixed(2)),
              last_seen: motionDetected ? ts : null
            },
            brightness: {
              brightness,
              raw: rawBrightness,
              level: radarLevelForBrightness(brightness),
              last_updated: ts
            },
            face: {
              face_detected: false,
              stable: false,
              confidence: 0,
              position: 'not-used',
              distance: 'not-used',
              last_seen: null
            },
            radar: {
              motion_detected: motionDetected,
              motion_zone: zone,
              motion_strength: Number(strength.toFixed(2)),
              room_light: radarLevelForBrightness(brightness),
              face_presence: false,
              distance_label: motionDetected ? 'motion-only' : 'none',
              estimated_distance_m: null,
              distance_confidence: motionDetected ? 'motion-only' : 'none',
              privacy: 'browser sensor only; no recording, no identity matching'
            },
            ultrasonic: {
              connected: false,
              distance_cm: null,
              zone: 'not-connected',
              source: 'future-esp32-hc-sr04'
            },
            modules: [
              { name: 'Browser camera', connected: true, role: 'motion and brightness sensor' },
              { name: 'Backend OpenCV camera', connected: false, role: 'fallback only' },
              { name: 'ESP32 HC-SR04', connected: false, role: 'future distance sensor' }
            ],
            logs: [{ level: 'info', message: 'Browser radar sensor active', created_at: ts }]
          });
        };
        browserRadarFrameRef.current = window.requestAnimationFrame(processFrame);
      } catch (error) {
        setRadarLoading(false);
        setRadarError(error?.message || 'Browser camera unavailable.');
        setBrowserRadarMessage(error?.message || 'Browser camera unavailable.');
        setBrowserRadarEnabled(false);
      }
    }

    startBrowserRadar();
    return () => {
      cancelled = true;
      if (browserRadarFrameRef.current) window.cancelAnimationFrame(browserRadarFrameRef.current);
      browserRadarFrameRef.current = 0;
      browserRadarPreviousRef.current = null;
      if (browserRadarStreamRef.current) {
        browserRadarStreamRef.current.getTracks().forEach((track) => track.stop());
        browserRadarStreamRef.current = null;
      }
    };
  }, [radarUsingBrowser, selectedBrowserRadarDevice, refreshBrowserRadarCameras, radarLevelForBrightness, radarZoneForPoint]);

  const refreshRadarCameras = useCallback(async (force = false) => {
    try {
      const data = await fetchJsonWithBackendRecovery(
        `${DEVICE_API_BASE}/api/remote-camera/devices${force ? `?refresh=${Date.now()}` : ''}`,
        {},
        'Radar camera list failed',
        'RadarCameraDevices'
      );
      const devices = Array.isArray(data.devices) ? data.devices : [];
      setRadarCameras(devices);
      if (typeof data.selected === 'number') setSelectedRadarCamera(String(data.selected));
      setRadarCameraMessage(devices.length ? `Found ${devices.filter((item) => item.available).length}/${devices.length} camera slots.` : 'No camera list returned yet.');
    } catch (error) {
      setRadarCameras([]);
      setRadarCameraMessage(error?.message || 'Camera list unavailable.');
    }
  }, []);

  const refreshRadarFeed = useCallback(async () => {
    if (radarUsingBrowser) return;
    setRadarLoading(true);
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/radar/sensor`, { cache: 'no-store' });
      const data = await readJsonResponse(response, 'Radar sensor failed');
      setRadarFeed(data);
      setRadarError('');
      if (typeof data?.camera?.camera_index === 'number') {
        setSelectedRadarCamera(String(data.camera.camera_index));
      }
    } catch (error) {
      const message = error?.message || 'Radar sensor failed';
      setRadarError(message);
      setRadarFeed((current) => current ? { ...current, error: message } : { error: message });
      if (isBackendEmptyOrOfflineError(error)) {
        requestBackendAutostart('Radar').catch(() => {});
      }
    } finally {
      setRadarLoading(false);
    }
  }, [radarUsingBrowser]);

  const switchRadarCamera = useCallback(async (cameraIndex) => {
    const nextCamera = Math.max(0, Math.min(12, Number(cameraIndex) || 0));
    setSelectedRadarCamera(String(nextCamera));
    setRadarSwitching(true);
    setRadarCameraMessage(`Switching Radar to camera ${nextCamera}...`);
    try {
      await sendCameraPageHeartbeat('radar', true).catch(() => {});
      await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/remote-camera/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_device: nextCamera,
          camera_mode: 'sensor',
          camera_enabled: true,
          privacy_mode: false
        })
      }, 'Radar camera settings failed', `RadarCameraSettings${nextCamera}`);
      await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/local-camera/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera_index: nextCamera })
      }, 'Radar camera restart failed', `RadarCameraRestart${nextCamera}`);
      let fresh = false;
      for (let attempt = 1; attempt <= 18; attempt += 1) {
        await wait(attempt < 6 ? 450 : 850);
        const data = await fetchJsonWithBackendRecovery(
          `${DEVICE_API_BASE}/api/radar/sensor?camera=${nextCamera}&attempt=${attempt}&t=${Date.now()}`,
          {},
          'Radar sensor switch check failed',
          `RadarCameraFrame${nextCamera}`
        );
        setRadarFeed(data);
        const status = data?.camera || {};
        const selected = Number(status.camera_index);
        const frameAge = status.last_frame_time ? Date.now() - status.last_frame_time * 1000 : Infinity;
        if (selected === nextCamera && status.connected && frameAge < 4500) {
          fresh = true;
          setRadarCameraMessage(`Camera ${nextCamera} is active and sending fresh frames.`);
          break;
        }
        setRadarCameraMessage(`Waiting for camera ${nextCamera} frame... ${attempt}/18`);
      }
      if (!fresh) setRadarCameraMessage(`Camera ${nextCamera} selected, but no fresh frame yet. Try Refresh cameras or check the cable.`);
      await refreshRadarCameras(true);
    } catch (error) {
      setRadarCameraMessage(error?.message || `Camera ${nextCamera} switch failed.`);
      if (isBackendEmptyOrOfflineError(error)) requestBackendAutostart(`RadarCamera${nextCamera}`, true).catch(() => {});
    } finally {
      setRadarSwitching(false);
      refreshRadarFeed();
    }
  }, [refreshRadarCameras, refreshRadarFeed]);

  useEffect(() => {
    if (radarUsingBrowser) return undefined;
    let cancelled = false;
    async function tick() {
      if (!cancelled) await refreshRadarFeed();
    }
    refreshRadarFeed();
    const timer = window.setInterval(tick, 1250);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshRadarFeed, radarUsingBrowser]);

  useEffect(() => {
    if (radarUsingBrowser) refreshBrowserRadarCameras();
    else refreshRadarCameras();
  }, [refreshRadarCameras, refreshBrowserRadarCameras, radarUsingBrowser]);

  useEffect(() => () => {
    sendCameraPageHeartbeat('radar', false).catch(() => {});
  }, []);

  useEffect(() => {
    if (!motionActive) return;
    const point = {
      id: `${Date.now()}-${Math.round(motionX)}-${Math.round(motionY)}`,
      x: motionX,
      y: motionY,
      strength: Math.max(0.2, Math.min(1, (motion.strength || 0.2))),
      zone: motion.zone || 'motion'
    };
    setTargetTrail((current) => [point, ...current].slice(0, 8));
  }, [motionActive, motionX, motionY, motion.strength, motion.zone]);

  return (
    <section className="radar-page">
      <header className="signal-top radar-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div>
          <h1>Radar</h1>
          <p>Browser camera radar now. ESP32 + HC-SR04 ultrasonic support prepared for later.</p>
        </div>
        <div className="signal-top-actions">
          <button type="button" onClick={refreshRadarFeed}><RefreshCw size={17} /> Refresh sensor</button>
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

          <div className="radar-device-controls">
            <label>Radar camera
              <select
                value={radarUsingBrowser ? selectedBrowserRadarDevice : (selectedRadarCamera || camera.camera_index || 0)}
                onChange={(event) => {
                  if (radarUsingBrowser) setSelectedBrowserRadarDevice(event.target.value);
                  else switchRadarCamera(event.target.value);
                }}
                disabled={radarSwitching}
              >
                {cameraOptions.map((item) => (
                  <option key={item.deviceId || item.id} value={radarUsingBrowser ? (item.deviceId || item.id) : item.id}>
                    {item.label || `Device ${item.id}`}{item.available === false ? ' - unavailable' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => radarUsingBrowser ? refreshBrowserRadarCameras() : refreshRadarCameras(true)} disabled={radarSwitching}>
              <RefreshCw size={16} /> Refresh cameras
            </button>
            <button type="button" onClick={() => setBrowserRadarEnabled((value) => !value)} disabled={!browserRadarSupported}>
              <Camera size={16} /> {radarUsingBrowser ? 'Browser sensor on' : 'Use browser sensor'}
            </button>
            <span className={selectedCameraOption?.available === false ? 'camera-device-state warn' : 'camera-device-state'}>
              {radarUsingBrowser
                ? `browser / ${browserRadarMessage || 'Chrome camera sensor ready'}`
                : `${selectedCameraOption?.available === false ? 'not detected' : 'ready'} / ${radarCameraMessage || 'Camera list ready'}`}
            </span>
          </div>
          <video ref={browserRadarVideoRef} className="radar-browser-video" muted playsInline aria-hidden="true" />
          <canvas ref={browserRadarCanvasRef} className="radar-browser-canvas" aria-hidden="true" />

          <div
            className={`radar-scope ${motionActive ? 'motion-active' : ''} ${faceActive ? 'face-active' : ''} ${frameFresh ? 'frame-fresh' : 'frame-stale'}`}
            style={{
              '--motion-x': `${motionX}%`,
              '--motion-y': `${motionY}%`,
              '--face-x': `${faceX}%`,
              '--face-y': `${faceY}%`,
              '--motion-strength': `${Math.max(0.18, motionStrength / 100)}`,
              '--face-scale': faceMarkerScale,
              '--distance-score': distanceScore
            }}
          >
            <div className="radar-gridlines" />
            <div className="radar-rings" />
            <div className="radar-crosshair" />
            <div className="radar-sweep" />
            <div className="radar-degree-labels" aria-hidden="true">
              <span>0</span>
              <span>90</span>
              <span>180</span>
              <span>270</span>
            </div>
            <span className="radar-origin"><Laptop size={20} /></span>
            {targetTrail.map((point, index) => (
              <span
                key={point.id}
                className="radar-trail-dot"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  opacity: Math.max(0.12, 0.55 - index * 0.055),
                  transform: `translate(-50%, -50%) scale(${0.55 + point.strength * 0.55})`
                }}
                title={point.zone}
              />
            ))}
            <span className="radar-blip motion" title="Motion position" />
            <span className="radar-face-range" title="Approximate face distance range" />
            <span className="radar-blip face" title={`Face position / ${faceRangeText}`} />
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
              <em>{face.position || 'none'} / {distanceLabel} / no recognition</em>
            </div>
            <div>
              <span>Estimated distance</span>
              <strong>{faceRangeText}</strong>
              <em>{distanceConfidence} / face width {faceWidth ? `${Math.round(faceWidth * 100)}%` : '--'}</em>
            </div>
          </div>
          <div className="radar-distance-meter">
            <span>Near</span>
            <div><i style={{ width: `${Math.max(4, distanceScore * 100)}%` }} /></div>
            <span>Far</span>
          </div>
          <div className="radar-zone-map" aria-label="Camera motion zones">
            {zoneCells.map((zone) => (
              <span key={zone} className={motion.zone === zone ? 'active' : ''}>
                <strong>{zone}</strong>
                <em>{motion.zone === zone && motionActive ? `${motionStrength}%` : 'clear'}</em>
              </span>
            ))}
          </div>
        </section>

        <section className="radar-panel">
          <div className="panel-heading">
            <Camera size={22} />
            <div>
              <h2>Camera Sensor</h2>
              <p>Uses the selected computer, laptop, or USB camera through one shared local backend loop.</p>
            </div>
          </div>
          <div className="radar-readout-grid">
            <span>Camera <strong>{camera.connected ? 'connected' : 'offline'}</strong></span>
            <span>Device <strong>{camera.camera_index ?? 0}</strong></span>
            <span>Resolution <strong>{camera.width || '--'}x{camera.height || '--'}</strong></span>
            <span>FPS <strong>{camera.actual_fps || '--'}</strong></span>
            <span>Page clients <strong>{cameraPagePresence?.active_page_count ?? 1}</strong></span>
            <span>Frame health <strong>{frameFresh ? 'fresh' : camera.connected ? 'stale' : 'offline'}</strong></span>
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
            <strong>{ultrasonic.connected ? `${ultrasonic.distance_cm} cm` : 'waiting'}</strong>
            <em>{ultrasonic.message || 'HC-SR04 data is not connected yet.'}</em>
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
            {radarLogs.slice(0, 8).map((entry, index) => (
              <code key={`${entry.time}-${index}`}>{entry.level}: {entry.message}</code>
            ))}
            {!radarLogs.length ? <code>No camera sensor logs yet.</code> : null}
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
                {(backendCameras.length ? backendCameras : CAMERA_DEVICE_FALLBACKS).map((camera) => (
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
                {(backendCameras.length ? backendCameras : CAMERA_DEVICE_FALLBACKS).map((camera) => (
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

function AssistantPanel({ settings, voice, offlineVoice, onCommand }) {
  const [draft, setDraft] = useState('');
  const wakePhrase = settings.customWakePhrase || `Hey ${settings.assistantName}`;
  const [reply, setReply] = useState(`Say "${wakePhrase}" or tap the mic.`);
  const selectedModel = chooseAssistantModel(settings, draft);
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const secureVoiceOrigin = isMicrophoneSecureOrigin();
  const wakeModeReady = settings.voiceAssistant && settings.voiceMode === 'wake' && settings.alwaysListen;

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
        <span className={voice.listening ? 'live' : voice.armed ? 'cached' : 'warning'}>{voice.listening ? 'Listening now' : voice.armed ? 'Wake armed' : 'Voice idle'}</span>
        <span className={voice.micPermission === 'allowed' ? 'live' : 'warning'}>Mic: {voice.micPermission || 'unknown'}</span>
        <span className={secureVoiceOrigin ? 'live' : 'warning'}>{secureVoiceOrigin ? 'Secure mic page' : 'Use HTTPS or localhost'}</span>
        <span className={wakeModeReady ? 'live' : 'warning'}>{wakeModeReady ? `Wake phrase: ${wakePhrase}` : 'Wake mode not armed'}</span>
        <span>{voice.supported ? (online ? 'Chrome speech ready' : 'Text works offline; Chrome speech may not') : 'Click mic to check speech'}</span>
        <span className={offlineVoiceStatusTone(offlineVoice?.status)}>{offlineVoice?.running ? 'Vosk 24/7 running' : offlineVoice?.status?.model_present === false ? 'Vosk model missing' : 'Vosk stopped'}</span>
        <span>{selectedModel.label}: {selectedModel.model}</span>
      </div>
      {voice.error && <div className="assistant-error">{voice.error}</div>}
      {offlineVoice?.error && <div className="assistant-error compact-error">{offlineVoice.error}</div>}
      <div className="assistant-reply">{reply}</div>
      <div className="assistant-voice-actions">
        <button type="button" onClick={() => voice.armWakeWord?.()}><Mic size={15} /> Arm wake word</button>
        <button type="button" onClick={() => voice.startListening(true)}><Mic size={15} /> Press to talk</button>
        {voice.listening && <button type="button" onClick={() => voice.stopListening()}><MicOff size={15} /> Stop</button>}
        <button type="button" className={offlineVoice?.running ? 'active' : ''} onClick={() => offlineVoice?.start?.()}><Mic size={15} /> Start offline</button>
        {offlineVoice?.running && <button type="button" onClick={() => offlineVoice?.stop?.()}><MicOff size={15} /> Stop offline</button>}
      </div>
      <form className="assistant-command-row" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <button type="button" className={voice.listening ? 'active' : ''} onClick={() => voice.startListening(true)} aria-label="Start voice command">
          {voice.listening ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Ask ${settings.assistantName} or type a command`} />
        <button type="submit" aria-label="Send assistant command"><Send size={18} /></button>
      </form>
      {voice.transcript && <div className="assistant-transcript">Heard: {voice.transcript}</div>}
      {offlineVoice?.transcript && <div className="assistant-transcript">Offline heard: {offlineVoice.transcript}</div>}
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

function DeviceControlsPanel({ pushToast, enabled = true }) {
  const [tab, setTab] = useState('display');
  const [status, setStatus] = useState(null);
  const network = useNetworkAccess(enabled);
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
    if (!enabled) {
      setStatus({ ok: false, paused: true, error: 'Paused by Background Services' });
      return;
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/device/status`);
      const data = await readJsonResponse(response, 'Device command failed');
      setStatus(data);
    } catch {
      setStatus({ ok: false, error: 'Backend is not running on port 8787.' });
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStatus({ ok: false, paused: true, error: 'Paused by Background Services' });
      return () => {
        window.clearTimeout(brightnessWriteTimer.current);
        window.clearTimeout(volumeWriteTimer.current);
      };
    }
    loadStatus();
    const statusTimer = setInterval(loadStatus, 60 * 1000);
    const runtimeTimer = setInterval(loadStatus, 2 * 60 * 1000);
    return () => {
      clearInterval(statusTimer);
      clearInterval(runtimeTimer);
      window.clearTimeout(brightnessWriteTimer.current);
      window.clearTimeout(volumeWriteTimer.current);
    };
  }, [enabled, loadStatus]);

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

      {!enabled && (
        <div className="device-warning">
          Device controls are paused for speed. Turn on System stats in Settings - Performance & Background Services when you want live device controls.
        </div>
      )}

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
    ? `cd C:\\Users\\saeed\\OneDrive\\Documents\\KISOKE\npowershell -ExecutionPolicy Bypass -File .\\scripts\\install\\code-needed-to-download-windows.ps1\npowershell -ExecutionPolicy Bypass -File .\\scripts\\windows\\run_local_windows.ps1`
    : `cd ~/Documents/KISOKE\nchmod +x scripts/install/code-needed-to-download.sh\n./scripts/install/code-needed-to-download.sh\nALLOW_DEVICE_CONTROL=true bash scripts/linux/start-kiosk.sh`;
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
    ? `powershell -ExecutionPolicy Bypass -File .\\scripts\\install\\code-needed-to-download-windows.ps1\npowershell -ExecutionPolicy Bypass -File .\\scripts\\windows\\run_local_windows.ps1`
    : `chmod +x scripts/install/code-needed-to-download.sh\n./scripts/install/code-needed-to-download.sh`;
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

function ConnectionBanner({ status }) {
  const browserDown = status?.browserOnline === false;
  const backendDown = status?.backendOnline === false;
  if (!browserDown && !backendDown) return null;
  const message = browserDown
    ? 'Offline mode: Wi-Fi/browser network is disconnected.'
    : 'Backend offline: device controls, camera sensor, and local AI may not answer.';
  return (
    <div className="connection-banner" role="status">
      <WifiOff size={16} />
      <strong>{browserDown ? 'Network offline' : 'Backend offline'}</strong>
      <span>{message}</span>
      {status?.error ? <code>{status.error}</code> : null}
    </div>
  );
}

function ListeningOrb({ settings, voice, appearance = {} }) {
  if (!settings.voiceAssistant && !settings.alwaysShowOrb) return null;
  const phase = voice.phase || (voice.error ? 'error' : voice.listening ? (voice.wakeActive ? 'heard wake word' : 'listening') : 'idle');
  const label = settings.voiceMode === 'off' || !settings.voiceAssistant ? 'idle' : phase;
  const active = ['listening', 'heard wake word', 'thinking', 'speaking', 'error'].includes(label);
  if (appearance.idleBehavior === 'hidden' && !active) return null;
  const look = AI_VISUAL_LOOKS.some((item) => item.id === appearance.look) ? appearance.look : 'glass-compact';
  const motionStyle = AI_ANIMATION_STYLES.some((item) => item.id === appearance.animation) ? appearance.animation : 'ripple';
  const displayLabel = label === 'heard wake word' ? 'I heard you' : label === 'thinking' ? 'Thinking' : label === 'speaking' ? 'Speaking' : label === 'listening' ? 'Listening' : label === 'error' ? 'Voice needs attention' : 'Ready';
  return (
    <button
      className={`listening-orb ai-look-${look} ai-motion-${motionStyle} ai-position-${appearance.position || 'top-right'} ai-size-${appearance.size || 'normal'} ${voice.listening ? 'listening' : ''} ${voice.wakeActive ? 'awake' : ''} phase-${String(label).replace(/\s+/g, '-')}`}
      type="button"
      onClick={() => voice.listening ? voice.stopListening() : voice.startListening(true)}
      aria-label={voice.listening ? 'Stop listening' : 'Start listening'}
      aria-live="polite"
      style={{ '--ai-glow': `${Math.max(0, Math.min(100, Number(appearance.glow ?? 55))) / 100}` }}
    >
      <span className="assistant-visual" aria-hidden="true">
        {look === 'galaxy' && <>
          <span className="galaxy-halo" />
          <span className="galaxy-core" />
          <span className="galaxy-orbit orbit-one" />
          <span className="galaxy-orbit orbit-two" />
          <span className="galaxy-star star-one" />
          <span className="galaxy-star star-two" />
        </>}
        {look === 'glass-compact' && <>
          <span className="glass-orb-shell" />
          <span className="glass-orb-core" />
          <span className="glass-orb-shine" />
          <span className="glass-orb-ring" />
        </>}
        {look === 'siri-pill' && <>
          <span className="siri-pill-glow" />
          <span className="siri-wave"><i /><i /><i /><i /><i /></span>
        </>}
        {look === 'siri-top' && <>
          <span className="siri-top-field" />
          <span className="siri-top-orb" />
          <span className="siri-top-wave"><i /><i /><i /><i /></span>
        </>}
        {look === 'google' && <>
          <span className="google-spark google-blue" />
          <span className="google-spark google-red" />
          <span className="google-spark google-yellow" />
          <span className="google-spark google-green" />
          <span className="google-wave"><i /><i /><i /><i /></span>
        </>}
        {look === 'aurora-bar' && <>
          <span className="aurora-field" />
          <span className="aurora-orb one" />
          <span className="aurora-orb two" />
          <span className="aurora-line" />
        </>}
        {look === 'minimal-orb' && <>
          <span className="minimal-pulse" />
          <span className="minimal-core" />
        </>}
      </span>
      <span className="assistant-copy">
        <strong>{settings.assistantName}</strong>
        <small>{displayLabel}</small>
      </span>
      {appearance.showSubtitles !== false && settings.showOrbTranscript && voice.transcript && <b>{voice.transcript}</b>}
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
          <div key={goal.id} className={goal.done ? 'goal-row-panel done' : 'goal-row-panel'}>
            <button type="button" onClick={() => dailyGoals.toggleGoal(goal.id)} aria-label={`${goal.done ? 'Clear' : 'Complete'} goal ${index + 1}`}>
              <Check size={15} />
            </button>
            <input value={goal.title} onChange={(event) => dailyGoals.updateGoal(goal.id, event.target.value)} aria-label={`Goal ${index + 1}`} />
            <select value={goal.type || 'checkbox'} onChange={(event) => dailyGoals.updateGoalPatch(goal.id, { type: event.target.value })} aria-label={`Goal ${index + 1} type`}>
              <option value="checkbox">Check</option>
              <option value="number">Number</option>
              <option value="timer">Timer</option>
              <option value="habit">Habit</option>
            </select>
            {goal.type !== 'checkbox' && <input className="goal-target-input" type="number" min="1" value={goal.target} onChange={(event) => dailyGoals.updateGoalPatch(goal.id, { target: Number(event.target.value) || 1 })} aria-label={`${goal.title} target`} />}
            <button type="button" onClick={() => dailyGoals.moveGoal(goal.id, -1)} aria-label={`Move ${goal.title} up`}>Up</button>
            <button type="button" onClick={() => dailyGoals.moveGoal(goal.id, 1)} aria-label={`Move ${goal.title} down`}>Down</button>
            <button type="button" className="danger-lite" onClick={() => dailyGoals.removeGoal(goal.id)} aria-label={`Delete ${goal.title}`}><X size={14} /></button>
          </div>
        ))}
      </div>
      <div className="daily-goal-actions"><button type="button" onClick={() => dailyGoals.addGoal('New daily goal')}>Add goal</button><button type="button" className="panel-reset-button" onClick={dailyGoals.resetGoals}>Reset today</button></div>
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
  const categories = useMemo(() => ['All', ...Array.from(new Set(news.items.map((item) => item.category).filter(Boolean))).slice(0, 6)], [news.items]);
  const [category, setCategory] = useState('All');
  const filteredItems = category === 'All' ? news.items : news.items.filter((item) => item.category === category);
  const topStory = filteredItems[0] || news.items[0];
  const sideStories = (filteredItems.length ? filteredItems : news.items).slice(topStory ? 1 : 0, topStory ? 4 : 3);
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

      <div className="news-category-row" aria-label="News categories">
        {categories.map((item) => (
          <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>
        ))}
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

function WeatherDangerPanel({ weather, air, now }) {
  const alerts = useMemo(() => getWeatherDangerAlerts(weather, air, now), [weather, air, now.getHours(), now.getMinutes()]);
  return (
    <section className={`panel danger-panel ${alerts.length ? 'active' : 'calm'}`}>
      <div className="panel-heading">
        <Shield size={22} />
        <div>
          <h2>Weather Danger</h2>
          <p>Heat, humidity, dust, rain, and storm checks</p>
        </div>
      </div>
      <div className="danger-list">
        {alerts.length ? alerts.map((alert) => {
          const Icon = alert.Icon || Shield;
          return (
            <div key={alert.id} className={`danger-row ${alert.tone}`}>
              <Icon size={18} />
              <div>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </div>
            </div>
          );
        }) : (
          <div className="danger-row green">
            <Check size={18} />
            <div>
              <strong>No major outdoor warning</strong>
              <span>Weather looks manageable right now.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SunMoonSkyPanel({ now, weather, weatherMood, ambientPhase, moon, moonTimes, timeFormat }) {
  const timeline = useMemo(() => getSunTimeline(weather, now, timeFormat), [weather.sunrise, weather.sunset, now.toDateString(), timeFormat]);
  const moonCalendar = useMemo(() => getMoonCalendar(now, 7), [now.toDateString()]);
  const night = isNightAt(now, weather?.sunrise, weather?.sunset);
  return (
    <section className="panel sun-moon-panel">
      <div className="panel-heading">
        {night ? <Moon size={22} /> : <Sun size={22} />}
        <div>
          <h2>Live Sky</h2>
          <p>Real sun/moon state with weather-aware visuals</p>
        </div>
      </div>
      <div className="compact-sky-wrap">
        <CelestialScene now={now} weather={weather} weatherMood={weatherMood} ambientPhase={ambientPhase} moon={moon} />
      </div>
      <div className="sun-timeline">
        {timeline.map((item) => (
          <span key={item.id} className={item.active ? 'active' : ''}>
            <em>{item.label}</em>
            <strong>{item.display}</strong>
          </span>
        ))}
        {!timeline.length && <span><em>Sun data</em><strong>Waiting</strong></span>}
      </div>
      <div className="moon-calendar">
        {moonCalendar.map((item) => (
          <div key={item.key} className={item.key === localDateKey(now) ? 'active' : ''}>
            <MoonPhoto moon={item} />
            <span>{item.label}</span>
            <strong>{item.phase.replace(' Moon', '')}</strong>
            <em>{item.illumination}%</em>
          </div>
        ))}
      </div>
      <div className="sky-facts">
        <span>Moonrise <strong>{moonTimes.rise ? formatClockTime(moonTimes.rise, timeFormat) : '--'}</strong></span>
        <span>Moonset <strong>{moonTimes.set ? formatClockTime(moonTimes.set, timeFormat) : '--'}</strong></span>
        <span>Next full <strong>{moon.nextFullMoon.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}</strong></span>
      </div>
    </section>
  );
}

function RoomSensorPanel({ enabled, setEnabled, status, history }) {
  const samples = history.samples || [];
  const latest = history.latest;
  const bars = samples.slice(-32);
  return (
    <section className="panel room-sensor-panel">
      <div className="panel-heading">
        <Camera size={22} />
        <div>
          <h2>Camera Sensor Mode</h2>
          <p>Brightness and motion only. No video shown, no identity matching.</p>
        </div>
      </div>
      <div className="sensor-mode-card">
        <div className={enabled ? 'sensor-dot live' : 'sensor-dot'} />
        <div>
          <strong>{enabled ? 'Sensor armed' : 'Sensor off'}</strong>
          <span>{history.status || status || 'Waiting for camera sensor'}</span>
        </div>
        <button type="button" onClick={() => setEnabled(!enabled)}>{enabled ? 'Turn off' : 'Turn on'}</button>
      </div>
      <div className="brightness-history">
        {bars.length ? bars.map((sample) => (
          <span
            key={sample.at}
            style={{ height: `${Math.max(8, sample.brightness)}%` }}
            title={`${sample.brightness}% ${sample.level}`}
            className={sample.motion ? 'motion' : sample.face ? 'face' : ''}
          />
        )) : <em>No room brightness history yet.</em>}
      </div>
      <div className="sensor-readout">
        <span>Brightness <strong>{latest ? `${latest.brightness}%` : '--'}</strong></span>
        <span>Level <strong>{latest?.level || 'waiting'}</strong></span>
        <span>Motion <strong>{latest?.motion ? 'yes' : 'no'}</strong></span>
        <span>Face presence <strong>{latest?.face ? 'recent' : 'none'}</strong></span>
      </div>
      {history.error && <div className="device-warning">{history.error}</div>}
    </section>
  );
}

function OllamaModelManager({ settings, updateAssistant, healthResults, runHealthCheck }) {
  const modelRows = [
    ['2.5', 'Fast creative chat', settings.model25],
    ['3.5', 'Reasoning and math', settings.model35],
    ['4.5', 'General conversation', settings.model45],
    ['Qwen', 'Coding and multilingual', settings.qwenModel]
  ];
  const statusFor = (model) => {
    const hit = healthResults.find((item) => item.fix?.includes(`ollama pull ${model}`));
    if (!hit) return 'Run check';
    return hit.status;
  };

  return (
    <section className="model-manager-panel">
      <div className="model-manager-top">
        <div>
          <strong>Ollama Model Manager</strong>
          <span>Pick easy, hard, or auto without editing files.</span>
        </div>
        <button type="button" onClick={runHealthCheck}>Check models</button>
      </div>
      <div className="quick-model-switch">
        {['auto', '2.5', '3.5', '4.5', 'qwen'].map((tier) => (
          <button type="button" key={tier} className={settings.modelTier === tier ? 'active' : ''} onClick={() => updateAssistant('modelTier', tier)}>
            {tier === 'auto' ? 'Auto' : tier}
          </button>
        ))}
      </div>
      <div className="model-manager-list">
        {modelRows.map(([tier, detail, model]) => (
          <div key={tier}>
            <strong>{tier}</strong>
            <span>{model}</span>
            <em>{detail} / {statusFor(model)}</em>
            <code>ollama pull {model}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function SmartWakePage({ now, weather, prayer, alarm, timeFormat, assistantSettings, musicPlayer, onClose }) {
  const news = useNewsFeed();
  const [sessionEndsAt] = useState(() => Date.now() + 15 * 60 * 1000);
  const remainingMinutes = Math.max(0, Math.ceil((sessionEndsAt - Date.now()) / 60000));
  const name = assistantSettings.startupCallName || assistantSettings.introName || pickUserName(assistantSettings);
  const hour = now.getHours();
  const greeting = hour < 12
    ? assistantReply(assistantSettings, `Good Morning, ${name}`, `صباح الخير، ${name}`)
    : hour < 18
      ? assistantReply(assistantSettings, `Good Afternoon, ${name}`, `مساء الخير، ${name}`)
      : assistantReply(assistantSettings, `Good Evening, ${name}`, `مساء الخير، ${name}`);
  const outfit = outfitRecommendation(weather);
  const topNews = news.items.slice(0, 5);

  useEffect(() => {
    const wakeLockPromise = navigator.wakeLock?.request?.('screen').catch(() => null);
    return () => {
      Promise.resolve(wakeLockPromise).then((lock) => lock?.release?.()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (Date.now() >= sessionEndsAt) {
      onClose();
      return undefined;
    }
    const timer = window.setTimeout(onClose, Math.max(1000, sessionEndsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [onClose, sessionEndsAt]);

  return (
    <section className={`smart-wake-page phase-${getAmbientPhase(now, weather).id}`}>
      <div className="smart-wake-bg" aria-hidden="true" />
      <header>
        <button type="button" className="icon-button" onClick={onClose}><ChevronLeft size={22} /></button>
        <div>
          <h1>{greeting}</h1>
          <p>Wake session keeps the screen active for {remainingMinutes} min.</p>
        </div>
        <button type="button" onClick={musicPlayer.togglePlay} disabled={!musicPlayer.tracks.length}>
          {musicPlayer.playing ? <Pause size={18} /> : <Play size={18} />} Soft music
        </button>
      </header>
      <main className="smart-wake-grid">
        <section className="smart-wake-clock">
          <strong>{formatClockTime(now, timeFormat)}</strong>
          <span>{now.toLocaleDateString('en-AE', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </section>
        <section className="smart-wake-card weather">
          <WeatherSymbol code={weather.code} night={isNightAt(now, weather.sunrise, weather.sunset)} size={38} />
          <div>
            <h2>{weather.temp}C / feels {weather.feels}C</h2>
            <p>{weatherCondition(weather.code, isNightAt(now, weather.sunrise, weather.sunset)).label} / rain {weather.rain ?? 0}% / high UV {weather.uv ?? '--'}</p>
          </div>
        </section>
        <section className="smart-wake-card">
          <h2>Outfit</h2>
          <p>{assistantSettings.replyLanguage === 'ar' ? outfit.ar : assistantSettings.replyLanguage === 'both' ? `${outfit.en} / ${outfit.ar}` : outfit.en}</p>
        </section>
        <section className="smart-wake-card">
          <h2>Daily Summary</h2>
          <p>Next prayer: {prayer.name} in {prayer.countdown}. Alarm: {formatAlarmLabel(alarm, timeFormat)}. Day progress: {Math.round(((hour * 60 + now.getMinutes()) / 1440) * 100)}%.</p>
        </section>
        <section className="smart-wake-card quote">
          <h2>Quote</h2>
          <p>Start with the first useful thing. Then keep the room calm.</p>
        </section>
        <section className="smart-wake-card news-ticker-card">
          <h2>News</h2>
          {topNews.length ? (
            <div className="wake-news-ticker">
              <span>{topNews.map((item) => item.title).join('   •   ')}</span>
            </div>
          ) : <p>{news.error ? 'News unavailable right now.' : 'Loading headlines...'}</p>}
        </section>
      </main>
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
  const currentFavorite = Boolean(track?.file && player.favoriteFiles.has(track.file));
  const alarmTrack = player.allTracks.find((item) => item.url === player.alarmTrackUrl);
  const playlistLabel = player.playlist === 'all'
    ? 'All music'
    : player.playlist === 'favorites'
      ? 'Favorites'
      : player.playlist.replace(/^playlist:/, '');

  return (
    <div className={player.playing ? 'music-widget playing' : 'music-widget'}>
      <div className="music-now">
        <div className="album-art" aria-hidden="true">
          <Music2 size={30} />
          <span />
        </div>
        <div>
          <p>{library.loaded ? `${player.tracks.length}/${player.allTracks.length} tracks - ${playlistLabel}` : 'Loading library'}</p>
          <strong>{shortTitle}</strong>
          <em>{track ? `${track.folder || 'Root'} - alarm: ${alarmTrack?.title || 'default sound'}` : 'Drop audio files into KISOKE/music or subfolders'}</em>
        </div>
      </div>
      <div className="visualizer" aria-hidden="true">
        {player.visualLevels.map((level, index) => <span key={index} style={{ '--i': index, '--level': level }} />)}
      </div>
      <div className="music-controls">
        <button type="button" onClick={player.togglePlay} disabled={!player.tracks.length} aria-label={player.playing ? 'Pause music' : 'Play music'}>
          {player.playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button type="button" onClick={player.nextTrack} disabled={!player.tracks.length} aria-label="Next track"><SkipForward size={20} /></button>
        <button type="button" onClick={player.shuffleTrack} disabled={!player.tracks.length} aria-label="Shuffle music"><Shuffle size={20} /></button>
        <button type="button" className={currentFavorite ? 'active' : ''} onClick={() => player.toggleFavorite()} disabled={!track} aria-label="Toggle favorite"><Star size={18} /></button>
        <label className="volume-control">
          <Volume2 size={18} />
          <input type="range" min="0" max="1" step="0.01" value={player.volume} onChange={(event) => player.setVolume(event.target.value)} />
        </label>
      </div>
      <div className="music-library-controls">
        <label>
          <span>Playlist</span>
          <select className="music-select" value={player.playlist} onChange={(event) => player.setPlaylist(event.target.value)}>
            <option value="all">All music</option>
            <option value="favorites">Favorites</option>
            {(library.playlists || []).map((item) => <option key={item.name} value={`playlist:${item.name}`}>{item.name} ({item.count})</option>)}
          </select>
        </label>
        <label>
          <span>Track</span>
          <select className="music-select" value={player.trackIndex} onChange={(event) => player.selectTrack(Number(event.target.value))} disabled={!player.tracks.length}>
            {player.tracks.length
              ? player.tracks.map((item, index) => <option key={item.file} value={index}>{item.title}</option>)
              : <option value="0">No tracks in this playlist</option>}
          </select>
        </label>
        <label>
          <span>Alarm music</span>
          <select className="music-select" value={player.alarmTrackUrl} onChange={(event) => player.setAlarmTrack(event.target.value)} disabled={!player.allTracks.length}>
            <option value="">Default alarm sound</option>
            {player.allTracks.map((item) => <option key={item.file} value={item.url}>{item.title}</option>)}
          </select>
        </label>
        <button type="button" onClick={library.refresh}><RefreshCw size={16} /> Rescan</button>
      </div>
      <div className="music-library-status">
        <span>{library.error ? library.error : `Auto-scan: ${library.fetchedAt ? new Date(library.fetchedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) : 'waiting'}`}</span>
        <span>{library.playlists?.length || 0} folder playlists</span>
        <span>{player.favoriteFiles.size} favorites</span>
      </div>
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
      setFinished({ id: projectId('finished-countdown'), type: 'countdown' });
    }
  }, [countdownLeft, countdownRunning]);

  useEffect(() => {
    if (timerRunning && timerLeft <= 0) {
      setTimerRunning(false);
      setFinished({ id: projectId('finished-timer'), type: 'timer' });
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
    addLap: () => setLaps((current) => [{ id: projectId('lap'), value: stopwatch }, ...current].slice(0, 12)),
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

function DashboardStudio({ mode, customWidgets, setCustomWidgets, customSections, setCustomSections, deletedWidgets, deleteCustomWidget, toggleWidgetLock, restoreDeletedWidget, restoreAllDeletedWidgets, resetCustomWidgets, dashboardTheme, setDashboardTheme, onBack, onOpenDashboard }) {
  const [selectedWidgetId, setSelectedWidgetId] = useState(() => customWidgets[0]?.id || '');
  const [sectionDraft, setSectionDraft] = useState('');
  const allSections = useMemo(() => [
    ...BUILT_IN_SECTIONS,
    ...customSections.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  ], [customSections]);
  const selectedWidget = customWidgets.find((widget) => String(widget.id) === String(selectedWidgetId)) || customWidgets[0] || null;
  const widgetsBySection = useMemo(() => allSections.reduce((groups, section) => ({
    ...groups,
    [section.id]: orderedPlacementWidgets(customWidgets, section.id)
  }), {}), [allSections, customWidgets]);
  const previewSections = useMemo(() => {
    const coreIds = ['news', 'prayer', 'weather', 'assistant', 'market'];
    const usedIds = new Set([...coreIds, ...customSections.map((section) => section.id)]);
    return [
      ...allSections.filter((section) => coreIds.includes(section.id)),
      ...customSections,
      ...allSections.filter((section) => !usedIds.has(section.id) && (widgetsBySection[section.id] || []).length)
    ].slice(0, 10);
  }, [allSections, customSections, widgetsBySection]);

  useEffect(() => {
    if (!selectedWidgetId || !customWidgets.some((widget) => String(widget.id) === String(selectedWidgetId))) {
      setSelectedWidgetId(customWidgets[0]?.id || '');
    }
  }, [customWidgets, selectedWidgetId]);

  function addWidget(typeId) {
    const placement = selectedWidget?.placement || 'weather';
    const widget = widgetTemplate(typeId, placement);
    setCustomWidgets((current) => [widget, ...current]);
    setSelectedWidgetId(widget.id);
  }

  function updateSelectedWidget(field, value) {
    if (!selectedWidget) return;
    setCustomWidgets((current) => current.map((widget) => (
      String(widget.id) === String(selectedWidget.id)
        ? normalizeWidget({ ...widget, [field]: value })
        : widget
    )));
  }

  function addSection(event) {
    event.preventDefault();
    const title = sectionDraft.trim();
    if (!title) return;
    setCustomSections((current) => [
      ...current,
      normalizeSection({
        id: projectId('section'),
        title,
        detail: 'Custom dashboard section',
        order: current.length ? Math.max(...current.map((section) => Number(section.order) || 0)) + 1000 : 1000
      })
    ]);
    setSectionDraft('');
  }

  function removeSection(id) {
    setCustomSections((current) => current.filter((section) => section.id !== id));
    setCustomWidgets((current) => current.map((widget) => (
      widget.placement === id ? { ...widget, placement: 'weather' } : widget
    )));
  }

  return (
    <section className={`tools-page ${mode} dashboard-studio-page`}>
      <header className="dash-top tools-top dashboard-studio-top">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Back to tools"><ChevronLeft size={24} /></button>
        <div>
          <h1>Dashboard Studio</h1>
          <p>Live preview, sections, widgets, embeds, recovery, and dashboard color.</p>
        </div>
        <div className="tools-top-actions">
          <button type="button" onClick={onOpenDashboard}>Open dashboard</button>
          <button type="button" onClick={resetCustomWidgets}>Reset widgets</button>
        </div>
      </header>

      <main className="dashboard-studio-layout">
        <section className="panel tool-panel dashboard-studio-preview-panel">
          <div className="panel-heading">
            <Gauge size={22} />
            <div>
              <h2>Live Dashboard Preview</h2>
              <p>Edits below are saved locally and appear here immediately.</p>
            </div>
            <span className="studio-live-state">Live</span>
          </div>
          <div className={`dashboard-studio-preview dashboard-theme-${dashboardTheme}`}>
            {previewSections.map((section) => {
              const widgets = widgetsBySection[section.id] || [];
              return (
                <section className="dashboard-studio-preview-section" key={section.id}>
                  <header>
                    <div>
                      <strong>{section.title}</strong>
                      <span>{section.detail}</span>
                    </div>
                    <small>{widgets.length ? `${widgets.length} custom` : 'Built-in'}</small>
                  </header>
                  {widgets.length ? (
                    <div className="dashboard-studio-widget-grid">
                      {widgets.map((widget) => (
                        <div key={widget.id} onClick={() => setSelectedWidgetId(widget.id)}>
                          <WidgetTile widget={widget} onRemove={deleteCustomWidget} onToggleLock={toggleWidgetLock} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-studio-empty">Built-in dashboard content stays live on the full Dashboard page.</div>
                  )}
                </section>
              );
            })}
          </div>
        </section>

        <aside className="dashboard-studio-sidebar">
          <section className="panel tool-panel dashboard-studio-controls">
            <div className="panel-heading">
              <Plus size={22} />
              <div>
                <h2>Add to Dashboard</h2>
                <p>Create a widget in the selected section.</p>
              </div>
            </div>
            <div className="dashboard-studio-theme-row" aria-label="Dashboard color">
              {['black', 'white', 'red'].map((theme) => (
                <button type="button" key={theme} className={dashboardTheme === theme ? 'active' : ''} onClick={() => setDashboardTheme(theme)}>{theme}</button>
              ))}
            </div>
            <div className="dashboard-studio-template-grid">
              {WIDGET_TYPES.map((type) => (
                <button type="button" key={type.id} onClick={() => addWidget(type.id)}>
                  <Plus size={16} /> {type.label}
                </button>
              ))}
            </div>
            <form className="dashboard-studio-section-form" onSubmit={addSection}>
              <input value={sectionDraft} onChange={(event) => setSectionDraft(event.target.value)} placeholder="New section name" />
              <button type="submit"><Plus size={16} /> Section</button>
            </form>
            {customSections.length > 0 && (
              <div className="dashboard-studio-section-list">
                {customSections.map((section) => (
                  <div key={section.id}>
                    <span>{section.title}</span>
                    <button type="button" onClick={() => removeSection(section.id)} aria-label={`Remove ${section.title}`}><X size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel tool-panel dashboard-studio-editor">
            <div className="panel-heading">
              <Gauge size={22} />
              <div>
                <h2>Widget Editor</h2>
                <p>Select a widget to change it, lock it, or delete it.</p>
              </div>
            </div>
            <div className="dashboard-studio-widget-list" aria-label="Saved dashboard widgets">
              {customWidgets.length ? customWidgets.map((widget) => (
                <button type="button" key={widget.id} className={String(selectedWidget?.id) === String(widget.id) ? 'active' : ''} onClick={() => setSelectedWidgetId(widget.id)}>
                  <span>{widget.title}</span>
                  <small>{allSections.find((section) => section.id === widget.placement)?.title || widget.placement}</small>
                </button>
              )) : <span className="dashboard-studio-empty">No custom widgets yet.</span>}
            </div>
            {selectedWidget && (
              <div className="dashboard-studio-fields">
                <label>Title<input value={selectedWidget.title} onChange={(event) => updateSelectedWidget('title', event.target.value)} /></label>
                <label>Value or URL<input value={selectedWidget.value} onChange={(event) => updateSelectedWidget('value', event.target.value)} placeholder="https://..." /></label>
                <label>Detail<input value={selectedWidget.detail} onChange={(event) => updateSelectedWidget('detail', event.target.value)} /></label>
                <label>Type<select value={selectedWidget.type} onChange={(event) => updateSelectedWidget('type', event.target.value)}>{WIDGET_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
                <label>Section<select value={selectedWidget.placement} onChange={(event) => updateSelectedWidget('placement', event.target.value)}>{allSections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label>
                <label>Accent<select value={selectedWidget.accent} onChange={(event) => updateSelectedWidget('accent', event.target.value)}>{WIDGET_ACCENTS.map((accent) => <option key={accent} value={accent}>{accent}</option>)}</select></label>
                <div className="dashboard-studio-actions">
                  <button type="button" onClick={() => toggleWidgetLock(selectedWidget.id)}>{selectedWidget.locked ? <Lock size={16} /> : <Unlock size={16} />}{selectedWidget.locked ? ' Locked' : ' Lock'}</button>
                  <button type="button" className="danger-lite" onClick={() => deleteCustomWidget(selectedWidget.id)}><X size={16} /> Delete</button>
                </div>
                {selectedWidget.type === 'embed' && <p className="dashboard-studio-embed-note">Embedded pages load only from the URL you save. Some websites block iframe embeds; use the Open embed link when that happens.</p>}
              </div>
            )}
          </section>

          {deletedWidgets.length > 0 && (
            <section className="panel tool-panel dashboard-studio-recovery">
              <div className="panel-heading">
                <Undo2 size={22} />
                <div><h2>Recovery</h2><p>Deleted widgets are available for 25 minutes.</p></div>
                <button type="button" onClick={restoreAllDeletedWidgets}>Restore all</button>
              </div>
              {deletedWidgets.map((widget) => (
                <div key={`${widget.id}-${widget.deletedAt}`} className="dashboard-studio-recovery-row">
                  <span>{widget.title}</span>
                  <button type="button" onClick={() => restoreDeletedWidget(widget.id)}><Undo2 size={15} /> Undo</button>
                </div>
              ))}
            </section>
          )}
        </aside>
      </main>
    </section>
  );
}

function DashboardCustomisationPage({ mode, kioskSettings, setDashboardTheme, setLookStyle, goBack, goDashboard, goApps }) {
  const [draft, setDraft] = useState(() => ({
    appearance: { ...kioskSettings.settings.appearance },
    dashboard: { ...kioskSettings.settings.dashboard }
  }));
  const [presetName, setPresetName] = useState('My preset');
  const [presets, setPresets] = useState(() => readJsonSetting('nexora.dashboard-presets.v1', []));

  useEffect(() => {
    setDraft({ appearance: { ...kioskSettings.settings.appearance }, dashboard: { ...kioskSettings.settings.dashboard } });
  }, [kioskSettings.settings.appearance, kioskSettings.settings.dashboard]);

  function updateDraft(section, patch) {
    setDraft((current) => ({ ...current, [section]: { ...current[section], ...patch } }));
  }

  function applyDraft() {
    kioskSettings.updateSection('appearance', draft.appearance);
    kioskSettings.updateSection('dashboard', draft.dashboard);
    setDashboardTheme(draft.appearance.dashboardTheme);
    setLookStyle(draft.appearance.look);
  }

  function savePreset() {
    const name = presetName.trim() || 'My preset';
    const next = [{ id: `preset-${Date.now()}`, name, appearance: draft.appearance, dashboard: draft.dashboard }, ...presets].slice(0, 12);
    setPresets(next);
    localStorage.setItem('nexora.dashboard-presets.v1', JSON.stringify(next));
  }

  function loadPreset(preset) {
    setDraft({ appearance: { ...preset.appearance }, dashboard: { ...preset.dashboard } });
  }

  return (
    <section className={`tools-page ${mode} dashboard-customisation-page`}>
      <header className="dash-top tools-top">
        <button className="icon-button" type="button" onClick={goBack} aria-label="Back to tools"><ChevronLeft size={24} /></button>
        <div>
          <h1>Dashboard Customisation</h1>
          <p>Preview appearance and layout changes before applying them.</p>
        </div>
        <div className="tools-top-actions">
          <button type="button" onClick={applyDraft}>Apply</button>
          <button type="button" onClick={() => setDraft({ appearance: { ...kioskSettings.settings.appearance }, dashboard: { ...kioskSettings.settings.dashboard } })}>Cancel</button>
          <button type="button" onClick={() => { kioskSettings.resetSection('appearance'); kioskSettings.resetSection('dashboard'); }}>Reset</button>
        </div>
      </header>
      <main className="dashboard-customisation-layout">
        <section className={`dashboard-custom-live-preview theme-${draft.appearance.dashboardTheme} look-${draft.appearance.look}`} style={{ '--preview-radius': `${draft.appearance.widgetRadius}px`, '--preview-gap': `${draft.appearance.widgetSpacing}px`, '--preview-alpha': `${Math.max(40, Math.min(100, draft.appearance.cardTransparency)) / 100}` }}>
          <div className="preview-topline"><strong>Dashboard preview</strong><span>{draft.dashboard.density} density</span></div>
          <div className="preview-card wide"><span>Outside weather</span><strong>34C</strong><em>Clear / selected location</em></div>
          <div className="preview-card"><span>Next prayer</span><strong>Maghrib</strong><em>Live calculation</em></div>
          <div className="preview-card"><span>Daily goals</span><strong>2 / 3</strong><em>Today</em></div>
          <button type="button" onClick={goDashboard}>Open live dashboard</button>
        </section>

        <section className="panel tool-panel dashboard-custom-controls">
          <div className="panel-heading"><Gauge size={22} /><div><h2>Appearance</h2><p>Readable text and cards are adjusted together.</p></div></div>
          <div className="settings-form-grid">
            <label>Layout look<select value={draft.appearance.look} onChange={(event) => updateDraft('appearance', { look: event.target.value })}>{LOOK_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
            <label>Dashboard color<select value={draft.appearance.dashboardTheme} onChange={(event) => updateDraft('appearance', { dashboardTheme: event.target.value })}><option value="black">Black</option><option value="white">White</option><option value="red">Red</option></select></label>
            <label>Card transparency<input type="range" min="40" max="100" value={draft.appearance.cardTransparency} onChange={(event) => updateDraft('appearance', { cardTransparency: Number(event.target.value) })} /></label>
            <label>Blur strength<input type="range" min="0" max="24" value={draft.appearance.blurStrength} onChange={(event) => updateDraft('appearance', { blurStrength: Number(event.target.value) })} /></label>
            <label>Widget radius<input type="range" min="0" max="20" value={draft.appearance.widgetRadius} onChange={(event) => updateDraft('appearance', { widgetRadius: Number(event.target.value) })} /></label>
            <label>Widget spacing<input type="range" min="4" max="28" value={draft.appearance.widgetSpacing} onChange={(event) => updateDraft('appearance', { widgetSpacing: Number(event.target.value) })} /></label>
            <label>Font size<input type="range" min="85" max="125" value={draft.appearance.fontScale} onChange={(event) => updateDraft('appearance', { fontScale: Number(event.target.value) })} /></label>
            <label>Icon size<input type="range" min="80" max="125" value={draft.appearance.iconScale} onChange={(event) => updateDraft('appearance', { iconScale: Number(event.target.value) })} /></label>
            <label>Animation speed<select value={draft.appearance.animationSpeed} onChange={(event) => updateDraft('appearance', { animationSpeed: event.target.value })}><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label>
            <label>Dashboard density<select value={draft.dashboard.density} onChange={(event) => updateDraft('dashboard', { density: event.target.value })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
            <label>Dashboard scale<input type="range" min="80" max="120" value={draft.dashboard.scale} onChange={(event) => updateDraft('dashboard', { scale: Number(event.target.value) })} /></label>
            <label>Scrollbar<select value={draft.appearance.scrollbarStyle} onChange={(event) => updateDraft('appearance', { scrollbarStyle: event.target.value })}><option value="glass">Glassy</option><option value="minimal">Minimal</option><option value="contrast">High contrast</option></select></label>
          </div>
          <div className="dock compact">
            <button className={draft.dashboard.quickAccessVisible ? 'active' : ''} onClick={() => updateDraft('dashboard', { quickAccessVisible: !draft.dashboard.quickAccessVisible })}>Quick Access {draft.dashboard.quickAccessVisible ? 'shown' : 'hidden'}</button>
            <button className={draft.dashboard.snapToGrid ? 'active' : ''} onClick={() => updateDraft('dashboard', { snapToGrid: !draft.dashboard.snapToGrid })}>Snap to grid</button>
            <button className={draft.dashboard.editMode ? 'active' : ''} onClick={() => updateDraft('dashboard', { editMode: !draft.dashboard.editMode })}>Widget edit mode</button>
            <button onClick={goApps}>Most Used Apps</button>
          </div>
          <div className="preset-row">
            <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" />
            <button type="button" onClick={savePreset}>Save preset</button>
          </div>
          {presets.length > 0 && <div className="saved-preset-list">{presets.map((preset) => <button key={preset.id} type="button" onClick={() => loadPreset(preset)}>{preset.name}</button>)}</div>}
        </section>
      </main>
    </section>
  );
}

function normalizeAppShortcut(value) {
  const url = String(value?.url || '').trim();
  return {
    id: value?.id || `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(value?.name || 'New app').trim() || 'New app',
    url: /^https?:\/\//i.test(url) ? url : url ? `https://${url}` : '',
    category: String(value?.category || 'General').trim() || 'General',
    color: String(value?.color || 'blue'),
    openMode: value?.openMode === 'inside' ? 'inside' : 'external',
    pinned: Boolean(value?.pinned)
  };
}

function MostUsedAppsPage({ mode, kioskSettings, goDashboard, goSettings }) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({ name: '', url: '', category: 'General', color: 'blue', openMode: 'external', pinned: true });
  const apps = Array.isArray(kioskSettings.settings.mostUsedApps.items) ? kioskSettings.settings.mostUsedApps.items.map(normalizeAppShortcut) : [];
  const filtered = apps.filter((app) => `${app.name} ${app.category}`.toLowerCase().includes(query.toLowerCase().trim()));

  function updateApps(next) {
    kioskSettings.updateSection('mostUsedApps', { items: next.map(normalizeAppShortcut) });
  }

  function addApp(event) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.url.trim()) return;
    updateApps([normalizeAppShortcut(draft), ...apps]);
    setDraft({ name: '', url: '', category: 'General', color: 'blue', openMode: 'external', pinned: true });
  }

  function openApp(app) {
    if (!app.url) return;
    if (app.openMode === 'inside') window.location.assign(app.url);
    else window.open(app.url, '_blank', 'noopener,noreferrer');
  }

  function moveApp(id, direction) {
    const index = apps.findIndex((app) => app.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= apps.length) return;
    const next = [...apps];
    [next[index], next[target]] = [next[target], next[index]];
    updateApps(next);
  }

  return (
    <section className={`tools-page ${mode} most-used-apps-page`}>
      <header className="dash-top tools-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div><h1>Most Used Apps</h1><p>Private shortcuts saved only on this kiosk.</p></div>
        <div className="tools-top-actions"><button type="button" onClick={goSettings}>Settings</button></div>
      </header>
      <main className="apps-layout">
        <section className="panel tool-panel app-add-panel">
          <div className="panel-heading"><ExternalLink size={22} /><div><h2>Add shortcut</h2><p>Choose whether it opens inside KISOKE Browser or externally.</p></div></div>
          <form className="settings-form-grid" onSubmit={addApp}>
            <label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="School portal" /></label>
            <label>URL<input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://..." /></label>
            <label>Category<input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Study" /></label>
            <label>Color<select value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })}><option value="blue">Blue</option><option value="green">Green</option><option value="amber">Amber</option><option value="red">Red</option></select></label>
            <label>Open in<select value={draft.openMode} onChange={(event) => setDraft({ ...draft, openMode: event.target.value })}><option value="external">External browser</option><option value="inside">KISOKE Browser</option></select></label>
            <label className="app-pin-toggle"><input type="checkbox" checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} /> Pin to Quick Access</label>
            <button type="submit"><Plus size={17} /> Add app</button>
          </form>
        </section>
        <section className="panel tool-panel apps-library-panel">
          <div className="panel-heading"><BookOpen size={22} /><div><h2>Saved apps</h2><p>Search, open, pin, reorder, or delete.</p></div></div>
          <input className="apps-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps" />
          <div className={kioskSettings.settings.mostUsedApps.compact ? 'apps-grid compact' : 'apps-grid'}>
            {filtered.map((app) => (
              <article key={app.id} className={`app-shortcut-card tone-${app.color}`}>
                <button type="button" className="app-open" onClick={() => openApp(app)}><ExternalLink size={20} /><strong>{app.name}</strong><span>{app.category}</span><em>{app.openMode === 'inside' ? 'KISOKE Browser' : 'External browser'}</em></button>
                <div className="app-shortcut-actions"><button type="button" onClick={() => updateApps(apps.map((item) => item.id === app.id ? { ...item, pinned: !item.pinned } : item))}>{app.pinned ? 'Unpin' : 'Pin'}</button><button type="button" onClick={() => moveApp(app.id, -1)} aria-label={`Move ${app.name} up`}>Up</button><button type="button" onClick={() => moveApp(app.id, 1)} aria-label={`Move ${app.name} down`}>Down</button><button type="button" className="danger-lite" onClick={() => updateApps(apps.filter((item) => item.id !== app.id))}>Delete</button></div>
              </article>
            ))}
            {!filtered.length && <div className="dashboard-studio-empty">No apps saved yet.</div>}
          </div>
        </section>
      </main>
    </section>
  );
}

function KioskBrowserPage({ mode, kioskSettings, goDashboard }) {
  const browser = kioskSettings.settings.browser;
  const update = (patch) => kioskSettings.updateSection('browser', patch);
  const openHome = () => {
    const target = String(browser.homeUrl || 'http://localhost:5173').trim();
    if (/^https?:\/\//i.test(target)) window.location.assign(target);
  };
  return (
    <section className={`tools-page ${mode} kiosk-browser-page`}>
      <header className="dash-top tools-top">
        <button className="icon-button" type="button" onClick={goDashboard} aria-label="Back to dashboard"><ChevronLeft size={24} /></button>
        <div><h1>KISOKE Browser</h1><p>Chromium desktop-shell settings for the local dashboard.</p></div>
        <div className="tools-top-actions"><button type="button" onClick={openHome}>Open home</button></div>
      </header>
      <main className="apps-layout">
        <section className="panel tool-panel">
          <div className="panel-heading"><Laptop size={22} /><div><h2>Browser Settings</h2><p>These preferences are saved locally for the Electron shell.</p></div></div>
          <div className="settings-form-grid">
            <label>Home page URL<input value={browser.homeUrl} onChange={(event) => update({ homeUrl: event.target.value })} placeholder="http://localhost:5173" /></label>
            <label>External links<select value={browser.openExternalInside ? 'inside' : 'outside'} onChange={(event) => update({ openExternalInside: event.target.value === 'inside' })}><option value="outside">Open outside KISOKE</option><option value="inside">Open inside KISOKE</option></select></label>
          </div>
          <div className="dock compact">
            <button className={browser.fullscreen ? 'active' : ''} onClick={() => update({ fullscreen: !browser.fullscreen })}>Start fullscreen {browser.fullscreen ? 'on' : 'off'}</button>
            <button className={browser.kioskLock ? 'active' : ''} onClick={() => update({ kioskLock: !browser.kioskLock })}>Kiosk lock {browser.kioskLock ? 'on' : 'off'}</button>
            <button className={browser.customTopBar ? 'active' : ''} onClick={() => update({ customTopBar: !browser.customTopBar })}>Custom top bar {browser.customTopBar ? 'on' : 'off'}</button>
            <button className={browser.autoLaunch ? 'active' : ''} onClick={() => update({ autoLaunch: !browser.autoLaunch })}>Auto-launch {browser.autoLaunch ? 'on' : 'off'}</button>
          </div>
        </section>
        <section className="panel tool-panel">
          <div className="panel-heading"><Shield size={22} /><div><h2>Desktop Shell</h2><p>Run KISOKE without normal browser menus.</p></div></div>
          <pre>npm run dev:desktop</pre>
          <div className="tool-readout">F11 toggles fullscreen. Ctrl + R reloads. Ctrl + Shift + Q exits the shell.</div>
        </section>
      </main>
    </section>
  );
}

function ToolsPage({ now, mode, manualMode, autoColor, setManualMode, dashboardTheme, setDashboardTheme, alarm, setAlarm, timeFormat, setTimeFormat, customWidgets, setCustomWidgets, customSections, setCustomSections, deletedWidgets, setDeletedWidgets, deleteCustomWidget, toggleWidgetLock, restoreDeletedWidget, restoreAllDeletedWidgets, resetCustomWidgets, goBack, goDashboard, goSoftware, goRemoteCamera, setAutoColor, setRoomMode, assistantSettings, setAssistantSettings, voiceAssistant, offlineVoice, locationSettings, setLocationSettings, lookStyle, setLookStyle, performanceMode, setPerformanceMode, backgroundServices, setBackgroundServices, timeDeckSettings, setTimeDeckSettings, activeTimeDeckSection, setActiveTimeDeckSection, worldClocks, setWorldClocks, currentPage, weather, weatherMood, battery, lastCommand, lastError, pushToast, presenceSettings, setPresenceSettings, commandHistory, clearCommandHistory, remoteCameraSettings, setRemoteCameraSettings, securityLog, languageSettings, setLanguageSettings, prayerSettings, setPrayerSettings, prayerData, kioskSettings, goDashboardCustomisation }) {
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
  const [systemRepairResults, setSystemRepairResults] = useState([]);
  const [healthSnapshot, setHealthSnapshot] = useState(null);
  const [toolsView, setToolsView] = useState('settings');
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
  const settingsImportRef = useRef(null);
  const allSections = useMemo(() => [
    ...BUILT_IN_SECTIONS,
    ...customSections.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  ], [customSections]);
  const backgroundServiceItems = [
    ['news', 'News refresh', 'Gulf News polling every minute'],
    ['system', 'System stats', 'CPU, RAM, disk, ping widgets'],
    ['weatherExtras', 'Weather extras', 'AQI and dust/weather danger feeds'],
    ['cameraSensors', 'Camera sensors', 'Presence, adaptive brightness, room brightness graph'],
    ['musicScan', 'Music scan', 'Auto-detect new local music'],
    ['videoIntroScan', 'Video intro scan', 'Auto-detect custom startup videos'],
    ['battery', 'Battery/runtime', 'Battery refresh and kiosk runtime'],
    ['backendHealth', 'Backend health', 'Checks backend status in the background']
  ];
  const enabledBackgroundCount = backgroundServiceItems.filter(([key]) => backgroundServices[key]).length;

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
        id: projectId('widget'),
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
        id: projectId('section'),
        title,
        detail: 'Custom section for your widgets',
        order: current.length ? Math.max(...current.map((section) => Number(section.order) || 0)) + 1000 : 1000
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
    localStorage.removeItem(BACKGROUND_SERVICES_KEY);
    localStorage.removeItem('nexora.clock.mode');
    localStorage.removeItem('nexora.clock.auto');
    kioskSettings.updateSettings(() => importKisokeSettings({}));
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
    setBackgroundServices(DEFAULT_BACKGROUND_SERVICES);
    securityLog.clear();
    clearCommandHistory();
    setActiveTimeDeckSection(DEFAULT_TIME_DECK_SETTINGS.defaultSection);
  }

  function exportSettingsBackup() {
    const blob = new Blob([exportKisokeSettings(kioskSettings.settings)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kisoke-settings-${localDateKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast('Settings exported', 'A KISOKE settings backup was downloaded.', 'green');
  }

  async function importSettingsBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const next = importKisokeSettings(await file.text());
      kioskSettings.updateSettings(() => next);
      setDashboardTheme(next.appearance.dashboardTheme);
      setLookStyle(next.appearance.look);
      setLocationSettings({
        weatherName: next.weather.locationName,
        weatherLat: next.weather.latitude,
        weatherLon: next.weather.longitude,
        weatherTimezone: next.weather.timezone
      });
      setPrayerSettings(next.prayer);
      pushToast('Settings imported', 'The saved KISOKE settings are active.', 'green');
    } catch (error) {
      pushToast('Import failed', error.message || 'That settings file is not valid.', 'amber');
    } finally {
      event.target.value = '';
    }
  }

  function updateAssistant(field, value) {
    setAssistantSettings((current) => ({ ...current, [field]: value }));
  }

  function voiceOriginStatus() {
    if (typeof window === 'undefined') return { ok: true, label: 'checking' };
    const ok = window.isSecureContext || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    return {
      ok,
      label: ok ? 'secure for microphone' : 'needs HTTPS or localhost'
    };
  }

  function armWakeWordNow() {
    const patch = {
      voiceAssistant: true,
      voiceMode: 'wake',
      alwaysListen: true,
      alwaysShowOrb: true
    };
    setAssistantSettings((current) => ({ ...current, ...patch }));
    voiceAssistant.armWakeWord?.({ ...assistantSettings, ...patch });
    pushToast('Wake word armed', `Say "${assistantSettings.customWakePhrase || `Hey ${assistantSettings.assistantName}`}" after Chrome allows the mic.`, 'blue');
  }

  function testPressToTalkNow() {
    const patch = {
      voiceAssistant: true,
      voiceMode: assistantSettings.voiceMode === 'off' ? 'press' : assistantSettings.voiceMode,
      alwaysShowOrb: true
    };
    setAssistantSettings((current) => ({ ...current, ...patch }));
    voiceAssistant.startListening?.(true, { ...assistantSettings, ...patch });
  }

  function startOfflineVoiceNow() {
    const patch = {
      offlineVoice: true,
      alwaysShowOrb: true
    };
    setAssistantSettings((current) => ({ ...current, ...patch }));
    offlineVoice?.start?.(true);
  }

  function stopOfflineVoiceNow() {
    offlineVoice?.stop?.(true);
  }

  function saveOfflineVoiceSettingsNow() {
    offlineVoice?.sendSettings?.();
    pushToast('Offline voice saved', 'Backend Vosk settings were sent to the local server.', 'green');
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
    let kioskHealth = null;
    let musicStatus = null;
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/status`);
      backendStatus = await response.json();
      results.push({ label: 'Backend online', status: backendStatus.ok ? 'Passed' : 'Failed', fix: 'Run backend on port 8787.' });
    } catch {
      results.push({ label: 'Backend online', status: 'Failed', fix: 'Run: ALLOW_DEVICE_CONTROL=true bash scripts/linux/start-kiosk.sh' });
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/device/status`);
      deviceStatus = await response.json();
    } catch {
      deviceStatus = null;
    }
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/kiosk/health`, { cache: 'no-store' });
      kioskHealth = await readJsonResponse(response, 'Kiosk health failed');
      setHealthSnapshot(kioskHealth);
    } catch {
      kioskHealth = null;
      setHealthSnapshot(null);
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
    try {
      const response = await fetch(`/api/music?health=${Date.now()}`, { cache: 'no-store' });
      musicStatus = await response.json();
    } catch {
      musicStatus = null;
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
    results.push({ label: 'Music folder scan', status: musicStatus?.tracks?.length ? 'Passed' : 'Warning', fix: musicStatus?.error || 'Add audio files to KISOKE/music or enable Music scan in Background Services.' });
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
    results.push({ label: 'Kiosk health snapshot', status: kioskHealth?.ok ? 'Passed' : 'Warning', fix: 'Backend /api/kiosk/health should answer on the private network.' });
    if (kioskHealth?.missing_dependencies?.length) {
      results.push({ label: 'Missing system tools', status: 'Warning', fix: kioskHealth.missing_dependencies.slice(0, 4).join(', ') });
    }
    setHealthResults(results);
    pushToast('Health check', `${results.filter((item) => item.status === 'Passed').length}/${results.length} passed`, 'blue');
  }

  function openHealthConsole() {
    window.requestAnimationFrame(() => {
      document.querySelector('.core-console-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    runHealthCheck();
  }

  async function refreshCameraTimeline() {
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/local-camera/logs`, { cache: 'no-store' });
      const data = await readJsonResponse(response, 'Camera log refresh failed');
      setCameraLogEntries(data.logs || []);
      return data.logs || [];
    } catch (error) {
      setCameraLogEntries([{ time: Date.now() / 1000, level: 'error', message: error.message || 'Camera log refresh failed.' }]);
      return [];
    }
  }

  async function runSystemRepair(actions = ['camera_restart', 'reset_streams', 'clear_expired_sessions', 'apply_runtime_policy']) {
    setSystemRepairResults([{ action: 'repair', ok: true, message: 'Running repair...' }]);
    try {
      const response = await fetch(`${DEVICE_API_BASE}/api/system/repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions })
      });
      const data = await readJsonResponse(response, 'System repair failed');
      setSystemRepairResults(data.results || []);
      if (data.health) setHealthSnapshot(data.health);
      if (data.health?.camera_logs) setCameraLogEntries(data.health.camera_logs);
      pushToast('System repair', data.ok ? 'Repair finished.' : 'Repair found a problem.', data.ok ? 'green' : 'amber');
      return data;
    } catch (error) {
      setSystemRepairResults([{ action: 'repair', ok: false, message: error.message || 'System repair failed.' }]);
      pushToast('System repair', error.message || 'Backend did not answer.', 'amber');
      return { ok: false };
    }
  }

  function healthRepairPlan(item) {
    const label = String(item?.label || '').toLowerCase();
    if (label.includes('backend online')) return { kind: 'backend', label: 'Start backend' };
    if (label.includes('ollama online')) return { kind: 'system', label: 'Start Ollama', actions: ['restart_ollama'] };
    if (label.includes('model exists') || label.includes('qwen coding model') || label.includes('auto fast model') || label.includes('auto hard model')) {
      return { kind: 'system', label: 'Download AI models', actions: ['restart_ollama', 'pull_ai_models'] };
    }
    if (label.includes('music folder')) return { kind: 'music', label: 'Rescan music' };
    if (label.includes('camera') || label.includes('brightness sensor') || label.includes('motion sensor') || label.includes('face presence')) {
      return { kind: 'system', label: 'Repair camera', actions: ['camera_restart', 'reset_streams', 'clear_camera_clients', 'release_legacy_capture', 'apply_runtime_policy'] };
    }
    if (label.includes('device dependencies') || label.includes('missing system tools') || label.includes('tailscale') || label.includes('rtl-sdr')) {
      return { kind: 'software', label: 'Open installer' };
    }
    if (label.includes('notification')) return { kind: 'toast', label: 'Preview small toast' };
    return null;
  }

  async function fixHealthIssue(item) {
    const plan = healthRepairPlan(item);
    if (!plan) return;
    if (plan.kind === 'backend') {
      const result = await requestBackendAutostart('HealthRepair', true);
      pushToast('Health repair', result.ok ? 'Backend autostart requested.' : (result.error || result.message || 'Backend autostart did not answer.'), result.ok ? 'green' : 'amber');
      await wait(900);
      runHealthCheck();
      return;
    }
    if (plan.kind === 'system') {
      await runSystemRepair(plan.actions);
      await wait(900);
      runHealthCheck();
      return;
    }
    if (plan.kind === 'music') {
      setBackgroundServices({ musicScan: true });
      try {
        const response = await fetch(`/api/music?refresh=${Date.now()}`, { cache: 'no-store' });
        const data = await readJsonResponse(response, 'Music rescan failed');
        pushToast('Music rescan', `${data.tracks?.length || 0} tracks found.`, data.tracks?.length ? 'green' : 'amber');
      } catch (error) {
        pushToast('Music rescan', error.message || 'Music scan failed.', 'amber');
      }
      runHealthCheck();
      return;
    }
    if (plan.kind === 'software') {
      goSoftware();
      pushToast('Software Needed', 'Open installer page for missing system tools.', 'blue');
      return;
    }
    if (plan.kind === 'toast') {
      pushToast('Notification test', 'Small glossy toast mode is active.', 'green');
    }
  }

  async function autoRepairHealthIssues() {
    const candidates = healthResults.filter((item) => item.status !== 'Passed' && healthRepairPlan(item));
    if (!candidates.length) {
      pushToast('Auto repair', 'No repairable warnings found. Run Health Check first if this looks wrong.', 'green');
      return;
    }
    pushToast('Auto repair', `Trying ${candidates.length} repair action${candidates.length === 1 ? '' : 's'}.`, 'blue');
    for (const item of candidates.slice(0, 6)) {
      await fixHealthIssue(item);
    }
  }

  if (toolsView === 'dashboard') {
    return (
      <DashboardStudio
        mode={mode}
        customWidgets={customWidgets}
        setCustomWidgets={setCustomWidgets}
        customSections={customSections}
        setCustomSections={setCustomSections}
        deletedWidgets={deletedWidgets}
        deleteCustomWidget={deleteCustomWidget}
        toggleWidgetLock={toggleWidgetLock}
        restoreDeletedWidget={restoreDeletedWidget}
        restoreAllDeletedWidgets={restoreAllDeletedWidgets}
        resetCustomWidgets={resetCustomWidgets}
        dashboardTheme={dashboardTheme}
        setDashboardTheme={setDashboardTheme}
        onBack={() => setToolsView('settings')}
        onOpenDashboard={goDashboard}
      />
    );
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
          <button type="button" onClick={() => setToolsView('dashboard')}>Dashboard</button>
          <button type="button" onClick={goDashboardCustomisation}>Dashboard customisation</button>
          <button type="button" onClick={openHealthConsole}>Health / run check</button>
          <button type="button" onClick={goSoftware}>Software needed</button>
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

        <section className="panel tool-panel prayer-settings-panel">
          <div className="panel-heading">
            <Moon size={22} />
            <div>
              <h2>Prayer Settings</h2>
              <p>Selected location, calculation method, Asr method, and individual offsets.</p>
            </div>
            <button type="button" onClick={prayerData.refresh}><RefreshCw size={16} /> Refresh</button>
          </div>
          <div className="settings-form-grid">
            <label>Prayer location<input value={prayerSettings.locationName} onChange={(event) => setPrayerSettings({ locationName: event.target.value, locationMode: 'manual' })} placeholder="City, Country" /></label>
            <label>Country<input value={prayerSettings.country} onChange={(event) => setPrayerSettings({ country: event.target.value })} placeholder="UAE" /></label>
            <label>Latitude<input type="number" step="0.0001" value={prayerSettings.latitude} onChange={(event) => setPrayerSettings({ latitude: Number(event.target.value), locationMode: 'manual' })} /></label>
            <label>Longitude<input type="number" step="0.0001" value={prayerSettings.longitude} onChange={(event) => setPrayerSettings({ longitude: Number(event.target.value), locationMode: 'manual' })} /></label>
            <label>Timezone<input value={prayerSettings.timezone} onChange={(event) => setPrayerSettings({ timezone: event.target.value })} placeholder="Asia/Dubai" /></label>
            <label>Calculation method
              <select value={prayerSettings.calculationMethod} onChange={(event) => setPrayerSettings({ calculationMethod: event.target.value })}>
                {PRAYER_CALCULATION_METHODS.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}
              </select>
            </label>
            <label>Asr method
              <select value={prayerSettings.asrMethod} onChange={(event) => setPrayerSettings({ asrMethod: event.target.value })}>
                {ASR_METHODS.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}
              </select>
            </label>
            {ATHAN_PRAYER_NAMES.map((prayerName) => (
              <label key={prayerName}>{prayerName} offset (min)
                <input type="number" min="-30" max="30" value={prayerSettings.offsets[prayerName] || 0} onChange={(event) => setPrayerSettings({ offsets: { ...prayerSettings.offsets, [prayerName]: Number(event.target.value) || 0 } })} />
              </label>
            ))}
          </div>
          <div className="dock compact">
            <button type="button" onClick={() => setPrayerSettings({ locationMode: 'manual', locationName: 'Ajman, UAE', country: 'UAE', latitude: 25.4052, longitude: 55.5136, timezone: 'Asia/Dubai', calculationMethod: '16' })}>Use Ajman</button>
            <button type="button" onClick={() => setPrayerSettings({ locationMode: 'manual', locationName: locationSettings.weatherName, latitude: locationSettings.weatherLat, longitude: locationSettings.weatherLon, timezone: locationSettings.weatherTimezone, calculationMethod: /\b(uae|dubai|ajman|sharjah|abu dhabi)\b/i.test(locationSettings.weatherName) ? '16' : prayerSettings.calculationMethod })}>Use weather location</button>
            <button type="button" onClick={() => setPrayerSettings({ calculationMethod: '16' })}>Use Dubai/UAE method</button>
            <button type="button" onClick={() => navigator.geolocation?.getCurrentPosition?.((position) => setPrayerSettings({ locationMode: 'auto', locationName: 'Browser location', latitude: position.coords.latitude, longitude: position.coords.longitude, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || prayerSettings.timezone }), () => pushToast('Prayer location', 'Location permission was not granted.', 'amber'), { enableHighAccuracy: false, timeout: 10000 })}>Use device location</button>
          </div>
          <div className="tool-readout">{prayerData.locationName} / {prayerData.methodName} / {prayerData.source}{prayerData.cached ? ' (cached)' : ''}{prayerData.lastUpdated ? ` / updated ${new Date(prayerData.lastUpdated).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : ''}{prayerData.error ? ` / ${prayerData.error}` : ''}</div>
        </section>

        <section className="panel tool-panel weather-settings-panel">
          <div className="panel-heading">
            <CloudSun size={22} />
            <div>
              <h2>Weather Settings</h2>
              <p>Open-Meteo live outdoor data for the location you choose.</p>
            </div>
            <button type="button" onClick={weather.refresh}><RefreshCw size={16} /> Refresh</button>
          </div>
          <div className="settings-form-grid">
            <label>Weather location<input value={locationSettings.weatherName} onChange={(event) => setLocationSettings({ weatherName: event.target.value })} placeholder="City, Country" /></label>
            <label>Latitude<input type="number" step="0.0001" value={locationSettings.weatherLat} onChange={(event) => setLocationSettings({ weatherLat: Number(event.target.value) })} /></label>
            <label>Longitude<input type="number" step="0.0001" value={locationSettings.weatherLon} onChange={(event) => setLocationSettings({ weatherLon: Number(event.target.value) })} /></label>
            <label>Timezone<input value={locationSettings.weatherTimezone} onChange={(event) => setLocationSettings({ weatherTimezone: event.target.value })} placeholder="Asia/Dubai" /></label>
            <label>Temperature unit
              <select value={kioskSettings.settings.weather.unit} onChange={(event) => kioskSettings.updateSection('weather', { unit: event.target.value })}>
                <option value="celsius">Celsius</option>
                <option value="fahrenheit">Fahrenheit</option>
              </select>
            </label>
            <label>Provider<input value="Open-Meteo" readOnly /></label>
          </div>
          <div className="dock compact">
            <button type="button" onClick={() => setLocationSettings({ weatherName: 'Ajman, UAE', weatherLat: 25.4052, weatherLon: 55.5136, weatherTimezone: 'Asia/Dubai' })}>Use Ajman</button>
            <button type="button" onClick={() => setLocationSettings({ weatherName: 'Dubai, UAE', weatherLat: 25.2048, weatherLon: 55.2708, weatherTimezone: 'Asia/Dubai' })}>Use Dubai</button>
            <button type="button" onClick={() => navigator.geolocation?.getCurrentPosition?.((position) => setLocationSettings({ weatherName: 'Browser location', weatherLat: position.coords.latitude, weatherLon: position.coords.longitude }), () => pushToast('Weather location', 'Location permission was not granted.', 'amber'), { enableHighAccuracy: false, timeout: 10000 })}>Use device location</button>
          </div>
          <div className="tool-readout">{weather.locationName} / {weather.source}{weather.cached ? ' (cached)' : ''}{weather.lastUpdated ? ` / updated ${new Date(weather.lastUpdated).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : ''}{weather.error ? ` / ${weather.error}` : ''}</div>
        </section>

        <section className="panel tool-panel gesture-settings-panel">
          <div className="panel-heading">
            <MoveHorizontal size={22} />
            <div>
              <h2>Gestures</h2>
              <p>Touchscreen and touchpad navigation without interfering with normal vertical scrolling.</p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label>Swipe sensitivity
              <input type="range" min="45" max="220" value={kioskSettings.settings.gestures.swipeSensitivity} onChange={(event) => kioskSettings.updateSection('gestures', { swipeSensitivity: Number(event.target.value) })} />
            </label>
            <label>Dashboard pinch scale
              <select value={kioskSettings.settings.gestures.pinchZoom ? 'on' : 'off'} onChange={(event) => kioskSettings.updateSection('gestures', { pinchZoom: event.target.value === 'on' })}><option value="off">Off</option><option value="on">On</option></select>
            </label>
          </div>
          <div className="dock compact">
            <button className={kioskSettings.settings.gestures.enabled ? 'active' : ''} onClick={() => kioskSettings.updateSection('gestures', { enabled: !kioskSettings.settings.gestures.enabled })}>Gestures {kioskSettings.settings.gestures.enabled ? 'on' : 'off'}</button>
            <button className={kioskSettings.settings.gestures.touchEnabled ? 'active' : ''} onClick={() => kioskSettings.updateSection('gestures', { touchEnabled: !kioskSettings.settings.gestures.touchEnabled })}>Touch swipe {kioskSettings.settings.gestures.touchEnabled ? 'on' : 'off'}</button>
            <button className={kioskSettings.settings.gestures.touchpadEnabled ? 'active' : ''} onClick={() => kioskSettings.updateSection('gestures', { touchpadEnabled: !kioskSettings.settings.gestures.touchpadEnabled })}>Touchpad swipe {kioskSettings.settings.gestures.touchpadEnabled ? 'on' : 'off'}</button>
            <button className={kioskSettings.settings.gestures.longPressEdit ? 'active' : ''} onClick={() => kioskSettings.updateSection('gestures', { longPressEdit: !kioskSettings.settings.gestures.longPressEdit })}>Long-press edit {kioskSettings.settings.gestures.longPressEdit ? 'on' : 'off'}</button>
          </div>
          <div className="tool-readout">Swipe right from Clock for Dashboard. Swipe left from Clock for Tools. Two-finger horizontal touchpad swipes move between main pages.</div>
        </section>

        <section className="panel tool-panel settings-backup-panel">
          <div className="panel-heading">
            <HardDrive size={22} />
            <div>
              <h2>Settings Backup</h2>
              <p>Export, import, or reset the versioned KISOKE settings store.</p>
            </div>
          </div>
          <div className="dock compact">
            <button type="button" onClick={exportSettingsBackup}>Export settings</button>
            <button type="button" onClick={() => settingsImportRef.current?.click()}>Import settings</button>
            <button type="button" onClick={() => kioskSettings.resetSection('appearance')}>Reset appearance</button>
            <button type="button" onClick={() => kioskSettings.resetSection('dashboard')}>Reset dashboard</button>
            <button type="button" onClick={() => kioskSettings.resetSection('prayer')}>Reset prayer</button>
            <button type="button" onClick={() => kioskSettings.resetSection('weather')}>Reset weather</button>
          </div>
          <input ref={settingsImportRef} type="file" accept="application/json,.json" onChange={importSettingsBackup} hidden />
          <div className="tool-readout">Old settings are merged with safe defaults so a missing or older option cannot crash KISOKE.</div>
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
            <label>Custom wake phrase<input value={assistantSettings.customWakePhrase} onChange={(event) => updateAssistant('customWakePhrase', event.target.value)} placeholder={`Hey ${assistantSettings.assistantName}`} /></label>
            <label>Assistant replies
              <select value={assistantSettings.replyLanguage} onChange={(event) => updateAssistant('replyLanguage', event.target.value)}>
                <option value="both">English + Arabic</option>
                <option value="en">English only</option>
                <option value="ar">Arabic only</option>
              </select>
            </label>
            <label>Custom startup audio<input value={assistantSettings.customStartupAudio} onChange={(event) => updateAssistant('customStartupAudio', event.target.value)} placeholder="C:\\...\\audio.mp3 or leave empty" /></label>
            <label>Voice mode
              <select value={assistantSettings.voiceMode} onChange={(event) => updateAssistant('voiceMode', event.target.value)}>
                <option value="off">Off</option>
                <option value="press">Press-to-talk</option>
                <option value="wake">Wake word mode</option>
              </select>
            </label>
            <label>Voice recognition language
              <select value={assistantSettings.recognitionLanguage} onChange={(event) => updateAssistant('recognitionLanguage', event.target.value)}>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="ar-SA">Arabic</option>
              </select>
            </label>
            <label>Offline voice engine
              <select value={assistantSettings.offlineVoiceEngine} onChange={(event) => updateAssistant('offlineVoiceEngine', event.target.value)}>
                <option value="vosk">Vosk offline</option>
              </select>
            </label>
            <label>Vosk model folder<input value={assistantSettings.offlineVoiceModelDir} onChange={(event) => updateAssistant('offlineVoiceModelDir', event.target.value)} placeholder="models/vosk-model-small-en-us-0.15" /></label>
            <label>Offline mic device<input value={assistantSettings.offlineVoiceDevice} onChange={(event) => updateAssistant('offlineVoiceDevice', event.target.value)} placeholder="blank = default, or device number" /></label>
            <label>Offline sample rate<input type="number" min="8000" max="48000" value={assistantSettings.offlineVoiceSampleRate} onChange={(event) => updateAssistant('offlineVoiceSampleRate', event.target.value)} /></label>
            <label>Wake command timeout<input type="number" min="2" max="30" value={assistantSettings.offlineVoiceWakeTimeout} onChange={(event) => updateAssistant('offlineVoiceWakeTimeout', event.target.value)} /></label>
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
          <OllamaModelManager settings={assistantSettings} updateAssistant={updateAssistant} healthResults={healthResults} runHealthCheck={runHealthCheck} />
          <div className="athan-settings-box">
            <div className="panel-heading compact-heading">
              <Moon size={18} />
              <div>
                <h3>Athan Voice</h3>
                <p>Spoken prayer-time reminder. Disable all or specific prayers like Fajr.</p>
              </div>
            </div>
            <div className="settings-form-grid">
              <label>Athan language
                <select value={assistantSettings.athanLanguage} onChange={(event) => updateAssistant('athanLanguage', event.target.value)}>
                  <option value="both">English + Arabic</option>
                  <option value="en">English only</option>
                  <option value="ar">Arabic only</option>
                </select>
              </label>
            </div>
            <div className="dock compact">
              <button className={assistantSettings.athanEnabled ? 'active' : ''} onClick={() => updateAssistant('athanEnabled', !assistantSettings.athanEnabled)}>{assistantSettings.athanEnabled ? 'Athan enabled' : 'Athan disabled'}</button>
              <button className={assistantSettings.athanVoiceEnabled ? 'active' : ''} onClick={() => updateAssistant('athanVoiceEnabled', !assistantSettings.athanVoiceEnabled)}>{assistantSettings.athanVoiceEnabled ? 'Athan speaks' : 'Athan silent'}</button>
              {ATHAN_PRAYER_NAMES.map((prayerName) => {
                const enabledMap = normalizeAthanPerPrayer(assistantSettings.athanPerPrayer);
                return (
                  <button
                    key={prayerName}
                    className={enabledMap[prayerName] ? 'active' : ''}
                    onClick={() => updateAssistant('athanPerPrayer', { ...enabledMap, [prayerName]: !enabledMap[prayerName] })}
                  >
                    {prayerName} {enabledMap[prayerName] ? 'on' : 'off'}
                  </button>
                );
              })}
              <button onClick={() => {
                const sampleText = athanSpeechText('Maghrib', assistantSettings, pickUserName(assistantSettings));
                pushToast('Athan test', sampleText, 'amber');
                speakClient(sampleText, { ...assistantSettings, voiceReplies: true });
              }}>Test athan voice</button>
            </div>
            <div className="tool-readout">Sunrise is intentionally not treated as athan. It stays silent.</div>
          </div>
          <div className="voice-diagnostic-grid" aria-label="Voice assistant diagnostics">
            <span className={assistantSettings.voiceMode === 'wake' && assistantSettings.alwaysListen ? 'ok' : 'warn'}>
              Wake mode <strong>{assistantSettings.voiceMode === 'wake' && assistantSettings.alwaysListen ? 'ready' : 'not armed'}</strong>
            </span>
            <span className={voiceAssistant.micPermission === 'allowed' ? 'ok' : 'warn'}>
              Mic <strong>{voiceAssistant.micPermission || 'unknown'}</strong>
            </span>
            <span className={voiceOriginStatus().ok ? 'ok' : 'bad'}>
              Page <strong>{voiceOriginStatus().label}</strong>
            </span>
            <span className={voiceAssistant.listening ? 'ok' : voiceAssistant.armed ? 'warn' : 'warn'}>
              Listener <strong>{voiceAssistant.listening ? 'hearing now' : voiceAssistant.armed ? 'armed/restarting' : 'off'}</strong>
            </span>
            <span className={voiceAssistant.supported ? 'ok' : 'warn'}>
              Speech API <strong>{voiceAssistant.supported ? 'available' : 'test needed'}</strong>
            </span>
            <span className={offlineVoice?.running ? 'ok' : offlineVoice?.status?.model_present === false || offlineVoice?.status?.dependencies?.missing?.length ? 'bad' : 'warn'}>
              Vosk 24/7 <strong>{offlineVoice?.running ? 'running' : offlineVoice?.status?.message || 'not checked'}</strong>
            </span>
            <span className={offlineVoice?.status?.model_present ? 'ok' : 'bad'}>
              Vosk model <strong>{offlineVoice?.status?.model_present ? 'installed' : 'missing'}</strong>
            </span>
            <span className="ok">
              Wake phrase <strong>{assistantSettings.customWakePhrase || `Hey ${assistantSettings.assistantName}`}</strong>
            </span>
          </div>
          <div className="dock compact">
            <button className={assistantSettings.voiceAssistant ? 'active' : ''} onClick={() => updateAssistant('voiceAssistant', !assistantSettings.voiceAssistant)}>{assistantSettings.voiceAssistant ? 'Voice on' : 'Voice off'}</button>
            <button className={assistantSettings.alwaysListen ? 'active' : ''} onClick={() => updateAssistant('alwaysListen', !assistantSettings.alwaysListen)}>{assistantSettings.alwaysListen ? 'Always listen on' : 'Always listen off'}</button>
            <button className={assistantSettings.voiceReplies ? 'active' : ''} onClick={() => updateAssistant('voiceReplies', !assistantSettings.voiceReplies)}>{assistantSettings.voiceReplies ? 'Talk back on' : 'Talk back off'}</button>
            <button className={assistantSettings.offlineVoice ? 'active' : ''} onClick={() => updateAssistant('offlineVoice', !assistantSettings.offlineVoice)}>{assistantSettings.offlineVoice ? 'Offline Vosk on' : 'Offline Vosk off'}</button>
            <button className={assistantSettings.offlineVoiceAutostart ? 'active' : ''} onClick={() => updateAssistant('offlineVoiceAutostart', !assistantSettings.offlineVoiceAutostart)}>{assistantSettings.offlineVoiceAutostart ? 'Vosk autostart on' : 'Vosk autostart off'}</button>
            <button className={assistantSettings.alwaysShowOrb ? 'active' : ''} onClick={() => updateAssistant('alwaysShowOrb', !assistantSettings.alwaysShowOrb)}>{assistantSettings.alwaysShowOrb ? 'Orb always on' : 'Orb auto'}</button>
            <button className={assistantSettings.showOrbTranscript ? 'active' : ''} onClick={() => updateAssistant('showOrbTranscript', !assistantSettings.showOrbTranscript)}>{assistantSettings.showOrbTranscript ? 'Transcript on' : 'Transcript off'}</button>
            <button className={assistantSettings.voiceDebug ? 'active' : ''} onClick={() => updateAssistant('voiceDebug', !assistantSettings.voiceDebug)}>{assistantSettings.voiceDebug ? 'Debug on' : 'Debug off'}</button>
            <button className={assistantSettings.randomizeCallName ? 'active' : ''} onClick={() => updateAssistant('randomizeCallName', !assistantSettings.randomizeCallName)}>{assistantSettings.randomizeCallName ? 'Random names' : 'Fixed name'}</button>
            <button className={assistantSettings.alarmStartsMusic ? 'active' : ''} onClick={() => updateAssistant('alarmStartsMusic', !assistantSettings.alarmStartsMusic)}>{assistantSettings.alarmStartsMusic ? 'Alarm music on' : 'Alarm music off'}</button>
            <button className={assistantSettings.alarmBrightnessRamp ? 'active' : ''} onClick={() => updateAssistant('alarmBrightnessRamp', !assistantSettings.alarmBrightnessRamp)}>{assistantSettings.alarmBrightnessRamp ? 'Brightness ramp on' : 'Brightness ramp off'}</button>
            <button onClick={armWakeWordNow}><Mic size={16} /> Arm wake word now</button>
            <button onClick={testPressToTalkNow}><Mic size={16} /> Test press-to-talk</button>
            {voiceAssistant.listening && <button onClick={() => voiceAssistant.stopListening()}><MicOff size={16} /> Stop mic</button>}
            <button className={offlineVoice?.running ? 'active' : ''} onClick={startOfflineVoiceNow}><Mic size={16} /> Start Vosk listener</button>
            {offlineVoice?.running && <button onClick={stopOfflineVoiceNow}><MicOff size={16} /> Stop Vosk</button>}
            <button onClick={() => offlineVoice?.refreshDevices?.()}><RefreshCw size={16} /> Scan mics</button>
            <button onClick={saveOfflineVoiceSettingsNow}>Save Vosk settings</button>
          </div>
          <div className="tool-readout">{voiceAssistant.error || (voiceAssistant.listening ? `Listening for "${assistantSettings.customWakePhrase || `Hey ${assistantSettings.assistantName}`}"` : voiceAssistant.armed ? 'Wake word is armed and will auto-restart' : 'Voice is idle')} / Mic: {voiceAssistant.micPermission || 'unknown'} / Restarts: {voiceAssistant.restartCount || 0} / {voiceAssistant.lastEvent || 'waiting'}</div>
          <div className="tool-readout">Offline Vosk: {offlineVoice?.running ? 'running' : 'stopped'} / {offlineVoice?.status?.message || 'waiting'} / Last: {offlineVoice?.lastCommand || offlineVoice?.transcript || 'none'}</div>
          {offlineVoice?.devices?.length ? (
            <div className="offline-device-list">
              {offlineVoice.devices.slice(0, 6).map((device) => (
                <button type="button" key={`${device.index}-${device.name}`} onClick={() => updateAssistant('offlineVoiceDevice', String(device.index))}>
                  <strong>{device.index}</strong>
                  <span>{device.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel tool-panel ai-appearance-settings-panel">
          <div className="panel-heading">
            <Sparkles size={22} />
            <div>
              <h2>AI Appearance</h2>
              <p>Choose where Nexora appears. The assistant stays hidden until you call it or press the mic.</p>
            </div>
          </div>
          <div className="assistant-look-grid" aria-label="Assistant visual styles">
            {AI_VISUAL_LOOKS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`${kioskSettings.settings.ai.look === item.id ? 'active' : ''} preview-${item.id}`}
                onClick={() => kioskSettings.updateSection('ai', { look: item.id })}
              >
                <span className="assistant-look-swatch" aria-hidden="true"><i /><i /><i /></span>
                <strong>{item.title}</strong>
                <em>{item.detail}</em>
              </button>
            ))}
          </div>
          <div className="settings-form-grid">
            <label>AI visual look
              <select value={kioskSettings.settings.ai.look} onChange={(event) => kioskSettings.updateSection('ai', { look: event.target.value })}>
                <option value="glass-compact">Glassy compact</option>
                <option value="galaxy">Galaxy AI</option>
                <option value="siri-pill">Siri-inspired floating pill</option>
                <option value="siri-top">Siri-inspired top popup</option>
                <option value="google">Google-inspired floating prompt</option>
                <option value="aurora-bar">Aurora glass bar</option>
                <option value="minimal-orb">Minimal status orb</option>
              </select>
            </label>
            <label>Assistant animation
              <select value={kioskSettings.settings.ai.animation || 'ripple'} onChange={(event) => kioskSettings.updateSection('ai', { animation: event.target.value })}>
                {AI_ANIMATION_STYLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label>Position
              <select value={kioskSettings.settings.ai.position} onChange={(event) => kioskSettings.updateSection('ai', { position: event.target.value })}>
                <option value="top-right">Top right</option>
                <option value="top-center">Top center</option>
                <option value="bottom-right">Bottom right</option>
              </select>
            </label>
            <label>Size
              <select value={kioskSettings.settings.ai.size} onChange={(event) => kioskSettings.updateSection('ai', { size: event.target.value })}>
                <option value="small">Small</option>
                <option value="normal">Normal</option>
                <option value="large">Large</option>
              </select>
            </label>
            <label>Mic sensitivity<input type="range" min="10" max="100" value={kioskSettings.settings.ai.microphoneSensitivity} onChange={(event) => kioskSettings.updateSection('ai', { microphoneSensitivity: Number(event.target.value) })} /></label>
            <label>Glow strength<input type="range" min="0" max="100" value={kioskSettings.settings.ai.glow} onChange={(event) => kioskSettings.updateSection('ai', { glow: Number(event.target.value) })} /></label>
          </div>
          <div className="dock compact">
            <button className={kioskSettings.settings.ai.idleBehavior === 'hidden' ? 'active' : ''} onClick={() => kioskSettings.updateSection('ai', { idleBehavior: 'hidden' })}>Hide when idle</button>
            <button className={kioskSettings.settings.ai.idleBehavior === 'docked' ? 'active' : ''} onClick={() => kioskSettings.updateSection('ai', { idleBehavior: 'docked' })}>Dock when idle</button>
            <button className={kioskSettings.settings.ai.showSubtitles ? 'active' : ''} onClick={() => kioskSettings.updateSection('ai', { showSubtitles: !kioskSettings.settings.ai.showSubtitles })}>{kioskSettings.settings.ai.showSubtitles ? 'Subtitles on' : 'Subtitles off'}</button>
            <button className={kioskSettings.settings.ai.onlineMode === 'auto' ? 'active' : ''} onClick={() => kioskSettings.updateSection('ai', { onlineMode: kioskSettings.settings.ai.onlineMode === 'auto' ? 'local' : 'auto' })}>{kioskSettings.settings.ai.onlineMode === 'auto' ? 'Auto local/online' : 'Local only'}</button>
            <button type="button" onClick={() => voiceAssistant.preview()}><Sparkles size={16} /> Preview animation</button>
          </div>
          <div className="tool-readout">Wake-word listening needs Chrome, an allowed microphone, and an active tab. Browser speech recognition uses Chrome's speech service; local Ollama handles commands and replies, but does not replace speech-to-text by itself.</div>
        </section>

        <section className="panel tool-panel performance-settings-panel">
          <div className="panel-heading">
            <Cpu size={22} />
            <div>
              <h2>Performance & Background Services</h2>
              <p>Keep KISOKE fast by pausing heavy polling until you enable it here.</p>
            </div>
            <span className="mini-status-pill">{enabledBackgroundCount}/{backgroundServiceItems.length} on</span>
          </div>
          <div className="dock compact">
            {['lite', 'balanced', 'full'].map((item) => (
              <button
                type="button"
                key={item}
                className={performanceMode === item ? 'active' : ''}
                onClick={() => setPerformanceMode(item)}
              >
                {item === 'lite' ? 'Fast visuals' : item === 'full' ? 'Full visuals' : 'Balanced visuals'}
              </button>
            ))}
          </div>
          <div className="background-service-grid">
            {backgroundServiceItems.map(([key, title, detail]) => (
              <button
                type="button"
                key={key}
                className={backgroundServices[key] ? 'active' : ''}
                onClick={() => setBackgroundServices({ [key]: !backgroundServices[key] })}
              >
                <strong>{title}</strong>
                <span>{backgroundServices[key] ? 'Running' : 'Paused'}</span>
                <em>{detail}</em>
              </button>
            ))}
          </div>
          <div className="dock compact">
            <button type="button" onClick={() => setBackgroundServices(DEFAULT_BACKGROUND_SERVICES)}>Fast mode</button>
            <button type="button" onClick={() => setBackgroundServices(Object.fromEntries(Object.keys(DEFAULT_BACKGROUND_SERVICES).map((key) => [key, true])))}>Live mode</button>
          </div>
          <div className="tool-readout">Fast mode stops news, system, air-quality, music/video scanning, and camera sensor polling until you enable them.</div>
        </section>

        <section className="panel tool-panel core-console-panel">
          <div className="panel-heading">
            <Shield size={22} />
            <div>
              <h2>Core Console</h2>
              <p>Mic, camera, AI, backend, weather, battery, notifications, and device health</p>
            </div>
            <button type="button" onClick={runHealthCheck}>Run Health Check</button>
            <button type="button" onClick={autoRepairHealthIssues}>Fix now</button>
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
          <div className="system-repair-box">
            <div>
              <strong>System Repair</strong>
              <span>Private backend fixes for stuck camera streams, stale clients, and runtime policy.</span>
            </div>
            <div className="dock compact">
              <button type="button" onClick={() => runSystemRepair()}>Quick repair</button>
              <button type="button" onClick={() => runSystemRepair(['camera_restart', 'reset_streams', 'clear_camera_clients', 'release_legacy_capture', 'apply_runtime_policy'])}>Deep camera repair</button>
              <button type="button" onClick={() => runSystemRepair(['restart_ollama', 'pull_ai_models'])}>Repair AI models</button>
              <button type="button" onClick={refreshCameraTimeline}>Refresh camera log</button>
            </div>
            {healthSnapshot && (
              <div className="console-grid repair-health-grid">
                <span>Backend runtime <strong>{healthSnapshot.backend?.seconds ? formatUptime(healthSnapshot.backend.seconds) : 'live'}</strong></span>
                <span>Camera active pages <strong>{healthSnapshot.camera_page?.active_page_count ?? 0}</strong></span>
                <span>Camera streams <strong>{healthSnapshot.camera_page?.active_streams ?? 0}</strong></span>
                <span>Camera connected <strong>{healthSnapshot.camera?.connected ? 'yes' : 'no'}</strong></span>
                <span>Room brightness <strong>{healthSnapshot.room_brightness?.brightness ?? 'n/a'}%</strong></span>
                <span>Missing tools <strong>{healthSnapshot.missing_dependencies?.length || 0}</strong></span>
              </div>
            )}
            {systemRepairResults.length > 0 && (
              <div className="repair-result-list">
                {systemRepairResults.map((item, index) => (
                  <code key={`${item.action}-${index}`} className={item.ok ? 'ok' : 'fail'}>{item.action}: {item.message}</code>
                ))}
              </div>
            )}
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
              {healthResults.map((item) => {
                const repairPlan = healthRepairPlan(item);
                return (
                  <div key={item.label} className={item.status.toLowerCase()}>
                    <strong>{item.status}</strong>
                    <span>{item.label}</span>
                    <code>{item.fix}</code>
                    {item.status !== 'Passed' && repairPlan ? <button type="button" onClick={() => fixHealthIssue(item)}>Fix now</button> : null}
                  </div>
                );
              })}
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
                {CAMERA_DEVICE_FALLBACKS.map((camera) => <option key={camera.id} value={camera.id}>{camera.label}</option>)}
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
              <p>Choose a full visual profile. Each style changes the canvas, cards, controls, and type treatment.</p>
            </div>
          </div>
          <div className="look-style-grid">
            {LOOK_STYLES.map((style) => (
              <button type="button" key={style.id} data-look={style.id} className={lookStyle === style.id ? 'active' : ''} aria-pressed={lookStyle === style.id} onClick={() => setLookStyle(style.id)}>
                <span aria-hidden="true" />
                <strong>{style.label}</strong>
                <small>{style.description}</small>
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
  const athanMinuteRef = useRef('');
  const finishedAlertRef = useRef(null);
  const alarmBrightnessRampRef = useRef(null);
  const cameraFocusWasActiveRef = useRef(false);
  const now = useNow();
  const kioskSettings = useKisokeSettings();
  const [assistantSettings, setAssistantSettings] = useAssistantSettings();
  const [locationSettings, setLocationSettings] = useLocationSettings(
    kioskSettings.settings.weather,
    (patch) => kioskSettings.updateSection('weather', patch)
  );
  const [timeDeckSettings, setTimeDeckSettings] = useTimeDeckSettings();
  const [presenceSettings, setPresenceSettings] = usePresenceSettings();
  const [remoteCameraSettings, setRemoteCameraSettings] = useRemoteCameraSettings();
  const [languageSettings, setLanguageSettings] = useLanguageSettings();
  const [lookStyle, setLookStyle] = useLookStyle(
    kioskSettings.settings.appearance,
    (patch) => kioskSettings.updateSection('appearance', patch)
  );
  const [performanceMode, setPerformanceMode] = usePerformanceMode();
  const [backgroundServices, setBackgroundServices] = useBackgroundServices();
  const [page, setPage] = useState(() => {
    if (window.location.pathname === '/settings') return 'settings';
    if (window.location.pathname === '/tools') return 'settings';
    if (window.location.pathname === '/dashboard') return 'dashboard';
    if (window.location.pathname === '/dashboard-customisation') return 'dashboardCustomisation';
    if (window.location.pathname === '/apps') return 'apps';
    if (window.location.pathname === '/browser') return 'browser';
    if (window.location.pathname === '/clock') return 'clock';
    if (window.location.pathname === '/software-needed') return 'software';
    if (window.location.pathname === '/signal-center') return 'signal';
    if (window.location.pathname === '/radar') return 'radar';
    if (window.location.pathname === '/my-bedroom') return 'bedroom';
    if (window.location.pathname === '/games') return 'games';
    if (window.location.pathname === '/music') return 'music';
    if (window.location.pathname === '/projects') return 'projects';
    if (window.location.pathname === '/ollama-ai') return 'ollama';
    if (window.location.pathname === '/smart-wake') return 'smartWake';
    if (window.location.pathname === '/localhost-camera') return 'localCamera';
    if (window.location.pathname === '/remote-camera') return 'remoteCamera';
    return 'clock';
  });
  const cameraFocusMode = page === 'localCamera' || page === 'remoteCamera' || page === 'radar';
  const connectionStatus = useConnectionStatus(backgroundServices.backendHealth);
  const weather = useWeather(locationSettings, !cameraFocusMode);
  const prayerSettings = useMemo(() => normalizePrayerSettings(kioskSettings.settings.prayer), [kioskSettings.settings.prayer]);
  const prayerData = usePrayerTimes(now, prayerSettings, !cameraFocusMode);
  const { toasts, pushToast } = useToasts();
  const [activeTimeDeckSection, setActiveTimeDeckSection] = useState(() => timeDeckSettings.defaultSection || 'alarm');
  const [showWelcome, setShowWelcome] = useState(() => {
    const cameraRoute = window.location.pathname === '/localhost-camera' || window.location.pathname === '/remote-camera';
    return !cameraRoute && !new URLSearchParams(window.location.search).has('skipIntro');
  });
  const [manualMode, setManualModeState] = useState(() => localStorage.getItem('nexora.clock.mode') || 'slate');
  const [autoColor, setAutoColorState] = useState(true);
  const [dashboardTheme, setDashboardThemeState] = useState(() => {
    const globalTheme = kioskSettings.settings.appearance.dashboardTheme;
    return ['black', 'white', 'red'].includes(globalTheme)
      ? globalTheme
      : (localStorage.getItem(DASHBOARD_THEME_KEY) || 'black');
  });
  useEffect(() => {
    const nextTheme = kioskSettings.settings.appearance.dashboardTheme;
    if (!['black', 'white', 'red'].includes(nextTheme)) return;
    setDashboardThemeState((current) => current === nextTheme ? current : nextTheme);
  }, [kioskSettings.settings.appearance.dashboardTheme]);
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
  const musicLibrary = useMusicLibrary(!cameraFocusMode && (backgroundServices.musicScan || page === 'dashboard' || page === 'smartWake' || page === 'music'));
  const alarmSoundLibrary = useAlarmSoundLibrary(!cameraFocusMode);
  const videoIntroLibrary = useVideoIntroLibrary(!cameraFocusMode && backgroundServices.videoIntroScan);
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
  const backendBattery = useBackendBatteryStatus(!cameraFocusMode && backgroundServices.battery);
  const battery = backendBattery.level == null ? browserBattery : { ...browserBattery, ...backendBattery };
  const caffeine = useCaffeineTimer();
  const timeDesk = useTimeDesk(!cameraFocusMode);
  const timeAlarms = useTimeDeckAlarms(alarm, setAlarm);
  const commandHistory = useCommandHistory();
  const securityLog = useSecurityLog();
  const brainDump = useBrainDump();
  const prayer = useMemo(() => nextPrayer(now, prayerData.times, prayerSettings), [now, prayerData.times, prayerSettings]);
  const handleCameraWake = useCallback(() => {
    setBlackout(false);
    setShowWelcome(false);
  }, []);
  const cameraWakeCaptureEnabled = cameraWakeEnabled && !cameraFocusMode && backgroundServices.cameraSensors;
  const { videoRef: cameraVideoRef, status: rawCameraWakeStatus } = useCameraWake(cameraWakeCaptureEnabled, handleCameraWake);
  const cameraWakeStatus = cameraWakeEnabled && !cameraWakeCaptureEnabled
    ? (cameraFocusMode
      ? 'Camera wake paused while camera page is open'
      : !backgroundServices.cameraSensors
        ? 'Camera wake paused by Background Services'
        : 'Camera sensor mode waiting')
    : rawCameraWakeStatus;
  const mode = autoColor ? ambientPhase.mode : manualMode;

  useEffect(() => {
    const shouldRunSensor = cameraWakeEnabled && backgroundServices.cameraSensors && !cameraFocusMode;
    setRemoteCameraSettings({
      backgroundAdaptiveBrightness: shouldRunSensor,
      cameraMode: shouldRunSensor ? 'sensor' : remoteCameraSettings.cameraMode
    });
    fetch(`${DEVICE_API_BASE}/api/remote-camera/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        background_adaptive_brightness: shouldRunSensor,
        camera_mode: shouldRunSensor ? 'sensor' : remoteCameraSettings.cameraMode,
        camera_enabled: true
      })
    }).catch(() => {});
  }, [backgroundServices.cameraSensors, cameraFocusMode, cameraWakeEnabled]);

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

  useEffect(() => () => {
    window.clearInterval(alarmBrightnessRampRef.current);
  }, []);

  useEffect(() => {
    if (!timeDesk.finished?.id || finishedAlertRef.current === timeDesk.finished.id) return;
    finishedAlertRef.current = timeDesk.finished.id;
    const label = timeDesk.finished.type === 'timer' ? 'Timer finished' : 'Countdown finished';
    playAlert(label);
  }, [timeDesk.finished?.id, timeDesk.finished?.type, playAlert]);

  useEffect(() => {
    if (!assistantSettings.athanEnabled || !assistantSettings.athanVoiceEnabled) return;
    const enabledMap = normalizeAthanPerPrayer(assistantSettings.athanPerPrayer);
    const duePrayer = prayerData.times.find((item) => {
      if (!ATHAN_PRAYER_NAMES.includes(item.name) || !enabledMap[item.name]) return false;
      const diffSeconds = (now.getTime() - item.time.getTime()) / 1000;
      return diffSeconds >= 0 && diffSeconds < 45;
    });
    if (!duePrayer) return;
    const key = `${now.toDateString()}-${duePrayer.name}-${formatTime(duePrayer.time)}`;
    if (athanMinuteRef.current === key) return;
    athanMinuteRef.current = key;
    const spokenName = pickUserName(assistantSettings);
    const text = athanSpeechText(duePrayer.name, assistantSettings, spokenName);
    pushToast('Athan reminder', text, 'amber');
    speakClient(text, { ...assistantSettings, voiceReplies: true });
  }, [now, assistantSettings, prayerData.times, pushToast]);

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
    if (assistantSettings.alarmBrightnessRamp) startAlarmBrightnessRamp(alarmBrightnessRampRef, 8, 76, 90);
    if (assistantSettings.alarmStartsMusic && musicPlayer.tracks.length) {
      musicPlayer.setVolume(Math.min(Math.max(musicPlayer.volume || 0.18, 0.16), 0.28));
      if (!musicPlayer.playing) musicPlayer.selectTrack(musicPlayer.trackIndex || 0);
    }
    window.history.pushState(null, '', '/smart-wake');
    setPage('smartWake');
    if (dueAlarm.repeat === 'once') timeAlarms.toggleAlarm(dueAlarm.id);
  }, [now, timeAlarms, alarmSoundUrl, playAlert, timeFormat, assistantSettings.alarmBrightnessRamp, assistantSettings.alarmStartsMusic, musicPlayer]);

  function setPrayerSettings(patch) {
    kioskSettings.updateSection('prayer', (current) => normalizePrayerSettings(
      typeof patch === 'function' ? patch(current) : { ...current, ...patch }
    ));
  }

  function setManualMode(nextMode) {
    setManualModeState(nextMode);
    setAutoColorState(false);
    localStorage.setItem('nexora.clock.mode', nextMode);
    localStorage.setItem('nexora.clock.auto', 'false');
    kioskSettings.updateSection('appearance', { theme: nextMode });
  }

  function setAutoColor(enabled) {
    setAutoColorState(enabled);
    localStorage.setItem('nexora.clock.auto', String(enabled));
    if (enabled) kioskSettings.updateSection('appearance', { theme: 'auto' });
  }

  function setDashboardTheme(nextTheme) {
    const validTheme = ['black', 'white', 'red'].includes(nextTheme) ? nextTheme : 'black';
    setDashboardThemeState(validTheme);
    localStorage.setItem(DASHBOARD_THEME_KEY, validTheme);
    kioskSettings.updateSection('appearance', { dashboardTheme: validTheme });
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
    const gestureSettings = kioskSettings.settings.gestures;
    if (!gestureSettings.enabled) return;
    const threshold = clampNumber(gestureSettings.swipeSensitivity, 45, 220);
    if (deltaX > threshold) {
      if (page === 'timeTools') setPage('clock');
      else if (page === 'clock') setPage('dashboard');
      else if (page === 'dashboard') setPage('signal');
      else if (page === 'radar') setPage('dashboard');
    } else if (deltaX < -threshold) {
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
    const gestureSettings = kioskSettings.settings.gestures;
    if (!gestureSettings.enabled) return;
    if ((event.pointerType === 'touch' || event.type?.startsWith?.('touch')) && !gestureSettings.touchEnabled) return;
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
    const gestureSettings = kioskSettings.settings.gestures;
    if (!gestureSettings.enabled) return;
    if ((event.pointerType === 'touch' || event.type?.startsWith?.('touch')) && !gestureSettings.touchEnabled) return;
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
    const threshold = clampNumber(gestureSettings.swipeSensitivity, 45, 220);
    if (
      start.y < 130 &&
      deltaY > threshold &&
      Math.abs(deltaY) > Math.abs(deltaX) * 1.25
    ) {
      setQuickControlsOpen(true);
      return;
    }
    if (Math.abs(deltaX) < threshold) return;
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
  }, [page, quickControlsOpen, brainDumpOpen, focusLock, kioskSettings.settings.gestures]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    let accumulatedX = 0;
    let resetTimer = null;
    const onWheel = (event) => {
      const gestureSettings = kioskSettings.settings.gestures;
      if (!gestureSettings.enabled || !gestureSettings.touchpadEnabled) return;
      if (isTypingTarget(event.target) || event.target?.closest?.('.page-menu-panel, .quick-access-dock, .hourly-strip, .time-tool-rail, input, textarea, select')) return;

      if (gestureSettings.pinchZoom && event.ctrlKey && page === 'dashboard') {
        event.preventDefault();
        const nextScale = clampNumber(kioskSettings.settings.dashboard.scale - (event.deltaY * 0.035), 80, 120);
        kioskSettings.updateSection('dashboard', { scale: Math.round(nextScale) });
        return;
      }

      if (Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.15) return;
      accumulatedX += event.deltaX;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => { accumulatedX = 0; }, 180);
      const threshold = clampNumber(gestureSettings.swipeSensitivity, 45, 220);
      if (Math.abs(accumulatedX) < threshold) return;
      event.preventDefault();
      const nowMs = Date.now();
      if (nowMs - lastPageSwipeRef.current >= 220) {
        lastPageSwipeRef.current = nowMs;
        // Trackpads report positive deltaX for a physical left swipe.
        movePageBySwipe(-accumulatedX);
      }
      accumulatedX = 0;
    };
    shell.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      window.clearTimeout(resetTimer);
      shell.removeEventListener('wheel', onWheel, true);
    };
  }, [page, kioskSettings.settings.gestures, kioskSettings.settings.dashboard.scale]);

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
        let reply = data.ok === false ? (data.error || 'Device control failed.') : success;
        if (data.ok !== false && assistantSettings.replyLanguage === 'ar' && !/[\u0600-\u06FF]/.test(reply)) reply = `تم يا ${name}.`;
        if (data.ok !== false && assistantSettings.replyLanguage === 'both' && !/[\u0600-\u06FF]/.test(reply)) reply = `${reply} / تم يا ${name}.`;
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
        const [browserLocation, bedroomReading] = await Promise.all([
          readBrowserLocation(),
          commandNeedsBedroomContext(command) ? fetchBedroomAssistantReading() : Promise.resolve(null)
        ]);
        const prompt = buildAssistantLivePrompt(command, { assistantSettings, locationSettings, weather, now, timeFormat, browserLocation, bedroomReading });
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

    async function summarizeHealthForAssistant() {
      try {
        const [backendResponse, musicResponse] = await Promise.allSettled([
          fetch(`${DEVICE_API_BASE}/api/kiosk/health?assistant=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/music?assistant=${Date.now()}`, { cache: 'no-store' })
        ]);
        const backendData = backendResponse.status === 'fulfilled' ? await readJsonResponse(backendResponse.value, 'Health summary failed') : null;
        const musicData = musicResponse.status === 'fulfilled' ? await readJsonResponse(musicResponse.value, 'Music summary failed') : null;
        const missing = backendData?.missing_dependencies?.length ? `Missing tools: ${backendData.missing_dependencies.slice(0, 3).join(', ')}.` : 'System tools look okay.';
        const camera = backendData?.camera?.connected ? `Camera ${backendData.camera.camera_index ?? remoteCameraSettings.cameraDevice} connected.` : 'Camera is not connected.';
        const ai = backendData?.ollama?.ok ? `Ollama online with ${backendData.ollama.models?.length || 0} models.` : 'Ollama is offline.';
        const music = musicData?.tracks?.length ? `${musicData.tracks.length} music tracks found.` : 'Music folder has no scanned tracks.';
        return `Health summary: backend ${backendData?.backend?.online ? 'online' : 'unknown'}, ${ai} ${camera} ${music} ${missing}`;
      } catch (error) {
        return `Health summary failed: ${error.message || 'backend did not answer'}.`;
      }
    }

    async function runAssistantHealthRepair() {
      const start = await requestBackendAutostart('AssistantHealthRepair', true);
      let repair = null;
      try {
        repair = await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/system/repair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actions: ['camera_restart', 'reset_streams', 'clear_camera_clients', 'release_legacy_capture', 'apply_runtime_policy', 'restart_ollama', 'pull_ai_models'] })
        }, 'Assistant health repair failed', 'AssistantHealthRepair');
      } catch (error) {
        setLastError(error.message || 'Health repair failed.');
      }
      return start.ok || repair?.ok
        ? `Done ${name}, I requested backend, camera, and AI repair.`
        : `I tried ${name}, but repair did not finish. Open the Health page for the exact error.`;
    }

    async function switchAssistantCameraTo(cameraIndex) {
      const safeIndex = Math.max(0, Math.min(12, Number.isFinite(Number(cameraIndex)) ? Number(cameraIndex) : 0));
      setRemoteCameraSettings({
        cameraDevice: safeIndex,
        cameraEnabled: true,
        cameraMode: 'live',
        privacyMode: false
      });
      await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/remote-camera/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_device: safeIndex,
          camera_enabled: true,
          camera_mode: 'live',
          privacy_mode: false
        })
      }, 'Camera switch failed', `AssistantCamera${safeIndex}`);
      await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/local-camera/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera_index: safeIndex })
      }, 'Camera restart failed', `AssistantCamera${safeIndex}`);
      window.history.pushState(null, '', '/localhost-camera');
      setPage('localCamera');
      return `Done ${name}, switching to camera ${safeIndex}.`;
    }

    async function switchAssistantCamera() {
      const cameraMatch = lower.match(/\b(?:camera|cam|device)\s*(\d{1,2})\b/) || lower.match(/\b(?:to|use)\s*(\d{1,2})\b/);
      const requested = lower.includes('lenovo') || lower.includes('usb')
        ? 1
        : (lower.includes('laptop') || lower.includes('integrated') || lower.includes('built in') || lower.includes('built-in'))
          ? 0
          : cameraMatch ? Number(cameraMatch[1]) : remoteCameraSettings.cameraDevice;
      return switchAssistantCameraTo(requested);
    }

    function playMusicFromCommand() {
      if (!musicPlayer.tracks.length) {
        setBackgroundServices({ musicScan: true });
        return `I cannot play music yet ${name}. I enabled music scan; add tracks to the KISOKE music folder.`;
      }
      const rawQuery = lower
        .replace(/\b(play|music|song|track|please|nexora|hey)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const matchedIndex = rawQuery
        ? musicPlayer.tracks.findIndex((track) => `${track.title || ''} ${track.file || ''}`.toLowerCase().includes(rawQuery))
        : -1;
      musicPlayer.selectTrack(matchedIndex >= 0 ? matchedIndex : musicPlayer.trackIndex || 0);
      return matchedIndex >= 0
        ? `Done ${name}, playing ${musicPlayer.tracks[matchedIndex].title || 'that track'}.`
        : `Done ${name}, playing music.`;
    }

    async function executeBackendAssistantAction(data) {
      const action = String(data?.action || 'chat');
      const args = data?.arguments && typeof data.arguments === 'object' ? data.arguments : {};
      const baseReply = data?.reply || `Done ${name}.`;
      const actionPercent = args.percent != null ? clampNumber(args.percent, 0, 100) : null;
      const actionMinutes = args.minutes != null ? clampNumber(args.minutes, 1, 180) : null;

      switch (action) {
        case 'open_settings':
          setPage('settings');
          return { reply: baseReply || `Hi ${name}, opening settings.` };
        case 'open_dashboard':
          setPage('dashboard');
          return { reply: baseReply || `Hi ${name}, opening dashboard.` };
        case 'open_clock':
          setPage('clock');
          return { reply: baseReply || `Hi ${name}, opening the live clock.` };
        case 'open_signal':
          window.history.pushState(null, '', '/signal-center');
          setPage('signal');
          return { reply: baseReply || `Hi ${name}, opening Signal Center.` };
        case 'open_radar':
          window.history.pushState(null, '', '/radar');
          setPage('radar');
          return { reply: baseReply || `Hi ${name}, opening Radar.` };
        case 'open_bedroom':
          window.history.pushState(null, '', '/my-bedroom');
          setPage('bedroom');
          return { reply: baseReply || `Hi ${name}, opening My Bedroom.` };
        case 'bedroom_status':
          return { reply: bedroomAssistantReply(await fetchBedroomAssistantReading()) };
        case 'open_music':
          window.history.pushState(null, '', '/music');
          setPage('music');
          return { reply: baseReply || `Hi ${name}, opening Music.` };
        case 'open_ollama':
          window.history.pushState(null, '', '/ollama-ai');
          setPage('ollama');
          return { reply: baseReply || `Hi ${name}, opening Ollama AI.` };
        case 'open_projects':
          window.history.pushState(null, '', '/projects');
          setPage('projects');
          return { reply: baseReply || `Hi ${name}, opening Projects.` };
        case 'open_camera':
          window.history.pushState(null, '', '/localhost-camera');
          setPage('localCamera');
          return { reply: baseReply || `Hi ${name}, opening the camera.` };
        case 'open_alarm':
          setPage('timeTools');
          setActiveTimeDeckSection('alarm');
          return { reply: baseReply || `Done ${name}, opening alarms.` };
        case 'open_countdown':
          setPage('timeTools');
          setActiveTimeDeckSection('countdown');
          return { reply: baseReply || `Done ${name}, opening countdown.` };
        case 'open_stopwatch':
          setPage('timeTools');
          setActiveTimeDeckSection('stopwatch');
          return { reply: baseReply || `Done ${name}, opening stopwatch.` };
        case 'open_world_clock':
          setPage('timeTools');
          setActiveTimeDeckSection('world');
          return { reply: baseReply || `Done ${name}, opening world clock.` };
        case 'open_prayer_focus':
          setPage('timeTools');
          setActiveTimeDeckSection('prayer');
          return { reply: baseReply || `Done ${name}, opening prayer focus.` };
        case 'theme_red_night':
          setManualMode('night');
          setAutoColor(false);
          return { reply: baseReply || `Done ${name}, switching to red night mode.` };
        case 'theme_dark':
          setManualMode('slate');
          setAutoColor(false);
          return { reply: baseReply || `Done ${name}, switching to dark mode.` };
        case 'theme_light':
          setManualMode('white');
          setAutoColor(false);
          return { reply: baseReply || `Done ${name}, switching to light mode.` };
        case 'theme_auto':
          setAutoColor(true);
          return { reply: baseReply || `Done ${name}, auto theme is back on.` };
        case 'study_mode':
          setRoomMode('focus');
          setSleepMode(false);
          setPage('dashboard');
          return { reply: baseReply || `Okay ${name}, study mode is ready.` };
        case 'sleep_mode':
          setRoomMode('sleep');
          setSleepMode(true);
          setManualMode('night');
          setPage('clock');
          return { reply: baseReply || `Okay ${name}, sleep mode is ready.` };
        case 'show_weather':
        case 'show_prayer':
          setPage('dashboard');
          return { reply: baseReply };
        case 'start_countdown':
          timeDesk.startCountdown(actionMinutes || 10);
          setPage('timeTools');
          setActiveTimeDeckSection('countdown');
          return { reply: baseReply || `Done ${name}, countdown started for ${actionMinutes || 10} minutes.` };
        case 'start_timer':
          timeDesk.startTimer(actionMinutes || 10);
          setPage('timeTools');
          setActiveTimeDeckSection('countdown');
          return { reply: baseReply || `Done ${name}, timer started for ${actionMinutes || 10} minutes.` };
        case 'pause_countdown':
          timeDesk.pauseCountdown();
          setPage('timeTools');
          setActiveTimeDeckSection('countdown');
          return { reply: baseReply || `Done ${name}, countdown paused.` };
        case 'reset_countdown':
          timeDesk.resetCountdown();
          setPage('timeTools');
          setActiveTimeDeckSection('countdown');
          return { reply: baseReply || `Done ${name}, countdown reset.` };
        case 'start_stopwatch':
          timeDesk.startStopwatch();
          setPage('timeTools');
          setActiveTimeDeckSection('stopwatch');
          return { reply: baseReply || `Done ${name}, stopwatch started.` };
        case 'stop_stopwatch':
          timeDesk.pauseStopwatch();
          setPage('timeTools');
          setActiveTimeDeckSection('stopwatch');
          return { reply: baseReply || `Done ${name}, stopwatch paused.` };
        case 'reset_stopwatch':
          timeDesk.resetStopwatch();
          setPage('timeTools');
          setActiveTimeDeckSection('stopwatch');
          return { reply: baseReply || `Done ${name}, stopwatch reset.` };
        case 'set_volume':
          return { reply: await devicePost('/api/device/volume', { percent: actionPercent ?? 35 }, baseReply || `Done ${name}, volume updated.`), handledAudio: true };
        case 'mute_volume':
          return { reply: await devicePost('/api/device/volume/mute', { muted: true }, baseReply || `Done ${name}, audio is muted.`), handledAudio: true };
        case 'set_brightness':
          return { reply: await devicePost('/api/device/brightness', { percent: Math.max(1, actionPercent ?? 50) }, baseReply || `Done ${name}, brightness updated.`), handledAudio: true };
        case 'brighter':
          return { reply: await devicePost('/api/device/brightness', { percent: 85 }, baseReply || `Done ${name}, screen is brighter.`), handledAudio: true };
        case 'dim_screen':
          return { reply: await devicePost('/api/device/brightness', { percent: 15 }, baseReply || `Done ${name}, screen is dim.`), handledAudio: true };
        case 'night_light_on':
          return { reply: await devicePost('/api/device/night-light', { enabled: true }, baseReply || 'Night Light is now on.'), handledAudio: true };
        case 'night_light_off':
          return { reply: await devicePost('/api/device/night-light', { enabled: false }, baseReply || 'Night Light is now off.'), handledAudio: true };
        case 'play_music':
          return { reply: playMusicFromCommand() };
        case 'pause_music':
          musicPlayer.pause();
          return { reply: baseReply || `Done ${name}, music paused.` };
        case 'next_music':
          musicPlayer.nextTrack();
          return { reply: baseReply || `Done ${name}, next track.` };
        case 'shuffle_music':
          musicPlayer.shuffleTrack();
          return { reply: baseReply || `Done ${name}, shuffling music.` };
        case 'switch_camera':
          return { reply: await switchAssistantCameraTo(args.camera_index ?? remoteCameraSettings.cameraDevice) };
        case 'health_summary':
          return { reply: await summarizeHealthForAssistant() };
        case 'health_repair':
        case 'download_ai_models':
          return { reply: await runAssistantHealthRepair() };
        case 'set_model_easy':
          patchAssistantSettings({ modelTier: '2.5' });
          return { reply: baseReply || `Done ${name}, easy model mode is selected.` };
        case 'set_model_hard':
          patchAssistantSettings({ modelTier: '4.5' });
          return { reply: baseReply || `Done ${name}, hard model mode is selected.` };
        case 'set_model_auto':
          patchAssistantSettings({ modelTier: 'auto' });
          return { reply: baseReply || `Done ${name}, auto model mode is selected.` };
        case 'turn_off_athan':
          patchAssistantSettings({ athanEnabled: false });
          return { reply: baseReply || `Done ${name}, athan reminders are disabled.` };
        case 'turn_on_athan':
          patchAssistantSettings({ athanEnabled: true, athanVoiceEnabled: true });
          return { reply: baseReply || `Done ${name}, athan reminders are enabled.` };
        case 'chat':
        case 'reply':
        default:
          return { reply: baseReply || `I heard "${command}".` };
      }
    }

    async function askCommandRouter() {
      try {
        const selectedModel = chooseAssistantModel(assistantSettings, command);
        const [browserLocation, bedroomReading] = await Promise.all([
          readBrowserLocation(1200),
          commandNeedsBedroomContext(command) ? fetchBedroomAssistantReading() : Promise.resolve(null)
        ]);
        const response = await fetchJsonWithBackendRecovery(`${DEVICE_API_BASE}/api/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command,
            easy_model: assistantSettings.easyModel || modelForTier(assistantSettings, '2.5'),
            hard_model: assistantSettings.hardModel || modelForTier(assistantSettings, '4.5'),
            settings: assistantSettings,
            context: {
              route: page,
              timeFormat,
              clockCity: locationSettings.clockCity,
              clockTimezone: locationSettings.clockTimezone,
              weatherCity: locationSettings.weatherName || weather?.locationName,
              weatherCondition: weather?.condition,
              temperature: weather?.temperature,
              bedroomSensor: bedroomReading,
              browserLocation,
              selectedModel: selectedModel.model
            }
          })
        }, 'Assistant command router failed', 'AssistantCommandRouter');
        const { reply: routedReply, handledAudio } = await executeBackendAssistantAction(response);
        const finalReply = routedReply || response.reply || `Done ${name}.`;
        if (!handledAudio) {
          pushToast(response.source === 'offline-fallback' ? 'Local AI offline' : `${assistantSettings.assistantName} command`, finalReply, response.ok === false ? 'amber' : 'blue');
          speakClient(finalReply, assistantSettings);
        }
        return finalReply;
      } catch (error) {
        const fallback = `I heard "${command}", but the local command AI is offline: ${error.message || 'backend did not answer'}.`;
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
    const mentionsCameraSwitch = /\b(switch|change|select|use)\b.*\b(camera|cam|webcam)\b/.test(lower) || /\b(camera|cam|webcam)\s*\d{1,2}\b/.test(lower);
    const mentionsMusicPlay = /\b(play|start)\b.*\b(music|song|track|audio)\b/.test(lower) || lower.startsWith('play ');
    const matchedAthanPrayer = ATHAN_PRAYER_NAMES.find((prayerName) => lower.includes(prayerName.toLowerCase()))
      || (lower.includes('morning') || lower.includes('الفجر') ? 'Fajr' : null);
    const aiNameMatch = command.match(/\b(?:set|change)\s+(?:ai|assistant)\s+name\s+(?:to\s+)?([a-z0-9 _-]{2,24})$/i);
    const callMeMatch = command.match(/\b(?:call me|my name is)\s+([a-z0-9 _-]{2,32})$/i);

    function patchAssistantSettings(patch) {
      setAssistantSettings((current) => ({ ...current, ...patch }));
    }

    if (asksTime) {
      const detectedTarget = findAssistantTimeZone(command);
      if (!detectedTarget && /\b(in|for|at)\b/.test(lower)) return askLocalAI();
      const target = detectedTarget || { city: locationSettings.clockCity || 'your kiosk clock', timezone: locationSettings.clockTimezone };
      reply = `Hi ${name}, the time in ${target.city} is ${formatTimeZone(now, target.timezone, timeFormat, { seconds: true })}.`;
    } else if (asksWeather && !lower.includes('show weather')) {
      reply = `Hi ${name}, ${formatAssistantWeather(weather, locationSettings, now)}.`;
    } else if (lower.includes('health summary') || lower.includes('summarize health') || lower.includes('system status') || lower.includes('check health')) {
      reply = await summarizeHealthForAssistant();
    } else if (lower.includes('repair health') || lower.includes('fix health') || lower.includes('auto repair') || lower.includes('fix backend') || lower.includes('fix camera') || lower.includes('fix ai')) {
      reply = await runAssistantHealthRepair();
    } else if (lower.includes('download ai') || lower.includes('install ai') || lower.includes('pull models') || lower.includes('download models')) {
      reply = await runAssistantHealthRepair();
    } else if (aiNameMatch) {
      const nextName = aiNameMatch[1].trim();
      patchAssistantSettings({ assistantName: nextName, customWakePhrase: `Hey ${nextName}` });
      reply = `Done ${name}, my assistant name is now ${nextName}.`;
    } else if (callMeMatch) {
      const nextName = callMeMatch[1].trim();
      patchAssistantSettings({ callNames: nextName, startupCallName: nextName, introName: nextName, randomizeCallName: false });
      reply = `Done ${nextName}, I will call you ${nextName}.`;
    } else if (lower.includes('voice replies off') || lower.includes('stop talking back') || lower.includes('turn off voice replies')) {
      patchAssistantSettings({ voiceReplies: false });
      reply = `Done ${name}, voice replies are off.`;
    } else if (lower.includes('voice replies on') || lower.includes('talk back') || lower.includes('turn on voice replies')) {
      patchAssistantSettings({ voiceReplies: true });
      reply = `Done ${name}, voice replies are on.`;
    } else if (lower.includes('always listen off') || lower.includes('turn off always listen')) {
      patchAssistantSettings({ alwaysListen: false, voiceMode: 'press' });
      reply = `Done ${name}, always listening is off.`;
    } else if (lower.includes('always listen on') || lower.includes('turn on always listen')) {
      patchAssistantSettings({ alwaysListen: true, voiceMode: 'wake' });
      reply = `Done ${name}, wake-word listening is on.`;
    } else if (lower.includes('easy model') || lower.includes('fast model')) {
      patchAssistantSettings({ modelTier: '2.5' });
      reply = `Done ${name}, easy model mode is selected.`;
    } else if (lower.includes('hard model') || lower.includes('smart model')) {
      patchAssistantSettings({ modelTier: '4.5' });
      reply = `Done ${name}, hard model mode is selected.`;
    } else if (lower.includes('auto model')) {
      patchAssistantSettings({ modelTier: 'auto' });
      reply = `Done ${name}, auto model mode is selected.`;
    } else if (mentionsCameraSwitch) {
      reply = await switchAssistantCamera();
    } else if (mentionsMusicPlay) {
      reply = playMusicFromCommand();
    } else if (lower.includes('pause music') || lower.includes('stop music')) {
      musicPlayer.pause();
      reply = `Done ${name}, music paused.`;
    } else if (lower.includes('next music') || lower.includes('next song') || lower.includes('next track')) {
      musicPlayer.nextTrack();
      reply = `Done ${name}, next track.`;
    } else if (lower.includes('shuffle music') || lower.includes('shuffle songs')) {
      musicPlayer.shuffleTrack();
      reply = `Done ${name}, shuffling music.`;
    } else if ((lower.includes('disable athan') || lower.includes('turn off athan') || lower.includes('mute athan') || lower.includes('stop athan')) && matchedAthanPrayer) {
      const enabledMap = normalizeAthanPerPrayer(assistantSettings.athanPerPrayer);
      patchAssistantSettings({ athanPerPrayer: { ...enabledMap, [matchedAthanPrayer]: false } });
      reply = `Done ${name}, ${matchedAthanPrayer} athan is disabled.`;
    } else if ((lower.includes('enable athan') || lower.includes('turn on athan')) && matchedAthanPrayer) {
      const enabledMap = normalizeAthanPerPrayer(assistantSettings.athanPerPrayer);
      patchAssistantSettings({ athanEnabled: true, athanVoiceEnabled: true, athanPerPrayer: { ...enabledMap, [matchedAthanPrayer]: true } });
      reply = `Done ${name}, ${matchedAthanPrayer} athan is enabled.`;
    } else if (lower.includes('disable athan') || lower.includes('turn off athan') || lower.includes('mute all athan') || lower.includes('stop all athan')) {
      patchAssistantSettings({ athanEnabled: false });
      reply = `Done ${name}, athan reminders are disabled.`;
    } else if (lower.includes('enable athan') || lower.includes('turn on athan')) {
      patchAssistantSettings({ athanEnabled: true, athanVoiceEnabled: true });
      reply = `Done ${name}, athan reminders are enabled.`;
    } else if (lower.includes('silent athan') || lower.includes('athan silent')) {
      patchAssistantSettings({ athanVoiceEnabled: false });
      reply = `Done ${name}, athan will stay silent.`;
    } else if (lower.includes('athan speak') || lower.includes('athan voice')) {
      patchAssistantSettings({ athanEnabled: true, athanVoiceEnabled: true });
      reply = `Done ${name}, athan voice is enabled.`;
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
    } else if (lower.includes('my bedroom') || lower.includes('bedroom sensor') || lower.includes('esp32') || lower.includes('sensor hub')) {
      window.history.pushState(null, '', '/my-bedroom');
      setPage('bedroom');
      reply = `Hi ${name}, opening My Bedroom.`;
    } else if (lower.includes('open music') || lower.includes('show music') || lower === 'music') {
      window.history.pushState(null, '', '/music');
      setPage('music');
      reply = `Hi ${name}, opening Music.`;
    } else if (lower.includes('open ollama') || lower.includes('show ollama') || lower.includes('open local ai') || lower.includes('show local ai') || lower.includes('open ai models')) {
      window.history.pushState(null, '', '/ollama-ai');
      setPage('ollama');
      reply = `Hi ${name}, opening Ollama AI.`;
    } else if (lower.includes('open projects') || lower.includes('show projects') || lower === 'projects') {
      window.history.pushState(null, '', '/projects');
      setPage('projects');
      reply = `Hi ${name}, opening Projects.`;
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
      window.clearInterval(alarmBrightnessRampRef.current);
      alarmBrightnessRampRef.current = null;
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
      return askCommandRouter();
    }

    if (assistantSettings.replyLanguage === 'ar' && !/[\u0600-\u06FF]/.test(reply)) {
      reply = `تم يا ${name}.`;
    } else if (assistantSettings.replyLanguage === 'both' && !/[\u0600-\u06FF]/.test(reply)) {
      reply = `${reply} / تم يا ${name}.`;
    }
    pushToast(assistantSettings.assistantName, reply, 'blue');
    speakClient(reply, assistantSettings);
    return reply;
  }, [
    assistantSettings,
    locationSettings,
    weather,
    now,
    timeFormat,
    timeDesk,
    timeAlarms,
    pushToast,
    setRoomMode,
    commandHistory,
    musicPlayer,
    remoteCameraSettings,
    setAssistantSettings,
    setBackgroundServices,
    setRemoteCameraSettings,
    setAutoColor,
    setManualMode,
    setSleepMode,
    page
  ]);

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
  const offlineVoice = useBackendOfflineVoice(assistantSettings, runAssistantCommand, pushToast);
  const visibleVoiceAssistant = useMemo(() => {
    if (!offlineVoice.running) return voiceAssistant;
    const offlineActive = ['listening', 'heard wake word', 'thinking', 'speaking', 'error'].includes(offlineVoice.phase);
    if (!offlineActive && voiceAssistant.listening) return voiceAssistant;
    return {
      ...voiceAssistant,
      listening: true,
      armed: true,
      wakeActive: offlineVoice.phase === 'heard wake word' || voiceAssistant.wakeActive,
      transcript: offlineVoice.transcript || voiceAssistant.transcript,
      phase: offlineVoice.phase || voiceAssistant.phase,
      error: voiceAssistant.error || offlineVoice.error,
      lastEvent: offlineVoice.lastEvent || voiceAssistant.lastEvent
    };
  }, [voiceAssistant, offlineVoice.running, offlineVoice.phase, offlineVoice.transcript, offlineVoice.error, offlineVoice.lastEvent]);

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
      if (event.ctrlKey || event.metaKey || event.altKey) return;
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
      style={{
        '--kisoke-widget-radius': `${kioskSettings.settings.appearance.widgetRadius}px`,
        '--kisoke-widget-gap': `${kioskSettings.settings.appearance.widgetSpacing}px`,
        '--kisoke-card-alpha': Math.max(0.4, Math.min(1, kioskSettings.settings.appearance.cardTransparency / 100)),
        '--kisoke-font-scale': kioskSettings.settings.appearance.fontScale / 100,
        '--kisoke-icon-scale': kioskSettings.settings.appearance.iconScale / 100,
        '--kisoke-blur': `${kioskSettings.settings.appearance.blurStrength}px`,
        '--kisoke-shadow-strength': kioskSettings.settings.appearance.shadowStrength / 100
      }}
      dir={languageSettings.language === 'ar' ? 'rtl' : 'ltr'}
      lang={languageSettings.language === 'ar' ? 'ar' : 'en'}
    >
      <audio ref={musicPlayer.audioRef} onEnded={musicPlayer.nextTrack} preload="metadata" />
      <div className="depth-layer depth-background" aria-hidden="true" />
      <div className="depth-layer depth-particles" aria-hidden="true" />
      <div className="depth-layer depth-glow" aria-hidden="true" />
      <ToastStack toasts={toasts} />
      <ConnectionBanner status={connectionStatus} />
      {!cameraFocusMode && !blackout && <ListeningOrb settings={activeAssistantSettings} voice={visibleVoiceAssistant} appearance={kioskSettings.settings.ai} />}
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
        {page === 'smartWake' ? (
          <motion.div
            className="page-shell"
            key="smart-wake"
            initial={{ y: 32, opacity: 0, filter: 'blur(3px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: 32, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="smart-wake-error">
              <SmartWakePage
                now={now}
                weather={weather}
                weatherUnit={kioskSettings.settings.weather.unit}
                prayer={prayer}
                alarm={alarm}
                timeFormat={timeFormat}
                assistantSettings={assistantSettings}
                musicPlayer={musicPlayer}
                onClose={() => { window.history.pushState(null, '', '/'); setPage('clock'); }}
              />
            </PageErrorBoundary>
          </motion.div>
        ) : page === 'timeTools' ? (
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
            <PageErrorBoundary key="dashboard-error">
              <Dashboard
                now={now}
                weather={weather}
                weatherUnit={kioskSettings.settings.weather.unit}
                prayer={prayer}
                prayerData={prayerData}
                prayerSettings={prayerSettings}
                timeFormat={timeFormat}
                alarm={alarm}
                customWidgets={customWidgets}
                setCustomWidgets={setCustomWidgets}
                customSections={customSections}
                setCustomSections={setCustomSections}
                deletedWidgets={deletedWidgets}
                deleteCustomWidget={deleteCustomWidget}
                toggleWidgetLock={toggleWidgetLock}
                restoreDeletedWidget={restoreDeletedWidget}
                restoreAllDeletedWidgets={restoreAllDeletedWidgets}
                musicLibrary={musicLibrary}
                musicPlayer={musicPlayer}
                cameraWakeEnabled={cameraWakeEnabled}
                setCameraWakeEnabled={setCameraWakeEnabled}
                cameraWakeStatus={cameraWakeStatus}
                cameraVideoRef={cameraVideoRef}
                ambientPhase={ambientPhase}
                weatherMood={weatherMood}
                dashboardTheme={dashboardTheme}
                sleepMode={effectiveSleepMode}
                setSleepMode={setSleepMode}
                idle={idle}
                noiseEnabled={noiseEnabled}
                setNoiseEnabled={setNoiseEnabled}
                noise={noise}
                focus={focus}
                roomMode={roomMode}
                setRoomMode={setRoomMode}
                focusLock={focusLock}
                setFocusLock={setFocusLock}
                battery={battery}
                caffeine={caffeine}
                assistantSettings={assistantSettings}
                voiceAssistant={voiceAssistant}
                offlineVoice={offlineVoice}
                runAssistantCommand={runAssistantCommand}
                pushToast={pushToast}
                locationSettings={locationSettings}
                performanceMode={performanceMode}
                setPerformanceMode={setPerformanceMode}
                backgroundServices={backgroundServices}
                setBackgroundServices={setBackgroundServices}
                openBrainDump={() => setBrainDumpOpen(true)}
                openQuickControls={() => setQuickControlsOpen(true)}
                goClock={() => setPage('clock')}
                goSettings={() => setPage('settings')}
                goSignal={() => setPage('signal')}
                goRadar={() => { window.history.pushState(null, '', '/radar'); setPage('radar'); }}
                goBedroom={() => { window.history.pushState(null, '', '/my-bedroom'); setPage('bedroom'); }}
                goGames={() => { window.history.pushState(null, '', '/games'); setPage('games'); }}
                goMusic={() => { window.history.pushState(null, '', '/music'); setPage('music'); }}
                goProjects={() => { window.history.pushState(null, '', '/projects'); setPage('projects'); }}
                goOllama={() => { window.history.pushState(null, '', '/ollama-ai'); setPage('ollama'); }}
                goRemoteCamera={() => { window.history.pushState(null, '', '/localhost-camera'); setPage('localCamera'); }}
                goQuickAccess={() => setQuickControlsOpen(true)}
                goApps={() => { window.history.pushState(null, '', '/apps'); setPage('apps'); }}
                goBrowser={() => { window.history.pushState(null, '', '/browser'); setPage('browser'); }}
                goDashboardCustomisation={() => { window.history.pushState(null, '', '/dashboard-customisation'); setPage('dashboardCustomisation'); }}
                kioskSettings={kioskSettings}
              />
            </PageErrorBoundary>
          </motion.div>
        ) : page === 'dashboardCustomisation' ? (
          <motion.div
            className="page-shell"
            key="dashboard-customisation"
            initial={{ y: 26, opacity: 0, filter: 'blur(2px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: 26, opacity: 0, filter: 'blur(2px)' }}
            transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.72 }}
          >
            <PageErrorBoundary key="dashboard-customisation-error"><DashboardCustomisationPage mode={mode} kioskSettings={kioskSettings} setDashboardTheme={setDashboardTheme} setLookStyle={setLookStyle} goBack={() => { window.history.pushState(null, '', '/settings'); setPage('settings'); }} goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }} goApps={() => { window.history.pushState(null, '', '/apps'); setPage('apps'); }} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'apps' ? (
          <motion.div
            className="page-shell"
            key="apps"
            initial={{ x: 44, opacity: 0, filter: 'blur(2px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 44, opacity: 0, filter: 'blur(2px)' }}
            transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.72 }}
          >
            <PageErrorBoundary key="apps-error"><MostUsedAppsPage mode={mode} kioskSettings={kioskSettings} goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }} goSettings={() => { window.history.pushState(null, '', '/settings'); setPage('settings'); }} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'browser' ? (
          <motion.div
            className="page-shell"
            key="browser"
            initial={{ x: 44, opacity: 0, filter: 'blur(2px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 44, opacity: 0, filter: 'blur(2px)' }}
            transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.72 }}
          >
            <PageErrorBoundary key="browser-error"><KioskBrowserPage mode={mode} kioskSettings={kioskSettings} goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }} /></PageErrorBoundary>
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
        ) : page === 'bedroom' ? (
          <motion.div
            className="page-shell"
            key="bedroom"
            initial={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="bedroom-error"><MyBedroomPage now={now} goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'games' ? (
          <motion.div
            className="page-shell"
            key="games"
            initial={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="games-error"><GamingPage goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'music' ? (
          <motion.div
            className="page-shell"
            key="music"
            initial={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="music-error"><MusicPage goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }} library={musicLibrary} player={musicPlayer} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'projects' ? (
          <motion.div
            className="page-shell"
            key="projects"
            initial={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="projects-error"><ProjectsPage goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }} pushToast={pushToast} /></PageErrorBoundary>
          </motion.div>
        ) : page === 'ollama' ? (
          <motion.div
            className="page-shell"
            key="ollama"
            initial={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: 64, opacity: 0, filter: 'blur(3px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.75 }}
          >
            <PageErrorBoundary key="ollama-error"><OllamaAiPage goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }} assistantSettings={assistantSettings} setAssistantSettings={setAssistantSettings} pushToast={pushToast} /></PageErrorBoundary>
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
            <PageErrorBoundary key="settings-error"><ToolsPage now={now} mode={mode} manualMode={manualMode} autoColor={autoColor} setManualMode={setManualMode} dashboardTheme={dashboardTheme} setDashboardTheme={setDashboardTheme} alarm={alarm} setAlarm={setAlarm} timeFormat={timeFormat} setTimeFormat={setTimeFormat} customWidgets={customWidgets} setCustomWidgets={setCustomWidgets} customSections={customSections} setCustomSections={setCustomSections} deletedWidgets={deletedWidgets} setDeletedWidgets={setDeletedWidgets} deleteCustomWidget={deleteCustomWidget} toggleWidgetLock={toggleWidgetLock} restoreDeletedWidget={restoreDeletedWidget} restoreAllDeletedWidgets={restoreAllDeletedWidgets} resetCustomWidgets={resetCustomWidgets} goBack={() => setPage('clock')} goDashboard={() => { window.history.pushState(null, '', '/dashboard'); setPage('dashboard'); }} goSoftware={() => { window.history.pushState(null, '', '/software-needed'); setPage('software'); }} goRemoteCamera={() => { window.history.pushState(null, '', '/remote-camera'); setPage('remoteCamera'); }} setAutoColor={setAutoColor} setRoomMode={setRoomMode} assistantSettings={assistantSettings} setAssistantSettings={setAssistantSettings} voiceAssistant={voiceAssistant} offlineVoice={offlineVoice} locationSettings={locationSettings} setLocationSettings={setLocationSettings} lookStyle={lookStyle} setLookStyle={setLookStyle} performanceMode={performanceMode} setPerformanceMode={setPerformanceMode} backgroundServices={backgroundServices} setBackgroundServices={setBackgroundServices} timeDeckSettings={timeDeckSettings} setTimeDeckSettings={setTimeDeckSettings} activeTimeDeckSection={activeTimeDeckSection} setActiveTimeDeckSection={setActiveTimeDeckSection} worldClocks={worldClocks} setWorldClocks={setWorldClocks} currentPage={page} weather={weather} weatherMood={weatherMood} battery={battery} lastCommand={lastCommand} lastError={lastError} pushToast={pushToast} presenceSettings={presenceSettings} setPresenceSettings={setPresenceSettings} commandHistory={commandHistory.history} clearCommandHistory={commandHistory.clearHistory} remoteCameraSettings={remoteCameraSettings} setRemoteCameraSettings={setRemoteCameraSettings} securityLog={securityLog} languageSettings={languageSettings} setLanguageSettings={setLanguageSettings} prayerSettings={prayerSettings} setPrayerSettings={setPrayerSettings} prayerData={prayerData} kioskSettings={kioskSettings} goDashboardCustomisation={() => { window.history.pushState(null, '', '/dashboard-customisation'); setPage('dashboardCustomisation'); }} /></PageErrorBoundary>
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
