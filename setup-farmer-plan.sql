-- Setup Basic Farmer Plan for Voucher System
-- This script creates a basic subscription plan for farmers to use the voucher system

-- Insert Basic Farmer Plan if it doesn't exist
INSERT INTO "SubscriptionPlan" (
  id,
  name,
  description,
  price,
  duration,
  "voucherAccess",
  "voucherPaymentDays",
  features,
  "isActive",
  "createdAt",
  "updatedAt"
) 
SELECT 
  gen_random_uuid(),
  'Basic Farmer Plan',
  'Basic plan for farmers to access voucher system for pre-payment of future product submissions',
  0.00,
  365,
  true,
  60,
  ARRAY['Voucher Request', 'Product Submission', 'Payment History', 'Basic Support'],
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "SubscriptionPlan" WHERE name = 'Basic Farmer Plan'
);

-- Create a default admin user for voucher approvals if needed
-- This is optional and should be customized based on your admin setup
INSERT INTO "Admin" (
  id,
  username,
  email,
  password,
  role,
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT 
  gen_random_uuid(),
  'voucher_admin',
  'voucher@foodbundles.rw',
  '$2b$10$example.hash.for.default.password', -- Replace with actual hashed password
  'SUPER_ADMIN',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Admin" WHERE username = 'voucher_admin'
);

-- Note: Remember to:
-- 1. Replace the password hash with a real hashed password
-- 2. Run this script in your database
-- 3. Ensure the Admin table exists in your schema
-- 4. Customize the plan features and limits as needed