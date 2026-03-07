---
sidebar_position: 2
title: Port Scanning
---

# Port Scanning

## Nmap

Reference: https://nmap.org/book/toc.html

Scripts location: `/usr/share/nmap/scripts`

### Scan Types

| Flag | Description |
|------|-------------|
| `-sS` | SYN stealth scan — faster, sends SYN packet, waits for SYN-ACK |
| `-sT` | TCP full connect — slower, default without sudo privileges |
| `-sU` | UDP scan |
| `-sn` | Ping sweep / host discovery |
| `-sCV` | Service version detection + default scripts |
| `-A` | OS detection, script scanning, traceroute |

### Common Scans

Full TCP port scan with service detection:

```bash
nmap -sCV -p- $TARGET --open
```

Quick SYN scan all ports:

```bash
nmap -sS -Pn -T4 -p- --min-rate=1000 $TARGET
```

Ping sweep for host discovery:

```bash
sudo nmap -sn $SUBNET
```

UDP top ports:

```bash
nmap -sU --top-ports 50 $TARGET
```

### NSE Scripts

List scripts for a specific service:

```bash
ls -1 /usr/share/nmap/scripts/smb*
```

Run vulnerability category scripts:

```bash
sudo nmap -sV -p 443 --script "vuln" $TARGET
```

Run specific scripts:

```bash
nmap -v -p 139,445 --script smb-os-discovery $TARGET
nmap --script smb-enum-shares.nse -p 445 $TARGET
nmap --script smb-enum-users.nse -p 445 $TARGET
```

Get help on a specific script:

```bash
nmap --script-help=<script-name>
```

:::tip
You can search for CVEs on Google and add NSE scripts from GitHub. After adding new scripts, run `sudo nmap --script-updatedb` to update the script database.
:::

### Output Options

| Flag | Description |
|------|-------------|
| `-oG` | Greppable output |
| `-oN` | Normal output |
| `-oA` | All formats |

## Netcat Port Scanning

Quick port scan with netcat:

```bash
nc -nvv -w 1 -z $TARGET 3388-3390
```

- `-w` sets timeout
- `-z` specifies zero-I/O mode (scanning, sends no data)
- Add `-u` for UDP scanning

Banner grab on a specific port:

```bash
nc -nv $TARGET 80
```
