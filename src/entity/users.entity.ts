/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "./base.entity";
export enum LoginType {
  LOCAL = "local",
  FACEBOOK = "facebook",
  GOOGLE = "google",
  APPLE = "apple",
}
@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  @Index()
  id: string;

  @Column({ type: "varchar", length: 100, unique: false })
  name: string;

  @Column({ type: "varchar", length: 100 })
  email: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  socialId: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  profileImage: string;

  @Column({ type: "json", nullable: true })
  about: object;

  @Column({ type: "json", nullable: true })
  coverImages: object;


  @Column({ type: "varchar", length: 500, nullable: true })
  imageKey: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  password: string;

  @Column({ type: "boolean", nullable: true, default: false })
  sendEmails: boolean;

  @Column({ type: "boolean", nullable: true, default: false })
  profile: boolean;

  @Column({ type: "varchar", length: 100, nullable: true })
  userChatId: string;

  @Column({ type: "boolean", nullable: true, default: false })
  isVerified: boolean;

  @Column({ type: "varchar", length: 100, nullable: true })
  emailLinkExpire: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  passwordResetExpire: string;

  @Column({ type: "varchar", length: 50, nullable: true, default: "user" })
  role: string;
  @Column({
    type: "enum",
    enum: LoginType,
    default: LoginType.LOCAL,
  })
  loginType: LoginType;

  @Column({
    type: "boolean",
    default: false,
  })
  isSocialLogin: boolean;

 
}
