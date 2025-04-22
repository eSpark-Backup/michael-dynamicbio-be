/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany, ManyToMany,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import {Comments, Likes, Page, Post} from ".";
export enum LoginType {
  LOCAL = "local",
  FACEBOOK = "facebook",
  GOOGLE = "google",
  LINKEDIN = "linkedin",
}

export enum ProfileStatus {
  EMIL_VERIFIED = "email_verified",
  BOTH_VERIFIED = "both_verified",
  PASSWORD_SET = "password_set",
  COMPLETED = "completed",

  NONE = "none",
}
@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  @Index()
  id: string;

  @Column({ type: "varchar", length: 100, unique: false })
  firstName: string;

  @Column({ type: "varchar", length: 100, unique: false })
  lastName: string;

  @Column({ type: "varchar", length: 100 })
  email: string;

  @Column({ type: "varchar", length: 5, nullable: true })
  countryCode: string;

  @Column({ type: "varchar", length: 15, nullable: true })
  phoneNumber: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  socialId: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  profileImage: string;

  @Column({ type: "json", nullable: true })
  about: object;

  @Column({ type: "varchar", nullable: true })
  coverImage: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  imageKey: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  coverImageKey: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  password: string;

  @Column({ type: "boolean", nullable: true, default: false })
  sendEmails: boolean;

  @Column({ type: "boolean", nullable: true, default: false })
  profile: boolean;

  @Column({ type: "varchar", length: 100, nullable: true })
  userChatId: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  country: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  city: string;

  @OneToMany(() => Likes, (like) => like.user)
  likes: Likes[];

  @OneToMany(() => Comments, (comment) => comment.user)
  comments: Comments[]; 

  @Column({ type: "varchar", length: 100, nullable: true })
  company: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  designation: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  industry: string;

  @Column({ type: "boolean", nullable: true, default: false })
  isPhoneVerified: boolean;

  @Column({ type: "boolean", nullable: true, default: false })
  isEmailVerified: boolean;

  @Column({ type: "varchar", length: 100, nullable: true })
  emailLinkExpire: string;

  @Column({ type: "boolean", nullable: true, default: false })
  is2FAEnabled: boolean;

  @Column({ type: "varchar", length: 100, nullable: true })
  secret: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  passwordResetExpire: string;

  @OneToMany(() => Post, (post) => post.author, { onDelete: "CASCADE" })
  posts: Post[];

  @Column({ type: "varchar", length: 50, nullable: true, default: "user" })
  role: string;
  @Column({
    type: "enum",
    enum: LoginType,
    default: LoginType.LOCAL,
  })
  loginType: LoginType;

  @Column({
    type: "enum",
    enum: ProfileStatus,
    default: ProfileStatus.NONE,
  })
  profileStatus: ProfileStatus;

  @Column({
    type: "boolean",
    default: false,
  })
  isSocialLogin: boolean;

  @OneToMany(() => Page, (page) => page.creator)
  createdPages: Page[];

  @ManyToMany(() => Page, (page) => page.admins)
  adminPages: Page[];

  @ManyToMany(() => Page, (page) => page.followers)
  followedPages: Page[];
}
