---
sidebar_position: 1
title: Windows Hardening
---

# Windows Hardening

A reference for securing Windows systems and Active Directory environments — covering Group Policy, credential protection, service accounts, firewall configuration, audit policy, and legacy protocol hardening.

---

## Local Account Security

### Rename or Disable Default Accounts

Rename the built-in Administrator account to reduce targeted attacks:

```powershell
Rename-LocalUser -Name "Administrator" -NewName "LocalSysAdmin"
```

Disable the Guest account:

```powershell
Disable-LocalUser -Name "Guest"
```

### LAPS (Local Administrator Password Solution)

LAPS automatically rotates local admin passwords on domain-joined machines, storing them in Active Directory. This prevents lateral movement via shared local admin passwords.

Check if LAPS is installed:

```powershell
Get-CimInstance Win32_Product | Where-Object { $_.Name -like "*LAPS*" }
```

Read the LAPS password for a machine (requires appropriate AD permissions):

```powershell
Get-ADComputer -Identity <computername> -Properties ms-Mcs-AdmPwd | Select-Object ms-Mcs-AdmPwd
```

:::tip
If LAPS is not deployed, all machines in the domain likely share the same local admin password. This is one of the most common misconfigurations in AD environments and enables trivial lateral movement. LAPS deployment should be a top priority.
:::

---

## Credential Protection

### Credential Guard

Credential Guard uses virtualization-based security (VBS) to isolate LSASS secrets in a protected container, preventing credential dumping tools like Mimikatz from reading them.

Enable via Group Policy: `Computer Configuration → Administrative Templates → System → Device Guard → Turn On Virtualization Based Security` → Enable with Secure Launch.

Verify status:

```powershell
Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard
```

### LSA Protection (RunAsPPL)

Configure LSASS to run as a Protected Process Light (PPL), preventing unsigned code from accessing its memory:

```powershell
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" /v RunAsPPL /t REG_DWORD /d 1 /f
```

Requires a reboot. After enabling, tools like Mimikatz cannot read LSASS memory without a signed kernel driver.

### Disable WDigest Credential Caching

WDigest caches plaintext credentials in LSASS memory (enabled by default on older systems). Disable it:

```powershell
reg add "HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest" /v UseLogonCredential /t REG_DWORD /d 0 /f
```

### Disable NTLM Where Possible

NTLM is the legacy authentication protocol that enables pass-the-hash and relay attacks. Restrict it via Group Policy:

`Computer Configuration → Windows Settings → Security Settings → Local Policies → Security Options`:
- "Network security: Restrict NTLM: Incoming NTLM traffic" → Deny all accounts
- "Network security: Restrict NTLM: Outgoing NTLM traffic to remote servers" → Deny all

:::warning
Disabling NTLM completely can break legacy applications. Audit NTLM usage first with "Network security: Restrict NTLM: Audit..." policies before enforcing restrictions.
:::

---

## SMB Hardening

### Require SMB Signing

SMB signing prevents NTLM relay attacks. Configure via Group Policy:

`Computer Configuration → Windows Settings → Security Settings → Local Policies → Security Options`:
- "Microsoft network server: Digitally sign communications (always)" → Enabled
- "Microsoft network client: Digitally sign communications (always)" → Enabled

Or via registry:

```powershell
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 1 /f
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 1 /f
```

### Disable SMBv1

SMBv1 is vulnerable to EternalBlue and other exploits:

```powershell
Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol
Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force
```

### Restrict Administrative Shares

Consider disabling or restricting access to `ADMIN$`, `C$`, and other default administrative shares for workstations.

---

## Windows Firewall

### Enable and Configure

```powershell
# Enable all profiles
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True

# Default to block inbound, allow outbound
Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultInboundAction Block -DefaultOutboundAction Allow
```

### Allow Specific Services

```powershell
New-NetFirewallRule -DisplayName "Allow SSH" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow
New-NetFirewallRule -DisplayName "Allow RDP" -Direction Inbound -Protocol TCP -LocalPort 3389 -Action Allow -RemoteAddress "10.0.0.0/8"
```

### Block Common Attack Vectors

```powershell
# Block inbound SMB from non-internal networks
New-NetFirewallRule -DisplayName "Block External SMB" -Direction Inbound -Protocol TCP -LocalPort 445 -RemoteAddress "!10.0.0.0/8" -Action Block

# Block WinRM from non-management networks
New-NetFirewallRule -DisplayName "Block External WinRM" -Direction Inbound -Protocol TCP -LocalPort 5985,5986 -RemoteAddress "!10.0.1.0/24" -Action Block
```

---

## Audit Policy

Configure audit policy to log security-relevant events. Via Group Policy: `Computer Configuration → Windows Settings → Security Settings → Advanced Audit Policy Configuration`.

### Key Audit Categories to Enable

| Category | Setting | Detects |
|----------|---------|---------|
| Account Logon — Credential Validation | Success, Failure | Authentication attempts |
| Logon/Logoff — Logon | Success, Failure | User logons (4624, 4625) |
| Logon/Logoff — Special Logon | Success | Admin logons (4672) |
| Object Access — File System | Success, Failure | Sensitive file access |
| Privilege Use — Sensitive Privilege Use | Success, Failure | Privilege escalation |
| Account Management — User Account Management | Success | Account creation/modification |
| Account Management — Security Group Management | Success | Group membership changes |
| Policy Change — Audit Policy Change | Success | Audit policy tampering |
| System — Security State Change | Success | Startup/shutdown |

