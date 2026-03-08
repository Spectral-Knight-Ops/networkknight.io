---
sidebar_position: 1
title: Network Traffic Monitoring
---

# Network Traffic Monitoring

Network monitoring detects threats by analyzing traffic patterns, packet contents, and protocol behavior. This page covers packet capture tools, traffic analysis, and intrusion detection systems.

---

## tcpdump

Command-line packet capture tool available on most Linux systems.

### Common Captures

Capture all traffic on an interface:

```bash
sudo tcpdump -i eth0 -w capture.pcap
```

Capture traffic to/from a specific host:

```bash
sudo tcpdump -i eth0 host 192.168.1.100 -w host_traffic.pcap
```

Capture traffic on a specific port:

```bash
sudo tcpdump -i eth0 port 443 -w https_traffic.pcap
```

Capture DNS traffic:

```bash
sudo tcpdump -i eth0 port 53 -w dns.pcap
```

### Display Filters

Show packet contents in ASCII:

```bash
sudo tcpdump -i eth0 -A host 192.168.1.100
```

Show hex and ASCII:

```bash
sudo tcpdump -i eth0 -XX host 192.168.1.100
```

### Filter Syntax

```bash
# Combine with AND, OR, NOT
sudo tcpdump -i eth0 'src host 192.168.1.100 and dst port 80'
sudo tcpdump -i eth0 'tcp and port 445'
sudo tcpdump -i eth0 'not port 22'

# Filter by TCP flags
sudo tcpdump -i eth0 'tcp[tcpflags] & (tcp-syn) != 0'   # SYN packets
sudo tcpdump -i eth0 'tcp[tcpflags] & (tcp-rst) != 0'   # RST packets
```

---

## Wireshark

GUI-based packet analyzer for deep traffic inspection.

### Useful Display Filters

| Filter | Purpose |
|--------|---------|
| `ip.addr == 192.168.1.100` | Traffic to/from an IP |
| `tcp.port == 445` | SMB traffic |
| `http.request.method == "POST"` | HTTP POST requests |
| `dns.qry.name contains "suspicious"` | DNS queries with keyword |
| `tcp.flags.syn == 1 && tcp.flags.ack == 0` | SYN scans |
| `frame contains "password"` | Packets containing "password" |
| `tls.handshake.type == 1` | TLS Client Hello (connection initiation) |
| `smb2` | SMB v2 traffic |
| `kerberos` | Kerberos authentication traffic |
| `ntlmssp` | NTLM authentication |
| `tcp.analysis.retransmission` | Retransmissions (network issues) |

### Follow Streams

Right-click a packet → Follow → TCP/UDP/HTTP Stream to reconstruct the full conversation between two endpoints.

### Export Objects

File → Export Objects → HTTP/SMB/DICOM to extract files that were transferred over the network.

### Statistics

Statistics → Conversations — shows all communication pairs ranked by bytes transferred.

Statistics → Protocol Hierarchy — shows the breakdown of protocols in the capture.

Statistics → Endpoints — lists all IPs and their traffic volume.

---

## Traffic Analysis Techniques

### Identifying Port Scans

Look for: a single source IP making connections to many ports on one host (vertical scan) or to the same port on many hosts (horizontal scan). In Wireshark:

```
tcp.flags.syn == 1 && tcp.flags.ack == 0
```

Then check Statistics → Conversations to see if one host has an unusually high number of unique destination ports.

### Identifying Lateral Movement

SMB traffic between workstations (not to file servers) is suspicious. Look for PsExec-style behavior: SMB to ADMIN$ followed by service creation:

```
smb2.filename contains "PSEXESVC" || smb2.filename contains ".exe"
```

WinRM lateral movement:

```
tcp.port == 5985 || tcp.port == 5986
```

### Identifying Data Exfiltration

Large outbound transfers to external IPs, especially over uncommon protocols:

DNS exfiltration — look for unusually long DNS queries or high query volume to a single domain:

```
dns.qry.name.len > 50
```

ICMP exfiltration — unusual ICMP packet sizes:

```
icmp && data.len > 64
```

