import { DataSource } from 'typeorm';
import { MarketRegistryEntity } from '../src/modules/database/entities/market-registry.entity';
import { configDb } from '../src/modules/database/configs/database';
import { MarketStatus } from '../src/shared/constants/polymarket.constants';

async function checkEndedMarketsWithoutClosePrice() {
  const config = configDb() as any;
  const dataSource = new DataSource({
    ...config,
    entities: [MarketRegistryEntity],
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const marketRepo = dataSource.getRepository(MarketRegistryEntity);

    // Find ended markets without close_price
    const endedMarkets = await marketRepo
      .createQueryBuilder('market')
      .where('market.status = :status', { status: MarketStatus.ENDED })
      .andWhere('market.close_price IS NULL')
      .orderBy('market.end_timestamp', 'DESC')
      .getMany();

    console.log(`\n=== Ended Markets Without Close Price ===`);
    console.log(`Total found: ${endedMarkets.length}`);

    if (endedMarkets.length === 0) {
      console.log('✅ No ended markets missing closePrice');
      
      // Check summary
      const summary = await marketRepo
        .createQueryBuilder('market')
        .select('COUNT(*)', 'total_ended')
        .addSelect('COUNT(CASE WHEN market.close_price IS NULL THEN 1 END)', 'missing_close_price')
        .addSelect('COUNT(CASE WHEN market.close_price IS NOT NULL THEN 1 END)', 'has_close_price')
        .where('market.status = :status', { status: MarketStatus.ENDED })
        .getRawOne();

      console.log('\n=== Summary ===');
      console.log(`Total ended markets: ${summary.total_ended}`);
      console.log(`Missing close_price: ${summary.missing_close_price}`);
      console.log(`Has close_price: ${summary.has_close_price}`);
      return;
    }

    console.log('\n--- Details ---');
    const now = Math.floor(Date.now() / 1000);
    
    for (const market of endedMarkets) {
      const secondsSinceEnd = now - market.end_timestamp;
      const minutesSinceEnd = Math.floor(secondsSinceEnd / 60);
      const hoursSinceEnd = Math.floor(minutesSinceEnd / 60);

      console.log(`\nID: ${market.id}`);
      console.log(`Slug: ${market.slug}`);
      console.log(`Status: ${market.status}`);
      console.log(`Start: ${new Date(market.start_timestamp * 1000).toISOString()}`);
      console.log(`End: ${new Date(market.end_timestamp * 1000).toISOString()}`);
      console.log(`Time since end: ${hoursSinceEnd}h ${minutesSinceEnd % 60}m ${secondsSinceEnd % 60}s (${secondsSinceEnd} seconds)`);
      console.log(`Open Price: ${market.open_price}`);
      console.log(`Close Price: ${market.close_price} ❌ MISSING`);
      console.log(`Type Win: ${market.type_win}`);
      console.log(`Created At: ${market.created_at}`);
      console.log(`Updated At: ${market.updated_at}`);
    }

    // Summary
    const summary = await marketRepo
      .createQueryBuilder('market')
      .select('COUNT(*)', 'total_ended')
      .addSelect('COUNT(CASE WHEN market.close_price IS NULL THEN 1 END)', 'missing_close_price')
      .addSelect('COUNT(CASE WHEN market.close_price IS NOT NULL THEN 1 END)', 'has_close_price')
      .where('market.status = :status', { status: MarketStatus.ENDED })
      .getRawOne();

    console.log('\n=== Summary ===');
    console.log(`Total ended markets: ${summary.total_ended}`);
    console.log(`Missing close_price: ${summary.missing_close_price}`);
    console.log(`Has close_price: ${summary.has_close_price}`);

    // Check if these markets are old enough (should have closePrice by now)
    const oldMarkets = endedMarkets.filter(m => (now - m.end_timestamp) > 300); // 5 minutes
    if (oldMarkets.length > 0) {
      console.log(`\n⚠️  WARNING: ${oldMarkets.length} markets ended more than 5 minutes ago but still missing closePrice`);
      console.log('   These should have been updated by the retry mechanism');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dataSource.destroy();
    console.log('\n✅ Database connection closed');
  }
}

checkEndedMarketsWithoutClosePrice().catch(console.error);

