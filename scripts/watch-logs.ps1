Set-Location 'C:\mern2025\Learning Management System - be'
$job = Start-Job -ScriptBlock {
    Set-Location 'C:\mern2025\Learning Management System - be'
    npx -y vercel logs lms-mern-be.vercel.app --json 2>$null
}
Start-Sleep -Seconds 50
Stop-Job $job
Receive-Job $job | Select-String -Pattern 'handle-payment|sign-up|midtrans' | Select-Object -Last 20
