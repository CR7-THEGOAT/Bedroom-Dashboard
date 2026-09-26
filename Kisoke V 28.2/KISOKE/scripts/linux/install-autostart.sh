#!/usr/bin/env bash
set -euo pipefail

KIOSK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

mkdir -p "$HOME/.config/autostart"
mkdir -p "$HOME/.config/systemd/user"

cat > "$HOME/.config/autostart/kisoke.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=KISOKE
Exec=bash -lc 'cd "$KIOSK_DIR" && ALLOW_DEVICE_CONTROL=true bash scripts/linux/start-kiosk.sh'
X-GNOME-Autostart-enabled=true
EOF

chmod +x "$HOME/.config/autostart/kisoke.desktop"

cat > "$HOME/.config/systemd/user/kisoke.service" <<EOF
[Unit]
Description=KISOKE local kiosk frontend and backend
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$KIOSK_DIR
Environment=ALLOW_DEVICE_CONTROL=true
ExecStart=/usr/bin/env bash scripts/linux/start-kiosk.sh
Restart=always
RestartSec=8

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable kisoke.service
systemctl --user restart kisoke.service || true

if command -v loginctl >/dev/null 2>&1; then
  sudo loginctl enable-linger "$USER" || true
fi

echo "KISOKE autostart installed."
echo "It starts at login through desktop autostart and is also supervised by systemd user service."
echo "Check status with: systemctl --user status kisoke.service"
