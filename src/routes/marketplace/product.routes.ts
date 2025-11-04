import { Router } from "express";
import { ProductController } from "../../controllers/marketplace/product.controller";
import { checkJwt } from "../../middleware/checkJwt";
import { handleMultipleFiles } from "../../middleware/handleFiles";
import { validate } from "../../validations";
import { ProductValidation } from "../../validations/product.validation";

const router = Router();
const productController = new ProductController();

router.post(
  "/create",
  checkJwt,
  handleMultipleFiles([{ name: "photos", maxCount: 10 }]),
  validate(ProductValidation.CreateProduct),
  productController.createProduct
);

router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);

router.put(
  "/:id",
  checkJwt,
  handleMultipleFiles([{ name: "photos", maxCount: 10 }]),
  validate(ProductValidation.UpdateProduct),
  productController.updateProduct
);

router.delete("/:id", checkJwt, productController.deleteProduct);

export { router as productRoutes };
