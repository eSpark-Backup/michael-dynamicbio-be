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
    ZERO_TO_ONE = "0-1 employees",
    TWO_TO_TEN = "2-10 employees",
    ELEVEN_TO_FIFTY = "11-50 employees",
    FIFTY_ONE_TO_TWO_HUNDRED = "51-200 employees",
    TWO_HUNDRED_ONE_TO_FIVE_HUNDRED = "201-500 employees",
    FIVE_HUNDRED_ONE_TO_ONE_THOUSAND = "501-1,000 employees",
    ONE_THOUSAND_ONE_TO_FIVE_THOUSAND = "1,001-5,000 employees",
    FIVE_THOUSAND_ONE_TO_TEN_THOUSAND = "5,001-10,000 employees",
    TEN_THOUSAND_PLUS = "10,000+ employees"
  }
  
  

  export enum OrganizationType {
    PUBLIC_COMPANY = "Public company",
    SELF_EMPLOYED = "Self-employed",
    GOVERNMENT_AGENCY = "Government agency",
    NONPROFIT = "Nonprofit",
    SOLE_PROPRIETORSHIP = "Sole proprietorship",
    PRIVATELY_HELD = "Privately held",
    PARTNERSHIP = "Partnership"
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
        default: PageSize.ZERO_TO_ONE
    })
    organizationSize: PageSize;

    @Column({
        type: "enum",
        enum: IndustryType,
        default: IndustryType.TECHNOLOGY
    })
    industry: IndustryType;

    @Column({
        type: "enum",
        enum: OrganizationType,
        default: OrganizationType.PRIVATELY_HELD
    })
    organizationType: OrganizationType;





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