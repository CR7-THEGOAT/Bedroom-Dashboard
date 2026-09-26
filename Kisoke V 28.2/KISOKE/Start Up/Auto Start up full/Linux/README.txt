KISOKE auto-start for Ubuntu/Linux

Run this once to start KISOKE automatically after login and keep it supervised.

Run:
cd ~/Documents/KISOKE
chmod +x "Start Up/Auto Start up full/Linux/install-auto-start-ubuntu.sh"
"Start Up/Auto Start up full/Linux/install-auto-start-ubuntu.sh"

It installs:
- desktop autostart
- systemd user service named kisoke.service

Check status:
systemctl --user status kisoke.service

