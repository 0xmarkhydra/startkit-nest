import { DataSource } from 'typeorm';
import { MarketRegistryEntity } from '../src/modules/database/entities/market-registry.entity';
import { configDb } from '../src/modules/database/configs/database';
import { MarketStatus } from '../src/shared/constants/polymarket.constants';

async function checkMarketsAfterStart() {
  const config = configDb() as any;
  const dataSource = new DataSource({
    ...config,
    entities: [MarketRegistryEntity],
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    const marketRepo = dataSource.getRepository(MarketRegistryEntity);

    // 1. Tổng số markets
    const totalMarkets = await marketRepo.count();
    console.log(`📊 Tổng số markets: ${totalMarkets}\n`);

    // 2. Markets theo status
    console.log('=== Markets theo status ===');
    const statusCounts = await marketRepo
      .createQueryBuilder('market')
      .select('market.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('market.status')
      .getRawMany();

    for (const row of statusCounts) {
      console.log(`  ${row.status}: ${row.count}`);
    }
    console.log('');

    // 3. Kiểm tra index_15m trùng lặp (cùng ngày, cùng index)
    console.log('=== Kiểm tra index_15m trùng lặp ===');
    const duplicateIndexes = await marketRepo
      .createQueryBuilder('market')
      .select([
        'market.index_15m',
        "TO_CHAR(TO_TIMESTAMP(market.start_timestamp), 'YYYY-MM-DD') as date",
        'COUNT(*) as count',
      ])
      .where('market.index_15m IS NOT NULL')
      .groupBy('market.index_15m')
      .addGroupBy("TO_CHAR(TO_TIMESTAMP(market.start_timestamp), 'YYYY-MM-DD')")
      .having('COUNT(*) > 1')
      .getRawMany();

    if (duplicateIndexes.length > 0) {
      console.log(`⚠️  Tìm thấy ${duplicateIndexes.length} nhóm index_15m trùng lặp:\n`);
      for (const dup of duplicateIndexes) {
        console.log(`  - Index ${dup.index_15m} ngày ${dup.date}: ${dup.count} markets`);
        
        const markets = await marketRepo.find({
          where: { index_15m: dup.index_15m },
          order: { start_timestamp: 'ASC' },
        });

        const sameDateMarkets = markets.filter((m) => {
          const marketDate = new Date(m.start_timestamp * 1000).toISOString().split('T')[0];
          return marketDate === dup.date;
        });

        for (const m of sameDateMarkets) {
          const marketDate = new Date(m.start_timestamp * 1000).toISOString();
          console.log(`      • ${m.slug} | Status: ${m.status} | Start: ${marketDate} | ID: ${m.id}`);
        }
      }
    } else {
      console.log('✅ Không có index_15m trùng lặp\n');
    }

    // 4. Markets hiện tại (ACTIVE và UPCOMING)
    console.log('=== Markets hiện tại ===');
    const activeMarkets = await marketRepo.find({
      where: [{ status: MarketStatus.ACTIVE }, { status: MarketStatus.UPCOMING }],
      order: { start_timestamp: 'ASC' },
    });

    if (activeMarkets.length > 0) {
      for (const market of activeMarkets) {
        const startDate = new Date(market.start_timestamp * 1000).toISOString();
        const endDate = new Date(market.end_timestamp * 1000).toISOString();
        console.log(`\n  ${market.status.toUpperCase()}:`);
        console.log(`    Slug: ${market.slug}`);
        console.log(`    Index 15m: ${market.index_15m}`);
        console.log(`    Start: ${startDate}`);
        console.log(`    End: ${endDate}`);
        console.log(`    Open Price: ${market.open_price ?? 'N/A'}`);
        console.log(`    Close Price: ${market.close_price ?? 'N/A'}`);
        console.log(`    Type Win: ${market.type_win ?? 'N/A'}`);
        console.log(`    Created: ${market.created_at}`);
      }
    } else {
      console.log('  Không có markets ACTIVE hoặc UPCOMING');
    }
    console.log('');

    // 5. Markets ended (nếu có)
    const endedCount = await marketRepo.count({ where: { status: MarketStatus.ENDED } });
    if (endedCount > 0) {
      console.log(`=== Markets Ended: ${endedCount} ===`);
      const endedMarkets = await marketRepo.find({
        where: { status: MarketStatus.ENDED },
        order: { end_timestamp: 'DESC' },
        take: 5,
      });

      for (const market of endedMarkets) {
        const startDate = new Date(market.start_timestamp * 1000).toISOString();
        const endDate = new Date(market.end_timestamp * 1000).toISOString();
        console.log(`\n  ${market.slug}:`);
        console.log(`    Index 15m: ${market.index_15m}`);
        console.log(`    Start: ${startDate}`);
        console.log(`    End: ${endDate}`);
        console.log(`    Open Price: ${market.open_price ?? 'N/A'}`);
        console.log(`    Close Price: ${market.close_price ?? 'N/A'}`);
        console.log(`    Type Win: ${market.type_win ?? 'N/A'}`);
      }
    } else {
      console.log('✅ Không có markets ended (đúng vì database mới clean)');
    }
    console.log('');

    // 6. Kiểm tra markets có index_15m = NULL
    const nullIndexCount = await marketRepo.count({ where: { index_15m: null } });
    if (nullIndexCount > 0) {
      console.log(`⚠️  Markets với index_15m = NULL: ${nullIndexCount}`);
      const nullMarkets = await marketRepo.find({
        where: { index_15m: null },
        order: { start_timestamp: 'DESC' },
        take: 5,
      });
      for (const m of nullMarkets) {
        console.log(`  - ${m.slug}: status=${m.status}, start=${new Date(m.start_timestamp * 1000).toISOString()}`);
      }
    } else {
      console.log('✅ Tất cả markets đều có index_15m');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dataSource.destroy();
    console.log('\n✅ Database connection closed');
  }
}

checkMarketsAfterStart().catch(console.error);

