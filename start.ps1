# Portable server launcher for environments without global Node.js/NPM

$nodeDir = "$PSScriptRoot\.node"
$nodePath = "$nodeDir\node.exe"

if (-not (Test-Path $nodePath)) {
    Write-Host "Portable Node.js not found. Downloading..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
    
    # Download the node.js windows x64 binary zip
    $zipUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip"
    $zipPath = "$nodeDir\node.zip"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
    
    Write-Host "Extracting portable Node.js..." -ForegroundColor Cyan
    tar -xf $zipPath -C $nodeDir
    
    # Move files to root of .node dir
    Get-ChildItem "$nodeDir\node-v20.11.0-win-x64\*" | Move-Item -Destination $nodeDir -Force
    
    # Clean up zip and empty folders
    Remove-Item -Path "$nodeDir\node-v20.11.0-win-x64" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
    
    Write-Host "Portable Node.js setup complete!" -ForegroundColor Green
}

# Run the Express server
Write-Host "Starting Catan Match Tracker..." -ForegroundColor Green
Write-Host "Server will be available at http://localhost:3000" -ForegroundColor Green
& $nodePath "$PSScriptRoot\src\server.js"
