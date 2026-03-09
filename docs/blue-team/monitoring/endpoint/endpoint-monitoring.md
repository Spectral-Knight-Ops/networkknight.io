---
sidebar_position: 1
title: Endpoint Monitoring
---

# Endpoint Monitoring

Endpoint monitoring focuses on detecting malicious activity on individual hosts through event logging, process monitoring, and behavioral analysis. This page covers Sysmon configuration, key Windows Event IDs, PowerShell logging, and Linux endpoint monitoring.

---

## Sysmon (Windows)

Sysmon (System Monitor) is a free Microsoft Sysinternals tool that logs detailed system activity to the Windows Event Log. It provides far more visibility than default Windows logging.

### Installation

Download from: https://docs.microsoft.com/en-us/sysinternals/downloads/sysmon

Install with a configuration file:

```powershell
.\Sysmon64.exe -accepteula -i sysmonconfig.xml
```

Update configuration:

```powershell
.\Sysmon64.exe -c sysmonconfig.xml
```

### Recommended Configuration

Use a community-maintained config as a starting point. The SwiftOnSecurity config is widely used:

https://github.com/SwiftOnSecurity/sysmon-config

The Olaf Hartong modular config provides more granular control:

https://github.com/olafhartong/sysmon-modular

### Key Sysmon Event IDs

| Event ID | Description | Why It Matters |
|----------|-------------|----------------|
| 1 | Process creation | Tracks every process, including parent process, command line, hashes |
| 2 | File creation time changed | Detects timestomping (attackers hiding file modification times) |
| 3 | Network connection | Logs outbound connections with process info |
| 6 | Driver loaded | Detects malicious kernel drivers |
| 7 | Image loaded (DLL) | Detects DLL injection and side-loading |
| 8 | CreateRemoteThread | Detects process injection |
| 10 | Process access | Detects LSASS credential dumping attempts |
| 11 | File created | New files written to disk |
| 12/13/14 | Registry events | Registry key creation, modification, deletion |
| 15 | FileCreateStreamHash | Alternate data streams (ADS) creation |
| 17/18 | Pipe events | Named pipe creation/connection (used in lateral movement) |
| 22 | DNS query | DNS lookups with process info |
| 23 | File delete | File deletion with hash archive |
| 25 | Process tampering | Detects process hollowing and herpaderping |

### High-Value Sysmon Detections

**LSASS access (credential dumping):** Event ID 10 where TargetImage contains `lsass.exe`. Filter out legitimate callers like `csrss.exe`, `services.exe`, and your AV product.

**Process injection:** Event ID 8 (CreateRemoteThread) from unexpected source processes.

**Suspicious process trees:** Event ID 1 where `cmd.exe` or `powershell.exe` is spawned by `w3wp.exe` (IIS), `sqlservr.exe`, or `java.exe` — indicates web shell or application-level compromise.

**Encoded PowerShell:** Event ID 1 where CommandLine contains `-enc`, `-EncodedCommand`, or `FromBase64String`.

### Querying Sysmon Logs

```powershell
# All Sysmon process creation events
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Sysmon/Operational'; ID=1} -MaxEvents 50

# Process creation with specific keyword
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Sysmon/Operational'; ID=1} | Where-Object { $_.Message -match "mimikatz|rubeus|sharphound" }

# Network connections
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Sysmon/Operational'; ID=3} -MaxEvents 50

# LSASS access attempts
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Sysmon/Operational'; ID=10} | Where-Object { $_.Message -match "lsass" }
```

---

## Key Windows Event IDs

Beyond Sysmon, the default Windows Security and System logs contain valuable events.

### Authentication Events

| Event ID | Log | Description |
|----------|-----|-------------|
| 4624 | Security | Successful logon |
| 4625 | Security | Failed logon |
| 4634 | Security | Logoff |
| 4648 | Security | Logon with explicit credentials (runas) |
| 4672 | Security | Special privileges assigned to new logon (admin) |

### Logon Types (Event 4624/4625)

| Type | Description | Concern |
|------|-------------|---------|
| 2 | Interactive (console) | Normal |
| 3 | Network (SMB, WinRM) | Lateral movement |
| 4 | Batch (scheduled task) | Could be persistence |
| 5 | Service | Service account logon |
| 7 | Unlock | Screensaver unlock |
| 8 | NetworkCleartext | Plaintext creds over network |
| 9 | NewCredentials (runas /netonly) | Credential theft |
| 10 | RemoteInteractive (RDP) | Lateral movement |

### Account and Group Management

| Event ID | Description |
|----------|-------------|
| 4720 | User account created |
| 4722 | User account enabled |
| 4724 | Password reset attempted |
| 4728 | Member added to security-enabled global group |
| 4732 | Member added to security-enabled local group |
| 4756 | Member added to security-enabled universal group |

### Process and Service Events

