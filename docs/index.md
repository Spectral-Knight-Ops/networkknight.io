---
sidebar_position: 0
slug: /
title: Welcome
---

# NetworkKnight

Personal cybersecurity knowledge base — red team techniques, defensive operations, tools, and project documentation.

## Quick Navigation

- **[Red Teaming](/red-teaming/methodology)** — Offensive techniques from recon through post-exploitation
- **[Active Directory](/red-teaming/active-directory/enumeration/ad-enumeration)** — AD enumeration, authentication attacks, lateral movement
- **[Privilege Escalation (Windows)](/red-teaming/post-exploitation/privilege-escalation/windows)** — Full Windows privesc methodology
- **[Privilege Escalation (Linux)](/red-teaming/post-exploitation/privilege-escalation/linux)** — Full Linux privesc methodology
- **[Defensive](/defensive/siem/elastic/elastic)** — SIEM, monitoring, incident response, hardening
- **[Projects](/projects/honeypot/honeypot)** — Hands-on project documentation

## Environment Variables

All command examples across this site use standard variable names. Set them once at the start of a session:

```bash
export TARGET=<ip>
export SUBNET=<cidr>
export DOMAIN=<domain>
export USER=<username>
export PASSWORD=<password>
export LHOST=<your-ip>
export LPORT=4444
export HASH=<ntlm-hash>
```
