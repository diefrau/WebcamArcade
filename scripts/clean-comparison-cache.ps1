param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$taskWorkspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskRelativePaths = @(
  'artifacts/optimization-baseline/node_modules',
  'artifacts/optimization-baseline/dist',
  'artifacts/optimization-baseline/public/vision/wasm',
  'artifacts/optimization-good/node_modules',
  'artifacts/optimization-good/dist',
  'artifacts/optimization-good/public/vision/wasm'
)

# Verify every absolute target before deleting any of them. Keep worktree source,
# original assets, measurement evidence, and the active project's dependencies.
$taskTargets = @()
foreach ($taskRelative in $taskRelativePaths) {
  $taskCandidate = Join-Path $taskWorkspace $taskRelative
  if (-not (Test-Path -LiteralPath $taskCandidate)) { continue }
  $taskResolved = (Resolve-Path -LiteralPath $taskCandidate).Path
  if (-not $taskResolved.StartsWith($taskWorkspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Target escapes workspace: $taskResolved"
  }
  # Resolve-Path does not dereference Windows junctions: reject them in ancestors.
  $taskAncestor = Get-Item -LiteralPath $taskResolved -Force
  while ($taskAncestor.FullName -ne $taskWorkspace) {
    if ($taskAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw "Target contains a junction or symlink: $($taskAncestor.FullName)"
    }
    $taskAncestor = $taskAncestor.Parent
  }
  $taskBytes = (Get-ChildItem -LiteralPath $taskResolved -Recurse -File -Force | Measure-Object Length -Sum).Sum
  $taskTargets += [pscustomobject]@{Path=$taskResolved; Bytes=[long]$taskBytes}
}
$taskTotal = ($taskTargets | Measure-Object Bytes -Sum).Sum
$taskTargets | Select-Object Path, @{N='MiB';E={[math]::Round($_.Bytes / 1MB, 2)}} | Format-Table -Wrap
Write-Output ("Total: {0:N2} MiB" -f ($taskTotal / 1MB))
if (-not $Apply) { Write-Output 'Dry run. Use -Apply to remove only these reproducible caches.'; return }
foreach ($taskTarget in $taskTargets) {
  Remove-Item -LiteralPath $taskTarget.Path -Recurse -Force
  Write-Output "Removed $($taskTarget.Path)"
}
