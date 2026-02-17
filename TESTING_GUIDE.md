# Quick Test Guide - Expired Vouchers Notification

## 🧪 Testing Steps

### Step 1: Add Test Recipients
```bash
# Add recipient for expired vouchers
curl -X POST http://localhost:5000/api/notification-recipients \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Finance Manager",
    "phoneNumber": "+250788123456",
    "category": "EXPIRED_VOUCHERS"
  }'

# Add another recipient (optional)
curl -X POST http://localhost:5000/api/notification-recipients \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Operations Manager",
    "phoneNumber": "+250788654321",
    "category": "EXPIRED_VOUCHERS"
  }'
```

### Step 2: Verify Recipients
```bash
# Check if recipients were added
curl -X GET "http://localhost:5000/api/notification-recipients?category=EXPIRED_VOUCHERS" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 3: Test Manually (Optional)
```typescript
// In your code or via API endpoint
import { sendVoucherMaturityRemindersService } from "./services/voucher-reminder.service";

const result = await sendVoucherMaturityRemindersService();
console.log(result);
```

### Step 4: Wait for Scheduled Run
- The job runs automatically at 7:00 AM daily
- Check logs at 7:00 AM to verify execution

## 📱 Expected SMS Messages

### For Matured Vouchers (to MATURED_VOUCHERS recipients)
```
MATURED VOUCHERS ALERT

Total: 3 voucher(s)
Total Amount: 1,500,000 RWF

Details:
Pizza Palace: VCH-123 - 500,000 RWF
Burger House: VCH-456 - 700,000 RWF
Sushi Bar: VCH-789 - 300,000 RWF
```

### For Expired Vouchers (to EXPIRED_VOUCHERS recipients)
```
EXPIRED VOUCHERS ALERT

Total: 5 voucher(s)
Total Credit: 2,500,000 RWF

Details:
Pizza Palace: VCH-ABC - 500,000 RWF
Burger House: VCH-DEF - 700,000 RWF
Sushi Bar: VCH-GHI - 300,000 RWF
Cafe Delight: VCH-JKL - 600,000 RWF
Grill Master: VCH-MNO - 400,000 RWF
```

## 🔍 Verification Checklist

- [ ] Recipients added successfully
- [ ] Recipients appear in GET request
- [ ] Recipients have correct category (EXPIRED_VOUCHERS)
- [ ] Recipients are active (isActive: true)
- [ ] Phone numbers are in correct format (+250...)
- [ ] Cron job is running (check logs)
- [ ] SMS received at 7:00 AM

## 📊 Check Results in Logs

Look for these log messages:
```
Running voucher maturity reminders...
Found X EXPIRED vouchers
Expired vouchers notification sent to [Name] ([Phone])
Voucher reminders completed: Success
```

## 🐛 Troubleshooting

### No SMS Received?
1. Check if recipients are active: `isActive: true`
2. Verify phone number format: `+250788123456`
3. Check if expired vouchers exist in database
4. Verify SMS service is configured (Pindo/Twilio)
5. Check server logs for errors

### Wrong Category?
```bash
# Update recipient category
curl -X PATCH http://localhost:5000/api/notification-recipients/RECIPIENT_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "EXPIRED_VOUCHERS"
  }'
```

### Disable Recipient Temporarily?
```bash
# Disable without deleting
curl -X PATCH http://localhost:5000/api/notification-recipients/RECIPIENT_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

## ✅ Success Indicators

1. ✅ Recipients created successfully (201 status)
2. ✅ Recipients visible in GET request
3. ✅ Cron job logs show execution at 7:00 AM
4. ✅ SMS received by all active recipients
5. ✅ No errors in server logs
6. ✅ Results object shows correct counts

## 🎯 Quick Commands

```bash
# List all recipients
GET /api/notification-recipients

# List only expired vouchers recipients
GET /api/notification-recipients?category=EXPIRED_VOUCHERS

# List only active recipients
GET /api/notification-recipients?isActive=true

# Update recipient
PATCH /api/notification-recipients/:id

# Delete recipient
DELETE /api/notification-recipients/:id
```
