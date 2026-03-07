---
sidebar_position: 0
title: Methodology
---

# Red Team Methodology

:::warning Golden Rule
Read read READ the scan outputs. Read every line, actually analyze the output for usernames, passwords, useful information, CVEs, etc.
:::

## Core Workflow

For every target, follow this process methodically. Don't jump between targets — this causes things to be forgotten and missed.

### 1. Enumerate Every Service

For every single service discovered on a target, search for:

- `<service> exploit`
- `<service> poc`
- Try multiple tools to enumerate each service

### 2. Collect Everything

- Add all discovered usernames to `usernames.txt`
- Add all discovered passwords to `passwords.txt`
- Check websites for potential custom wordlist crafting (CeWL)
- Save all scan output for later review

### 3. Web Services Checklist

When you find a web server, run through the full stack — don't skip steps:

- Nikto
- GoBuster / feroxbuster (try multiple wordlists)
- Subdomain enumeration
- Source code inspection
- Input field analysis

### 4. Set Your Environment Variables

```bash
# Set these at the start of every engagement session
export TARGET=<ip>
export SUBNET=<cidr>
export DOMAIN=<domain>
export USER=<username>
export PASSWORD=<password>
export LHOST=<your-ip>
export LPORT=4444
export HASH=<ntlm-hash>
```

:::tip
Setting environment variables once means you can copy/paste commands directly from these notes without editing IPs every time.
:::
