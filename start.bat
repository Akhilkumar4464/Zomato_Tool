@echo off
echo ========================================================
echo   Starting Zomato Analytics & Prediction MERN Stack Tool
echo ========================================================
echo.
echo Starting Express Backend on http://localhost:5000...
start "Zomato Server" cmd /k "cd server && npm start"
timeout /t 2 /nobreak > nul

echo Starting React Frontend on http://localhost:5173...
start "Zomato Client" cmd /k "cd client && npm run dev"

echo.
echo All services launched!
echo Open your browser at: http://localhost:5173
echo ========================================================

