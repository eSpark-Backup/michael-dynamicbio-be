import Joi from "joi";
import { ProductCondition } from "../entity/product.entity";

export class ProductValidation {
  static CreateProduct = Joi.object({
    ad_name: Joi.string().trim().max(255).required(),

    category: Joi.string().trim().max(255).required(),
    sub_category: Joi.string().trim().max(255).required(),

    brand: Joi.string().trim().max(255).required(),
    model: Joi.string().trim().max(255).required(),

    condition: Joi.string()
      .valid(...Object.values(ProductCondition))
      .required(),

    authenticity: Joi.string().valid("YES", "NO").required(),

    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().trim()).min(1),
        Joi.string().trim() // allows string or JSON string input
      )
      .required(),

    ad_price: Joi.number().precision(2).positive().required(),

    negotiable: Joi.string().valid("YES", "NO").required(),

    description: Joi.string().trim().required(),

    features: Joi.string().trim().optional(),

    photos: Joi.alternatives()
      .try(Joi.string().uri(), Joi.array().items(Joi.string().uri()))
      .optional(),

    phone_number: Joi.string()
      .pattern(/^[0-9+\-\s()]{7,20}$/)
      .required(),

    backup_phone_number: Joi.string()
      .pattern(/^[0-9+\-\s()]{7,20}$/)
      .optional(),

    email_address: Joi.string().email().required(),

    website_link: Joi.string().uri().optional(),

    country: Joi.string().trim().max(100).required(),
    city: Joi.string().trim().max(100).required(),
    state: Joi.string().trim().max(100).optional(),

    location: Joi.string().trim().max(255).required(),
    map_location: Joi.alternatives()
      .try(
        Joi.object({
          lat: Joi.number().required(),
          lon: Joi.number().required(),
        }),
        Joi.string()
      )
      .optional(),
  }).unknown(true);

  static UpdateProduct = Joi.object({
    ad_name: Joi.string().trim().max(255).optional(),

    category: Joi.string().trim().max(255).optional(),
    sub_category: Joi.string().trim().max(255).optional(),

    brand: Joi.string().trim().max(255).optional(),
    model: Joi.string().trim().max(255).optional(),

    condition: Joi.string()
      .valid(...Object.values(ProductCondition))
      .optional(),

    authenticity: Joi.string().valid("YES", "NO").optional(),

    tags: Joi.alternatives()
      .try(Joi.array().items(Joi.string().trim()), Joi.string().trim())
      .optional(),

    ad_price: Joi.number().precision(2).positive().optional(),

    negotiable: Joi.string().valid("YES", "NO").optional(),

    description: Joi.string().trim().optional(),

    features: Joi.string().trim().optional(),

    photos: Joi.alternatives()
      .try(
        Joi.string().allow(""), // ✅ allow empty
        Joi.array().items(
          Joi.string()
            .uri()
            .pattern(/^https?:\/\/res\.cloudinary\.com\/.+/)
        )
      )
      .optional(),

    phone_number: Joi.string()
      .pattern(/^[0-9+\-\s()]{7,20}$/)
      .optional(),

    backup_phone_number: Joi.string()
      .pattern(/^[0-9+\-\s()]{7,20}$/)
      .optional(),

    email_address: Joi.string().email().optional(),

    website_link: Joi.string().uri().optional(),

    country: Joi.string().trim().max(100).optional(),
    city: Joi.string().trim().max(100).optional(),
    state: Joi.string().trim().max(100).optional(),

    location: Joi.string().trim().max(255).optional(),
    map_location: Joi.alternatives()
      .try(
        Joi.object({
          lat: Joi.number().required(),
          lon: Joi.number().required(),
        }),
        Joi.string()
      )
      .optional(),
  }).unknown(true);
}
