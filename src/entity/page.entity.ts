import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToMany,
    JoinTable
} from "typeorm";
import { BaseEntity, Post, User } from ".";

export enum PageType {
    COMPANY = "COMPANY",
    EDUCATIONAL_INSTITUTE = "EDUCATIONAL_INSTITUTE"
}

export enum PageSize {
    SMALL = "SMALL",
    MEDIUM = "MEDIUM",
    LARGE = "LARGE",
    ENTERPRISE = "ENTERPRISE"
}

export enum IndustryType {
    PRODUCTION = "PRODUCTION",
    TRANSPORTATION = "TRANSPORTATION",
    STORAGE = "STORAGE",
    TECHNOLOGY = "TECHNOLOGY",
    FINANCE = "FINANCE",
    EDUCATION = "EDUCATION",
    HEALTHCARE = "HEALTHCARE",
    RETAIL = "RETAIL",
    OTHER = "OTHER"
}

@Entity("pages")
export class Page extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ nullable: false })
    name: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({
        type: "enum",
        enum: PageType,
        default: PageType.COMPANY
    })
    type: PageType;

    @Column({ nullable: false })
    address: string;

    @Column({ nullable: true })
    locationCountry: string;

    @Column({ type: "simple-array", nullable: true })
    branchesCountries: string[];

    @Column({
        type: "enum",
        enum: PageSize,
        default: PageSize.SMALL
    })
    organizationSize: PageSize;

    @Column({
        type: "enum",
        enum: IndustryType,
        default: IndustryType.TECHNOLOGY
    })
    industry: IndustryType;

    @Column({ nullable: true })
    website: string;

    @Column({ nullable: true })
    tagline: string;

    // Fields for Production industry type
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
    storageDescription: string;

    @Column({ nullable: true })
    storageCapacity: string;

    @Column({ nullable: true })
    storageType: string;

    @Column({ nullable: true })
    storageCostDetails: string;

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
        name: "page_admins",
        joinColumn: { name: "page_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    admins: User[];

    @ManyToMany(() => User)
    @JoinTable({
        name: "page_followers",
        joinColumn: { name: "page_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    followers: User[];

    @OneToMany(() => Post, post => post.page)
    posts: Post[];
}