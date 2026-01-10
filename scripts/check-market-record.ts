import { DataSource } from 'typeorm';
import { MarketRegistryEntity } from '../src/modules/database/entities/market-registry.entity';
import { configDb } from '../src/modules/database/configs/database';

const MARKET_ID = '5a337b0b-f1c7-48f1-81ac-c3bef6b6de77';

async function checkMarketRecord() {
  const config = configDb() as any;
  const dataSource = new DataSource({
    ...config,
    entities: [MarketRegistryEntity],
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const marketRepo = dataSource.getRepository(MarketRegistryEntity);
    const market = await marketRepo.findOne({
      where: { id: MARKET_ID },
    });

    if (!market) {
      console.log(`❌ Market với id ${MARKET_ID} không tìm thấy`);
      return;
    }

    console.log('\n=== Market Registry Record ===');
    console.log(`ID: ${market.id}`);
    console.log(`Slug: ${market.slug}`);
    console.log(`Status: ${market.status}`);
    console.log(`Start Timestamp: ${market.start_timestamp} (${new Date(market.start_timestamp * 1000).toISOString()})`);
    console.log(`End Timestamp: ${market.end_timestamp} (${new Date(market.end_timestamp * 1000).toISOString()})`);
    console.log(`Open Price: ${market.open_price}`);
    console.log(`Close Price: ${market.close_price}`);
    console.log(`Type Win: ${market.type_win}`);
    console.log(`Subscribed At: ${market.subscribed_at}`);
    console.log(`Unsubscribed At: ${market.unsubscribed_at}`);
    console.log(`Created At: ${market.created_at}`);
    console.log(`Updated At: ${market.updated_at}`);

    const now = Math.floor(Date.now() / 1000);
    const isActive = now >= market.start_timestamp && now < market.end_timestamp;
    const isEnded = now >= market.end_timestamp;

    console.log('\n=== Market Status Analysis ===');
    console.log(`Current Time: ${now} (${new Date().toISOString()})`);
    console.log(`Is Active (now >= start && now < end): ${isActive}`);
    console.log(`Is Ended (now >= end): ${isEnded}`);
    console.log(`Status in DB: ${market.status}`);

    if (market.status === 'active' && market.close_price !== null) {
      console.log('\n⚠️  WARNING: Market đang ACTIVE nhưng đã có closePrice!');
      console.log('   Đây là bug - closePrice chỉ nên có khi market ENDED');
    }

    if (market.status === 'active' && market.type_win !== null) {
      console.log('\n⚠️  WARNING: Market đang ACTIVE nhưng đã có type_win!');
      console.log('   Đây là bug - type_win chỉ nên có khi market ENDED');
    }

    if (isEnded && market.status !== 'ended' && market.close_price !== null) {
      console.log('\n⚠️  WARNING: Market đã kết thúc (now >= end) nhưng status vẫn chưa được update thành ENDED');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dataSource.destroy();
    console.log('\n✅ Database connection closed');
  }
}

checkMarketRecord().catch(console.error);

