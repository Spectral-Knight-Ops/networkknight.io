---
sidebar_position: 2
title: OSINT Tools
---

# OSINT Tools

## Netcraft

Free web portal that performs various information gathering functions such as discovering which technologies are running on a given website and finding which other hosts share the same IP netblock.

- Can provide a list of subdomains and technologies used
- https://searchdns.netcraft.com/
- https://www.netcraft.com/tools/

## Shodan

Search engine for internet-connected devices. Can reveal exposed services, default credentials, and vulnerable software versions.

## Open-Source Code Repositories

Search public code repositories for leaked credentials, API keys, and internal documentation.

### GitHub

GitHub has a search engine similar to Google. Example search:

```
owner:megacorpone path:users
```

This searches for any files with "users" in the file name within the target's repositories.

:::tip
Tools exist to automate searching large repositories for secrets and credentials. Also check GitHub Gists, GitLab, and SourceForge.
:::

## SSL/TLS Analysis

Public scanning tools for analyzing a target's TLS configuration:

- SSL Labs: https://www.ssllabs.com/ssltest/
  - Analyzes server TLS configurations and compares against current best practices
