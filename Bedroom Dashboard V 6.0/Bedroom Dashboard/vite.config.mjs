import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { defineConfig } from 'vite';
import { promisify } from 'node:util';

const GOLD_SOURCE = 'https://goldtrackuae.com/';
const FUEL_SOURCE = 'https://lookuae.com/uae-petrol-prices-may-2026/';
const NEWS_SOURCE = 'https://gulfnews.com/';
const LOCAL_BACKEND = 'http://127.0.0.1:8787';
const ENABLE_HTTPS = /^(1|true|yes|on)$/i.test(process.env.BEDROOM_DASHBOARD_HTTPS || process.env.VITE_HTTPS || '');
const MUSIC_DIR = path.resolve(process.cwd(), 'music');
const ALARM_SOUNDS_DIR = path.resolve(process.cwd(), 'Custome Alarm Sounds');
const VIDEO_INTROS_DIR = path.resolve(process.cwd(), 'Custome Video Intro');
const GAME_DIR = path.resolve(process.cwd(), 'GAME');
const PROJECTS_DIR = path.resolve(process.cwd(), 'Projects');
const NOTIFICATIONS_DIR = path.resolve(process.cwd(), 'Notifications');
const MUSIC_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.avi']);
const FUEL_FALLBACK_RATES = [
  { label: 'Super 98', value: '3.66', unit: 'AED/L', delta: 'cached' },
  { label: 'Special 95', value: '3.55', unit: 'AED/L', delta: 'cached' },
  { label: 'E-Plus 91', value: '3.48', unit: 'AED/L', delta: 'cached' },
  { label: 'Diesel', value: '4.69', unit: 'AED/L', delta: 'cached' }
];
let goldCache = null;
let fuelCache = null;
let newsCache = null;
let newsRefreshHistory = [];
let backendAutostartPromise = null;
const execFileAsync = promisify(execFile);

function safeStorageName(value, fallback = 'Untitled') {
  const clean = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return clean || fallback;
}

function safeFileName(value, fallback = 'item') {
  const clean = safeStorageName(value, fallback).replace(/^\.+/, '').slice(0, 120);
  return clean || fallback;
}

function isPathInside(base, target) {
  const relative = path.relative(base, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function uniqueFilePath(directory, fileName) {
  const parsed = path.parse(safeFileName(fileName, 'item'));
  let candidate = path.join(directory, `${parsed.name}${parsed.ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(payload));
}

function readRequestBody(request, limitBytes = 80 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error('Request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

async function readJsonBody(request, limitBytes) {
  const raw = await readRequestBody(request, limitBytes);
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function projectFolders(tabTitle, sectionTitle = 'General') {
  const tabFolder = safeStorageName(tabTitle, 'Projects');
  const sectionFolder = safeStorageName(sectionTitle, 'General');
  const tabDir = path.join(PROJECTS_DIR, tabFolder);
  const sectionDir = path.join(tabDir, sectionFolder);
  return { tabFolder, sectionFolder, tabDir, sectionDir };
}

async function writeProjectManifest(tabDir, entry) {
  const manifestPath = path.join(tabDir, 'project-log.jsonl');
  await fs.promises.appendFile(manifestPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

function itemMarkdown(body) {
  const lines = [
    `# ${body.title || 'Project item'}`,
    '',
    `Type: ${body.type || 'note'}`,
    `Section: ${body.sectionTitle || 'General'}`,
    `Saved: ${new Date().toISOString()}`,
    ''
  ];
  if (body.value) lines.push('## Value', '', String(body.value), '');
  if (body.note) lines.push('## Note', '', String(body.note), '');
  return lines.join('\n');
}

function musicTitle(fileName) {
  return path.basename(fileName, path.extname(fileName))
    .replace(/[-_]+/g, ' ')
    .replace(/\s+\(\d+\)$/g, '')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function audioMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.m4a' || ext === '.aac') return 'audio/aac';
  if (ext === '.flac') return 'audio/flac';
  if (ext === '.webm') return 'audio/webm';
  return 'application/octet-stream';
}

function videoMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.avi') return 'video/x-msvideo';
  return 'application/octet-stream';
}

function gameMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.txt' || ext === '.md' || ext === '.url') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

async function walkAudioFiles(directory, baseDirectory = directory) {
  await fs.promises.mkdir(directory, { recursive: true });
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      files.push(...await walkAudioFiles(filePath, baseDirectory));
      continue;
    }
    if (!entry.isFile() || !MUSIC_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const stat = await fs.promises.stat(filePath);
    if (stat.size <= 0) continue;
    const relativePath = path.relative(baseDirectory, filePath).replace(/\\/g, '/');
    const folder = path.dirname(relativePath).replace(/\\/g, '/');
    files.push({
      file: relativePath,
      title: musicTitle(entry.name),
      folder: folder === '.' ? 'Root' : folder,
      playlist: folder === '.' ? 'Root' : folder.split('/')[0],
      url: `/media/music/${encodeURIComponent(relativePath)}`,
      size: stat.size,
      modifiedAt: stat.mtimeMs
    });
  }

  return files;
}

