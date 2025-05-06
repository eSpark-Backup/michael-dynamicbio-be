import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from "typeorm";
import { BaseEntity, Post, User } from ".";


@Entity("groups")
export class Group extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ nullable: false })
  address: string;

  @Column({ nullable: true })
  locationCountry: string;

  @Column({ type: "simple-array", nullable: true })
  branchesCountries: string[];



  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  tagline: string;

  @Column({ nullable: true })
  productionDescription: string;

  @Column({ nullable: true })
  energyConsumption: string;

  @Column({ nullable: true })
  certifications: string;

  @Column({ nullable: true })
  costDetails: string;

  // Fields for Transportation industry type
  @Column({ nullable: true })
  transportationDescription: string;

  @Column({ nullable: true })
  fleetSize: number;

  @Column({ nullable: true })
  operatingRange: string;

  @Column({ nullable: true })
  transportationCostDetails: string;

  // Fields for Storage industry type

  @Column({ nullable: true })
  storageCapacity: string;

  @Column({ nullable: true })
  storageTemperature: string;

  //Fields For Other industry type
  @Column({ nullable: true })
  otherDescription: string;

  @Column({ nullable: true })
  otherCostDetails: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  coverImageUrl: string;

  @Column({ nullable: true })
  logoPublicId: string;

  @Column({ nullable: true })
  coverImagePublicId: string;

  @ManyToOne(() => User)
  creator: User;

  @Column()
  creatorId: string;

  @ManyToMany(() => User)
  @JoinTable({
    name: "group_admins",
    joinColumn: { name: "group_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  admins: User[];

  @ManyToMany(() => User)
  @JoinTable({
    name: "group_followers",
    joinColumn: { name: "group_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  followers: User[];

  @OneToMany(() => Post, (post) => post.group)
  posts: Post[];
}
