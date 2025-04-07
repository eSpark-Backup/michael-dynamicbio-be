import Joi from "joi";
import { POST_STATUS, POST_TYPE, POST_VISIBILITY } from "../constants";

export class BondValidation {
    static CreateBondValidation = Joi.object({
        recipientId: Joi.string().uuid().required().messages({
          "any.required": "Recipient ID is required 💌",
          "string.uuid": "Recipient ID must be a valid UUID ✨",
        }),
      });
}
