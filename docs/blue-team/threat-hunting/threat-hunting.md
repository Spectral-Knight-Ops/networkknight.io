---
sidebar_position: 1
title: Threat Hunting
---

# Threat Hunting

Threat hunting is the proactive search for threats that have evaded automated detection. Unlike monitoring (which waits for alerts), hunting starts with a hypothesis and systematically investigates whether an attacker is present in the environment.

---

## Hunting Methodologies

### Hypothesis-Driven Hunting

Start with a hypothesis based on threat intelligence, attacker TTPs, or known vulnerabilities:

- "An attacker may have compromised a web server and is using it to pivot internally."
- "An insider may be exfiltrating data via DNS tunneling."
- "A service account may have been Kerberoasted and its password cracked."

Then investigate: what evidence would confirm or refute this hypothesis? Which data sources would show it? What queries would surface the activity?

### IOC-Based Hunting

Search for specific indicators of compromise: IP addresses, domain names, file hashes, registry keys, or other artifacts from threat intelligence feeds.

This is the most straightforward hunting approach but only catches known threats.

### TTP-Based Hunting (MITRE ATT&CK)

Hunt for attacker techniques rather than specific indicators. TTPs are harder for attackers to change than IOCs. Use the MITRE ATT&CK framework to systematically hunt for each technique relevant to your environment.

:::tip
TTP-based hunting is the most effective long-term approach because it catches novel attacks that use known techniques. IOCs get outdated quickly — attacker infrastructure changes constantly — but techniques remain relatively stable.
:::

---

## MITRE ATT&CK Framework

ATT&CK (Adversarial Tactics, Techniques, and Common Knowledge) catalogs attacker behavior in a structured matrix. Use it to organize hunts systematically.

Reference: https://attack.mitre.org/

### Tactics (Columns)

Each tactic represents an attacker's goal at a stage of the attack:

| Tactic | Description | Example Techniques |
|--------|-------------|--------------------|
| Initial Access | Getting into the network | Phishing, exploiting public-facing apps |
| Execution | Running malicious code | PowerShell, command-line, WMI |
| Persistence | Maintaining access | Scheduled tasks, registry run keys, services |
| Privilege Escalation | Getting higher permissions | Token manipulation, exploiting vulns |
| Defense Evasion | Avoiding detection | AMSI bypass, log clearing, timestomping |
| Credential Access | Stealing credentials | Mimikatz, Kerberoasting, LLMNR poisoning |
| Discovery | Learning the environment | AD enumeration, network scanning |
| Lateral Movement | Moving between systems | PsExec, WinRM, pass-the-hash |
| Collection | Gathering target data | Keylogging, screen capture |
| Exfiltration | Stealing data | HTTP exfil, DNS tunneling |
| Command and Control | Communicating with implants | HTTP/HTTPS beaconing, DNS C2 |

### Using ATT&CK for Hunt Prioritization

Map your existing detections to ATT&CK techniques. Identify gaps — techniques with no detection coverage. Prioritize hunts for uncovered techniques that are commonly used by threat actors targeting your industry.

---

## Hunting Playbooks

Structured procedures for hunting specific threats. Each playbook defines: the hypothesis, required data sources, queries to run, what to look for, and response actions.

### Playbook: Credential Dumping (T1003)

**Hypothesis:** An attacker has dumped credentials from LSASS memory.

**Data sources:** Sysmon Event ID 10 (ProcessAccess), Event ID 1 (ProcessCreate), EDR telemetry.

**Hunt queries:**

Sysmon — LSASS access from unexpected processes:

```
# Elastic KQL
event.code: 10 and winlog.event_data.TargetImage: *lsass.exe and not winlog.event_data.SourceImage: (*csrss.exe or *services.exe or *lsm.exe or *MsMpEng.exe or *svchost.exe)
```

```spl
# Splunk SPL
index=sysmon EventCode=10 TargetImage="*lsass.exe" NOT SourceImage IN ("*csrss.exe","*services.exe","*lsm.exe","*MsMpEng.exe","*svchost.exe")
| table _time, Computer, SourceImage, GrantedAccess
```

**What to look for:** unexpected processes accessing LSASS, especially from user directories, temp folders, or non-standard paths. High-risk GrantedAccess values: `0x1010` (read VM), `0x1FFFFF` (all access).

### Playbook: Lateral Movement via PsExec (T1021.002)

**Hypothesis:** An attacker is using PsExec or similar tools for lateral movement.

**Data sources:** Windows Security Event ID 7045, Sysmon Event ID 1, network logs.

**Hunt queries:**

New service installations:

```
# Elastic KQL
event.code: 7045 and not winlog.event_data.ServiceFileName: (*Windows* or *Microsoft* or *svchost*)
```

