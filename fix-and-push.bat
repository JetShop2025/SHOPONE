@echo off
echo Fixing TypeScript build error and pushing to GitHub...
cd "c:\Users\jetsh\Downloads\graphical-system-v2"
git add .
git commit -m "Fix: Resolve TypeScript build error in TrailasTable_test.tsx - Added export statement"
git push origin main
echo Done!
pause
