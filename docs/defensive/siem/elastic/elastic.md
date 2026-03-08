---
sidebar_position: 1
title: Elastic Stack
---

# Elastic Stack / ELK

The Elastic Stack (Elasticsearch, Logstash, Kibana) plus Elastic Agent/Fleet provides a full SIEM platform for log ingestion, analysis, alerting, and visualization. This page covers architecture, key queries, detection rules, and practical usage.

---

## Architecture

**Elasticsearch** — the search and analytics engine. Stores and indexes all log data. Runs on port 9200.

**Logstash** — data processing pipeline. Ingests logs from multiple sources, transforms/enriches them, and sends them to Elasticsearch. Runs on port 5044 (Beats input).

**Kibana** — the web interface for visualization, querying, and dashboards. Runs on port 5601.

**Beats / Elastic Agent** — lightweight data shippers installed on endpoints. Elastic Agent is the modern unified agent that replaces individual Beats.

### Data Flow

```
Endpoints (Elastic Agent / Beats)
    → Logstash (optional — parsing, enrichment)
    → Elasticsearch (storage, indexing)
    → Kibana (visualization, alerting)
```

### Fleet

Fleet is the centralized management interface for Elastic Agents. It allows you to deploy, configure, and update agents across your fleet from Kibana. Agents use "integrations" (formerly modules) to collect specific data types — Windows events, Sysmon, Zeek, osquery, etc.

---

## Key Index Patterns

Data in Elasticsearch is organized into indices. Common patterns:

| Index Pattern | Data Source |
|---------------|-------------|
| `logs-*` | General logs (Elastic Agent) |
| `winlogbeat-*` | Windows event logs (Winlogbeat) |
| `filebeat-*` | File-based logs (Filebeat) |
| `packetbeat-*` | Network traffic (Packetbeat) |
| `auditbeat-*` | Audit data (Auditbeat) |
| `.alerts-*` | Elastic Security alerts |
| `logs-endpoint.*` | Elastic Defend (EDR) data |

---

## KQL (Kibana Query Language)

KQL is the primary query language used in Kibana's search bar and detection rules.

### Basic Syntax

Exact match:

```
event.action: "logon-failed"
```

Wildcard:

```
process.name: powershell*
user.name: admin*
```

Boolean operators:

```
event.action: "logon-failed" and source.ip: 192.168.1.100
process.name: cmd.exe or process.name: powershell.exe
not user.name: SYSTEM
```

Range queries:

```
event.severity >= 3
@timestamp >= "2025-01-01" and @timestamp <= "2025-01-31"
```

Nested field queries:

```
process.parent.name: w3wp.exe and process.name: cmd.exe
```

### Useful Security Queries

Failed logons:

```
event.code: 4625
```

Failed logons from a specific source:

```
event.code: 4625 and source.ip: 10.0.0.50
```

Successful logons with admin privileges:

```
event.code: 4672
```

New user account created:

```
event.code: 4720
```

Service installed:

```
event.code: 7045
```

PowerShell script block logging (see executed commands):

```
event.code: 4104
```

Process creation with command line (Sysmon Event ID 1):

```
event.code: 1 and process.command_line: *mimikatz*
```

Encoded PowerShell execution:

```
event.code: 1 and process.command_line: (*-enc* or *-EncodedCommand* or *FromBase64String*)
```

LSASS access (Sysmon Event ID 10):

```
event.code: 10 and winlog.event_data.TargetImage: *lsass.exe*
```

Network connections from PowerShell (Sysmon Event ID 3):

```
event.code: 3 and process.name: powershell.exe
```

DNS queries to suspicious TLDs:

```
dns.question.name: (*.xyz or *.top or *.tk or *.ml)
```

---

## Detection Rules

Elastic Security includes pre-built detection rules and supports custom rules. Rules can trigger alerts, create cases, and execute response actions.

### Rule Types

**Custom query** — triggers when a KQL query matches events. Most flexible type.

