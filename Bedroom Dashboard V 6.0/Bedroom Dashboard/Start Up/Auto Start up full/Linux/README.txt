Bedroom Dashboard auto-start for Ubuntu/Linux

Run this once to start Bedroom Dashboard automatically after login and keep it supervised.

Run:
cd ~/Documents/Bedroom Dashboard
chmod +x "Start Up/Auto Start up full/Linux/install-auto-start-ubuntu.sh"
"Start Up/Auto Start up full/Linux/install-auto-start-ubuntu.sh"

It installs:
- desktop autostart
- systemd user service named Bedroom Dashboard.service

Check status:
systemctl --user status Bedroom Dashboard.service

