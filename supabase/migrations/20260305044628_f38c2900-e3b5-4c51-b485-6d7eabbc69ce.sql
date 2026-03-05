DELETE FROM vault.secrets WHERE name = 'CRON_SECRET';
SELECT vault.create_secret('cron_2026_WildAtlas_a7f3e1b9d4c8', 'CRON_SECRET');