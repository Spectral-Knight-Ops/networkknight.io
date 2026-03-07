---
sidebar_position: 1
title: AD Enumeration
---

# Active Directory Enumeration

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

## PowerView

Reference: https://powersploit.readthedocs.io/en/latest/Recon/

:::warning
PowerView might not be on the target — you may need to transfer it.
:::

General domain info:

```powershell
Get-NetDomain
```

Display all users:

```powershell
Get-NetUser | select cn
```

Get specific user attributes:

```powershell
Get-NetUser | select cn,pwdlastset,lastlogon
```

Enumerate groups:

```powershell
Get-NetGroup | select cn
Get-NetGroup "Domain Admins" | select member
```

Enumerate computers:

```powershell
Get-NetComputer | select dnshostname,operatingsystem
```

Find shares:

```powershell
Find-DomainShare
```

---

## BloodHound / SharpHound

Collect AD data for BloodHound analysis:

```powershell
powershell -ep bypass
Import-Module .\SharpHound.ps1
Invoke-BloodHound -CollectionMethod All -OutputDirectory C:\Users\Public\ -OutputPrefix "collection"
```

Transfer the ZIP to your Kali machine and import into BloodHound for graph-based analysis.

---

## NetExec (nxc)

User description enumeration:

```bash
nxc ldap $TARGET -u $USER -p $PASSWORD -M get-desc-users
```

Enumerate shares:

```bash
nxc smb $TARGET -u $USER -p $PASSWORD --shares
```

Protocol spraying (check what protocols a user can access):

```bash
nxc smb $TARGET -u $USER -p $PASSWORD
nxc winrm $TARGET -u $USER -p $PASSWORD
nxc ldap $TARGET -u $USER -p $PASSWORD
nxc mssql $TARGET -u $USER -p $PASSWORD
nxc rdp $TARGET -u $USER -p $PASSWORD
```

Spray a user list against multiple protocols:

```bash
nxc smb $TARGET -u usernames.txt -p passwords.txt --continue-on-success
```
