-- Add restaurant and hotel pricing columns to Product table
ALTER TABLE "Product" ADD COLUMN "restaurantPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "hotelPrice" DOUBLE PRECISION;

-- Update existing products to use default pricing
UPDATE "Product" SET "restaurantPrice" = "unitPrice", "hotelPrice" = "unitPrice";