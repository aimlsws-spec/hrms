@echo off
echo Starting HRMS Portal...
cd /d "d:\hrms_agent"
py -c "import uvicorn; from app import app; print('Portal starting at http://localhost:8002'); uvicorn.run(app, host='0.0.0.0', port=8002)"
pause