# Victoriosa Autopilot - Agents Guide

This document describes the specialized agents available for improving the Victoriosa Autopilot platform.

## Available Agents

### 1. Sourcing Agent (`sourcing`)
**Purpose:** Find and import products from CJ Dropshipping

**When to use:**
- Importing new products from CJ
- Searching for products in specific categories
- Managing product inventory
- Checking category counts

**Example commands:**
```
/user: Find 5 wireless chargers from CJ and import them
/user: Import electronics products from these URLs
/user: Check how many products we have in each category
```

**Key features:**
- Websearch for real CJ URLs (CJ search API is unreliable)
- Product ID extraction from URLs
- Rate limiting (1 req/sec for CJ)
- Category management (30 products max per category)

---

### 2. Analyzer Agent (`analyzer`)
**Purpose:** AI-powered product analysis

**When to use:**
- Analyzing product quality
- Assessing market potential
- Optimizing pricing
- Generating Spanish content

**Example commands:**
```
/user: Analyze this product for quality and market potential
/user: What's the optimal price for this wireless charger?
/user: Generate SEO content for this product in Spanish
```

**Key features:**
- Multi-provider AI (Groq primary)
- Quality scoring (0-100)
- Pricing optimization (30-60% margin)
- Spanish content generation

---

### 3. SEO Agent (`seo`)
**Purpose:** Optimize product listings for search

**When to use:**
- Optimizing product titles
- Creating compelling descriptions
- Suggesting relevant tags
- Improving search visibility

**Example commands:**
```
/user: Optimize this product title for SEO
/user: Generate a compelling description for this wireless charger
/user: Suggest tags for this beauty product
```

**Key features:**
- Keyword research
- Spanish SEO optimization
- Title formulas
- Tag strategies

---

### 4. Deploy Agent (`deploy`)
**Purpose:** Deployment automation

**When to use:**
- Deploying frontend to Vercel
- Deploying backend to Railway
- Configuring DNS for victoriosa.click
- Managing environment variables

**Example commands:**
```
/user: Deploy the frontend to Vercel
/user: Configure DNS for victoriosa.click
/user: Set up environment variables on Railway
```

**Key features:**
- Vercel deployment
- Railway deployment
- DNS configuration
- Environment management

---

### 5. Monitor Agent (`monitor`)
**Purpose:** Platform monitoring

**When to use:**
- Checking system health
- Monitoring AI provider status
- Checking CJ API status
- Verifying database performance

**Example commands:**
```
/user: Check system health status
/user: What's the current AI provider status?
/user: How many products do we have in each category?
```

**Key features:**
- Health checks
- Performance monitoring
- Alert management
- Resource tracking

---

## Agent Configuration

All agents are configured in `opencode.json`:

```json
{
  "agent": {
    "sourcing": { "mode": "subagent" },
    "analyzer": { "mode": "subagent" },
    "seo": { "mode": "subagent" },
    "deploy": { "mode": "subagent" },
    "monitor": { "mode": "subagent" }
  }
}
```

## Agent Files

Each agent has a detailed markdown file:
- `.opencode/agent/sourcing.md`
- `.opencode/agent/analyzer.md`
- `.opencode/agent/seo.md`
- `.opencode/agent/deploy.md`
- `.opencode/agent/monitor.md`

## Using Agents

Agents can be invoked via the `/agent` command or by describing your intent. The system will automatically route to the appropriate agent based on your request.

## Best Practices

1. **Be specific** - Include details like product URLs, categories, or counts
2. **Provide context** - Mention what you're trying to accomplish
3. **Check status** - Use the monitor agent to verify changes
4. **Follow up** - After an agent completes, verify the results

## Support

For issues with agents, check:
- Agent files in `.opencode/agent/`
- Configuration in `opencode.json`
- Logs in the application
- API status of providers (Groq, CJ, Supabase)
