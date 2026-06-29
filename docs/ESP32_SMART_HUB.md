# ESP32 Smart Hub

This is the ESP32 side of Bedroom Dashboard. It is made to be efficient: the ST7789 dashboard draws the frame once, then only repaints the changed values. Uploaded photos are resized by the browser to 240x320 RGB565 and stored in LittleFS so the ESP32 can draw them quickly. The browser games do not render on the ST7789 screen, which keeps the microcontroller responsive.

The current live ESP32 was checked at `http://192.168.4.51/`. It reported temperature, humidity, Wi-Fi quality, uptime, free heap, screen mode, three uploaded photo slots, LED status, and game mode through `/api/status`.

## Photos

![ESP32 dashboard](screenshots/esp32-dashboard.png)

![ESP32 screen control](screenshots/esp32-screen-control.png)

![ESP32 games](screenshots/esp32-games.png)

## Current Status

- Dashboard web page works and shows sensor/device status.
- ST7789 screen dashboard works with manual screen modes.
- LED strip controls are present.
- 8x8 matrix endpoint and page are present.
- Image upload supports three photo slots.
- Browser games are included.
- The ESP32 is still being improved and has one small bug around game/dashboard focus that still needs polishing.
- The Bedroom Dashboard AI is local through Ollama, but it still has many bugs to fix.

## ESP32 Files

Latest ESP32 sketch:

```text
Bedroom Dashboard V 27.0 AI improvement/Bedroom Dashboard/Code for ESP32/ESP32_NEW/ESP32_NEW.ino
```

