import { url } from "inspector";
import { SwaggerDefinition, Options } from "swagger-jsdoc";

const swaggerDefinition: SwaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "API Documentation For Fusion",
    version: "1.0.0",
    description: "API documentation for your Express application",
  },
  servers: [
    {
      url: `${process.env.DEV_SERVER_URL}/api/`,
      description: "Local Development server",
    },
    {
      url: `${process.env.PROD_SERVER_URL}/api/`,
      description: "Production server",
    },
    {
      url: "https://fusion-dev.esparkconsultants.com/api/",
      description: "Live Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};

export const swaggerOptions: Options = {
  swaggerDefinition,
  apis: ["./src/routes/**/*.ts"], // Path to your route files
};
