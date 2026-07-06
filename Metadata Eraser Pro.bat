@echo off
if "%~1"=="invisible" goto :run
echo CreateObject("Wscript.Shell").Run """" ^& WScript.Arguments(0) ^& """" ^& " invisible", 0, False > "%temp%\invis.vbs"
wscript "%temp%\invis.vbs" "%~dpnx0"
exit /b

:run
cd "%~dp0"
"%~dp0node_modules\electron\dist\electron.exe" .
