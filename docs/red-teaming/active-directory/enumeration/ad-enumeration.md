---
sidebar_position: 1
title: AD Enumeration
---

# Active Directory Enumeration

```bash
# Set environment variables
export TARGET=<ip>
export DOMAIN=<domain>
export USER=<username>
export PASSWORD=<password>
export HASH=<ntlm-hash>
```

---

## Legacy Tools (net commands)

List all users in the domain:

```powershell
net user /domain
```

:::tip
`net user` and `net user /domain` produce different outputs — local vs domain users.
:::

Inspect a specific domain user (reveals group memberships):

```powershell
net user $USER /domain
```

List all groups in the domain:

```powershell
net group /domain
```

Enumerate a specific group:

```powershell
net group "Sales Department" /domain
```

List local groups (useful for finding who has local admin):

```powershell
net localgroup
net localgroup Administrators
```

Look for accounts with prefixes/suffixes that reveal purpose (e.g., "jeffadmin", "svc_sql").

---

## PowerShell & .NET LDAP Enumeration

### Get the LDAP Path

LDAP path format: `LDAP://HostName[:PortNumber][/DistinguishedName]`

To enumerate accurately, target the Primary Domain Controller (PDC) which holds the most updated info.

Retrieve PDC hostname:

```powershell
[System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
```

Retrieve domain distinguished name:

```powershell
([adsi]'').distinguishedName
```

### Enumeration Script

Save as `enumeration.ps1`:

```powershell
$PDC = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain().PdcRoleOwner.Name
$DN = ([adsi]'').distinguishedName
$LDAP = "LDAP://$PDC/$DN"

$direntry = New-Object System.DirectoryServices.DirectoryEntry($LDAP)
$dirsearcher = New-Object System.DirectoryServices.DirectorySearcher($direntry)
$dirsearcher.filter="samAccountType=805306368"
$result = $dirsearcher.FindAll()

Foreach($obj in $result) {
    Foreach($prop in $obj.Properties) {
        $prop
    }
    Write-Host "-------------------------------"
}
```

Run it:

```powershell
powershell -ep bypass
.\enumeration.ps1
```

The `samAccountType=805306368` filter enumerates all user objects in the domain.

### Reusable LDAP Search Function

Save as `function.ps1`:

```powershell
function LDAPSearch {
    param ([string]$LDAPQuery)
    $PDC = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain().PdcRoleOwner.Name
    $DistinguishedName = ([adsi]'').distinguishedName
    $DirectoryEntry = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$PDC/$DistinguishedName")
    $DirectorySearcher = New-Object System.DirectoryServices.DirectorySearcher($DirectoryEntry, $LDAPQuery)
    return $DirectorySearcher.FindAll()
}
```

Import and use:

```powershell
Import-Module .\function.ps1
LDAPSearch -LDAPQuery "(samAccountType=805306368)"
LDAPSearch -LDAPQuery "(objectclass=group)"
```

### Enumerate All Groups and Members

```powershell
foreach ($group in $(LDAPSearch -LDAPQuery "(objectCategory=group)")) {
    $group.properties | select {$_.cn}, {$_.member}
}
```

Search a specific group:

```powershell
$sales = LDAPSearch -LDAPQuery "(&(objectCategory=group)(cn=Sales Department))"
$sales.properties.member
```

:::tip
Keep enumerating nested groups. A deeply nested group might contain a user you have access to, and that group may have elevated permissions.
:::

---

## ldapsearch (From Kali)

Query AD from Kali without needing to be on a domain-joined machine.

### Anonymous Bind

Test if anonymous LDAP queries are allowed:

```bash
ldapsearch -x -H ldap://$TARGET -b "" -s base namingContexts
```

If successful, enumerate everything:

```bash
ldapsearch -x -H ldap://$TARGET -b "DC=$DOMAIN" "(objectclass=*)"
```

### Authenticated Enumeration

Enumerate all users with key attributes:

