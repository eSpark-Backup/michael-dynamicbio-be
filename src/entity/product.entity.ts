/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { BaseEntity, User } from ".";

export enum ProductCondition {
  NEW = "NEW",
  USED = "USED",
  REFURBISHED = "REFURBISHED",
}

export enum YesNo {
  YES = "YES",
  NO = "NO",
}

@Entity()
export class Product extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  @Index()
  id: string;

  @Column({ type: "varchar", length: 255 })
  ad_name: string;

  @Column({ type: "varchar", length: 255 })
  category: string;

  @Column({ type: "varchar", length: 255 })
  sub_category: string;

  @Column({ type: "varchar", length: 255 })
  brand: string;

  @Column({ type: "varchar", length: 255 })
  model: string;

  @Column({
    type: "enum",
    enum: ProductCondition,
    default: ProductCondition.NEW,
  })
  condition: ProductCondition;

  @Column({ type: "enum", enum: YesNo, default: YesNo.NO })
  authenticity: YesNo;

  @Column({ type: "simple-array" })
  tags: string[];

  @Column({ type: "decimal", precision: 10, scale: 2 })
  ad_price: number;

  @Column({ type: "enum", enum: YesNo, default: YesNo.NO })
  negotiable: YesNo;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  features: string;

  @Column({ type: "simple-array" })
  photos: string[];

  @Column({ type: "varchar", length: 20 })
  phone_number: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  backup_phone_number: string;

  @Column({ type: "varchar", length: 255 })
  email_address: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  website_link: string;

  @Column({ type: "varchar", length: 100 })
  country: string;

  @Column({ type: "varchar", length: 100 })
  city: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  state: string;

  @Column({ type: "varchar", length: 255 })
  location: string;

  @Column({ type: "json", nullable: true })
  map_location: { lat: number; lon: number };

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid" })
  userId: string;
}
