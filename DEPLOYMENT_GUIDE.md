# Cloudflare Deployment Guide

## Quick Deploy Steps

### 1. Prerequisites
You need a Cloudflare API Token with these permissions:
- Account > Workers Scripts > Edit
- Account > Workers KV Storage > Edit  
- Account > D1 > Edit
- Account > Account Settings > Read

**Get your token**: https://dash.cloudflare.com/profile/api-tokens

### 2. Set Environment Variables

```bash
export CLOUDFLARE_API_TOKEN="your_api_token_here"
export CLOUDFLARE_ACCOUNT_ID="your_account_id_here"
```

### 3. Deploy

```bash
npm run deploy
```

## After First Deployment

### Add Secrets via Wrangler CLI

After the initial deployment, add your secrets one at a time:

```bash
# Required secrets
echo "your-jwt-secret" | npx wrangler secret put JWT_SECRET
echo "your-webhook-secret" | npx wrangler secret put WEBHOOK_SECRET
echo "your-google-api-key" | npx wrangler secret put GOOGLE_AI_STUDIO_API_KEY

# GitHub OAuth (for orchestrator)
echo "your-github-client-id" | npx wrangler secret put GITHUB_CLIENT_ID
echo "your-github-client-secret" | npx wrangler secret put GITHUB_CLIENT_SECRET

# Optional: Other AI providers
echo "your-anthropic-key" | npx wrangler secret put ANTHROPIC_API_KEY
echo "your-openai-key" | npx wrangler secret put OPENAI_API_KEY
```

## Current Configuration

Your project is configured with:
- **Domain**: build.cloudflare.dev
- **Database**: byte-platform-db (c4721a2b-b96a-428a-8b2a-b3d255b307e9)
- **KV Namespace**: VibecoderStore (f066f3c2e4824981b48e8586c04db9c1)
- **R2 Bucket**: byte-platform-templates
- **Dispatch Namespace**: byte-platform-namespace

## Verify Deployment

After deployment completes:
1. Visit https://build.cloudflare.dev
2. Check the Workers dashboard: https://dash.cloudflare.com/workers
3. View logs: `npx wrangler tail`

## Troubleshooting

### Missing API Token
```
Error: Missing required build variables: CLOUDFLARE_API_TOKEN
```
**Solution**: Export the CLOUDFLARE_API_TOKEN environment variable

### Database Not Found
```
Error: Database not found
```
**Solution**: Verify database exists in Cloudflare dashboard or create it:
```bash
npx wrangler d1 create byte-platform-db
```

### Domain Not Accessible
**Solution**: Verify domain is configured in Cloudflare DNS and has the correct zone_id