---
sidebar_position: 3
title: Cowrie Honeypot
---

# Elastic + Cowrie SSH Honeypot: Capturing Real Attacker Behavior

Threat detection rules and SIEM dashboards are most meaningful when tested against real attack data. This project deploys an internet-facing SSH honeypot using **Cowrie**, ships the telemetry into **Elastic Cloud**, and builds detection rules and dashboards on top of that live data — simulating a SOC telemetry pipeline end to end.

## How It Works

Cowrie is a medium-interaction SSH/Telnet honeypot that emulates a shell environment. Attackers connect, attempt to authenticate, and interact with a fake system — none of their commands actually execute, but everything they do gets logged in structured JSON. That data is then shipped via Elastic Agent to Elasticsearch, normalized into ECS format through ingest pipelines, and enriched with GeoIP data before hitting Kibana.

The full pipeline looks like this:

1. Attacker connects to the Cowrie honeypot over SSH
2. Cowrie logs all activity to structured JSON
3. Elastic Agent ships logs to Elasticsearch
4. Ingest pipelines normalize fields to ECS
5. GeoIP enrichment adds geographic and ASN context
6. Kibana dashboards visualize the data

## What Gets Captured

Even in a short window of exposure, internet-facing SSH honeypots collect a significant volume of activity — primarily automated bots scanning for weak credentials. Common attacker behaviors observed include SSH brute-force and credential spraying, post-auth reconnaissance commands (`uname -a`, `whoami`), and malware download attempts via `wget` or `curl`.

----

![Dashboard](/img/dashboard_img_0.png)

----

![Attacker Commands](/img/dashboard_img_1.png)

----

![Geographic Attack Sources](/img/dashboard_img_2.png)

----

## Detection Rules

Three custom detection rules were implemented in Elastic to fire on the most common attacker behaviors:

**Malware download attempts**
```
cowrie.command : "CMD: wget*"
```

**SSH brute force activity**
```
event.action : "cowrie.login.failed"
```

**Reconnaissance commands**
```
cowrie.command : "CMD: uname*"
```

These map directly to behaviors you'd tune alerts for in a production SOC environment.

## Security Hardening

Running an intentionally exposed service carries risk. The honeypot was isolated with the following controls:

- Cowrie runs under a non-root user
- SSH access to the host is restricted to public key authentication
- UFW firewall limits exposure to only necessary ports
- Deployed on a cloud VPS, isolated from any other systems
- Cowrie emulates commands rather than executing them — attacker input never reaches the OS

:::warning
Never run a honeypot on a network connected to production systems. Always isolate it on a dedicated VPS or segmented environment.
:::

## Stack

Cowrie handles honeypot emulation, Elastic Agent handles log shipping, Elasticsearch stores and indexes the data, and Kibana provides dashboards and detection rule management. GeoIP enrichment is handled via an ingest pipeline processor.

## What's Next

Planned improvements include a self-hosted Elastic Stack deployment, threat intelligence feed enrichment, and automated malware sample analysis for payloads that attackers attempt to download.

---

**Built with:** [Tyler Nagy](https://github.com/MrNagz/elastic-cowrie-honeypot)

**GitHub:** [Spectral-Knight-Ops/elastic-cowrie-honeypot](https://github.com/Spectral-Knight-Ops/elastic-cowrie-honeypot)
