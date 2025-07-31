import { Request, Response } from "express";
import {
  createProductFromSubmissionService,
  //   updateProductService,
  deleteProductService,
  getAllProductsService,
  getProductByIdService,
  getVerifiedSubmissionsService,
  approveSubmissionService,
} from "../services/productService";
import { uploadImages } from "../utils/imageUpload";
import prisma from "../prisma";

export const createProductFromSubmission = async (
  req: Request,
  res: Response
) => {
  try {
    const { submissionId } = req.params;
    const { productName, unitPrice, category, bonus, sku, quantity, expiryDate, unit } =
      req.body;
    const adminId = (req as any).user.id;

    // Handle image upload
    const images = req.files as Express.Multer.File[];
    let imageUrls: string[] = [];

    if (images && images.length > 0) {
      if (images.length > 4) {
        return res.status(400).json({
          message: "Maximum 4 images allowed",
        });
      }
      imageUrls = await uploadImages(images);
      }
      
      const existingQty = await prisma.farmerSubmission.findUnique({
        where: { id: submissionId },
        select: { acceptedQty: true, productName: true },
      });


    const result = await createProductFromSubmissionService({
      submissionId,
      productData: {
        productName: existingQty?.productName || productName,
        unitPrice,
        category,
        bonus,
        sku,
        quantity: existingQty?.acceptedQty || quantity,
        images: imageUrls,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        unit,
        createdBy: adminId,
      },
    });

    res.status(201).json({
      message: "Product created and submission approved successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create product",
    });
  }
};

// Update existing product
// export const updateProduct = async (req: Request, res: Response) => {
//   try {
//     const { productId } = req.params;
//     const updateData = req.body;
//     const adminId = (req as any).user.id;

//     // Handle image upload if new images provided
//     const images = req.files as Express.Multer.File[];
//     if (images && images.length > 0) {
//       if (images.length > 4) {
//         return res.status(400).json({
//           message: "Maximum 4 images allowed",
//         });
//       }
//       updateData.images = await uploadImages(images);
//     }

//     if (updateData.expiryDate) {
//       updateData.expiryDate = new Date(updateData.expiryDate);
//     }

//     const result = await updateProductService(productId, updateData, adminId);

//     res.status(200).json({
//       message: "Product updated successfully",
//       data: result,
//     });
//   } catch (error: any) {
//     res.status(500).json({
//       message: error.message || "Failed to update product",
//     });
//   }
// };

// Delete product
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    await deleteProductService(productId);

    res.status(200).json({
      message: "Product deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to delete product",
    });
  }
};

// Get all products
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;

    const result = await getAllProductsService({
      category: category as string,
      search: search as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.status(200).json({
      message: "Products retrieved successfully",
      data: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get products",
    });
  }
};

// Get product by ID
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const product = await getProductByIdService(productId);

    res.status(200).json({
      message: "Product retrieved successfully",
      data: product,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get product",
    });
  }
};

// Get verified submissions ready for approval
export const getVerifiedSubmissions = async (req: Request, res: Response) => {
  try {
    const submissions = await getVerifiedSubmissionsService();

    res.status(200).json({
      message: "Verified submissions retrieved successfully",
      data: submissions,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get verified submissions",
    });
  }
};

// Approve submission without creating product (direct approval)
export const approveSubmission = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;

    const result = await approveSubmissionService(submissionId);

    res.status(200).json({
      message: "Submission approved successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to approve submission",
    });
  }
};
