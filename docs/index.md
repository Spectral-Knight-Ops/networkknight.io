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

- **[Red Team](/red-team/MITRE%20ATT&CK)** — Offensive techniques from recon through post-exploitation
- **[Active Directory](/red-team/active-directory/enumeration/ad-enumeration)** — AD enumeration, authentication attacks, lateral movement
- **[Privilege Escalation (Windows)](/red-team/post-exploitation/privilege-escalation/windows)** — Full Windows privesc methodology
- **[Privilege Escalation (Linux)](/red-team/post-exploitation/privilege-escalation/linux)** — Full Linux privesc methodology
- **[Blue Team](/blue-team/siem/elastic)** — SIEM, monitoring, incident response, hardening
- **[Projects](/projects/local-llm-evaluator)** — Hands-on project documentation

## Environment Variables

All command examples across this site use standard variable names. Instead of exporting these in each terminal session, add them to your shell configuration file so they persist across all terminals.

Edit `~/.zshrc` (or `~/.bashrc` if using Bash):

```bash
nano ~/.zshrc
```

Add your variables at the bottom of the file:

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

Save the file with `Ctrl+X`, then press `Y` to confirm. Reload your configuration:

```bash
source ~/.zshrc
```

:::tip
This way, `$TARGET`, `$LHOST`, and the rest are available in every terminal window — no need to re-export between tabs or after a reboot. Run `source ~/.zshrc` in any already-open terminals to pick up the changes immediately. New terminals will load them automatically.
:::

:::warning
Remember to update these values when switching between targets or engagements. Stale variables pointing at a previous target are an easy way to run commands against the wrong host.
:::