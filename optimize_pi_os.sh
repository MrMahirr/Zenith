#!/bin/bash

# ==============================================================================
# Zenith Smart Room System - Raspberry Pi OS Master Optimization Suite
# Author: Antigravity (Advanced Agentic Coding Team, Google DeepMind)
# Purpose: Complete OS-level optimization (5.1 - 5.4) for maximum SD Card life,
#          optimized RAM swap space, reduced GPU memory, and faster boot times.
# ==============================================================================

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "\e[31m[ERROR] Bu scripti root (sudo) yetkileri ile çalıştırmalısınız!\e[0m"
  echo "Lütfen şu komutla tekrar deneyin: sudo ./optimize_pi_os.sh"
  exit 1
fi

clear
echo -e "\e[34m============================================================\e[0m"
echo -e "\e[32m       ZENITH RASPBERRY PI OS MASTER OPTİMİZASYON ARACI       \e[0m"
echo -e "\e[34m============================================================\e[0m"
echo -e "Bu araç, performance_analysis.md belgesindeki tüm işletim sistemi"
echo -e "düzeyi (5.1, 5.2, 5.3, 5.4) optimizasyonlarını otomatik uygular."
echo -e "\e[34m============================================================\e[0m"
echo ""

# Function to run 5.1
optimize_sd_card() {
  echo -e "\e[33m\n[5.1] SD Kart I/O & RAM Disk (noatime & tmpfs) Yapılandırılıyor...\e[0m"
  
  # Backup /etc/fstab
  FSTAB_BAK="/etc/fstab.bak_$(date +%Y%m%d_%H%M%S)"
  cp /etc/fstab "$FSTAB_BAK"
  echo "fstab yedeklendi: $FSTAB_BAK"

  # Apply noatime and nodiratime to ext4 mountpoints
  if grep -q "ext4" /etc/fstab; then
    sed -i -E 's/(\sext4\s+defaults)(,noatime)?(,nodiratime)?/\1,noatime,nodiratime/g' /etc/fstab
    echo "✔ Root ext4 partition 'noatime,nodiratime' ile güncellendi."
  else
    echo "ℹ ext4 partition bulunamadı veya zaten optimize."
  fi

  # Apply tmpfs for /tmp
  if ! grep -q "tmpfs.*/tmp" /etc/fstab; then
    echo "tmpfs  /tmp      tmpfs  defaults,noatime,nosuid,nodev,size=64M  0  0" >> /etc/fstab
    echo "✔ /tmp için 64MB RAM Disk eklendi."
  else
    echo "ℹ /tmp için tmpfs zaten mevcut."
  fi

  # Apply tmpfs for /var/log
  if ! grep -q "tmpfs.*/var/log" /etc/fstab; then
    echo "tmpfs  /var/log  tmpfs  defaults,noatime,nosuid,nodev,size=32M  0  0" >> /etc/fstab
    echo "✔ /var/log için 32MB RAM Disk eklendi."
  else
    echo "ℹ /var/log için tmpfs zaten mevcut."
  fi
}

# Function to run 5.2
optimize_swap() {
  echo -e "\e[33m\n[5.2] Sanal Bellek (SWAP) Alanı Optimize Ediliyor (1024MB)...\e[0m"
  
  SWAP_FILE="/etc/dphys-swapfile"
  if [ -f "$SWAP_FILE" ]; then
    # Backup
    cp "$SWAP_FILE" "${SWAP_FILE}.bak"
    
    # Disable swap temporarily
    dphys-swapfile swapoff
    
    # Set swap size to 1024
    sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' "$SWAP_FILE"
    
    # Re-setup and enable swap
    dphys-swapfile setup
    dphys-swapfile swapon
    echo "✔ SWAP boyutu başarıyla 1024MB olarak güncellendi ve aktif edildi."
  else
    echo -e "\e[31mℹ dphys-swapfile bulunamadı. Bu sistemde farklı bir swap yönetimi olabilir.\e[0m"
  fi
}

# Function to run 5.3
optimize_gpu_mem() {
  echo -e "\e[33m\n[5.3] GPU Ayrılmış Belleği Minimize Ediliyor (gpu_mem=64)...\e[0m"
  
  # Check config.txt location (classic vs modern Pi OS)
  CONFIG_TXT="/boot/config.txt"
  if [ ! -f "$CONFIG_TXT" ] && [ -f "/boot/firmware/config.txt" ]; then
    CONFIG_TXT="/boot/firmware/config.txt"
  fi
  
  if [ -f "$CONFIG_TXT" ]; then
    # Backup
    cp "$CONFIG_TXT" "${CONFIG_TXT}.bak"
    
    # Remove existing gpu_mem lines
    sed -i '/^gpu_mem=/d' "$CONFIG_TXT"
    
    # Append optimized gpu_mem=64 (sufficient for Pi HDMI/7" Screen, minimizes RAM waste)
    echo "gpu_mem=64" >> "$CONFIG_TXT"
    echo "✔ gpu_mem=64 olarak '$CONFIG_TXT' dosyasına eklendi (RAM kazanıldı)."
  else
    echo -e "\e[31mℹ config.txt bulunamadı. GPU belleği elle ayarlanmalıdır.\e[0m"
  fi
}

# Function to run 5.4
disable_unused_services() {
  echo -e "\e[33m\n[5.4] Gereksiz Sistem Servisleri Kapatılıyor (Hafifletme)...\e[0m"
  
  SERVICES=("bluetooth" "avahi-daemon" "triggerhappy" "hciuart")
  
  for SERVICE in "${SERVICES[@]}"; do
    if systemctl list-unit-files | grep -q "^${SERVICE}.service"; then
      systemctl stop "$SERVICE" 2>/dev/null
      systemctl disable "$SERVICE" 2>/dev/null
      echo "✔ ${SERVICE} servisi kalıcı olarak kapatıldı ve devre dışı bırakıldı."
    else
      echo "ℹ ${SERVICE} servisi zaten sistemde kurulu değil."
    fi
  done
}

# Run optimizations
optimize_sd_card
optimize_swap
optimize_gpu_mem
disable_unused_services

echo ""
echo -e "\e[34m============================================================\e[0m"
echo -e "\e[32m[KUSURSUZ BAŞARI] Tüm OS Optimizasyonları Tamamlandı!\e[0m"
echo -e "Değişikliklerin tamamen aktif olması için sistemin yeniden başlatılması önerilir."
echo -e "\e[34m============================================================\e[0m"
echo ""

# Ask to reboot
read -p "Raspberry Pi'yi şimdi yeniden başlatmak ister misiniz? (y/n): " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  echo "Sistem şimdi yeniden başlatılıyor..."
  reboot
else
  echo "Yeniden başlatma atlandı. Lütfen en kısa sürede manuel olarak 'sudo reboot' yapın."
fi
