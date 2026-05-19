$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

function Test-PortOpen {
  param([int]$Port)
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $client.Connect("127.0.0.1", $Port)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

$port = 4173
$url = "http://127.0.0.1:$port/"

if (Test-PortOpen -Port $port) {
  Write-Host "CodeNote is already running." -ForegroundColor Cyan
  Write-Host "Open this address: $url" -ForegroundColor Green
  Start-Process $url
  return
}

Write-Host "CodeNote is starting..." -ForegroundColor Cyan
Write-Host "Open this address: $url" -ForegroundColor Green
Write-Host "Keep this window open while using the site." -ForegroundColor Yellow

Start-Job -ScriptBlock {
  param($targetUrl)
  Start-Sleep -Seconds 1
  Start-Process $targetUrl
} -ArgumentList $url | Out-Null

if (Get-Command py -ErrorAction SilentlyContinue) {
  py -3 -m http.server $port --bind 127.0.0.1
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  python -m http.server $port --bind 127.0.0.1
} else {
  Write-Host "Python was not found. Please install Python or open index.html directly." -ForegroundColor Red
}
