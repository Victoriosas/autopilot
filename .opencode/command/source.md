---
description: Import products from CJ Dropshipping
---

# Source Products Command

Import products from CJ Dropshipping to the Victoriosa Autopilot platform.

## Usage

```
/user: source [category] [count] [urls...]
```

## Arguments

- `category` - Target category (electronics, home, beauty, fashion)
- `count` - Number of products to import (default: 5)
- `urls` - Optional CJ product URLs to import

## Examples

```
/user: source electronics 5
/user: source beauty 10
/user: source fashion https://cjdropshipping.com/product/xxx.html
```

## Process

1. Search CJ for products in specified category
2. Extract product IDs from URLs
3. Fetch product details from CJ
4. Analyze products with AI
5. Publish to database
6. Report results

## Rate Limits

- CJ API: 1 request per second
- AI Analysis: 2 second delay between calls
- Handle 429 errors with 5 second wait