```bash
ldapsearch -x -H ldap://$TARGET -D "$USER@$DOMAIN" -w "$PASSWORD" -b "DC=corp,DC=com" "(objectclass=user)" sAMAccountName description memberOf userAccountControl
```

Enumerate groups:

```bash
ldapsearch -x -H ldap://$TARGET -D "$USER@$DOMAIN" -w "$PASSWORD" -b "DC=corp,DC=com" "(objectclass=group)" cn member
```

Find users with SPNs (Kerberoastable accounts):

```bash
ldapsearch -x -H ldap://$TARGET -D "$USER@$DOMAIN" -w "$PASSWORD" -b "DC=corp,DC=com" "(&(objectclass=user)(servicePrincipalName=*))" sAMAccountName servicePrincipalName
```

Find users with "Do not require Kerberos preauthentication" (AS-REP Roastable):

```bash
ldapsearch -x -H ldap://$TARGET -D "$USER@$DOMAIN" -w "$PASSWORD" -b "DC=corp,DC=com" "(&(objectclass=user)(userAccountControl:1.2.840.113556.1.4.803:=4194304))" sAMAccountName
```

:::tip
Always check the `description` field — passwords are frequently stored there, especially on service accounts and during initial deployments.
:::

---

## Kerbrute (User Enumeration from Kali)

Enumerate valid domain usernames without authentication by sending AS-REQ requests. Valid usernames return a different Kerberos error than invalid ones.

```bash
kerbrute userenum -d $DOMAIN --dc $TARGET /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt
```

Spray a password against validated users:

```bash
kerbrute passwordspray -d $DOMAIN --dc $TARGET usernames.txt $PASSWORD
```

:::tip
Kerbrute doesn't trigger traditional logon failure events (Event ID 4625) for username enumeration, making it stealthier than SMB-based enumeration. However, password spraying does generate events.
:::

---

## PowerView

Reference: https://powersploit.readthedocs.io/en/latest/Recon/

:::warning
PowerView might not be on the target — you may need to transfer it.
:::

### Domain Information

```powershell
Get-NetDomain
Get-NetDomainController
Get-DomainPolicy
(Get-DomainPolicy)."SystemAccess"    # Password policy
```

### User Enumeration

```powershell
Get-NetUser | select cn
Get-NetUser | select cn,pwdlastset,lastlogon
Get-NetUser -SPN | select cn,serviceprincipalname    # Kerberoastable users
Get-NetUser -PreauthNotRequired | select cn           # AS-REP Roastable users
```

### Group Enumeration

```powershell
Get-NetGroup | select cn
Get-NetGroup "Domain Admins" | select member
Get-NetGroup -AdminCount | select cn                  # Groups marked as admin
```

### Computer Enumeration

```powershell
Get-NetComputer | select dnshostname,operatingsystem
Get-NetComputer -OperatingSystem "*Server*" | select dnshostname
```

### Share Enumeration

```powershell
Find-DomainShare
Find-DomainShare -CheckShareAccess    # Only shows shares you can access
Find-InterestingDomainShareFile       # Search shares for interesting files
```

### GPO Enumeration

```powershell
Get-NetGPO | select displayname,whenchanged
Get-NetGPO -ComputerIdentity <computername>    # GPOs applied to a specific machine
```

### Trust Enumeration

```powershell
Get-NetDomainTrust
Get-NetForestDomain
Get-NetForestTrust
```

### ACL Enumeration

