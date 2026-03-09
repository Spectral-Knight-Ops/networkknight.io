---
sidebar_position: 1
title: Linux Hardening
---

# Linux Hardening

A reference for securing Linux systems — covering user management, SSH, firewalls, file permissions, auditing, kernel tuning, and service hardening.

---

## User and Account Security

### Enforce Strong Password Policy

Configure password complexity and aging in `/etc/login.defs`:

```bash
PASS_MAX_DAYS   90
PASS_MIN_DAYS   7
PASS_MIN_LEN    12
PASS_WARN_AGE   14
```

Install and configure PAM password quality module:

```bash
sudo apt install libpam-pwquality
```

Edit `/etc/security/pwquality.conf`:

```
minlen = 12
dcredit = -1
ucredit = -1
ocredit = -1
lcredit = -1
maxrepeat = 3
```

### Lock and Disable Unused Accounts

Lock an account (disables password login):

```bash
sudo usermod -L <username>
```

Set shell to nologin for service accounts:

```bash
sudo usermod -s /usr/sbin/nologin <username>
```

Find accounts with no password set:

```bash
sudo awk -F: '($2 == "" ) { print $1 }' /etc/shadow
```

### Restrict Root Access

Disable direct root login. Require `sudo` for privilege escalation:

```bash
sudo passwd -l root
```

Limit sudo access to specific users/groups in `/etc/sudoers` (always edit with `visudo`):

```bash
%sudo   ALL=(ALL:ALL) ALL
```

:::tip
Review `/etc/sudoers` and `/etc/sudoers.d/` regularly. Look for overly permissive entries like `NOPASSWD:ALL` or wildcard commands that could be abused.
:::

---

## SSH Hardening

Edit `/etc/ssh/sshd_config`:

```bash
# Disable root login
PermitRootLogin no

# Disable password authentication (use keys only)
PasswordAuthentication no
PubkeyAuthentication yes

# Disable empty passwords
PermitEmptyPasswords no

# Limit login attempts
MaxAuthTries 3

# Set idle timeout (seconds)
ClientAliveInterval 300
ClientAliveCountMax 2

# Restrict to specific users or groups
AllowUsers admin deployer
# AllowGroups sshusers

# Disable X11 forwarding and agent forwarding
X11Forwarding no
AllowAgentForwarding no

# Use only strong ciphers and MACs
Ciphers aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com

# Disable legacy protocol
Protocol 2

# Change default port (optional, adds obscurity)
# Port 2222
```

Restart SSH after changes:

```bash
sudo systemctl restart sshd
```

### SSH Key Management

Generate a strong key pair:

```bash
ssh-keygen -t ed25519 -C "admin@server"
```

Set proper permissions:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chmod 600 ~/.ssh/id_ed25519
```

---

## Firewall Configuration

### UFW (Uncomplicated Firewall)

Default deny incoming, allow outgoing:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

Allow specific services:

```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Limit SSH connections (rate limiting — blocks IPs with 6+ connection attempts in 30 seconds):

```bash
sudo ufw limit ssh
```

Enable the firewall:

```bash
sudo ufw enable
sudo ufw status verbose
```

### iptables

Drop all incoming by default, allow established connections and specific services:

```bash
# Flush existing rules
sudo iptables -F

# Default policies
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Log dropped packets
sudo iptables -A INPUT -j LOG --log-prefix "IPTables-Dropped: "
```

Save rules to persist across reboots:

```bash
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

### nftables (Modern Replacement)

nftables is the successor to iptables on newer Linux distributions:

```bash
sudo nft add table inet filter
sudo nft add chain inet filter input { type filter hook input priority 0 \; policy drop \; }
sudo nft add rule inet filter input ct state established,related accept
sudo nft add rule inet filter input iif lo accept
sudo nft add rule inet filter input tcp dport 22 accept
sudo nft add rule inet filter input tcp dport {80, 443} accept
```

---

## File System Security

### Set Proper Permissions on Sensitive Files

```bash
sudo chmod 600 /etc/shadow
sudo chmod 644 /etc/passwd
sudo chmod 600 /etc/gshadow
sudo chmod 644 /etc/group
sudo chmod 600 /boot/grub/grub.cfg
```

### Find World-Writable Files and Directories

```bash
find / -type f -perm -o+w -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null
find / -type d -perm -o+w -not -path "/proc/*" -not -path "/sys/*" -not -path "/tmp/*" 2>/dev/null
```

### Find SUID/SGID Binaries

Review and remove unnecessary SUID/SGID bits:

```bash
find / -type f \( -perm -4000 -o -perm -2000 \) -exec ls -l {} \; 2>/dev/null
```

Remove SUID from binaries that don't need it:

```bash
sudo chmod u-s /path/to/unnecessary/suid/binary
```

### Mount Options

Add restrictive mount options in `/etc/fstab` to limit what can be done on certain partitions:

```
/dev/sda2  /tmp   ext4  defaults,nosuid,noexec,nodev  0 0
/dev/sda3  /var   ext4  defaults,nosuid                0 0
/dev/sda4  /home  ext4  defaults,nosuid,nodev          0 0
```

- `nosuid` — ignore SUID/SGID bits on this partition
- `noexec` — prevent execution of binaries
- `nodev` — ignore device files

---

## Audit and Logging

### auditd

auditd provides detailed system call auditing. Install and enable:

```bash
sudo apt install auditd
sudo systemctl enable auditd
sudo systemctl start auditd
```

Add rules to `/etc/audit/rules.d/audit.rules`:

```bash
# Monitor /etc/passwd and /etc/shadow changes
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/group -p wa -k identity
-w /etc/sudoers -p wa -k sudoers

