param(
    [Parameter(Mandatory=$true)][int]$AppProcessId,
    [ValidateSet('state','minimize')][string]$Action = 'state'
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class SettingsWindowCheck {
    public delegate bool EnumProc(IntPtr window, IntPtr state);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr state);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder title, int length);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    public static IntPtr Find(uint process) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((window, state) => {
            uint owner; GetWindowThreadProcessId(window, out owner);
            if (owner != process) return true;
            var title = new StringBuilder(512); GetWindowText(window, title, title.Capacity);
            if (!title.ToString().StartsWith("Snowline Lyrics · ")) return true;
            found = window; return false;
        }, IntPtr.Zero);
        return found;
    }
}
'@
$window = [SettingsWindowCheck]::Find([uint32]$AppProcessId)
if ($window -eq [IntPtr]::Zero) { throw 'Isolated test settings window not found' }
if ($Action -eq 'minimize') {
    [void][SettingsWindowCheck]::ShowWindowAsync($window, 6)
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ([SettingsWindowCheck]::IsIconic($window)) { break }
        Start-Sleep -Milliseconds 50
    }
}
@{
    minimized = [SettingsWindowCheck]::IsIconic($window)
    foreground = [SettingsWindowCheck]::GetForegroundWindow() -eq $window
    handle = $window.ToString()
} | ConvertTo-Json -Compress