function summarizeMusicPlaylists(tracks) {
  const groups = new Map();
  tracks.forEach((track) => {
    const key = track.playlist || track.folder || 'Root';
    groups.set(key, (groups.get(key) || 0) + 1);
  });
  return [...groups.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getMusicTracks() {
  const tracks = await walkAudioFiles(MUSIC_DIR, MUSIC_DIR);
  return tracks.sort((a, b) => {
    const folderCompare = String(a.folder || '').localeCompare(String(b.folder || ''));
    return folderCompare || a.title.localeCompare(b.title);
  });
}

async function getVideoIntros() {
  await fs.promises.mkdir(VIDEO_INTROS_DIR, { recursive: true });
  const entries = await fs.promises.readdir(VIDEO_INTROS_DIR, { withFileTypes: true });
  const videos = await Promise.all(entries
    .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map(async (entry) => {
      const filePath = path.join(VIDEO_INTROS_DIR, entry.name);
      const stat = await fs.promises.stat(filePath);
      return {
        file: entry.name,
        title: musicTitle(entry.name),
        url: `/media/video-intros/${encodeURIComponent(entry.name)}`,
        size: stat.size,
        modifiedAt: stat.mtimeMs
      };
    }));

  return videos
    .filter((video) => video.size > 0)
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

async function getAlarmSounds() {
  await fs.promises.mkdir(ALARM_SOUNDS_DIR, { recursive: true });
  const entries = await fs.promises.readdir(ALARM_SOUNDS_DIR, { withFileTypes: true });
  const tracks = await Promise.all(entries
    .filter((entry) => entry.isFile() && MUSIC_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map(async (entry) => {
      const filePath = path.join(ALARM_SOUNDS_DIR, entry.name);
      const stat = await fs.promises.stat(filePath);
      return {
        file: entry.name,
        title: musicTitle(entry.name),
        url: `/media/alarm-sounds/${encodeURIComponent(entry.name)}`,
        size: stat.size,
        modifiedAt: stat.mtimeMs
      };
    }));

  return tracks
    .filter((track) => track.size > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
}

function extractGoldRates(html) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim());

  const rates = [];

  for (const script of scripts) {
    try {
      const data = JSON.parse(script);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item?.['@type'] !== 'Product' || !/Gold Price UAE/i.test(item.name || '')) continue;
        const karat = item.name.match(/(\d+)K/i)?.[1];
        const price = Number(item.offers?.price);

        if (karat && Number.isFinite(price)) {
          rates.push({
            label: `${karat}K Gold`,
            value: price.toFixed(2),
            unit: 'AED/g',
            delta: 'live'
          });
        }
      }
    } catch {
      // Ignore non-rate structured-data blocks.
    }
  }

  const wanted = ['24K Gold', '22K Gold', '21K Gold', '18K Gold'];
  const ordered = wanted
    .map((label) => rates.find((rate) => rate.label === label))
    .filter(Boolean);

  if (ordered.length < 2) {
    throw new Error('Could not parse enough live gold rates');
  }

  return ordered;
}

async function getGoldRates() {
  const now = Date.now();
  if (goldCache && now - goldCache.fetchedAt < 5 * 60 * 1000) {
    return { ...goldCache, cached: true };
  }

  const response = await fetch(GOLD_SOURCE, {
    headers: {
      'user-agent': 'Project Nexora bedroom kiosk/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Gold source returned ${response.status}`);
  }

  const html = await response.text();
  goldCache = {
    source: GOLD_SOURCE,
    fetchedAt: now,
    rates: extractGoldRates(html)
  };
  return { ...goldCache, cached: false };
}

function extractFuelPrices(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const pairs = [
    ['Super 98', /Super 98(?:\s+at|:)\s*AED\s*(\d+(?:\.\d+)?)/i],
    ['Special 95', /Special 95(?:\s+at|:)\s*AED\s*(\d+(?:\.\d+)?)/i],
    ['E-Plus 91', /E-Plus 91(?:\s+at|:)\s*AED\s*(\d+(?:\.\d+)?)/i],
    ['Diesel', /Diesel(?:\s+at|:)\s*AED\s*(\d+(?:\.\d+)?)/i]
  ];

  const rates = pairs.map(([label, pattern]) => {
    const value = text.match(pattern)?.[1];
    if (!value) return null;
    return {
      label,
      value: Number(value).toFixed(2),
      unit: 'AED/L',
      delta: 'live'
    };
  }).filter(Boolean);

  if (rates.length < 4) {
    throw new Error('Could not parse UAE fuel rates');
  }

  return rates;
}

async function getFuelPrices() {
  const now = Date.now();
  if (fuelCache && now - fuelCache.fetchedAt < 60 * 60 * 1000) {
    return { ...fuelCache, cached: true };
  }

  const response = await fetch(FUEL_SOURCE, {
    headers: {
      'user-agent': 'Project Nexora bedroom kiosk/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Fuel source returned ${response.status}`);
  }

  const html = await response.text();
  fuelCache = {
    source: FUEL_SOURCE,
    fetchedAt: now,
    rates: extractFuelPrices(html)
  };
  return { ...fuelCache, cached: false };
}

function decodeEmbeddedString(value = '') {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value
      .replace(/\\u002F/g, '/')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, ' ')
      .replace(/\\t/g, ' ');
  }
}

function cleanNewsText(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function newsCategory(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts[0] ? parts[0].replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Latest';
  } catch {
    return 'Latest';
  }
}

function extractGulfNews(html) {
  const storyPattern = /"headline":"((?:\\.|[^"])*)","slug":"((?:\\.|[^"])*)","last-published-at":(\d+),"subheadline":"((?:\\.|[^"])*)"/g;
  const seen = new Set();
  const items = [];

  for (const match of html.matchAll(storyPattern)) {
    const title = cleanNewsText(decodeEmbeddedString(match[1]));
    const slug = decodeEmbeddedString(match[2]).replace(/^\/+/, '');
    const publishedAt = Number(match[3]);
    const summary = cleanNewsText(decodeEmbeddedString(match[4]));
    const url = slug.startsWith('http') ? slug : `${NEWS_SOURCE}${slug}`;

    if (!title || !slug || seen.has(url) || /download the app/i.test(title)) continue;
    seen.add(url);
    items.push({
      id: url,
      title,
      summary,
      url,
      category: newsCategory(url),
      publishedAt
    });
  }

  const sorted = items.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 18);
  if (sorted.length < 4) {
    throw new Error('Could not parse Gulf News stories');
  }
  return sorted;
}

