---
sidebar_position: 2
title: OSINT Tools
---

# OSINT Tools

Open Source Intelligence (OSINT) uses publicly available data to gather information about a target organization — domains, employees, technologies, credentials, and infrastructure — without directly interacting with the target's systems.

```bash
# Set environment variables
export DOMAIN=<domain>
```

---

## WHOIS

Query domain registration information. Reveals registrant names, email addresses, phone numbers, name servers, and registration dates.

```bash
whois $DOMAIN
```

For IP address lookups:

```bash
whois <ip-address>
```

:::tip
Even when WHOIS privacy is enabled, name servers, registration dates, and associated IP ranges are still visible and useful for scope definition.
:::

---

## theHarvester

Aggregates data from multiple sources (search engines, DNS, certificate transparency, Shodan) in a single tool. Discovers emails, subdomains, IPs, and URLs.

```bash
theHarvester -d $DOMAIN -b google,bing,crtsh,linkedin,dnsdumpster
```

Common data sources (`-b` flag): `google`, `bing`, `crtsh`, `dnsdumpster`, `linkedin`, `shodan`, `virustotal`, `threatminer`, `urlscan`.

Save results to file:

```bash
theHarvester -d $DOMAIN -b all -f results.html
```

---

## Subdomain Enumeration

### Certificate Transparency Logs (crt.sh)

Search issued SSL certificates for subdomains — certificates are publicly logged, so this reveals subdomains even if they're not linked from the main site:

```bash
curl -s "https://crt.sh/?q=%25.$DOMAIN&output=json" | jq -r '.[].name_value' | sort -u
```

### Sublist3r

Enumerates subdomains using search engines and DNS:

```bash
sublist3r -d $DOMAIN
```

### Amass

Comprehensive attack surface mapping tool. Active and passive enumeration:

Passive only (no direct contact with target):

```bash
amass enum -passive -d $DOMAIN
```

Active (includes DNS brute forcing):

```bash
amass enum -active -d $DOMAIN -brute
```

### Subfinder

Fast passive subdomain discovery:

```bash
subfinder -d $DOMAIN -o subdomains.txt
```

### DNS Brute Force

Use a wordlist to discover subdomains via DNS resolution:

```bash
gobuster dns -d $DOMAIN -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt
```

---

## Netcraft

Free web portal that performs information gathering including technology fingerprinting and finding which other hosts share the same IP netblock.

- Subdomain and technology discovery
- https://searchdns.netcraft.com/
- https://www.netcraft.com/tools/

---

## Shodan

Search engine for internet-connected devices. Reveals exposed services, default credentials, vulnerable software versions, and infrastructure details.

Web interface: https://www.shodan.io/

Common searches:

```
hostname:$DOMAIN
org:"Company Name"
ssl:"Company Name"
port:3389 org:"Company Name"
```

CLI tool:

```bash
shodan search hostname:$DOMAIN
shodan host <ip-address>
```

:::tip
Shodan results can reveal services the target may not realize are exposed: databases, admin panels, IoT devices, development servers, and misconfigured cloud instances.
:::

---

## Wayback Machine

The Internet Archive's Wayback Machine stores historical snapshots of websites. Useful for finding pages, files, and content that have since been removed.

Web interface: https://web.archive.org/

Automated extraction with `waybackurls`:

```bash
waybackurls $DOMAIN | sort -u | tee wayback_urls.txt
```

Look for: old admin panels, exposed configuration files, removed pages, development endpoints, and old versions of the site that may have had less security.

---

## Open-Source Code Repositories

Search public code repositories for leaked credentials, API keys, internal documentation, and infrastructure details.

### GitHub

GitHub search operators:

```
org:companyname password
org:companyname api_key
org:companyname token
org:companyname internal
owner:username filename:config
```

Search for specific file types:

```
org:companyname extension:env
org:companyname extension:yml password
org:companyname extension:json secret
```

### Automated Secret Scanning

Trufflehog — scans git history for secrets:

```bash
trufflehog github --org=companyname
trufflehog git https://github.com/companyname/repo.git
```

GitLeaks — detect secrets in repositories:

```bash
gitleaks detect --source /path/to/repo
```

:::tip
Don't forget to search GitHub Gists, GitLab, Bitbucket, and SourceForge. Also check commit history — developers frequently commit credentials and then remove them in a later commit, but the secret remains in git history.
:::

---

## Email Harvesting

### hunter.io

Web-based email finder. Discovers email format and known addresses for a domain:

https://hunter.io/

### LinkedIn

Search for employees of the target organization. Employee names can be used to generate email addresses based on the organization's email format (discovered via hunter.io or MX record analysis).

### Email Format Verification

Once you have the email format and a list of names, verify addresses with:

```bash
# Check if addresses are valid via SMTP
smtp-user-enum -M RCPT -U emails.txt -D $DOMAIN -t <mail-server>
```

---

## SSL/TLS Analysis

### SSL Labs

Analyzes server TLS configurations and compares against current best practices:

https://www.ssllabs.com/ssltest/

### Certificate Details

Extract certificate information (including subdomains in SAN field):

```bash
openssl s_client -connect $DOMAIN:443 </dev/null 2>/dev/null | openssl x509 -noout -text | grep -A1 "Subject Alternative Name"
```

---

## Social Media OSINT

### LinkedIn

Employee roles, technologies mentioned in job postings, organizational structure, and team sizes.

### Twitter/X

Company announcements, technology mentions, employee interactions.

### Job Postings

Job listings reveal technology stack, security tools in use, cloud platforms, and internal project names.

---

## Metadata Analysis

Extract metadata from publicly available documents (PDFs, Office files, images) published by the target:

```bash
exiftool document.pdf
```

Metadata may reveal: internal usernames, software versions, directory paths, printer names, GPS coordinates (from photos), and operating system details.

Bulk download and analyze documents:

```bash
# Use Google dorking to find documents
# Download them, then extract metadata
for f in *.pdf *.docx *.xlsx; do exiftool "$f"; done
```

---

## Recon-ng

Modular OSINT framework with a Metasploit-like interface:

```bash
recon-ng
marketplace search
marketplace install recon/domains-hosts/certificate_transparency
modules load recon/domains-hosts/certificate_transparency
options set SOURCE $DOMAIN
run
```

Common modules: certificate transparency, WHOIS, Shodan queries, DNS brute force, contact harvesting, credential checking.

---

## OSINT Workflow

1. Start with the target domain — WHOIS, DNS records, name servers
2. Subdomain enumeration — crt.sh, amass, subfinder, DNS brute force
3. Technology fingerprinting — Netcraft, Shodan, Wappalyzer
4. Email/employee discovery — theHarvester, hunter.io, LinkedIn
5. Code repository search — GitHub, GitLab for leaked secrets
6. Metadata analysis — download public documents and extract metadata
7. Historical analysis — Wayback Machine for removed content
8. Compile all findings into a target profile before beginning active recon
