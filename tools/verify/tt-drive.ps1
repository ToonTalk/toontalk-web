# Reusable driver for the original ToonTalk (TT3191). Real synthesized input —
# only when the user is away. Forces foreground via AttachThreadInput so clicks
# reach the (DirectInput) app.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Text;using System.Drawing;
public class TTD {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint dx,uint dy,uint d,IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk,byte sc,uint f,IntPtr e);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  public struct RECT { public int Left,Top,Right,Bottom; }
  public static IntPtr Best(uint t){ IntPtr b=IntPtr.Zero; int ar=0;
    EnumWindows((h,p)=>{ uint pid; GetWindowThreadProcessId(h,out pid);
      if(pid==t && IsWindowVisible(h)){ var sb=new StringBuilder(256); GetWindowText(h,sb,256); string tt=sb.ToString();
        RECT r; GetWindowRect(h,out r); int a=(r.Right-r.Left)*(r.Bottom-r.Top);
        bool good = tt.Contains("ToonTalk")||tt.Contains("name")||tt.Contains("What");
        int score = a + (good?100000000:0); if(score>ar){ar=score;b=h;} } return true;},IntPtr.Zero); return b; }
  public static string Title(IntPtr h){ var sb=new StringBuilder(256); GetWindowText(h,sb,256); return sb.ToString(); }
  public static void Fore(IntPtr h){ uint dummy; IntPtr fg=GetForegroundWindow(); uint ft=GetWindowThreadProcessId(fg,out dummy); uint me=GetCurrentThreadId();
    if(ft!=me) AttachThreadInput(ft,me,true); ShowWindow(h,9); BringWindowToTop(h); SetForegroundWindow(h); if(ft!=me) AttachThreadInput(ft,me,false); }
  public static string Cap(IntPtr h,string path){ if(IsIconic(h)){ShowWindow(h,9);System.Threading.Thread.Sleep(300);} RECT r; GetWindowRect(h,out r); int w=r.Right-r.Left,ht=r.Bottom-r.Top; if(w<=0||ht<=0)return "0x0"; var bmp=new Bitmap(w,ht); using(var g=Graphics.FromImage(bmp)){ IntPtr hdc=g.GetHdc(); PrintWindow(h,hdc,2); g.ReleaseHdc(hdc);} bmp.Save(path,System.Drawing.Imaging.ImageFormat.Png); return string.Format("{0}x{1}@{2},{3}",w,ht,r.Left,r.Top); }
}
"@
[TTD]::SetProcessDPIAware() | Out-Null
function TT-Proc { Get-Process -Name TT3191 -ErrorAction SilentlyContinue | Select-Object -First 1 }
function TT-Win { $p=TT-Proc; if($p){ $h=[TTD]::Best([uint32]$p.Id); if($h -ne [IntPtr]::Zero -and [TTD]::IsIconic($h)){ [TTD]::ShowWindow($h,9)|Out-Null; Start-Sleep -Milliseconds 300 } return $h } return [IntPtr]::Zero }
function TT-Fore { param($h) [TTD]::Fore($h); Start-Sleep -Milliseconds 350 }
function TT-Click { param($x,$y) [TTD]::SetCursorPos($x,$y); Start-Sleep -Milliseconds 150; [TTD]::mouse_event(0x02,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 80; [TTD]::mouse_event(0x04,0,0,0,[IntPtr]::Zero) }
function TT-HoldLMB { param($x,$y,$ms) [TTD]::SetCursorPos($x,$y); Start-Sleep -Milliseconds 150; [TTD]::mouse_event(0x02,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds $ms; [TTD]::mouse_event(0x04,0,0,0,[IntPtr]::Zero) }
function TT-Move { param($x,$y) [TTD]::SetCursorPos($x,$y) }
function TT-Key { param([byte]$vk) [TTD]::keybd_event($vk,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 80; [TTD]::keybd_event($vk,0,2,[IntPtr]::Zero) }
function TT-Cap { param($name) $h=TT-Win; if($h -eq [IntPtr]::Zero){return "no-window"} $r=[TTD]::Cap($h,"C:\Users\toont\dev\toontalk-web\tools\verify\shots\$name.png"); return ("'"+[TTD]::Title($h)+"' "+$r) }
