---
sidebar_position: 1
title: Google Dorking
---

# Google Dorking

Google search operators can be used to narrow search results and identify exposed information about a target.

## Common Operators

| Operator | Description |
|----------|-------------|
| `site:` | Restrict results to a specific domain |
| `filetype:` | Search for specific file types |
| `-filetype:` | Exclude specific file types |
| `ext:` | Search by file extension |
| `intitle:` | Search within page titles |
| `inurl:` | Search within URLs |

## Useful Dork Examples

Search for non-HTML content on a target domain:

```
site:megacorpone.com -filetype:html
```

Search for specific file types:

```
site:megacorpone.com ext:xml
site:megacorpone.com ext:py
site:megacorpone.com ext:conf
```

Find exposed directory listings:

```
intitle:"index of" "parent directory"
```

:::tip
The output from directory listing dorks can reveal interesting files and sensitive information from misconfigured servers.
:::

## Resources

- Google Hacking Database: https://www.exploit-db.com/google-hacking-database
- Dork practice: https://dorksearch.com/
