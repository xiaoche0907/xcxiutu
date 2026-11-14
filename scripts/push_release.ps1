# XiaoChe Workshop - release push script (ASCII only to avoid encoding issues)
param(
    [string]$RepoDir = "$PSScriptRoot\github_repo",
    [string]$ReleaseDir = "E:\冰淇淋修图4.2.0-win\iceai\resources\release"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path "$RepoDir\.git")) {
    git clone https://github.com/xiaoche0907/xcxiutu.git $RepoDir
    if ($LASTEXITCODE -ne 0) { Write-Host 'CLONE FAILED'; exit 1 }
} else {
    git -C $RepoDir pull origin main 2>$null
}

Copy-Item "$ReleaseDir\version.json" "$RepoDir\version.json" -Force
Get-ChildItem "$ReleaseDir\app-*.asar" | ForEach-Object {
    Copy-Item $_.FullName "$RepoDir\$($_.Name)" -Force
    Write-Host "staged $($_.Name)"
}

git -C $RepoDir add version.json
git -C $RepoDir add app-*.asar
$ver = (Get-Content "$ReleaseDir\version.json" -Raw | ConvertFrom-Json).version
git -C $RepoDir commit -m "release: version $ver"
git -C $RepoDir push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host '=== PUSH OK ==='
    Write-Host 'Users will see the new version after GitHub CDN refresh.'
} else {
    Write-Host 'PUSH FAILED'
    exit 1
}
