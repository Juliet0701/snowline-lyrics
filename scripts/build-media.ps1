$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$frameworkRoot=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$sdkRoot=Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/UnionMetadata'
$metadata=Get-ChildItem -LiteralPath $sdkRoot -Directory | Where-Object {$_.Name -match '^\d+\.\d+\.\d+\.\d+$'} | Sort-Object {[version]$_.Name} -Descending | ForEach-Object {Join-Path $_.FullName 'Windows.winmd'} | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
if(-not $metadata){throw 'Windows SDK UnionMetadata/Windows.winmd is required to build. Install a Windows 10/11 SDK for development only.'}
$outputDir=Join-Path $projectRoot 'native/bin'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$compiler=Join-Path $frameworkRoot 'csc.exe'
$refs=@(
 (Join-Path $env:WINDIR 'Microsoft.NET/assembly/GAC_MSIL/System.Runtime.WindowsRuntime/v4.0_4.0.0.0__b77a5c561934e089/System.Runtime.WindowsRuntime.dll'),
 (Join-Path $env:WINDIR 'Microsoft.NET/assembly/GAC_MSIL/System.Runtime/v4.0_4.0.0.0__b03f5f7f11d50a3a/System.Runtime.dll'),
 (Join-Path $frameworkRoot 'System.Web.Extensions.dll'),$metadata
)
foreach($reference in $refs){if(-not (Test-Path -LiteralPath $reference)){throw ('Missing build reference: '+$reference)}}
$arguments=@('/nologo','/target:exe','/optimize+','/platform:x64',('/out:'+(Join-Path $outputDir 'Snowline.MediaReader.exe')))
$arguments+=($refs|ForEach-Object {'/reference:'+$_})
$arguments+=(Join-Path $projectRoot 'native/MediaReader.cs')
& $compiler @arguments
if($LASTEXITCODE -ne 0){throw 'Media reader compilation failed'}
'Windows media reader built.'
