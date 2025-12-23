# 📊 FoodBundles Statistics API

## Overview

The Statistics API provides comprehensive dashboard analytics for the FoodBundles platform, offering detailed insights into users, orders, revenue, expenses, subscriptions, vouchers, and system health. This API is designed to power admin dashboards with real-time data and historical trends.

## 🚀 Features

### Dashboard Components

1. **📈 Cards Statistics**
   - Total Users with role breakdown (Restaurants, Farmers, Admins, Affiliators, Logistics)
   - Total Orders with status breakdown (Completed, Cancelled, Ongoing)
   - Finance Overview with Revenue vs Expenses
   - Subscription metrics with plan breakdown
   - Voucher statistics with usage tracking

2. **📊 Graphs & Charts**
   - Daily Orders for last 30 days (3 lines: Completed, Cancelled, Ongoing)
   - Monthly Finance Summary for last 12 months (Revenue vs Expenses)
   - User Growth Trends with role-based breakdown

3. **⚡ Quick Stats**
   - Key metrics with percentage change indicators
   - Real-time completion rates
   - Growth comparisons with previous periods

4. **🔄 Recent Activities**
   - Last 10 activities across all system sections
   - Order placements, voucher usage, subscriptions, user registrations

5. **🔧 System Status**
   - API Gateway health monitoring
   - Database performance metrics
   - WebSocket connectivity status
   - External APIs health checks

## 📋 API Endpoints

### Main Dashboard Endpoint

```http
GET /api/stats/dashboard?year=2024&month=12
```

**Response Structure:**
```json
{
  "message": "Dashboard statistics retrieved successfully",
  "data": {
    "users": {
      "totalUsers": 1250,
      "restaurants": 340,
      "farmers": 850,
      "admins": 60,
      "growth": {
        "totalChange": 12.5,
        "restaurantChange": 8.2
      }
    },
    "orders": {
      "totalOrders": 2840,
      "completedOrders": 2156,
      "cancelledOrders": 284,
      "ongoingOrders": 400,
      "dailyOrders": [...],
      "growth": {
        "totalChange": 8.2,
        "completedChange": 15.3
      }
    },
    "finance": {
      "totalRevenue": 45600000,
      "totalExpenses": 12300000,
      "netProfit": 33300000,
      "profitMargin": 77.9,
      "monthlyFinance": [...],
      "revenueBreakdown": {
        "orders": 38000000,
        "subscriptions": 5600000,
        "vouchers": 2000000
      },
      "expenseBreakdown": {
        "usedVouchers": 8000000,
        "maturedVouchers": 2000000,
        "nearMaturityVouchers": 500000,
        "farmerPayments": 1800000
      }
    },
    "subscriptions": {...},
    "vouchers": {...},
    "quickStats": {...},
    "recentActivities": [...],
    "systemStatus": {...}
  }
}
```

### Individual Stats Endpoints

| Endpoint | Description | Filters |
|----------|-------------|---------|
| `GET /api/stats/users` | User statistics with growth metrics | year, month, dateFrom, dateTo |
| `GET /api/stats/orders` | Order statistics with daily breakdown | year, month, dateFrom, dateTo |
| `GET /api/stats/finance` | Financial statistics with revenue vs expenses | year, month, dateFrom, dateTo |
| `GET /api/stats/subscriptions` | Subscription statistics with plan breakdown | year, month, dateFrom, dateTo |
| `GET /api/stats/vouchers` | Voucher statistics with usage metrics | year, month, dateFrom, dateTo |
| `GET /api/stats/quick` | Quick statistics for dashboard cards | year, month, dateFrom, dateTo |
| `GET /api/stats/activities` | Recent system activities | None |
| `GET /api/stats/system-status` | System health and status | None |

## 🔐 Authentication & Authorization

All stats endpoints require:
- **Authentication**: Valid JWT token
- **Authorization**: Admin role only

```http
Authorization: Bearer <jwt_token>
```

## 📊 Revenue & Expense Calculation

### Revenue Sources
1. **Orders**: Completed orders with `paymentStatus: COMPLETED`
2. **Subscriptions**: Subscription payments with `paymentStatus: COMPLETED`
3. **Vouchers**: Voucher repayments from restaurants

### Expense Sources
1. **Used Vouchers**: Vouchers with `status: USED` and their used credit
2. **Matured Vouchers**: Vouchers with `status: MATURED` and their used credit
3. **Near Maturity Vouchers**: Vouchers with 1-2 payment days remaining
4. **Farmer Payments**: Payments to farmers for supplies (`status: PAID`)

## 📈 Growth Calculations

Growth percentages are calculated by comparing current period with previous period:

