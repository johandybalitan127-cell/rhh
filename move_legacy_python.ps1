# Move legacy Python files to a separate folder
# -------------------------------------------------
#  This script archives all .py files that are no longer used
#  by the JavaScript backend, keeping the project tidy.
# -------------------------------------------------

$legacyDir = "backend\legacy"
if (-not (Test-Path $legacyDir)) {
    New-Item -ItemType Directory -Path $legacyDir | Out-Null
}

# List of paths (wildcards allowed) to move
$paths = @(
    "backend\main.py",
    "backend\config.py",
    "backend\database\connection.py",
    "backend\database\models.py",
    "backend\database\seed_data.py",
    "backend\database\schema.sql",
    "backend\agents\orchestrador.py",
    "backend\agents\rag_policy.py",
    "backend\agents\employee_data.py",
    "backend\agents\report_analyst.py",
    "backend\agents\ingestion_sync.py",
    "backend\services\auth_service.py",
    "backend\services\drive_service.py",
    "backend\services\scheduler_service.py",
    "backend\routes\*.py",
    "backend\tests\run_evaluation.py"
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        Move-Item -Path $p -Destination $legacyDir -Force
        Write-Host "Movido $p → $legacyDir"
    }
}

Write-Host "Archiving of legacy Python files completado."