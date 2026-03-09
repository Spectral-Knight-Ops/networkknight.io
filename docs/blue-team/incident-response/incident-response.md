---
sidebar_position: 1
title: Incident Response
---

# Incident Response

A structured approach to detecting, containing, eradicating, and recovering from security incidents. This page covers the IR lifecycle, triage procedures, evidence collection, and key commands for Windows and Linux investigation.

---

## IR Lifecycle

Both NIST SP 800-61 and the SANS incident response process follow similar phases:

**1. Preparation** → **2. Identification** → **3. Containment** → **4. Eradication** → **5. Recovery** → **6. Lessons Learned**

### 1. Preparation

Before an incident occurs: develop IR plans, define roles and communication channels, configure logging and monitoring, establish baselines, prepare forensic toolkits, and conduct tabletop exercises.

### 2. Identification

Determine whether an event is a true security incident. Sources of detection: SIEM alerts, EDR alerts, user reports, anomalous network traffic, threat intelligence feeds, external notification (law enforcement, third parties).

### 3. Containment

Stop the spread while preserving evidence. Two phases:

**Short-term containment** — immediate actions to stop active damage (isolate affected hosts, block malicious IPs, disable compromised accounts).

**Long-term containment** — temporary fixes that allow the environment to continue operating while you plan eradication (apply patches, change credentials, increase monitoring).

### 4. Eradication

Remove the attacker's presence entirely: remove malware, close backdoors, revoke persistence mechanisms, patch exploited vulnerabilities, reset compromised credentials.

### 5. Recovery

Restore systems to normal operation: rebuild from clean images if needed, restore from verified backups, validate system integrity before returning to production, implement enhanced monitoring for the recovery period.

### 6. Lessons Learned

Post-incident review: document the timeline, root cause, what worked, what failed, and what needs to change. Update IR plans, detection rules, and hardening configurations based on findings.

---

## Initial Triage

When a potential incident is identified, quickly determine the scope and severity.

### Triage Questions

- What was detected and by whom/what?
- When did it occur (first indication, current status)?
- Which systems and users are affected?
- Is the attacker still active?
- What data may have been accessed or exfiltrated?
- Is business operations impacted?

### Severity Classification

| Severity | Description | Example |
|----------|-------------|---------|
| Critical | Active data exfiltration, ransomware deployment, domain compromise | DC compromised, data actively being exfiltrated |
| High | Confirmed compromise, lateral movement detected | Malware on multiple hosts, admin credentials stolen |
| Medium | Confirmed compromise, limited scope | Single host infected, no lateral movement |
| Low | Suspicious activity, unconfirmed | Failed login attempts, suspicious email reported |

---

## Evidence Collection

### Order of Volatility

Collect evidence in order from most volatile (disappears first) to least volatile:

1. Registers, CPU cache
2. Memory (RAM)
3. Network connections, routing tables, ARP cache
4. Running processes
5. Disk contents
6. Backup media
7. Logs on remote systems

### Memory Acquisition

Capture a memory dump before shutting down or isolating the system.

Windows (using WinPMEM):

```powershell
.\winpmem_mini_x64.exe memory.raw
```

Linux (using LiME):

```bash
sudo insmod lime-$(uname -r).ko "path=/tmp/memory.lime format=lime"
```

### Disk Imaging

Create a forensic image of the disk:

```bash
sudo dd if=/dev/sda of=/mnt/forensic/disk.img bs=4M status=progress
```

Verify integrity:

```bash
sha256sum /dev/sda
sha256sum /mnt/forensic/disk.img
```

:::tip
Always work on a copy, never the original evidence. Document every action with timestamps and maintain chain of custody records.
:::

---

## Windows Triage Commands

### System Information

```powershell
systeminfo
hostname
whoami /all
net user
net localgroup Administrators
```

### Running Processes

```powershell
Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name, Id, CPU, Path
tasklist /v
wmic process get Name,ProcessId,ParentProcessId,CommandLine
```

### Network Connections

```powershell
netstat -ano
Get-NetTCPConnection | Where-Object { $_.State -eq "Established" } | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, OwningProcess
```

Map connections to processes:

```powershell
Get-NetTCPConnection | ForEach-Object { $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; [PSCustomObject]@{LocalPort=$_.LocalPort; RemoteAddr=$_.RemoteAddress; RemotePort=$_.RemotePort; Process=$proc.Name; PID=$_.OwningProcess} }
```

### Scheduled Tasks

```powershell
schtasks /query /fo LIST /v
Get-ScheduledTask | Where-Object { $_.State -ne "Disabled" } | Select-Object TaskName, TaskPath, State
```

### Services

```powershell
Get-CimInstance win32_service | Where-Object { $_.State -eq "Running" } | Select-Object Name, PathName, StartMode
sc.exe query state=all
```

### Autorun Locations

