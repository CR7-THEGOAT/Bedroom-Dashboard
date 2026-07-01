#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <MD_MAX72xx.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <Adafruit_NeoPixel.h>
#include <SPI.h>
#include <FS.h>
#include <LittleFS.h>

// ============================================================
// ESP32 SMART HUB
// ESP32 DevKit V1 / ESP32-WROOM-32
//
// Fast screen policy:
// - Dashboard draws the frame once and only repaints changed fields.
// - Uploaded images are browser-resized to 240x320 RGB565 big-endian.
// - ESP32 stores the raw RGB565 frame in LittleFS.
// - Image render uses setAddrWindow + writePixels buffered bursts without per-pixel drawing.
// - Browser games never render on the ST7789.
// ============================================================

// ---------- WIFI ----------
// Update these before uploading to your ESP32.
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

WebServer server(80);

// ---------- ST7789 ----------
#define TFT_CS   5
#define TFT_DC   2
#define TFT_RST  4
#define TFT_SCK  18
#define TFT_MOSI 23

static const uint16_t TFT_W = 240;
static const uint16_t TFT_H = 320;
static const uint8_t TFT_ROTATION = 2; // Portrait 240x320 flipped to match the common 2.0 IPS ST7789 module.
static const uint32_t TFT_SPI_HZ = 10000000UL; // Very stable for jumper wires. Raise only after the display is clean.
static const bool TFT_BOOT_COLOR_TEST = false;
Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);

// ---------- DHT22 ----------
#define DHTPIN 21
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// ---------- BUZZER ----------
#define BUZZER_PIN 32

// ---------- WS2812B / NEOPIXEL ----------
#define LED_PIN 26
#define LED_COUNT 30
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

bool ledStripOn = false;
uint8_t ledBrightness = 120;
uint8_t ledR = 0;
uint8_t ledG = 255;
uint8_t ledB = 136;

// ---------- MAX7219 8x8 MATRIX ----------
#define HARDWARE_TYPE MD_MAX72XX::FC16_HW
#define MAX_DEVICES 1
#define MATRIX_DIN 14
#define MATRIX_CLK 25
#define MATRIX_CS  33
MD_MAX72XX matrix = MD_MAX72XX(HARDWARE_TYPE, MATRIX_DIN, MATRIX_CLK, MATRIX_CS, MAX_DEVICES);

// ---------- SCREEN ----------
enum ScreenMode {
  SCREEN_DASHBOARD,
  SCREEN_IMAGE,
  SCREEN_CUSTOM
};

ScreenMode currentScreen = SCREEN_DASHBOARD;
bool imageAvailable = false;
bool pendingImageRender = false;
uint8_t currentPhotoSlot = 0;

// ---------- IMAGE STORAGE / RENDER ----------
static const uint8_t PHOTO_SLOT_COUNT = 3;
static const char* PHOTO_FILES[PHOTO_SLOT_COUNT] = {
  "/screen.rgb565",
  "/photo2.rgb565",
  "/photo3.rgb565"
};
static const char* IMAGE_TMP_FILE = "/screen.tmp";
static const uint32_t IMAGE_PIXELS = (uint32_t)TFT_W * (uint32_t)TFT_H;
static const uint32_t IMAGE_BYTES = IMAGE_PIXELS * 2UL;
static const uint16_t IMAGE_BUFFER_ROWS = 64;
static const uint16_t IMAGE_BUFFER_PIXELS = TFT_W * IMAGE_BUFFER_ROWS; // 64 full rows, 30720 bytes.
uint16_t imageBuffer[IMAGE_BUFFER_PIXELS];
bool photoAvailable[PHOTO_SLOT_COUNT] = { false, false, false };

File imageUploadFile;
bool imageUploadError = false;
char imageUploadErrorText[80] = "";
uint32_t imageUploadOffset = 0;
uint32_t imageUploadTotal = 0;
uint32_t imageUploadReceived = 0;
uint8_t imageUploadSlot = 0;
bool imageUploadFinal = false;

const char* IMAGE_UPLOAD_HEADERS[] = {
  "X-Image-Offset",
  "X-Image-Total",
  "X-Image-First",
  "X-Image-Final",
  "X-Image-Slot"
};

// ---------- GAME FOCUS ----------
bool gameMode = false;
unsigned long lastGameActivity = 0;
static const unsigned long GAME_STALE_MS = 35000UL; // Fallback only; pagehide exits immediately.

// ---------- SENSOR / WIFI DATA ----------
float tempC = NAN;
float humPct = NAN;
int wifiRSSI = -127;
int wifiQualityPct = 0;
char wifiQualityText[16] = "Unknown";
char ipText[24] = "0.0.0.0";

unsigned long lastDHTRead = 0;
unsigned long lastWifiRead = 0;
unsigned long lastScreenTick = 0;

static const unsigned long DHT_INTERVAL_MS = 10000UL;
static const unsigned long WIFI_INTERVAL_MS = 10000UL;
static const unsigned long SCREEN_INTERVAL_MS = 1000UL;

// ---------- DASHBOARD FIELD CACHE ----------
char drawnTemp[24] = "";
char drawnHum[24] = "";
char drawnRSSI[24] = "";
char drawnQuality[24] = "";
char drawnUptime[32] = "";
char drawnHeap[24] = "";
char drawnIp[24] = "";

// ---------- CUSTOMIZABLE SCREEN ----------
char screenTitle[24] = "ESP32 SMART HUB";
char customTitle[24] = "CUSTOM SCREEN";
char customLine1[32] = "Manual screen";
char customLine2[32] = "Change this text";
char customLine3[32] = "from the app";

uint16_t dashboardBgColor = ST77XX_BLACK;
uint16_t dashboardTextColor = ST77XX_WHITE;
uint16_t dashboardAccentColor = ST77XX_GREEN;
uint16_t customBgColor = ST77XX_BLACK;
uint16_t customTextColor = ST77XX_WHITE;
uint16_t customAccentColor = ST77XX_GREEN;
static const char* SCREEN_CONFIG_FILE = "/screen.cfg";

// ---------- MATRIX ----------
byte matrixIcon[8] = {
  B00000000,
  B01100110,
  B11111111,
  B11111111,
  B11111111,
  B01111110,
  B00111100,
  B00011000
};

// ============================================================
// PROGMEM WEB PAGES
// ============================================================

