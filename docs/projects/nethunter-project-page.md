---
sidebar_position: 1
title: Kali NetHunter
---

# Kali NetHunter — Custom Build on OnePlus 7T (OOS 10)

Building a fully functional Kali NetHunter install on a OnePlus 7T running OxygenOS 10 — including compiling a custom kernel from source when no pre-built image existed for the OS version.

:::warning
**This guide is specific to a OnePlus 7T (HD1905) on OxygenOS 10.0.4.** Even if you have the same device, differences in OS version, firmware build, carrier variant, or bootloader state mean you will almost certainly run into your own issues that aren't covered here. Use this as a reference for the general process and problem-solving approach, not as a step-by-step that will work identically on your hardware.
:::

:::warning
**Firmware download sites are a malware risk.** Many of the sites that host OEM firmware images, MSM tools, and recovery files are riddled with aggressive ad networks that do not vet their advertisers. Pop-ups can trigger downloads or redirect clicks in a way that installs browser hijackers or worse — during this project, a laptop used to source firmware links ended up with its default search engine silently switched to Yahoo, a classic sign of a browser hijacker picked up from one of these sites. Use a dedicated machine you don't mind reimaging, run an ad blocker, and don't trust any download link you didn't verify independently.
:::

---

## Context

The goal was straightforward: install Kali NetHunter on a OnePlus 7T to use as a mobile penetration testing platform. The primary guide followed was [David Bombal's rooted NetHunter installation video](https://www.youtube.com/watch?v=mtz-6CZIV6o), which walks through bootloader unlock, TWRP, Magisk, and NetHunter flashing.

What made this non-trivial:

- The phone was purchased running **OxygenOS 11.0.9.1.HD65AA**, but all firmware download links for that version were dead
- Bombal's video targets the **EU variant** of the OnePlus 7T — the device used here is the **US/Global variant (HD1905, codename "hotdogb")**, which has slightly different firmware identifiers
- A soft brick during the initial rooting attempt forced a full recovery and OS downgrade
- After recovery, the device landed on **OxygenOS 10.0.4** — but Kali only ships pre-built NetHunter images for OOS 11 on this device

The solution was building a custom NetHunter image from source using Kali's official build scripts and Re4son's kernel.

---

## Device Details

| Detail | Value |
|--------|-------|
| Device | OnePlus 7T |
| Model | HD1905 (US/Global) |
| Codename | hotdogb |
| Final OS | OxygenOS 10.0.4.HD65AA |
| Root | Magisk |
| Recovery | TWRP 3.7.0 (hotdogb/OOS 11 FBE variant) |
| Build Environment | Kali Linux VM (VirtualBox on Windows host) |

---

## Recovery and Device Prep

### Soft Brick Recovery

The phone was soft bricked during the initial rooting attempt. Recovery required the **MSM Download Tool** (Qualcomm EDL mode), which performs an emergency firmware flash at the hardware level.

The exact OOS 11.0.9.1 firmware image couldn't be sourced (dead links), so the device was reverted to the most recent version with an available MSM image: **OxygenOS 10.0.4.HD65AA**. This was a forced downgrade from Android 11 to Android 10. MSM factory-resets the device completely.

:::warning
The MSM Download Tool is your lifeline if you brick a OnePlus device. Make sure you have a working MSM image downloaded **before** you start flashing anything. Don't assume firmware links will still be live when you need them.
:::

### Re-rooting on OOS 10

After recovery to OOS 10.0.4, the device had to be re-rooted from scratch:

1. **Unlock bootloader** — Settings → About Phone → tap Build Number 7x → Developer Options → enable OEM Unlocking + USB Debugging → `adb reboot bootloader` → `fastboot oem unlock` → confirm with volume keys (this triggers a full data wipe)

2. **Flash TWRP** — boot into TWRP via `fastboot boot twrp.img`, then flash recovery permanently

3. **Install Magisk** — flash Magisk zip via TWRP, reboot, install Magisk app, verify root:

```bash
adb shell
su
```

4. **Disable force encryption** — flash DFE (Disable Force Encryption) via TWRP/Magisk to prevent data partition encryption from blocking NetHunter access

5. **Disable OOS auto-updates** — critical step to prevent OTA updates from overwriting the custom kernel:

```bash
su -c pm disable com.oneplus.opbackup
```

Also disable in Settings → System → System Updates → uncheck "Automatic Updates over WiFi".

:::warning
If you skip disabling auto-updates, OxygenOS will silently download and apply an OTA update, overwriting your custom kernel and potentially bricking the device again.
:::

---

## The Kernel Problem

With the device rooted on OOS 10.0.4, the next step was installing NetHunter. But Kali's official NetHunter download page only provides pre-built images for **OxygenOS 11** on the OnePlus 7T — not OOS 10.

The pre-built kernel zips (e.g., `kernel-nethunter-*-oneplus7-oos-eleven.zip`, built by CyberKnight777) are compiled for OOS 11's kernel version. Flashing them on OOS 10 risks a boot loop or Qualcomm crashdump mode.

Options explored:

- **Flashing the OOS 11 NetHunter image on OOS 10 hardware** → kernel mismatch risk, likely crashdump
- **Upgrading back to OOS 11** → too risky given the previous brick and dead firmware links
- **Rootless/app-only NetHunter** → reduced capability (no custom kernel, no HID, no wireless injection)
- **Community-built OOS 10 kernels** → none available for this specific device model
- **Building a custom NetHunter image from source** → this is what we did

---

## Building a Custom NetHunter Image

### Build Tooling

- **Build scripts:** [https://gitlab.com/kalilinux/nethunter/build-scripts/kali-nethunter-installer.git](https://gitlab.com/kalilinux/nethunter/build-scripts/kali-nethunter-installer.git)
- **Kernel source:** Re4son's GitHub — [https://github.com/Re4son/android_kernel_oneplus_sm8150_draco](https://github.com/Re4son/android_kernel_oneplus_sm8150_draco), branch `nethunter-10.0`
- **Build environment:** Kali Linux VM in VirtualBox on Windows host

### Build Command

```bash
python3 build.py -k oneplus7-oos --ten -fs full
```

Flags breakdown:

- `-k oneplus7-oos` — kernel target for OnePlus 7/7T OxygenOS
- `--ten` — specifies Android 10 (OOS 10.x)
- `-fs full` — full filesystem (complete Kali chroot with all tools, not minimal)

The build script handles the full pipeline: clones the kernel source from Re4son's repo, applies the appropriate defconfig, cross-compiles the kernel for ARM64, and packages it alongside the NetHunter filesystem into a single flashable zip.

:::tip
The build process takes a while — especially in a VM with limited resources. Let it finish. If the terminal is still producing output, it's working.
:::

### Kernel Verification

The custom kernel includes all modules needed for full NetHunter functionality:

- `CONFIG_CFG80211` / `CONFIG_MAC80211` — wireless injection support
- `CONFIG_USB_GADGET` / HID gadget drivers — BadUSB/HID attacks
- `CONFIG_NETFILTER` — traffic manipulation
- External adapter support: `ath9k_htc` (AR9271), `rtl8812au`, `rt2800usb`, `88xxxu`

Verify with:

```bash
cat /proc/config.gz | gunzip | grep -E "CFG80211|MAC80211|USB_GADGET|HID"
```

The NetHunter app's built-in **Kernel Checker** can also verify against expected modules for the device class. The custom kernel was confirmed equivalent to official pre-built kernels with no meaningful capability gaps.

---

## File Transfer — Kali VM to Phone

VirtualBox shared folders and drag-and-drop were non-functional for transferring the built zip (~1-2GB with full filesystem) from the Kali VM to the Windows host.

The workaround was SCP with NAT port forwarding:

1. Set up a VirtualBox NAT port forwarding rule: host port 2222 → guest port 22
2. Enable SSH in the Kali VM
3. SCP the flashable zip from VM to Windows host:

```bash
scp -P 2222 /path/to/nethunter.zip user@10.0.2.2:/destination/
```

4. From Windows, transfer to the phone via USB cable or `adb push`

---

## Flashing — Magisk, Not TWRP

### The Gotcha

TWRP threw `system_ext` mount errors when attempting to flash the NetHunter zip. This is a known issue: Android 10 (OOS 10.0.4) lacks the `system_ext` partition that was introduced in Android 11. The TWRP version expected that partition layout, causing the flash to fail. This is a common pain point documented across XDA threads — many OnePlus 7T users hit this exact error.

### The Fix

Flash the NetHunter zip through **Magisk** instead of TWRP:

1. Open Magisk → Modules → Install from Storage
2. Select the NetHunter zip
3. Wait for installation to complete

:::warning
The installation takes approximately 25 minutes for the full filesystem. Do not interrupt it.
:::

---

## Post-Install Configuration

### Kali Chroot Setup

After reboot, the Kali chroot came up cleanly. Initial setup:

1. Open NetHunter app → grant all Superuser and file permissions
2. Navigate to Kali Chroot Manager → start the chroot environment
3. In NetHunter Terminal:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt autoremove -y && sudo apt clean
```

:::tip
If `apt update` fails with DNS errors, the chroot may not have inherited the phone's DNS config. Edit `/etc/resolv.conf` and set `nameserver 8.8.8.8` and `nameserver 8.8.4.4`. If you encounter broken packages, run `sudo apt --fix-broken install`.
:::

---

## Hardware Validation

### External Wireless Adapter

| Detail | Value |
|--------|-------|
| Chipset | AR9271 (Atheros) |
| Driver | ath9k_htc — built into the NetHunter kernel |
| Interface | Recognized as wlan0 immediately on plug-in via USB OTG |
| Capabilities | Monitor mode, packet injection |

Verification:

```bash
iwconfig           # Should show wlan0
airmon-ng          # Should list the adapter
airmon-ng start wlan0  # Enable monitor mode
```

---

## Confirmed Capabilities

Everything below was validated on this custom build and is equivalent to official pre-built NetHunter images:

- Full Kali CLI toolset (Metasploit, Nmap, Burp, aircrack-ng, etc.)
- Wireless injection via external adapter (AR9271)
- HID attacks (USB Rubber Ducky emulation via USB gadget)
- BadUSB attacks
- Evil AP / rogue access point
- Bluetooth attacks
- VNC into full Kali desktop (functional but clunky — terminal is the primary interface)
- Full Kali package repository access

### Known Limitations

These are general NetHunter limitations, not specific to this build:

- Resource constraints — RAM/CPU limits make heavy workloads (large Hashcat jobs, multiple services) slow or impractical
- No PCIe; USB support depends on Android OTG implementation
- GUI via VNC is clunky — terminal is the primary interface
- Everything requires root (handled by Magisk)

---

## Problems and Solutions

| # | Problem | Solution |
|---|---------|----------|
| 1 | Phone purchased on OOS 11.0.9.1 — firmware download links all dead | Couldn't source exact version; worked with what was available |
| 2 | Video guide used EU variant — slightly different from US device | Adapted steps for US/Global variant (HD1905 / hotdogb) |
| 3 | Soft bricked phone during initial rooting attempt | Recovered via MSM Download Tool (Qualcomm EDL mode) |
| 4 | MSM recovery couldn't find OOS 11.0.9.1 image | Reverted to OOS 10.0.4.HD65AA (most recent available MSM image) |
| 5 | No pre-built NetHunter image for OOS 10 on OnePlus 7T | Built custom image from Kali's official GitLab build scripts + Re4son kernel |
| 6 | VirtualBox shared folders / drag-and-drop broken | SCP with NAT port forwarding (host 2222 → guest 22) |
| 7 | TWRP `system_ext` mount errors during flash | Flashed via Magisk module instead of TWRP |
| 8 | OOS auto-updates could overwrite custom kernel | Disabled updater: `pm disable com.oneplus.opbackup` |
| 9 | Concern about custom kernel having fewer features | Verified via `/proc/config.gz` and Kernel Checker — equivalent to official builds |

---

## Tools and Resources

| Tool | Purpose |
|------|---------|
| [MSM Download Tool](https://www.oneplus.com/) | Qualcomm EDL emergency firmware flash / unbrick |
| TWRP | Custom recovery |
| [Magisk](https://github.com/topjohnwu/Magisk) | Root manager + module installer (used to flash NetHunter) |
| DFE (Disable Force Encryption) | Disable Android data partition encryption |
| [Kali NetHunter Installer](https://gitlab.com/kalilinux/nethunter/build-scripts/kali-nethunter-installer) | Build scripts for compiling custom NetHunter images |
| [Re4son Kernel](https://github.com/Re4son/android_kernel_oneplus_sm8150_draco) | NetHunter-patched kernel source for OnePlus 7 series |
| VirtualBox | VM host for Kali Linux build environment |
| ADB / Fastboot | Android debug bridge + bootloader tools |

---

*Reference video: [David Bombal — Kali NetHunter rooted Android install](https://www.youtube.com/watch?v=mtz-6CZIV6o)*