async function getGulfNews() {
  const now = Date.now();
  if (newsCache && now - newsCache.fetchedAt < 60 * 1000) {
    return { ...newsCache, cached: true };
  }

  const response = await fetch(NEWS_SOURCE, {
    headers: {
      'user-agent': 'Project Nexora bedroom kiosk/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Gulf News returned ${response.status}`);
  }

  const html = await response.text();
  const items = extractGulfNews(html);
  newsRefreshHistory = [
    {
      fetchedAt: now,
      count: items.length,
      top: items[0]?.title || 'Latest Gulf News'
    },
    ...newsRefreshHistory
  ].slice(0, 24);

  newsCache = {
    source: NEWS_SOURCE,
    fetchedAt: now,
    items,
    history: newsRefreshHistory
  };
  return { ...newsCache, cached: false };
}

function getCpuTimes() {
  return os.cpus().map((cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    return { idle: cpu.times.idle, total };
  });
}

function cpuUsageBetween(previous, current) {
  if (!previous || previous.length !== current.length) return 0;
  const usage = current.map((core, index) => {
    const idle = core.idle - previous[index].idle;
    const total = core.total - previous[index].total;
    return total > 0 ? 1 - idle / total : 0;
  });
  return Math.round((usage.reduce((sum, value) => sum + value, 0) / usage.length) * 100);
}

let lastCpuTimes = getCpuTimes();

async function getDiskUsage() {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object Size,FreeSpace | ConvertTo-Json -Compress)`
    ]);
    const disk = JSON.parse(stdout);
    const used = disk.Size - disk.FreeSpace;
    return {
      usedGb: used / 1024 / 1024 / 1024,
      totalGb: disk.Size / 1024 / 1024 / 1024,
      percent: Math.round((used / disk.Size) * 100)
    };
  }

  const { stdout } = await execFileAsync('df', ['-k', '/']);
  const line = stdout.trim().split('\n')[1].trim().split(/\s+/);
  const total = Number(line[1]) * 1024;
  const used = Number(line[2]) * 1024;
  return {
    usedGb: used / 1024 / 1024 / 1024,
    totalGb: total / 1024 / 1024 / 1024,
    percent: Math.round((used / total) * 100)
  };
}

async function getCpuTemperature() {
  try {
    if (process.platform === 'linux') {
      const { stdout } = await execFileAsync('sh', ['-lc', 'cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -n 1']);
      const raw = Number(stdout.trim());
      if (Number.isFinite(raw) && raw > 0) return raw > 1000 ? Math.round(raw / 1000) : Math.round(raw);
    }
  } catch {
    // Temperature is optional because not every laptop exposes it.
  }
  return null;
}

async function getGatewayLatency() {
  const host = process.platform === 'win32' ? '8.8.8.8' : '1.1.1.1';
  const args = process.platform === 'win32' ? ['-n', '1', host] : ['-c', '1', '-W', '1', host];
  try {
    const { stdout } = await execFileAsync('ping', args, { timeout: 2500 });
    const match = stdout.match(/time[=<]([\d.]+)\s*ms/i) || stdout.match(/Average = (\d+)ms/i);
    return match ? Math.round(Number(match[1])) : null;
  } catch {
    return null;
  }
}

async function getSystemInfo() {
  const currentCpuTimes = getCpuTimes();
  const cpuPercent = cpuUsageBetween(lastCpuTimes, currentCpuTimes);
  lastCpuTimes = currentCpuTimes;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const [disk, tempC, pingMs] = await Promise.all([
    getDiskUsage().catch(() => null),
    getCpuTemperature(),
    getGatewayLatency()
  ]);

  return {
    platform: `${os.type()} ${os.release()}`,
    hostname: os.hostname(),
    cpuModel: os.cpus()[0]?.model || 'CPU',
    cpuCores: os.cpus().length,
    cpuPercent,
    tempC,
    ram: {
      usedGb: usedMem / 1024 / 1024 / 1024,
      totalGb: totalMem / 1024 / 1024 / 1024,
      percent: Math.round((usedMem / totalMem) * 100)
    },
    disk,
    uptimeSeconds: os.uptime(),
    pingMs,
    fetchedAt: Date.now()
  };
}

function isUsableAccessAddress(address) {
  if (!address) return false;
  if (address === '0.0.0.0' || address.startsWith('127.')) return false;
  if (address.startsWith('169.254.')) return false;
  return true;
}

function networkAddressKind(name, address) {
  const label = name.toLowerCase();
  const parts = address.split('.').map((part) => Number(part));
  if (label.includes('tail') || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)) return 'tailscale';
  if (label.includes('wi-fi') || label.includes('wifi') || label.includes('wlan')) return 'wifi';
  if (label.includes('ethernet') || label.includes('lan')) return 'ethernet';
  return 'private';
}

function networkSortRank(item) {
  if (item.kind === 'wifi') return 0;
  if (item.kind === 'ethernet') return 1;
  if (item.kind === 'private') return 2;
  if (item.kind === 'tailscale') return 3;
  return 9;
}

function normalizeClientIp(value = '') {
  return String(value || '')
    .replace(/^::ffff:/, '')
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .trim();
}

function isPrivateClientIp(value = '') {
  const address = normalizeClientIp(value);
  if (!address || address === '::1' || address === 'localhost') return true;
  if (address.startsWith('127.')) return true;

  const parts = address.split('.').map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  }

  return false;
}

function requestClientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return normalizeClientIp(forwarded || request.socket?.remoteAddress || '');
}

async function backendHealth(timeoutMs = 2200) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${LOCAL_BACKEND}/api/status`, {
      cache: 'no-store',
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok && data?.ok !== false, status: response.status, data };
  } catch (error) {
    return { ok: false, error: error.message || 'Backend did not respond' };
  } finally {
    clearTimeout(timeout);
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function waitForBackendHealth(timeoutMs = 14000) {
  const start = Date.now();
  let last = await backendHealth(1800);
  while (!last.ok && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    last = await backendHealth(1800);
  }
  return last;
}

async function startBackendProcess(reason = 'FrontendAutostart', force = false) {
  const projectRoot = process.cwd();
  const logsDir = path.join(projectRoot, 'logs');
  await fs.promises.mkdir(logsDir, { recursive: true });

  if (process.platform === 'win32') {
    const scriptPath = path.join(projectRoot, 'scripts', 'windows', 'restart_BEDROOM_DASHBOARD_windows.ps1');
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Missing backend restart script: ${scriptPath}`);
    }
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-Reason',
      reason,
      '-BackendOnly'
    ].concat(force ? ['-ForceRestart'] : []), { cwd: projectRoot, timeout: 30000, windowsHide: true });
    return;
  }

  const backendDir = path.join(projectRoot, 'backend');
  if (!fs.existsSync(path.join(backendDir, 'main.py'))) {
    throw new Error(`Missing backend/main.py in ${projectRoot}`);
  }

  const command = [
    'set -e',
    `cd ${shellQuote(backendDir)}`,
    '[ -x .venv/bin/python ] || python3 -m venv .venv',
    '[ ! -f requirements.txt ] || .venv/bin/python -m pip install -r requirements.txt >/dev/null 2>&1',
    `ALLOW_DEVICE_CONTROL=true nohup .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8787 > ${shellQuote(path.join(logsDir, 'backend-auto.out.log'))} 2> ${shellQuote(path.join(logsDir, 'backend-auto.err.log'))} < /dev/null &`
  ].join(' && ');

  await execFileAsync('bash', ['-lc', command], { cwd: projectRoot, timeout: 30000 });
}

async function ensureBackendStarted(reason = 'FrontendAutostart', force = false) {
  const before = await backendHealth();
  if (before.ok && !force) {
    return { ok: true, started: false, message: 'Backend is already running.', health: before };
  }

  if (!backendAutostartPromise) {
    backendAutostartPromise = (async () => {
      await startBackendProcess(force ? `${reason}Force` : reason, force);
      const after = await waitForBackendHealth();
      return {
        ok: after.ok,
        started: true,
        forced: force,
        message: after.ok ? (force ? 'Backend restarted.' : 'Backend started.') : 'Backend start was requested, but health check still failed.',
        health: after
      };
    })().finally(() => {
      setTimeout(() => {
        backendAutostartPromise = null;
      }, 1000);
    });
  }

  return backendAutostartPromise;
}

function getNetworkAccess(request) {
  const hostHeader = request.headers.host || 'localhost:5173';
  const port = hostHeader.includes(':') ? hostHeader.split(':').pop() : '5173';
  const requestHost = hostHeader.split(':')[0] || 'localhost';
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || (request.socket?.encrypted || ENABLE_HTTPS ? 'https' : 'http');
  const urls = Object.entries(os.networkInterfaces())
    .flatMap(([name, entries = []]) => entries
      .filter((entry) => entry.family === 'IPv4' && !entry.internal && isUsableAccessAddress(entry.address))
      .map((entry) => {
        const kind = networkAddressKind(name, entry.address);
        return {
          name,
          kind,
          address: entry.address,
          url: `${protocol}://${entry.address}:${port}`,
          cameraUrl: `${protocol}://${entry.address}:${port}/localhost-camera`,
          backendUrl: `http://${entry.address}:8787`
        };
      }))
    .sort((a, b) => networkSortRank(a) - networkSortRank(b) || a.name.localeCompare(b.name));
  const primary = urls.find((item) => item.kind === 'wifi' || item.kind === 'ethernet') || urls[0] || null;

  return {
    hostname: os.hostname(),
    port,
    protocol,
    httpsEnabled: protocol === 'https',
    requestHost,
    localUrl: `${protocol}://localhost:${port}`,
    localCameraUrl: `${protocol}://localhost:${port}/localhost-camera`,
    primaryUrl: primary?.url || `${protocol}://localhost:${port}`,
    primaryCameraUrl: primary?.cameraUrl || `${protocol}://localhost:${port}/localhost-camera`,
    hint: protocol === 'https'
      ? 'HTTPS is enabled for microphone/camera permissions on phone. Accept the local certificate warning once, or use Tailscale HTTPS for a trusted certificate.'
      : 'HTTP LAN mode cannot use phone microphone/camera in Chrome. Start with BEDROOM_DASHBOARD_HTTPS=true or use Tailscale HTTPS. If the page fails, Windows Firewall may be blocking ports 5173 or 8787.',
    urls,
    fetchedAt: Date.now()
  };
}

