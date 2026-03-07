---
sidebar_position: 1
title: Service Enumeration
---

# Service Enumeration

## Banner Grabbing

Use netcat to grab service banners:

```bash
nc -nv $TARGET <port>
```

## Enumerating SMTP

```bash
nc -nv $TARGET 25
VRFY root
VRFY admin
```

## General Approach

For every open port and service discovered, identify the version and search for known exploits:

```bash
searchsploit <service> <version>
```