```typescript
const growthPercentage = ((newValue - oldValue) / oldValue) * 100;
```

## 🎯 Filter Options

### Date Filters
- **year**: Filter by specific year (2020-2030)
- **month**: Filter by specific month (1-12)
- **dateFrom**: Custom start date (ISO 8601 format)
- **dateTo**: Custom end date (ISO 8601 format)

### Filter Priority
1. Custom date range (`dateFrom` & `dateTo`)
2. Year + Month combination
3. Year only (defaults to full year)
4. Current year (default)

## 🔄 Real-time Updates

The stats API provides near real-time data by:
- Querying live database data
- Calculating metrics on-demand
- Supporting WebSocket integration for live updates

## 📱 Frontend Integration

### Dashboard Cards Implementation
```typescript
// Example usage for dashboard cards
const response = await fetch('/api/stats/dashboard?year=2024');
const { data } = await response.json();

// Users card with subcards
const usersCard = {
  total: data.users.totalUsers,
  subcards: {
    restaurants: data.users.restaurants,
    farmers: data.users.farmers,
    admins: data.users.admins
  },
  growth: data.users.growth.totalChange
};

// Orders card with subcards
const ordersCard = {
  total: data.orders.totalOrders,
  subcards: {
    completed: data.orders.completedOrders,
    cancelled: data.orders.cancelledOrders,
    ongoing: data.orders.ongoingOrders
  },
  growth: data.orders.growth.totalChange
};
```

### Chart Integration
```typescript
// Daily orders chart (last 30 days)
const dailyOrdersChart = {
  type: 'line',
  data: {
    labels: data.orders.dailyOrders.map(d => d.date),
    datasets: [
      {
        label: 'Completed Orders',
        data: data.orders.dailyOrders.map(d => d.completed),
        borderColor: '#10B981'
      },
      {
        label: 'Cancelled Orders',
        data: data.orders.dailyOrders.map(d => d.cancelled),
        borderColor: '#EF4444'
      },
      {
        label: 'Ongoing Orders',
        data: data.orders.dailyOrders.map(d => d.ongoing),
        borderColor: '#3B82F6'
      }
    ]
  }
};

// Monthly finance chart (last 12 months)
const financeChart = {
  type: 'line',
  data: {
    labels: data.finance.monthlyFinance.map(m => m.month),
    datasets: [
      {
        label: 'Revenue',
        data: data.finance.monthlyFinance.map(m => m.revenue),
        borderColor: '#10B981'
      },
      {
        label: 'Expenses',
        data: data.finance.monthlyFinance.map(m => m.expenses),
        borderColor: '#EF4444'
      }
    ]
  }
};
```

## 🚨 Error Handling

The API returns structured error responses:

```json
{
  "message": "Invalid year. Year must be between 2020 and next year."
}
```

Common error scenarios:
- Invalid date parameters (400)
- Unauthorized access (401)
- Insufficient permissions (403)
- Server errors (500)

## 🔧 Performance Considerations

### Optimization Strategies
1. **Parallel Queries**: All stats are fetched in parallel using `Promise.all()`
2. **Efficient Aggregations**: Using Prisma's aggregate functions
3. **Indexed Queries**: Database queries use indexed fields (createdAt, status, etc.)
4. **Caching**: Consider implementing Redis caching for frequently accessed stats

### Response Times
- Dashboard endpoint: ~500-1000ms (comprehensive data)
- Individual endpoints: ~100-300ms (focused data)
- System status: ~50-100ms (lightweight checks)

## 📚 API Documentation

Full API documentation is available at:
- Swagger UI: `http://localhost:4000/api-docs`
- OpenAPI spec: `/src/docs/stats.docs.yaml`

## 🧪 Testing

### Example API Calls

```bash
# Get full dashboard stats for current year
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/stats/dashboard"

# Get stats for specific month
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/stats/dashboard?year=2024&month=12"

# Get custom date range stats
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/stats/orders?dateFrom=2024-12-01&dateTo=2024-12-31"

# Get system status
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/stats/system-status"
```

## 🔮 Future Enhancements

1. **Real-time WebSocket Updates**: Live dashboard updates
2. **Export Functionality**: PDF/Excel export of stats
3. **Custom Date Ranges**: More flexible date filtering
4. **Comparative Analytics**: Year-over-year comparisons
5. **Predictive Analytics**: Trend forecasting
6. **Role-based Stats**: Restaurant-specific dashboards

## 📞 Support

For questions or issues with the Statistics API:
- Check the API documentation
- Review error messages for specific guidance
- Contact the development team for technical support

---

*This Statistics API is designed to provide comprehensive insights into the FoodBundles platform performance and help administrators make data-driven decisions.*