| Event ID | Log | Description |
|----------|-----|-------------|
| 4688 | Security | New process created (enable command-line auditing for full value) |
| 4689 | Security | Process exited |
| 7045 | System | Service installed |
| 7040 | System | Service start type changed |

### PowerShell Events

| Event ID | Log | Description |
|----------|-----|-------------|
| 4103 | PowerShell/Operational | Module logging |
| 4104 | PowerShell/Operational | Script block logging (full script content) |
| 400 | Windows PowerShell | Engine start (PowerShell session opened) |
| 403 | Windows PowerShell | Engine stop |

:::tip
Event ID 4104 (Script Block Logging) is the single most valuable PowerShell detection source. It records the full content of every script, including deobfuscated content from encoded commands. Enable it on every Windows system.
:::

---

## PowerShell Logging Configuration

### Script Block Logging

Records the full content of all PowerShell scripts as they execute:

```powershell
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging" /v EnableScriptBlockLogging /t REG_DWORD /d 1 /f
```

### Module Logging

Records pipeline execution details for specified modules:

```powershell
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ModuleLogging" /v EnableModuleLogging /t REG_DWORD /d 1 /f
```

### Transcription

Records all input and output in PowerShell sessions to text files:

```powershell
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\Transcription" /v EnableTranscripting /t REG_DWORD /d 1 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\Transcription" /v OutputDirectory /t REG_SZ /d "C:\PSTranscripts" /f
```

---

## Linux Endpoint Monitoring

### auditd

The Linux audit daemon provides detailed system call auditing. See the [Linux Hardening](/defensive/hardening/linux/linux-hardening#audit-and-logging) page for installation and configuration.

Key audit rules for detection:

```bash
# Process execution monitoring
-a always,exit -F arch=b64 -S execve -k exec_monitor

# File access monitoring
-w /etc/shadow -p r -k shadow_read
-w /etc/passwd -p wa -k passwd_change

# Privilege escalation monitoring
-w /usr/bin/sudo -p x -k sudo_exec
-w /usr/bin/su -p x -k su_exec

# SSH key modification
-w /root/.ssh/ -p wa -k ssh_keys
-w /home/ -p wa -k home_changes

# Module loading
-a always,exit -F arch=b64 -S init_module -S finit_module -k kernel_modules
```

Search audit logs:

```bash
sudo ausearch -k exec_monitor --start today
sudo ausearch -k shadow_read
sudo aureport --auth
```

### osquery

osquery exposes the operating system as a relational database, allowing you to query system state using SQL.

Install: https://osquery.io/downloads/official

Example queries:

```sql
-- Running processes
SELECT pid, name, path, cmdline, uid FROM processes;

-- Listening ports
SELECT pid, port, address, protocol FROM listening_ports;

-- Users
SELECT uid, username, shell FROM users;

-- Cron jobs
SELECT * FROM crontab;

-- Loaded kernel modules
SELECT name, size, status FROM kernel_modules;

-- Open files
SELECT pid, path FROM process_open_files WHERE pid IN (SELECT pid FROM processes WHERE name = 'suspicious');

-- SSH authorized keys
SELECT * FROM authorized_keys;

-- Installed packages
SELECT name, version FROM deb_packages;
```

Run interactively:

```bash
osqueryi
```

Or schedule queries with osquery's configuration for continuous monitoring.

### Log Files to Monitor

| Log | Location | Content |
|-----|----------|---------|
| Auth log | `/var/log/auth.log` (Debian) or `/var/log/secure` (RHEL) | Authentication events, sudo usage, SSH logins |
| Syslog | `/var/log/syslog` | General system messages |
| Kernel log | `/var/log/kern.log` | Kernel messages, module loading |
| Cron log | `/var/log/cron.log` | Cron job execution |
| Apache/Nginx | `/var/log/apache2/` or `/var/log/nginx/` | Web server access and errors |

---

## EDR Concepts

Endpoint Detection and Response (EDR) solutions go beyond traditional AV by continuously monitoring endpoint activity and providing investigation capabilities.

### What EDR Monitors

- Process creation and termination (with full command lines and parent chains)
- File system activity (creation, modification, deletion)
- Registry changes
- Network connections (with process correlation)
- DLL loading
- Memory injection techniques
- Credential access (LSASS interaction)

### Common EDR Solutions

Enterprise: CrowdStrike Falcon, Microsoft Defender for Endpoint, SentinelOne, Carbon Black, Elastic Security (free/open).

### Detection vs Prevention

EDR operates in two modes: detection (alert on suspicious activity) and prevention (automatically block/kill malicious processes). Most organizations run EDR in prevention mode for known threats and detection mode for behavioral anomalies that require analyst review.

:::tip
From a red team perspective, understanding what EDR monitors helps you understand what to avoid. From a blue team perspective, EDR visibility gaps (like unmonitored Linux hosts or network devices) are your blind spots.
:::
