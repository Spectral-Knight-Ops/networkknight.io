---
sidebar_position: 1
title: DNS Enumeration
---

# DNS Enumeration

## Host Lookups

Basic DNS lookup for A record (IPv4):

```bash
host www.$DOMAIN
```

Search for specific record types:

```bash
host -t mx $DOMAIN
host -t txt $DOMAIN
host -t ns $DOMAIN
```

:::tip
For MX records, the server with the lowest priority number will be used first to forward mail.
:::

## Forward DNS Brute Force

Use a wordlist to discover hostnames:

```bash
for ip in $(cat list.txt); do host $ip.$DOMAIN; done
```

## Reverse DNS Lookups

If forward brute force reveals IP addresses in the same range, scan that range with reverse lookups:

```bash
for ip in $(seq 1 254); do host 167.114.21.$ip; done | grep -v "not found"
```

## Tools

### dnsrecon

Standard scan:

```bash
dnsrecon -d $DOMAIN -t std
```

Brute force with wordlist:

```bash
dnsrecon -d $DOMAIN -D ~/list.txt -t brt
```

`-d` designates the domain, `-t std` is standard scan type, `-t brt` is brute force, and `-D` specifies the wordlist.

### dnsenum

```bash
dnsenum $DOMAIN
```

### dig

```bash
dig $DOMAIN any
dig axfr $DOMAIN @<dns-server>
```
