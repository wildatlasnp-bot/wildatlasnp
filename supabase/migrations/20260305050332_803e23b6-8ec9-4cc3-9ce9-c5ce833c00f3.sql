DELETE FROM vault.secrets WHERE name = 'CRON_SECRET';
SELECT vault.create_secret('cs_a7f3e1b9d4c8562f0e1a3b7c9d5f2e8a', 'CRON_SECRET');