**Threshold** — triggers when a field exceeds a count within a time window (e.g., more than 10 failed logons in 5 minutes).

**EQL (Event Query Language)** — triggers on sequences of events in order (e.g., process A spawned process B within 5 minutes).

**Machine Learning** — anomaly detection based on learned baselines.

### Example Custom Rules

**Brute force detection** (threshold rule): more than 10 failed logons from the same source IP in 5 minutes.

```
Query: event.code: 4625
Threshold field: source.ip
Threshold value: 10
Time window: 5 minutes
```

**Suspicious parent-child process** (EQL sequence):

```
sequence by host.name with maxspan=1m
  [process where process.name == "w3wp.exe"]
  [process where process.name in ("cmd.exe", "powershell.exe") and process.parent.name == "w3wp.exe"]
```

This detects a web server (IIS) spawning a command shell — a strong indicator of web shell activity.

**Password spray detection**: multiple failed logons with the same password across different accounts.

**New service installation**: Event ID 7045 with unusual service names or binary paths.

### Pre-Built Rules

Elastic Security ships with hundreds of pre-built rules mapped to MITRE ATT&CK. Enable them in Kibana: Security → Rules → Load Elastic prebuilt rules.

Key categories: credential access, lateral movement, persistence, privilege escalation, defense evasion, exfiltration.

---

## Dashboards and Visualization

### Creating Dashboards

Navigate to Kibana → Dashboard → Create.

Useful dashboard panels for security monitoring:

- **Failed logon heatmap** — event.code:4625, aggregated by hour and day
- **Top source IPs for failed logons** — horizontal bar chart
- **Process creation timeline** — event.code:1, time series
- **Network connections by destination** — event.code:3, pie chart by destination IP
- **Alert summary** — aggregation of detection rule matches by severity

### Lens and Aggregations

Use Kibana Lens for drag-and-drop visualization building. Common aggregations: count, unique count (cardinality), top values, date histogram.

---

## Elastic Agent Integrations

### Windows Integration

Collects Windows Event Logs (Security, System, Application, PowerShell). Configure which channels to collect in the Fleet agent policy.

### Sysmon Integration

Collects Sysmon operational logs. Requires Sysmon to be installed on endpoints separately — Elastic Agent just ships the logs.

### Endpoint Security (Elastic Defend)

Elastic's own EDR integration. Provides: malware prevention, ransomware prevention, memory threat prevention, behavior protection, and detailed endpoint telemetry.

### Network Integrations

Zeek, Suricata, and Packetbeat integrations for network visibility.

---

## Elasticsearch Queries (Dev Tools)

For advanced queries, use Kibana → Dev Tools → Console to run Elasticsearch DSL queries directly.

Search for failed logons in the last 24 hours:

```json
GET winlogbeat-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "event.code": "4625" } },
        { "range": { "@timestamp": { "gte": "now-24h" } } }
      ]
    }
  },
  "size": 100
}
```

Aggregate failed logons by source IP:

```json
GET winlogbeat-*/_search
{
  "query": { "match": { "event.code": "4625" } },
  "size": 0,
  "aggs": {
    "by_source_ip": {
      "terms": { "field": "source.ip", "size": 20 }
    }
  }
}
```

---

## Index Lifecycle Management (ILM)

Configure data retention to manage storage costs. ILM policies define when indices transition through phases: hot (active writes) → warm (read-only, less storage) → cold (infrequent access) → delete.

Example: keep logs for 90 days, then delete.

```json
PUT _ilm/policy/security-logs
{
  "policy": {
    "phases": {
      "hot": { "actions": { "rollover": { "max_size": "50gb", "max_age": "30d" } } },
      "warm": { "min_age": "30d", "actions": { "readonly": {} } },
      "delete": { "min_age": "90d", "actions": { "delete": {} } }
    }
  }
}
```

:::tip
Set appropriate retention periods based on your compliance requirements and storage capacity. Security logs typically need 90-365 days of retention. Ensure your ILM policy doesn't delete logs before your IR team might need them.
:::
