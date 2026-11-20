I'll start by examining the existing codebase to understand the patterns used, then create the workspace service layer.

Let me look at the existing files to understand the conventions.

<bash>
find frontend-v2/src -type f -name "*.ts" | head -50
</bash>

<bash>
cat frontend-v2/src/services/api.ts 2>/dev/null || echo "FILE NOT FOUND"
</bash>

<bash>
ls -la frontend-v2/src/services/ 2>/dev/null
</bash>

<bash>
find frontend-v2/src -type d | head -40
</bash>

<bash>
cat frontend-v2/package.json 2>/dev/null | head -60
</bash>

<bash>
find frontend-v2/src -name "*.ts" -path "*store*" -o -name "*.ts" -path "*auth*" | head -20
</bash>

<bash>
find frontend-v2/src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs grep -l "idempotency\|idempotencyKey\|Idempotency" 2>/dev/null | head -20
</bash>

<bash>
find frontend-v2/src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs grep -l "apiClient\|api-client\|axios\|fetch(" 2>/dev/null | head -20
</bash>

<bash>
find frontend-v2/src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs grep -l "tenantId\|tenant" 2>/dev/null | head -20
</bash>

<bash>
find frontend-v2/src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs grep -l "useAuthStore\|authStore\|AuthStore" 2>/dev/null | head -20
</bash>

<bash>
find frontend-v2/src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs grep -l "expectedVersion\|expected_version" 2>/dev/null | head -20
</bash>

<bash>
find frontend-v2/src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs grep -l "uuid\|nanoid\|crypto.randomUUID" 2>/dev/null | head -20
</bash>

<bash>
find frontend-v2/src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs grep -l "class.*Error\|ApiError\|HttpError" 2>/dev/null | head -20
</bash>

<bash>
find frontend-v2/src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs grep -l "export.*function\|export const" 2>/dev/null | grep -i "service\|api" | head -20
</bash>

<bash>
ls -la frontend-v2/src/ 2>/dev/null
</bash>

<bash>
find frontend-v2 -maxdepth 2 -type d 2>/dev/null
</bash>

<bash>
cat frontend-v2/tsconfig.json 2>/dev/null
</bash>

<bash>
find frontend-v2 -name "*.ts" -path "*lib*" -o -name "*.ts" -path "*utils*" 2>/dev/null | head -20
</bash>

<bash>
find frontend-v2 -type f -name "*.ts" 2>/dev/null | head -60
</bash>

<bash>
find frontend-v2 -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | wc -l
</bash>

<bash>
find frontend-v2 -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | head -80
</bash>

<bash>
ls -la frontend-v2 2>/dev/null
</bash>

<bash>
find frontend-v2 -maxdepth 3 -type f 2>/dev/null | head -80
</bash>

<bash>
cat frontend-v2/src/services/api.ts 2>/dev/null; echo "---"; ls frontend-v2/src/services 2>/dev/null; echo "---"; cat frontend-v2/src/lib/api-client.ts 2>/dev/null; echo "---"; cat frontend-v2/src/stores/auth.store.ts 2>/dev/null
</bash>

<bash>
find frontend-v2 -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | grep -iE "api|auth|store|service|client" | head -40
</bash>

<bash>
find frontend-v2 -type f 2>/dev/null | grep -vE "node_modules|\.git" | head -100
</bash>

<bash>
ls -la frontend-v2/src 2>/dev/null; echo "==="; ls -la frontend-v2 2>/dev/null
</bash>

<bash>
find frontend-v2 -type f 2>/dev/null | grep -v node_modules | head -100
</bash>

<bash>
ls -la frontend-v2 2>/dev/null && echo "EXISTS" || echo "NO frontend-v2"
</bash>

<bash>
ls -la 2>/dev/null
</bash>

<bash>
find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -40
</bash>

<bash>
find . -type f -name "api.ts" 2>/dev/null | grep -v node_modules | head
</bash>

<bash>
find . -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | grep -v node_modules | head -60
</bash>

<bash>
find . -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | grep -v node_modules | wc -l
</bash>

<bash>
find . -type d -name "frontend-v2" 2>/dev/null | grep -v node_modules
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | grep -iE "api|auth|store|service|client|idempot" | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
pwd; ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -60
</bash>

<bash>
ls -la
</bash>

<bash>
find . -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -50
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -40
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | wc -l
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -80
</bash>

<bash>
ls -la; echo "==="; find . -maxdepth 2 -type d 2>/dev/null | grep -v node_modules | grep -v "\.git"
</bash>

<bash>
find . -type f -name "*.ts" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f -name "*.tsx" 2>/dev/null | grep -v node_modules | head -30
</bash>

<bash>
find . -type f 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -