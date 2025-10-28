import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AdminConfigRepository } from '../repositories';

@Injectable()
export class SeedDatabase implements OnApplicationBootstrap {
  @Inject(AdminConfigRepository)
  private readonly adminConfigRepository: AdminConfigRepository;

  constructor() {}

  async onApplicationBootstrap() {
    const isApi = Boolean(Number(process.env.IS_API || 0));
    if (!isApi) {
      return;
    }
    const start = Date.now();

    console.log('🌱 [SeedDatabase] Starting database seeding...');

    // Seed default API key
    await this.seedDefaultApiKey();

    const end = Date.now();

    console.log(`⏱️  [SeedDatabase] Time to seed database: ${(end - start) / 1000}s`);
    console.log('✅ [SeedDatabase] SEED DATABASE SUCCESSFULLY');
  }

  /**
   * Seed default API key for development/testing
   */
  private async seedDefaultApiKey() {
    console.log('🔑 [SeedDatabase] Checking API keys...');
    
    // Check if api_keys already exists
    const existingConfig = await this.adminConfigRepository.findOne({
      where: { key: 'api_keys' },
    });

    if (existingConfig && existingConfig.data && Array.isArray(existingConfig.data) && existingConfig.data.length > 0) {
      console.log(`⚠️  [SeedDatabase] API keys already exist (${existingConfig.data.length} keys found)`);
      return;
    }

    // Create default API key for development
    const defaultApiKey = 'wsk_dev_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd';
    
    const apiKeysData = [
      {
        key: defaultApiKey,
        name: 'Default Development Key',
        active: true,
        created_at: new Date().toISOString(),
      },
    ];

    if (existingConfig) {
      // Update existing config
      existingConfig.data = apiKeysData;
      await this.adminConfigRepository.save(existingConfig);
      console.log('✅ [SeedDatabase] Updated existing API keys config with default key');
    } else {
      // Create new config
      const newConfig = this.adminConfigRepository.create({
        key: 'api_keys',
        data: apiKeysData,
      });
      await this.adminConfigRepository.save(newConfig);
      console.log('✅ [SeedDatabase] Created new API keys config with default key');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 DEFAULT API KEY (For Development/Testing Only)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ${defaultApiKey}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  WARNING: This is a default key for development only!');
    console.log('    For production, generate secure keys using:');
    console.log('    cd scripts && pnpm run generate-api-key');
    console.log('');
  }
}
