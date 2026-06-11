#!/bin/bash
set -e

MSG=${1:-"update"}

echo "📦 جاري الـ push إلى GitHub..."
git add -A
git diff --cached --quiet && echo "⚠️  ما في تغييرات جديدة" && exit 0
git commit -m "$MSG"
git push origin main

echo "✅ تم الـ push — Vercel رح يعمل redeploy تلقائي"
