---
description: Check platform status and metrics
---

# Status Command

Check the current status of the Victoriosa Autopilot platform.

## Usage

```
/user: status [component]
```

## Arguments

- `component` - Optional component to check (all, products, ai, cj, database)

## Examples

```
/user: status
/user: status products
/user: status ai
/user: status cj
```

## Components

### Products
- Total published products
- Products per category
- Recent imports

### AI Providers
- Groq status and rate limits
- Cerebras status
- OpenRouter status

### CJ API
- Authentication status
- API connectivity
- Recent requests

### Database
- Connection status
- Query performance
- Storage usage

## Output Format

```
=== Platform Status ===

Products:
- Total: 120 published
- Electronics: 30 ✅
- Home & Garden: 30 ✅
- Beauty & Health: 30 ✅
- Fashion: 30 ✅

AI Providers:
- Groq: ✅ (7800/8000 TPM remaining)
- Cerebras: ❌ (Payment required)
- OpenRouter: ✅ (Limited)

CJ API: ✅ Connected
Database: ✅ Connected
```
