---
sidebar_position: 1
title: Web App Methodology
---

# Web Application Enumeration

Reference: https://owasp.org/www-project-top-ten/

## Phase I — Enumeration

### 1. Technology Fingerprinting

Identify technologies running on the target:

- **Wappalyzer** browser extension (if site is internet-facing): https://www.wappalyzer.com/
- **whatweb**: `whatweb $TARGET`

### 2. Nmap Service Scan

```bash
sudo nmap -p 80 -sV $TARGET
```

### 3. Nmap HTTP Scripts

```bash
sudo nmap -p 80 --script=http-enum $TARGET
```

### 4. Directory Discovery

```bash
gobuster dir -u http://$TARGET -w /usr/share/wordlists/dirb/common.txt
```

:::tip
On engagements, use multiple wordlists and run them in the background. Decrease thread count with `-t 5` to reduce traffic if needed.
:::

Useful wordlists:
- `/usr/share/wordlists/dirb/common.txt`
- `/usr/share/wordlists/dirb/big.txt`
- `/usr/share/seclists/Discovery/Web-Content/raft-medium-files.txt`
- `/usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt`

### 5. Manual Inspection

- Inspect the entire page source
- Right-click → Inspect input fields
- Beautify code by clicking `{ }` in bottom left in Firefox dev tools
- Check all links and buttons
- Navigate to all accessible pages

## Tools

| Tool | Purpose |
|------|---------|
| **GoBuster** | Directory and file brute forcing |
| **wfuzz** | Web fuzzing (parameters, directories, etc.) |
| **Burp Suite** | HTTP proxy, request manipulation, repeater |
| **Nikto** | Web server vulnerability scanner |
| **CeWL** | Custom wordlist generator from target website |
| **wpscan** | WordPress-specific scanner |