Find interesting ACLs — objects where specific users have excessive permissions:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.IdentityReferenceName -notmatch "Admin|Builtin"}
```

Check what rights a specific user has:

```powershell
Get-DomainObjectAcl -Identity "Domain Admins" -ResolveGUIDs | Where-Object {$_.SecurityIdentifier -match "<user-SID>"}
```

### SPN Enumeration

```powershell
Get-NetUser -SPN | select cn,serviceprincipalname
```

---

## BloodHound / SharpHound

### Data Collection

Collect AD data for BloodHound analysis:

```powershell
powershell -ep bypass
Import-Module .\SharpHound.ps1
Invoke-BloodHound -CollectionMethod All -OutputDirectory C:\Users\Public\ -OutputPrefix "collection"
```

SharpHound executable alternative:

```powershell
.\SharpHound.exe -c All --zipfilename collection.zip
```

From Kali with BloodHound.py (no need to be on a domain-joined machine):

```bash
bloodhound-python -c All -u $USER -p $PASSWORD -d $DOMAIN -ns $TARGET
```

Transfer the ZIP to your Kali machine and import into BloodHound.

### Key BloodHound Queries

After importing data, use these built-in queries and custom Cypher queries:

Built-in queries (in the BloodHound GUI):
- "Find all Domain Admins"
- "Find Shortest Paths to Domain Admins"
- "Find Principals with DCSync Rights"
- "Find Computers where Domain Users are Local Admin"
- "Find Kerberoastable Users with Path to DA"
- "Shortest Paths to Unconstrained Delegation Systems"

Custom Cypher queries (paste in the Raw Query box):

Find all users with admin access to computers:

```
MATCH (u:User)-[:AdminTo]->(c:Computer) RETURN u.name, c.name
```

Find all Kerberoastable users:

```
MATCH (u:User {hasspn: true}) RETURN u.name, u.serviceprincipalnames
```

Find paths from owned principals to Domain Admins:

```
MATCH p=shortestPath((n {owned: true})-[*1..]->(g:Group {name: "DOMAIN ADMINS@DOMAIN.COM"})) RETURN p
```

:::tip
Mark compromised users and computers as "owned" in BloodHound. This lets you query for the shortest path from your current access to Domain Admins or other high-value targets.
:::

---

## NetExec (nxc)

### User and Group Enumeration

User description enumeration (passwords often in descriptions):

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD -M get-desc-users
```

Enumerate users:

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD --users
```

Enumerate groups:

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD --groups
```

### Share Enumeration

```bash
nxc smb $TARGET -u $USER -p $PASSWORD --shares
```

Spider shares for files:

```bash
nxc smb $TARGET -u $USER -p $PASSWORD -M spider_plus
```

### Protocol Spraying

Check what protocols a user can access:

```bash
nxc smb $TARGET -u $USER -p $PASSWORD
nxc winrm $TARGET -u $USER -p $PASSWORD
nxc ldap $TARGET -u $USER -p $PASSWORD
nxc mssql $TARGET -u $USER -p $PASSWORD
nxc rdp $TARGET -u $USER -p $PASSWORD
```

### Credential Spraying Across Subnet

```bash
nxc smb $SUBNET -u $USER -p $PASSWORD --continue-on-success
nxc smb $SUBNET -u usernames.txt -p passwords.txt --continue-on-success --no-bruteforce
```

### Password Policy

```bash
nxc smb $TARGET -u $USER -p $PASSWORD --pass-pol
```

### Kerberoasting

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD --kerberoast --output kerberoast_hashes.txt
```

### AS-REP Roasting

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD --asreproast --output asrep_hashes.txt
```

---

## enum4linux-ng

Updated version of enum4linux with improved output and additional checks:

```bash
enum4linux-ng $TARGET -A
enum4linux-ng $TARGET -u $USER -p $PASSWORD -A
```

The `-A` flag runs all enumeration modules: users, groups, shares, password policy, RID cycling, and more.

---

## Enumeration Checklist

When you land on a domain-joined machine, systematically enumerate:

1. Current user and privileges — `whoami /all`
2. Domain users — look for service accounts, admin accounts, descriptions
3. Domain groups — identify high-value groups and their members
4. Domain computers — find servers, DCs, workstations
5. Shares — spider readable shares for credentials and sensitive files
6. GPOs — may contain scheduled tasks, startup scripts, or password settings
7. Trusts — other domains you might be able to pivot to
8. SPNs — identify Kerberoastable accounts
9. ACLs — find misconfigured permissions that grant escalation paths
10. Run BloodHound — graph-based analysis reveals paths you'd never find manually
