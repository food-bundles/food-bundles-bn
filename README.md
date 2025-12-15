# <div align="center">🍽️ FOODBUNDLES</div>

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  
  <p align="center" class="tagline">
    <em>Connecting Farmers, Restaurants & Communities</em><br>
    <strong>A comprehensive agricultural marketplace & restaurant management platform</strong>
  </p>
</div>

<div class="project-badges" align="center">
  <a href="#features">
    <img src="https://img.shields.io/badge/✓-Multi_Role_System-blue" alt="Multi-role System" />
  </a>
  <a href="#tech-stack">
    <img src="https://img.shields.io/badge/✓-Real_Time_Updates-orange" alt="Real-time Updates" />
  </a>
  <a href="#features">
    <img src="https://img.shields.io/badge/✓-Payment_Integration-green" alt="Payment Integration" />
  </a>
  <a href="#features">
    <img src="https://img.shields.io/badge/✓-Voucher_System-purple" alt="Voucher System" />
  </a>
</div>

## 📑 Table of Contents

- [👀 Project Overview](#project-overview)
- [✨ Key Features](#key-features)
- [🛠️ Tech Stack](#️tech-stack)
- [📊 Project Structure](#project-structure)
- [🚀 Getting Started](#getting-started)
- [🖥️ API Documentation](#️api-documentation)
- [📁 Folder Structure](#📁-folder-structure)
- [🔧 Configuration](#configuration)
- [🤝 Contributing](#contributing)
- [📞 Contact](#contact)

## 👀 Project Overview

FoodBundles is a comprehensive agricultural marketplace and restaurant management platform that bridges the gap between farmers, restaurants, and consumers. The system facilitates direct trade relationships, streamlines supply chain operations, and provides financial services through an integrated voucher and loan system.

The platform addresses agricultural market inefficiencies by providing:

- **Direct Farmer-Restaurant Connections**: Eliminating middlemen and ensuring fair pricing
- **Integrated Payment Solutions**: Multiple payment methods including mobile money, cards, and vouchers
- **Subscription-Based Services**: Tiered plans with varying benefits for restaurants
- **Real-time Order Management**: Live tracking and WebSocket-based updates
- **Financial Services**: Voucher system with loan applications and repayment tracking

## ✨ Key Features

### 🌾 Multi-Stakeholder Platform

Dedicated interfaces and workflows for 5 distinct user roles:

- **Farmers**: Product submissions, pricing negotiations, payment tracking
- **Restaurants**: Order management, cart functionality, subscription plans
- **Affiliators**: Order processing on behalf of restaurants
- **Admins**: Platform oversight, user management, analytics
- **Logistics**: Delivery management and tracking

### 🛒 E-Commerce & Order Management

Complete order lifecycle management:

- Shopping cart with real-time updates
- Multiple payment methods (Mobile Money, Cards, Bank Transfer, Cash, Vouchers)
- Order tracking from placement to delivery
- Automated inventory management
- Delivery OTP verification system

### 💳 Financial Services & Voucher System

Integrated financial solutions:

- Voucher-based credit system with discount tiers (10%, 20%, 50%, 80%, 100%)
- Loan application and approval workflows
- Automated penalty calculations for overdue payments
- Subscription-based service plans
- Wallet management for restaurants

### 📊 Real-time Operations

Live updates and monitoring:

- WebSocket-based real-time notifications
- Order status broadcasting
- Inventory level alerts
- Payment status updates
- Delivery tracking

### 📈 Analytics & Reporting

Comprehensive business intelligence:

- Sales performance metrics
- Order analytics and trends
- Financial reporting
- Inventory management
- User activity monitoring

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based authentication with role-based access control
- **Real-time**: WebSocket (ws) for live updates
- **Payment Integration**: Flutterwave, PayPack for mobile money and card payments
- **File Upload**: Multer with Cloudinary integration
- **Documentation**: Swagger/OpenAPI 3.0
- **SMS Services**: Twilio, Africa's Talking
- **Email Services**: Nodemailer
- **Validation**: Custom validation with location hierarchy support

## 📊 Project Structure

<details>
<summary>📂 <b>View Complete Folder Structure</b></summary>

```
FoodBundles/
│
├── src/
│   ├── config/
│   │   ├── index.ts                        # Environment configuration
│   │   ├── locations.json                  # Rwanda location data
│   │   └── swagger.yaml                    # API documentation config
│   │
│   ├── controllers/                        # Request handlers
│   │   ├── affiliator.controller.ts        # Affiliator management
│   │   ├── cart.controller.ts              # Shopping cart operations
│   │   ├── checkout.controller.ts          # Payment processing
│   │   ├── delivery.controller.ts          # Delivery management
│   │   ├── farmer.controller.ts            # Farmer operations
│   │   ├── order.controller.ts             # Order management
│   │   ├── post.controller.ts              # Social posts
│   │   ├── productController.ts            # Product management
│   │   ├── subscription.controller.ts      # Subscription plans
│   │   ├── userController.ts               # User management
│   │   ├── voucher.controller.ts           # Voucher system
│   │   ├── wallet.controller.ts            # Wallet operations
│   │   └── webhook.controller.ts           # Payment webhooks
│   │
│   ├── services/                           # Business logic
│   │   ├── cart.service.ts                 # Cart management
│   │   ├── checkout.services.ts            # Payment processing
│   │   ├── delivery.service.ts             # Delivery operations
│   │   ├── farmer.service.ts               # Farmer services
│   │   ├── location.service.ts             # Location validation
│   │   ├── notification.services.ts       # Notification system
│   │   ├── order.services.ts               # Order management
│   │   ├── post.services.ts                # Social media posts
│   │   ├── productService.ts               # Product operations
│   │   ├── subscription.service.ts         # Subscription management
│   │   ├── userServices.ts                 # User operations
│   │   ├── voucher.service.ts              # Voucher & loan system
│   │   └── wallet.service.ts               # Wallet management
│   │
│   ├── routes/                             # API endpoints
│   │   ├── adminsRoutes.ts                 # Admin routes
│   │   ├── cart.routes.ts                  # Cart endpoints
│   │   ├── checkout.routes.ts              # Payment routes
│   │   ├── farmersRoutes.ts                # Farmer routes
│   │   ├── order.routes.ts                 # Order endpoints
│   │   ├── restaurantsRoutes.ts            # Restaurant routes
│   │   ├── subscription.routes.ts          # Subscription routes
│   │   ├── voucher.routes.ts               # Voucher routes
│   │   └── index.ts                        # Route aggregation
│   │
│   ├── middleware/                         # Request middleware
│   │   ├── authMiddleware.ts               # Authentication & authorization
│   │   ├── jsonErrorHandler.ts            # Error handling
│   │   ├── multer.ts                       # File upload handling
│   │   └── postMulter.ts                   # Post media upload
│   │
│   ├── utils/                              # Utility functions
│   │   ├── cloudinary.utility.ts           # Image upload service
│   │   ├── emailTemplates.ts               # Email templates
│   │   ├── jwt.ts                          # JWT token management
│   │   ├── password.ts                     # Password utilities
│   │   ├── sms.utility.ts                  # SMS services
│   │   ├── websocket_manager.ts            # WebSocket management
│   │   └── validateTin.ts                  # TIN validation
│   │
│   ├── types/                              # TypeScript definitions
│   │   ├── userTypes.ts                    # User-related types
│   │   ├── productTypes.ts                 # Product types
│   │   ├── paymentTypes.ts                 # Payment types
│   │   └── locationTypes.ts                # Location types
│   │
│   ├── docs/                               # API documentation
│   │   ├── user.docs.yaml                  # User endpoints
│   │   ├── product.docs.yaml               # Product endpoints
│   │   ├── order.docs.yaml                 # Order endpoints
│   │   ├── voucher.docs.yaml               # Voucher endpoints
│   │   └── index.yaml                      # Documentation index
│   │
│   ├── index.ts                            # Application entry point
│   └── prisma.ts                           # Database client
│
├── prisma/
│   └── schema.prisma                       # Database schema
│
├── package.json                            # Dependencies & scripts
├── tsconfig.json                           # TypeScript configuration
└── README.md                               # Project documentation
```

</details>

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Cloudinary account (for image uploads)
- Payment provider accounts (Flutterwave, PayPack)
- SMS service accounts (Twilio, Africa's Talking)

### Installation

#### 1. Clone the repository

```bash
git clone https://github.com/your-org/foodbundles.git
cd foodbundles
```

#### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

#### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/foodbundles"

# JWT
JWT_SECRET=your-jwt-secret-key

# Payment Providers
FLW_SECRET_KEY=your-flutterwave-secret-key
FLW_PUBLIC_KEY=your-flutterwave-public-key
PAYPACK_CLIENT_ID=your-paypack-client-id
PAYPACK_CLIENT_SECRET=your-paypack-client-secret

# SMS Services
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
AFRICASTALKING_USERNAME=your-africastalking-username
AFRICASTALKING_API_KEY=your-africastalking-api-key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password

# Client URLs
CLIENT_PRODUCTION_URL=https://your-frontend-url.com
```

#### 4. Initialize Database

```bash
npx prisma generate
npx prisma db push
```

#### 5. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Visit `http://localhost:4000` to see the API running.
API Documentation: `http://localhost:4000/api-docs`

## 🖥️ API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - User login (farmers, restaurants, admins)
- `POST /api/auth/register/farmer` - Farmer registration
- `POST /api/auth/register/restaurant` - Restaurant registration
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset confirmation

### Product Management

- `GET /api/products` - List all products with filtering
- `POST /api/products` - Create new product (Admin)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Order Management

- `GET /api/orders` - List orders with filtering
- `POST /api/orders/from-cart` - Create order from cart
- `POST /api/orders/direct` - Create direct order
- `PUT /api/orders/:id` - Update order status
- `POST /api/orders/:id/cancel` - Cancel order

### Cart Operations

- `GET /api/cart` - Get restaurant's cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/:id` - Update cart item
- `DELETE /api/cart/items/:id` - Remove cart item

### Voucher System

- `GET /api/vouchers` - List vouchers
- `POST /api/vouchers/loans/apply` - Apply for loan
- `POST /api/vouchers/:id/payment` - Process voucher payment
- `POST /api/vouchers/:id/repayment` - Process repayment

### Payment Processing

- `POST /api/checkout/process` - Process payment
- `POST /api/webhooks/flutterwave` - Flutterwave webhook
- `POST /api/webhooks/paypack` - PayPack webhook

### WebSocket Events

Connect to `ws://localhost:4000/api/ws` for real-time updates:

- `order_update` - Order status changes
- `voucher_update` - Voucher status changes
- `payment_update` - Payment status changes
- `notification` - System notifications

## 🔧 Configuration

### Database Schema

The application uses Prisma with PostgreSQL. Key models include:

- **User Models**: Farmer, Restaurant, Admin, Affiliator
- **Product Models**: Product, ProductCategory
- **Order Models**: Order, OrderItem, Cart, CartItem
- **Financial Models**: Voucher, LoanApplication, VoucherTransaction
- **System Models**: Notification, Subscription, Wallet

### Payment Integration

Supports multiple payment methods:

- **Mobile Money**: MTN Mobile Money, Airtel Money (via PayPack/Flutterwave)
- **Card Payments**: Visa, Mastercard (via Flutterwave)
- **Bank Transfer**: Direct bank transfers
- **Voucher Payments**: Credit-based voucher system
- **Cash Payments**: Manual cash handling

### Subscription Plans

Tiered subscription system with features:

- **Basic Plan**: Standard ordering, basic support
- **Premium Plan**: Free delivery, voucher access, priority support
- **Enterprise Plan**: All features, custom integrations, dedicated support

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use Prisma for all database operations
- Implement proper error handling
- Add comprehensive API documentation
- Write unit tests for critical functions
- Follow RESTful API conventions

## 📞 Contact

For questions or support:

Emmanuel SHYIRAMBERE - [LinkedIn Profile](https://www.linkedin.com/in/emashyirambere)

<div class="contact-section">
  <p align="center">
    <a href="mailto:emashyirambere1@gmail.com">Mail</a> | 
    <a href="https://github.com/EmmanuelSHYIRAMBERE">GitHub</a>
  </p>
</div>

<div align="center">
  <a href="#" class="back-to-top">
    <img src="https://img.shields.io/badge/↑-Back_to_Top-blue" alt="Back to Top" />
  </a>
</div>