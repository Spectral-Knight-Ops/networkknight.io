---
sidebar_position: 0
slug: /
title: Welcome
---

# <img src="/img/knight-split-logo.png" alt="logo" style={{height: '80px', verticalAlign: 'middle', marginRight: '5px'}} />Network Knight

NetworkKnight is a structured cybersecurity knowledge base focused on offensive security, defensive operations, and practical security engineering.

The goal is to document real-world techniques, tools, and methodologies used across the cyber kill chain — from reconnaissance and initial access through detection engineering and incident response.

This project serves as:

• A personal knowledge repository  
• A reference for security practitioners  
• A growing library of hands-on cybersecurity projects

## Quick Navigation

- **[Red Teaming](/red-teaming/methodology)** — Offensive techniques from recon through post-exploitation
- **[Active Directory](/red-teaming/active-directory/enumeration/ad-enumeration)** — AD enumeration, authentication attacks, lateral movement
- **[Privilege Escalation (Windows)](/red-teaming/post-exploitation/privilege-escalation/windows)** — Full Windows privesc methodology
- **[Privilege Escalation (Linux)](/red-teaming/post-exploitation/privilege-escalation/linux)** — Full Linux privesc methodology
- **[Defensive](/defensive/siem/elastic/elastic)** — SIEM, monitoring, incident response, hardening
- **[Projects](/projects/honeypot/honeypot)** — Hands-on project documentation

## Environment Variables

All command examples across this site use standard variable names. Set these variables at the start of your session:

```bash
export TARGET=<ip>
export SUBNET=<cidr>
export DOMAIN=<domain>
export USER=<username>
export PASSWORD=<password>
export LHOST=<your-ip>
export LPORT=<port>
export HASH=<ntlm-hash>
```
