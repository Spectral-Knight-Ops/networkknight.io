---
sidebar_position: 3
title: SMB Enumeration
---

# SMB Enumeration

## SMB vs NetBIOS

- **NetBIOS** (ports 137, 138, 139) — allows computers on a local network to communicate. Legacy protocol, largely deprecated.
- **SMB** (port 445) — file sharing, printer sharing, access to network resources.

Earlier Windows versions used NetBIOS to transport SMB traffic. Modern Windows (2000+) uses SMB directly over TCP/IP on port 445 without relying on NetBIOS.

## Nmap Scripts

OS discovery:

```bash
nmap -v -p 139,445 --script smb-os-discovery $TARGET
```

Enumerate shares:

```bash
nmap --script smb-enum-shares.nse -p 445 $TARGET
```

Enumerate users:

```bash
nmap --script smb-enum-users.nse -p 445 $TARGET
```

NetBIOS info:

```bash
nmap --script nbstat.nse $TARGET
```

## nbtscan

```bash
nbtscan $SUBNET
```

## enum4linux

Comprehensive SMB enumeration:

```bash
sudo enum4linux -r $TARGET
```

Cheat sheet: https://highon.coffee/blog/enum4linux-cheat-sheet/

Updated version:

```bash
sudo enum4linux-ng $TARGET
```

## smbclient

List shares (authenticated):

```bash
smbclient -L //$TARGET -U $USER
```

Test anonymous access:

```bash
smbclient -L //$TARGET -N
```

Connect to a share:

```bash
smbclient //$TARGET/sharename -U $USER
```

## smbmap

```bash
smbmap -H $TARGET
smbmap -H $TARGET -u $USER -p $PASSWORD
```

## NetExec (nxc)

Enumerate shares with credentials:

```bash
nxc smb $TARGET -u $USER -p $PASSWORD --shares
```

Test null session:

```bash
nxc smb $TARGET -u '' -p ''
```

:::tip
Even without a password, `smbclient -L` can sometimes reveal share names and comments which provide useful intelligence about the target.
:::
