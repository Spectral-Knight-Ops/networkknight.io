---
sidebar_position: 1
title: AD Persistence
---

# Active Directory Persistence

## Golden Tickets

Requires the `krbtgt` account NTLM hash (obtained via DC Sync). Allows forging TGTs for any user in the domain.

## Silver Tickets

Forge service tickets using an SPN's password hash. Requires: SPN password hash, domain SID, and target SPN.

:::tip
These techniques are also covered in the [Lateral Movement](/red-teaming/active-directory/lateral-movement/lateral-movement) guide.
:::

## DC Sync

Impersonate a domain controller to replicate credential data. Requires Domain Admins, Enterprise Admins, or Replicating Directory Changes rights.

## Shadow Copies

Volume shadow copies on domain controllers may contain the NTDS.dit database with all domain password hashes.