```powershell
reg query HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run
reg query HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run
reg query HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce
Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location
```

### User Activity

```powershell
# Recent logon events
Get-WinEvent -FilterHashtable @{LogName='Security'; ID=4624} -MaxEvents 50 | Select-Object TimeCreated, @{N='User';E={$_.Properties[5].Value}}, @{N='LogonType';E={$_.Properties[8].Value}}

# Failed logons
Get-WinEvent -FilterHashtable @{LogName='Security'; ID=4625} -MaxEvents 50

# New accounts created
Get-WinEvent -FilterHashtable @{LogName='Security'; ID=4720} -MaxEvents 20

# New services installed
Get-WinEvent -FilterHashtable @{LogName='System'; ID=7045} -MaxEvents 20
```

### PowerShell History

```powershell
Get-ChildItem C:\Users\*\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "=== $($_.FullName) ==="; Get-Content $_ }
```

---

## Linux Triage Commands

### System Information

```bash
uname -a
hostname
whoami
id
cat /etc/os-release
uptime
last -a
```

### Running Processes

```bash
ps auxf
ps aux --sort=-%cpu | head -20
top -bn1
```

Look for processes running from unusual locations (`/tmp`, `/dev/shm`, user home directories).

### Network Connections

```bash
ss -tlnp          # Listening TCP
ss -tunap          # All connections with PIDs
netstat -tulnp
```

### Cron Jobs and Scheduled Tasks

```bash
crontab -l
ls -la /etc/cron.*
cat /etc/crontab
for user in $(cut -f1 -d: /etc/passwd); do echo "=== $user ==="; crontab -u $user -l 2>/dev/null; done
```

### Systemd Timers

```bash
systemctl list-timers --all
```

### User Activity

```bash
last -a                    # Login history
lastb -a                   # Failed logins
cat /var/log/auth.log | grep -i "accepted\|failed"
who                        # Currently logged-in users
w                          # Who is doing what
```

### File System Investigation

Recently modified files:

```bash
find / -type f -mtime -1 2>/dev/null    # Modified in last 24 hours
find / -type f -mmin -60 2>/dev/null    # Modified in last 60 minutes
find /tmp /var/tmp /dev/shm -type f 2>/dev/null  # Files in temp directories
```

Recently created users:

```bash
grep -v "nologin\|false" /etc/passwd
awk -F: '$3 >= 1000 { print $1, $3 }' /etc/passwd
```

### Bash History

```bash
for user_dir in /home/*; do
    hist="$user_dir/.bash_history"
    if [ -f "$hist" ]; then
        echo "=== $hist ==="
        cat "$hist"
    fi
done
cat /root/.bash_history 2>/dev/null
```

### Check for Persistence

```bash
# SUID binaries
find / -perm -4000 -type f 2>/dev/null

# SSH authorized keys (look for unauthorized entries)
find / -name "authorized_keys" -exec cat {} \; 2>/dev/null

# LD_PRELOAD
cat /etc/ld.so.preload 2>/dev/null

# Shell profiles
cat /etc/profile
cat /etc/bash.bashrc
```

---

## Containment Actions

### Network Isolation

Isolate the compromised host from the network while preserving it for investigation:

```bash
# Linux — drop all traffic except from IR workstation
sudo iptables -F
sudo iptables -A INPUT -s <ir-workstation-ip> -j ACCEPT
sudo iptables -A OUTPUT -d <ir-workstation-ip> -j ACCEPT
sudo iptables -P INPUT DROP
sudo iptables -P OUTPUT DROP
sudo iptables -P FORWARD DROP
```

Windows — disable network adapter:

```powershell
Disable-NetAdapter -Name "Ethernet" -Confirm:$false
```

### Account Containment

Disable compromised accounts immediately:

```powershell
Disable-ADAccount -Identity <username>
```

Reset passwords for confirmed compromised accounts (force reset on next logon):

```powershell
Set-ADAccountPassword -Identity <username> -Reset -NewPassword (ConvertTo-SecureString "TempPassword123!" -AsPlainText -Force)
Set-ADUser -Identity <username> -ChangePasswordAtLogon $true
```

If domain-wide compromise is suspected, reset the `krbtgt` password twice with at least 10 hours between resets.

---

## Common IR Tools

| Tool | Purpose |
|------|---------|
| **Velociraptor** | Endpoint investigation and response at scale |
| **KAPE** | Automated evidence collection (triage artifacts) |
| **Volatility** | Memory forensics analysis |
| **Autopsy** | Disk forensics (GUI for Sleuth Kit) |
| **Sysmon** | Enhanced Windows event logging |
| **WinPMEM / LiME** | Memory acquisition |
| **Chainsaw** | Fast Windows event log analysis |
| **Timeline Explorer** | Artifact timeline analysis (Eric Zimmerman) |
| **Plaso / log2timeline** | Supertimeline creation from multiple sources |
