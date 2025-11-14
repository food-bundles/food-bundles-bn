# Farmer Voucher System - USSD Integration

## Overview

The Farmer Voucher System allows farmers to request vouchers for pre-payment of future product submissions through USSD. This system integrates with the existing voucher infrastructure while providing a farmer-friendly interface.

## Features

### 1. Voucher Request via USSD
- **Access**: Dial USSD code → Select "Request Voucher"
- **Amount Range**: 10,000 - 500,000 RWF
- **Repayment Terms**: 7, 14, 30, or 60 days
- **Purpose Required**: Minimum 10 words describing intended use

### 2. Voucher Status Checking
- View latest voucher application status
- See approved amounts and repayment dates
- Track request processing

### 3. Voucher History
- View all past voucher requests
- See active vouchers and remaining credit
- Track repayment history

## USSD Flow

```
Main Menu
├── 1. Submit Product
├── 2. Request Voucher ← NEW
│   ├── 1. Request New Voucher
│   │   ├── Enter Amount (10,000-500,000 RWF)
│   │   ├── Select Days (7/14/30/60)
│   │   ├── Enter Purpose (min 10 words)
│   │   ├── Confirm Details
│   │   └── Enter PIN to Submit
│   ├── 2. Check Voucher Status
│   │   ├── Enter PIN
│   │   └── View Latest Status
│   └── 3. Voucher History
│       ├── Enter PIN
│       └── View All Requests
├── 3. Help
├── 4. My Account
└── 5. Exit
```

## Technical Implementation

### Files Modified/Created

1. **`src/services/ussdServices.ts`**
   - Added voucher menu to main menu
   - Implemented complete voucher request flow
   - Added status checking and history viewing

2. **`src/services/farmerVoucher.service.ts`** (NEW)
   - Adapter service for farmer voucher operations
   - Maps farmer data to existing voucher system
   - Handles farmer-restaurant relationship

3. **`src/types/productTypes.ts`**
   - Added voucher-related translation keys
   - Extended session data interface
   - Added voucher flow state management

### Database Integration

The system creates a "virtual restaurant" record for each farmer to integrate with the existing voucher system:

```typescript
// Farmer → Restaurant mapping
{
  name: `Farmer ${farmer.phone}`,
  email: `${farmer.phone}@farmer.foodbundles.rw`,
  phone: farmer.phone,
  address: `${farmer.village}, ${farmer.cell}, ...`,
  businessType: "FARMER"
}
```

### Subscription Management

- Automatic "Basic Farmer Plan" subscription creation
- 60-day voucher payment terms
- Free plan with voucher access enabled

## Setup Instructions

### 1. Database Setup
```sql
-- Run the setup script
psql -d your_database -f setup-farmer-plan.sql
```

### 2. Environment Configuration
Ensure your existing voucher system environment variables are configured:
- Database connection
- SMS service (for USSD)
- WebSocket manager (for real-time updates)

### 3. Testing
1. Register a farmer via USSD
2. Navigate to "Request Voucher"
3. Complete the voucher request flow
4. Verify request appears in admin voucher management

## Translation Support

The system supports three languages:
- **Kinyarwanda (KINY)**: Default
- **English (ENG)**
- **French (FRE)**

All voucher-related messages are fully translated.

## Security Features

- PIN verification for all voucher operations
- Session management with 15-minute timeout
- Input validation for amounts and purposes
- Eligibility checking before request submission

## Integration Points

### With Existing Voucher System
- Uses existing `voucher.service.ts` functions
- Leverages current approval workflow
- Maintains audit trail and reporting

### With USSD Infrastructure
- Seamless integration with current USSD flow
- Maintains session state across interactions
- Proper error handling and user feedback

## Limitations & Considerations

1. **First-time Farmers**: Limited to 100,000 RWF maximum
2. **Existing Farmers**: Up to 500,000 RWF based on history
3. **Repayment Terms**: Must align with subscription plan limits
4. **Purpose Validation**: Minimum 10 words required
5. **Eligibility**: Checked against existing loan obligations

## Future Enhancements

1. **SMS Notifications**: Voucher approval/rejection alerts
2. **Repayment Reminders**: Automated payment due notifications
3. **Credit Scoring**: Dynamic limits based on farmer performance
4. **Bulk Operations**: Multiple voucher requests
5. **Integration**: Direct product submission using voucher credit

## Support & Troubleshooting

### Common Issues

1. **"Voucher request failed"**
   - Check farmer eligibility
   - Verify subscription plan exists
   - Ensure database connectivity

2. **"No voucher requests"**
   - Farmer may not have submitted any requests
   - Check farmer-restaurant mapping

3. **"Invalid voucher amount"**
   - Amount must be between 10,000-500,000 RWF
   - Check farmer's maximum allowed amount

### Logs & Monitoring

Monitor these log entries:
- Voucher request submissions
- Eligibility check failures
- Database mapping issues
- Session timeout errors

## API Endpoints (Future)

While currently USSD-only, the system is designed to support REST API endpoints:

```
POST /api/farmers/{id}/vouchers/request
GET  /api/farmers/{id}/vouchers/status
GET  /api/farmers/{id}/vouchers/history
```

## Conclusion

The Farmer Voucher System provides a comprehensive solution for farmers to access pre-payment vouchers through familiar USSD interface, while leveraging the robust existing voucher infrastructure for processing and management.