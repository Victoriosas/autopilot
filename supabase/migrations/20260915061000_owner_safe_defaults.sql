-- Owner production-truth cleanup.
-- Keep legacy/admin settings aligned with V4 fail-closed policy.
-- This migration is intentionally idempotent and contains no secrets.

update public.settings
set value = jsonb_build_object(
  'autoApproveScoreThreshold', 85,
  'maxRiskLevelAllowed', 'low',
  'minMarginPercentage', 30,
  'autoPublishApproved', false,
  'brandTone', 'premium_beauty_uruguay',
  'activeSources', jsonb_build_array('CJ Dropshipping'),
  'blacklistedKeywords', jsonb_build_array(
    'fake','replica','imitation','cure','medical','miracle','toxic','unauthorized','counterfeit'
  ),
  'targetCategories', jsonb_build_array(
    'Belleza y cuidado personal',
    'Accesorios de skincare',
    'Organización de belleza',
    'Cuidado corporal'
  ),
  'defaultCurrency', 'UYU ($)',
  'autoDiscoveryIntervalHours', 6
),
updated_at = now()
where key = 'autopilot_config';
