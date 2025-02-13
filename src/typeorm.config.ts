// import { DataSource } from "typeorm";
// import dotenv from "dotenv";

// dotenv.config();
// //console.log("Environment Variables:", process.env);

// // TypeORM Configuration
// export const AppDataSource = new DataSource({
//   type: "mariadb",
//   host: process.env.MYSQL_HOST,
//   port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
//   username: process.env.MYSQL_USER,
//   database: process.env.MYSQL_DATABASE,
//   synchronize: true,
//   // password: process.env.MYSQL_PASSWORD,
//   logging: false,
//   entities: [__dirname + "/entity/*.entity{.ts,.js}"],
//   migrations: [__dirname + "/*.entity{.ts,.js}"],
//   subscribers: [],
// });

import { DataSource } from "typeorm";
import dotenv from "dotenv";

dotenv.config();

// TypeORM Configuration
console.log(__dirname);
export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
  username: process.env.MYSQL_USER,
  database: process.env.MYSQL_DATABASE,
  password: process.env.MYSQL_PASSWORD,
  synchronize: false,
  logging: false,
  entities: [__dirname + "/entity/*.entity{.ts,.js}"],
  migrations: [__dirname + "/database/migrations/*.ts"],
  migrationsTableName: "_migrations",

  cache: false,
});