function nexoraApi() {
  return {
    name: 'nexora-api',
    async closeBundle() {
      try {
        await fs.promises.access(GAME_DIR);
        const target = path.resolve(process.cwd(), 'dist', 'GAME');
        await fs.promises.rm(target, { recursive: true, force: true });
        await fs.promises.cp(GAME_DIR, target, { recursive: true });
      } catch {
        // The GAME folder is optional during early setup.
      }
    },
    configureServer(server) {
      server.middlewares.use('/GAME/', async (request, response) => {
        try {
          const rawUrl = request.originalUrl || request.url || '/GAME/index.html';
          const encodedName = rawUrl.replace(/^\/GAME\//, '').split('?')[0] || 'index.html';
          const fileName = decodeURIComponent(encodedName);
          const filePath = path.resolve(GAME_DIR, fileName);
          if (!filePath.startsWith(GAME_DIR + path.sep)) {
            response.statusCode = 404;
            response.end('Not found');
            return;
          }

          const stat = await fs.promises.stat(filePath);
          const finalPath = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
          const finalStat = await fs.promises.stat(finalPath);
          response.setHeader('content-type', gameMime(finalPath));
          response.setHeader('cache-control', 'no-cache');
          response.setHeader('content-length', finalStat.size);
          fs.createReadStream(finalPath).pipe(response);
        } catch {
          response.statusCode = 404;
          response.end('Not found');
        }
      });

      server.middlewares.use('/api/backend/autostart', async (request, response) => {
        response.setHeader('content-type', 'application/json');

        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end(JSON.stringify({ ok: false, error: 'Use POST to request backend autostart.' }));
          return;
        }

        const clientIp = requestClientIp(request);
        if (!isPrivateClientIp(clientIp)) {
          response.statusCode = 403;
          response.end(JSON.stringify({
            ok: false,
            error: 'Backend autostart is restricted to localhost, private Wi-Fi, or private Tailscale clients.',
            clientIp
          }));
          return;
        }

        try {
          const url = new URL(request.url || '', 'http://localhost');
          const reason = (url.searchParams.get('reason') || 'FrontendAutostart').replace(/[^\w.-]/g, '').slice(0, 48) || 'FrontendAutostart';
          const force = url.searchParams.get('force') === '1' || url.searchParams.get('force') === 'true';
          const result = await ensureBackendStarted(reason, force);
          response.statusCode = result.ok ? 200 : 503;
          response.end(JSON.stringify({ ...result, clientIp, checkedAt: Date.now() }));
        } catch (error) {
          response.statusCode = 500;
          response.end(JSON.stringify({
            ok: false,
            error: error.message || 'Backend autostart failed.',
            clientIp,
            checkedAt: Date.now()
          }));
        }
      });

      server.middlewares.use('/api/gold', async (_request, response) => {
        try {
          const payload = await getGoldRates();
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(payload));
        } catch (error) {
          response.statusCode = goldCache ? 200 : 502;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({
            source: GOLD_SOURCE,
            fetchedAt: goldCache?.fetchedAt || Date.now(),
            rates: goldCache?.rates || [],
            cached: Boolean(goldCache),
            error: error.message
          }));
        }
      });

      server.middlewares.use('/api/fuel', async (_request, response) => {
        try {
          const payload = await getFuelPrices();
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(payload));
        } catch (error) {
          response.statusCode = 200;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({
            source: FUEL_SOURCE,
            fetchedAt: fuelCache?.fetchedAt || Date.now(),
            rates: fuelCache?.rates || FUEL_FALLBACK_RATES,
            cached: true,
            error: error.message
          }));
        }
      });

      server.middlewares.use('/api/news', async (_request, response) => {
        try {
          const payload = await getGulfNews();
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(payload));
        } catch (error) {
          response.statusCode = newsCache ? 200 : 502;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({
            source: NEWS_SOURCE,
            fetchedAt: newsCache?.fetchedAt || Date.now(),
            items: newsCache?.items || [],
            history: newsRefreshHistory,
            cached: Boolean(newsCache),
            error: error.message
          }));
        }
      });

      server.middlewares.use('/api/network', (request, response) => {
        try {
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(getNetworkAccess(request)));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ error: error.message }));
        }
      });

      server.middlewares.use('/api/system', async (_request, response) => {
        try {
          const payload = await getSystemInfo();
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(payload));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ error: error.message }));
        }
      });

      server.middlewares.use('/api/music', async (_request, response) => {
        try {
          const tracks = await getMusicTracks();
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ directory: MUSIC_DIR, tracks, playlists: summarizeMusicPlaylists(tracks), fetchedAt: Date.now() }));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ directory: MUSIC_DIR, tracks: [], playlists: [], error: error.message }));
        }
      });

      server.middlewares.use('/api/alarm-sounds', async (_request, response) => {
        try {
          const tracks = await getAlarmSounds();
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ directory: ALARM_SOUNDS_DIR, tracks, fetchedAt: Date.now() }));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ directory: ALARM_SOUNDS_DIR, tracks: [], error: error.message }));
        }
      });

      server.middlewares.use('/api/video-intros', async (_request, response) => {
        try {
          const videos = await getVideoIntros();
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ directory: VIDEO_INTROS_DIR, videos, fetchedAt: Date.now() }));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ directory: VIDEO_INTROS_DIR, videos: [], error: error.message }));
        }
      });

      server.middlewares.use('/api/notifications', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { ok: false, error: 'Use POST to save notifications.' });
          return;
        }

        try {
          const body = await readJsonBody(request, 512 * 1024);
          await fs.promises.mkdir(NOTIFICATIONS_DIR, { recursive: true });
          const day = new Date().toISOString().slice(0, 10);
          const entry = {
            id: body.id || `${Date.now()}`,
            title: String(body.title || 'Notification').slice(0, 140),
            detail: String(body.detail || '').slice(0, 800),
            tone: String(body.tone || 'green').slice(0, 30),
            route: String(body.route || '').slice(0, 160),
            createdAt: new Date().toISOString()
          };
          await fs.promises.appendFile(path.join(NOTIFICATIONS_DIR, `${day}.jsonl`), `${JSON.stringify(entry)}\n`, 'utf8');
          sendJson(response, 200, { ok: true, directory: NOTIFICATIONS_DIR, saved: entry });
        } catch (error) {
          sendJson(response, 500, { ok: false, directory: NOTIFICATIONS_DIR, error: error.message || 'Notification save failed.' });
        }
      });

      server.middlewares.use('/api/projects/tab', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { ok: false, error: 'Use POST to create a project tab folder.' });
          return;
        }

        try {
          const body = await readJsonBody(request, 512 * 1024);
          const { tabFolder, tabDir } = projectFolders(body.title || body.tabTitle || 'Projects');
          await fs.promises.mkdir(tabDir, { recursive: true });
          await fs.promises.writeFile(path.join(tabDir, 'tab-info.json'), JSON.stringify({
            title: body.title || body.tabTitle || tabFolder,
            folder: tabFolder,
            updatedAt: new Date().toISOString()
          }, null, 2), 'utf8');
          sendJson(response, 200, { ok: true, directory: PROJECTS_DIR, tabFolder, localPath: tabDir });
        } catch (error) {
          sendJson(response, 500, { ok: false, directory: PROJECTS_DIR, error: error.message || 'Project tab save failed.' });
        }
      });

      server.middlewares.use('/api/projects/section', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { ok: false, error: 'Use POST to create a project section folder.' });
          return;
        }

        try {
          const body = await readJsonBody(request, 512 * 1024);
          const { tabFolder, sectionFolder, tabDir, sectionDir } = projectFolders(body.tabTitle, body.sectionTitle || body.title);
          await fs.promises.mkdir(sectionDir, { recursive: true });
          await writeProjectManifest(tabDir, {
            kind: 'section',
            title: body.sectionTitle || body.title || sectionFolder,
            tabFolder,
            sectionFolder,
            savedAt: new Date().toISOString()
          });
          sendJson(response, 200, { ok: true, directory: PROJECTS_DIR, tabFolder, sectionFolder, localPath: sectionDir });
        } catch (error) {
          sendJson(response, 500, { ok: false, directory: PROJECTS_DIR, error: error.message || 'Project section save failed.' });
        }
      });

      server.middlewares.use('/api/projects/save-item', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { ok: false, error: 'Use POST to save a project item.' });
          return;
        }

        try {
          const body = await readJsonBody(request);
          const title = safeStorageName(body.title, 'Project item');
          const type = String(body.type || 'note').toLowerCase();
          const { tabFolder, sectionFolder, tabDir, sectionDir } = projectFolders(body.tabTitle, body.sectionTitle);
          await fs.promises.mkdir(sectionDir, { recursive: true });

          let targetPath;
          let savedKind = 'record';
          if (body.dataUrl && body.fileName) {
            const encoded = String(body.dataUrl).includes(',') ? String(body.dataUrl).split(',').pop() : String(body.dataUrl);
            const buffer = Buffer.from(encoded || '', 'base64');
            if (!buffer.length) throw new Error('Uploaded file is empty.');
            targetPath = await uniqueFilePath(sectionDir, body.fileName);
            await fs.promises.writeFile(targetPath, buffer);
            savedKind = 'file';
          } else if (type === 'link') {
            targetPath = await uniqueFilePath(sectionDir, `${title}.url`);
            await fs.promises.writeFile(targetPath, `[InternetShortcut]\nURL=${body.value || ''}\n`, 'utf8');
          } else if (type === 'code') {
            targetPath = await uniqueFilePath(sectionDir, `${title}.txt`);
            await fs.promises.writeFile(targetPath, String(body.value || body.note || ''), 'utf8');
          } else {
            targetPath = await uniqueFilePath(sectionDir, `${title}.md`);
            await fs.promises.writeFile(targetPath, itemMarkdown(body), 'utf8');
          }

          if (!isPathInside(PROJECTS_DIR, targetPath)) {
            throw new Error('Blocked unsafe project path.');
          }

          const relativePath = path.relative(PROJECTS_DIR, targetPath).replace(/\\/g, '/');
          const entry = {
            kind: savedKind,
            title,
            type,
            value: body.value || '',
            note: body.note || '',
            tabFolder,
            sectionFolder,
            fileName: path.basename(targetPath),
            relativePath,
            localPath: targetPath,
            savedAt: new Date().toISOString()
          };
          await writeProjectManifest(tabDir, entry);
          sendJson(response, 200, {
            ok: true,
            directory: PROJECTS_DIR,
            tabFolder,
            sectionFolder,
            fileName: entry.fileName,
            relativePath,
            localPath: targetPath,
            url: `/project-files/${encodeURIComponent(relativePath)}`,
            savedAt: entry.savedAt
          });
        } catch (error) {
          sendJson(response, 500, { ok: false, directory: PROJECTS_DIR, error: error.message || 'Project item save failed.' });
        }
      });

      server.middlewares.use('/media/music/', async (request, response) => {
        try {
          const rawUrl = request.originalUrl || request.url;
          const encodedName = rawUrl.replace(/^\/media\/music\//, '').replace(/^\//, '').split('?')[0];
          const fileName = decodeURIComponent(encodedName);
          const filePath = path.resolve(MUSIC_DIR, fileName);
          const relative = path.relative(MUSIC_DIR, filePath);
          if (relative.startsWith('..') || path.isAbsolute(relative) || !MUSIC_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
            response.statusCode = 404;
            response.end('Not found');
            return;
          }

          const stat = await fs.promises.stat(filePath);
          const range = request.headers.range;
          response.setHeader('accept-ranges', 'bytes');
          response.setHeader('content-type', audioMime(filePath));
          response.setHeader('cache-control', 'no-cache');

          if (range) {
            const match = range.match(/bytes=(\d+)-(\d*)/);
            const start = match ? Number(match[1]) : 0;
            const end = match?.[2] ? Number(match[2]) : stat.size - 1;
            if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size) {
              response.statusCode = 416;
              response.setHeader('content-range', `bytes */${stat.size}`);
              response.end();
              return;
            }
            response.statusCode = 206;
            response.setHeader('content-range', `bytes ${start}-${end}/${stat.size}`);
            response.setHeader('content-length', end - start + 1);
            fs.createReadStream(filePath, { start, end }).pipe(response);
            return;
          }

          response.setHeader('content-length', stat.size);
          fs.createReadStream(filePath).pipe(response);
        } catch {
          response.statusCode = 404;
          response.end('Not found');
        }
      });

      server.middlewares.use('/media/video-intros/', async (request, response) => {
        try {
          const rawUrl = request.originalUrl || request.url;
          const encodedName = rawUrl.replace(/^\/media\/video-intros\//, '').replace(/^\//, '').split('?')[0];
          const fileName = decodeURIComponent(encodedName);
          const filePath = path.resolve(VIDEO_INTROS_DIR, fileName);
          if (!filePath.startsWith(VIDEO_INTROS_DIR + path.sep) || !VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
            response.statusCode = 404;
            response.end('Not found');
            return;
          }

          const stat = await fs.promises.stat(filePath);
          const range = request.headers.range;
          response.setHeader('accept-ranges', 'bytes');
          response.setHeader('content-type', videoMime(filePath));
          response.setHeader('cache-control', 'no-cache');

          if (range) {
            const match = range.match(/bytes=(\d+)-(\d*)/);
            const start = match ? Number(match[1]) : 0;
            const end = match?.[2] ? Number(match[2]) : stat.size - 1;
            if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size) {
              response.statusCode = 416;
              response.setHeader('content-range', `bytes */${stat.size}`);
              response.end();
              return;
            }
            response.statusCode = 206;
            response.setHeader('content-range', `bytes ${start}-${end}/${stat.size}`);
            response.setHeader('content-length', end - start + 1);
            fs.createReadStream(filePath, { start, end }).pipe(response);
            return;
          }

          response.setHeader('content-length', stat.size);
          fs.createReadStream(filePath).pipe(response);
        } catch {
          response.statusCode = 404;
          response.end('Not found');
        }
      });

      server.middlewares.use('/media/alarm-sounds/', async (request, response) => {
        try {
          const rawUrl = request.originalUrl || request.url;
          const encodedName = rawUrl.replace(/^\/media\/alarm-sounds\//, '').replace(/^\//, '').split('?')[0];
          const fileName = decodeURIComponent(encodedName);
          const filePath = path.resolve(ALARM_SOUNDS_DIR, fileName);
          if (!filePath.startsWith(ALARM_SOUNDS_DIR + path.sep) || !MUSIC_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
            response.statusCode = 404;
            response.end('Not found');
            return;
          }

          const stat = await fs.promises.stat(filePath);
          const range = request.headers.range;
          response.setHeader('accept-ranges', 'bytes');
          response.setHeader('content-type', audioMime(filePath));
          response.setHeader('cache-control', 'no-cache');

          if (range) {
            const match = range.match(/bytes=(\d+)-(\d*)/);
            const start = match ? Number(match[1]) : 0;
            const end = match?.[2] ? Number(match[2]) : stat.size - 1;
            if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size) {
              response.statusCode = 416;
              response.setHeader('content-range', `bytes */${stat.size}`);
              response.end();
              return;
            }
            response.statusCode = 206;
            response.setHeader('content-range', `bytes ${start}-${end}/${stat.size}`);
            response.setHeader('content-length', end - start + 1);
            fs.createReadStream(filePath, { start, end }).pipe(response);
            return;
          }

          response.setHeader('content-length', stat.size);
          fs.createReadStream(filePath).pipe(response);
        } catch {
          response.statusCode = 404;
          response.end('Not found');
        }
      });

      server.middlewares.use('/project-files/', async (request, response) => {
        try {
          const rawUrl = request.originalUrl || request.url;
          const encodedName = rawUrl.replace(/^\/project-files\//, '').replace(/^\//, '').split('?')[0];
          const fileName = decodeURIComponent(encodedName);
          const filePath = path.resolve(PROJECTS_DIR, fileName);
          if (!isPathInside(PROJECTS_DIR, filePath)) {
            response.statusCode = 404;
            response.end('Not found');
            return;
          }

          const stat = await fs.promises.stat(filePath);
          if (!stat.isFile()) {
            response.statusCode = 404;
            response.end('Not found');
            return;
          }

          response.setHeader('content-type', gameMime(filePath));
          response.setHeader('cache-control', 'no-cache');
          response.setHeader('content-length', stat.size);
          fs.createReadStream(filePath).pipe(response);
        } catch {
          response.statusCode = 404;
          response.end('Not found');
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [ENABLE_HTTPS ? basicSsl() : null, react(), nexoraApi()].filter(Boolean),
  server: {
    proxy: {
      '/api/status': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/settings': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/command': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/ai': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/camera': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/theme': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/speak': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/signal': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/remote-camera': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/local-camera': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/usb-camera': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/radar': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/bedroom': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/kiosk': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/system': { target: LOCAL_BACKEND, changeOrigin: true },
      '/api/device': { target: LOCAL_BACKEND, changeOrigin: true }
    }
  }
});
