# Backend API Testing Script
# Run this after starting the server with: npm run dev

$baseUrl = "http://localhost:3000"
$token = $null

Write-Host "=== Backend API Testing ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "   [OK] Health check passed" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   [FAIL] Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Signup
Write-Host "2. Testing Signup..." -ForegroundColor Yellow
$signupData = @{
    email = "test@example.com"
    password = "password123"
    name = "Test User"
    companyName = "Test Company"
    role = "client"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/signup" -Method Post -Body $signupData -ContentType "application/json"
    $token = $response.data.token
    Write-Host "   [OK] Signup successful" -ForegroundColor Green
    Write-Host "   User ID: $($response.data.user.id)" -ForegroundColor Gray
    Write-Host "   Tenant: $($response.data.tenant.name)" -ForegroundColor Gray
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "   [WARN] User may already exist, trying login instead..." -ForegroundColor Yellow
    } else {
        Write-Host "   [FAIL] Signup failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: Login
Write-Host "3. Testing Login..." -ForegroundColor Yellow
$loginData = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginData -ContentType "application/json"
    $token = $response.data.token
    Write-Host "   [OK] Login successful" -ForegroundColor Green
    Write-Host "   User: $($response.data.user.name)" -ForegroundColor Gray
    Write-Host "   Role: $($response.data.user.role)" -ForegroundColor Gray
} catch {
    Write-Host "   [FAIL] Login failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure you have created a user first via signup" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 4: Get Current User (Protected)
Write-Host "4. Testing Get Current User (Protected Route)..." -ForegroundColor Yellow
if ($token) {
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -Method Get -Headers $headers
        Write-Host "   [OK] Get current user successful" -ForegroundColor Green
        Write-Host "   User: $($response.data.user.name)" -ForegroundColor Gray
    } catch {
        Write-Host "   [FAIL] Get current user failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "   [SKIP] Skipped (no token)" -ForegroundColor Yellow
}
Write-Host ""

# Test 5: Get Dashboard Stats (Protected)
Write-Host "5. Testing Dashboard Stats (Protected Route)..." -ForegroundColor Yellow
if ($token) {
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        $response = Invoke-RestMethod -Uri "$baseUrl/api/dashboard/stats" -Method Get -Headers $headers
        Write-Host "   [OK] Dashboard stats retrieved" -ForegroundColor Green
        Write-Host "   Total Jobs: $($response.data.totalJobs)" -ForegroundColor Gray
        Write-Host "   Active Jobs: $($response.data.activeJobs)" -ForegroundColor Gray
        Write-Host "   CO2e Saved: $($response.data.totalCO2eSaved) kg" -ForegroundColor Gray
    } catch {
        Write-Host "   [FAIL] Dashboard stats failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "   [SKIP] Skipped (no token)" -ForegroundColor Yellow
}
Write-Host ""

# Test 6: Get Asset Categories (Protected)
Write-Host "6. Testing Get Asset Categories (Protected Route)..." -ForegroundColor Yellow
if ($token) {
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        $response = Invoke-RestMethod -Uri "$baseUrl/api/asset-categories" -Method Get -Headers $headers
        Write-Host "   [OK] Asset categories retrieved" -ForegroundColor Green
        Write-Host "   Categories found: $($response.data.Count)" -ForegroundColor Gray
    } catch {
        Write-Host "   [FAIL] Asset categories failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   (This is OK if no categories exist yet)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [SKIP] Skipped (no token)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== Testing Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Create asset categories via POST /api/asset-categories (admin only)" -ForegroundColor Gray
Write-Host "2. Create a booking via POST /api/bookings" -ForegroundColor Gray
Write-Host "3. Test job workflows via PATCH /api/jobs/:id/status" -ForegroundColor Gray
