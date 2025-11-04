import { Router } from "express";
import { productRoutes } from "./product.routes";

const marketplaceRouter = Router();

marketplaceRouter.use("/product", productRoutes);

export { marketplaceRouter };
