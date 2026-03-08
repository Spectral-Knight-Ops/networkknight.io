---
sidebar_position: 1
title: Splunk
---

# Splunk

Splunk is a SIEM platform for collecting, indexing, searching, and visualizing machine data. This page covers SPL (Search Processing Language) fundamentals, common search commands, data inputs, and security detection searches.

---

## Architecture

**Indexer** — receives, indexes, and stores data. Processes search queries.

**Forwarder** — lightweight agent installed on endpoints to collect and forward data.
- Universal Forwarder (UF) — forwards raw data, no local parsing
- Heavy Forwarder (HF) — can parse and filter data before forwarding

**Search Head** — provides the web interface for searching, visualization, and dashboards.

### Data Flow

```
Data Sources (Forwarders, APIs, syslog)
    → Indexer (parsing, indexing, storage)
    → Search Head (queries, dashboards, alerts)
```

### Default Ports

| Port | Service |
|------|---------|
| 8000 | Splunk Web (Search Head) |
| 8089 | Splunk management / REST API |
| 9997 | Forwarder-to-Indexer data input |
| 514 | Syslog input (if configured) |

---

## SPL Fundamentals

### Basic Search

Every SPL search starts with a search term or index specification:

```spl
index=main sourcetype=WinEventLog:Security EventCode=4625
```

### Time Range

Specify time in the search or use the time picker. SPL time modifiers:

```spl
index=main earliest=-24h latest=now
index=main earliest=-7d@d latest=@d
```

### Field Extraction

Splunk auto-extracts common fields. Reference fields directly:

```spl
index=main sourcetype=WinEventLog:Security EventCode=4625 src_ip=192.168.1.100
```

### Wildcards

```spl
index=main user=admin*
index=main process_name=*mimikatz*
```

### Boolean Operators

```spl
index=main EventCode=4625 AND src_ip=192.168.1.100
index=main EventCode=4625 OR EventCode=4624
index=main EventCode=4625 NOT user=SYSTEM
```

---

## Common Search Commands

### stats

Aggregate data:

```spl
index=main EventCode=4625 | stats count by src_ip
index=main EventCode=4625 | stats count by src_ip, user | sort -count
index=main EventCode=4624 | stats dc(user) as unique_users by src_ip
index=main sourcetype=sysmon EventCode=3 | stats sum(bytes_out) as total_bytes by dest_ip | sort -total_bytes
```

### table

Display specific fields:

```spl
index=main EventCode=4624 | table _time, user, src_ip, LogonType
```

### where

Filter with expressions:

```spl
index=main EventCode=4625 | stats count by src_ip | where count > 10
```

### sort

```spl
index=main EventCode=4625 | stats count by src_ip | sort -count
```

### top / rare

Most and least common values:

```spl
index=main EventCode=4625 | top src_ip
index=main EventCode=1 | rare process_name
```

### timechart

Time-series visualization:

```spl
index=main EventCode=4625 | timechart span=1h count by src_ip
index=main EventCode=1 | timechart span=5m count
```

### eval

Create calculated fields:

```spl
index=main sourcetype=sysmon EventCode=3 | eval MB=bytes_out/1024/1024 | table _time, process_name, dest_ip, MB
```

### transaction

Group related events:

```spl
index=main EventCode=4624 OR EventCode=4634 | transaction user startswith=EventCode=4624 endswith=EventCode=4634 | table user, duration
```

### lookup

Enrich events with external data:

```spl
index=main EventCode=4625 | lookup threat_intel.csv ip AS src_ip OUTPUT threat_category | where isnotnull(threat_category)
```

### rex

Extract fields with regex:

```spl
index=main sourcetype=access_combined | rex "(?<client_ip>\d+\.\d+\.\d+\.\d+)" | stats count by client_ip
```

---

## Data Inputs

### Windows Event Logs

Configure the Universal Forwarder's `inputs.conf`:

```ini
[WinEventLog://Security]
disabled = 0
index = wineventlog

[WinEventLog://System]
disabled = 0
index = wineventlog

[WinEventLog://Microsoft-Windows-Sysmon/Operational]
disabled = 0
index = sysmon
renderXml = true

[WinEventLog://Microsoft-Windows-PowerShell/Operational]
disabled = 0
index = wineventlog
```

### Syslog

Receive syslog from network devices, Linux hosts, and firewalls:

```ini
[udp://514]
sourcetype = syslog
index = network
```

### File Monitoring