const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ESP32 Smart Hub</title>
<style>
:root{color-scheme:dark;--bg:#101214;--panel:#1a1f23;--line:#2d363c;--text:#eef4f6;--muted:#9eadb5;--accent:#00c878;--blue:#36a3ff;--warn:#ffcc33;--bad:#ff4d5a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
header{position:sticky;top:0;z-index:2;background:#111619;border-bottom:1px solid var(--line);padding:12px 14px}
.bar{max-width:980px;margin:auto;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
h1{font-size:22px;margin:0}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a,.btn{appearance:none;border:1px solid var(--line);background:#222a2f;color:var(--text);border-radius:8px;padding:10px 12px;text-decoration:none;font-weight:650;cursor:pointer}.nav a:hover,.btn:hover{border-color:var(--accent)}
main{max-width:980px;margin:0 auto;padding:16px 14px 28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;min-height:112px}.label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.value{font-size:28px;font-weight:800;margin-top:8px;overflow-wrap:anywhere}.ok{color:var(--accent)}.blue{color:var(--blue)}.warn{color:var(--warn)}.bad{color:var(--bad)}
.wide{margin-top:12px;display:grid;grid-template-columns:2fr 1fr;gap:12px}.row{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding:11px 0}.row:first-child{border-top:0}.muted{color:var(--muted)}.pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:7px 10px;background:#111619}.dot{width:10px;height:10px;border-radius:50%;background:var(--accent)}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
@media(max-width:720px){.wide{grid-template-columns:1fr}.value{font-size:24px}.nav a,.btn{padding:9px 10px}}
</style></head><body>
<header><div class="bar"><h1>ESP32 Smart Hub</h1><nav class="nav">
<a href="/">Dashboard</a><a href="/screen">Screen</a><a href="/led">LED Strip</a><a href="/matrix-page">8x8 Matrix</a><a href="/image">Image Upload</a><a href="/games">Games</a>
</nav></div></header>
<main>
<section class="grid">
<div class="card"><div class="label">Temperature</div><div id="temp" class="value">--</div></div>
<div class="card"><div class="label">Humidity</div><div id="hum" class="value">--</div></div>
<div class="card"><div class="label">WiFi RSSI</div><div id="rssi" class="value">--</div></div>
<div class="card"><div class="label">WiFi Quality</div><div id="quality" class="value">--</div></div>
<div class="card"><div class="label">Uptime</div><div id="uptime" class="value">--</div></div>
<div class="card"><div class="label">Free RAM</div><div id="heap" class="value">--</div></div>
</section>
<section class="wide">
<div class="card">
<div class="row"><span class="muted">IP address</span><strong id="ip">--</strong></div>
<div class="row"><span class="muted">Screen mode</span><strong id="screen">--</strong></div>
<div class="row"><span class="muted">Uploaded image</span><strong id="imgState">--</strong></div>
<div class="row"><span class="muted">Game mode</span><span class="pill"><span id="gameDot" class="dot"></span><strong id="gameMode">--</strong></span></div>
<div class="actions">
<button class="btn" onclick="location.href='/screen/dashboard'">Show Dashboard</button>
<button class="btn" onclick="location.href='/screen/custom'">Show Custom</button>
<button class="btn" onclick="location.href='/screen/photo?slot=1'">Photo 1</button>
<button class="btn" onclick="location.href='/screen/photo?slot=2'">Photo 2</button>
<button class="btn" onclick="location.href='/screen/photo?slot=3'">Photo 3</button>
<button class="btn" onclick="location.href='/screen'">Customize</button>
<button class="btn" onclick="fetch('/beep')">Beep</button>
</div>
</div>
<div class="card">
<div class="label">LED Strip</div>
<div id="led" class="value ok">--</div>
<div class="muted" id="ledDetail">--</div>
<div class="actions"><button class="btn" onclick="quickLed(true)">On</button><button class="btn" onclick="quickLed(false)">Off</button></div>
</div>
</section>
</main>
<script>
const last={};
function setText(id,v){if(last[id]!==v){last[id]=v;document.getElementById(id).textContent=v;}}
function setClass(id,cls){const e=document.getElementById(id);if(e.dataset.cls!==cls){e.dataset.cls=cls;e.className=cls;}}
function fmt(n,s){return n===null||Number.isNaN(n)?'NO DATA':n.toFixed(1)+s;}
async function refresh(){
  if(document.hidden)return;
  const r=await fetch('/api/status',{cache:'no-store'}).catch(()=>null); if(!r||!r.ok)return;
  const s=await r.json();
  setText('temp',fmt(s.temperature,' C'));
  setText('hum',fmt(s.humidity,' %'));
  setText('rssi',s.wifi_rssi+' dBm');
  setText('quality',s.wifi_quality+' ('+s.wifi_quality_pct+'%)');
  setText('uptime',s.uptime);
  setText('heap',s.free_heap_kb+' KB');
  setText('ip',s.ip);
  setText('screen',s.screen_mode);
  setText('imgState','1 '+(s.photo1_available?'ready':'empty')+' | 2 '+(s.photo2_available?'ready':'empty')+' | 3 '+(s.photo3_available?'ready':'empty'));
  setText('gameMode',s.game_mode?'Paused':'Normal');
  setText('led',s.led_on?'ON':'OFF');
  setText('ledDetail',s.led_color+' at '+s.led_brightness+'/255');
  setClass('temp',s.temperature===null?'value bad':(s.temperature>=35?'value bad':s.temperature>=30?'value warn':'value ok'));
  setClass('hum',s.humidity===null?'value bad':'value blue');
  setClass('quality',s.wifi_quality_pct<35?'value bad':s.wifi_quality_pct<60?'value warn':'value ok');
  document.getElementById('gameDot').style.background=s.game_mode?'#ffcc33':'#00c878';
}
async function quickLed(on){await fetch(on?'/led/on':'/led/off');refresh();}
refresh();setInterval(refresh,1000);
</script></body></html>
)rawliteral";

const char LED_HTML[] PROGMEM = R"rawliteral(
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LED Strip</title>
<style>
:root{color-scheme:dark;--bg:#101214;--panel:#1a1f23;--line:#2d363c;--text:#eef4f6;--muted:#9eadb5;--accent:#00c878}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}main{max-width:720px;margin:auto;padding:16px}
a,.btn{border:1px solid var(--line);background:#222a2f;color:var(--text);border-radius:8px;padding:10px 12px;text-decoration:none;font-weight:650;cursor:pointer}.top{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}.preview{height:90px;border-radius:8px;border:1px solid var(--line);background:#00ff88;margin:12px 0}
label{display:block;margin:14px 0 6px;color:var(--muted)}input[type=color]{width:100%;height:64px;border:0;background:none}input[type=text],input[type=range]{width:100%;font:inherit}input[type=text]{padding:12px;border:1px solid var(--line);border-radius:8px;background:#111619;color:var(--text);font-size:20px;text-align:center;text-transform:uppercase}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.muted{color:var(--muted)}
</style></head><body><main>
<div class="top"><a href="/">Dashboard</a><a href="/screen">Screen</a><a href="/matrix-page">8x8 Matrix</a><a href="/image">Image Upload</a><a href="/games">Games</a></div>
<section class="card">
<h1>LED Strip</h1>
<div id="preview" class="preview"></div>
<label>Color wheel</label><input id="color" type="color" value="#00ff88">
<label>Custom HEX color</label><input id="hex" type="text" maxlength="7" value="#00FF88" placeholder="#DF1520">
<p class="muted">Examples: #DF1520, #FF0000, #00FF88, #0066FF</p>
<label>Brightness: <strong id="bt">120</strong> / 255</label><input id="brightness" type="range" min="0" max="255" value="120">
<div class="actions"><button class="btn" onclick="power(1)">On</button><button class="btn" onclick="power(0)">Off</button><button class="btn" onclick="send()">Apply</button></div>
<p class="muted" id="state">Loading...</p>
</section>
</main><script>
let timer=null;
function clean(v){v=v.trim().toUpperCase();if(!v.startsWith('#'))v='#'+v;return /^#[0-9A-F]{6}$/.test(v)?v:null;}
function syncPreview(){let h=clean(hex.value)||color.value.toUpperCase();preview.style.background=h;color.value=h.toLowerCase();hex.value=h;bt.textContent=brightness.value;}
async function load(){const r=await fetch('/led/status',{cache:'no-store'});const s=await r.json();hex.value=s.color;color.value=s.color.toLowerCase();brightness.value=s.brightness;state.textContent=s.on?'ON':'OFF';syncPreview();}
async function send(){const h=clean(hex.value);if(!h){state.textContent='Bad HEX format';return;}syncPreview();await fetch('/led/set?color='+h.slice(1)+'&brightness='+brightness.value);state.textContent='ON';}
function queue(){clearTimeout(timer);syncPreview();timer=setTimeout(send,90);}
async function power(on){await fetch(on?'/led/on':'/led/off');state.textContent=on?'ON':'OFF';}
color.addEventListener('input',()=>{hex.value=color.value.toUpperCase();queue();});
hex.addEventListener('input',queue);brightness.addEventListener('input',queue);load();
</script></body></html>
)rawliteral";

const char MATRIX_HTML[] PROGMEM = R"rawliteral(
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>8x8 Matrix</title>
<style>
:root{color-scheme:dark;--bg:#101214;--panel:#1a1f23;--line:#2d363c;--text:#eef4f6;--muted:#9eadb5;--accent:#00c878}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}main{max-width:720px;margin:auto;padding:16px}
a,.btn{border:1px solid var(--line);background:#222a2f;color:var(--text);border-radius:8px;padding:10px 12px;text-decoration:none;font-weight:650;cursor:pointer}.top,.actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}.grid{display:grid;grid-template-columns:repeat(8,minmax(30px,44px));gap:6px;justify-content:center;margin:16px 0}.pix{aspect-ratio:1;border:1px solid #303a40;background:#101214;border-radius:6px}.pix.on{background:var(--accent);box-shadow:0 0 12px #00c87899}.muted{color:var(--muted)}
</style></head><body><main>
<div class="top"><a href="/">Dashboard</a><a href="/screen">Screen</a><a href="/led">LED Strip</a><a href="/image">Image Upload</a><a href="/games">Games</a></div>
<section class="card">
<h1>8x8 Matrix Editor</h1>
<div id="grid" class="grid"></div>
<div class="actions"><button class="btn" onclick="clearGrid()">Clear</button><button class="btn" onclick="heart()">Heart</button><button class="btn" onclick="smile()">Smile</button><button class="btn" onclick="sendMatrix()">Send to Matrix</button></div>
<p class="muted" id="state">Tap pixels to draw.</p>
</section>
</main><script>
let pixels=Array(64).fill(0),drag=0,paint=1;
function draw(){grid.innerHTML='';pixels.forEach((v,i)=>{const d=document.createElement('button');d.className='pix'+(v?' on':'');d.ariaLabel='pixel '+i;d.onpointerdown=e=>{drag=1;paint=pixels[i]?0:1;pixels[i]=paint;draw();};d.onpointerenter=e=>{if(drag){pixels[i]=paint;draw();}};grid.appendChild(d);});}
document.addEventListener('pointerup',()=>drag=0);
function clearGrid(){pixels=Array(64).fill(0);draw();}
function rows(a){pixels=[];a.forEach(r=>{for(const c of r)pixels.push(c==='1'?1:0)});draw();}
function heart(){rows(['00000000','01100110','11111111','11111111','11111111','01111110','00111100','00011000']);}
function smile(){rows(['00111100','01000010','10100101','10000001','10100101','10011001','01000010','00111100']);}
async function sendMatrix(){let b=[];for(let r=0;r<8;r++){let v=0;for(let c=0;c<8;c++)if(pixels[r*8+c])v|=1<<(7-c);b.push(v);}const data=b.map(x=>x.toString(16).padStart(2,'0')).join('');const r=await fetch('/matrix?data='+data);state.textContent=r.ok?'Matrix updated':'Matrix update failed';}
draw();
</script></body></html>
)rawliteral";

const char IMAGE_HTML[] PROGMEM = R"rawliteral(
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Image Upload</title>
<style>
:root{color-scheme:dark;--bg:#101214;--panel:#1a1f23;--line:#2d363c;--text:#eef4f6;--muted:#9eadb5;--accent:#00c878;--bad:#ff4d5a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}main{max-width:780px;margin:auto;padding:16px}
a,.btn{border:1px solid var(--line);background:#222a2f;color:var(--text);border-radius:8px;padding:10px 12px;text-decoration:none;font-weight:650;cursor:pointer}.top,.actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}.muted{color:var(--muted)}input[type=file]{display:block;width:100%;border:1px dashed var(--line);border-radius:8px;padding:18px;background:#111619}select{width:100%;padding:12px;border:1px solid var(--line);border-radius:8px;background:#111619;color:var(--text);font:inherit}.wrap{display:grid;grid-template-columns:240px 1fr;gap:16px;align-items:start}canvas{width:240px;height:320px;border:1px solid var(--line);background:#050607;border-radius:8px}progress{width:100%;height:18px}.bad{color:var(--bad)}
@media(max-width:620px){.wrap{grid-template-columns:1fr}canvas{max-width:100%;height:auto}}
</style></head><body><main>
<div class="top"><a href="/">Dashboard</a><a href="/screen">Screen</a><a href="/led">LED Strip</a><a href="/matrix-page">8x8 Matrix</a><a href="/games">Games</a></div>
<section class="card">
<h1>Image Upload</h1>
<div class="wrap">
<canvas id="cv" width="240" height="320"></canvas>
<div>
<input id="file" type="file" accept="image/*">
<label class="muted" for="slot">Photo slot</label>
<select id="slot"><option value="1">Photo 1</option><option value="2">Photo 2</option><option value="3">Photo 3</option></select>
<p class="muted">The browser resizes the image to 240x320 before upload. The ESP32 stores a ready-to-draw RGB565 frame.</p>
<progress id="bar" max="100" value="0"></progress>
<p id="state" class="muted">Choose an image.</p>
<div class="actions"><button class="btn" onclick="upload()">Upload Image</button><button class="btn" onclick="showSlot()">Show Selected Photo</button><button class="btn" onclick="location.href='/screen/dashboard'">Show Dashboard</button><button class="btn" onclick="location.href='/screen'">Customize Screen</button></div>
</div></div>
</section>
</main><script>
const W=240,H=320,CHUNK=8192;let rgb565=null;
const ctx=cv.getContext('2d',{willReadFrequently:true});
function cover(img){const s=Math.max(W/img.width,H/img.height),sw=W/s,sh=H/s,sx=(img.width-sw)/2,sy=(img.height-sh)/2;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);}
function convert(){const d=ctx.getImageData(0,0,W,H).data;const out=new Uint8Array(W*H*2);let j=0;for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];const v=((r&248)<<8)|((g&252)<<3)|(b>>3);out[j++]=v>>8;out[j++]=v&255;}rgb565=out;state.textContent='Ready: '+out.length+' bytes';bar.value=0;}
file.addEventListener('change',()=>{const f=file.files[0];if(!f)return;const img=new Image();img.onload=()=>{cover(img);URL.revokeObjectURL(img.src);convert();};img.src=URL.createObjectURL(f);});
function showSlot(){location.href='/screen/photo?slot='+slot.value;}
async function uploadChunk(chunk,offset,first,final){const r=await fetch('/image/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Image-Offset':String(offset),'X-Image-Total':String(rgb565.length),'X-Image-First':first?'1':'0','X-Image-Final':final?'1':'0','X-Image-Slot':slot.value},body:chunk});if(!r.ok)throw new Error(await r.text());return r.text();}
async function upload(){
 if(!rgb565){state.innerHTML='<span class="bad">Choose an image first.</span>';return;}
 state.textContent='Uploading...';bar.value=0;
 try{
  for(let o=0;o<rgb565.length;o+=CHUNK){const e=Math.min(o+CHUNK,rgb565.length);await uploadChunk(rgb565.subarray(o,e),o,o===0,e===rgb565.length);bar.value=Math.round(e*100/rgb565.length);}
  state.textContent='Uploaded to Photo '+slot.value+'. Use Show Selected Photo when you want it on the ST7789.';
 }catch(err){state.innerHTML='<span class="bad">'+err.message+'</span>';}
}
</script></body></html>
)rawliteral";

const char SCREEN_HTML[] PROGMEM = R"rawliteral(
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Screen Control</title>
<style>
:root{color-scheme:dark;--bg:#101214;--panel:#1a1f23;--line:#2d363c;--text:#eef4f6;--muted:#9eadb5;--accent:#00c878;--bad:#ff4d5a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}main{max-width:880px;margin:auto;padding:16px}
a,.btn{border:1px solid var(--line);background:#222a2f;color:var(--text);border-radius:8px;padding:10px 12px;text-decoration:none;font-weight:650;cursor:pointer}.top,.actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.muted{color:var(--muted)}label{display:block;margin:10px 0 5px;color:var(--muted)}input[type=text]{width:100%;padding:11px;border:1px solid var(--line);border-radius:8px;background:#111619;color:var(--text);font:inherit}input[type=color]{width:100%;height:46px;border:0;background:none}.row{display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding:10px 0}.row:first-child{border-top:0}.pill{border:1px solid var(--line);border-radius:999px;padding:5px 9px;background:#111619}.bad{color:var(--bad)}
</style></head><body><main>
<div class="top"><a href="/">Dashboard</a><a href="/led">LED Strip</a><a href="/matrix-page">8x8 Matrix</a><a href="/image">Image Upload</a><a href="/games">Games</a></div>
<section class="card">
<h1>Screen Control</h1>
<div class="row"><span class="muted">Current ST7789 screen</span><strong id="mode">--</strong></div>
<div class="row"><span class="muted">Photo slots</span><span id="photos" class="pill">--</span></div>
<div class="actions">
<button class="btn" onclick="location.href='/screen/dashboard'">Dashboard</button>
<button class="btn" onclick="location.href='/screen/custom'">Custom</button>
<button class="btn" onclick="location.href='/screen/photo?slot=1'">Photo 1</button>
<button class="btn" onclick="location.href='/screen/photo?slot=2'">Photo 2</button>
<button class="btn" onclick="location.href='/screen/photo?slot=3'">Photo 3</button>
</div>
<p class="muted">Screen changes are manual only. Nothing auto-rotates.</p>
</section>
<section class="card">
<h2>Customize Dashboard</h2>
<label>Dashboard title</label><input id="screenTitle" type="text" maxlength="23">
<div class="grid">
<div><label>Background</label><input id="dashBg" type="color"></div>
<div><label>Text</label><input id="dashText" type="color"></div>
<div><label>Accent</label><input id="dashAccent" type="color"></div>
</div>
</section>
<section class="card">
<h2>Customize Custom Screen</h2>
<label>Custom title</label><input id="customTitle" type="text" maxlength="23">
<label>Line 1</label><input id="line1" type="text" maxlength="31">
<label>Line 2</label><input id="line2" type="text" maxlength="31">
<label>Line 3</label><input id="line3" type="text" maxlength="31">
<div class="grid">
<div><label>Background</label><input id="customBg" type="color"></div>
<div><label>Text</label><input id="customText" type="color"></div>
<div><label>Accent</label><input id="customAccent" type="color"></div>
</div>
<div class="actions"><button class="btn" onclick="save()">Save Customization</button><button class="btn" onclick="save(1)">Save + Show Custom</button></div>
<p id="state" class="muted">Loading...</p>
</section>
</main><script>
const ids=['screenTitle','dashBg','dashText','dashAccent','customTitle','line1','line2','line3','customBg','customText','customAccent'];
async function load(){
 const s=await fetch('/api/status',{cache:'no-store'}).then(r=>r.json());
 const c=await fetch('/api/screen-config',{cache:'no-store'}).then(r=>r.json());
 mode.textContent=s.screen_mode;
 photos.textContent='1 '+(s.photo1_available?'ready':'empty')+' | 2 '+(s.photo2_available?'ready':'empty')+' | 3 '+(s.photo3_available?'ready':'empty');
 screenTitle.value=c.screen_title;dashBg.value=c.dashboard_bg;dashText.value=c.dashboard_text;dashAccent.value=c.dashboard_accent;
 customTitle.value=c.custom_title;line1.value=c.custom_line1;line2.value=c.custom_line2;line3.value=c.custom_line3;customBg.value=c.custom_bg;customText.value=c.custom_text;customAccent.value=c.custom_accent;
 state.textContent='Ready.';
}
async function save(show){
 const p=new URLSearchParams();
 p.set('screen_title',screenTitle.value);p.set('dash_bg',dashBg.value);p.set('dash_text',dashText.value);p.set('dash_accent',dashAccent.value);
 p.set('custom_title',customTitle.value);p.set('line1',line1.value);p.set('line2',line2.value);p.set('line3',line3.value);
 p.set('custom_bg',customBg.value);p.set('custom_text',customText.value);p.set('custom_accent',customAccent.value);p.set('show',show?'1':'0');
 const r=await fetch('/screen/customize?'+p.toString(),{cache:'no-store'});
 state.textContent=r.ok?'Saved.':'Save failed.';
 if(show&&r.ok)location.href='/screen/custom';
}
load();
</script></body></html>
)rawliteral";

const char GAMES_HTML[] PROGMEM = R"rawliteral(
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ESP32 Games</title>
<style>
:root{color-scheme:dark;--bg:#101214;--panel:#1a1f23;--line:#2d363c;--text:#eef4f6;--muted:#9eadb5;--accent:#00c878;--bad:#ff4d5a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}main{max-width:820px;margin:auto;padding:16px}
a,.btn{border:1px solid var(--line);background:#222a2f;color:var(--text);border-radius:8px;padding:10px 12px;text-decoration:none;font-weight:650;cursor:pointer}.top,.tabs,.actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:12px}.hidden{display:none}.muted{color:var(--muted)}canvas{max-width:100%;background:#050607;border:1px solid var(--line);border-radius:8px;touch-action:none}.xo{display:grid;grid-template-columns:repeat(3,84px);gap:8px;justify-content:center}.cell{width:84px;height:84px;border:1px solid var(--line);border-radius:8px;background:#111619;color:var(--text);font-size:42px;font-weight:800}.mem{font-size:34px;font-weight:800;letter-spacing:.18em}input{padding:12px;border-radius:8px;border:1px solid var(--line);background:#111619;color:var(--text);font:inherit}
</style></head><body><main>
<div class="top"><a href="/" onclick="exitGames()">Dashboard</a><a href="/screen" onclick="exitGames()">Screen</a><a href="/led" onclick="exitGames()">LED Strip</a><a href="/matrix-page" onclick="exitGames()">8x8 Matrix</a><a href="/image" onclick="exitGames()">Image Upload</a></div>
<section class="card"><h1>Games</h1><p class="muted">Games run in the browser only. Opening this page pauses dashboard screen updates; leaving resumes them immediately.</p>
<div class="tabs"><button class="btn" onclick="show('xo')">Tic Tac Toe</button><button class="btn" onclick="show('snake')">Snake</button><button class="btn" onclick="show('pong')">Pong</button><button class="btn" onclick="show('reaction')">Reaction Test</button><button class="btn" onclick="show('memory')">Memory Game</button><button class="btn" onclick="exitGames();location.href='/exit-games'">Back + Resume</button></div></section>
<section id="xo" class="card"><h2>Tic Tac Toe</h2><div class="actions"><button class="btn" onclick="xoMode='ai';xoReset()">Vs AI</button><button class="btn" onclick="xoMode='pvp';xoReset()">2 Player</button></div><p id="xoStatus"></p><div id="xoGrid" class="xo"></div></section>
<section id="snake" class="card hidden"><h2>Snake</h2><canvas id="snakeCanvas" width="300" height="300"></canvas><p id="snakeScore">Score: 0</p><div class="actions"><button class="btn" onclick="snakeStart()">Start</button><button class="btn" onclick="snakeDir(0,-1)">Up</button><button class="btn" onclick="snakeDir(-1,0)">Left</button><button class="btn" onclick="snakeDir(1,0)">Right</button><button class="btn" onclick="snakeDir(0,1)">Down</button></div></section>
<section id="pong" class="card hidden"><h2>Pong</h2><div class="actions"><button class="btn" onclick="pongMode='ai';pongStart()">Vs AI</button><button class="btn" onclick="pongMode='pvp';pongStart()">2 Player</button></div><canvas id="pongCanvas" width="360" height="240"></canvas><p id="pongScore">0 : 0</p><p class="muted">Keyboard: W/S for left, Up/Down for right.</p><div class="actions"><button class="btn" onpointerdown="p1=-1" onpointerup="p1=0">P1 Up</button><button class="btn" onpointerdown="p1=1" onpointerup="p1=0">P1 Down</button><button class="btn" onpointerdown="p2=-1" onpointerup="p2=0">P2 Up</button><button class="btn" onpointerdown="p2=1" onpointerup="p2=0">P2 Down</button></div></section>
<section id="reaction" class="card hidden"><h2>Reaction Test</h2><p id="reactText">Press Start. Tap when it turns green.</p><button id="reactBtn" class="btn" onclick="reactionClick()">Start</button></section>
<section id="memory" class="card hidden"><h2>Memory Game</h2><p id="memSeq" class="mem">Start</p><input id="memInput" inputmode="numeric" placeholder="Type sequence"><div class="actions"><button class="btn" onclick="memoryStart()">Start</button><button class="btn" onclick="memoryCheck()">Check</button></div><p id="memStatus"></p></section>
</main><script>
function ping(){fetch('/game-ping').catch(()=>{});}setInterval(ping,10000);['click','keydown','touchstart','pointerdown'].forEach(e=>document.addEventListener(e,ping,{passive:true}));
function exitGames(){try{navigator.sendBeacon('/exit-games')}catch(e){}try{fetch('/exit-games',{keepalive:true}).catch(()=>{})}catch(e){}}
window.addEventListener('pagehide',exitGames);window.addEventListener('beforeunload',exitGames);document.addEventListener('visibilitychange',()=>{if(document.hidden)exitGames();else ping();});
function show(id){['xo','snake','pong','reaction','memory'].forEach(x=>document.getElementById(x).classList.add('hidden'));document.getElementById(id).classList.remove('hidden');ping();}
let xoBoard,xoTurn,xoMode='ai';function xoReset(){xoBoard=Array(9).fill('');xoTurn='X';xoDraw()}function xoWin(b){for(const a of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])if(b[a[0]]&&b[a[0]]===b[a[1]]&&b[a[1]]===b[a[2]])return b[a[0]];return b.every(Boolean)?'Draw':null}
function xoDraw(){xoGrid.innerHTML='';xoBoard.forEach((v,i)=>{const d=document.createElement('button');d.className='cell';d.textContent=v;d.onclick=()=>xoMove(i);xoGrid.appendChild(d)});const r=xoWin(xoBoard);xoStatus.textContent=r?'Result: '+r:'Turn: '+xoTurn+' | '+(xoMode==='ai'?'Vs AI':'2 Player')}
function xoMove(i){if(xoBoard[i]||xoWin(xoBoard))return;xoBoard[i]=xoTurn;if(xoMode==='ai'){if(!xoWin(xoBoard))xoAi()}else xoTurn=xoTurn==='X'?'O':'X';xoDraw()}
function xoAi(){let bi=-1,bs=-999;for(let i=0;i<9;i++)if(!xoBoard[i]){xoBoard[i]='O';const s=mini(false);xoBoard[i]='';if(s>bs){bs=s;bi=i}}if(bi>=0)xoBoard[bi]='O';xoTurn='X'}function mini(max){const r=xoWin(xoBoard);if(r==='O')return 10;if(r==='X')return-10;if(r==='Draw')return 0;let best=max?-999:999;for(let i=0;i<9;i++)if(!xoBoard[i]){xoBoard[i]=max?'O':'X';best=max?Math.max(best,mini(false)):Math.min(best,mini(true));xoBoard[i]=''}return best}xoReset();
const sc=snakeCanvas,sx=sc.getContext('2d');let snake,food,sdx=1,sdy=0,ndx=1,ndy=0,sTimer=null,sScore=0;
function snakeDraw(msg=''){sx.fillStyle='#050607';sx.fillRect(0,0,300,300);sx.strokeStyle='#1d252a';for(let i=0;i<=15;i++){sx.beginPath();sx.moveTo(i*20,0);sx.lineTo(i*20,300);sx.stroke();sx.beginPath();sx.moveTo(0,i*20);sx.lineTo(300,i*20);sx.stroke()}sx.fillStyle='#ff4d5a';sx.fillRect(food.x*20+2,food.y*20+2,16,16);snake.forEach((p,i)=>{sx.fillStyle=i?'#6dff6d':'#00c878';sx.fillRect(p.x*20+2,p.y*20+2,16,16)});if(msg){sx.fillStyle='#fff';sx.font='22px Arial';sx.textAlign='center';sx.fillText(msg,150,150)}snakeScore.textContent='Score: '+sScore}
function snakeStart(){snake=[{x:7,y:7},{x:6,y:7},{x:5,y:7}];food={x:12,y:12};sdx=1;sdy=0;ndx=1;ndy=0;sScore=0;clearInterval(sTimer);snakeDraw();sTimer=setInterval(snakeTick,170)}
function snakeDir(x,y){if(snake.length>1&&x===-sdx&&y===-sdy)return;ndx=x;ndy=y;ping()}function snakeTick(){sdx=ndx;sdy=ndy;const h={x:snake[0].x+sdx,y:snake[0].y+sdy};if(h.x<0||h.y<0||h.x>=15||h.y>=15||snake.some(p=>p.x===h.x&&p.y===h.y)){clearInterval(sTimer);snakeDraw('GAME OVER');return}snake.unshift(h);if(h.x===food.x&&h.y===food.y){sScore++;do{food={x:Math.floor(Math.random()*15),y:Math.floor(Math.random()*15)}}while(snake.some(p=>p.x===food.x&&p.y===food.y))}else snake.pop();snakeDraw()}snake=[{x:7,y:7}];food={x:12,y:12};snakeDraw('Press Start');
let tx=0,ty=0;sc.addEventListener('touchstart',e=>{const t=e.changedTouches[0];tx=t.clientX;ty=t.clientY;e.preventDefault()},{passive:false});sc.addEventListener('touchend',e=>{const t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty;if(Math.abs(dx)>Math.abs(dy)){if(dx>20)snakeDir(1,0);if(dx<-20)snakeDir(-1,0)}else{if(dy>20)snakeDir(0,1);if(dy<-20)snakeDir(0,-1)}e.preventDefault()},{passive:false});
const pc=pongCanvas,px=pc.getContext('2d');let ball,lp=90,rp=90,p1=0,p2=0,ps1=0,ps2=0,pTimer=null,pongMode='ai';function pongStart(){ball={x:180,y:120,vx:3,vy:2};lp=90;rp=90;ps1=0;ps2=0;clearInterval(pTimer);pTimer=setInterval(pongTick,25)}function pongTick(){lp=Math.max(0,Math.min(180,lp+p1*5));rp=Math.max(0,Math.min(180,rp+p2*5));if(pongMode==='ai')rp=Math.max(0,Math.min(180,rp+(ball.y>rp+30?3:-3)));ball.x+=ball.vx;ball.y+=ball.vy;if(ball.y<5||ball.y>235)ball.vy*=-1;if(ball.x<24&&ball.y>lp&&ball.y<lp+60)ball.vx=Math.abs(ball.vx);if(ball.x>336&&ball.y>rp&&ball.y<rp+60)ball.vx=-Math.abs(ball.vx);if(ball.x<0){ps2++;ball={x:180,y:120,vx:3,vy:2}}if(ball.x>360){ps1++;ball={x:180,y:120,vx:-3,vy:2}}px.fillStyle='#050607';px.fillRect(0,0,360,240);px.fillStyle='#fff';px.fillRect(10,lp,8,60);px.fillRect(342,rp,8,60);px.fillRect(ball.x-5,ball.y-5,10,10);pongScore.textContent=ps1+' : '+ps2}
let reactState='idle',reactStart=0,reactTimer=null;function reactionClick(){if(reactState==='idle'){reactState='wait';reactText.textContent='Wait...';reactBtn.textContent='Wait';reactBtn.style.background='#222a2f';reactTimer=setTimeout(()=>{reactState='go';reactStart=performance.now();reactText.textContent='GO';reactBtn.textContent='TAP';reactBtn.style.background='#00c878'},1000+Math.random()*4000)}else if(reactState==='wait'){clearTimeout(reactTimer);reactState='idle';reactText.textContent='Too early. Press Start.';reactBtn.textContent='Start'}else{const ms=Math.round(performance.now()-reactStart);reactState='idle';reactText.textContent='Reaction: '+ms+' ms';reactBtn.textContent='Start';reactBtn.style.background='#222a2f'}}
let memLevel=3,memAnswer='';function memoryStart(){memAnswer='';for(let i=0;i<memLevel;i++)memAnswer+=Math.floor(Math.random()*10);memSeq.textContent=memAnswer;memInput.value='';memStatus.textContent='Memorize it.';setTimeout(()=>memSeq.textContent='Hidden',1500)}function memoryCheck(){if(memInput.value.trim()===memAnswer){memLevel++;memStatus.textContent='Correct. Level '+memLevel}else{memLevel=3;memStatus.textContent='Wrong. Restarted.'}}
document.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(!document.getElementById('snake').classList.contains('hidden')){if(e.key==='ArrowUp')snakeDir(0,-1);if(e.key==='ArrowDown')snakeDir(0,1);if(e.key==='ArrowLeft')snakeDir(-1,0);if(e.key==='ArrowRight')snakeDir(1,0)}if(!document.getElementById('pong').classList.contains('hidden')){if(e.key==='w'||e.key==='W')p1=-1;if(e.key==='s'||e.key==='S')p1=1;if(e.key==='ArrowUp')p2=-1;if(e.key==='ArrowDown')p2=1}});
document.addEventListener('keyup',e=>{if(e.key==='w'||e.key==='W'||e.key==='s'||e.key==='S')p1=0;if(e.key==='ArrowUp'||e.key==='ArrowDown')p2=0});
</script></body></html>
)rawliteral";

// ============================================================
// HELPERS
// ============================================================

void copyText(char* dest, size_t destSize, const char* src) {
  if (destSize == 0) return;
  strncpy(dest, src, destSize - 1);
  dest[destSize - 1] = '\0';
}

void formatUptime(char* out, size_t outSize) {
  unsigned long s = millis() / 1000UL;
  unsigned int d = s / 86400UL;
  unsigned int h = (s % 86400UL) / 3600UL;
  unsigned int m = (s % 3600UL) / 60UL;
  unsigned int sec = s % 60UL;

  if (d > 0) {
    snprintf(out, outSize, "%ud %uh %um %us", d, h, m, sec);
  } else {
    snprintf(out, outSize, "%uh %um %us", h, m, sec);
  }
}

void formatUptimeScreen(char* out, size_t outSize) {
  unsigned long s = millis() / 1000UL;
  unsigned int d = s / 86400UL;
  unsigned int h = (s % 86400UL) / 3600UL;
  unsigned int m = (s % 3600UL) / 60UL;

  if (d > 0) {
    snprintf(out, outSize, "%ud %uh %um", d, h, m);
  } else {
    snprintf(out, outSize, "%uh %um", h, m);
  }
}

int wifiPercentFromRSSI(int rssi) {
  if (rssi <= -100) return 0;
  if (rssi >= -50) return 100;
  return 2 * (rssi + 100);
}

void wifiQualityLabel(int pct, char* out, size_t outSize) {
  if (pct >= 90) copyText(out, outSize, "Excellent");
  else if (pct >= 75) copyText(out, outSize, "Very Good");
  else if (pct >= 55) copyText(out, outSize, "Good");
  else if (pct >= 35) copyText(out, outSize, "Weak");
  else copyText(out, outSize, "Bad");
}

void currentIpToText() {
  IPAddress ip = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP() : WiFi.softAPIP();
  snprintf(ipText, sizeof(ipText), "%u.%u.%u.%u", ip[0], ip[1], ip[2], ip[3]);
}

bool isGoodHexChar(char c) {
  return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}

uint8_t hexPairToByte(const char* p) {
  char tmp[3] = { p[0], p[1], 0 };
  return (uint8_t)strtoul(tmp, NULL, 16);
}

void ledHexColor(char* out, size_t outSize) {
  snprintf(out, outSize, "#%02X%02X%02X", ledR, ledG, ledB);
}

uint16_t rgb888To565(uint8_t r, uint8_t g, uint8_t b) {
  return ((uint16_t)(r & 0xF8) << 8) | ((uint16_t)(g & 0xFC) << 3) | (b >> 3);
}

uint16_t parseHexColor565(String hex, uint16_t fallback) {
  hex.trim();
  if (hex.startsWith("#")) hex.remove(0, 1);
  if (hex.length() != 6) return fallback;
  for (uint8_t i = 0; i < 6; i++) {
    if (!isGoodHexChar(hex[i])) return fallback;
  }

  char raw[7];
  hex.toCharArray(raw, sizeof(raw));
  return rgb888To565(hexPairToByte(raw), hexPairToByte(raw + 2), hexPairToByte(raw + 4));
}

void color565ToHex(uint16_t color, char* out, size_t outSize) {
  uint8_t r5 = (color >> 11) & 0x1F;
  uint8_t g6 = (color >> 5) & 0x3F;
  uint8_t b5 = color & 0x1F;
  uint8_t r = (r5 * 255U) / 31U;
  uint8_t g = (g6 * 255U) / 63U;
  uint8_t b = (b5 * 255U) / 31U;
  snprintf(out, outSize, "#%02X%02X%02X", r, g, b);
}

void copyCleanText(char* dest, size_t destSize, const String& src, const char* fallback) {
  if (destSize == 0) return;
  size_t j = 0;
  for (size_t i = 0; i < src.length() && j < destSize - 1; i++) {
    char c = src[i];
    if (c >= 32 && c <= 126 && c != '"' && c != '\\' && c != '<' && c != '>') {
      dest[j++] = c;
    } else if (c == '\t') {
      dest[j++] = ' ';
    }
  }
  dest[j] = '\0';
  if (dest[0] == '\0' && fallback) copyText(dest, destSize, fallback);
}

const char* photoFileForSlot(uint8_t slot) {
  if (slot >= PHOTO_SLOT_COUNT) slot = 0;
  return PHOTO_FILES[slot];
}

void refreshPhotoAvailability() {
  for (uint8_t i = 0; i < PHOTO_SLOT_COUNT; i++) {
    File f = LittleFS.open(photoFileForSlot(i), "r");
    photoAvailable[i] = f && f.size() == IMAGE_BYTES;
    if (f) f.close();
  }
  imageAvailable = photoAvailable[0] || photoAvailable[1] || photoAvailable[2];
}

void screenModeText(char* out, size_t outSize) {
  if (currentScreen == SCREEN_DASHBOARD) copyText(out, outSize, "Dashboard");
  else if (currentScreen == SCREEN_CUSTOM) copyText(out, outSize, "Custom");
  else snprintf(out, outSize, "Photo %u", (unsigned int)(currentPhotoSlot + 1));
}

void writeConfigTextLine(File& f, const char* text) {
  f.println(text);
}

void writeConfigColorLine(File& f, uint16_t color) {
  char hex[8];
  color565ToHex(color, hex, sizeof(hex));
  f.println(hex);
}

void saveScreenConfig() {
  File f = LittleFS.open(SCREEN_CONFIG_FILE, "w");
  if (!f) return;

  writeConfigTextLine(f, screenTitle);
  writeConfigTextLine(f, customTitle);
  writeConfigTextLine(f, customLine1);
  writeConfigTextLine(f, customLine2);
  writeConfigTextLine(f, customLine3);
  writeConfigColorLine(f, dashboardBgColor);
  writeConfigColorLine(f, dashboardTextColor);
  writeConfigColorLine(f, dashboardAccentColor);
  writeConfigColorLine(f, customBgColor);
  writeConfigColorLine(f, customTextColor);
  writeConfigColorLine(f, customAccentColor);
  f.close();
}

bool readConfigLine(File& f, String& out) {
  if (!f.available()) return false;
  out = f.readStringUntil('\n');
  out.trim();
  return true;
}

void loadScreenConfig() {
  File f = LittleFS.open(SCREEN_CONFIG_FILE, "r");
  if (!f) return;

  String line;
  if (readConfigLine(f, line)) copyCleanText(screenTitle, sizeof(screenTitle), line, "ESP32 SMART HUB");
  if (readConfigLine(f, line)) copyCleanText(customTitle, sizeof(customTitle), line, "CUSTOM SCREEN");
  if (readConfigLine(f, line)) copyCleanText(customLine1, sizeof(customLine1), line, "Manual screen");
  if (readConfigLine(f, line)) copyCleanText(customLine2, sizeof(customLine2), line, "Change this text");
  if (readConfigLine(f, line)) copyCleanText(customLine3, sizeof(customLine3), line, "from the app");
  if (readConfigLine(f, line)) dashboardBgColor = parseHexColor565(line, dashboardBgColor);
  if (readConfigLine(f, line)) dashboardTextColor = parseHexColor565(line, dashboardTextColor);
  if (readConfigLine(f, line)) dashboardAccentColor = parseHexColor565(line, dashboardAccentColor);
  if (readConfigLine(f, line)) customBgColor = parseHexColor565(line, customBgColor);
  if (readConfigLine(f, line)) customTextColor = parseHexColor565(line, customTextColor);
  if (readConfigLine(f, line)) customAccentColor = parseHexColor565(line, customAccentColor);
  f.close();
}

uint16_t colorForTemp() {
  if (isnan(tempC)) return ST77XX_RED;
  if (tempC >= 35.0f) return ST77XX_RED;
  if (tempC >= 30.0f) return ST77XX_YELLOW;
  return ST77XX_GREEN;
}

uint16_t colorForWifi() {
  if (wifiQualityPct < 35) return ST77XX_RED;
  if (wifiQualityPct < 60) return ST77XX_YELLOW;
  return ST77XX_GREEN;
}

// ============================================================
// HARDWARE CONTROL
// ============================================================

void applyLedStrip() {
  strip.setBrightness(ledBrightness);
  uint32_t color = ledStripOn ? strip.Color(ledR, ledG, ledB) : strip.Color(0, 0, 0);
  for (uint16_t i = 0; i < LED_COUNT; i++) {
    strip.setPixelColor(i, color);
  }
  strip.show();
}

void showMatrix() {
  matrix.clear();
  for (uint8_t r = 0; r < 8; r++) {
    matrix.setRow(0, r, matrixIcon[r]);
  }
}

void setMatrixHeart() {
  byte icon[8] = {
    B00000000,
    B01100110,
    B11111111,
    B11111111,
    B11111111,
    B01111110,
    B00111100,
    B00011000
  };
  memcpy(matrixIcon, icon, sizeof(matrixIcon));
  showMatrix();
}

void updateDHT(bool force = false) {
  unsigned long now = millis();
  if (!force && now - lastDHTRead < DHT_INTERVAL_MS) return;
  lastDHTRead = now;

  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) tempC = t;
  if (!isnan(h)) humPct = h;
}

void updateWifiStats(bool force = false) {
  unsigned long now = millis();
  if (!force && now - lastWifiRead < WIFI_INTERVAL_MS) return;
  lastWifiRead = now;

  if (WiFi.status() == WL_CONNECTED) {
    wifiRSSI = WiFi.RSSI();
    wifiQualityPct = wifiPercentFromRSSI(wifiRSSI);
    wifiQualityLabel(wifiQualityPct, wifiQualityText, sizeof(wifiQualityText));
  } else {
    wifiRSSI = -127;
    wifiQualityPct = 0;
    copyText(wifiQualityText, sizeof(wifiQualityText), "Offline");
  }
  currentIpToText();
}

// ============================================================
// ST7789 RENDERING
// ============================================================

void drawBootScreen(const char* line) {
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(false);
  tft.setTextSize(2);
  tft.setTextColor(ST77XX_GREEN, ST77XX_BLACK);
  tft.setCursor(10, 20);
  tft.print("ESP32 SMART HUB");
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setCursor(10, 70);
  tft.print(line);
}

void runTftBootColorTest() {
  if (!TFT_BOOT_COLOR_TEST) return;

  tft.fillScreen(ST77XX_RED);
  delay(180);
  tft.fillScreen(ST77XX_GREEN);
  delay(180);
  tft.fillScreen(ST77XX_BLUE);
  delay(180);
  tft.fillScreen(ST77XX_BLACK);
}

void clearDashboardCache() {
  drawnTemp[0] = 0;
  drawnHum[0] = 0;
  drawnRSSI[0] = 0;
  drawnQuality[0] = 0;
  drawnUptime[0] = 0;
  drawnHeap[0] = 0;
  drawnIp[0] = 0;
}

void drawDashboardFrame() {
  currentScreen = SCREEN_DASHBOARD;
  clearDashboardCache();

  tft.fillScreen(dashboardBgColor);
  tft.setTextWrap(false);
  tft.setTextSize(strlen(screenTitle) > 18 ? 1 : 2);
  tft.setTextColor(dashboardAccentColor, dashboardBgColor);
  tft.setCursor(10, 10);
  tft.print(screenTitle);
  tft.drawFastHLine(0, 40, TFT_W, dashboardAccentColor);

  tft.setTextColor(dashboardTextColor, dashboardBgColor);
  tft.setCursor(10, 56);  tft.print("Temp");
  tft.setCursor(10, 91);  tft.print("Hum");
  tft.setCursor(10, 126); tft.print("RSSI");
  tft.setCursor(10, 161); tft.print("WiFi");
  tft.setCursor(10, 202); tft.print("Up");
  tft.setCursor(10, 237); tft.print("RAM");

  tft.setTextSize(1);
  tft.setTextColor(dashboardAccentColor, dashboardBgColor);
  tft.setCursor(10, 290);
  tft.print("IP");
}

void drawNoImageScreen(uint8_t slot) {
  currentPhotoSlot = slot;
  currentScreen = SCREEN_IMAGE;
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(false);
  tft.setTextSize(2);
  tft.setTextColor(ST77XX_YELLOW, ST77XX_BLACK);
  tft.setCursor(18, 96);
  tft.print("NO PHOTO ");
  tft.print((unsigned int)(slot + 1));
  tft.setCursor(18, 135);
  tft.print("UPLOADED");
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setCursor(18, 190);
  tft.print("Open /image and upload a photo.");
}

void drawNoImageScreen() {
  drawNoImageScreen(currentPhotoSlot);
}

void drawCustomScreen() {
  currentScreen = SCREEN_CUSTOM;
  tft.fillScreen(customBgColor);
  tft.setTextWrap(false);

  tft.setTextSize(strlen(customTitle) > 18 ? 1 : 2);
  tft.setTextColor(customAccentColor, customBgColor);
  tft.setCursor(10, 14);
  tft.print(customTitle);
  tft.drawFastHLine(0, 45, TFT_W, customAccentColor);

  tft.setTextColor(customTextColor, customBgColor);
  tft.setTextSize(strlen(customLine1) > 18 ? 1 : 2);
  tft.setCursor(12, 82);
  tft.print(customLine1);
  tft.setTextSize(strlen(customLine2) > 18 ? 1 : 2);
  tft.setCursor(12, 122);
  tft.print(customLine2);
  tft.setTextSize(strlen(customLine3) > 18 ? 1 : 2);
  tft.setCursor(12, 162);
  tft.print(customLine3);

  tft.setTextSize(1);
  tft.setTextColor(customAccentColor, customBgColor);
  tft.setCursor(12, 286);
  tft.print("Manual custom screen");
}

void drawField(char* cache, size_t cacheSize, const char* text, int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color, uint8_t size) {
  (void)h;
  if (strcmp(cache, text) == 0) return;
  copyText(cache, cacheSize, text);

  char padded[34];
  uint8_t maxChars = (uint8_t)(w / (6U * size));
  if (maxChars >= sizeof(padded)) maxChars = sizeof(padded) - 1;

  uint8_t i = 0;
  while (text[i] && i < maxChars) {
    padded[i] = text[i];
    i++;
  }
  while (i < maxChars) {
    padded[i++] = ' ';
  }
  padded[i] = '\0';

  tft.setTextSize(size);
  tft.setTextColor(color, dashboardBgColor);
  tft.setCursor(x, y);
  tft.print(padded);
}

void updateDashboardScreen(bool force = false) {
  if (currentScreen != SCREEN_DASHBOARD) return;
  unsigned long now = millis();
  if (!force && now - lastScreenTick < SCREEN_INTERVAL_MS) return;
  lastScreenTick = now;
  static unsigned long lastScreenHeapRead = 0;

  if (force) clearDashboardCache();

  char tempText[24];
  char humText[24];
  char rssiText[24];
  char heapText[24];
  char uptimeText[32];

  if (isnan(tempC)) snprintf(tempText, sizeof(tempText), "NO DATA");
  else snprintf(tempText, sizeof(tempText), "%.1f C", tempC);

  if (isnan(humPct)) snprintf(humText, sizeof(humText), "NO DATA");
  else snprintf(humText, sizeof(humText), "%.1f %%", humPct);

  snprintf(rssiText, sizeof(rssiText), "%d dBm", wifiRSSI);
  formatUptime(uptimeText, sizeof(uptimeText));

  drawField(drawnTemp, sizeof(drawnTemp), tempText, 86, 56, 150, 24, colorForTemp(), 2);
  drawField(drawnHum, sizeof(drawnHum), humText, 86, 91, 150, 24, isnan(humPct) ? ST77XX_RED : ST77XX_CYAN, 2);
  drawField(drawnRSSI, sizeof(drawnRSSI), rssiText, 86, 126, 150, 24, dashboardTextColor, 2);
  drawField(drawnQuality, sizeof(drawnQuality), wifiQualityText, 86, 161, 150, 24, colorForWifi(), 2);
  drawField(drawnUptime, sizeof(drawnUptime), uptimeText, 57, 205, 178, 17, dashboardTextColor, 1);
  if (force || now - lastScreenHeapRead >= 60000UL) {
    lastScreenHeapRead = now;
    unsigned int heapKb = (unsigned int)(ESP.getFreeHeap() / 1024U);
    heapKb = (heapKb / 16U) * 16U;
    snprintf(heapText, sizeof(heapText), "%u KB", heapKb);
    drawField(drawnHeap, sizeof(drawnHeap), heapText, 70, 237, 165, 24, ST77XX_GREEN, 2);
  }
  drawField(drawnIp, sizeof(drawnIp), ipText, 32, 290, 195, 12, dashboardAccentColor, 1);
}

bool renderPhotoSlot(uint8_t slot) {
  if (slot >= PHOTO_SLOT_COUNT) slot = 0;
  currentPhotoSlot = slot;
  const char* fileName = photoFileForSlot(slot);

  if (!LittleFS.exists(fileName)) {
    photoAvailable[slot] = false;
    imageAvailable = photoAvailable[0] || photoAvailable[1] || photoAvailable[2];
    drawNoImageScreen(slot);
    return false;
  }

  File f = LittleFS.open(fileName, "r");
  if (!f || f.size() != IMAGE_BYTES) {
    if (f) f.close();
    photoAvailable[slot] = false;
    imageAvailable = photoAvailable[0] || photoAvailable[1] || photoAvailable[2];
    drawNoImageScreen(slot);
    return false;
  }

  currentScreen = SCREEN_IMAGE;
  photoAvailable[slot] = true;
  imageAvailable = true;

  uint32_t renderStartMs = millis();
  tft.startWrite();
  tft.setAddrWindow(0, 0, TFT_W, TFT_H);

  uint32_t remaining = IMAGE_PIXELS;
  while (remaining > 0) {
    uint16_t pixelsNow = remaining > IMAGE_BUFFER_PIXELS ? IMAGE_BUFFER_PIXELS : remaining;
    size_t bytesNeeded = (size_t)pixelsNow * 2U;
    size_t bytesRead = f.read((uint8_t*)imageBuffer, bytesNeeded);
    if (bytesRead != bytesNeeded) {
      tft.endWrite();
      f.close();
      return false;
    }
    tft.writePixels(imageBuffer, pixelsNow, true, true);
    remaining -= pixelsNow;
    yield();
  }

  tft.endWrite();
  f.close();
  Serial.printf("Photo %u render: %lu ms\n", (unsigned int)(slot + 1), (unsigned long)(millis() - renderStartMs));
  return true;
}

// ============================================================
// HTTP RESPONSES
// ============================================================

void sendNoStore() {
  server.sendHeader("Cache-Control", "no-store, max-age=0");
}

void sendLedJson() {
  char color[8];
  char json[128];
  ledHexColor(color, sizeof(color));
  snprintf(json, sizeof(json),
           "{\"on\":%s,\"brightness\":%u,\"color\":\"%s\"}",
           ledStripOn ? "true" : "false",
           ledBrightness,
           color);
  sendNoStore();
  server.send(200, "application/json", json);
}

void handleRoot() {
  sendNoStore();
  server.send_P(200, "text/html", INDEX_HTML);
}

void handleLedPage() {
  sendNoStore();
  server.send_P(200, "text/html", LED_HTML);
}

void handleMatrixPage() {
  sendNoStore();
  server.send_P(200, "text/html", MATRIX_HTML);
}

void handleImagePage() {
  sendNoStore();
  server.send_P(200, "text/html", IMAGE_HTML);
}

void handleScreenPage() {
  sendNoStore();
  server.send_P(200, "text/html", SCREEN_HTML);
}

void handleGames() {
  gameMode = true;
  lastGameActivity = millis();
  sendNoStore();
  server.send_P(200, "text/html", GAMES_HTML);
}

void handleGamePing() {
  gameMode = true;
  lastGameActivity = millis();
  server.send(200, "text/plain", "OK");
}

void exitGameMode() {
  bool wasGameMode = gameMode;
  gameMode = false;
  updateDHT(true);
  updateWifiStats(true);
  if (wasGameMode && currentScreen == SCREEN_DASHBOARD) {
    updateDashboardScreen(true);
  }
}

void handleExitGames() {
  exitGameMode();
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleExitGamesPost() {
  exitGameMode();
  server.send(204, "text/plain", "");
}

void handleBeep() {
  tone(BUZZER_PIN, 1200, 140);
  server.send(200, "text/plain", "OK");
}

void handleLedOn() {
  ledStripOn = true;
  applyLedStrip();
  sendLedJson();
}

void handleLedOff() {
  ledStripOn = false;
  applyLedStrip();
  sendLedJson();
}

void handleLedSet() {
  if (server.hasArg("color")) {
    String color = server.arg("color");
    color.trim();
    if (color.startsWith("#")) color.remove(0, 1);

    bool ok = color.length() == 6;
    for (uint8_t i = 0; i < color.length() && ok; i++) {
      ok = isGoodHexChar(color[i]);
    }

    if (ok) {
      char raw[7];
      color.toCharArray(raw, sizeof(raw));
      ledR = hexPairToByte(raw);
      ledG = hexPairToByte(raw + 2);
      ledB = hexPairToByte(raw + 4);
    }
  }

  if (server.hasArg("brightness")) {
    int b = server.arg("brightness").toInt();
    if (b < 0) b = 0;
    if (b > 255) b = 255;
    ledBrightness = (uint8_t)b;
  }

  ledStripOn = true;
  applyLedStrip();
  sendLedJson();
}

void handleMatrix() {
  if (!server.hasArg("data")) {
    server.send(400, "text/plain", "Missing data");
    return;
  }

  String hex = server.arg("data");
  hex.trim();
  if (hex.length() != 16) {
    server.send(400, "text/plain", "Need exactly 16 hex characters");
    return;
  }

  for (uint8_t i = 0; i < 16; i++) {
    if (!isGoodHexChar(hex[i])) {
      server.send(400, "text/plain", "Bad hex data");
      return;
    }
  }

  char pair[3] = {0, 0, 0};
  for (uint8_t i = 0; i < 8; i++) {
    pair[0] = hex[i * 2];
    pair[1] = hex[i * 2 + 1];
    matrixIcon[i] = (byte)strtoul(pair, NULL, 16);
  }

  showMatrix();
  server.send(200, "text/plain", "OK");
}

void handleScreenDashboard() {
  exitGameMode();
  drawDashboardFrame();
  updateDashboardScreen(true);
  server.sendHeader("Location", "/screen");
  server.send(303);
}

uint8_t requestedPhotoSlot() {
  int slot = server.hasArg("slot") ? server.arg("slot").toInt() : 1;
  if (slot < 1) slot = 1;
  if (slot > PHOTO_SLOT_COUNT) slot = PHOTO_SLOT_COUNT;
  return (uint8_t)(slot - 1);
}

void handleScreenPhoto() {
  exitGameMode();
  uint8_t slot = requestedPhotoSlot();
  refreshPhotoAvailability();
  if (photoAvailable[slot]) {
    currentPhotoSlot = slot;
    currentScreen = SCREEN_IMAGE;
    pendingImageRender = true;
  } else {
    drawNoImageScreen(slot);
  }
  server.sendHeader("Location", "/screen");
  server.send(303);
}

void handleScreenImage() {
  exitGameMode();
  refreshPhotoAvailability();
  if (photoAvailable[0]) {
    currentPhotoSlot = 0;
    currentScreen = SCREEN_IMAGE;
    pendingImageRender = true;
  } else {
    drawNoImageScreen(0);
  }
  server.sendHeader("Location", "/image");
  server.send(303);
}

void handleScreenCustom() {
  exitGameMode();
  drawCustomScreen();
  server.sendHeader("Location", "/screen");
  server.send(303);
}

void handleScreenCustomize() {
  if (server.hasArg("screen_title")) copyCleanText(screenTitle, sizeof(screenTitle), server.arg("screen_title"), "ESP32 SMART HUB");
  if (server.hasArg("custom_title")) copyCleanText(customTitle, sizeof(customTitle), server.arg("custom_title"), "CUSTOM SCREEN");
  if (server.hasArg("line1")) copyCleanText(customLine1, sizeof(customLine1), server.arg("line1"), "Manual screen");
  if (server.hasArg("line2")) copyCleanText(customLine2, sizeof(customLine2), server.arg("line2"), "Change this text");
  if (server.hasArg("line3")) copyCleanText(customLine3, sizeof(customLine3), server.arg("line3"), "from the app");

  if (server.hasArg("dash_bg")) dashboardBgColor = parseHexColor565(server.arg("dash_bg"), dashboardBgColor);
  if (server.hasArg("dash_text")) dashboardTextColor = parseHexColor565(server.arg("dash_text"), dashboardTextColor);
  if (server.hasArg("dash_accent")) dashboardAccentColor = parseHexColor565(server.arg("dash_accent"), dashboardAccentColor);
  if (server.hasArg("custom_bg")) customBgColor = parseHexColor565(server.arg("custom_bg"), customBgColor);
  if (server.hasArg("custom_text")) customTextColor = parseHexColor565(server.arg("custom_text"), customTextColor);
  if (server.hasArg("custom_accent")) customAccentColor = parseHexColor565(server.arg("custom_accent"), customAccentColor);

  saveScreenConfig();

  if (currentScreen == SCREEN_DASHBOARD) {
    drawDashboardFrame();
    updateDashboardScreen(true);
  } else if (currentScreen == SCREEN_CUSTOM) {
    drawCustomScreen();
  }

  server.send(200, "text/plain", "OK");
}

void handleScreenConfig() {
  char dashBg[8], dashText[8], dashAccent[8], customBg[8], customText[8], customAccent[8];
  char json[768];

  color565ToHex(dashboardBgColor, dashBg, sizeof(dashBg));
  color565ToHex(dashboardTextColor, dashText, sizeof(dashText));
  color565ToHex(dashboardAccentColor, dashAccent, sizeof(dashAccent));
  color565ToHex(customBgColor, customBg, sizeof(customBg));
  color565ToHex(customTextColor, customText, sizeof(customText));
  color565ToHex(customAccentColor, customAccent, sizeof(customAccent));

  snprintf(json, sizeof(json),
           "{\"screen_title\":\"%s\",\"dashboard_bg\":\"%s\",\"dashboard_text\":\"%s\",\"dashboard_accent\":\"%s\","
           "\"custom_title\":\"%s\",\"custom_line1\":\"%s\",\"custom_line2\":\"%s\",\"custom_line3\":\"%s\","
           "\"custom_bg\":\"%s\",\"custom_text\":\"%s\",\"custom_accent\":\"%s\"}",
           screenTitle, dashBg, dashText, dashAccent,
           customTitle, customLine1, customLine2, customLine3,
           customBg, customText, customAccent);

  sendNoStore();
  server.send(200, "application/json", json);
}

void handleApiStatus() {
  updateWifiStats(false);

  char tempText[16];
  char humText[16];
  char uptimeText[32];
  char ledColor[8];
  char modeText[20];
  char json[900];

  if (isnan(tempC)) copyText(tempText, sizeof(tempText), "null");
  else snprintf(tempText, sizeof(tempText), "%.1f", tempC);

  if (isnan(humPct)) copyText(humText, sizeof(humText), "null");
  else snprintf(humText, sizeof(humText), "%.1f", humPct);

  formatUptime(uptimeText, sizeof(uptimeText));
  ledHexColor(ledColor, sizeof(ledColor));
  screenModeText(modeText, sizeof(modeText));

  snprintf(json, sizeof(json),
           "{\"temperature\":%s,\"humidity\":%s,\"wifi_rssi\":%d,\"wifi_quality\":\"%s\",\"wifi_quality_pct\":%d,"
           "\"uptime\":\"%s\",\"free_heap_kb\":%u,\"ip\":\"%s\",\"screen_mode\":\"%s\",\"image_available\":%s,"
           "\"photo1_available\":%s,\"photo2_available\":%s,\"photo3_available\":%s,\"photo_slot\":%u,"
           "\"game_mode\":%s,\"led_on\":%s,\"led_brightness\":%u,\"led_color\":\"%s\"}",
           tempText,
           humText,
           wifiRSSI,
           wifiQualityText,
           wifiQualityPct,
           uptimeText,
           (unsigned int)(ESP.getFreeHeap() / 1024U),
           ipText,
           modeText,
           imageAvailable ? "true" : "false",
           photoAvailable[0] ? "true" : "false",
           photoAvailable[1] ? "true" : "false",
           photoAvailable[2] ? "true" : "false",
           (unsigned int)(currentPhotoSlot + 1),
           gameMode ? "true" : "false",
           ledStripOn ? "true" : "false",
           ledBrightness,
           ledColor);

  sendNoStore();
  server.send(200, "application/json", json);
}

void failImageUpload(const char* message) {
  imageUploadError = true;
  copyText(imageUploadErrorText, sizeof(imageUploadErrorText), message);
  if (imageUploadFile) {
    imageUploadFile.close();
  }
}

bool parseUploadHeaderUInt(const char* name, uint32_t* value) {
  String text = server.header(name);
  text.trim();
  if (text.length() == 0) return false;
  for (uint16_t i = 0; i < text.length(); i++) {
    if (text[i] < '0' || text[i] > '9') return false;
  }
  *value = (uint32_t)strtoul(text.c_str(), NULL, 10);
  return true;
}

bool uploadHeaderIsOne(const char* name) {
  String text = server.header(name);
  text.trim();
  return text == "1";
}

void handleImageUploadRawData(HTTPRaw& raw) {
  if (raw.status == RAW_START) {
    imageUploadError = false;
    imageUploadErrorText[0] = '\0';
    imageUploadOffset = 0;
    imageUploadTotal = 0;
    imageUploadReceived = 0;
    imageUploadSlot = 0;
    imageUploadFinal = false;

    if (imageUploadFile) {
      imageUploadFile.close();
    }

    uint32_t contentLength = (uint32_t)server.clientContentLength();
    bool first = uploadHeaderIsOne("X-Image-First");
    imageUploadFinal = uploadHeaderIsOne("X-Image-Final");

    if (!parseUploadHeaderUInt("X-Image-Offset", &imageUploadOffset) ||
        !parseUploadHeaderUInt("X-Image-Total", &imageUploadTotal)) {
      failImageUpload("Missing image upload headers.");
      return;
    }

    uint32_t slotHeader = 1;
    if (parseUploadHeaderUInt("X-Image-Slot", &slotHeader)) {
      if (slotHeader < 1) slotHeader = 1;
      if (slotHeader > PHOTO_SLOT_COUNT) slotHeader = PHOTO_SLOT_COUNT;
      imageUploadSlot = (uint8_t)(slotHeader - 1);
    }

    if (imageUploadTotal != IMAGE_BYTES) {
      failImageUpload("Bad image size. Expected 153600 RGB565 bytes.");
      return;
    }

    if (contentLength == 0 || contentLength > IMAGE_BYTES || imageUploadOffset > IMAGE_BYTES - contentLength) {
      failImageUpload("Bad image chunk size.");
      return;
    }

    if (first && imageUploadOffset != 0) {
      failImageUpload("First chunk must start at zero.");
      return;
    }

    if (imageUploadFinal && imageUploadOffset + contentLength != IMAGE_BYTES) {
      failImageUpload("Final chunk does not finish the image.");
      return;
    }

    if (first) {
      LittleFS.remove(IMAGE_TMP_FILE);
      imageUploadFile = LittleFS.open(IMAGE_TMP_FILE, "w");
    } else {
      if (!LittleFS.exists(IMAGE_TMP_FILE)) {
        failImageUpload("Upload session expired.");
        return;
      }
      imageUploadFile = LittleFS.open(IMAGE_TMP_FILE, "a");
    }

    if (!imageUploadFile) {
      failImageUpload("Cannot open image file.");
      return;
    }

    if (!first && imageUploadFile.size() != imageUploadOffset) {
      failImageUpload("Chunk offset mismatch.");
      return;
    }
  } else if (raw.status == RAW_WRITE) {
    if (imageUploadError || !imageUploadFile) return;
    size_t written = imageUploadFile.write(raw.buf, raw.currentSize);
    if (written != raw.currentSize) {
      failImageUpload("Flash write failed.");
      return;
    }
    imageUploadReceived += raw.currentSize;
  } else if (raw.status == RAW_END) {
    if (imageUploadFile) {
      imageUploadFile.close();
    }

    if (imageUploadError) return;

    if (imageUploadOffset + imageUploadReceived > imageUploadTotal) {
      failImageUpload("Image chunk overflow.");
      LittleFS.remove(IMAGE_TMP_FILE);
      return;
    }

    if (imageUploadFinal) {
      File f = LittleFS.open(IMAGE_TMP_FILE, "r");
      uint32_t finalSize = f ? f.size() : 0;
      if (f) f.close();

      if (finalSize != IMAGE_BYTES) {
        failImageUpload("Final image size mismatch.");
        LittleFS.remove(IMAGE_TMP_FILE);
        return;
      }

      const char* finalFile = photoFileForSlot(imageUploadSlot);
      LittleFS.remove(finalFile);
      if (!LittleFS.rename(IMAGE_TMP_FILE, finalFile)) {
        failImageUpload("Cannot commit image file.");
        return;
      }

      photoAvailable[imageUploadSlot] = true;
      imageAvailable = true;
      if (currentScreen == SCREEN_IMAGE && currentPhotoSlot == imageUploadSlot) {
        pendingImageRender = true;
      }
    }
  } else if (raw.status == RAW_ABORTED) {
    failImageUpload("Upload aborted.");
  }
}

void handleImageUploadComplete() {
  if (imageUploadError) {
    server.send(500, "text/plain", imageUploadErrorText[0] ? imageUploadErrorText : "Upload failed.");
    return;
  }

  server.send(200, "text/plain", imageUploadFinal ? "Image stored" : "Chunk stored");
}

class ImageUploadRawHandler : public RequestHandler {
public:
  bool canHandle(WebServer& webServer, HTTPMethod method, const String& uri) override {
    (void)webServer;
    return method == HTTP_POST && uri == "/image/upload";
  }

  bool canRaw(WebServer& webServer, const String& uri) override {
    (void)webServer;
    return uri == "/image/upload";
  }

  bool handle(WebServer& webServer, HTTPMethod method, const String& uri) override {
    (void)webServer;
    if (method != HTTP_POST || uri != "/image/upload") return false;
    handleImageUploadComplete();
    return true;
  }

  void raw(WebServer& webServer, const String& uri, HTTPRaw& raw) override {
    (void)webServer;
    (void)uri;
    handleImageUploadRawData(raw);
  }
};

void handleNotFound() {
  server.send(404, "text/plain", "Not found");
}

// ============================================================
// SETUP / LOOP
// ============================================================

void setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000UL) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Open: http://");
    Serial.println(WiFi.localIP());
  } else {
    WiFi.mode(WIFI_AP);
    WiFi.softAP("ESP32-SMART-HUB");
    Serial.print("WiFi failed. AP mode: http://");
    Serial.println(WiFi.softAPIP());
  }

  updateWifiStats(true);
}

void setupRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/led", HTTP_GET, handleLedPage);
  server.on("/screen", HTTP_GET, handleScreenPage);
  server.on("/matrix-page", HTTP_GET, handleMatrixPage);
  server.on("/image", HTTP_GET, handleImagePage);
  server.on("/games", HTTP_GET, handleGames);
  server.on("/api/status", HTTP_GET, handleApiStatus);
  server.on("/api/screen-config", HTTP_GET, handleScreenConfig);

  server.on("/led/on", HTTP_GET, handleLedOn);
  server.on("/led/off", HTTP_GET, handleLedOff);
  server.on("/led/set", HTTP_GET, handleLedSet);
  server.on("/led/status", HTTP_GET, sendLedJson);

  server.on("/matrix", HTTP_GET, handleMatrix);
  server.on("/game-ping", HTTP_GET, handleGamePing);
  server.on("/exit-games", HTTP_GET, handleExitGames);
  server.on("/exit-games", HTTP_POST, handleExitGamesPost);
  server.on("/screen/dashboard", HTTP_GET, handleScreenDashboard);
  server.on("/screen/image", HTTP_GET, handleScreenImage);
  server.on("/screen/photo", HTTP_GET, handleScreenPhoto);
  server.on("/screen/custom", HTTP_GET, handleScreenCustom);
  server.on("/screen/customize", HTTP_GET, handleScreenCustomize);
  server.on("/beep", HTTP_GET, handleBeep);

  server.collectHeaders(IMAGE_UPLOAD_HEADERS, sizeof(IMAGE_UPLOAD_HEADERS) / sizeof(IMAGE_UPLOAD_HEADERS[0]));
  server.addHandler(new ImageUploadRawHandler());

  server.onNotFound(handleNotFound);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(TFT_CS, OUTPUT);
  digitalWrite(TFT_CS, HIGH);
  pinMode(TFT_DC, OUTPUT);
  pinMode(TFT_RST, OUTPUT);
  digitalWrite(TFT_RST, HIGH);

  pinMode(BUZZER_PIN, OUTPUT);

  dht.begin();

  matrix.begin();
  matrix.control(MD_MAX72XX::INTENSITY, 1);
  matrix.clear();

  strip.begin();
  applyLedStrip();

  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setRotation(TFT_ROTATION);
  tft.setSPISpeed(TFT_SPI_HZ);
  runTftBootColorTest();
  drawBootScreen("Starting storage...");

  if (!LittleFS.begin(true)) {
    drawBootScreen("LittleFS failed");
    Serial.println("LittleFS mount failed.");
  }
  loadScreenConfig();
  refreshPhotoAvailability();

  drawBootScreen("Connecting WiFi...");
  setupWiFi();

  drawBootScreen("Starting server...");
  setupRoutes();
  server.begin();

  updateDHT(true);
  tone(BUZZER_PIN, 1000, 120);

  drawDashboardFrame();
  updateDashboardScreen(true);
}

void loop() {
  server.handleClient();

  if (gameMode) {
    if (millis() - lastGameActivity > GAME_STALE_MS) {
      exitGameMode();
    }
    delay(1);
    return;
  }

  if (pendingImageRender) {
    pendingImageRender = false;
    if (currentScreen == SCREEN_IMAGE) {
      renderPhotoSlot(currentPhotoSlot);
    }
  }

  if (currentScreen == SCREEN_DASHBOARD) {
    updateDashboardScreen(false);
  }

  updateDHT(false);
  updateWifiStats(false);

  delay(2);
}