Important: update the Wi-Fi values before uploading:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
```

## Arduino Libraries

Install these in Arduino IDE before uploading:

- ESP32 board support package for ESP32 DevKit V1 / ESP32-WROOM-32.
- `DHT sensor library`.
- `Adafruit Unified Sensor`, if your DHT library asks for it.
- `Adafruit GFX Library`.
- `Adafruit ST7735 and ST7789 Library`.
- `Adafruit NeoPixel`.
- `MD_MAX72XX`.

The sketch also uses built-in ESP32/Arduino libraries:

- `WiFi`
- `WebServer`
- `SPI`
- `FS`
- `LittleFS`

## Hardware Needed

- ESP32 DevKit V1 / ESP32-WROOM-32.
- ST7789 240x320 IPS display.
- DHT22 temperature/humidity sensor.
- Active buzzer or small buzzer module.
- WS2812B / NeoPixel LED strip, currently configured for 30 LEDs.
- MAX7219 8x8 LED matrix, FC16 style.
- USB cable for flashing and serial logs.
- Breadboard and jumper wires for prototyping.
- External regulated 5V power supply for the LED strip, matrix, and display power rail.
- Optional breadboard power supply module for early testing.
- Better final option: a 5V power distribution board, screw terminal block, or small perfboard power bus for all devices.
- 330 to 470 ohm resistor in series with the NeoPixel data line.
- 1000 uF capacitor across LED strip 5V and GND.
- Optional 74AHCT125 or similar 3.3V-to-5V level shifter for NeoPixel data.
- 10k pull-up resistor for DHT22 data if your DHT22 board does not already include one.

Do not power all devices from the ESP32 3.3V pin. Keep all grounds common: ESP32 GND, external 5V supply GND, LED strip GND, matrix GND, display GND, and sensor GND must connect together.

For 30 WS2812B LEDs, budget up to about 1.8A for full white at full brightness. Use at least a 5V 2A supply, with 5V 3A giving better headroom. If you add more LEDs or more powered devices, increase the supply size.

## Pin Map

| Device | ESP32 Pin | Notes |
| --- | --- | --- |
| ST7789 CS | GPIO5 | SPI chip select |
| ST7789 DC | GPIO2 | Data/command |
| ST7789 RST | GPIO4 | Reset |
| ST7789 SCK | GPIO18 | SPI clock |
| ST7789 MOSI | GPIO23 | SPI data |
| DHT22 data | GPIO21 | Add pull-up if needed |
| Buzzer | GPIO32 | Use a module/transistor for louder buzzers |
| WS2812B data | GPIO26 | Use resistor and common GND |
| MAX7219 DIN | GPIO14 | Matrix data |
| MAX7219 CLK | GPIO25 | Matrix clock |
| MAX7219 CS | GPIO33 | Matrix chip select |

Use the voltage printed on each module. Many ST7789 boards accept 3.3V logic, and some accept 5V power through an onboard regulator. When unsure, use 3.3V logic and check the module documentation.

## ESP32 Web Pages And API

When the ESP32 joins Wi-Fi, open the IP shown in serial logs. The configured default used by the dashboard backend is:

```text
http://192.168.4.51/
```

If Wi-Fi fails, the sketch starts AP mode:

```text
SSID: ESP32-SMART-HUB
```

Main pages:

- `/` - ESP32 dashboard with temperature, humidity, Wi-Fi, uptime, free heap, screen, photo, game, and LED status.
- `/screen` - ST7789 screen mode and customization page.
- `/led` - LED strip color, brightness, on/off controls.
- `/matrix-page` - 8x8 matrix page.
- `/image` - browser image upload, resized to 240x320 RGB565.
- `/games` - browser games.

Main endpoints:

- `/api/status` - JSON status for the dashboard/backend.
- `/api/screen-config` - current screen customization JSON.
- `/screen/dashboard` - show dashboard on ST7789.
- `/screen/custom` - show custom text screen.
- `/screen/photo?slot=1` through `/screen/photo?slot=3` - show an uploaded photo slot.
- `/screen/customize?...` - save screen title, text, and colors.
- `/led/on`, `/led/off`, `/led/set`, `/led/status` - LED strip controls.
- `/matrix` - matrix control.
- `/image/upload` - chunked RGB565 image upload.
- `/game-ping` - keeps browser game focus alive.
- `/exit-games` - leaves game mode and resumes normal dashboard updates.

## Games

The ESP32 page includes lightweight browser games. Opening `/games` intentionally pauses dashboard screen updates so the board does not waste time repainting while a game is active. Leaving games should call `/exit-games` and resume normal updates. If it stays paused, open `/exit-games` manually or press the dashboard/resume control.

The main Bedroom Dashboard app also includes a larger game library:

- XO Tic-Tac-Toe
- Connect Four
- Gomoku
- Mega XO
- Mini Connect
- Pyramid Drops
- Ping Pong
- Table Tennis
- Air Hockey
- Brick Pong
- Wall Ball
- Snake
- Worm Race
- Light Cycles
- Food Dash
- Grid Racer
- Memory Match
- Emoji Pairs
- Color Pairs
- Number Pairs
- Space Pairs
- Space Dodge
- Coin Collector
- Falling Blocks
- Lane Runner
- Comet Dodge
- Reaction Duel
- Target Tap
- Whack Dot
- Speed Clicker

## Upload Checklist

1. Open `ESP32_NEW.ino` in Arduino IDE.
2. Install the ESP32 board support and listed libraries.
3. Set the board to an ESP32 DevKit V1 / ESP32-WROOM-32 compatible target.
4. Update `WIFI_SSID` and `WIFI_PASS`.
5. Connect the ESP32 by USB.
6. Upload the sketch.
7. Open serial monitor and note the IP address.
8. Visit the ESP32 IP in a browser.
9. Use `/api/status` to confirm readings.
10. Use the Bedroom Dashboard backend setting `BEDROOM_ESP32_URL` if the ESP32 IP changes.

## Bedroom Dashboard Integration

The Python backend talks to the ESP32 through these local endpoints:

- `GET /api/bedroom/sensor`
- `POST /api/bedroom/matrix`
- `POST /api/bedroom/screen-image`
- `POST /api/bedroom/screen-mode`
- `POST /api/bedroom/screen-customize`

Default backend ESP32 target:

```text
BEDROOM_ESP32_URL=http://192.168.4.51/
```

Set that environment variable if your ESP32 gets a different IP.

## Known Bugs / Still Improving

- ESP32: one small game/dashboard focus bug is still being improved. The intended behavior is that games pause screen updates while active, then `/exit-games` resumes normal updates.
- AI: the local Ollama assistant is present and fully local, but it has many bugs still to be fixed.
- The project is still moving fast, so treat the latest snapshot as the main working version.