### Key Windows Event IDs

| Event ID | Description |
|----------|-------------|
| 4624 | Successful logon |
| 4625 | Failed logon |
| 4634 | Logoff |
| 4648 | Explicit credential logon (runas) |
| 4672 | Special privileges assigned (admin logon) |
| 4688 | New process created |
| 4720 | User account created |
| 4722 | User account enabled |
| 4724 | Password reset attempt |
| 4728 | Member added to security group |
| 4732 | Member added to local group |
| 4756 | Member added to universal group |
| 7045 | Service installed |

### Enable Command-Line Logging

Include the command line in process creation events (Event ID 4688):

```powershell
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit" /v ProcessCreationIncludeCmdLine_Enabled /t REG_DWORD /d 1 /f
```

---

## PowerShell Security

### Enable Script Block Logging

Records the full content of all PowerShell scripts as they execute:

```powershell
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging" /v EnableScriptBlockLogging /t REG_DWORD /d 1 /f
```

### Enable Transcription

Logs everything typed in PowerShell sessions:

```powershell
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\Transcription" /v EnableTranscripting /t REG_DWORD /d 1 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\Transcription" /v OutputDirectory /t REG_SZ /d "C:\PSTranscripts" /f
```

### Constrained Language Mode

Restrict PowerShell to basic functionality, blocking .NET calls, COM objects, and type accelerators:

Via Group Policy with AppLocker or WDAC policies. Alternatively, set as a system environment variable:

```powershell
[Environment]::SetEnvironmentVariable('__PSLockdownPolicy', '4', 'Machine')
```

---

## Attack Surface Reduction (ASR)

ASR rules are part of Microsoft Defender and block common attack techniques at the OS level.

### Enable Key ASR Rules

```powershell
# Block Office apps from creating child processes
Add-MpPreference -AttackSurfaceReductionRules_Ids D4F940AB-401B-4EFC-AADC-AD5F3C50688A -AttackSurfaceReductionRules_Actions Enabled

# Block Office apps from injecting into other processes
Add-MpPreference -AttackSurfaceReductionRules_Ids 75668C1F-73B5-4CF0-BB93-3ECF5CB7CC84 -AttackSurfaceReductionRules_Actions Enabled

# Block credential stealing from LSASS
Add-MpPreference -AttackSurfaceReductionRules_Ids 9e6c4e1f-7d60-472f-ba1a-a39ef669e4b2 -AttackSurfaceReductionRules_Actions Enabled

# Block executable content from email and webmail
Add-MpPreference -AttackSurfaceReductionRules_Ids BE9BA2D9-53EA-4CDC-84E5-9B1EEEE46550 -AttackSurfaceReductionRules_Actions Enabled
```

---

## Service Account Security

### Use Group Managed Service Accounts (gMSA)

gMSAs provide automatic password management for service accounts — passwords are 240 characters long and rotate automatically every 30 days:

```powershell
New-ADServiceAccount -Name "svc_webapp" -DNSHostName "svc_webapp.domain.com" -PrincipalsAllowedToRetrieveManagedPassword "WebServerGroup"
```

### Remove SPNs from User Accounts

Service Principal Names on user accounts enable Kerberoasting. Move services to gMSAs or machine accounts where possible:

```powershell
# Find user accounts with SPNs
Get-ADUser -Filter {servicePrincipalName -like "*"} -Properties servicePrincipalName | Select-Object Name, servicePrincipalName
```

---

## Disable Legacy Protocols

### Disable LLMNR

LLMNR enables LLMNR/NBT-NS poisoning attacks (Responder). Disable via Group Policy:

`Computer Configuration → Administrative Templates → Network → DNS Client → Turn off multicast name resolution` → Enabled

### Disable NetBIOS over TCP/IP

Via network adapter settings or DHCP Option 001.

### Disable WPAD

Disable WPAD auto-detection to prevent proxy credential capture:

```powershell
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings\Wpad" /v WpadOverride /t REG_DWORD /d 1 /f
```

---

## Microsoft Defender Configuration

### Ensure Defender is Active

```powershell
Get-MpComputerStatus | Select-Object AntivirusEnabled, RealTimeProtectionEnabled, IoavProtectionEnabled
```

### Enable Cloud-Delivered Protection

```powershell
Set-MpPreference -MAPSReporting Advanced
Set-MpPreference -SubmitSamplesConsent SendAllSamples
```

### Configure Tamper Protection

Tamper Protection prevents attackers from disabling Defender. Enable it in Windows Security settings or via Intune.

---

## Hardening Checklist

1. Deploy LAPS for local admin password management
2. Enable Credential Guard and LSA Protection
3. Disable WDigest credential caching
4. Require SMB signing and disable SMBv1
5. Configure Windows Firewall with default deny
6. Enable Advanced Audit Policy with command-line logging
7. Enable PowerShell Script Block Logging and Transcription
8. Deploy ASR rules (especially LSASS protection and Office macro restrictions)
9. Disable LLMNR, NetBIOS, and WPAD
10. Use gMSAs for service accounts and remove SPNs from user accounts
11. Restrict NTLM usage where possible
12. Keep systems patched — automate Windows Update
