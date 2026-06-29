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
const MUSIC_DIR = path.resolve(process.cwd(), 'music');
const MUSIC_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);
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
const execFileAsync = promisify(execFile);

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

async function getMusicTracks() {
  await fs.promises.mkdir(MUSIC_DIR, { recursive: true });
  const entries = await fs.promises.readdir(MUSIC_DIR, { withFileTypes: true });
  const tracks = await Promise.all(entries
    .filter((entry) => entry.isFile() && MUSIC_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map(async (entry) => {
      const filePath = path.join(MUSIC_DIR, entry.name);
      const stat = await fs.promises.stat(filePath);
      return {
        file: entry.name,
        title: musicTitle(entry.name),
        url: `/media/music/${encodeURIComponent(entry.name)}`,
        size: stat.size,
        modifiedAt: stat.mtimeMs
      };
    }));

  return tracks.sort((a, b) => a.title.localeCompare(b.title));
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

function getNetworkAccess(request) {
  const hostHeader = request.headers.host || 'localhost:5173';
  const port = hostHeader.includes(':') ? hostHeader.split(':').pop() : '5173';
  const urls = Object.entries(os.networkInterfaces())
    .flatMap(([name, entries = []]) => entries
      .filter((entry) => entry.family === 'IPv4' && !entry.internal)
      .map((entry) => ({
        name,
        address: entry.address,
        url: `http://${entry.address}:${port}`
      })));

  return {
    hostname: os.hostname(),
    port,
    localUrl: `http://localhost:${port}`,
    urls,
    fetchedAt: Date.now()
  };
}

function nexoraApi() {
  return {
    name: 'nexora-api',
    configureServer(server) {
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
          response.end(JSON.stringify({ directory: MUSIC_DIR, tracks, fetchedAt: Date.now() }));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ directory: MUSIC_DIR, tracks: [], error: error.message }));
        }
      });

      server.middlewares.use('/media/music/', async (request, response) => {
        try {
          const rawUrl = request.originalUrl || request.url;
          const encodedName = rawUrl.replace(/^\/media\/music\//, '').replace(/^\//, '').split('?')[0];
          const fileName = decodeURIComponent(encodedName);
          const filePath = path.resolve(MUSIC_DIR, fileName);
          if (!filePath.startsWith(MUSIC_DIR + path.sep) || !MUSIC_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
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
    }
  };
}

export default defineConfig({
  plugins: [react(), nexoraApi()]
});