```spl
# Splunk SPL
index=wineventlog EventCode=7045 NOT ServiceFileName IN ("*Windows*","*Microsoft*","*svchost*")
| table _time, Computer, ServiceName, ServiceFileName
```

SMB followed by service creation (EQL):

```
sequence by host.name with maxspan=5m
  [network where destination.port == 445]
  [any where event.code == "7045"]
```

**What to look for:** services with random names, binaries in temp directories or user folders, services created and immediately deleted.

### Playbook: Kerberoasting (T1558.003)

**Hypothesis:** An attacker has requested service tickets for offline cracking.

**Data sources:** Windows Security Event ID 4769, domain controller logs.

**Hunt queries:**

```
# Elastic KQL
event.code: 4769 and winlog.event_data.TicketEncryptionType: 0x17 and not winlog.event_data.ServiceName: krbtgt
```

```spl
# Splunk SPL
index=wineventlog EventCode=4769 TicketEncryptionType=0x17 ServiceName!="krbtgt"
| stats count by ServiceName, TargetUserName, IpAddress
| where count > 3
```

**What to look for:** a single user requesting many service tickets in a short time, especially with RC4 encryption (type 0x17 — attackers request RC4 because it's faster to crack).

### Playbook: DNS Exfiltration (T1048.001)

**Hypothesis:** An attacker is tunneling data out via DNS.

**Data sources:** DNS logs (Zeek, Sysmon Event ID 22, DNS server logs).

**Hunt queries:**

```
# Elastic KQL
dns.question.name: * and not dns.question.name: (*.microsoft.com or *.windowsupdate.com or *.office.com)
```

Aggregate by domain and look for anomalies:

```spl
# Splunk SPL
index=dns | rex field=query "\.(?<root_domain>[^\.]+\.[^\.]+)$"
| stats count, avg(query_length) as avg_len, max(query_length) as max_len by root_domain, src_ip
| where count > 100 OR avg_len > 40
| sort -count
```

**What to look for:** high query volume to a single domain, unusually long subdomain labels (>30 characters), queries with high entropy (random-looking strings), TXT record queries in bulk.

### Playbook: Persistence via Scheduled Tasks (T1053.005)

**Hypothesis:** An attacker has created a scheduled task for persistence.

**Data sources:** Sysmon Event ID 1, Windows Security Event ID 4698, Event ID 4702.

**Hunt queries:**

```spl
# Splunk SPL
index=wineventlog (EventCode=4698 OR EventCode=4702) | table _time, Computer, TaskName, SubjectUserName
index=sysmon EventCode=1 Image="*schtasks.exe" | table _time, Computer, User, CommandLine
```

**What to look for:** tasks created by non-admin users, tasks with base64-encoded commands, tasks that execute from temp directories or user profiles, tasks running as SYSTEM created by standard users.

---

## Data Sources for Hunting

| Data Source | Provides | Key for Detecting |
|-------------|----------|-------------------|
| Windows Security Logs | Authentication, account management, privilege use | Brute force, credential abuse, account manipulation |
| Sysmon | Process creation, network connections, file creation, registry | Execution, lateral movement, persistence, C2 |
| PowerShell Logs | Script content, module execution | Malicious scripts, encoded commands, tool usage |
| DNS Logs | Query names, types, volume | Exfiltration, C2, DGA domains |
| Proxy/Firewall Logs | URLs, user agents, traffic volume | C2 beaconing, exfiltration, initial access |
| EDR Telemetry | Process trees, file operations, memory activity | Everything — most comprehensive source |
| NetFlow | Connection metadata (no content) | Lateral movement patterns, beaconing, exfiltration volume |
| Active Directory Logs | Kerberos events, LDAP queries, replication | Kerberoasting, DCSync, enumeration |

---

## Hunt Reporting

Document every hunt with: date, hypothesis, data sources queried, queries used, findings, false positives identified, and recommendations. Even hunts that find nothing are valuable — they prove that specific threats were not present during the hunting period and help refine future detection rules.

### Hunt-to-Detection Pipeline

When a hunt identifies a valid detection technique, convert it into an automated detection rule:

1. Validate the hunt query produces reliable results with low false positives
2. Create a detection rule in your SIEM (Elastic Security, Splunk ES, etc.)
3. Define alert severity and response actions
4. Document the rule with ATT&CK technique mapping
5. Monitor the rule for false positive rates and tune as needed

:::tip
The best SOCs use a cycle: threat intelligence informs hunt hypotheses, hunts validate detection gaps, successful hunts become automated detections, and detections generate alerts for analysts. Each hunt makes your automated detection better.
:::
