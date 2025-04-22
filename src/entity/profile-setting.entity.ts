// profile-settings.entity.ts

import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from ".";

@Entity()
export class ProfileSettings {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ type: "boolean", default: true })
  showConnections: boolean;

  @Column({ type: "boolean", default: true })
  allowPageVisitVisibility: boolean;

  @Column({ type: "boolean", default: true })
  searchableByEngines: boolean;

  @Column({ type: "boolean", default: true })
  showProfileImage: boolean;

  @Column({ type: "boolean", default: true })
  showProfessionalInfo: boolean;

  @Column({ type: "boolean", default: true })
  showPersonalInfo: boolean;

  @Column({ type: "boolean", default: true })
  showSocialLinks: boolean;

  @Column({ type: "boolean", default: true })
  showAbout: boolean;

  @Column({ type: "boolean", default: true })
  showCountry: boolean;

  @Column({ type: "boolean", default: true })
  showCity: boolean;
}