HTTPS exfiltration — large volumes of outbound TLS traffic to uncommon destinations (can't inspect content but can analyze volume and frequency).

### Identifying C2 Beaconing

Command-and-control traffic often shows regular intervals (beaconing). Look for connections to the same external IP at consistent time intervals. Use Statistics → I/O Graphs with a time filter for a specific destination.

Characteristics: regular connection intervals, small consistent packet sizes, connections to unusual ports or newly registered domains.

---

## Zeek (formerly Bro)

Network security monitoring framework that generates structured logs from packet captures. More useful for analysis than raw pcap because it extracts protocol-level information automatically.

### Key Zeek Log Files

| Log | Content |
|-----|---------|
| `conn.log` | All connections with duration, bytes, protocol |
| `dns.log` | DNS queries and responses |
| `http.log` | HTTP requests with URIs, user agents, response codes |
| `ssl.log` | TLS/SSL handshake details, certificates |
| `files.log` | Files transferred over the network |
| `notice.log` | Zeek's built-in alerts |
| `smtp.log` | Email traffic metadata |
| `kerberos.log` | Kerberos authentication events |
| `ntlm.log` | NTLM authentication events |
| `smb_files.log` | SMB file access |
| `pe.log` | Portable executable files transferred |

### Analyzing Zeek Logs

Process a pcap with Zeek:

```bash
zeek -r capture.pcap
```

Search connection logs for unusual activity:

```bash
# Long-duration connections (potential C2 or tunneling)
cat conn.log | zeek-cut id.orig_h id.resp_h id.resp_p duration | sort -t$'\t' -k4 -rn | head -20

# Connections to unusual ports
cat conn.log | zeek-cut id.orig_h id.resp_h id.resp_p | sort | uniq -c | sort -rn | head

# Large data transfers
cat conn.log | zeek-cut id.orig_h id.resp_h orig_bytes resp_bytes | awk '$3 > 1000000 || $4 > 1000000'
```

Search DNS logs:

```bash
# Long DNS queries (potential DNS exfiltration)
cat dns.log | zeek-cut query | awk 'length > 50'

# DNS queries by count
cat dns.log | zeek-cut query | sort | uniq -c | sort -rn | head -20
```

---

## IDS / IPS

### Snort

Rule-based intrusion detection system. Examines packets against a set of rules and generates alerts.

Example Snort rule:

```
alert tcp $EXTERNAL_NET any -> $HOME_NET 445 (msg:"Possible EternalBlue Exploit"; content:"|00 00 00 31 ff|"; offset:0; depth:5; sid:1000001; rev:1;)
```

Start Snort in IDS mode:

```bash
sudo snort -A console -q -c /etc/snort/snort.conf -i eth0
```

### Suricata

Higher-performance alternative to Snort, supports multithreading and uses the same rule format.

Start Suricata:

```bash
sudo suricata -c /etc/suricata/suricata.yaml -i eth0
```

Suricata logs alerts to `/var/log/suricata/eve.json` (JSON format) and `/var/log/suricata/fast.log` (plaintext).

### Rule Sources

Community and commercial rule sets:

- Emerging Threats (ET) Open Rules: https://rules.emergingthreats.net/open/
- Snort Community Rules: https://www.snort.org/downloads
- ET Pro (commercial): https://www.proofpoint.com/us/threat-insight

:::tip
IDS/IPS rules need regular updates. Subscribe to rule feeds and automate updates. Also create custom rules for your environment based on known IOCs and threat intelligence.
:::

---

## NetFlow / sFlow

NetFlow provides metadata about network conversations (source/destination IP, ports, bytes, duration) without capturing full packet contents. Useful for identifying communication patterns and anomalies at scale.

### What NetFlow Records

Each flow record contains: source IP, destination IP, source port, destination port, protocol, bytes transferred, packet count, timestamps, TCP flags.

### Analysis Tools

`nfdump` for processing NetFlow data:

```bash
nfdump -r nfcapd.202501010000 -s srcip/bytes    # Top talkers by bytes
nfdump -r nfcapd.202501010000 'dst port 4444'    # Connections to suspicious port
nfdump -r nfcapd.202501010000 -s dstip/flows     # Top destinations by flow count
```

---

## Monitoring Checklist

1. Deploy Sysmon on all Windows endpoints with a tuned configuration
2. Enable full packet capture on network chokepoints (or at minimum, NetFlow)
3. Deploy Zeek on a network tap for structured protocol analysis
4. Run Suricata/Snort with updated rule sets for known-threat detection
5. Forward all logs to a SIEM for correlation and alerting
6. Establish baselines for normal traffic patterns — anomaly detection depends on knowing what's normal
7. Monitor DNS traffic specifically — it's used for exfiltration, C2, and tunneling
