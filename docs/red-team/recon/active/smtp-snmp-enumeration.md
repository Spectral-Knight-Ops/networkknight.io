---
sidebar_position: 4
title: SMTP & SNMP Enumeration
---

# SMTP Enumeration

## Key Commands

| Command | Description |
|---------|-------------|
| `VRFY` | Ask server to verify an email address exists |
| `EXPN` | Ask server for membership of a mailing list |

These commands can be abused to verify existing users on a mail server and guess valid usernames.

## Manual Enumeration with Netcat

```bash
nc -nv $TARGET 25
VRFY root
VRFY admin
```

## Tools

- Kali: Python script `smtp_enum_brute.py` for automated user enumeration
- Windows: `Test-NetConnection`, telnet

---

# SNMP Enumeration

**Protocol:** UDP (port 161)

SNMP protocols v1, v2, and v2c offer no traffic encryption — SNMP information and credentials can be easily intercepted. Traditional SNMP also has weak authentication schemes and is commonly left configured with default `public` and `private` community strings.

:::warning
SNMPv3 is the only version that provides authentication and encryption. Earlier versions transmit everything in plaintext.
:::

## Discovery

Scan for SNMP on a subnet:

```bash
sudo nmap -sU --open -p 161 $SUBNET -oG open-snmp.txt
```

## onesixtyone

Brute force community strings against a list of IPs:

```bash
onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings-onesixtyone.txt $TARGET
```

## snmpwalk

Enumerate SNMP data (requires knowing the read-only community string, often `public`):

```bash
snmpwalk -v2c -c public $TARGET
```

## snmpcheck

```bash
snmpcheck -t $TARGET -c public
```
