---
sidebar_position: 0
title: MITRE ATT&CK
---

# Red Team Methodology

This methodology follows the [MITRE ATT&CK](https://attack.mitre.org/) framework — the industry standard for categorizing adversary behavior. Each tactic below represents a phase of an attack, with links to the relevant pages on this site.

```bash
# Set these at the start of every engagement session
export TARGET=<ip>
export SUBNET=<cidr>
export DOMAIN=<domain>
export USER=<username>
export PASSWORD=<password>
export LHOST=<your-ip>
export LPORT=<port>
export HASH=<ntlm-hash>
```

---

## 1. Reconnaissance (TA0043)

Gather information about the target before direct interaction. Understand the attack surface — domains, employees, technologies, and infrastructure.

**Passive (no direct contact with target):**
- [Google Dorking](/red-teaming/recon/passive/google-dorking) — search engine operators to find exposed files, directories, and information
- [OSINT Tools](/red-teaming/recon/passive/osint-tools) — theHarvester, Shodan, Netcraft, subdomain enumeration, certificate transparency, GitHub secret scanning, metadata analysis

**Active (direct interaction with target):**
- [Port Scanning](/red-teaming/recon/active/port-scanning) — Nmap, masscan, service version detection
- [DNS Enumeration](/red-teaming/recon/active/dns-enumeration) — zone transfers, brute forcing, dnsrecon, dnsenum
- [SMB Enumeration](/red-teaming/recon/active/smb-enumeration) — share enumeration, null sessions, enum4linux
- [SMTP & SNMP Enumeration](/red-teaming/recon/active/smtp-snmp-enumeration) — user enumeration, community string brute forcing

---

## 2. Resource Development (TA0042)

Prepare the tools, infrastructure, and payloads needed for the engagement.

- Generate payloads with [msfvenom](/red-teaming/c2/metasploit#msfvenom-payload-generation) — reverse shells, DLLs, MSI packages, web shells
- Apply [AV Evasion](/red-teaming/evasion/av-evasion) techniques — AMSI bypass, encoding, custom loaders, LOLBins
- Set up listeners and C2 infrastructure — [Metasploit](/red-teaming/c2/metasploit), Sliver, or other frameworks
- Prepare [File Transfer](/misc/file-transfer) methods — HTTP servers, SMB shares, upload servers

---

## 3. Initial Access (TA0001)

Gain a foothold on the target network. The entry point depends on what reconnaissance revealed.

- [Web Application Attacks](/red-teaming/enumeration/web/methodology) — identify and exploit web vulnerabilities
- [SQL Injection](/red-teaming/exploitation/web/sql-injection) — database attacks, OS command execution via SQLi
- [Path Traversal & LFI](/red-teaming/exploitation/web/path-traversal-lfi) — file read, log poisoning, PHP wrappers, RCE via file inclusion
- [Cross-Site Scripting](/red-teaming/exploitation/web/xss) — session hijacking, phishing via XSS
- [Client-Side Attacks](/red-teaming/exploitation/phishing/client-side-attacks) — Office macros, HTA payloads, phishing, malicious shortcuts
- [Public Exploits](/red-teaming/exploitation/network/public-exploits) — searchsploit, Exploit-DB, CVE exploitation
- [Password Attacks](/red-teaming/exploitation/passwords/password-attacks) — spraying, brute forcing, cracking
- [Service Enumeration](/red-teaming/enumeration/network/service-enumeration) — per-service attack procedures for FTP, SSH, SMB, RDP, databases, Redis, etc.

---

## 4. Execution (TA0002)

Run attacker-controlled code on the target system.

- [Metasploit Framework](/red-teaming/c2/metasploit) — exploit modules, Meterpreter, payload execution
- PowerShell and cmd.exe execution techniques covered across the [AV Evasion](/red-teaming/evasion/av-evasion) page (encoded commands, LOLBins, AMSI bypass)
- WMI and DCOM execution covered in [AD Lateral Movement](/red-teaming/active-directory/lateral-movement/lateral-movement)

---

## 5. Persistence (TA0003)

Maintain access across reboots, credential changes, and network interruptions.

- [Persistence](/red-teaming/post-exploitation/persistence/persistence) — scheduled tasks, registry run keys, services, DLL hijacking, WMI subscriptions, cron jobs, SSH keys, systemd, SUID backdoors
- [AD Persistence](/red-teaming/active-directory/persistence/ad-persistence) — golden/silver/diamond tickets, skeleton key, AdminSDHolder, ACL abuse, SID history, DSRM, certificate forgery, machine accounts

---

## 6. Privilege Escalation (TA0004)

Gain higher-level permissions on a compromised system.

- [Windows Privilege Escalation](/red-teaming/post-exploitation/privilege-escalation/windows) — service hijacking, unquoted paths, DLL hijacking, registry abuse, scheduled tasks, AlwaysInstallElevated, potato attacks, token impersonation, kernel exploits, UAC bypass
- [Linux Privilege Escalation](/red-teaming/post-exploitation/privilege-escalation/linux) — sudo abuse, SUID/SGID, capabilities, cron jobs, kernel exploits, Docker/LXD group, wildcard injection, NFS no_root_squash, weak file permissions

---

## 7. Defense Evasion (TA0005)

Avoid detection by security tools and monitoring.

- [AV Evasion](/red-teaming/evasion/av-evasion) — AMSI bypass, PowerShell Constrained Language Mode bypass, payload encoding/obfuscation, custom shellcode loaders, process injection, living off the land binaries

---

## 8. Credential Access (TA0006)

Steal credentials for further access and lateral movement.

- [Credential Harvesting](/red-teaming/post-exploitation/credential-harvesting/credential-harvesting) — Mimikatz, LSASS dumps, SAM extraction, DPAPI, browser credentials, WiFi passwords, registry secrets, Linux config files, SSH keys, Responder, NTLM relay
- [AD Authentication Attacks](/red-teaming/active-directory/authentication-attacks/authentication-attacks) — AS-REP Roasting, Kerberoasting, password spraying, DC Sync, NTLM relay, coercion attacks (PetitPotam, PrinterBug), ADCS attacks, shadow credentials
- [Password Attacks](/red-teaming/exploitation/passwords/password-attacks) — hash cracking (Hashcat, John), wordlist mutation, credential spraying

---

## 9. Discovery (TA0007)

Learn about the environment — users, groups, systems, shares, and trust relationships.

- [AD Enumeration](/red-teaming/active-directory/enumeration/ad-enumeration) — net commands, LDAP queries, PowerView, BloodHound/SharpHound, NetExec, Kerbrute, GPO/trust/ACL enumeration
- [Service Enumeration](/red-teaming/enumeration/network/service-enumeration) — per-service enumeration for every common port
- [Web App Methodology](/red-teaming/enumeration/web/methodology) — technology fingerprinting, directory brute forcing, manual inspection

---

## 10. Lateral Movement (TA0008)

Move between systems in the target network to reach high-value targets.

- [AD Lateral Movement](/red-teaming/active-directory/lateral-movement/lateral-movement) — WMI, WinRM, PsExec, pass-the-hash, overpass-the-hash, pass-the-ticket, DCOM, silver/golden tickets, shadow copies
- [Pivoting & Tunneling](/red-teaming/pivoting/pivoting) — SSH tunneling, Chisel, Ligolo-ng, sshuttle, Proxychains, netsh, plink, DNS/ICMP tunneling, Meterpreter pivoting, double pivoting

---

## 11. Collection (TA0009)

Gather data of interest from compromised systems before exfiltration.

- Staging and compression techniques covered in [Data Exfiltration](/red-teaming/post-exploitation/data-exfiltration/data-exfiltration#staging-and-preparation)
- Sensitive file discovery commands covered in [Windows Privesc](/red-teaming/post-exploitation/privilege-escalation/windows#post-exploit-survey-information-gathering) and [Credential Harvesting](/red-teaming/post-exploitation/credential-harvesting/credential-harvesting)

---

## 12. Command and Control (TA0011)

Maintain communication with compromised systems.

- [Metasploit Framework](/red-teaming/c2/metasploit) — multi/handler, Meterpreter sessions, pivoting, post-exploitation modules
- [Pivoting & Tunneling](/red-teaming/pivoting/pivoting) — Chisel, Ligolo-ng, DNS tunneling, ICMP tunneling for C2 in restricted environments

---

## 13. Exfiltration (TA0010)

Transfer collected data out of the target environment.

- [Data Exfiltration](/red-teaming/post-exploitation/data-exfiltration/data-exfiltration) — HTTP/HTTPS, SMB, DNS, ICMP, netcat, SCP, base64 encoding, cloud storage exfiltration
- [File Transfer](/misc/file-transfer) — all methods for moving files between attacker and target

---

## 14. Impact (TA0040)

Disrupt, destroy, or manipulate systems and data. In an authorized engagement, impact is typically limited to demonstrating the *capability* rather than actually causing damage — proving that ransomware deployment, data destruction, or service disruption *would be possible* given the access achieved.

---

## Engagement Workflow Tips

:::warning Golden Rule
Read read READ the scan outputs. Read every line, actually analyze the output for usernames, passwords, useful information, CVEs, etc.
:::

### Work Methodically

For every target, follow the methodology above in order. Don't jump between targets — this causes things to be forgotten and missed.

### Enumerate Every Service

For every single service discovered on a target, search for `<service> exploit`, `<service> poc`, and try multiple tools to enumerate each one. Don't skip a service because it looks uninteresting.

### Collect Everything

- Add all discovered usernames to `usernames.txt`
- Add all discovered passwords to `passwords.txt`
- Check websites for potential custom wordlist crafting (CeWL)
- Save all scan output for later review
- Try every credential against every service (password reuse is extremely common)

### Web Services Checklist

When you find a web server, run through the full stack — don't skip steps: Nikto, GoBuster/feroxbuster (try multiple wordlists), subdomain enumeration, source code inspection, and input field analysis.

:::tip
Setting environment variables once at the start of a session means you can copy/paste commands directly from these notes without editing IPs every time.
:::
