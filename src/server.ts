import { server } from "./app";
import { logger } from "./utils";

const PORT = process.env.PORT || 3000;

try {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} catch (error) {
  logger.error(`Server Initialization Error :: ${(error as Error)?.message}`);
  process.exit(1);
}
