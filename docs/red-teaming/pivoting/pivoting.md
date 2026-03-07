---
sidebar_position: 1
title: Pivoting & Tunneling
---

# Pivoting & Tunneling

## Socat

Listen on one port and forward all traffic to another host/port. Useful for simple port forwarding through a compromised host.

```bash
socat -ddd TCP-LISTEN:2345,fork TCP:10.4.50.215:5432
```

- `-ddd` — verbose output
- `fork` — handle multiple connections (doesn't die after one)
- Listens on port 2345, forwards to 10.4.50.215:5432

---

## SSH Tunneling

### Local Port Forward

Forward a local port to a remote service through an SSH tunnel:

```bash
ssh -N -L 0.0.0.0:<local-port>:<target-ip>:<target-port> $USER@<pivot-host>
```

### Dynamic Port Forward (SOCKS Proxy)

Create a SOCKS proxy through an SSH connection:

```bash
ssh -N -D 0.0.0.0:9999 $USER@<pivot-host>
```

- `-D` creates a SOCKS proxy on port 9999
- `-N` prevents a shell from being spawned

---

## Proxychains

Forces network traffic from third-party tools through a SOCKS proxy. Uses `LD_PRELOAD` to hook libc networking functions.

:::warning
Proxychains works for most dynamically-linked binaries but will NOT work on statically-linked binaries.
:::

### Configuration

Edit `/etc/proxychains4.conf`, replace the proxy definition at the bottom:

```
[ProxyList]
socks5 192.168.50.63 9999
```

Can be `socks4` or `socks5` — SSH supports both. SOCKS5 adds authentication, IPv6, and UDP/DNS support.

### Usage

Prepend `proxychains` to any command:

```bash
proxychains smbclient -L //$TARGET/ -U $USER --password=$PASSWORD
proxychains nxc smb $TARGET -u $USER -p $PASSWORD --shares
proxychains nmap -sCV -p- $TARGET --open
```

:::tip
Default Proxychains timeouts are very high, making port scanning slow. Lower `tcp_read_time_out` and `tcp_connect_time_out` in the config to speed things up dramatically.
:::

---

## Windows Port Forwarding (netsh)

Forward a port on the compromised Windows host to an internal target:

```powershell
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=7070 connectaddress=172.16.111.200 connectport=3306
```

Remove the forward:

```powershell
netsh interface portproxy delete v4tov4 listenport=7070
```

---

## Chisel (HTTP Tunneling)

HTTP-based tunneling — useful when SSH is not available.

---

## DNS Tunneling

Tunnel traffic through DNS queries — useful for bypassing firewalls that only allow DNS traffic.

---

## Ligolo

Modern tunneling framework for establishing reverse tunnels from compromised hosts. Set up on your Kali machine and deploy the agent to the target.
