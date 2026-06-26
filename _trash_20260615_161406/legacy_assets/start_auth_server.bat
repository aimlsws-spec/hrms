@echo off
echo Starting HRMS Auth Server on port 8001...
cd /d "c:\hrms_agent"
python auth_server.py
pause