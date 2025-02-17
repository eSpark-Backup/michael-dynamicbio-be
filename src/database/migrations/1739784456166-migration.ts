import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1739784456166 implements MigrationInterface {
    name = 'Migration1739784456166'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user\` ADD \`secret\` varchar(100) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`secret\``);
    }

}
