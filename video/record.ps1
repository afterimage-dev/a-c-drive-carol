# One take for the demo video: the sample night, opening on the title page, with YOUR C: on the gravestone. Each take
# gets a fresh profile, so nothing remembered from an earlier take (kept or banished files) changes tonight's files.
# A few seconds' wait first, to start recording in OBS and get this window out of the shot.
#
#   powershell -ExecutionPolicy Bypass -File video\record.ps1                  a whole night
#   powershell -ExecutionPolicy Bypass -File video\record.ps1 -Scene present   the visit from one stave (for the Esc take)

param(
  [ValidateSet("", "bell", "past", "present", "yet", "morning")] [string]$Scene = "",
  [int]$Wait = 8
)

$root = Split-Path -Parent $PSScriptRoot
$electron = Join-Path $root "node_modules\electron\dist\electron.exe"
$profileDir = Join-Path $root ".scratch\video\profile-$(Get-Date -Format yyyyMMdd-HHmmss)"
$switches = @($root, "--demo", "--anonymous", "--profile=$profileDir")
if ($Scene) { $switches += "--scene=$Scene" }

if (Get-Process electron -ErrorAction SilentlyContinue) {
  Write-Host "A C-Drive Carol is already running (or another Electron app is). Quit it from the tray first."
  exit 1
}
Write-Host "The night begins in $Wait seconds. Start recording in OBS and minimise this window."
for ($i = $Wait; $i -gt 0; $i--) { Write-Host -NoNewline "$i "; Start-Sleep -Seconds 1 }
Write-Host ""
Start-Process -FilePath $electron -ArgumentList $switches -WorkingDirectory $root
