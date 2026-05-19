param(
    [switch]$NoBuild,
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

if ($Help) {
    Write-Host @"
Uso:
  ./run_project.ps1 [opciones]

Opciones:
  -NoBuild       Levanta Docker sin --build.
  -BackendOnly   Solo backend (docker compose).
  -FrontendOnly  Solo frontend container (docker compose).
  -Help          Muestra esta ayuda.

Notas:
  - Backend y frontend corren en Docker.
  - Frontend disponible en http://localhost:5173.
"@
    exit 0
}

if ($BackendOnly -and $FrontendOnly) {
    Write-Host "No se puede usar -BackendOnly y -FrontendOnly juntos."
    exit 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Error: docker no está instalado."
    exit 1
}

$backendServices = @('neo4j', 'postgres', 'auth-svc', 'tournaments-svc', 'teams-svc', 'inscriptions-svc', 'gateway')

if (-not $FrontendOnly) {
    $target = if ($BackendOnly) { $backendServices } else { @() }
    if ($NoBuild) {
        Write-Host "Levantando servicios Docker sin build..."
        if ($target.Count -gt 0) {
            docker compose up -d $target
        }
        else {
            docker compose up -d
        }
    }
    else {
        Write-Host "Levantando servicios Docker con build..."
        if ($target.Count -gt 0) {
            docker compose up -d --build $target
        }
        else {
            docker compose up -d --build
        }
    }

    if (-not $BackendOnly) {
        Write-Host "Esperando frontend container..."
        $frontendAttempts = 0
        while ($true) {
            try {
                $response = Invoke-WebRequest -Uri 'http://localhost:5173' -Method Get -TimeoutSec 3 -UseBasicParsing
                if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                    break
                }
            }
            catch {
            }
            $frontendAttempts++
            if ($frontendAttempts -ge 40) {
                Write-Host "Warning: timeout esperando http://localhost:5173"
                break
            }
            Start-Sleep -Seconds 2
        }
    }

    Write-Host "Esperando healthchecks backend..."
    $urls = @('http://localhost:4000/health', 'http://localhost:4001/health', 'http://localhost:4002/health', 'http://localhost:4003/health', 'http://localhost:4004/health')

    foreach ($url in $urls) {
        $attempts = 0
        while ($true) {
            try {
                $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 3 -UseBasicParsing
                if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                    break
                }
            }
            catch {
            }

            $attempts++
            if ($attempts -ge 40) {
                Write-Host "Warning: timeout esperando $url"
                break
            }
            Start-Sleep -Seconds 2
        }
    }
    Write-Host "Backend listo."
}

if ($BackendOnly) {
    Write-Host "Modo backend-only finalizado."
    exit 0
}

if ($FrontendOnly) {
    if ($NoBuild) {
        docker compose up -d frontend
    }
    else {
        docker compose up -d --build frontend
    }
    Write-Host "Frontend container levantado en http://localhost:5173"
    exit 0
}

Write-Host "Proyecto levantado. Frontend: http://localhost:5173"
