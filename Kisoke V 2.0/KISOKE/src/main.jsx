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
  Bot,
  Camera,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
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
  Lock,
  Mic,
  Minus,
  Moon,
  Monitor,
  Music2,
  Network,
  Newspaper,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Shuffle,
  SkipForward,
  Send,
  Settings,
  Sun,
  Target,
  Thermometer,
  Trash2,
  Undo2,
  Unlock,
  Volume2,
  VolumeX,
  Wind,
  Trophy,
  Wifi
} from 'lucide-react';
import './styles.css';

const AJMAN = { lat: 25.4052, lon: 55.5136 };
const DEFAULT_WEATHER_LOCATION = {
  id: 'ajman',
  name: 'Ajman',
  country: 'United Arab Emirates',
  lat: 25.4052,
  lon: 55.5136,
  timezone: 'Asia/Dubai'
};
const WEATHER_LOCATION_KEY = 'nexora.weather-location.v1';
const CLOCK_TIMEZONE_KEY = 'nexora.clock-timezone.v1';
const WEATHER_BACKGROUND_OVERRIDE_KEY = 'nexora.weather-background-override.v1';
const STORAGE_KEY = 'nexora.todos.v1';
const ALARM_KEY = 'nexora.alarm.v1';
const WORLD_CLOCK_KEY = 'nexora.world-clocks.v1';
const TIME_FORMAT_KEY = 'nexora.time-format.v1';
const CUSTOM_WIDGETS_KEY = 'nexora.custom-widgets.v1';
const DELETED_WIDGETS_KEY = 'nexora.deleted-widgets.v1';
const CUSTOM_SECTIONS_KEY = 'nexora.custom-sections.v1';
const DASHBOARD_LAYOUT_KEY = 'nexora.dashboard-layout.v5';
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
const CLOCK_BACKGROUND_KEY = 'nexora.clock-background.v1';
const CLOCK_BACKGROUND_MIGRATION_KEY = 'nexora.clock-background-weather-default.v1';
const CLOCK_AUTO_DEFAULT_MIGRATION_KEY = 'nexora.clock-auto-default.v1';
const CLOCK_MANUAL_OVERRIDE_KEY = 'nexora.clock-manual-override.v1';
const WIDGET_UNDO_WINDOW_MS = 25 * 60 * 1000;
const IDLE_TIMEOUT_MS = 4 * 60 * 1000;
const SYSTEM_REFRESH_MS = 15 * 1000;
const MUSIC_LIBRARY_REFRESH_MS = 15 * 1000;
const CLOCK_BACKGROUNDS = [
  { id: 'ambient', label: 'Static Theme', detail: 'Only use the selected clock color' },
  { id: 'weather', label: 'Live Weather', detail: 'Animated wallpaper from current conditions' },
  { id: 'celestial', label: 'Sun / Moon', detail: 'One sky body follows day and night' }
];
const WEATHER_LOCATION_PRESETS = [
  DEFAULT_WEATHER_LOCATION,
  { id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708, timezone: 'Asia/Dubai' },
  { id: 'abu-dhabi', name: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.4539, lon: 54.3773, timezone: 'Asia/Dubai' },
  { id: 'sharjah', name: 'Sharjah', country: 'United Arab Emirates', lat: 25.3463, lon: 55.4209, timezone: 'Asia/Dubai' },
  { id: 'mecca', name: 'Mecca', country: 'Saudi Arabia', lat: 21.3891, lon: 39.8579, timezone: 'Asia/Riyadh' },
  { id: 'sarajevo', name: 'Sarajevo', country: 'Bosnia', lat: 43.8563, lon: 18.4131, timezone: 'Europe/Sarajevo' },
  { id: 'london', name: 'London', country: 'United Kingdom', lat: 51.5072, lon: -0.1276, timezone: 'Europe/London' },
  { id: 'beijing', name: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074, timezone: 'Asia/Shanghai' },
  { id: 'shanghai', name: 'Shanghai', country: 'China', lat: 31.2304, lon: 121.4737, timezone: 'Asia/Shanghai' }
];
const WEATHER_BACKGROUND_OVERRIDES = [
  { id: 'live', label: 'Live', detail: 'Follow Open-Meteo exactly' },
  { id: 'clear', label: 'Clear', detail: 'No rain animation' },
  { id: 'cloudy', label: 'Cloudy', detail: 'Soft moving clouds' },
  { id: 'rain', label: 'Rain', detail: 'Force rain ambience' },
  { id: 'storm', label: 'Thunder', detail: 'Force storm ambience' },
  { id: 'windy', label: 'Windy', detail: 'Wind sweep background' },
  { id: 'hot', label: 'Hot', detail: 'Heat haze background' },
  { id: 'humid', label: 'Humid', detail: 'Mist/humidity background' }
];
const CLOCK_TIMEZONE_PRESETS = [
  { id: 'local', label: 'Device time', zone: 'local', detail: 'Use this laptop time' },
  { id: 'dubai', label: 'Dubai', zone: 'Asia/Dubai', detail: 'UAE time' },
  { id: 'china', label: 'China', zone: 'Asia/Shanghai', detail: 'Beijing / Shanghai' },
  { id: 'bosnia', label: 'Bosnia', zone: 'Europe/Sarajevo', detail: 'Sarajevo' },
  { id: 'london', label: 'London', zone: 'Europe/London', detail: 'UK time' },
  { id: 'new-york', label: 'New York', zone: 'America/New_York', detail: 'US Eastern' },
  { id: 'tokyo', label: 'Tokyo', zone: 'Asia/Tokyo', detail: 'Japan' }
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
  { id: 'focus', label: 'Focus' },
  { id: 'relax', label: 'Relax' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'prayer', label: 'Prayer' },
  { id: 'away', label: 'Away' }
];
const AI_MODELS = [
  { id: 'easy', label: 'Easy Model', detail: 'Fast responses for simple tasks' },
  { id: 'hard', label: 'Hard Model', detail: 'Advanced reasoning for complex tasks' }
];
const AI_ASSISTANT_KEY = 'nexora.assistant.v1';
const DEFAULT_ASSISTANT_NAME = 'Nexora';
const SMART_THEME_KEY = 'nexora.smart-theme.v1';
const AI_ASSISTANT_DEFAULTS = {
  assistantName: 'Nexora',
  introName: 'Nexora',
  callMeName: 'Saeed',
  startupName: 'Sa3doon',
  startupGreetingEnabled: true,
  startupGreetingMode: 'spoken-name',
  startupAudioUrl: '',
  userNames: ['Saeed', 'Sa3doon'],
  easyModel: 'llama3.2:1b',
  hardModel: 'qwen3:4b',
  voiceAssistantEnabled: true,
  alwaysListeningEnabled: true,
  cameraAutoTheme: false,
  ttsEnabled: true
};
const LAYOUT_LOOK_KEY = 'nexora.layout-look.v1';
const LAYOUT_LOOKS = [
  { id: 'normal', label: 'Normal', detail: 'Clean default kiosk style', aliases: ['normal'] },
  { id: 'natural', label: 'Natural', detail: 'Soft greens and calm room tones', aliases: ['natural', 'nature'] },
  { id: 'glossy', label: 'Glossy / Glassy', detail: 'Translucent glass, shine, and blur', aliases: ['glossy', 'glassy', 'glass'] },
  { id: 'hacker', label: 'Hacker', detail: 'Terminal green and scanline energy', aliases: ['hacker', 'terminal'] },
  { id: 'aurora', label: 'Aurora', detail: 'Flowing northern-light gradients', aliases: ['aurora', 'northern lights'] },
  { id: 'ethereal', label: 'Ethereal', detail: 'Light, airy, mist-like pastels', aliases: ['ethereal', 'mist'] },
  { id: 'pixel', label: 'Pixel Art', detail: 'Retro grid and sharp 8-bit edges', aliases: ['pixel', 'pixel art', 'retro'] },
  { id: 'sketch', label: 'Conceptual Sketch', detail: 'Paper texture and rough idea lines', aliases: ['sketch', 'conceptual sketch', 'drawing'] },
  { id: 'luxury', label: 'Luxury Typography', detail: 'High-contrast editorial gold style', aliases: ['luxury', 'luxury typography', 'gold'] },
  { id: 'japandi', label: 'Japandi', detail: 'Minimal neutral calm', aliases: ['japandi', 'zen'] },
  { id: 'memphis', label: 'Memphis', detail: 'Bold playful geometry', aliases: ['memphis', 'playful'] },
  { id: 'bohemian', label: 'Bohemian', detail: 'Earthy jewel-tone atmosphere', aliases: ['bohemian', 'boho'] }
];
const AI_SUGGESTED_COMMANDS = [
  'open settings',
  'open dashboard',
  'open clock',
  'switch to red mode',
  'switch to dark mode',
  'switch to light mode',
  'start 10 minute timer',
  'show prayer times',
  'show weather',
  'mute music',
  'open software needed',
  'turn brightness to 50 percent',
  'set volume to 30 percent',
  'turn on night light',
  'turn on do not disturb',
  'battery saver mode',
  'normal power mode',
  'turn on tailscale vpn',
  'scan wifi',
  'scan bluetooth',
  'glossy look',
  'aurora look',
  'hacker look',
  'China clock',
  'Dubai clock',
  'weather to Dubai',
  'weather to Beijing',
  'study mode',
  'sleep mode'
];
const SOFTWARE_REQUIREMENTS = [
  {
    id: 'frontend',
    label: 'Website Frontend',
    tag: 'Required',
    Icon: Monitor,
    summary: 'Runs the clock, dashboard, settings, microphone UI, and all React widgets.',
    downloads: ['Node.js 20 or newer', 'npm packages from package.json'],
    commands: ['npm install', 'npm run dev -- --host 0.0.0.0']
  },
  {
    id: 'backend',
    label: 'Local Backend',
    tag: 'Required for device control and AI',
    Icon: Cpu,
    summary: 'Runs FastAPI on port 8787 for device controls, Ollama routing, speech, and local services.',
    downloads: ['Python 3.10+', 'FastAPI', 'Uvicorn', 'requests', 'pyttsx3'],
    commands: ['cd backend', 'python -m venv .venv', '.venv\\Scripts\\pip install -r requirements.txt', '.venv\\Scripts\\python -m uvicorn main:app --host 0.0.0.0 --port 8787']
  },
  {
    id: 'ai',
    label: 'Local AI Models',
    tag: 'Optional but recommended',
    Icon: Bot,
    summary: 'Gives Nexora real local answers through Ollama without paid cloud APIs.',
    downloads: ['Ollama', 'llama3.2:1b easy model', 'qwen3:4b hard model'],
    commands: ['ollama pull llama3.2:1b', 'ollama pull qwen3:4b', 'ollama serve']
  },
  {
    id: 'ubuntu',
    label: 'Ubuntu Device Controls',
    tag: 'Ubuntu only',
    Icon: Settings,
    summary: 'Lets the kiosk control brightness, sound, Wi-Fi, Bluetooth, and Night Light on Linux.',
    downloads: ['brightnessctl', 'NetworkManager / nmcli', 'BlueZ / bluetoothctl', 'WirePlumber or PulseAudio tools', 'GNOME gsettings', 'power-profiles-daemon', 'upower', 'Tailscale CLI'],
    commands: ['sudo apt update', 'sudo apt install brightnessctl network-manager bluetooth bluez pulseaudio-utils wireplumber libglib2.0-bin x11-xserver-utils power-profiles-daemon upower', 'curl -fsSL https://tailscale.com/install.sh | sh', 'sudo usermod -aG video $USER']
  },
  {
    id: 'voice-camera',
    label: 'Microphone and Camera',
    tag: 'Browser permission',
    Icon: Mic,
    summary: 'Enables voice commands, microphone dictation, camera wake, and camera brightness theme switching.',
    downloads: ['USB or built-in microphone', 'Built-in or USB camera', 'Chrome or Edge for best Web Speech support'],
    commands: ['Allow microphone permission in the browser', 'Allow camera permission in the browser']
  },
  {
    id: 'remote',
    label: 'Remote Access',
    tag: 'Optional',
    Icon: Wifi,
    summary: 'Opens the kiosk from your phone or another laptop over Wi-Fi or private Tailscale.',
    downloads: ['Tailscale app or package'],
    commands: ['sudo tailscale up', 'sudo tailscale down', 'sudo tailscale serve --bg 5173']
  }
];
const DEVICE_CONTROL_TABS = [
  { id: 'display', label: 'Display', Icon: Monitor },
  { id: 'sound', label: 'Sound', Icon: Volume2 },
  { id: 'power', label: 'Power', Icon: BatteryCharging },
  { id: 'wifi', label: 'Wi-Fi', Icon: Wifi },
  { id: 'bluetooth', label: 'Bluetooth', Icon: Bluetooth }
];
const DASHBOARD_WIDGET_PLACEMENTS = [
  'news', 'prayer', 'market', 'smart-brief', 'weather', 'daily-goals',
  'reminders', 'room-mode', 'quick-links', 'air', 'hydration', 'habits',
  'sleep-readiness', 'agenda', 'exams', 'system', 'lists', 'music',
  'ambient', 'device-controls', 'camera-wake', 'camera-theme', 'noise', 'focus-actions', 'ai-assistant'
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
  'news', 'prayer', 'market',
  'weather', 'daily-goals', 'smart-brief',
  'air', 'hydration', 'habits',
  'reminders', 'agenda', 'lists',
  'sleep-readiness', 'exams', 'system',
  'music', 'ambient', 'room-mode',
  'quick-links', 'device-controls', 'camera-wake', 'camera-theme', 'noise', 'focus-actions', 'ai-assistant'
];
const BUILT_IN_SECTIONS = [
  { id: 'news', title: 'Daily News', detail: 'Gulf News daily brief' },
  { id: 'prayer', title: 'Prayer', detail: 'Countdown and daily times' },
  { id: 'market', title: 'Market', detail: 'Gold and fuel prices' },
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
  { id: 'device-controls', title: 'Device Controls', detail: 'Ubuntu brightness, sound, Wi-Fi, and Bluetooth' },
  { id: 'room-mode', title: 'Room Mode', detail: 'Focus, sleep, prayer, away' },
  { id: 'quick-links', title: 'Quick Links', detail: 'Local browser shortcuts' },
  { id: 'camera-wake', title: 'Camera Wake', detail: 'Presence wake control' },
  { id: 'camera-theme', title: 'Camera Theme', detail: 'Browser brightness auto theme' },
  { id: 'noise', title: 'Noise Monitor', detail: 'Room dB monitor' },
  { id: 'focus-actions', title: 'Focus Actions', detail: 'Focus timer and quick actions' },
  { id: 'ai-assistant', title: 'AI Assistant', detail: 'Voice-controlled AI with environmental awareness' }
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

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function getPerformanceProfile() {
  return 'lite';
}

function isMaxPerformance() {
  return getPerformanceProfile() === 'max';
}

function canvasAlpha(hex, alpha) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return `rgba(134, 239, 172, ${alpha})`;
  const value = Number.parseInt(clean, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function isValidTimeZone(timeZone) {
  if (!timeZone || timeZone === 'local') return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeWeatherLocation(location) {
  const source = location && typeof location === 'object' ? location : DEFAULT_WEATHER_LOCATION;
  const lat = Number(source.lat);
  const lon = Number(source.lon);
  const timezone = isValidTimeZone(source.timezone) ? source.timezone : DEFAULT_WEATHER_LOCATION.timezone;
  return {
    id: source.id || `${source.name || 'custom'}-${lat}-${lon}`,
    name: source.name || DEFAULT_WEATHER_LOCATION.name,
    country: source.country || '',
    lat: Number.isFinite(lat) ? lat : DEFAULT_WEATHER_LOCATION.lat,
    lon: Number.isFinite(lon) ? lon : DEFAULT_WEATHER_LOCATION.lon,
    timezone
  };
}

function useWeatherLocation() {
  const [location, setLocationState] = useState(() => {
    try {
      return normalizeWeatherLocation(JSON.parse(localStorage.getItem(WEATHER_LOCATION_KEY)));
    } catch {
      return DEFAULT_WEATHER_LOCATION;
    }
  });

  function setWeatherLocation(nextLocation) {
    const clean = normalizeWeatherLocation(nextLocation);
    setLocationState(clean);
    localStorage.setItem(WEATHER_LOCATION_KEY, JSON.stringify(clean));
  }

  return [location, setWeatherLocation];
}

function useClockTimeZone() {
  const [clockTimeZone, setClockTimeZoneState] = useState(() => {
    const saved = localStorage.getItem(CLOCK_TIMEZONE_KEY) || DEFAULT_WEATHER_LOCATION.timezone;
    return isValidTimeZone(saved) ? saved : DEFAULT_WEATHER_LOCATION.timezone;
  });

  function setClockTimeZone(nextZone) {
    const clean = isValidTimeZone(nextZone) ? nextZone : DEFAULT_WEATHER_LOCATION.timezone;
    setClockTimeZoneState(clean);
    localStorage.setItem(CLOCK_TIMEZONE_KEY, clean);
  }

  return [clockTimeZone, setClockTimeZone];
}

function useWeatherBackgroundOverride() {
  const [override, setOverrideState] = useState(() => {
    const saved = localStorage.getItem(WEATHER_BACKGROUND_OVERRIDE_KEY) || 'live';
    return WEATHER_BACKGROUND_OVERRIDES.some((item) => item.id === saved) ? saved : 'live';
  });

  function setWeatherBackgroundOverride(nextOverride) {
    const clean = WEATHER_BACKGROUND_OVERRIDES.some((item) => item.id === nextOverride) ? nextOverride : 'live';
    setOverrideState(clean);
    localStorage.setItem(WEATHER_BACKGROUND_OVERRIDE_KEY, clean);
  }

  return [override, setWeatherBackgroundOverride];
}

function timeZoneLabel(timeZone) {
  if (!timeZone || timeZone === 'local') return 'Device time';
  return CLOCK_TIMEZONE_PRESETS.find((item) => item.zone === timeZone)?.label || timeZone;
}

function applyWeatherMoodOverride(liveMood, override, night = false) {
  if (!override || override === 'live') return liveMood;
  const moodMap = {
    clear: { id: night ? 'clear-night' : 'clear', label: night ? 'Clear night' : 'Clear', warning: 'Manual weather background override' },
    cloudy: { id: 'cloudy', label: 'Cloudy', warning: 'Manual weather background override' },
    rain: { id: 'rain', label: 'Rain', warning: 'Manual rain background override' },
    storm: { id: 'storm', label: 'Thunderstorm', warning: 'Manual thunder background override' },
    windy: { id: 'windy', label: 'Windy', warning: 'Manual wind background override' },
    hot: { id: 'hot', label: 'Hot', warning: 'Manual heat background override' },
    humid: { id: 'humid', label: 'Humid air', warning: 'Manual humidity background override' }
  };
  return moodMap[override] || liveMood;
}

function useWeather(location) {
  const selectedLocation = normalizeWeatherLocation(location);
  const [weather, setWeather] = useState({
    temp: 34,
    feels: 41,
    humidity: 58,
    wind: 13,
    windDirection: 0,
    uv: 7,
    sunrise: null,
    sunset: null,
    hourly: [],
    code: 0,
    loaded: false,
    fetchedAt: null,
    error: '',
    location: selectedLocation
  });
  const locationKey = `${selectedLocation.lat}:${selectedLocation.lon}:${selectedLocation.timezone}`;

  useEffect(() => {
    let ignore = false;
    const refreshMs = isMaxPerformance() ? 30 * 1000 : 5000;
    async function load() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,visibility&daily=uv_index_max,sunrise,sunset&timezone=${encodeURIComponent(selectedLocation.timezone)}&forecast_days=3`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || !data.current || !data.hourly) {
          throw new Error(data.reason || 'Weather feed failed');
        }
        if (ignore) return;
        const now = new Date();
        const hourly = data.hourly.time
          .map((time, index) => ({
            time: new Date(time),
            label: time.slice(11, 16),
            temp: Math.round(data.hourly.temperature_2m[index]),
            feels: Math.round(data.hourly.apparent_temperature[index]),
            code: data.hourly.weather_code[index],
            humidity: data.hourly.relative_humidity_2m[index],
            wind: Math.round(data.hourly.wind_speed_10m[index]),
            windDirection: data.hourly.wind_direction_10m[index],
            visibilityKm: Math.round((data.hourly.visibility[index] / 1000) * 10) / 10
          }))
          .filter((hour) => hour.time >= new Date(now.getTime() - 30 * 60 * 1000))
          .slice(0, 24);
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          feels: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m,
          wind: Math.round(data.current.wind_speed_10m),
          windDirection: data.current.wind_direction_10m,
          uv: Math.round(data.daily.uv_index_max[0]),
          sunrise: data.daily.sunrise[0],
          sunset: data.daily.sunset[0],
          hourly,
          code: data.current.weather_code,
          loaded: true,
          fetchedAt: Date.now(),
          error: '',
          location: selectedLocation
        });
      } catch (error) {
        if (!ignore) setWeather((current) => ({ ...current, location: selectedLocation, loaded: false, error: error.message }));
      }
    }
    load();
    const timer = setInterval(load, 15 * 60 * 1000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [locationKey]);

  return weather;
}

function useAirQuality(location = DEFAULT_WEATHER_LOCATION) {
  const selectedLocation = normalizeWeatherLocation(location);
  const [air, setAir] = useState({
    loaded: false,
    aqi: null,
    pm10: null,
    pm25: null,
    fetchedAt: null,
    error: ''
  });
  const locationKey = `${selectedLocation.lat}:${selectedLocation.lon}:${selectedLocation.timezone}`;

  useEffect(() => {
    let ignore = false;
    const refreshMs = isMaxPerformance() ? 60 * 1000 : 15 * 1000;
    async function load() {
      try {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lon}&current=pm10,pm2_5,us_aqi&timezone=${encodeURIComponent(selectedLocation.timezone)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || !data.current) throw new Error(data.reason || 'Air quality feed failed');
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
  }, [locationKey]);

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
    const timer = setInterval(load, SYSTEM_REFRESH_MS);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  return system;
}

function useNetworkAccess() {
  const [networkAccess, setNetworkAccess] = useState({
    loaded: false,
    hostname: '',
    localUrl: 'http://localhost:5173',
    port: '5173',
    urls: []
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/network');
      const data = await response.json();
      if (response.ok) setNetworkAccess({ ...data, urls: Array.isArray(data.urls) ? data.urls : [], loaded: true });
    } catch {
      setNetworkAccess((current) => ({ ...current, loaded: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60 * 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { ...networkAccess, refresh };
}

function useMusicLibrary() {
  const [library, setLibrary] = useState({
    tracks: [],
    loaded: false,
    error: '',
    fetchedAt: null
  });

  useEffect(() => {
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
    const timer = setInterval(load, MUSIC_LIBRARY_REFRESH_MS);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  return library;
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
    nextTrack,
    shuffleTrack,
    selectTrack
  };
}

function useNotificationChime() {
  const contextRef = useRef(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  const unlock = useCallback(async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    const context = contextRef.current || new AudioContext();
    contextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    readyRef.current = true;
    setReady(true);
    return true;
  }, []);

  const play = useCallback(async (tone = 'soft') => {
    const isReady = await unlock();
    if (!isReady || !contextRef.current) return false;
    const context = contextRef.current;
    const start = context.currentTime + 0.018;
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    const toneScale = tone === 'red' ? [392, 523.25, 783.99] : tone === 'amber' ? [440, 554.37, 739.99] : [523.25, 659.25, 880];
    const gainScale = tone === 'red' ? 0.044 : 0.035;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4200, start);
    filter.Q.setValueAtTime(0.35, start);
    compressor.threshold.setValueAtTime(-28, start);
    compressor.knee.setValueAtTime(18, start);
    compressor.ratio.setValueAtTime(5, start);
    compressor.attack.setValueAtTime(0.008, start);
    compressor.release.setValueAtTime(0.28, start);
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(gainScale, start + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, start + 1.35);
    master.connect(filter);
    filter.connect(compressor);
    compressor.connect(context.destination);

    toneScale.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      const noteStart = start + index * 0.105;
      const noteLength = 0.78 - index * 0.08;
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      oscillator.detune.setValueAtTime(index === 2 ? 3 : -2, noteStart);
      noteGain.gain.setValueAtTime(0.0001, noteStart);
      noteGain.gain.exponentialRampToValueAtTime(0.9 - index * 0.18, noteStart + 0.025);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteLength);
      oscillator.connect(noteGain);
      noteGain.connect(master);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + noteLength + 0.05);
    });

    return true;
  }, [unlock]);

  useEffect(() => {
    const enable = () => unlock().catch(() => {});
    window.addEventListener('pointerdown', enable, { once: true, passive: true });
    window.addEventListener('keydown', enable, { once: true });
    return () => {
      window.removeEventListener('pointerdown', enable);
      window.removeEventListener('keydown', enable);
    };
  }, [unlock]);

  return { play, ready: ready || readyRef.current };
}

function useCameraWake(enabled, onWake) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState(enabled ? 'Starting camera wake' : 'Camera wake off');

  useEffect(() => {
    if (!enabled) {
      setStatus('Camera wake off');
      return undefined;
    }

    let stream = null;
    let timer = null;
    let cancelled = false;
    let lastFrame = null;
    const maxPerformance = isMaxPerformance();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: maxPerformance ? 160 : 240, height: maxPerformance ? 110 : 160 }, audio: false });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('Watching for face or motion');
        const detector = 'FaceDetector' in window ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }) : null;

        timer = window.setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || !context) return;
          canvas.width = maxPerformance ? 48 : 96;
          canvas.height = maxPerformance ? 32 : 64;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          if (detector) {
            try {
              const faces = await detector.detect(canvas);
              if (faces.length) {
                setStatus('Face detected');
                onWake();
                return;
              }
            } catch {
              // Fall back to motion below when the browser exposes FaceDetector but fails.
            }
          }

          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          if (lastFrame) {
            let diff = 0;
            for (let index = 0; index < pixels.length; index += 16) {
              diff += Math.abs(pixels[index] - lastFrame[index]);
            }
            if (diff > 18000) {
              setStatus(detector ? 'Movement detected' : 'Camera motion wake');
              onWake();
            }
          }
          lastFrame = new Uint8ClampedArray(pixels);
        }, maxPerformance ? 3000 : 900);
      } catch {
        setStatus('Camera permission needed');
      }
    }

    start();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled, onWake]);

  return { videoRef, status };
}

function normalizeAssistantSettings(saved) {
  const merged = {
    ...AI_ASSISTANT_DEFAULTS,
    ...(saved || {}),
    userNames: Array.isArray(saved?.userNames) && saved.userNames.length ? saved.userNames : AI_ASSISTANT_DEFAULTS.userNames
  };
  const clean = (value, fallback) => String(value || '').trim() || fallback;
  return {
    ...merged,
    assistantName: clean(merged.assistantName, DEFAULT_ASSISTANT_NAME),
    introName: clean(merged.introName, merged.assistantName || DEFAULT_ASSISTANT_NAME),
    callMeName: clean(merged.callMeName, merged.userNames?.[0] || AI_ASSISTANT_DEFAULTS.callMeName),
    startupName: clean(merged.startupName, merged.callMeName || AI_ASSISTANT_DEFAULTS.startupName),
    startupGreetingMode: ['spoken-name', 'custom-audio'].includes(merged.startupGreetingMode) ? merged.startupGreetingMode : 'spoken-name',
    startupAudioUrl: String(merged.startupAudioUrl || '').trim(),
    startupGreetingEnabled: merged.startupGreetingEnabled !== false
  };
}

function useAssistantSettings() {
  const [settings, setSettingsState] = useState(() => {
    try {
      return normalizeAssistantSettings(JSON.parse(localStorage.getItem(AI_ASSISTANT_KEY)));
    } catch {
      return normalizeAssistantSettings();
    }
  });

  const setSettings = useCallback((patch) => {
    setSettingsState((current) => {
      const next = normalizeAssistantSettings(typeof patch === 'function' ? patch(current) : { ...current, ...patch });
      localStorage.setItem(AI_ASSISTANT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return [settings, setSettings];
}

function assistantCallName(settings) {
  return settings.callMeName?.trim() || settings.userNames?.[0] || AI_ASSISTANT_DEFAULTS.callMeName;
}

function assistantIntroName(settings) {
  return settings.introName?.trim() || settings.assistantName || DEFAULT_ASSISTANT_NAME;
}

function assistantStartupName(settings) {
  return settings.startupName?.trim() || assistantCallName(settings);
}

function resolveStartupAudioUrl(value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (clean.startsWith('/music/')) return `/media/music/${encodeURIComponent(clean.slice(7))}`;
  if (/^(https?:|blob:|data:|\/)/i.test(clean)) return clean;
  const fileName = clean.split(/[\\/]/).pop();
  return fileName ? `/media/music/${encodeURIComponent(fileName)}` : '';
}

function randomUserName(settings) {
  if (settings.callMeName?.trim()) return settings.callMeName.trim();
  const names = settings.userNames?.length ? settings.userNames : AI_ASSISTANT_DEFAULTS.userNames;
  return names[Math.floor(Math.random() * names.length)] || 'Saeed';
}

function speakAssistantReply(text, settings, options = {}) {
  if (!settings.ttsEnabled || !('speechSynthesis' in window)) return Promise.resolve(false);
  try {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate ?? 0.95;
      utterance.pitch = options.pitch ?? 0.92;
      utterance.volume = options.volume ?? 0.78;
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      window.setTimeout(() => finish(false), options.maxMs || 2800);
    });
  } catch {
    // Browser speech can be blocked until user interaction.
    return Promise.resolve(false);
  }
}

function speechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function friendlySpeechError(error = '') {
  const code = String(error || 'microphone error');
  const messages = {
    'not-allowed': 'Microphone permission is blocked. Allow microphone access, then retry.',
    'service-not-allowed': 'The browser speech service is blocked. Try Chrome or Edge with internet access.',
    'audio-capture': 'No microphone was found. Check the laptop mic or USB mic.',
    'no-speech': 'I did not hear speech. Move closer and try again.',
    network: 'Speech recognition had a network error. Browser speech recognition may need internet.',
    aborted: 'Listening was stopped by the browser.',
    'language-not-supported': 'English speech recognition is not supported by this browser.'
  };
  return messages[code] || `Microphone error: ${code}`;
}

function friendlyMediaError(error) {
  if (!error) return 'Microphone request failed.';
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return 'Microphone permission was denied. Click the browser mic icon and allow it.';
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'No microphone was detected on this device.';
  if (error.name === 'NotReadableError') return 'The microphone is already in use by another app.';
  if (error.name === 'NotSecureError') return 'Microphone access needs localhost or HTTPS.';
  return error.message || 'Microphone request failed.';
}

function useVoiceDiagnostics(refreshToken = 0) {
  const [diagnostics, setDiagnostics] = useState({
    speechSupported: false,
    micSupported: false,
    permission: 'checking',
    secure: false,
    visibility: 'visible'
  });

  useEffect(() => {
    let disposed = false;
    let permissionStatus = null;

    async function readDiagnostics() {
      const nav = window.navigator || {};
      let permission = nav.mediaDevices?.getUserMedia ? 'unknown' : 'unavailable';
      try {
        if (nav.permissions?.query) {
          permissionStatus = await nav.permissions.query({ name: 'microphone' });
          permission = permissionStatus.state;
        }
      } catch {
        permission = nav.mediaDevices?.getUserMedia ? 'unknown' : 'unavailable';
      }
      if (disposed) return;
      setDiagnostics({
        speechSupported: Boolean(speechRecognitionConstructor()),
        micSupported: Boolean(nav.mediaDevices?.getUserMedia),
        permission,
        secure: Boolean(window.isSecureContext),
        visibility: document.visibilityState
      });
      if (permissionStatus) {
        permissionStatus.onchange = () => {
          setDiagnostics((current) => ({ ...current, permission: permissionStatus.state }));
        };
      }
    }

    function handleVisibility() {
      setDiagnostics((current) => ({ ...current, visibility: document.visibilityState }));
    }

    readDiagnostics();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      disposed = true;
      if (permissionStatus) permissionStatus.onchange = null;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshToken]);

  return diagnostics;
}

function stripAssistantWakeWord(text, settings) {
  const clean = text.trim();
  const name = settings.assistantName || DEFAULT_ASSISTANT_NAME;
  const pattern = new RegExp(`^\\s*(hey|hi|okay)?\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[,\\s]*`, 'i');
  return clean.replace(pattern, '').trim() || clean;
}

function backendOrigin() {
  const host = window.location.hostname || 'localhost';
  return host === 'localhost' || host === '127.0.0.1' ? 'http://localhost:8787' : `http://${host}:8787`;
}

async function deviceApiRequest(path, options = {}) {
  try {
    const response = await fetch(`${backendOrigin()}${path}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    return response.ok ? data : { ok: false, error: data.error || `Device backend returned ${response.status}.` };
  } catch {
    return { ok: false, error: 'Device backend is not running on port 8787.' };
  }
}

function useAssistantTimer(settings) {
  const [state, setState] = useState({ secondsLeft: 0, running: false, label: 'Ready' });
  const alertedRef = useRef(false);

  useEffect(() => {
    if (!state.running || state.secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setState((current) => {
        const nextSeconds = Math.max(0, current.secondsLeft - 1);
        return { ...current, secondsLeft: nextSeconds, running: nextSeconds > 0 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.running, state.secondsLeft]);

  useEffect(() => {
    if (state.secondsLeft === 0 && !state.running && state.label !== 'Ready' && !alertedRef.current) {
      alertedRef.current = true;
      speakAssistantReply('Done Sa3doon, timer finished.', settings);
    }
  }, [state.secondsLeft, state.running, state.label, settings]);

  const start = useCallback((minutes) => {
    const cleanMinutes = Math.max(1, Math.min(240, Number(minutes) || 10));
    alertedRef.current = false;
    setState({ secondsLeft: cleanMinutes * 60, running: true, label: `${cleanMinutes} minute timer` });
  }, []);

  const pause = useCallback(() => setState((current) => ({ ...current, running: false })), []);
  const resume = useCallback(() => setState((current) => ({ ...current, running: current.secondsLeft > 0 })), []);
  const reset = useCallback(() => {
    alertedRef.current = false;
    setState({ secondsLeft: 0, running: false, label: 'Ready' });
  }, []);

  return { ...state, start, pause, resume, reset };
}

function cameraThemeDecision(brightness, date = new Date()) {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const decimalHour = hour + minutes / 60;
  const isNight = hour >= 18 || hour < 5;
  const isDawn = decimalHour >= 5 && decimalHour < 7;
  const isMorning = decimalHour >= 7 && decimalHour < 12;
  const roomDark = brightness == null ? isNight : brightness < 40;
  const roomBright = brightness == null ? !isNight : brightness > 80;

  if (isDawn) return { theme: 'dawn', reason: 'Morning dawn animation', sunProgress: Math.max(0, Math.min(1, (decimalHour - 5) / 2)) };
  if (isMorning) return { theme: 'morning-sun', reason: 'Morning sun mode', sunProgress: 1 };
  if (isNight && roomDark) return { theme: 'red-night', reason: 'Night and dark room', sunProgress: 0 };
  if (isNight) return { theme: 'dark', reason: roomBright ? 'Night with room light' : 'Night medium light', sunProgress: 0 };
  if (roomDark) return { theme: 'dark-red', reason: 'Day but dark room', sunProgress: 1 };
  return { theme: 'light', reason: roomBright ? 'Day and bright room' : 'Day medium light', sunProgress: 1 };
}

function modeForSmartTheme(theme) {
  if (theme === 'red-night' || theme === 'dark-red') return 'night';
  if (theme === 'dark') return 'slate';
  return 'white';
}

function useCameraAutoTheme(enabled, onTheme) {
  const videoRef = useRef(null);
  const lastThemeRef = useRef('');
  const [state, setState] = useState({
    permission: enabled ? 'starting' : 'off',
    brightness: null,
    theme: 'manual',
    reason: 'Camera auto-theme is off',
    sunProgress: 0
  });

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, permission: 'off', reason: 'Camera auto-theme is off' }));
      return undefined;
    }

    let stream = null;
    let timer = null;
    let cancelled = false;
    const maxPerformance = isMaxPerformance();
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState((current) => ({ ...current, permission: 'unsupported', reason: 'Browser camera is not supported' }));
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: maxPerformance ? 96 : 160, height: maxPerformance ? 72 : 120 }, audio: false });
        if (cancelled) return;
        video.srcObject = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        await video.play();
        await videoRef.current?.play?.();
        setState((current) => ({ ...current, permission: 'granted' }));

        timer = window.setInterval(() => {
          if (!context || video.readyState < 2) return;
          canvas.width = maxPerformance ? 32 : 48;
          canvas.height = maxPerformance ? 24 : 36;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let total = 0;
          let count = 0;
          for (let index = 0; index < data.length; index += 16) {
            total += (data[index] + data[index + 1] + data[index + 2]) / 3;
            count += 1;
          }
          const brightness = Math.round(total / Math.max(1, count));
          const decision = cameraThemeDecision(brightness);
          setState({ permission: 'granted', brightness, ...decision });
          if (lastThemeRef.current !== decision.theme) {
            lastThemeRef.current = decision.theme;
            onTheme(decision.theme);
          }
        }, maxPerformance ? 5000 : 2400);
      } catch {
        setState((current) => ({ ...current, permission: 'blocked', reason: 'Camera permission is blocked or unavailable' }));
      }
    }

    start();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled, onTheme]);

  return { ...state, videoRef };
}

function useIdlePresence(timeoutMs = IDLE_TIMEOUT_MS) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
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
  }, [timeoutMs]);

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

function useFocusSession() {
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
  }, [duration, running]);

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

function useLayoutLook() {
  const [layoutLook, setLayoutLookState] = useState(() => {
    const saved = localStorage.getItem(LAYOUT_LOOK_KEY);
    return LAYOUT_LOOKS.some((look) => look.id === saved) ? saved : 'normal';
  });

  function setLayoutLook(nextLook) {
    const clean = LAYOUT_LOOKS.some((look) => look.id === nextLook) ? nextLook : 'normal';
    setLayoutLookState(clean);
    localStorage.setItem(LAYOUT_LOOK_KEY, clean);
  }

  return [layoutLook, setLayoutLook];
}

function useAlwaysListeningAssistant(settings, runCommand) {
  const [status, setStatus] = useState(settings.alwaysListeningEnabled ? 'Starting always listen...' : 'Always listen off');
  const [lastReply, setLastReply] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const runCommandRef = useRef(runCommand);
  const settingsRef = useRef(settings);

  useEffect(() => {
    runCommandRef.current = runCommand;
  }, [runCommand]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!settings.voiceAssistantEnabled || !settings.alwaysListeningEnabled) {
      setStatus(settings.voiceAssistantEnabled ? 'Always listen off' : 'Voice assistant off');
      return undefined;
    }
    const SpeechRecognition = speechRecognitionConstructor();
    if (!SpeechRecognition) {
      setStatus('Always listen unsupported: open in Chrome or Edge');
      return undefined;
    }

    let active = true;
    let manualPaused = false;
    let recognition = null;
    let restartTimer = null;
    const wakeName = (settings.assistantName || DEFAULT_ASSISTANT_NAME).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wakePattern = new RegExp(`(?:^|\\b)(?:hey|hi|okay)?\\s*${wakeName}\\b[,\\s]*(.*)$`, 'i');

    function restartSoon(delay = 450) {
      window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(() => {
        if (active && !manualPaused && document.visibilityState !== 'hidden') startRecognition();
      }, delay);
    }

    function handleTranscript(transcript) {
      const match = transcript.match(wakePattern);
      const heardCommand = match?.[1]?.trim();
      if (!heardCommand) {
        if (match) setStatus(`Heard ${settingsRef.current.assistantName}. Say the command after the name.`);
        return;
      }
      setStatus(`Wake word heard: ${heardCommand}`);
      runCommandRef.current(heardCommand)
        .then((result) => {
          if (!active) return;
          setLastReply(result.reply || '');
          setStatus(`Done: ${heardCommand}`);
        })
        .catch(() => {
          if (active) setStatus('Command heard, but the assistant failed to run it.');
        });
    }

    function startRecognition() {
      if (!active || manualPaused || recognition) return;
      try {
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => setStatus(`Always listening for "Hey ${settingsRef.current.assistantName}"`);
        recognition.onresult = (event) => {
          Array.from(event.results)
            .slice(event.resultIndex)
            .map((result) => result[0]?.transcript || '')
            .filter(Boolean)
            .forEach(handleTranscript);
        };
        recognition.onerror = (event) => {
          const error = event?.error || 'microphone error';
          if (error === 'not-allowed' || error === 'service-not-allowed') {
            active = false;
            setStatus(`${friendlySpeechError(error)} Click Enable mic.`);
            return;
          }
          setStatus(`Always listen retrying: ${friendlySpeechError(error)}`);
        };
        recognition.onend = () => {
          recognition = null;
          if (active && !manualPaused) restartSoon(document.visibilityState === 'hidden' ? 1600 : 450);
        };
        recognition.start();
      } catch {
        recognition = null;
        setStatus('Always listen could not start yet');
        restartSoon(1500);
      }
    }

    function stopRecognitionForManual() {
      manualPaused = true;
      window.clearTimeout(restartTimer);
      setStatus('Manual voice control active');
      if (!recognition) return;
      try {
        recognition.onend = () => {
          recognition = null;
        };
        recognition.stop();
      } catch {
        recognition = null;
      }
    }

    function resumeAfterManual() {
      manualPaused = false;
      setStatus(`Restarting always listen for "Hey ${settingsRef.current.assistantName}"`);
      restartSoon(650);
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        setStatus('Background listening may pause in this browser');
        return;
      }
      restartSoon(250);
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('nexora:manual-voice-start', stopRecognitionForManual);
    window.addEventListener('nexora:manual-voice-end', resumeAfterManual);
    startRecognition();

    return () => {
      active = false;
      window.clearTimeout(restartTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('nexora:manual-voice-start', stopRecognitionForManual);
      window.removeEventListener('nexora:manual-voice-end', resumeAfterManual);
      if (recognition) {
        try {
          recognition.onend = null;
          recognition.stop();
        } catch {
          // Recognition can already be stopped by the browser.
        }
      }
    };
  }, [settings.voiceAssistantEnabled, settings.alwaysListeningEnabled, settings.assistantName, retryToken]);

  return { status, lastReply, retry: () => setRetryToken((value) => value + 1) };
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
  const inSleepWindow = hour >= 22 || hour < 1;
  let score = 72;
  if (inSleepWindow) score += 16;
  if (roomMode === 'sleep') score += 8;
  if (hydrationPct < 55) score -= 10;
  if (dailyGoals.progress < 67 && hour >= 20) score -= 8;
  if (caffeineActive) score -= 18;
  if (weather.humidity >= 70 || weather.feels >= 36) score -= 7;
  score = Math.round(clampNumber(score));

  const label = score >= 82 ? 'Good sleep window' : score >= 62 ? 'Prepare for sleep' : 'Not ready yet';
  const factors = [
    inSleepWindow ? 'Time window is good' : 'Sleep window starts near 22:00',
    caffeineActive ? `${Math.ceil(8 - caffeineHours)}h caffeine fade left` : 'No active caffeine logged',
    `${Math.round(hydrationPct)}% water goal`,
    roomMode === 'sleep' ? 'Sleep mode active' : 'Sleep mode available'
  ];
  const actions = [
    score < 82 ? 'Dim screen and reduce audio' : 'Keep the room quiet',
    hydrationPct < 80 ? 'Drink small water now' : 'Hydration looks fine',
    caffeineActive ? 'Avoid more caffeine tonight' : 'No caffeine warning'
  ];

  return { score, label, factors, actions, caffeineActive };
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
  const timeZone = options.timeZone && options.timeZone !== 'local' ? options.timeZone : undefined;
  if (timeZone) {
    return date.toLocaleTimeString('en-AE', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: timeFormat === '12'
    });
  }
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

function getClockHourMinute(date, timeZone = 'local') {
  if (!timeZone || timeZone === 'local') return { hours: date.getHours(), minutes: pad(date.getMinutes()) };
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const hours = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minutes = parts.find((part) => part.type === 'minute')?.value || '00';
  return { hours, minutes };
}

function getClockDisplayParts(date, timeFormat, timeZone = 'local') {
  const { hours, minutes } = getClockHourMinute(date, timeZone);
  const period = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = pad(hours % 12 || 12);

  if (timeFormat === '12') {
    return {
      kind: '12',
      primary: `${twelveHour}:${minutes}`,
      period
    };
  }

  if (timeFormat === 'both') {
    return {
      kind: 'both',
      primary: `${pad(hours)}:${minutes}`,
      secondary: `${twelveHour}:${minutes} ${period}`
    };
  }

  return {
    kind: '24',
    primary: `${pad(hours)}:${minutes}`
  };
}

function formatClockDate(date, timeZone = 'local', options = {}) {
  return date.toLocaleDateString('en-AE', {
    timeZone: timeZone && timeZone !== 'local' ? timeZone : undefined,
    weekday: options.weekday || 'long',
    month: options.month || 'long',
    day: options.day || 'numeric'
  });
}

function formatTimeZone(date, timeZone, timeFormat) {
  const formatZone = (format) => date.toLocaleTimeString('en-AE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12'
  });

  if (timeFormat === 'both') return `${formatZone('24')} / ${formatZone('12')}`;
  return formatZone(timeFormat);
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

function formatWeatherLocalTime(value, timeFormat) {
  if (!value || typeof value !== 'string') return '--';
  const [, time = ''] = value.split('T');
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '--';
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return formatClockTime(date, timeFormat);
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

function sunBoundaryDate(value, baseDate, fallbackHour) {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(baseDate);
  fallback.setHours(fallbackHour, 0, 0, 0);
  return fallback;
}

function getCelestialPosition(now, sunrise, sunset) {
  const current = now || new Date();
  const night = isNightAt(current, sunrise, sunset);
  const todaySunrise = sunBoundaryDate(sunrise, current, 6);
  const todaySunset = sunBoundaryDate(sunset, current, 18);
  let start = todaySunrise;
  let end = todaySunset;

  if (night) {
    start = new Date(todaySunset);
    end = new Date(todaySunrise);
    if (current < todaySunrise) {
      start.setDate(start.getDate() - 1);
    } else {
      end.setDate(end.getDate() + 1);
    }
  }

  const duration = Math.max(1, end.getTime() - start.getTime());
  const progress = clampNumber(((current.getTime() - start.getTime()) / duration) * 100);
  const arc = Math.sin((progress / 100) * Math.PI);
  const y = night ? 70 - arc * 46 : 68 - arc * 58;

  return {
    night,
    x: Math.round((8 + progress * 0.84) * 10) / 10,
    y: Math.round(clampNumber(y, 8, 78) * 10) / 10,
    progress: Math.round(progress),
    glow: (night ? 0.32 + arc * 0.18 : 0.42 + arc * 0.28).toFixed(2)
  };
}

function weatherCondition(code = 0, night = false) {
  if (code >= 95) return { label: 'Thunderstorm', Icon: CloudRain, tone: 'storm' };
  if (code === 0) return night ? { label: 'Clear night', Icon: Moon, tone: 'night' } : { label: 'Sunny', Icon: Sun, tone: 'sun' };
  if ([1, 2].includes(code)) return night ? { label: 'Partly cloudy night', Icon: Moon, tone: 'partly' } : { label: 'Partly cloudy', Icon: CloudSun, tone: 'partly' };
  if (code === 3) return { label: 'Cloudy', Icon: Cloudy, tone: 'cloud' };
  if ([45, 48].includes(code)) return { label: 'Fog', Icon: Cloud, tone: 'fog' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Rain', Icon: CloudRain, tone: 'rain' };
  return { label: 'Cloudy', Icon: Cloud, tone: 'cloud' };
}

function sunSceneForWeather(code = 0) {
  if (code >= 95) return 'storm';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
  if ([45, 48].includes(code)) return 'fog';
  if (code === 3) return 'cloudy';
  if ([1, 2].includes(code)) return 'partly-cloudy';
  return 'sunny';
}

function getAmbientPhase(now) {
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < 6) return { id: 'midnight', label: 'Midnight red', mode: 'night', detail: 'Ultra dim sleep display' };
  if (hour < 8) return { id: 'sunrise', label: 'Sunrise warm', mode: 'white', detail: 'Warm wake lighting' };
  if (hour < 17) return { id: 'day', label: 'Day clean', mode: 'white', detail: 'Brighter daytime UI' };
  if (hour < 20) return { id: 'sunset', label: 'Sunset amber', mode: 'slate', detail: 'Soft evening tone' };
  return { id: 'evening', label: 'Evening calm', mode: 'slate', detail: 'Dim bedroom dashboard' };
}

function getWeatherMood(weather, night = false) {
  const condition = weatherCondition(weather.code, night);
  const windy = weather.wind >= 28;
  if (condition.tone === 'storm' && windy) return { id: 'storm-windy', label: 'Thunder + wind', warning: 'Storm wind background active' };
  if (condition.tone === 'storm') return { id: 'storm', label: 'Thunderstorm', warning: 'Thunder background active' };
  if (condition.tone === 'rain' && windy) return { id: 'rain-windy', label: 'Rain + wind', warning: 'Rain and wind ambience' };
  if (condition.tone === 'rain') return { id: 'rain', label: condition.label, warning: 'Rain ambience ready' };
  if (windy) return { id: 'windy', label: 'Windy', warning: 'Wind animation active' };
  if (condition.tone === 'partly') return { id: 'partly-cloudy', label: condition.label, warning: '' };
  if (condition.tone === 'cloud') return { id: 'cloudy', label: condition.label, warning: '' };
  if (condition.tone === 'fog') return { id: 'fog', label: condition.label, warning: 'Low visibility ambience' };
  if (weather.feels >= 38) return { id: 'hot', label: 'UAE heat', warning: 'High heat index - hydrate' };
  if (weather.humidity >= 70) return { id: 'humid', label: 'Humid air', warning: 'Humidity is high tonight' };
  return { id: night ? 'clear-night' : 'clear', label: condition.label, warning: '' };
}

function playSoftChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
    gain.connect(context.destination);
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.08);
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.08);
      oscillator.stop(context.currentTime + 0.5 + index * 0.08);
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
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const synodicMonth = 29.530588853;
  const daysSince = (date.getTime() - knownNewMoon) / 86400000;
  const age = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
  const fraction = age / synodicMonth;
  const illumination = Math.round((0.5 - 0.5 * Math.cos(2 * Math.PI * fraction)) * 100);
  let phaseInfo = { name: 'Waning Crescent', id: 'waning-crescent' };
  if (fraction < 0.03 || fraction >= 0.97) phaseInfo = { name: 'New Moon', id: 'new' };
  else if (fraction < 0.22) phaseInfo = { name: 'Waxing Crescent', id: 'waxing-crescent' };
  else if (fraction < 0.28) phaseInfo = { name: 'First Quarter', id: 'first-quarter' };
  else if (fraction < 0.47) phaseInfo = { name: 'Waxing Gibbous', id: 'waxing-gibbous' };
  else if (fraction < 0.53) phaseInfo = { name: 'Full Moon', id: 'full' };
  else if (fraction < 0.72) phaseInfo = { name: 'Waning Gibbous', id: 'waning-gibbous' };
  else if (fraction < 0.78) phaseInfo = { name: 'Last Quarter', id: 'last-quarter' };
  const daysToFull = (14.765294 - age + synodicMonth) % synodicMonth;
  const nextFullMoon = new Date(date.getTime() + daysToFull * 86400000);
  return { phase: phaseInfo.name, phaseId: phaseInfo.id, age: age.toFixed(1), fraction, illumination, nextFullMoon };
}

function moonPhasePath(fraction) {
  const phase = Number.isFinite(fraction) ? fraction : 0;
  if (phase < 0.012 || phase > 0.988) return '';

  const center = 50;
  const radius = 46;
  const samples = 72;
  const terminator = Math.cos(2 * Math.PI * phase);
  const points = [];

  for (let index = 0; index <= samples; index += 1) {
    const y = -radius + (index / samples) * radius * 2;
    const edge = Math.sqrt(Math.max(0, radius * radius - y * y));
    if (phase <= 0.5) {
      points.push([center + edge, center + y]);
    } else {
      points.push([center - edge, center + y]);
    }
  }

  for (let index = samples; index >= 0; index -= 1) {
    const y = -radius + (index / samples) * radius * 2;
    const edge = Math.sqrt(Math.max(0, radius * radius - y * y));
    if (phase <= 0.5) {
      points.push([center + terminator * edge, center + y]);
    } else {
      points.push([center - terminator * edge, center + y]);
    }
  }

  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z';
}

function getMoonTimes(date, location = DEFAULT_WEATHER_LOCATION) {
  const selectedLocation = normalizeWeatherLocation(location);
  const times = SunCalc.getMoonTimes(date, selectedLocation.lat, selectedLocation.lon);
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

function secondsProgress(now) {
  return ((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * 100;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weatherCanvasPalette(scene, night) {
  if (scene === 'storm' || scene === 'storm-windy') {
    return { top: '#050814', mid: '#101827', bottom: '#04070c', glow: 'rgba(147, 197, 253, 0.28)', cloud: 'rgba(148, 163, 184, 0.32)' };
  }
  if (scene === 'rain' || scene === 'rain-windy') {
    return { top: '#0d1722', mid: '#172432', bottom: '#071018', glow: 'rgba(125, 211, 252, 0.2)', cloud: 'rgba(203, 213, 225, 0.24)' };
  }
  if (night) {
    if (scene === 'hot') {
      return { top: '#100806', mid: '#1a1110', bottom: '#070403', glow: 'rgba(251, 191, 36, 0.16)', cloud: 'rgba(255, 214, 160, 0.1)' };
    }
    if (scene === 'windy') {
      return { top: '#050a10', mid: '#0c141a', bottom: '#030506', glow: 'rgba(125, 211, 252, 0.16)', cloud: 'rgba(203, 213, 225, 0.12)' };
    }
    if (scene === 'cloudy' || scene === 'fog' || scene === 'humid' || scene === 'partly-cloudy' || scene === 'clear-night') {
      return { top: '#06100f', mid: '#0b1715', bottom: '#030706', glow: 'rgba(196, 181, 253, 0.18)', cloud: 'rgba(203, 213, 225, 0.13)' };
    }
    return { top: '#050914', mid: '#0d1420', bottom: '#030507', glow: 'rgba(196, 181, 253, 0.22)', cloud: 'rgba(148, 163, 184, 0.14)' };
  }
  if (scene === 'cloudy' || scene === 'fog' || scene === 'humid') {
    return { top: '#cfdad8', mid: '#dfe8e3', bottom: '#c8d6d1', glow: 'rgba(255, 255, 255, 0.28)', cloud: 'rgba(255, 255, 255, 0.34)' };
  }
  if (scene === 'hot') {
    return { top: '#f7d58a', mid: '#f4e4b4', bottom: '#d6b779', glow: 'rgba(251, 191, 36, 0.36)', cloud: 'rgba(255, 255, 255, 0.14)' };
  }
  if (scene === 'windy') {
    return { top: '#d7f1f6', mid: '#e8f0eb', bottom: '#d2ddd7', glow: 'rgba(125, 211, 252, 0.2)', cloud: 'rgba(255, 255, 255, 0.22)' };
  }
  return { top: '#aee4ff', mid: '#e9f7ef', bottom: '#f1e8c8', glow: 'rgba(255, 210, 92, 0.34)', cloud: 'rgba(255, 255, 255, 0.24)' };
}

function useChronoWeatherCanvas(canvasRef, active, scene, night) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas || isMaxPerformance()) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lastDraw = 0;
    const leanMotion = getPerformanceProfile() === 'lite';
    const random = seededRandom(hashString(`${scene}-${night ? 'night' : 'day'}`));
    const clouds = Array.from({ length: leanMotion ? 4 : 7 }, (_, index) => ({
      x: random(),
      y: 0.12 + random() * 0.58,
      scale: 0.7 + random() * 1.65,
      speed: (0.002 + random() * 0.006) * (index % 2 ? -1 : 1),
      alpha: 0.16 + random() * 0.28
    }));
    const rain = Array.from({ length: leanMotion ? 58 : 120 }, () => ({
      x: random(),
      y: random(),
      length: 0.055 + random() * 0.09,
      speed: 0.52 + random() * 0.74,
      drift: -0.09 - random() * 0.14
    }));
    const stars = Array.from({ length: leanMotion ? 44 : 90 }, () => ({
      x: random(),
      y: random() * 0.76,
      radius: 0.6 + random() * 1.1,
      alpha: 0.3 + random() * 0.58
    }));
    const windLines = Array.from({ length: leanMotion ? 8 : 16 }, () => ({
      x: random(),
      y: random(),
      speed: 0.07 + random() * 0.12,
      length: 0.12 + random() * 0.22
    }));

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, leanMotion ? 1.05 : 1.45);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawCloud = (cloud, time, color, strength) => {
      const direction = cloud.speed >= 0 ? 1 : -1;
      const baseX = (((cloud.x + time * cloud.speed) % 1) + 1) % 1;
      const x = baseX * width;
      const y = cloud.y * height;
      const size = Math.min(width, height) * 0.22 * cloud.scale;
      const drawAt = (offset) => {
        context.beginPath();
        context.ellipse(x + offset, y, size * 1.15, size * 0.34, 0, 0, Math.PI * 2);
        context.ellipse(x - size * 0.42 + offset, y + size * 0.04, size * 0.5, size * 0.24, 0, 0, Math.PI * 2);
        context.ellipse(x + size * 0.44 + offset, y - size * 0.03, size * 0.62, size * 0.26, 0, 0, Math.PI * 2);
        context.fill();
      };
      context.save();
      context.globalAlpha = cloud.alpha * strength;
      context.fillStyle = color;
      context.filter = leanMotion ? `blur(${Math.max(5, size * 0.055)}px)` : `blur(${Math.max(10, size * 0.1)}px)`;
      drawAt(0);
      drawAt(direction > 0 ? -width : width);
      context.restore();
    };

    const draw = (timestamp) => {
      const frameGap = leanMotion ? 42 : 28;
      if (timestamp - lastDraw < frameGap) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastDraw = timestamp;
      const time = timestamp / 1000;
      const palette = weatherCanvasPalette(scene, night);
      context.clearRect(0, 0, width, height);

      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, palette.top);
      sky.addColorStop(0.48, palette.mid);
      sky.addColorStop(1, palette.bottom);
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);

      const glow = context.createRadialGradient(width * 0.78, height * 0.2, 0, width * 0.78, height * 0.2, Math.max(width, height) * 0.48);
      glow.addColorStop(0, palette.glow);
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      if (night || scene === 'clear-night') {
        context.save();
        stars.forEach((star) => {
          context.globalAlpha = star.alpha * (0.62 + Math.sin(time * 0.8 + star.x * 12) * 0.22);
          context.fillStyle = '#e9edff';
          context.beginPath();
          context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
          context.fill();
        });
        context.restore();
      }

      const cloudy = ['cloudy', 'partly-cloudy', 'fog', 'rain', 'rain-windy', 'storm', 'storm-windy', 'humid'].includes(scene);
      const clearStrength = scene === 'clear' ? 0.28 : 0;
      const cloudStrength = cloudy ? (scene === 'partly-cloudy' ? 0.66 : 1) : clearStrength;
      clouds.forEach((cloud) => drawCloud(cloud, time, palette.cloud, cloudStrength));

      if (scene === 'hot') {
        context.save();
        context.globalAlpha = 0.2;
        context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        context.lineWidth = 2;
        for (let index = 0; index < 18; index += 1) {
          const x = (index / 17) * width;
          context.beginPath();
          for (let y = height * 0.22; y < height; y += 28) {
            const wave = Math.sin(y * 0.022 + time * 1.2 + index) * 9;
            if (y === height * 0.22) context.moveTo(x + wave, y);
            else context.lineTo(x + wave, y);
          }
          context.stroke();
        }
        context.restore();
      }

      const rainy = ['rain', 'rain-windy', 'storm', 'storm-windy'].includes(scene);
      if (rainy) {
        context.save();
        context.globalAlpha = scene.includes('storm') ? 0.42 : 0.34;
        context.strokeStyle = 'rgba(174, 220, 255, 0.72)';
        context.lineWidth = 1.2;
        rain.forEach((drop) => {
          const y = ((drop.y + time * drop.speed * 0.22) % 1) * height;
          const x = (((drop.x + time * drop.drift * 0.06) % 1) + 1) % 1 * width;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + drop.drift * width * 0.16, y + drop.length * height);
          context.stroke();
        });
        context.restore();
      }

      if (scene.includes('windy') || scene === 'windy') {
        context.save();
        context.globalAlpha = 0.24;
        context.strokeStyle = 'rgba(255, 255, 255, 0.48)';
        context.lineWidth = 2;
        windLines.forEach((line) => {
          const x = (((line.x + time * line.speed) % 1) + 1) % 1 * width;
          const y = line.y * height;
          context.beginPath();
          context.moveTo(x, y);
          context.bezierCurveTo(x + width * 0.05, y - 14, x + width * 0.1, y + 14, x + width * line.length, y);
          context.stroke();
        });
        context.restore();
      }

      if (scene.includes('storm')) {
        const flash = Math.sin(time * 1.85) > 0.982 ? 0.38 : 0;
        if (flash) {
          context.fillStyle = `rgba(255, 255, 255, ${flash})`;
          context.fillRect(0, 0, width, height);
        }
      }

      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, active, scene, night]);
}

function ChronoHub({ now, mode, timeFormat, clockTimeZone, alarm, setManualMode, blackout, setBlackout, ambientPhase, weather, weatherMood, sleepMode, idle, clockBackground, goDashboard, goSettings }) {
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const weatherCanvasRef = useRef(null);
  const modes = ['white', 'slate', 'night'];
  const maxPerformance = isMaxPerformance();

  useEffect(() => {
    const timer = setInterval(() => {
      setShift({
        x: Math.round((Math.random() - 0.5) * 12),
        y: Math.round((Math.random() - 0.5) * 12)
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const time = formatClockTime(now, timeFormat, { timeZone: clockTimeZone });
  const clockDisplay = getClockDisplayParts(now, timeFormat, clockTimeZone);
  const date = formatClockDate(now, clockTimeZone);
  const chronoIsNight = isNightAt(now, weather?.sunrise, weather?.sunset);
  const chronoCondition = weatherCondition(weather?.code ?? 0, chronoIsNight);
  const ChronoStatusIcon = chronoCondition.Icon;
  const celestial = getCelestialPosition(now, weather?.sunrise, weather?.sunset);
  const moon = useMemo(() => getMoonPhase(now), [now.toDateString()]);
  const moonPath = useMemo(() => moonPhasePath(moon.fraction), [moon.fraction]);
  const sunScene = sunSceneForWeather(weather?.code ?? 0);
  const sunCondition = weatherCondition(weather?.code ?? 0, false);
  const celestialLabel = celestial.night ? `${moon.phase}, ${moon.illumination}% lit` : `${sunCondition.label}, ${celestial.progress}% through daylight`;
  useChronoWeatherCanvas(weatherCanvasRef, clockBackground === 'weather' && !maxPerformance, weatherMood.id, chronoIsNight);

  if (blackout) {
    return (
      <button className="blackout" onDoubleClick={() => setBlackout(false)} aria-label="Disable blackout">
        <span />
      </button>
    );
  }

  return (
    <section className={`chrono ${mode} phase-${ambientPhase.id} weather-${weatherMood.id} background-${clockBackground} ${chronoIsNight ? 'sun-is-down' : 'sun-is-up'} ${sleepMode ? 'sleep-mode' : ''} ${idle ? 'ambient-idle' : ''}`}>
      <div className="chrono-depth chrono-sky" aria-hidden="true" />
      {clockBackground === 'weather' && !maxPerformance && <canvas ref={weatherCanvasRef} className="chrono-depth chrono-weather-canvas" aria-hidden="true" />}
      {(clockBackground === 'celestial' || clockBackground === 'weather') && (
        <div
          className={`chrono-depth chrono-celestial ${clockBackground === 'weather' ? (celestial.night ? 'weather-moon' : 'weather-sun') : ''} ${celestial.night ? 'moon' : 'sun'}`}
          style={{
            '--celestial-x': `${celestial.x}%`,
            '--celestial-y': `${celestial.y}%`,
            '--celestial-glow': celestial.glow
          }}
          aria-label={celestialLabel}
        >
          <span className="celestial-orbit" />
          <span className={`celestial-body ${celestial.night ? `moon-phase-${moon.phaseId}` : 'sun-real-body'}`}>
            {celestial.night ? (
              <span className="celestial-moon-real" title={`${moon.phase} - ${moon.illumination}% lit`}>
                <svg className="moon-phase-svg" viewBox="0 0 100 100" role="img" aria-label={`${moon.phase}, ${moon.illumination}% lit`}>
                  <defs>
                    <clipPath id="chronoMoonDisc">
                      <circle cx="50" cy="50" r="46" />
                    </clipPath>
                  </defs>
                  <circle className="moon-shadow-disc" cx="50" cy="50" r="46" />
                  {moonPath && <path className="moon-lit-shape" d={moonPath} />}
                  <g className="moon-surface-detail" clipPath="url(#chronoMoonDisc)">
                    <circle cx="33" cy="32" r="4.2" />
                    <circle cx="62" cy="29" r="3.1" />
                    <circle cx="71" cy="53" r="5.4" />
                    <circle cx="42" cy="62" r="3.8" />
                    <circle cx="56" cy="72" r="2.4" />
                  </g>
                  <circle className="moon-rim" cx="50" cy="50" r="46" />
                </svg>
                <span className="celestial-caption">{moon.phase}</span>
              </span>
            ) : (
              <span className={`celestial-sun-real sun-scene-${sunScene}`} title={sunCondition.label}>
                <span className="sun-rays" />
                <span className="sun-core" />
                <span className="sun-hotspot" />
                {sunScene !== 'sunny' && <span className="sun-cloud sun-cloud-a" />}
                {['cloudy', 'rainy', 'storm', 'fog'].includes(sunScene) && <span className="sun-cloud sun-cloud-b" />}
                {['rainy', 'storm'].includes(sunScene) && <span className="sun-rain-lines" />}
                {sunScene === 'storm' && <span className="sun-lightning" />}
                <span className="celestial-caption sun-caption">{sunCondition.label}</span>
              </span>
            )}
          </span>
        </div>
      )}
      <div className="chrono-depth chrono-particles" aria-hidden="true" />
      <div className="chrono-depth chrono-weather-scene" aria-hidden="true">
        <span className="scene-cloud scene-cloud-a" />
        <span className="scene-cloud scene-cloud-b" />
        <span className="scene-streaks" />
        <span className="scene-flash" />
      </div>
      <div className="chrono-depth chrono-glow" aria-hidden="true" />
      <div className="seconds-ring" style={{ '--progress': `${secondsProgress(now)}%` }} />
      <div className="tap-zones">
        {modes.map((item) => (
          <button key={item} onClick={() => setManualMode(item)} aria-label={`Switch to ${item} mode`} />
        ))}
      </div>
      <motion.div
        className="chrono-content"
        animate={{ x: shift.x, y: shift.y }}
        transition={{ type: 'spring', stiffness: 18, damping: 12 }}
        onDoubleClick={() => setBlackout(true)}
      >
        <div className={`chrono-time chrono-time-${clockDisplay.kind}`} aria-label={time}>
          <span className="time-primary">{clockDisplay.primary}</span>
          {clockDisplay.period && <span className="time-period">{clockDisplay.period}</span>}
          {clockDisplay.secondary && <span className="time-secondary">{clockDisplay.secondary}</span>}
        </div>
        <div className="chrono-seconds">{pad(now.getSeconds())}</div>
        <div className="chrono-date">{date}</div>
      </motion.div>
      <div className="chrono-footer">
        <div><AlarmClock size={18} /> {formatAlarmLabel(alarm, timeFormat)}</div>
        <div className="chrono-status"><ChronoStatusIcon size={18} /> {timeZoneLabel(clockTimeZone)} time / {weather.location?.name || 'Weather'} {weatherMood.label}</div>
        <div className="footer-actions">
          <button onClick={goSettings} aria-label="Open tools"><Settings size={20} /></button>
          <button onClick={goDashboard} aria-label="Dashboard"><span>Dashboard</span><ChevronRight size={22} /></button>
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

function WeatherConsolePanel({ weather, weatherMood, liveWeatherMood, weatherBackgroundOverride, currentIsNight, timeFormat }) {
  const condition = weatherCondition(weather.code, currentIsNight);
  const nextHour = weather.hourly?.find((hour) => hour.time > new Date(Date.now() + 30 * 60 * 1000)) || weather.hourly?.[1] || null;
  const visibility = weather.hourly?.[0]?.visibilityKm;
  const tempDelta = nextHour ? nextHour.temp - weather.temp : 0;
  const overrideLabel = WEATHER_BACKGROUND_OVERRIDES.find((item) => item.id === weatherBackgroundOverride)?.label || 'Live';
  const backgroundMode = weatherBackgroundOverride === 'live'
    ? `Live -> ${liveWeatherMood?.label || weatherMood.label}`
    : `Manual -> ${overrideLabel}`;

  return (
    <div className="weather-console-panel">
      <div className="console-header">
        <div>
          <span>CORE WEATHER CONSOLE</span>
          <strong>{condition.label}</strong>
        </div>
        <em>{weather.loaded ? 'LIVE' : 'FALLBACK'}</em>
      </div>
      <div className="console-grid">
        <div><span>Code</span><strong>{weather.code ?? '--'}</strong></div>
        <div><span>Updated</span><strong>{weather.fetchedAt ? formatClockTime(new Date(weather.fetchedAt), timeFormat) : 'waiting'}</strong></div>
        <div><span>Background</span><strong>{backgroundMode}</strong></div>
        <div><span>Sky state</span><strong>{currentIsNight ? 'Night' : 'Day'}</strong></div>
        <div><span>Next hour</span><strong>{nextHour ? `${nextHour.temp}C (${tempDelta >= 0 ? '+' : ''}${tempDelta}C)` : '--'}</strong></div>
        <div><span>Visibility</span><strong>{visibility ? `${visibility} km` : '--'}</strong></div>
        <div><span>Humidity</span><strong>{weather.humidity}%</strong></div>
        <div><span>Wind</span><strong>{weather.wind} km/h {windDirectionLabel(weather.windDirection)}</strong></div>
      </div>
      <p>{weather.error || (weatherBackgroundOverride === 'live' ? 'Background follows the live weather feed.' : 'Background is manually overridden in Settings.')}</p>
    </div>
  );
}

function MoonPhoto({ moon }) {
  return (
    <div className="moon-photo" style={{ '--lit': `${moon.illumination}%` }} aria-label={`${moon.phase}, ${moon.illumination}% lit`}>
      <span />
    </div>
  );
}

function WelcomeExperience({ mode, mood = 'space', now, timeFormat, assistantSettings, onDismiss }) {
  const canvasRef = useRef(null);
  const introName = assistantIntroName(assistantSettings);
  const startupName = assistantStartupName(assistantSettings);
  const statusItems = [
    ['Weather', 'live'],
    ['Prayer', 'synced'],
    ['Gold', 'ready']
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const palette = {
      hacker: ['#22c55e', '#86efac'],
      natural: ['#34d399', '#f4c95d'],
      calm: ['#7dd3fc', '#bae6fd'],
      space: ['#8b5cf6', '#7dd3fc'],
      storm: ['#ff3030', '#f4c95d']
    }[mood] || ['#86efac', '#b8f7c8'];
    const accent = mode === 'night' ? '#ff1717' : mode === 'white' ? palette[0] : '#86efac';
    const softAccent = mode === 'night' ? '#ff5a5a' : palette[1];
    const particles = Array.from({ length: 52 }, (_, index) => ({
      angle: (index / 52) * Math.PI * 2,
      radius: 0.22 + (index % 9) * 0.065,
      speed: 0.16 + (index % 5) * 0.025,
      size: 0.8 + (index % 4) * 0.42,
      alpha: 0.22 + (index % 6) * 0.055
    }));

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let lastRender = 0;
    const start = performance.now();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.15);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function ellipseRing(centerX, centerY, radius, tilt, rotation, color, alpha, lineWidth) {
      context.save();
      context.translate(centerX, centerY);
      context.rotate(rotation);
      context.scale(1, tilt);
      context.globalAlpha = alpha;
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    function draw(timestamp = performance.now()) {
      try {
        if (!reducedMotion && timestamp - lastRender < 42) {
          frame = requestAnimationFrame(draw);
          return;
        }
        lastRender = timestamp;
        const elapsed = (timestamp - start) / 1000;
        const centerX = width * 0.5;
        const centerY = height * 0.42;
        const base = Math.max(80, Math.min(width, height) * 0.22);
        const intro = Math.min(1, elapsed / 0.9);
        const scale = 0.74 + (1 - Math.pow(1 - intro, 3)) * 0.26;

        context.clearRect(0, 0, width, height);
        const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, base * 2.8);
        glow.addColorStop(0, canvasAlpha(accent, 0.34));
        glow.addColorStop(0.42, canvasAlpha(softAccent, 0.14));
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);

        particles.forEach((particle) => {
          const angle = particle.angle + elapsed * particle.speed;
          const orbit = base * particle.radius * 2.7 * scale;
          const x = centerX + Math.cos(angle) * orbit;
          const y = centerY + Math.sin(angle) * orbit * 0.42;
          context.globalAlpha = particle.alpha;
          context.fillStyle = particle.angle % 2 > 1 ? softAccent : accent;
          context.beginPath();
          context.arc(x, y, particle.size, 0, Math.PI * 2);
          context.fill();
        });
        context.globalAlpha = 1;

        for (let index = 0; index < 4; index += 1) {
          ellipseRing(
            centerX,
            centerY,
            base * scale * (0.9 + index * 0.27),
            0.34 + index * 0.08,
            elapsed * (0.16 + index * 0.04) + index * 0.8,
            index % 2 ? softAccent : accent,
            0.34 - index * 0.045,
            Math.max(1, base * 0.012)
          );
        }

        const core = context.createRadialGradient(centerX - base * 0.18, centerY - base * 0.2, base * 0.05, centerX, centerY, base * 0.58);
        core.addColorStop(0, mode === 'night' ? '#ff7777' : '#ffffff');
        core.addColorStop(0.35, softAccent);
        core.addColorStop(1, mode === 'night' ? '#240404' : '#101a16');
        context.fillStyle = core;
        context.beginPath();
        context.ellipse(centerX, centerY, base * 0.46 * scale, base * 0.46 * scale, elapsed * 0.18, 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = canvasAlpha(accent, 0.8);
        context.lineWidth = Math.max(1, base * 0.018);
        context.beginPath();
        context.arc(centerX, centerY, base * 0.52 * scale, elapsed * 0.7, elapsed * 0.7 + Math.PI * 1.35);
        context.stroke();

        if (!reducedMotion) frame = requestAnimationFrame(draw);
      } catch {
        canvas.style.display = 'none';
      }
    }

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [mode, mood]);

  useEffect(() => {
    if (!assistantSettings.startupGreetingEnabled) return undefined;
    let audio = null;
    const timer = window.setTimeout(() => {
      const audioUrl = resolveStartupAudioUrl(assistantSettings.startupAudioUrl);
      if (assistantSettings.startupGreetingMode === 'custom-audio' && audioUrl) {
        try {
          audio = new Audio(audioUrl);
          audio.volume = 0.72;
          audio.play().catch(() => speakAssistantReply(`Welcome home ${startupName}`, assistantSettings, { rate: 0.9, pitch: 0.92, volume: 0.68 }));
          return;
        } catch {
          // Fall through to spoken greeting.
        }
      }
      speakAssistantReply(`Welcome home ${startupName}`, assistantSettings, { rate: 0.9, pitch: 0.92, volume: 0.68 });
    }, 550);
    return () => {
      window.clearTimeout(timer);
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      window.speechSynthesis?.cancel();
    };
  }, [assistantSettings, startupName]);

  return (
    <motion.button
      type="button"
      className={`welcome-stage ${mode} mood-${mood}`}
      onClick={onDismiss}
      aria-label="Dismiss welcome animation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
    >
      <canvas ref={canvasRef} className="welcome-canvas" />
      <div className="welcome-aurora" />
      <div className="welcome-grid" />
      <div className="welcome-scan" />
      <motion.div
        className="welcome-system"
        aria-hidden="true"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.34 }}
      >
        <span>BOOT</span>
        <span>{mood.toUpperCase()} CORE</span>
        <span>{formatClockTime(now, timeFormat)}</span>
      </motion.div>
      <motion.div
        className="welcome-copy"
        initial={{ y: 30, opacity: 0, rotateX: 12, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
        transition={{ delay: 0.24, duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.span
          className="welcome-kicker"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.28 }}
        >
          {introName} is awake
        </motion.span>
        <strong><span>Welcome home</span> {startupName}</strong>
        <em>{formatClockTime(now, timeFormat)} / Ajman kiosk online</em>
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

function Dashboard({ now, weather, timeFormat, clockTimeZone, alarm, customWidgets, setCustomWidgets, customSections, setCustomSections, deletedWidgets, deleteCustomWidget, toggleWidgetLock, restoreDeletedWidget, restoreAllDeletedWidgets, musicLibrary, musicPlayer, cameraWakeEnabled, setCameraWakeEnabled, cameraWakeStatus, cameraVideoRef, assistantSettings, setAssistantSettings, runAssistantCommand, assistantTimer, alwaysListening, cameraTheme, smartTheme, showDeviceToast, ambientPhase, weatherMood, liveWeatherMood, weatherBackgroundOverride, sleepMode, setSleepMode, idle, noiseEnabled, setNoiseEnabled, noise, focus, roomMode, setRoomMode, focusLock, setFocusLock, battery, caffeine, openBrainDump, openQuickControls, goClock, goSettings }) {
  const gold = useGoldPrices();
  const fuel = useFuelPrices();
  const news = useNewsFeed();
  const system = useSystemInfo();
  const air = useAirQuality(weather.location);
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
  const [dashboardDragType, setDashboardDragType] = useState('');
  const [dashboardDragWidgetId, setDashboardDragWidgetId] = useState('');
  const [dashboardDropTarget, setDashboardDropTarget] = useState('');
  const [dashboardDragSectionId, setDashboardDragSectionId] = useState('');
  const [dashboardSectionDropIndex, setDashboardSectionDropIndex] = useState(null);
  const [activeNotification, setActiveNotification] = useState(null);
  const hourlyRef = useRef(null);
  const dashboardRef = useRef(null);
  const notifiedRef = useRef(new Map());
  const notificationChime = useNotificationChime();
  const prayer = nextPrayer(now);
  const prayers = useMemo(() => getPrayerTimes(now), [now.toDateString()]);
  const moon = useMemo(() => getMoonPhase(now), [now.toDateString()]);
  const moonTimes = useMemo(() => getMoonTimes(now, weather.location), [now.toDateString(), weather.location?.lat, weather.location?.lon]);
  const todos = todoLists[activeTodoType] || [];
  const smartWidgets = getSmartWidgets({ now, weather, system, prayer, moon, alarm, timeFormat });
  const smartReminders = useMemo(() => getSmartReminders({ now, weather, prayer, hydration, habits, agenda, dailyGoals, exams, air, battery, system, roomMode, caffeine }), [now, weather, prayer, hydration, habits, agenda, dailyGoals, exams, air, battery, system, roomMode, caffeine]);
  const notificationCandidate = smartReminders.find((reminder) => reminder.id !== 'steady') || null;
  const notificationSignal = notificationCandidate ? `${notificationCandidate.id}:${notificationCandidate.tone}:${notificationCandidate.title}` : '';
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

  useEffect(() => {
    if (!notificationCandidate || focusLock) return;
    const nowMs = Date.now();
    const throttleKey = `${notificationCandidate.id}:${notificationCandidate.tone || 'green'}`;
    const lastSeen = notifiedRef.current.get(throttleKey) || 0;
    if (nowMs - lastSeen < 10 * 60 * 1000) return;
    notifiedRef.current.set(throttleKey, nowMs);
    setActiveNotification({ ...notificationCandidate, createdAt: nowMs });
    notificationChime.play(notificationCandidate.tone || 'soft').catch(() => {});
  }, [notificationSignal, focusLock, notificationChime.play]);

  useEffect(() => {
    if (!activeNotification) return undefined;
    const timer = setTimeout(() => setActiveNotification(null), 8200);
    return () => clearTimeout(timer);
  }, [activeNotification?.createdAt]);

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

    const centerX = closest.rect.left + closest.rect.width / 2;
    const centerY = closest.rect.top + closest.rect.height / 2;
    const horizontalWeight = Math.abs((clientX - centerX) / Math.max(closest.rect.width, 1));
    const verticalWeight = Math.abs((clientY - centerY) / Math.max(closest.rect.height, 1));
    const insertAfter = horizontalWeight > verticalWeight * 0.85 ? clientX > centerX : clientY > centerY;
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
      return renderDashboardStack('reminders', (
        <SmartReminderPanel
          reminders={smartReminders}
          soundReady={notificationChime.ready}
          onPreviewSound={() => notificationChime.play('green')}
        />
      ));
    }

    if (sectionId === 'room-mode') {
      return renderDashboardStack('room-mode', <RoomModePanel roomMode={roomMode} setRoomMode={setRoomMode} />);
    }

    if (sectionId === 'quick-links') {
      return renderDashboardStack('quick-links', <QuickLinksPanel links={quickLinks} />);
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
              <h2>{weather.location?.name || 'Weather'} Weather</h2>
              <p>{weather.loaded ? `Open-Meteo live / ${weather.location?.country || weather.location?.timezone}` : weather.error || 'Cached fallback'}</p>
            </div>
          </div>
          <div className="weather-source-pill">
            <span>Live source</span>
            <strong>Code {weather.code ?? '--'} / {liveWeatherMood?.label || weatherCondition(weather.code, currentIsNight).label}</strong>
            {weatherBackgroundOverride !== 'live' && <em>Background override: {WEATHER_BACKGROUND_OVERRIDES.find((item) => item.id === weatherBackgroundOverride)?.label}</em>}
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
          <div className="astro-grid">
            <div><span>Sunrise</span><strong>{formatWeatherLocalTime(weather.sunrise, timeFormat)}</strong></div>
            <div><span>Sunset</span><strong>{formatWeatherLocalTime(weather.sunset, timeFormat)}</strong></div>
            <div><span>Moonrise</span><strong>{moonTimes.rise ? formatClockTime(moonTimes.rise, timeFormat, { timeZone: weather.location?.timezone }) : '--'}</strong></div>
            <div><span>Moonset</span><strong>{moonTimes.set ? formatClockTime(moonTimes.set, timeFormat, { timeZone: weather.location?.timezone }) : '--'}</strong></div>
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
          <WeatherConsolePanel
            weather={weather}
            weatherMood={weatherMood}
            liveWeatherMood={liveWeatherMood}
            weatherBackgroundOverride={weatherBackgroundOverride}
            currentIsNight={currentIsNight}
            timeFormat={timeFormat}
          />
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
                <strong>{hour.label || formatClockTime(hour.time, timeFormat)}</strong>
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

    if (sectionId === 'device-controls') {
      return renderDashboardStack('device-controls', <DeviceControlsPanel showToast={showDeviceToast} />);
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
          <div className="uptime">Camera wake clears blackout when motion or a face is detected.</div>
        </section>
      ));
    }

    if (sectionId === 'camera-theme') {
      return renderDashboardStack('camera-theme', (
        <CameraThemePanel
          settings={assistantSettings}
          setSettings={setAssistantSettings}
          cameraTheme={cameraTheme}
          smartTheme={smartTheme}
        />
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

    if (sectionId === 'ai-assistant') {
      return renderDashboardStack('ai-assistant', (
        <AssistantPanel
          settings={assistantSettings}
          runCommand={runAssistantCommand}
          timer={assistantTimer}
          alwaysListening={alwaysListening}
        />
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

  return (
    <section ref={dashboardRef} className={`dashboard phase-${ambientPhase.id} weather-${weatherMood.id} smart-theme-${smartTheme} ${sleepMode ? 'sleep-mode' : ''} ${idle ? 'ambient-idle' : ''}`}>
      <header className="dash-top">
        <button className="icon-button" onClick={goClock} aria-label="Back to clock"><ChevronLeft size={24} /></button>
        <div>
          <h1>Project Nexora</h1>
          <span className="ambient-kicker">{ambientPhase.label} / {weatherMood.label}</span>
          <p>{weather.location?.name || 'Room'} room kiosk / {formatClockDate(now, clockTimeZone, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        </div>
        <div className="top-actions">
          <button className={musicPlayer.playing ? 'icon-button active' : 'icon-button'} onClick={musicPlayer.togglePlay} aria-label={musicPlayer.playing ? 'Pause music' : 'Play music'} disabled={!musicPlayer.tracks.length}>
            {musicPlayer.playing ? <Pause size={21} /> : <Play size={21} />}
          </button>
          <button className={cameraWakeEnabled ? 'icon-button active' : 'icon-button'} onClick={() => setCameraWakeEnabled(!cameraWakeEnabled)} aria-label="Toggle camera wake"><Camera size={21} /></button>
          <button className="icon-button" onClick={openQuickControls} aria-label="Quick controls"><Gauge size={21} /></button>
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

      <AnimatePresence>
        {activeNotification && (
          <NotificationToast
            key={`${activeNotification.id}-${activeNotification.createdAt}`}
            notification={activeNotification}
            onDismiss={() => setActiveNotification(null)}
            onPreviewSound={() => notificationChime.play(activeNotification.tone || 'green')}
          />
        )}
      </AnimatePresence>

      <main className={`dash-grid ${dashboardDragSectionId ? 'section-dragging' : ''} ${dashboardDragWidgetId || dashboardDragType ? 'widget-dragging' : ''}`}>
        {dashboardLayoutOrder.map((sectionId) => renderDashboardSection(sectionId))}
      </main>
    </section>
  );
}

function DeviceControlsPanel({ showToast }) {
  const [activeTab, setActiveTab] = useState('display');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wifiNetworks, setWifiNetworks] = useState([]);
  const [wifiPassword, setWifiPassword] = useState('');
  const [bluetoothDevices, setBluetoothDevices] = useState([]);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [brightnessDraft, setBrightnessDraft] = useState(50);
  const [volumeDraft, setVolumeDraft] = useState(50);
  const [warmthDraft, setWarmthDraft] = useState(3500);
  const [runtimeSeconds, setRuntimeSeconds] = useState(0);

  const toast = useCallback((title, detail = '', tone = 'green') => {
    showToast?.(title, detail, tone);
  }, [showToast]);

  const loadStatus = useCallback(async (quiet = false) => {
    setLoading(true);
    const data = await deviceApiRequest('/api/device/status');
    setStatus(data);
    setLoading(false);
    if (!quiet && !data.ok) toast('Device controls blocked', data.error || 'Backend is unavailable.', 'amber');
    return data;
  }, [toast]);

  useEffect(() => {
    loadStatus(true);
    const fullTimer = window.setInterval(() => loadStatus(true), 2 * 60 * 1000);
    const batteryTimer = window.setInterval(async () => {
      const data = await deviceApiRequest('/api/device/battery');
      if (data.ok) setStatus((current) => ({ ...(current || {}), battery: data }));
    }, 60 * 1000);
    const runtimeTimer = window.setInterval(async () => {
      const data = await deviceApiRequest('/api/device/runtime');
      if (data.ok) setRuntimeSeconds(data.seconds || 0);
    }, 2 * 60 * 1000);
    return () => {
      window.clearInterval(fullTimer);
      window.clearInterval(batteryTimer);
      window.clearInterval(runtimeTimer);
    };
  }, [loadStatus]);

  useEffect(() => {
    if (status?.brightness?.percent != null) setBrightnessDraft(status.brightness.percent);
    if (status?.volume?.percent != null) setVolumeDraft(status.volume.percent);
    if (status?.night_light?.temperature != null) setWarmthDraft(status.night_light.temperature);
  }, [status?.brightness?.percent, status?.volume?.percent, status?.night_light?.temperature]);

  async function runDevice(path, body, successTitle, method = 'POST') {
    setLoading(true);
    const data = await deviceApiRequest(path, { method, body });
    setLoading(false);
    if (data.ok) {
      toast(successTitle, data.message || 'Updated.', 'green');
      await loadStatus(true);
    } else {
      toast('Device control failed', data.error || 'Command failed.', 'red');
    }
    return data;
  }

  async function scanWifi() {
    setLoading(true);
    toast('Wi-Fi scan started', '', 'green');
    const data = await deviceApiRequest('/api/device/wifi/scan');
    setLoading(false);
    if (data.ok) {
      setWifiNetworks(data.networks || []);
      toast('Wi-Fi scan complete', `${data.networks?.length || 0} network${data.networks?.length === 1 ? '' : 's'} found.`, 'green');
    } else {
      toast('Wi-Fi scan failed', data.error || 'Scan failed.', 'red');
    }
  }

  async function scanBluetooth() {
    setLoading(true);
    toast('Bluetooth scan started', '', 'green');
    const data = await deviceApiRequest('/api/device/bluetooth/scan');
    const paired = await deviceApiRequest('/api/device/bluetooth/paired');
    setLoading(false);
    if (data.ok) {
      setBluetoothDevices(data.devices || []);
      if (paired.ok) setPairedDevices(paired.devices || []);
      toast('Bluetooth scan complete', `${data.devices?.length || 0} device${data.devices?.length === 1 ? '' : 's'} found.`, 'green');
    } else {
      toast('Bluetooth scan failed', data.error || 'Scan failed.', 'red');
    }
  }

  const dependencies = Object.entries(status?.dependencies || {}).filter(([, info]) => !info.available);
  const brightness = status?.brightness || {};
  const batteryStatus = status?.battery || {};
  const power = status?.power || {};
  const volume = status?.volume || {};
  const nightLight = status?.night_light || {};
  const dnd = status?.do_not_disturb || {};
  const airplane = status?.airplane || {};
  const tailscale = status?.tailscale || {};
  const wifi = status?.wifi || {};
  const bluetooth = status?.bluetooth || {};
  const disabled = status && !status.ok;
  const batteryLabel = batteryStatus.percent == null ? '--%' : `${batteryStatus.percent}%${batteryStatus.charging ? ' charging' : ''}`;
  const powerLabel = power.mode === 'battery-saver' ? 'Saver' : power.mode === 'performance' ? 'Fast' : power.mode ? 'Normal' : '--';
  const runtimeLabel = formatUptime(runtimeSeconds || status?.runtime?.seconds || 0);

  return (
    <section className="panel device-controls-panel">
      <div className="panel-heading">
        <Monitor size={22} />
        <div>
          <h2>Device Controls</h2>
          <p>Display, sound, power, battery, VPN, Wi-Fi, and Bluetooth through local backend</p>
        </div>
        <button className="mini-refresh" type="button" onClick={() => loadStatus()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className={`device-status-strip ${disabled ? 'blocked' : ''}`}>
        <div><span>Control</span><strong>{disabled ? 'Disabled' : status?.allowed ? 'Local' : 'Checking'}</strong></div>
        <div><span>Battery</span><strong>{batteryLabel}</strong></div>
        <div><span>Runtime</span><strong>{runtimeLabel}</strong></div>
        <div><span>Power</span><strong>{powerLabel}</strong></div>
        <div><span>Brightness</span><strong>{brightness.percent ?? '--'}%</strong></div>
        <div><span>Volume</span><strong>{volume.percent ?? '--'}%</strong></div>
      </div>
      {disabled && <div className="device-message">{status.error}</div>}

      <div className="device-tabs" aria-label="Device control tabs">
        {DEVICE_CONTROL_TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'display' && (
        <div className="device-tab-panel">
          <label className="device-slider">
            <span>Brightness {brightnessDraft}%</span>
            <input
              type="range"
              min="1"
              max="100"
              value={brightnessDraft}
              onChange={(event) => setBrightnessDraft(Number(event.target.value))}
              onPointerUp={() => runDevice('/api/device/brightness', { percent: brightnessDraft }, `Brightness set to ${brightnessDraft}%`)}
            />
          </label>
          <div className="device-button-row">
            <button type="button" onClick={() => runDevice('/api/device/brightness', { percent: 15 }, 'Screen dimmed')}>Dim</button>
            <button type="button" onClick={() => runDevice('/api/device/brightness', { percent: 55 }, 'Brightness normal')}>Normal</button>
            <button type="button" onClick={() => runDevice('/api/device/brightness', { percent: 90 }, 'Screen brightened')}>Bright</button>
          </div>
          <div className="device-inline-card">
            <div>
              <span>Night Light</span>
              <strong>{nightLight.enabled ? 'On' : 'Off'}</strong>
            </div>
            <button type="button" onClick={() => runDevice('/api/device/night-light', { enabled: !nightLight.enabled }, nightLight.enabled ? 'Night Light is now off' : 'Night Light is now on')}>
              Toggle
            </button>
          </div>
          <label className="device-slider">
            <span>Warmth {warmthDraft}K</span>
            <input
              type="range"
              min="2700"
              max="6500"
              step="100"
              value={warmthDraft}
              onChange={(event) => setWarmthDraft(Number(event.target.value))}
              onPointerUp={() => runDevice('/api/device/night-light', { temperature: warmthDraft }, 'Night Light warmth updated')}
            />
          </label>
        </div>
      )}

      {activeTab === 'sound' && (
        <div className="device-tab-panel">
          <label className="device-slider">
            <span>Volume {volumeDraft}% {volume.muted ? '(muted)' : ''}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volumeDraft}
              onChange={(event) => setVolumeDraft(Number(event.target.value))}
              onPointerUp={() => runDevice('/api/device/volume', { percent: volumeDraft }, `Volume set to ${volumeDraft}%`)}
            />
          </label>
          <div className="device-button-row">
            <button type="button" onClick={() => runDevice('/api/device/volume', { action: 'down', step: 5 }, 'Volume decreased')}>Lower</button>
            <button type="button" onClick={() => runDevice('/api/device/volume/mute', { muted: !volume.muted }, volume.muted ? 'Audio unmuted' : 'Audio muted')}>
              {volume.muted ? <Volume2 size={16} /> : <VolumeX size={16} />} {volume.muted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" onClick={() => runDevice('/api/device/volume', { action: 'up', step: 5 }, 'Volume increased')}>Raise</button>
          </div>
        </div>
      )}

      {activeTab === 'power' && (
        <div className="device-tab-panel">
          <div className="device-inline-card">
            <div>
              <span>Live battery</span>
              <strong>{batteryLabel}</strong>
            </div>
            <button type="button" onClick={() => loadStatus()}>Refresh</button>
          </div>
          <div className="device-power-modes" aria-label="Power mode">
            <button type="button" className={power.mode === 'battery-saver' ? 'active' : ''} onClick={() => runDevice('/api/device/power', { mode: 'battery-saver' }, 'Battery saver enabled')}>
              Battery saver
            </button>
            <button type="button" className={!power.mode || power.mode === 'normal' ? 'active' : ''} onClick={() => runDevice('/api/device/power', { mode: 'normal' }, 'Normal power mode enabled')}>
              Normal
            </button>
            <button type="button" className={power.mode === 'performance' ? 'active' : ''} onClick={() => runDevice('/api/device/power', { mode: 'performance' }, 'Performance mode enabled')}>
              Performance
            </button>
          </div>
          <div className="device-inline-card">
            <div>
              <span>Do Not Disturb</span>
              <strong>{dnd.supported === false ? 'Unsupported' : dnd.enabled ? 'On' : 'Off'}</strong>
            </div>
            <button type="button" onClick={() => runDevice('/api/device/dnd', { enabled: !dnd.enabled }, dnd.enabled ? 'Do Not Disturb is off' : 'Do Not Disturb is on')}>
              {dnd.enabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
          <div className="device-inline-card">
            <div>
              <span>Airplane Mode</span>
              <strong>{airplane.enabled ? 'On' : 'Off'}</strong>
            </div>
            <button type="button" onClick={() => runDevice('/api/device/airplane', { enabled: !airplane.enabled }, airplane.enabled ? 'Airplane mode is off' : 'Airplane mode is on')}>
              {airplane.enabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
          <div className="device-inline-card">
            <div>
              <span>Tailscale VPN</span>
              <strong>{tailscale.enabled ? 'On' : tailscale.state || 'Off'}</strong>
            </div>
            <button type="button" onClick={() => runDevice('/api/device/tailscale', { enabled: !tailscale.enabled }, tailscale.enabled ? 'Tailscale VPN is off' : 'Tailscale VPN is on')}>
              {tailscale.enabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
          {(dnd.message || tailscale.error || power.error) && (
            <div className="device-message">{dnd.message || tailscale.error || power.error}</div>
          )}
        </div>
      )}

      {activeTab === 'wifi' && (
        <div className="device-tab-panel">
          <div className="device-inline-card">
            <div>
              <span>Connected network</span>
              <strong>{wifi.connected || (wifi.enabled ? 'Not connected' : 'Wi-Fi off')}</strong>
            </div>
            <button type="button" onClick={() => runDevice('/api/device/wifi/toggle', { enabled: !wifi.enabled }, wifi.enabled ? 'Wi-Fi is off' : 'Wi-Fi is on')}>
              {wifi.enabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
          <details className="device-advanced">
            <summary>Scan and connect</summary>
            <button type="button" onClick={scanWifi} disabled={loading}>Scan Wi-Fi</button>
            <input type="password" value={wifiPassword} onChange={(event) => setWifiPassword(event.target.value)} placeholder="Wi-Fi password if needed" />
            <div className="device-list">
              {wifiNetworks.map((network) => (
                <div key={network.ssid} className="device-list-row">
                  <div><strong>{network.ssid}</strong><span>{network.signal}% / {network.security || 'open'}</span></div>
                  <button type="button" onClick={() => runDevice('/api/device/wifi/connect', { ssid: network.ssid, password: wifiPassword }, `Connecting to ${network.ssid}`)}>Connect</button>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {activeTab === 'bluetooth' && (
        <div className="device-tab-panel">
          <div className="device-inline-card">
            <div>
              <span>Bluetooth</span>
              <strong>{bluetooth.enabled ? 'On' : 'Off'}</strong>
            </div>
            <button type="button" onClick={() => runDevice('/api/device/bluetooth/toggle', { enabled: !bluetooth.enabled }, bluetooth.enabled ? 'Bluetooth is off' : 'Bluetooth is on')}>
              {bluetooth.enabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
          <details className="device-advanced">
            <summary>Scan and manage devices</summary>
            <button type="button" onClick={scanBluetooth} disabled={loading}>Scan Bluetooth</button>
            <div className="device-list">
              {[...pairedDevices, ...bluetoothDevices].filter((device, index, list) => list.findIndex((item) => item.address === device.address) === index).map((device) => (
                <div key={device.address} className="device-list-row bluetooth">
                  <div><strong>{device.name}</strong><span>{device.address}</span></div>
                  <button type="button" onClick={() => runDevice('/api/device/bluetooth/pair', { address: device.address }, `Pairing ${device.name}`)}>Pair</button>
                  <button type="button" onClick={() => runDevice('/api/device/bluetooth/connect', { address: device.address }, `Connecting ${device.name}`)}>Connect</button>
                  <button type="button" onClick={() => runDevice('/api/device/bluetooth/disconnect', { address: device.address }, `Disconnecting ${device.name}`)}>Disconnect</button>
                  <button type="button" onClick={() => runDevice('/api/device/bluetooth/remove', { address: device.address }, `Removing ${device.name}`)}>Remove</button>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      <div className="device-quick-grid">
        <button type="button" onClick={() => runDevice('/api/device/wifi/toggle', { enabled: !wifi.enabled }, wifi.enabled ? 'Wi-Fi is off' : 'Wi-Fi is on')}>Wi-Fi</button>
        <button type="button" onClick={() => runDevice('/api/device/bluetooth/toggle', { enabled: !bluetooth.enabled }, bluetooth.enabled ? 'Bluetooth is off' : 'Bluetooth is on')}>Bluetooth</button>
        <button type="button" onClick={() => runDevice('/api/device/night-light', { enabled: !nightLight.enabled }, nightLight.enabled ? 'Night Light is now off' : 'Night Light is now on')}>Night</button>
        <button type="button" onClick={() => runDevice('/api/device/dnd', { enabled: !dnd.enabled }, dnd.enabled ? 'Do Not Disturb is off' : 'Do Not Disturb is on')}>DND</button>
        <button type="button" onClick={() => runDevice('/api/device/airplane', { enabled: !airplane.enabled }, airplane.enabled ? 'Airplane mode is off' : 'Airplane mode is on')}>Airplane</button>
        <button type="button" onClick={() => runDevice('/api/device/tailscale', { enabled: !tailscale.enabled }, tailscale.enabled ? 'Tailscale VPN is off' : 'Tailscale VPN is on')}>Tailscale</button>
        <button type="button" onClick={() => runDevice('/api/device/power', { mode: 'battery-saver' }, 'Battery saver enabled')}>Saver</button>
        <button type="button" onClick={() => runDevice('/api/device/volume/mute', { muted: !volume.muted }, volume.muted ? 'Audio unmuted' : 'Audio muted')}>Mute</button>
        <button type="button" onClick={() => runDevice('/api/device/volume', { action: 'up', step: 5 }, 'Volume increased')}>Vol +</button>
        <button type="button" onClick={() => runDevice('/api/device/volume', { action: 'down', step: 5 }, 'Volume decreased')}>Vol -</button>
        <button type="button" onClick={() => runDevice('/api/device/brightness', { action: 'up', step: 10 }, 'Brightness increased')}>Bright +</button>
        <button type="button" onClick={() => runDevice('/api/device/brightness', { action: 'down', step: 10 }, 'Brightness decreased')}>Dim -</button>
      </div>

      {dependencies.length > 0 && (
        <details className="device-advanced dependency-list">
          <summary>Missing Linux tools</summary>
          {dependencies.map(([name, info]) => <span key={name}>{name}: {info.install}</span>)}
        </details>
      )}
    </section>
  );
}

function AssistantPanel({ settings, runCommand, timer, alwaysListening }) {
  const [command, setCommand] = useState('');
  const [response, setResponse] = useState(`Say "Hey ${settings.assistantName}" or type a command.`);
  const [modelStatus, setModelStatus] = useState(`Easy model: ${settings.easyModel}`);
  const [listening, setListening] = useState(false);
  const [listeningMode, setListeningMode] = useState('run');
  const [diagnosticRefresh, setDiagnosticRefresh] = useState(0);
  const runCommandRef = useRef(runCommand);
  const settingsRef = useRef(settings);
  const manualRecognitionRef = useRef(null);
  const alwaysStatus = alwaysListening?.status || (settings.alwaysListeningEnabled ? 'Starting always listen...' : 'Always listen off');
  const voiceDiagnostics = useVoiceDiagnostics(diagnosticRefresh);
  const assistantListeningActive = listening || /^Always listening/i.test(alwaysStatus);

  useEffect(() => {
    runCommandRef.current = runCommand;
  }, [runCommand]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  async function runAndDisplay(text, clearInput = false, source = 'typed') {
    const clean = text.trim();
    if (!clean) return;
    if (clearInput) setCommand('');
    setResponse(source === 'always' ? `Heard: ${clean}` : 'Listening to the room command...');
    setModelStatus('Routing command locally');
    const result = await runCommandRef.current(clean);
    const currentSettings = settingsRef.current;
    setResponse(result.reply);
    setModelStatus(result.model === 'hard' ? `Hard model: ${currentSettings.hardModel}` : `Easy model: ${currentSettings.easyModel}`);
  }

  function submitCommand(text = command) {
    return runAndDisplay(text, true);
  }

  async function enableMicrophoneAndRetry() {
    setResponse('Requesting microphone permission...');
    const nav = window.navigator || {};
    if (!nav.mediaDevices?.getUserMedia) {
      setResponse('This browser preview does not expose microphone access. Open KISOKE in Chrome or Edge at http://localhost:5173 and allow the microphone.');
      setModelStatus('Microphone API missing');
      setDiagnosticRefresh((value) => value + 1);
      return;
    }

    try {
      const stream = await nav.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setDiagnosticRefresh((value) => value + 1);
      alwaysListening?.retry?.();
      setResponse(`Microphone is allowed. Try saying "Hey ${settingsRef.current.assistantName} open dashboard".`);
      setModelStatus('Microphone ready');
    } catch (error) {
      setDiagnosticRefresh((value) => value + 1);
      setResponse(friendlyMediaError(error));
      setModelStatus('Microphone blocked');
    }
  }

  async function startVoiceInput(mode = 'run') {
    if (!settings.voiceAssistantEnabled) {
      setResponse('Voice assistant is turned off in settings.');
      return;
    }
    if (listening) {
      setResponse('I am already listening. Say the command now.');
      return;
    }
    const SpeechRecognition = speechRecognitionConstructor();
    if (!SpeechRecognition) {
      setResponse('Voice recognition is not supported in this browser preview. Open KISOKE in Chrome or Edge, allow microphone access, then retry.');
      setModelStatus('Speech API missing');
      return;
    }

    if (manualRecognitionRef.current) {
      try {
        manualRecognitionRef.current.abort?.();
        manualRecognitionRef.current.stop?.();
      } catch {
        // Chrome can throw if the previous manual recognizer already ended.
      }
      manualRecognitionRef.current = null;
    }
    window.dispatchEvent(new CustomEvent('nexora:manual-voice-start'));
    setListening(true);
    setListeningMode(mode);
    const promptName = assistantCallName(settingsRef.current);
    const helpPrompt = `How can I help you today ${promptName}?`;
    const helpPromptCheck = helpPrompt.toLowerCase();
    setResponse(mode === 'dictate' ? `${helpPrompt} I will type what I hear.` : `${helpPrompt} Say "Hey ${settings.assistantName}" and your command.`);
    setModelStatus('Preparing microphone');

    try {
      await speakAssistantReply(helpPrompt, settingsRef.current, { maxMs: 2400 });
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      const recognition = new SpeechRecognition();
      manualRecognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;
      let handledFinal = false;
      let finished = false;
      const finishManualVoice = () => {
        if (finished) return;
        finished = true;
        setListening(false);
        manualRecognitionRef.current = null;
        window.dispatchEvent(new CustomEvent('nexora:manual-voice-end'));
      };
      setResponse(mode === 'dictate' ? 'Listening. Speak now and I will type it.' : `Listening now. Say "Hey ${settings.assistantName} open settings" or just "open settings".`);
      setModelStatus('Microphone listening');
      recognition.onresult = (event) => {
        const results = Array.from(event.results).slice(event.resultIndex);
        const interimTranscript = results
          .filter((result) => !result.isFinal)
          .map((result) => result[0]?.transcript || '')
          .join(' ')
          .trim();
        const finalTranscript = results
          .filter((result) => result.isFinal)
          .map((result) => result[0]?.transcript || '')
          .join(' ')
          .trim();
        const transcript = finalTranscript || interimTranscript;
        if (interimTranscript) setResponse(`Hearing: ${interimTranscript}`);
        if (!finalTranscript || handledFinal) return;
        handledFinal = true;
        if (transcript.toLowerCase().includes(helpPromptCheck)) {
          setResponse(`Listening for your command after "Hey ${settings.assistantName}".`);
          return;
        }
        if (mode === 'dictate') {
          setCommand(transcript);
          setResponse('I typed what I heard. Check it, then tap Send.');
          setModelStatus('Microphone dictation ready');
        } else {
          runAndDisplay(transcript, true);
        }
      };
      recognition.onerror = (event) => {
        setDiagnosticRefresh((value) => value + 1);
        setResponse(friendlySpeechError(event?.error));
        setModelStatus('Voice input stopped');
        finishManualVoice();
      };
      recognition.onend = () => {
        if (!handledFinal) {
          setResponse((current) => current.startsWith('Hearing:') ? 'I heard partial speech but did not get a final command. Try again closer to the mic.' : current);
        }
        finishManualVoice();
      };
      recognition.start();
    } catch {
      setListening(false);
      manualRecognitionRef.current = null;
      setResponse('Voice recognition could not start in this browser.');
      window.dispatchEvent(new CustomEvent('nexora:manual-voice-end'));
    }
  }

  return (
    <section className="panel assistant-panel">
      <div className="panel-heading">
        <Bot size={22} />
        <div>
          <h2>{settings.assistantName} Assistant</h2>
          <p>Local command router with Ollama-ready backend</p>
        </div>
      </div>
      <div className={`assistant-listening-stage ${assistantListeningActive ? 'active' : ''}`}>
        <div className="assistant-intelligence-orb" aria-hidden="true">
          <span className="orb-core" />
          <span className="orb-ring ring-a" />
          <span className="orb-ring ring-b" />
          <span className="orb-ring ring-c" />
        </div>
        <div>
          <strong>{assistantListeningActive ? 'Listening' : 'Voice standby'}</strong>
          <span>{assistantListeningActive ? `How can I help you today ${assistantCallName(settings)}?` : `Tap Enable mic or Talk and run, then say Hey ${settings.assistantName}.`}</span>
        </div>
      </div>
      <form className="assistant-command-row" onSubmit={(event) => { event.preventDefault(); submitCommand(); }}>
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder={`Type or say: Hey ${settings.assistantName} open settings`}
        />
        <button type="button" className={listening && listeningMode === 'run' ? 'active' : ''} onClick={() => startVoiceInput('run')} aria-label="Talk and run command">
          <Mic size={18} />
        </button>
        <button type="submit" aria-label="Send command">
          <Send size={18} />
        </button>
      </form>
      <div className="assistant-voice-row">
        <button type="button" className={listening && listeningMode === 'run' ? 'active' : ''} onClick={() => startVoiceInput('run')}>
          <Mic size={16} /> Talk and run
        </button>
        <button type="button" className={listening && listeningMode === 'dictate' ? 'active' : ''} onClick={() => startVoiceInput('dictate')}>
          <Mic size={16} /> Dictate text
        </button>
        <button type="button" onClick={enableMicrophoneAndRetry}>
          <Mic size={16} /> Enable mic
        </button>
      </div>
      <div className="assistant-diagnostics">
        <div><span>Speech API</span><strong>{voiceDiagnostics.speechSupported ? 'Yes' : 'No'}</strong></div>
        <div><span>Mic API</span><strong>{voiceDiagnostics.micSupported ? 'Yes' : 'No'}</strong></div>
        <div><span>Permission</span><strong>{voiceDiagnostics.permission}</strong></div>
        <div><span>Tab</span><strong>{voiceDiagnostics.visibility}</strong></div>
      </div>
      {(!voiceDiagnostics.speechSupported || !voiceDiagnostics.micSupported || voiceDiagnostics.permission === 'denied') && (
        <div className="assistant-warning">
          Open the kiosk in real Chrome/Edge, not a restricted preview, then allow microphone permission from the address bar.
        </div>
      )}
      <div className="assistant-always-status">
        <span className={settings.alwaysListeningEnabled && settings.voiceAssistantEnabled ? 'live' : ''} />
        <strong>{alwaysStatus}</strong>
        <em>Works while this kiosk page is open. Some browsers pause microphone listening in hidden/background tabs.</em>
      </div>
      <div className="assistant-response">
        <strong>{modelStatus}</strong>
        <span>{response}</span>
      </div>
      <div className="assistant-timer-row">
        <div>
          <span>{timer.label}</span>
          <strong>{formatDuration(timer.secondsLeft)}</strong>
        </div>
        <button type="button" onClick={() => timer.start(10)}>10m</button>
        <button type="button" onClick={timer.running ? timer.pause : timer.resume}>{timer.running ? 'Pause' : 'Resume'}</button>
        <button type="button" onClick={timer.reset}>Reset</button>
      </div>
      <div className="assistant-suggestions">
        {AI_SUGGESTED_COMMANDS.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => submitCommand(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}

function GlobalListeningOrb({ settings, alwaysListening, page }) {
  if (!settings.voiceAssistantEnabled || !settings.alwaysListeningEnabled) return null;

  const status = alwaysListening?.status || 'Starting always listen...';
  const blocked = /blocked|denied|unsupported|missing|not supported|permission/i.test(status);
  const active = !blocked && /always listening|wake word|heard|retrying|starting|manual voice/i.test(status);
  const promptName = assistantCallName(settings);

  return (
    <motion.button
      type="button"
      className={`global-listening-orb ${active ? 'active' : ''} ${blocked ? 'blocked' : ''} page-${page}`}
      onClick={() => alwaysListening?.retry?.()}
      initial={{ y: -12, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -12, opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      aria-label={`Voice assistant status: ${status}`}
      title={blocked ? 'Tap to retry microphone listening' : status}
    >
      <span className="assistant-intelligence-orb compact" aria-hidden="true">
        <span className="orb-core" />
        <span className="orb-ring ring-a" />
        <span className="orb-ring ring-b" />
        <span className="orb-ring ring-c" />
      </span>
      <span className="global-listening-copy">
        <strong>{blocked ? 'Mic needs attention' : active ? 'Listening' : 'Voice ready'}</strong>
        <em>{blocked ? status : `Say "Hey ${settings.assistantName}" / ${promptName}`}</em>
      </span>
    </motion.button>
  );
}

function CameraThemePanel({ settings, setSettings, cameraTheme, smartTheme }) {
  const brightness = cameraTheme.brightness == null ? '--' : cameraTheme.brightness;
  const meter = cameraTheme.brightness == null ? 0 : Math.max(0, Math.min(100, Math.round((cameraTheme.brightness / 255) * 100)));

  return (
    <section className="panel camera-theme-panel">
      <div className="panel-heading">
        <Camera size={22} />
        <div>
          <h2>Camera Theme</h2>
          <p>Uses brightness only. No video is saved.</p>
        </div>
      </div>
      <div className="camera-theme-hero">
        <video ref={cameraTheme.videoRef} muted playsInline aria-hidden="true" />
        <div>
          <span>Selected theme</span>
          <strong>{cameraTheme.theme || smartTheme}</strong>
          <em>{cameraTheme.reason}</em>
        </div>
      </div>
      <div className="camera-theme-meter">
        <div><span>Brightness</span><strong>{brightness}</strong></div>
        <div className="meter-line"><span style={{ width: `${meter}%` }} /></div>
        <small>{cameraTheme.permission}</small>
      </div>
      <div className="setting-toggle-row">
        <span>Camera auto-theme</span>
        <button
          type="button"
          className={settings.cameraAutoTheme ? 'active' : ''}
          onClick={() => setSettings({ cameraAutoTheme: !settings.cameraAutoTheme })}
        >
          {settings.cameraAutoTheme ? 'On' : 'Off'}
        </button>
      </div>
    </section>
  );
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

function NotificationToast({ notification, onDismiss, onPreviewSound }) {
  const Icon = notification.Icon || Bell;
  const tone = notification.tone || 'green';

  return (
    <motion.aside
      className={`notification-toast ${tone}`}
      initial={{ opacity: 0, y: -14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 230, damping: 25 }}
      role="status"
      aria-live="polite"
    >
      <div className="notification-aura" aria-hidden="true" />
      <div className="notification-icon">
        <Icon size={21} />
      </div>
      <div className="notification-copy">
        <span>{tone === 'red' ? 'Priority alert' : tone === 'amber' ? 'Room reminder' : 'Smart notification'}</span>
        <strong>{notification.title}</strong>
        <p>{notification.detail}</p>
      </div>
      <div className="notification-actions">
        <button type="button" onClick={onPreviewSound} aria-label="Play notification chime"><Volume2 size={16} /></button>
        <button type="button" onClick={onDismiss} aria-label="Dismiss notification"><Check size={16} /></button>
      </div>
    </motion.aside>
  );
}

function SmallDeviceToast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <motion.aside
      className={`device-toast ${toast.tone || 'green'}`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      role="status"
      aria-live="polite"
    >
      <span>{toast.title}</span>
      {toast.detail && <em>{toast.detail}</em>}
      <button type="button" onClick={onDismiss} aria-label="Dismiss device update"><Check size={14} /></button>
    </motion.aside>
  );
}

function SmartReminderPanel({ reminders, soundReady, onPreviewSound }) {
  return (
    <section className="panel smart-reminder-panel">
      <div className="panel-heading">
        <Bell size={22} />
        <div>
          <h2>Smart Reminders</h2>
          <p>Prayer, study, sleep, water, and laptop alerts</p>
        </div>
      </div>
      <div className={`reminder-sound-strip ${soundReady ? 'ready' : ''}`}>
        <span><Volume2 size={16} /> {soundReady ? 'Chime ready' : 'Tap to enable chime'}</span>
        <button type="button" onClick={onPreviewSound}>Preview</button>
      </div>
      <div className="reminder-list">
        {reminders.map((reminder) => {
          const Icon = reminder.Icon || Bell;
          return (
            <div key={reminder.id} className={`reminder-row ${reminder.tone || 'green'}`}>
              <span className="reminder-pulse"><Icon size={18} /></span>
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

function QuickControls({ open, onClose, ambientPhase, weatherMood, sleepMode, setSleepMode, musicPlayer, noiseEnabled, setNoiseEnabled, focus, roomMode, setRoomMode, focusLock, setFocusLock, openBrainDump }) {
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
            <div className="quick-status">
              <div><span>Focus</span><strong>{focus.running ? formatDuration(focus.remaining) : `${focus.stats.todayMinutes} min today`}</strong></div>
              <div><span>Weather</span><strong>{weatherMood.label}</strong></div>
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
    <motion.aside
      className="ambient-rotation"
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 220, damping: 25 }}
      aria-hidden="true"
    >
      <Icon size={24} />
      <div>
        <span>{slide.label}</span>
        <strong>{slide.value}</strong>
        <em>{slide.detail}</em>
      </div>
    </motion.aside>
  );
}

function SoftwareNeededPage({ mode, networkAccess, goBack, goDashboard }) {
  const [copyState, setCopyState] = useState('');
  const [status, setStatus] = useState({
    loading: true,
    backend: null,
    device: null
  });

  const refreshStatus = useCallback(async () => {
    const next = { loading: false, backend: null, device: null };
    try {
      const response = await fetch(`${backendOrigin()}/api/status`);
      const data = await response.json().catch(() => ({}));
      next.backend = response.ok ? data : { ok: false, error: data.error || `Backend returned ${response.status}.` };
    } catch {
      next.backend = { ok: false, error: 'Backend is not running on port 8787.' };
    }
    next.device = await deviceApiRequest('/api/device/status');
    setStatus(next);
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const missingTools = useMemo(() => {
    const dependencies = status.device?.dependencies || {};
    return Object.entries(dependencies)
      .filter(([, details]) => details && details.available === false)
      .map(([name, details]) => ({ name, install: details.install || '' }));
  }, [status.device]);

  async function copyCommand(command) {
    try {
      await navigator.clipboard.writeText(command);
      setCopyState(command);
      window.setTimeout(() => setCopyState(''), 1500);
    } catch {
      setCopyState('Clipboard blocked');
      window.setTimeout(() => setCopyState(''), 1500);
    }
  }

  const quickCommands = [
    { label: 'Install everything Ubuntu', command: 'bash code-needed-to-download' },
    { label: 'Windows one-click start', command: 'powershell -ExecutionPolicy Bypass -File .\\run_local_windows.ps1' },
    { label: 'Windows download basics', command: 'winget install OpenJS.NodeJS.LTS Python.Python.3.12 Tailscale.Tailscale Ollama.Ollama' },
    { label: 'Ubuntu one-click start', command: 'ALLOW_DEVICE_CONTROL=true bash start-kiosk.sh' },
    { label: 'Frontend only', command: 'npm run dev -- --host 0.0.0.0' },
    { label: 'Backend only', command: 'cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8787' }
  ];

  return (
    <section className={`tools-page software-page ${mode}`}>
      <header className="dash-top tools-top software-top">
        <button className="icon-button" onClick={goBack} aria-label="Back to settings"><ChevronLeft size={24} /></button>
        <div>
          <h1>Software Needed</h1>
          <p>Everything to download so KISOKE fully works on Ubuntu, Windows testing, local AI, voice, camera, and remote access</p>
        </div>
        <div className="tools-header-actions">
          <button className="software-needed-button" type="button" onClick={refreshStatus}><RefreshCw size={16} /> Check</button>
          <button className="software-needed-button" type="button" onClick={goDashboard}>Dashboard</button>
        </div>
      </header>

      <main className="software-layout">
        <section className="panel software-hero-panel">
          <div className="panel-heading">
            <HardDrive size={24} />
            <div>
              <h2>Install Checklist</h2>
              <p>Green means the app can see it now. Missing Linux tools only matter on the Ubuntu kiosk laptop.</p>
            </div>
          </div>
          <div className="software-status-grid">
            <div className={status.backend?.ok ? 'ready' : 'missing'}>
              <span>Backend 8787</span>
              <strong>{status.loading ? 'Checking...' : status.backend?.ok ? 'Online' : 'Not running'}</strong>
              <em>{status.backend?.error || 'FastAPI local service'}</em>
            </div>
            <div className={status.device?.allowed ? 'ready' : 'missing'}>
              <span>Device Control</span>
              <strong>{status.device?.allowed ? 'Enabled' : 'Needs ALLOW_DEVICE_CONTROL=true'}</strong>
              <em>Only for localhost, home Wi-Fi, or private Tailscale</em>
            </div>
            <div className={missingTools.length ? 'missing' : 'ready'}>
              <span>Linux Tools</span>
              <strong>{missingTools.length ? `${missingTools.length} missing` : 'Ready or not checked'}</strong>
              <em>{missingTools.length ? missingTools.map((tool) => tool.name).join(', ') : 'Ubuntu controls are ready when installed'}</em>
            </div>
          </div>
          {copyState && <div className="copy-feedback">{copyState === 'Clipboard blocked' ? copyState : 'Copied command'}</div>}
        </section>

        {SOFTWARE_REQUIREMENTS.map((section) => {
          const Icon = section.Icon;
          return (
            <section className="panel software-card" key={section.id}>
              <div className="panel-heading">
                <Icon size={22} />
                <div>
                  <h2>{section.label}</h2>
                  <p>{section.summary}</p>
                </div>
              </div>
              <span className="software-tag">{section.tag}</span>
              <div className="software-download-list">
                {section.downloads.map((item) => <span key={item}><Check size={14} /> {item}</span>)}
              </div>
              <div className="software-command-list">
                {section.commands.map((command) => (
                  <button key={command} type="button" onClick={() => copyCommand(command)} title="Copy command">
                    <code>{command}</code>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        <section className="panel software-card software-full">
          <div className="panel-heading">
            <Wifi size={22} />
            <div>
              <h2>Open On Other Devices</h2>
              <p>Use one of these URLs after the frontend starts with host 0.0.0.0.</p>
            </div>
          </div>
          <div className="access-link-list">
            {(networkAccess.urls?.length ? networkAccess.urls : [{ name: 'This device', url: networkAccess.localUrl || 'http://localhost:5173' }]).map((item) => (
              <a key={`${item.name}-${item.url}`} href={item.url} target="_blank" rel="noreferrer">
                <Wifi size={17} />
                <span>{item.name}</span>
                <strong>{item.url}</strong>
                <ExternalLink size={15} />
              </a>
            ))}
          </div>
          <div className="software-command-list quick">
            {quickCommands.map((item) => (
              <button key={item.label} type="button" onClick={() => copyCommand(item.command)}>
                <span>{item.label}</span>
                <code>{item.command}</code>
              </button>
            ))}
          </div>
          <div className="tool-readout">Camera and microphone from another device may need HTTPS or Tailscale HTTPS because browsers restrict permissions on plain HTTP.</div>
        </section>
      </main>
    </section>
  );
}

function ToolsPage({ now, mode, manualMode, autoColor, setManualMode, alarm, setAlarm, timeFormat, setTimeFormat, clockTimeZone, setClockTimeZone, weatherLocation, setWeatherLocation, weatherBackgroundOverride, setWeatherBackgroundOverride, liveWeatherMood, weather, clockBackground, setClockBackground, layoutLook, setLayoutLook, customWidgets, setCustomWidgets, customSections, setCustomSections, deletedWidgets, setDeletedWidgets, deleteCustomWidget, toggleWidgetLock, restoreDeletedWidget, restoreAllDeletedWidgets, resetCustomWidgets, assistantSettings, setAssistantSettings, cameraTheme, networkAccess, goBack, goSoftware, setAutoColor, setRoomMode, setSmartTheme }) {
  const [countdownMinutes, setCountdownMinutes] = useState(10);
  const [countdownLeft, setCountdownLeft] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerLeft, setTimerLeft] = useState(0);
  const [stopwatch, setStopwatch] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [worldClocks, setWorldClocks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(WORLD_CLOCK_KEY)) || [
        { city: 'Dubai', zone: 'Asia/Dubai' },
        { city: 'Bosnia', zone: 'Europe/Sarajevo' },
        { city: 'London', zone: 'Europe/London' }
      ];
    } catch {
      return [];
    }
  });
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [customClockZone, setCustomClockZone] = useState(clockTimeZone === 'local' ? '' : clockTimeZone);
  const [weatherSearch, setWeatherSearch] = useState('');
  const [weatherResults, setWeatherResults] = useState([]);
  const [weatherSearchStatus, setWeatherSearchStatus] = useState('');
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
  const allSections = useMemo(() => [
    ...BUILT_IN_SECTIONS,
    ...customSections.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  ], [customSections]);

  useEffect(() => {
    localStorage.setItem(WORLD_CLOCK_KEY, JSON.stringify(worldClocks));
  }, [worldClocks]);

  useEffect(() => {
    setCustomClockZone(clockTimeZone === 'local' ? '' : clockTimeZone);
  }, [clockTimeZone]);

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

  function updateAssistantSetting(field, value) {
    setAssistantSettings({ [field]: value });
  }

  function updateAssistantNames(value) {
    const names = value.split(',').map((item) => item.trim()).filter(Boolean);
    setAssistantSettings({ userNames: names.length ? names : AI_ASSISTANT_DEFAULTS.userNames });
  }

  function applyCustomClockZone(event) {
    event.preventDefault();
    const cleanZone = customClockZone.trim();
    if (!isValidTimeZone(cleanZone)) {
      setCustomClockZone(clockTimeZone === 'local' ? '' : clockTimeZone);
      return;
    }
    setClockTimeZone(cleanZone);
  }

  async function searchWeatherPlace(event) {
    event.preventDefault();
    const query = weatherSearch.trim();
    if (!query) return;
    setWeatherSearchStatus('Searching...');
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.reason || 'Search failed');
      const results = (data.results || []).map((item) => normalizeWeatherLocation({
        id: `${item.id || item.name}-${item.latitude}-${item.longitude}`,
        name: item.name,
        country: item.country,
        lat: item.latitude,
        lon: item.longitude,
        timezone: item.timezone || DEFAULT_WEATHER_LOCATION.timezone
      }));
      setWeatherResults(results);
      setWeatherSearchStatus(results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'No places found');
    } catch (error) {
      setWeatherResults([]);
      setWeatherSearchStatus(error.message || 'Search failed');
    }
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
    localStorage.removeItem(CLOCK_BACKGROUND_KEY);
    localStorage.removeItem(CLOCK_BACKGROUND_MIGRATION_KEY);
    localStorage.removeItem(CLOCK_AUTO_DEFAULT_MIGRATION_KEY);
    localStorage.removeItem(CLOCK_MANUAL_OVERRIDE_KEY);
    localStorage.removeItem(AI_ASSISTANT_KEY);
    localStorage.removeItem(SMART_THEME_KEY);
    localStorage.removeItem(LAYOUT_LOOK_KEY);
    localStorage.removeItem(WEATHER_LOCATION_KEY);
    localStorage.removeItem(CLOCK_TIMEZONE_KEY);
    localStorage.removeItem(WEATHER_BACKGROUND_OVERRIDE_KEY);
    localStorage.removeItem('nexora.clock.mode');
    localStorage.removeItem('nexora.clock.auto');
    setAlarm('06:30');
    setTimeFormat('24');
    setWorldClocks([
      { city: 'Dubai', zone: 'Asia/Dubai' },
      { city: 'Bosnia', zone: 'Europe/Sarajevo' },
      { city: 'London', zone: 'Europe/London' }
    ]);
    setCustomWidgets(defaultCustomWidgets());
    setCustomSections([]);
    setDeletedWidgets([]);
    setAutoColor(true);
    setClockTimeZone(DEFAULT_WEATHER_LOCATION.timezone);
    setWeatherLocation(DEFAULT_WEATHER_LOCATION);
    setWeatherBackgroundOverride('live');
    setClockBackground('weather');
    setRoomMode('relax');
    setSmartTheme('manual');
    setLayoutLook('normal');
    setAssistantSettings(AI_ASSISTANT_DEFAULTS);
  }

  return (
    <section className={`tools-page ${mode}`}>
      <header className="dash-top tools-top">
        <button className="icon-button" onClick={goBack} aria-label="Back"><ChevronLeft size={24} /></button>
        <div>
          <h1>Nexora Tools</h1>
          <p>Timers, world clocks, alarm, stopwatch, and kiosk settings</p>
        </div>
        <div className="tools-header-actions">
          <button className="software-needed-button" type="button" onClick={goSoftware}><HardDrive size={16} /> Software needed</button>
          <button className="danger-button" onClick={resetSettings}>Reset settings</button>
        </div>
      </header>

      <main className="tools-grid">
        <section className="panel tool-panel theme-panel">
          <div className="panel-heading">
            <Sun size={22} />
            <div>
              <h2>Theme</h2>
              <p>Pick Auto, White, Middle/Dark, or Red. Auto does not change the background.</p>
            </div>
          </div>
          <div className="theme-mode-grid" aria-label="Theme mode">
            <button type="button" className={autoColor ? 'active auto' : 'auto'} onClick={() => setAutoColor(true)}>
              <span />
              <strong>Auto</strong>
              <em>Time based color only</em>
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

        <section className="panel tool-panel clock-zone-panel">
          <div className="panel-heading">
            <Clock3 size={22} />
            <div>
              <h2>Clock Time Zone</h2>
              <p>Choose what the big clock shows: Dubai, China, Bosnia, local device time, or custom</p>
            </div>
          </div>
          <div className="timezone-grid">
            {CLOCK_TIMEZONE_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clockTimeZone === item.zone ? 'active' : ''}
                onClick={() => setClockTimeZone(item.zone)}
              >
                <strong>{item.label}</strong>
                <span>{formatClockTime(now, timeFormat, { timeZone: item.zone })}</span>
                <em>{item.detail}</em>
              </button>
            ))}
          </div>
          <form className="timezone-custom-row" onSubmit={applyCustomClockZone}>
            <input value={customClockZone} onChange={(event) => setCustomClockZone(event.target.value)} placeholder="Custom timezone, example Asia/Dubai or Asia/Shanghai" />
            <button type="submit">Use</button>
          </form>
          <div className="tool-readout">Big clock: {timeZoneLabel(clockTimeZone)} / {formatClockTime(now, timeFormat, { timeZone: clockTimeZone, seconds: true })}</div>
        </section>

        <section className="panel tool-panel weather-place-panel">
          <div className="panel-heading">
            <CloudSun size={22} />
            <div>
              <h2>Weather Place</h2>
              <p>The rain/cloud/sun background follows this live weather location</p>
            </div>
          </div>
          <div className="weather-place-current">
            <div>
              <span>Current place</span>
              <strong>{weatherLocation.name}</strong>
              <em>{weatherLocation.country || weatherLocation.timezone}</em>
            </div>
            <button type="button" onClick={() => setWeatherLocation(DEFAULT_WEATHER_LOCATION)}>Reset Ajman</button>
          </div>
          <div className="weather-preset-grid">
            {WEATHER_LOCATION_PRESETS.map((place) => (
              <button
                key={place.id}
                type="button"
                className={weatherLocation.name === place.name && weatherLocation.timezone === place.timezone ? 'active' : ''}
                onClick={() => setWeatherLocation(place)}
              >
                <strong>{place.name}</strong>
                <span>{place.country}</span>
              </button>
            ))}
          </div>
          <form className="weather-search-row" onSubmit={searchWeatherPlace}>
            <input value={weatherSearch} onChange={(event) => setWeatherSearch(event.target.value)} placeholder="Search city, example Dubai, Beijing, Sarajevo" />
            <button type="submit">Search</button>
          </form>
          {(weatherSearchStatus || weatherResults.length > 0) && (
            <div className="weather-result-list">
              {weatherSearchStatus && <span>{weatherSearchStatus}</span>}
              {weatherResults.map((place) => (
                <button key={place.id} type="button" onClick={() => setWeatherLocation(place)}>
                  <strong>{place.name}</strong>
                  <em>{place.country || place.timezone}</em>
                </button>
              ))}
            </div>
          )}
          <div className="weather-override-block">
            <div className="mini-section-heading">
              <strong>Weather background</strong>
              <span>Live says {liveWeatherMood?.label || weatherCondition(weather?.code ?? 0).label} / code {weather?.code ?? '--'}</span>
            </div>
            <div className="weather-override-grid">
              {WEATHER_BACKGROUND_OVERRIDES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={weatherBackgroundOverride === item.id ? 'active' : ''}
                  onClick={() => setWeatherBackgroundOverride(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="panel tool-panel background-panel">
          <div className="panel-heading">
            <CloudSun size={22} />
            <div>
              <h2>Clock Atmosphere</h2>
              <p>Separate from Auto, White, Middle, and Red theme color</p>
            </div>
          </div>
          <div className="dock compact background-options">
            {CLOCK_BACKGROUNDS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`background-option ${item.id} ${clockBackground === item.id ? 'active' : ''}`}
                onClick={() => setClockBackground(item.id)}
              >
                <span className="background-preview" aria-hidden="true" />
                <strong>{item.label}</strong>
                <em>{item.detail}</em>
                {item.id === 'weather' && <small>LIVE</small>}
              </button>
            ))}
          </div>
          <div className="tool-readout">Current atmosphere: {CLOCK_BACKGROUNDS.find((item) => item.id === clockBackground)?.label || 'Live Weather'}</div>
        </section>

        <section className="panel tool-panel look-panel">
          <div className="panel-heading">
            <Eye size={22} />
            <div>
              <h2>Layout Look</h2>
              <p>Change the whole kiosk personality without changing your widgets</p>
            </div>
          </div>
          <div className="look-grid">
            {LAYOUT_LOOKS.map((look) => (
              <button
                key={look.id}
                type="button"
                className={`look-option ${look.id} ${layoutLook === look.id ? 'active' : ''}`}
                onClick={() => setLayoutLook(look.id)}
              >
                <span aria-hidden="true" />
                <strong>{look.label}</strong>
                <em>{look.detail}</em>
              </button>
            ))}
          </div>
          <div className="tool-readout">Current look: {LAYOUT_LOOKS.find((look) => look.id === layoutLook)?.label || 'Normal'}</div>
        </section>

        <section className="panel tool-panel help-panel">
          <div className="panel-heading">
            <BookOpen size={22} />
            <div>
              <h2>Help / Other Devices</h2>
              <p>Use these links from phones, tablets, or another laptop on the same Wi-Fi</p>
            </div>
          </div>
          <div className="access-card">
            <div>
              <span>Local server</span>
              <strong>{networkAccess.hostname || 'This kiosk'} / port {networkAccess.port || '5173'}</strong>
            </div>
            <button type="button" onClick={networkAccess.refresh}><RefreshCw size={16} /> Refresh</button>
          </div>
          <div className="access-link-list">
            {(networkAccess.urls?.length ? networkAccess.urls : [{ name: 'This device', url: networkAccess.localUrl }]).map((item) => (
              <a key={`${item.name}-${item.url}`} href={item.url} target="_blank" rel="noreferrer">
                <Wifi size={17} />
                <span>{item.name}</span>
                <strong>{item.url}</strong>
                <ExternalLink size={15} />
              </a>
            ))}
          </div>
          <div className="help-step-grid">
            <span>1. Run <strong>npm run dev</strong></span>
            <span>2. Keep devices on the same Wi-Fi</span>
            <span>3. Open the IP link above</span>
          </div>
          <div className="tool-readout">
            <BookOpen size={18} />
            Full sheet: <a href="/help.html" target="_blank" rel="noreferrer">open help page</a>
            <span>/</span>
            <a href="/access.html" target="_blank" rel="noreferrer">open access page</a>
          </div>
          <button className="software-wide-button" type="button" onClick={goSoftware}>
            <HardDrive size={17} /> Open Software Needed page
          </button>
        </section>

        <section className="panel tool-panel assistant-settings-panel">
          <div className="panel-heading">
            <Bot size={22} />
            <div>
              <h2>AI Assistant</h2>
              <p>Local command voice with easy and hard Ollama models</p>
            </div>
          </div>
          <div className="ai-settings-grid">
            <div className="assistant-subsection ai-settings-wide">
              <strong>Names & startup voice</strong>
              <span>Controls the wake word, what the intro shows, and what the assistant calls you.</span>
            </div>
            <label>
              <span>AI wake name</span>
              <input value={assistantSettings.assistantName} onChange={(event) => updateAssistantSetting('assistantName', event.target.value || DEFAULT_ASSISTANT_NAME)} />
            </label>
            <label>
              <span>Intro display name</span>
              <input value={assistantSettings.introName} onChange={(event) => updateAssistantSetting('introName', event.target.value || assistantSettings.assistantName || DEFAULT_ASSISTANT_NAME)} />
            </label>
            <label>
              <span>AI calls me</span>
              <input value={assistantSettings.callMeName} onChange={(event) => updateAssistantSetting('callMeName', event.target.value || AI_ASSISTANT_DEFAULTS.callMeName)} />
            </label>
            <label>
              <span>Startup welcome name</span>
              <input value={assistantSettings.startupName} onChange={(event) => updateAssistantSetting('startupName', event.target.value || assistantSettings.callMeName || AI_ASSISTANT_DEFAULTS.startupName)} />
            </label>
            <label>
              <span>Alternate names</span>
              <input value={assistantSettings.userNames.join(', ')} onChange={(event) => updateAssistantNames(event.target.value)} />
            </label>
            <label>
              <span>Easy model</span>
              <input value={assistantSettings.easyModel} onChange={(event) => updateAssistantSetting('easyModel', event.target.value || AI_ASSISTANT_DEFAULTS.easyModel)} />
            </label>
            <label>
              <span>Hard model</span>
              <input value={assistantSettings.hardModel} onChange={(event) => updateAssistantSetting('hardModel', event.target.value || AI_ASSISTANT_DEFAULTS.hardModel)} />
            </label>
            <label className="ai-settings-wide">
              <span>Custom startup audio path or URL</span>
              <input value={assistantSettings.startupAudioUrl} onChange={(event) => updateAssistantSetting('startupAudioUrl', event.target.value)} placeholder="/media/music/intro.mp3, intro.mp3, or https://..." />
            </label>
            <div className="ai-settings-note ai-settings-wide">Put audio inside C:\Users\saeed\OneDrive\Documents\KISOKE\music, then use the file name or /media/music/file.mp3.</div>
          </div>
          <div className="setting-toggle-list">
            <div className="setting-toggle-row">
              <span>Startup greeting</span>
              <button type="button" className={assistantSettings.startupGreetingEnabled ? 'active' : ''} onClick={() => updateAssistantSetting('startupGreetingEnabled', !assistantSettings.startupGreetingEnabled)}>{assistantSettings.startupGreetingEnabled ? 'On' : 'Off'}</button>
            </div>
            <div className="setting-toggle-row">
              <span>Startup audio mode</span>
              <button type="button" className={assistantSettings.startupGreetingMode === 'custom-audio' ? 'active' : ''} onClick={() => updateAssistantSetting('startupGreetingMode', assistantSettings.startupGreetingMode === 'custom-audio' ? 'spoken-name' : 'custom-audio')}>{assistantSettings.startupGreetingMode === 'custom-audio' ? 'Custom audio' : 'Speak name'}</button>
            </div>
            <div className="setting-toggle-row">
              <span>Voice assistant</span>
              <button type="button" className={assistantSettings.voiceAssistantEnabled ? 'active' : ''} onClick={() => updateAssistantSetting('voiceAssistantEnabled', !assistantSettings.voiceAssistantEnabled)}>{assistantSettings.voiceAssistantEnabled ? 'On' : 'Off'}</button>
            </div>
            <div className="setting-toggle-row">
              <span>Always listen</span>
              <button type="button" className={assistantSettings.alwaysListeningEnabled ? 'active' : ''} onClick={() => updateAssistantSetting('alwaysListeningEnabled', !assistantSettings.alwaysListeningEnabled)}>{assistantSettings.alwaysListeningEnabled ? 'On' : 'Off'}</button>
            </div>
            <div className="setting-toggle-row">
              <span>Text to speech</span>
              <button type="button" className={assistantSettings.ttsEnabled ? 'active' : ''} onClick={() => updateAssistantSetting('ttsEnabled', !assistantSettings.ttsEnabled)}>{assistantSettings.ttsEnabled ? 'On' : 'Off'}</button>
            </div>
            <div className="setting-toggle-row">
              <span>Camera auto-theme</span>
              <button type="button" className={assistantSettings.cameraAutoTheme ? 'active' : ''} onClick={() => updateAssistantSetting('cameraAutoTheme', !assistantSettings.cameraAutoTheme)}>{assistantSettings.cameraAutoTheme ? 'On' : 'Off'}</button>
            </div>
          </div>
          <div className="camera-status-grid">
            <div><span>Camera</span><strong>{cameraTheme.permission}</strong></div>
            <div><span>Brightness</span><strong>{cameraTheme.brightness ?? '--'}</strong></div>
            <div><span>Auto theme</span><strong>{cameraTheme.theme || 'manual'}</strong></div>
          </div>
        </section>

        <section className="panel tool-panel remote-access-panel">
          <div className="panel-heading">
            <Wifi size={22} />
            <div>
              <h2>Remote Access</h2>
              <p>Use Wi-Fi or Tailscale without paid APIs</p>
            </div>
          </div>
          <div className="remote-command"><span>Wi-Fi dev server</span><strong>npm run dev -- --host 0.0.0.0</strong></div>
          <div className="remote-command"><span>Open from another device</span><strong>http://LAPTOP-IP:5173</strong></div>
          <div className="remote-command"><span>Tailscale</span><strong>sudo tailscale up</strong></div>
          <div className="remote-command"><span>Tailscale serve</span><strong>sudo tailscale serve --bg 5173</strong></div>
          <div className="tool-readout">Camera from another device may need HTTPS or Tailscale HTTPS because browsers block camera permission on plain HTTP.</div>
        </section>

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
                <button onClick={() => setWorldClocks(worldClocks.filter((item) => item !== clock))}><Trash2 size={16} /></button>
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
  const [page, setPage] = useState('clock');
  const [performanceProfile] = useState(getPerformanceProfile);
  const [showWelcome, setShowWelcome] = useState(() => performanceProfile !== 'max');
  const now = useNow(page === 'clock' ? 1000 : 60 * 1000);
  const [weatherLocation, setWeatherLocation] = useWeatherLocation();
  const [clockTimeZone, setClockTimeZone] = useClockTimeZone();
  const [weatherBackgroundOverride, setWeatherBackgroundOverride] = useWeatherBackgroundOverride();
  const weather = useWeather(weatherLocation);
  const [manualMode, setManualModeState] = useState(() => localStorage.getItem('nexora.clock.mode') || 'night');
  const [autoColor, setAutoColorState] = useState(() => {
    const hasManualOverride = localStorage.getItem(CLOCK_MANUAL_OVERRIDE_KEY) === 'true';
    if (!hasManualOverride) {
      localStorage.setItem(CLOCK_AUTO_DEFAULT_MIGRATION_KEY, 'true');
      localStorage.setItem('nexora.clock.auto', 'true');
      return true;
    }
    return localStorage.getItem('nexora.clock.auto') !== 'false';
  });
  const [timeFormat, setTimeFormatState] = useState(() => localStorage.getItem(TIME_FORMAT_KEY) || '24');
  const [clockBackground, setClockBackgroundState] = useState(() => {
    const savedBackground = localStorage.getItem(CLOCK_BACKGROUND_KEY);
    if (savedBackground === 'celestial' && localStorage.getItem(CLOCK_BACKGROUND_MIGRATION_KEY) !== 'true') {
      localStorage.setItem(CLOCK_BACKGROUND_MIGRATION_KEY, 'true');
      localStorage.setItem(CLOCK_BACKGROUND_KEY, 'weather');
      return 'weather';
    }
    return CLOCK_BACKGROUNDS.some((item) => item.id === savedBackground) ? savedBackground : 'weather';
  });
  const [alarm, setAlarmState] = useState(() => localStorage.getItem(ALARM_KEY) || '06:30');
  const [customWidgets, setCustomWidgets] = useCustomWidgets();
  const [customSections, setCustomSections] = useCustomSections();
  const [deletedWidgets, setDeletedWidgets] = useDeletedWidgets();
  const [blackout, setBlackout] = useState(false);
  const [startupMood] = useState(() => STARTUP_MOODS[Math.floor(Math.random() * STARTUP_MOODS.length)]);
  const [cameraWakeEnabled, setCameraWakeEnabled] = useState(() => localStorage.getItem('nexora.cameraWake') === 'true');
  const [sleepMode, setSleepModeState] = useState(() => localStorage.getItem(SLEEP_MODE_KEY) === 'true');
  const [noiseEnabled, setNoiseEnabled] = useState(false);
  const [roomMode, setRoomMode] = useRoomMode();
  const [layoutLook, setLayoutLook] = useLayoutLook();
  const [focusLock, setFocusLock] = useState(false);
  const [quickControlsOpen, setQuickControlsOpen] = useState(false);
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [deviceToast, setDeviceToast] = useState(null);
  const deviceToastTimerRef = useRef(null);
  const musicLibrary = useMusicLibrary();
  const musicPlayer = useMusicPlayer(musicLibrary);
  const networkAccess = useNetworkAccess();
  const [assistantSettings, setAssistantSettings] = useAssistantSettings();
  const [smartTheme, setSmartThemeState] = useState(() => localStorage.getItem(SMART_THEME_KEY) || 'manual');
  const assistantTimer = useAssistantTimer(assistantSettings);
  const idle = useIdlePresence();
  const ambientPhase = useMemo(() => getAmbientPhase(now), [now.getHours(), now.getMinutes()]);
  const currentWeatherIsNight = isNightAt(now, weather.sunrise, weather.sunset);
  const liveWeatherMood = useMemo(() => getWeatherMood(weather, currentWeatherIsNight), [weather.code, weather.feels, weather.humidity, weather.wind, weather.sunrise, weather.sunset, currentWeatherIsNight]);
  const weatherMood = useMemo(() => applyWeatherMoodOverride(liveWeatherMood, weatherBackgroundOverride, currentWeatherIsNight), [liveWeatherMood, weatherBackgroundOverride, currentWeatherIsNight]);
  const effectiveSleepMode = sleepMode || ambientPhase.id === 'midnight' || roomMode === 'sleep';
  const noise = useNoiseMonitor(noiseEnabled);
  const focus = useFocusSession();
  const battery = useBatteryStatus();
  const caffeine = useCaffeineTimer();
  const brainDump = useBrainDump();
  const prayer = useMemo(() => nextPrayer(now), [now]);
  const handleCameraWake = useCallback(() => {
    setBlackout(false);
    setShowWelcome(false);
  }, []);
  const { videoRef: cameraVideoRef, status: cameraWakeStatus } = useCameraWake(cameraWakeEnabled, handleCameraWake);
  const applyCameraTheme = useCallback((nextTheme) => {
    setSmartTheme(nextTheme);
    setManualMode(modeForSmartTheme(nextTheme));
  }, []);
  const cameraTheme = useCameraAutoTheme(assistantSettings.cameraAutoTheme, applyCameraTheme);
  const mode = autoColor ? ambientPhase.mode : manualMode;

  function setManualMode(nextMode) {
    setManualModeState(nextMode);
    setAutoColorState(false);
    localStorage.setItem(CLOCK_MANUAL_OVERRIDE_KEY, 'true');
    localStorage.setItem('nexora.clock.mode', nextMode);
    localStorage.setItem('nexora.clock.auto', 'false');
  }

  function setAutoColor(enabled) {
    setAutoColorState(enabled);
    if (enabled) {
      localStorage.removeItem(CLOCK_MANUAL_OVERRIDE_KEY);
    } else {
      localStorage.setItem(CLOCK_MANUAL_OVERRIDE_KEY, 'true');
    }
    localStorage.setItem('nexora.clock.auto', String(enabled));
  }

  function setSmartTheme(nextTheme) {
    setSmartThemeState(nextTheme);
    localStorage.setItem(SMART_THEME_KEY, nextTheme);
  }

  function setTimeFormat(nextFormat) {
    setTimeFormatState(nextFormat);
    localStorage.setItem(TIME_FORMAT_KEY, nextFormat);
  }

  function setClockBackground(nextBackground) {
    const cleanBackground = CLOCK_BACKGROUNDS.some((item) => item.id === nextBackground) ? nextBackground : 'weather';
    setClockBackgroundState(cleanBackground);
    localStorage.setItem(CLOCK_BACKGROUND_MIGRATION_KEY, 'true');
    localStorage.setItem(CLOCK_BACKGROUND_KEY, cleanBackground);
  }

  function setAlarm(nextAlarm) {
    setAlarmState(nextAlarm);
    localStorage.setItem(ALARM_KEY, nextAlarm);
  }

  function setSleepMode(nextValue) {
    setSleepModeState(nextValue);
    localStorage.setItem(SLEEP_MODE_KEY, String(nextValue));
  }

  const showDeviceToast = useCallback((title, detail = '', tone = 'green') => {
    if (deviceToastTimerRef.current) window.clearTimeout(deviceToastTimerRef.current);
    setDeviceToast({ id: Date.now(), title, detail, tone });
    deviceToastTimerRef.current = window.setTimeout(() => setDeviceToast(null), 3600);
  }, []);

  async function runDeviceAssistantAction(path, body, successReply, toastTitle = successReply) {
    const data = await deviceApiRequest(path, { method: 'POST', body });
    if (data.ok) {
      showDeviceToast(toastTitle, data.message || '', 'green');
      return successReply;
    }
    const detail = data.error || 'Device command failed.';
    showDeviceToast('Device control failed', detail, 'red');
    return detail;
  }

  async function runAssistantCommand(rawCommand) {
    const userName = randomUserName(assistantSettings);
    const cleaned = stripAssistantWakeWord(rawCommand, assistantSettings);
    const command = cleaned.toLowerCase();
    const reply = (text, model = 'easy', action = 'local') => {
      speakAssistantReply(text, assistantSettings);
      return { reply: text, model, action };
    };

    const timerMatch = command.match(/start\s+(\d{1,3})\s*(minute|minutes|min|m)\s*timer/);
    if (timerMatch) {
      const minutes = Number(timerMatch[1]);
      assistantTimer.start(minutes);
      return reply(`Done, ${userName}. Starting a ${minutes} minute timer.`);
    }
    if (command.includes('start timer')) {
      assistantTimer.start(10);
      return reply(`Done, ${userName}. Starting a 10 minute timer.`);
    }

    if (command.includes('open settings') || command === 'settings') {
      setPage('settings');
      return reply(`Hi ${userName}, opening settings.`);
    }
    if (command.includes('open software') || command.includes('software needed') || command.includes('what to download')) {
      setPage('software');
      return reply(`Done, ${userName}. Opening the software needed page.`);
    }
    if (command.includes('open dashboard') || command === 'dashboard') {
      setPage('dashboard');
      return reply(`Done, ${userName}. Opening dashboard.`);
    }
    if (command.includes('open clock') || command === 'clock') {
      setPage('clock');
      return reply(`Okay ${userName}, opening the clock.`);
    }
    if (command.includes('red mode') || command.includes('red night')) {
      setSmartTheme('red-night');
      setManualMode('night');
      return reply(`Done ${userName}, switching to red night mode.`);
    }
    if (command.includes('dark red')) {
      setSmartTheme('dark-red');
      setManualMode('night');
      return reply(`Okay ${userName}, switching to dark red mode.`);
    }
    if (command.includes('dark mode') || command.includes('slate mode')) {
      setSmartTheme('dark');
      setManualMode('slate');
      return reply(`Got it, ${userName}. Switching to dark mode.`);
    }
    if (command.includes('light mode') || command.includes('white mode')) {
      setSmartTheme('light');
      setManualMode('white');
      return reply(`Done, ${userName}. Switching to light mode.`);
    }
    const lookRequest = LAYOUT_LOOKS.find((look) => {
      const words = [look.id, look.label.toLowerCase(), ...(look.aliases || [])];
      return words.some((word) => (
        command === word ||
        command.includes(`${word} look`) ||
        command.includes(`${word} layout`) ||
        command.includes(`${word} style`) ||
        command.includes(`set look to ${word}`) ||
        command.includes(`switch to ${word} look`)
      ));
    });
    if (lookRequest) {
      setLayoutLook(lookRequest.id);
      return reply(`Done ${userName}, switching to ${lookRequest.label} look.`);
    }
    const clockZoneRequest = CLOCK_TIMEZONE_PRESETS.find((item) => {
      const label = item.label.toLowerCase();
      return command.includes(`clock to ${label}`) ||
        command.includes(`time to ${label}`) ||
        command.includes(`${label} time`) ||
        command.includes(`${label} clock`);
    });
    if (clockZoneRequest) {
      setClockTimeZone(clockZoneRequest.zone);
      return reply(`Done ${userName}, the big clock now uses ${clockZoneRequest.label} time.`);
    }
    const weatherPlaceRequest = WEATHER_LOCATION_PRESETS.find((place) => {
      const name = place.name.toLowerCase();
      const country = (place.country || '').toLowerCase();
      return command.includes(`weather to ${name}`) ||
        command.includes(`weather for ${name}`) ||
        command.includes(`${name} weather`) ||
        (country && command.includes(`weather to ${country}`));
    });
    if (weatherPlaceRequest) {
      setWeatherLocation(weatherPlaceRequest);
      return reply(`Done ${userName}, weather is now set to ${weatherPlaceRequest.name}.`);
    }
    const weatherOverrideRequest = WEATHER_BACKGROUND_OVERRIDES.find((item) => (
      command.includes(`weather background ${item.id}`) ||
      command.includes(`weather background to ${item.id}`) ||
      command.includes(`${item.label.toLowerCase()} background`) ||
      (item.id === 'clear' && (command.includes('stop rain background') || command.includes('no rain background') || command.includes('clear weather background'))) ||
      (item.id === 'live' && command.includes('live weather background'))
    ));
    if (weatherOverrideRequest) {
      setWeatherBackgroundOverride(weatherOverrideRequest.id);
      return reply(`Done ${userName}, weather background is set to ${weatherOverrideRequest.label}.`);
    }
    if (command.includes('show prayer')) {
      setPage('dashboard');
      return reply(`Okay ${userName}, prayer times are on the dashboard.`);
    }
    if (command.includes('show weather')) {
      setPage('dashboard');
      return reply(`Done ${userName}, showing weather on the dashboard.`);
    }
    if (command.includes('mute music') || command.includes('mute audio')) {
      musicPlayer.setVolume(0);
      return reply(`Done ${userName}, music is muted.`);
    }
    const brightnessMatch = command.match(/brightness\s*(?:to|at)?\s*(\d{1,3})\s*(?:percent|%)?/);
    if (brightnessMatch) {
      const percent = Math.max(1, Math.min(100, Number(brightnessMatch[1])));
      const text = await runDeviceAssistantAction(
        '/api/device/brightness',
        { percent },
        `Done ${userName}, brightness set to ${percent} percent.`,
        `Brightness ${percent}%`
      );
      return reply(text);
    }
    if (command.includes('make screen brighter') || command.includes('increase brightness') || command.includes('brightness up')) {
      const text = await runDeviceAssistantAction('/api/device/brightness', { action: 'up', step: 10 }, `Done ${userName}, screen is brighter.`, 'Brightness increased');
      return reply(text);
    }
    if (command.includes('dim the screen') || command.includes('decrease brightness') || command.includes('brightness down')) {
      const text = await runDeviceAssistantAction('/api/device/brightness', { action: 'down', step: 15 }, `Done ${userName}, screen is dimmer.`, 'Brightness decreased');
      return reply(text);
    }
    const volumeMatch = command.match(/(?:volume|audio)\s*(?:to|at)?\s*(\d{1,3})\s*(?:percent|%)?/);
    if (volumeMatch) {
      const percent = Math.max(0, Math.min(100, Number(volumeMatch[1])));
      const text = await runDeviceAssistantAction('/api/device/volume', { percent }, `Done ${userName}, volume set to ${percent} percent.`, `Volume ${percent}%`);
      return reply(text);
    }
    if (command.includes('mute volume') || command.includes('mute sound') || command.includes('mute system')) {
      const text = await runDeviceAssistantAction('/api/device/volume/mute', { muted: true }, `Done ${userName}, volume is muted.`, 'Audio muted');
      return reply(text);
    }
    if (command.includes('increase volume') || command.includes('volume up')) {
      const text = await runDeviceAssistantAction('/api/device/volume', { action: 'up', step: 5 }, `Done ${userName}, volume increased.`, 'Volume increased');
      return reply(text);
    }
    if (command.includes('decrease volume') || command.includes('volume down')) {
      const text = await runDeviceAssistantAction('/api/device/volume', { action: 'down', step: 5 }, `Done ${userName}, volume decreased.`, 'Volume decreased');
      return reply(text);
    }
    if (command.includes('turn on night light') || command.includes('night light on')) {
      const text = await runDeviceAssistantAction('/api/device/night-light', { enabled: true }, `Night Light is now on, ${userName}.`, 'Night Light on');
      return reply(text);
    }
    if (command.includes('turn off night light') || command.includes('night light off')) {
      const text = await runDeviceAssistantAction('/api/device/night-light', { enabled: false }, `Night Light is now off, ${userName}.`, 'Night Light off');
      return reply(text);
    }
    if (command.includes('battery saver') || command.includes('power saver')) {
      const text = await runDeviceAssistantAction('/api/device/power', { mode: 'battery-saver' }, `Done ${userName}, battery saver mode is on.`, 'Battery saver');
      return reply(text);
    }
    if (command.includes('normal power') || command.includes('balanced power')) {
      const text = await runDeviceAssistantAction('/api/device/power', { mode: 'normal' }, `Done ${userName}, normal power mode is on.`, 'Normal power');
      return reply(text);
    }
    if (command.includes('performance mode') || command.includes('high performance')) {
      const text = await runDeviceAssistantAction('/api/device/power', { mode: 'performance' }, `Done ${userName}, performance mode is on.`, 'Performance mode');
      return reply(text);
    }
    if (command.includes('turn on do not disturb') || command.includes('dnd on')) {
      const text = await runDeviceAssistantAction('/api/device/dnd', { enabled: true }, `Done ${userName}, Do Not Disturb is on.`, 'Do Not Disturb on');
      return reply(text);
    }
    if (command.includes('turn off do not disturb') || command.includes('dnd off')) {
      const text = await runDeviceAssistantAction('/api/device/dnd', { enabled: false }, `Done ${userName}, Do Not Disturb is off.`, 'Do Not Disturb off');
      return reply(text);
    }
    if (command.includes('turn on airplane') || command.includes('airplane mode on')) {
      const text = await runDeviceAssistantAction('/api/device/airplane', { enabled: true }, `Done ${userName}, airplane mode is on.`, 'Airplane mode on');
      return reply(text);
    }
    if (command.includes('turn off airplane') || command.includes('airplane mode off')) {
      const text = await runDeviceAssistantAction('/api/device/airplane', { enabled: false }, `Done ${userName}, airplane mode is off.`, 'Airplane mode off');
      return reply(text);
    }
    if (command.includes('turn on tailscale') || command.includes('tailscale on') || command.includes('vpn on')) {
      const text = await runDeviceAssistantAction('/api/device/tailscale', { enabled: true }, `Done ${userName}, Tailscale VPN is on.`, 'Tailscale on');
      return reply(text);
    }
    if (command.includes('turn off tailscale') || command.includes('tailscale off') || command.includes('vpn off')) {
      const text = await runDeviceAssistantAction('/api/device/tailscale', { enabled: false }, `Done ${userName}, Tailscale VPN is off.`, 'Tailscale off');
      return reply(text);
    }
    if (command.includes('scan wifi') || command.includes('scan wi-fi')) {
      showDeviceToast('Wi-Fi scan started', '', 'green');
      const data = await deviceApiRequest('/api/device/wifi/scan');
      if (data.ok) {
        showDeviceToast('Wi-Fi scan complete', `${data.networks?.length || 0} network${data.networks?.length === 1 ? '' : 's'} found.`, 'green');
        return reply(`Wi-Fi scan complete, ${userName}.`);
      }
      showDeviceToast('Wi-Fi scan failed', data.error || 'Scan failed.', 'red');
      return reply(data.error || `Wi-Fi scan failed, ${userName}.`);
    }
    if (command.includes('connect to wifi') || command.includes('connect to wi-fi')) {
      setPage('dashboard');
      showDeviceToast('Choose Wi-Fi network', 'Open Device Controls and enter the password if needed.', 'amber');
      return reply(`Okay ${userName}, open Device Controls and choose the Wi-Fi network.`);
    }
    if (command.includes('turn off bluetooth') || command.includes('bluetooth off')) {
      const text = await runDeviceAssistantAction('/api/device/bluetooth/toggle', { enabled: false }, `Bluetooth is now off, ${userName}.`, 'Bluetooth off');
      return reply(text);
    }
    if (command.includes('turn on bluetooth') || command.includes('bluetooth on')) {
      const text = await runDeviceAssistantAction('/api/device/bluetooth/toggle', { enabled: true }, `Bluetooth is now on, ${userName}.`, 'Bluetooth on');
      return reply(text);
    }
    if (command.includes('scan bluetooth')) {
      showDeviceToast('Bluetooth scan started', '', 'green');
      const data = await deviceApiRequest('/api/device/bluetooth/scan');
      if (data.ok) {
        showDeviceToast('Bluetooth scan complete', `${data.devices?.length || 0} device${data.devices?.length === 1 ? '' : 's'} found.`, 'green');
        return reply(`Bluetooth scan started, ${userName}.`);
      }
      showDeviceToast('Bluetooth scan failed', data.error || 'Scan failed.', 'red');
      return reply(data.error || `Bluetooth scan failed, ${userName}.`);
    }
    if (command.includes('connect my headphones') || command.includes('connect headphones')) {
      setPage('dashboard');
      showDeviceToast('Bluetooth devices', 'Scan Bluetooth, then tap Connect next to the headphones.', 'amber');
      return reply(`Okay ${userName}, scan Bluetooth and tap Connect next to your headphones.`);
    }
    if (command.includes('study mode') || command.includes('focus mode')) {
      setRoomMode('focus');
      setSleepMode(false);
      setSmartTheme('dark');
      setManualMode('slate');
      setPage('dashboard');
      focus.start(25);
      return reply(`Okay ${userName}, study mode is ready.`);
    }
    if (command.includes('sleep mode')) {
      setRoomMode('sleep');
      setSleepMode(true);
      setSmartTheme('red-night');
      setManualMode('night');
      setPage('clock');
      return reply(`Done ${userName}, sleep mode is on.`);
    }
    if (command.includes('quick controls')) {
      setQuickControlsOpen(true);
      return reply(`Opening quick controls, ${userName}.`);
    }

    const hard = command.length > 80 || /(explain|plan|why|write|homework|complex|hard|think|research)/i.test(command);
    const host = window.location.hostname || 'localhost';
    const backendOrigin = host === 'localhost' || host === '127.0.0.1' ? 'http://localhost:8787' : `http://${host}:8787`;
    try {
      const response = await fetch(`${backendOrigin}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cleaned,
          easy_model: assistantSettings.easyModel,
          hard_model: assistantSettings.hardModel
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.reply) return reply(data.reply, data.model || (hard ? 'hard' : 'easy'), 'backend');
      }
    } catch {
      // The frontend command router still works when the local AI backend is off.
    }

    return reply(`I handled the local commands I know, ${userName}. Start the backend and Ollama for open questions.`, hard ? 'hard' : 'easy', 'fallback');
  }

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

  const alwaysListening = useAlwaysListeningAssistant(assistantSettings, runAssistantCommand);

  useEffect(() => {
    localStorage.setItem('nexora.cameraWake', String(cameraWakeEnabled));
  }, [cameraWakeEnabled]);

  useEffect(() => () => {
    if (deviceToastTimerRef.current) window.clearTimeout(deviceToastTimerRef.current);
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'ArrowRight') setPage('dashboard');
      if (event.key === 'ArrowLeft') setPage('clock');
      if (event.key.toLowerCase() === 's') setPage('settings');
      if (event.key.toLowerCase() === 'q') setQuickControlsOpen((value) => !value);
      if (event.key.toLowerCase() === 'n') setBrainDumpOpen(true);
      if (event.key === 'Escape') setBlackout(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (performanceProfile === 'max') {
      setShowWelcome(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowWelcome(false), performanceProfile === 'lite' ? 2600 : 4200);
    return () => clearTimeout(timer);
  }, [performanceProfile]);

  useEffect(() => {
    if (performanceProfile === 'lite' || performanceProfile === 'max') return undefined;
    const shell = shellRef.current;
    if (!shell) return undefined;
    let frame = 0;
    function moveDepth(event) {
      if (shell.classList.contains('page-settings')) return;
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
  }, [performanceProfile]);

  return (
    <div ref={shellRef} className={`app-shell page-${page} performance-${performanceProfile} phase-${ambientPhase.id} weather-${weatherMood.id} room-${roomMode} smart-theme-${smartTheme} look-${layoutLook} ${effectiveSleepMode ? 'sleep-mode' : ''} ${focusLock ? 'focus-lock-on' : ''} ${idle ? 'ambient-idle' : ''} ${quickControlsOpen ? 'quick-open' : ''}`}>
      <audio ref={musicPlayer.audioRef} onEnded={musicPlayer.nextTrack} preload="metadata" />
      <div className="depth-layer depth-background" aria-hidden="true" />
      <div className="depth-layer depth-particles" aria-hidden="true" />
      <div className="depth-layer depth-glow" aria-hidden="true" />
      <AnimatePresence>
        {showWelcome && (
          <WelcomeExperience mode={mode} mood={startupMood} now={now} timeFormat={timeFormat} assistantSettings={assistantSettings} onDismiss={() => setShowWelcome(false)} />
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
        openBrainDump={() => setBrainDumpOpen(true)}
      />
      <BrainDumpOverlay open={brainDumpOpen} onClose={() => setBrainDumpOpen(false)} brainDump={brainDump} />
      <FocusLockOverlay open={focusLock} focus={focus} onExit={() => setFocusLock(false)} roomMode={roomMode} weatherMood={weatherMood} />
      <AnimatePresence>
        <SmallDeviceToast toast={deviceToast} onDismiss={() => setDeviceToast(null)} />
      </AnimatePresence>
      <AnimatePresence>
        <AmbientRotation idle={idle && !showWelcome && !quickControlsOpen && !brainDumpOpen && !focusLock} now={now} weather={weather} prayer={prayer} focus={focus} />
      </AnimatePresence>
      <AnimatePresence>
        {!showWelcome && (
          <GlobalListeningOrb
            settings={assistantSettings}
            alwaysListening={alwaysListening}
            page={page}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {page === 'clock' ? (
          <motion.div
            className="page-shell"
            key="clock"
            initial={{ x: -48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 155, damping: 24 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => info.offset.x < -80 && setPage('dashboard')}
          >
            <ChronoHub now={now} mode={mode} timeFormat={timeFormat} clockTimeZone={clockTimeZone} alarm={alarm} setManualMode={setManualMode} blackout={blackout} setBlackout={setBlackout} ambientPhase={ambientPhase} weather={weather} weatherMood={weatherMood} sleepMode={effectiveSleepMode} idle={idle} clockBackground={clockBackground} goDashboard={() => setPage('dashboard')} goSettings={() => setPage('settings')} />
          </motion.div>
        ) : page === 'dashboard' ? (
          <motion.div
            className="page-shell"
            key="dashboard"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 155, damping: 24 }}
          >
            <Dashboard now={now} weather={weather} timeFormat={timeFormat} clockTimeZone={clockTimeZone} alarm={alarm} customWidgets={customWidgets} setCustomWidgets={setCustomWidgets} customSections={customSections} setCustomSections={setCustomSections} deletedWidgets={deletedWidgets} deleteCustomWidget={deleteCustomWidget} toggleWidgetLock={toggleWidgetLock} restoreDeletedWidget={restoreDeletedWidget} restoreAllDeletedWidgets={restoreAllDeletedWidgets} musicLibrary={musicLibrary} musicPlayer={musicPlayer} cameraWakeEnabled={cameraWakeEnabled} setCameraWakeEnabled={setCameraWakeEnabled} cameraWakeStatus={cameraWakeStatus} cameraVideoRef={cameraVideoRef} assistantSettings={assistantSettings} setAssistantSettings={setAssistantSettings} runAssistantCommand={runAssistantCommand} assistantTimer={assistantTimer} alwaysListening={alwaysListening} cameraTheme={cameraTheme} smartTheme={smartTheme} showDeviceToast={showDeviceToast} ambientPhase={ambientPhase} weatherMood={weatherMood} liveWeatherMood={liveWeatherMood} weatherBackgroundOverride={weatherBackgroundOverride} sleepMode={effectiveSleepMode} setSleepMode={setSleepMode} idle={idle} noiseEnabled={noiseEnabled} setNoiseEnabled={setNoiseEnabled} noise={noise} focus={focus} roomMode={roomMode} setRoomMode={setRoomMode} focusLock={focusLock} setFocusLock={setFocusLock} battery={battery} caffeine={caffeine} openBrainDump={() => setBrainDumpOpen(true)} openQuickControls={() => setQuickControlsOpen(true)} goClock={() => setPage('clock')} goSettings={() => setPage('settings')} />
          </motion.div>
        ) : page === 'software' ? (
          <motion.div
            className="page-shell"
            key="software"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 14, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.16, ease: 'easeOut' }}
          >
            <SoftwareNeededPage mode={mode} networkAccess={networkAccess} goBack={() => setPage('settings')} goDashboard={() => setPage('dashboard')} />
          </motion.div>
        ) : (
          <motion.div
            className="page-shell"
            key="settings"
            initial={{ y: 22, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.18, ease: 'easeOut' }}
          >
            <ToolsPage now={now} mode={mode} manualMode={manualMode} autoColor={autoColor} setManualMode={setManualMode} alarm={alarm} setAlarm={setAlarm} timeFormat={timeFormat} setTimeFormat={setTimeFormat} clockTimeZone={clockTimeZone} setClockTimeZone={setClockTimeZone} weatherLocation={weatherLocation} setWeatherLocation={setWeatherLocation} weatherBackgroundOverride={weatherBackgroundOverride} setWeatherBackgroundOverride={setWeatherBackgroundOverride} liveWeatherMood={liveWeatherMood} weather={weather} clockBackground={clockBackground} setClockBackground={setClockBackground} layoutLook={layoutLook} setLayoutLook={setLayoutLook} customWidgets={customWidgets} setCustomWidgets={setCustomWidgets} customSections={customSections} setCustomSections={setCustomSections} deletedWidgets={deletedWidgets} setDeletedWidgets={setDeletedWidgets} deleteCustomWidget={deleteCustomWidget} toggleWidgetLock={toggleWidgetLock} restoreDeletedWidget={restoreDeletedWidget} restoreAllDeletedWidgets={restoreAllDeletedWidgets} resetCustomWidgets={resetCustomWidgets} assistantSettings={assistantSettings} setAssistantSettings={setAssistantSettings} cameraTheme={cameraTheme} networkAccess={networkAccess} goBack={() => setPage('clock')} goSoftware={() => setPage('software')} setAutoColor={setAutoColor} setRoomMode={setRoomMode} setSmartTheme={setSmartTheme} />
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
