#!/bin/bash
set -e

if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ VERCEL_TOKEN غير موجود — أضفه في Secrets"
  exit 1
fi
if [ -z "$VERCEL_ORG_ID" ]; then
  echo "❌ VERCEL_ORG_ID غير موجود — أضفه في Secrets"
  exit 1
fi
if [ -z "$VERCEL_PROJECT_ID" ]; then
  echo "❌ VERCEL_PROJECT_ID غير موجود — أضفه في Secrets"
  exit 1
fi

echo "🚀 جاري الـ deploy إلى Vercel..."
npx --yes vercel --prod \
  --token="$VERCEL_TOKEN" \
  --scope="$VERCEL_ORG_ID" \
  --yes

echo "✅ تم الـ deploy بنجاح!"
