# Dynamic Bio Platform Backend
#### Client Name: Michael Netherly

## Project Requirements
The project requirements are outlined in below documents:

### Figma Link
[DynamicBio-Figma](https://www.figma.com/design/gapcwGlB9qgo9Aopz9G9yS/Fusion?node-id=0-1&t=HfArawlhraWkNZ7X-1)

### Development Proposal
[Development Proposal for DynamicBio.pdf](https://github.com/user-attachments/files/18394152/Development.Proposal.for.DynamicBio.pdf)

### Existing Showcase Website (created in Wix)
https://www.dynamicbio.net/

# DynamicBio Platform Backend

## Project Overview
The DynamicBio Platform Backend is a Node.js and TypeScript-based backend service designed for Michael Netherly's DynamicBio platform. The backend integrates secure authentication, data storage, and communication services.

### Technology Stack
- **Backend Framework:** Express.js with TypeScript
- **Database:** MySQL (via `mysql2`) and MongoDB (via `mongoose`)
- **ORM:** TypeORM
- **Authentication:** JSON Web Tokens (JWT) with OTP support
- **File Uploads:** Multer (with Cloudinary integration)
- **Documentation:** Swagger
- **Real-Time Communication:** Socket.io

### Security and Encryption
- **`otplib`**: Used for generating and verifying one-time passwords (OTPs) to secure user authentication.
- **`crypto-js`**: Employed for encryption and decryption of sensitive data, ensuring secure storage and transmission.

### Scripts
- `npm run dev`: Start the development server with `nodemon`
- `npm run build`: Compile TypeScript
- `npm run migration:generate`: Generate database migrations
- `npm run migration:run`: Run database migrations
- `npm run migration:revert`: Revert the last migration

### Repository
- **URL:** [GitHub Repository](https://github.com/eSpark-Consultants/michael-dynamicbio-be)
- **Issues:** [Issue Tracker](https://github.com/eSpark-Consultants/michael-dynamicbio-be/issues)

### Author
- Developed by eSpark Consulting Group for Michael Netherly