# Monitor SSH configuration
-w /etc/ssh/sshd_config -p wa -k sshd_config

# Monitor user authentication
-w /var/log/auth.log -p wa -k auth_log

# Monitor cron changes
-w /etc/crontab -p wa -k cron
-w /etc/cron.d/ -p wa -k cron

# Monitor binary execution in /tmp (common for attackers)
-w /tmp/ -p x -k tmp_exec
```

Search audit logs:

```bash
sudo ausearch -k identity
sudo ausearch -k sudoers --start today
```

### Log Rotation and Centralization

Ensure logs rotate to prevent disk exhaustion. Check `/etc/logrotate.conf` and service-specific configs in `/etc/logrotate.d/`.

For centralized logging, forward logs to a SIEM using rsyslog or Filebeat (see [Elastic Stack](/blue-team/siem/elastic/elastic) page).

---

## Kernel Hardening (sysctl)

Apply kernel security parameters in `/etc/sysctl.conf` or `/etc/sysctl.d/99-hardening.conf`:

```bash
# Disable IP forwarding (unless this is a router)
net.ipv4.ip_forward = 0

# Disable ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0

# Enable SYN flood protection
net.ipv4.tcp_syncookies = 1

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Log martian packets (packets with impossible addresses)
net.ipv4.conf.all.log_martians = 1

# Disable source routing
net.ipv4.conf.all.accept_source_route = 0

# Enable address space layout randomization (ASLR)
kernel.randomize_va_space = 2

# Restrict access to kernel logs
kernel.dmesg_restrict = 1

# Restrict access to kernel pointers in /proc
kernel.kptr_restrict = 2

# Protect against hard/soft link attacks
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
```

Apply changes:

```bash
sudo sysctl -p
```

---

## AppArmor / SELinux

### AppArmor (Ubuntu/Debian Default)

Check status:

```bash
sudo aa-status
```

Enforce a profile:

```bash
sudo aa-enforce /etc/apparmor.d/<profile>
```

Set a profile to complain mode (log violations but don't block):

```bash
sudo aa-complain /etc/apparmor.d/<profile>
```

### SELinux (RHEL/CentOS Default)

Check status:

```bash
getenforce
sestatus
```

Set enforcing mode:

```bash
sudo setenforce 1
```

Make permanent in `/etc/selinux/config`:

```
SELINUX=enforcing
```

---

## Service Hardening

### Disable Unnecessary Services

List running services:

```bash
systemctl list-units --type=service --state=running
```

Disable services not needed:

```bash
sudo systemctl disable --now cups
sudo systemctl disable --now avahi-daemon
sudo systemctl disable --now bluetooth
```

### Restrict Service Permissions with systemd

Add security directives to service unit files:

```ini
[Service]
ProtectSystem=strict
ProtectHome=yes
NoNewPrivileges=yes
PrivateTmp=yes
ReadOnlyDirectories=/etc
```

---

## CIS Benchmark Reference

The Center for Internet Security (CIS) publishes detailed hardening benchmarks for every major Linux distribution. Use them as a comprehensive checklist:

- CIS Benchmarks: https://www.cisecurity.org/cis-benchmarks
- Key sections: filesystem configuration, software updates, boot settings, process hardening, network parameters, logging, access control

:::tip
Automated CIS benchmark scanning tools like `cis-cat` or `Lynis` can audit a system against CIS recommendations and produce a report of gaps. Run `sudo lynis audit system` for a quick security audit.
:::