Monitor log files on the local system:

```ini
[monitor:///var/log/auth.log]
sourcetype = linux_auth
index = linux

[monitor:///var/log/apache2/access.log]
sourcetype = access_combined
index = web
```

---

## Security Detection Searches

### Brute Force Detection

Multiple failed logons from the same source:

```spl
index=wineventlog EventCode=4625 | stats count by src_ip | where count > 10 | sort -count
```

Failed logons followed by a success (potential successful brute force):

```spl
index=wineventlog (EventCode=4625 OR EventCode=4624) | transaction src_ip maxspan=10m | where eventcount > 5 AND EventCode=4624
```

### Password Spraying Detection

Same password tested against multiple accounts (one source, many users, few attempts per user):

```spl
index=wineventlog EventCode=4625 | stats dc(user) as unique_users, count by src_ip | where unique_users > 5 AND count < unique_users*3
```

### Suspicious Process Execution

PowerShell with encoded commands:

```spl
index=sysmon EventCode=1 (CommandLine="*-enc*" OR CommandLine="*-EncodedCommand*" OR CommandLine="*FromBase64String*")
| table _time, Computer, User, ParentCommandLine, CommandLine
```

Web server spawning cmd/PowerShell:

```spl
index=sysmon EventCode=1 ParentImage="*w3wp.exe" (Image="*cmd.exe" OR Image="*powershell.exe")
| table _time, Computer, User, ParentCommandLine, CommandLine
```

### Credential Dumping

LSASS access (Sysmon Event ID 10):

```spl
index=sysmon EventCode=10 TargetImage="*lsass.exe" NOT SourceImage IN ("*csrss.exe","*services.exe","*MsMpEng.exe")
| table _time, Computer, SourceImage, GrantedAccess
```

### Lateral Movement

PsExec-style activity:

```spl
index=wineventlog EventCode=7045 ServiceFileName="*PSEXESVC*"
| table _time, Computer, ServiceName, ServiceFileName
```

WinRM connections:

```spl
index=wineventlog EventCode=4624 LogonType=3 TargetPort=5985
| stats count by src_ip, dest | sort -count
```

### New Service Installation

```spl
index=wineventlog EventCode=7045
| table _time, Computer, ServiceName, ServiceFileName, ServiceStartType
```

### Account Changes

New user accounts:

```spl
index=wineventlog EventCode=4720 | table _time, Computer, TargetUserName, SubjectUserName
```

Group membership changes:

```spl
index=wineventlog (EventCode=4728 OR EventCode=4732 OR EventCode=4756)
| table _time, Computer, TargetUserName, MemberName, GroupName
```

### DNS Exfiltration

Unusually long DNS queries:

```spl
index=dns | eval query_len=len(query) | where query_len > 50 | stats count by query, src_ip | sort -count
```

High volume of DNS queries to a single domain:

```spl
index=dns | rex field=query "\.(?<root_domain>[^\.]+\.[^\.]+)$" | stats count by root_domain, src_ip | where count > 100 | sort -count
```

---

## Dashboards

### Creating a Security Dashboard

Navigate to Dashboards → Create New Dashboard.

Recommended panels:

- **Failed Authentication Timeline** — timechart of Event ID 4625
- **Top Failed Logon Sources** — stats count by src_ip, bar chart
- **Successful Admin Logons** — Event ID 4672, table view
- **New Accounts Created** — Event ID 4720, event list
- **Suspicious Process Execution** — Sysmon EventCode=1 filtered for high-risk binaries
- **Network Connections by Process** — Sysmon EventCode=3, pie chart by process_name
- **Alert Summary** — notable events from Splunk ES or custom alerts

### Scheduled Searches / Alerts

Create alerts that run on a schedule and trigger actions (email, webhook, notable event):

```spl
index=wineventlog EventCode=4625 | stats count by src_ip | where count > 20
```

Schedule: every 15 minutes. Action: send email to SOC and create notable event.

---

## Splunk Enterprise Security (ES)

Splunk ES is the premium SIEM app that adds: correlation searches, notable events, investigation workbench, risk-based alerting, and MITRE ATT&CK mapping.

Key ES concepts: notable events are generated by correlation searches and appear in the Incident Review dashboard. Analysts triage, investigate, and close notable events.

:::tip
Even without ES, you can build effective detection by creating scheduled searches that write results to a summary index and alerting on matches. ES adds workflow and case management, but the core detection capability is in SPL.
:::
