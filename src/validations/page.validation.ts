import Joi from "joi";
import { IndustryType, OrganizationType, PageSize, PageType } from "../entity/page.entity";

export class PageValidation {
    static createPage = Joi.object({
        name: Joi.string().required().min(2).max(100)
            .messages({
                "string.empty": "Name is required",
                "string.min": "Name must be at least 2 characters",
                "string.max": "Name cannot exceed 100 characters"
            }),

        type: Joi.string()
            .valid(...Object.values(PageType))
            .required()
            .messages({
                "any.required": "Page type is required",
                "any.only": "Invalid page type"
            }),

        address: Joi.string().required()
            .messages({
                "string.empty": "Address is required"
            }),

        locationCountry: Joi.string().allow(null, "")
            .messages({
                "string.base": "Location/Country must be a string"
            }),

        branchesCountries: Joi.alternatives()
            .try(
                Joi.array().items(Joi.string()),
                Joi.string()
            )
            .allow(null)
            .messages({
                "array.base": "Branches/Countries must be an array or string"
            }),

        organizationSize: Joi.string()
            .valid(...Object.values(PageSize))
            .required()
            .messages({
                "any.required": "Organization size is required",
                "any.only": "Invalid organization size"
            }),

        industry: Joi.string()
            .valid(...Object.values(IndustryType))
            .required()
            .messages({
                "any.required": "Industry is required",
                "any.only": "Invalid industry type"
            }),

        organizationType: Joi.string()
            .valid(...Object.values(OrganizationType))
            .required()
            .messages({
                "any.required": "Organization type is required",
                "any.only": "Invalid organization type"
            }),

        website: Joi.string().uri().allow(null, "")
            .messages({
                "string.uri": "Website must be a valid URL"
            }),

        tagline: Joi.string().max(200).allow(null, "")
            .messages({
                "string.max": "Tagline cannot exceed 200 characters"
            }),

        // Production industry fields
        productionDescription: Joi.string().when("industry", {
            is: "PRODUCTION",
            then: Joi.required(),
            otherwise: Joi.allow(null, "")
        }).messages({
            "any.required": "Production description is required for Production industry"
        }),

        energyConsumption: Joi.string().when("industry", {
            is: "PRODUCTION",
            then: Joi.required(),
            otherwise: Joi.allow(null, "")
        }).messages({
            "any.required": "Energy consumption is required for Production industry"
        }),

        certifications: Joi.string().allow(null, ""),

        costDetails: Joi.string().allow(null, ""),

        // Transportation industry fields
        transportationDescription: Joi.string().when("industry", {
            is: "TRANSPORTATION",
            then: Joi.required(),
            otherwise: Joi.allow(null, "")
        }).messages({
            "any.required": "Transportation description is required for Transportation industry"
        }),

        fleetSize: Joi.number().integer().min(0).when("industry", {
            is: "TRANSPORTATION",
            then: Joi.required(),
            otherwise: Joi.allow(null)
        }).messages({
            "any.required": "Fleet size is required for Transportation industry",
            "number.base": "Fleet size must be a number",
            "number.integer": "Fleet size must be an integer",
            "number.min": "Fleet size cannot be negative"
        }),

        operatingRange: Joi.string().when("industry", {
            is: "TRANSPORTATION",
            then: Joi.required(),
            otherwise: Joi.allow(null, "")
        }).messages({
            "any.required": "Operating range is required for Transportation industry"
        }),

        transportationCostDetails: Joi.string().allow(null, ""),

        // Storage industry fields
      
        storageCapacity: Joi.string().when("industry", {
            is: "STORAGE",
            then: Joi.required(),
            otherwise: Joi.allow(null, "")
        }).messages({
            "any.required": "Storage capacity is required for Storage industry"
        }),

        storageTemperature: Joi.string().when("industry", {
            is: "STORAGE",
            then: Joi.required(),
            otherwise: Joi.allow(null, "")
        }).messages({
            "any.required": "Storage temperature is required for Storage industry"
        }),

        // Other industry fields
        otherDescription: Joi.string().when("industry", {
            is: "OTHER",
            then: Joi.required(),
            otherwise: Joi.allow(null, "")
        }).messages({
            "any.required": "Other description is required for Other industry"
        }),

        otherCostDetails: Joi.string().when("industry", {
            is: "OTHER",
            then: Joi.required(),
            otherwise: Joi.allow(null, "")
        }).messages({
            "any.required": "Other cost details are required for Other industry"
        }),

       
    }).unknown(true);

    static updatePage = Joi.object({
        name: Joi.string().min(2).max(100)
            .messages({
                "string.min": "Name must be at least 2 characters",
                "string.max": "Name cannot exceed 100 characters"
            }),

        type: Joi.string()
            .valid(...Object.values(PageType))
            .messages({
                "any.only": "Invalid page type"
            }),

        address: Joi.string(),

        locationCountry: Joi.string().allow(null, ""),

        branchesCountries: Joi.alternatives()
            .try(
                Joi.array().items(Joi.string()),
                Joi.string()
            )
            .allow(null),

        organizationSize: Joi.string()
            .valid(...Object.values(PageSize))
            .messages({
                "any.only": "Invalid organization size"
            }),

        industry: Joi.string()
            .valid(...Object.values(IndustryType))
            .messages({
                "any.only": "Invalid industry type"
            }),

            organizationType: Joi.string()
            .valid(...Object.values(OrganizationType))
            .messages({
                "any.only": "Invalid organization type"
            }),

        website: Joi.string().uri().allow(null, "")
            .messages({
                "string.uri": "Website must be a valid URL"
            }),

        

        tagline: Joi.string().max(200).allow(null, ""),

        // Various industry-specific fields are optional during update
        productionDescription: Joi.string().allow(null, ""),
        energyConsumption: Joi.string().allow(null, ""),
        certifications: Joi.string().allow(null, ""),
        costDetails: Joi.string().allow(null, ""),
        transportationDescription: Joi.string().allow(null, ""),
        fleetSize: Joi.number().integer().min(0).allow(null),
        operatingRange: Joi.string().allow(null, ""),
        transportationCostDetails: Joi.string().allow(null, ""),
        storageCapacity: Joi.string().allow(null, ""),
        storageTemperature: Joi.string().allow(null, ""),
        otherDescription: Joi.string().allow(null, ""),
        otherCostDetails: Joi.string().allow(null, ""),
    }).unknown(true);

    static addAdmin = Joi.object({
        userId: Joi.string().required()
            .messages({
                "string.empty": "User ID is required"
            })
    });
}