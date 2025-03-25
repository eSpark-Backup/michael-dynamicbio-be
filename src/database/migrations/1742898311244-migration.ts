import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1742898311244 implements MigrationInterface {
    name = 'Migration1742898311244'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`post\` DROP COLUMN \`privacy\``);
        await queryRunner.query(`ALTER TABLE \`post\` ADD \`type\` enum ('TEXT', 'IMAGE', 'VIDEO', 'ARTICLE', 'POLL', 'EVENT') NOT NULL DEFAULT 'TEXT'`);
        await queryRunner.query(`ALTER TABLE \`post\` ADD \`visibility\` enum ('PUBLIC', 'CONNECTIONS', 'ONLY_ME', 'GROUPS', 'FOLLOWERS') NOT NULL DEFAULT 'PUBLIC'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`post\` DROP COLUMN \`visibility\``);
        await queryRunner.query(`ALTER TABLE \`post\` DROP COLUMN \`type\``);
        await queryRunner.query(`ALTER TABLE \`post\` ADD \`privacy\` enum ('public', 'friends_only', 'private') NOT NULL DEFAULT 'public'`);
    }

}
