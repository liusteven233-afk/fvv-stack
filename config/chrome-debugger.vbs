' Chrome Remote Debugger - Auto start for Hermes Agent
' This launches Chrome with --remote-debugging-port=9222
' so Hermes browser tools can connect from WSL

Dim chromePath, ws
chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

Set ws = CreateObject("WScript.Shell")

' Check if Chrome is already running with debug port
Dim procList
procList = ws.Exec("cmd /c ""wmic process where ""name='chrome.exe' AND commandline like '%%remote-debugging-port%%'"" get processid /format:value""").StdOut.ReadAll

If InStr(procList, "ProcessId") = 0 Then
    ' Launch Chrome with remote debugging
    ws.Run """" & chromePath & """ --remote-debugging-port=9222 --no-first-run --new-window about:blank", 0, False
End If
