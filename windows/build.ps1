$ErrorActionPreference = "Stop"
Push-Location (Join-Path $PSScriptRoot "..")
try {
    node build.mjs
    if ($LASTEXITCODE -ne 0) { throw "HTML build failed" }
    Push-Location windows
    try {
        go mod verify
        if ($LASTEXITCODE -ne 0) { throw "Dependency verification failed" }
        go test ./...
        if ($LASTEXITCODE -ne 0) { throw "Tests failed" }
        $env:GOOS = "windows"
        $env:GOARCH = "amd64"
        $env:CGO_ENABLED = "0"
        go build -trimpath -ldflags "-H=windowsgui -s -w" -o ../downloads/EMK-Easy.exe .
        if ($LASTEXITCODE -ne 0) { throw "EXE build failed" }
    } finally { Pop-Location }
} finally { Pop-Location }
