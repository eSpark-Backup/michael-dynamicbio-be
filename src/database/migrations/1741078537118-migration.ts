import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1741078537118 implements MigrationInterface {
    name = 'Migration1741078537118'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`post\` (\`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(36) NOT NULL, \`content\` json NULL, \`media\` json NULL, \`privacy\` enum ('public', 'friends_only', 'private') NOT NULL DEFAULT 'public', \`authorId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`post\` ADD CONSTRAINT \`FK_c6fb082a3114f35d0cc27c518e0\` FOREIGN KEY (\`authorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`post\` DROP FOREIGN KEY \`FK_c6fb082a3114f35d0cc27c518e0\``);
        await queryRunner.query(`DROP TABLE \`post\``);
    }

}
