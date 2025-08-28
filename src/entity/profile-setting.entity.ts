import {
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  Column,
  Index,
} from "typeorm";
import { User, BaseEntity } from ".";

export enum ProfileViewingOption {
  YOUR_NAME_AND_HEADLINE = "Your name and headline",
  PRIVATE_PROFILE_CHARACTERISTICS = "Private profile characteristics",
  PRIVATE_MODE = "Private mode",
}

@Entity()
export class ProfileSettings extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({
    type: "enum",
    enum: ProfileViewingOption,
    default: ProfileViewingOption.YOUR_NAME_AND_HEADLINE,
  })
  profileViewingOption: ProfileViewingOption;

  @Column({ type: "boolean", default: true })
  showProfilePhoto: boolean;

  @Column({ type: "boolean", default: true })
  pageVisitVisibility: boolean;

  @Column({ type: "boolean", default: true })
  allowPublicProfileEdit: boolean;

  @Column({ type: "boolean", default: false })
  showEmail: boolean;

  @Column({ type: "boolean", default: true })
  showConnections: boolean;

  @Column({ type: "boolean", default: true })
  showFollowedMembers: boolean;

  @Column({ type: "boolean", default: true })
  showLastName: boolean;

  @Column({ type: "boolean", default: true })
  showOrganizationsAndInterests: boolean;

  @Column({ type: "boolean", default: false })
  allowPageOwnersToExportData: boolean;

  @Column({ type: "boolean", default: true })
  discoverableOutsideLinkedIn: boolean;

  @Column({ type: "boolean", default: true })
  discoverableByEmail: boolean;

  @Column({ type: "boolean", default: true })
  discoverableByPhone: boolean;

  @Column({ type: "boolean", default: true })
  showHeadline: boolean;

  @Column({ type: "boolean", default: true })
  showSummary: boolean;

  @Column({ type: "boolean", default: true })
  showArticlesAndActivity: boolean;

  @Column({ type: "boolean", default: true })
  showCurrentExperience: boolean;

  @Column({ type: "boolean", default: true })
  showCurrentExperienceDetails: boolean;

  @Column({ type: "boolean", default: true })
  showPastExperience: boolean;

  @Column({ type: "boolean", default: true })
  showPastExperienceDetails: boolean;

  @Column({ type: "boolean", default: true })
  showEducation: boolean;

  @Column({ type: "boolean", default: true })
  showEducationDetails: boolean;

  @Column({ type: "boolean", default: true })
  showCertifications: boolean;

  @Column({ type: "boolean", default: true })
  showProjects: boolean;

  @Column({ type: "boolean", default: true })
  showLanguages: boolean;
  @Column({ type: "boolean", default: true })
  showSkills: boolean;
}
