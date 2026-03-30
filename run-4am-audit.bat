@echo off
REM StormPipe 4am Nightly UI Audit — Windows Task Scheduler entry point
cd /d C:\projects\stormleads
"C:\Program Files\Git\usr\bin\bash.exe" -c "cd /c/projects/stormleads && bash run-4am-audit.sh" >> C:\projects\stormleads\tests\audit-reports\task-runner.log 2>&1
