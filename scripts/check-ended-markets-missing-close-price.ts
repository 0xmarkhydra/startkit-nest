import { DataSource } from 'typeorm';
import { MarketRegistryEntity } from '../src/modules/database/entities/market-registry.entity';
import { configDb } from '../src/modules/database/configs/database';
import { MarketStatus } from '../src/shared/constants/polymarket.constants';

async function checkEndedMarketsMissingClosePrice() {
  const config = configDb() as any;
  const dataSource = new DataSource({
    ...config,
    entities: [MarketRegistryEntity],
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const marketRepo = dataSource.getRepository(MarketRegistryEntity);

    // Find ended markets missing close_price or type_win
    const endedMarkets = await marketRepo
      .createQueryBuilder('market')
      .where('market.status = :status', { status: MarketStatus.ENDED })
      .andWhere('(market.close_price IS NULL OR market.type_win IS NULL)')
      .orderBy('market.end_timestamp', 'DESC')
      .getMany();

    console.log(`\n=== Ended Markets Missing Close Price ===`);
    console.log(`Total found: ${endedMarkets.length}`);

    if (endedMarkets.length === 0) {
      console.log('✅ No ended markets missing closePrice or type_win');
      return;
    }

    console.log('\n--- Details ---');
    for (const market of endedMarkets) {
      const now = Math.floor(Date.now() / 1000);
      const daysSinceEnd = Math.floor((now - market.end_timestamp) / 86400);

      console.log(`\nID: ${market.id}`);
      console.log(`Slug: ${market.slug}`);
      console.log(`Status: ${market.status}`);
      console.log(`Start: ${new Date(market.start_timestamp * 1000).toISOString()}`);
      console.log(`End: ${new Date(market.end_timestamp * 1000).toISOString()}`);
      console.log(`Days since end: ${daysSinceEnd}`);
      console.log(`Open Price: ${market.open_price}`);
      console.log(`Close Price: ${market.close_price} ${market.close_price === null ? '❌ MISSING' : '✅'}`);
      console.log(`Type Win: ${market.type_win} ${market.type_win === null ? '❌ MISSING' : '✅'}`);
      console.log(`Created At: ${market.created_at}`);
      console.log(`Updated At: ${market.updated_at}`);
    }

    // Summary
    const missingClosePrice = endedMarkets.filter((m) => m.close_price === null).length;
    const missingTypeWin = endedMarkets.filter((m) => m.type_win === null).length;
    const missingBoth = endedMarkets.filter((m) => m.close_price === null && m.type_win === null).length;

    console.log('\n=== Summary ===');
    console.log(`Missing close_price: ${missingClosePrice}`);
    console.log(`Missing type_win: ${missingTypeWin}`);
    console.log(`Missing both: ${missingBoth}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dataSource.destroy();
    console.log('\n✅ Database connection closed');
  }
}

checkEndedMarketsMissingClosePrice().catch(console.error);

