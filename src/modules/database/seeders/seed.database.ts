import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AdminConfigRepository } from '../repositories';

@Injectable()
export class SeedDatabase implements OnApplicationBootstrap {
  @Inject(AdminConfigRepository)
  private readonly adminConfigRepository: AdminConfigRepository;

  constructor() {}

  async onApplicationBootstrap() {
    const isWorker = Boolean(Number(process.env.IS_WORKER || 0));
    if (!isWorker) {
      return;
    }
    const start = Date.now();

    const end = Date.now();

    console.log('Time to seed database', (end - start) / 1000);

    console.log('-----------SEED DATABASE SUCCESSFULLY----------------');
  }
}
