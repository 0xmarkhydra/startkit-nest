import { DataSource } from 'typeorm';
import { MarketRegistryEntity } from '../src/modules/database/entities/market-registry.entity';
import { configDb } from '../src/modules/database/configs/database';
import { MarketStatus } from '../src/shared/constants/polymarket.constants';

async function checkMarketRegistryIssues() {
  const config = configDb() as any;
  const dataSource = new DataSource({
    ...config,
    entities: [MarketRegistryEntity],
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const marketRepo = dataSource.getRepository(MarketRegistryEntity);

    // 1. Kiểm tra tổng số markets theo status
    console.log('\n=== Tổng số markets theo status ===');
    const statusCounts = await marketRepo
      .createQueryBuilder('market')
      .select('market.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('market.status')
      .getRawMany();

    for (const row of statusCounts) {
      console.log(`${row.status}: ${row.count}`);
    }

    // 2. Kiểm tra các markets ended
    const endedMarkets = await marketRepo.find({
      where: { status: MarketStatus.ENDED },
      order: { end_timestamp: 'DESC' },
    });

    console.log(`\n=== Markets Ended: ${endedMarkets.length} ===`);

    // 3. Kiểm tra index_15m trùng lặp (cùng ngày, cùng index)
    console.log('\n=== Kiểm tra index_15m trùng lặp ===');
    
    // Group by index_15m và date (ngày trong năm)
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
      console.log(`⚠️  Tìm thấy ${duplicateIndexes.length} nhóm index_15m trùng lặp:`);
      for (const dup of duplicateIndexes) {
        console.log(`  - Index ${dup.index_15m} ngày ${dup.date}: ${dup.count} markets`);
        
        // Lấy chi tiết các markets trùng
        const markets = await marketRepo.find({
          where: { index_15m: dup.index_15m },
          order: { start_timestamp: 'ASC' },
        });

        const sameDateMarkets = markets.filter((m) => {
          const marketDate = new Date(m.start_timestamp * 1000).toISOString().split('T')[0];
          return marketDate === dup.date;
        });

        console.log(`    Chi tiết (${sameDateMarkets.length} markets cùng ngày ${dup.date}):`);
        for (const m of sameDateMarkets) {
          const marketDate = new Date(m.start_timestamp * 1000).toISOString();
          console.log(`      - ID: ${m.id}`);
          console.log(`        Slug: ${m.slug}`);
          console.log(`        Start: ${marketDate}`);
          console.log(`        Status: ${m.status}`);
          console.log(`        Index: ${m.index_15m}`);
          console.log(`        Created: ${m.created_at}`);
        }
      }
    } else {
      console.log('✅ Không có index_15m trùng lặp');
    }

    // 4. Kiểm tra markets có index_15m = null
    const nullIndexMarkets = await marketRepo
      .createQueryBuilder('market')
      .where('market.index_15m IS NULL')
      .getCount();

    console.log(`\n=== Markets với index_15m = NULL: ${nullIndexMarkets} ===`);
    if (nullIndexMarkets > 0) {
      const nullMarkets = await marketRepo.find({
        where: { index_15m: null },
        order: { start_timestamp: 'DESC' },
        take: 10,
      });
      console.log('Một số markets có index_15m = NULL:');
      for (const m of nullMarkets) {
        console.log(`  - ${m.slug}: status=${m.status}, start=${new Date(m.start_timestamp * 1000).toISOString()}`);
      }
    }

    // 5. Kiểm tra markets có slug trùng (theo unique constraint)
    // Lấy markets có cùng slug nhưng khác ID (nếu có)
    const duplicateSlugs = await marketRepo
      .createQueryBuilder('market')
      .select('market.slug', 'slug')
      .addSelect('COUNT(*)', 'count')
      .groupBy('market.slug')
      .having('COUNT(*) > 1')
      .getRawMany();

    if (duplicateSlugs.length > 0) {
      console.log(`\n⚠️  Tìm thấy ${duplicateSlugs.length} slugs trùng lặp (không nên xảy ra vì có unique constraint):`);
      for (const dup of duplicateSlugs) {
        const markets = await marketRepo.find({
          where: { slug: dup.slug },
          withDeleted: true, // Include soft-deleted
        });
        console.log(`  - Slug: ${dup.slug} (${markets.length} records)`);
        for (const m of markets) {
          console.log(`      ID: ${m.id}, Status: ${m.status}, Deleted: ${m.deleted_at ? 'Yes' : 'No'}`);
        }
      }
    } else {
      console.log('\n✅ Không có slug trùng lặp (đúng vì có unique constraint)');
    }

    // 6. Kiểm tra index_15m theo ngày để xem có đủ 96 markets/ngày không
    console.log('\n=== Kiểm tra số markets mỗi ngày (nên có 96 markets với index 1-96) ===');
    const marketsByDate = await marketRepo
      .createQueryBuilder('market')
      .select("TO_CHAR(TO_TIMESTAMP(market.start_timestamp), 'YYYY-MM-DD') as date")
      .addSelect('COUNT(*) as count')
      .addSelect('COUNT(DISTINCT market.index_15m) as unique_indexes')
      .where('market.index_15m IS NOT NULL')
      .groupBy("TO_CHAR(TO_TIMESTAMP(market.start_timestamp), 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(TO_TIMESTAMP(market.start_timestamp), 'YYYY-MM-DD')", 'DESC')
      .limit(10)
      .getRawMany();

    for (const row of marketsByDate) {
      const status = row.count === 96 && row.unique_indexes === 96 ? '✅' : '⚠️';
      console.log(
        `${status} ${row.date}: ${row.count} markets, ${row.unique_indexes} unique indexes (expected: 96)`,
      );
    }

    // 7. Sample một vài markets ended để xem chi tiết
    if (endedMarkets.length > 0) {
      console.log('\n=== Sample 5 markets ended gần nhất ===');
      for (const market of endedMarkets.slice(0, 5)) {
        const startDate = new Date(market.start_timestamp * 1000).toISOString();
        const endDate = new Date(market.end_timestamp * 1000).toISOString();
        console.log(`\nSlug: ${market.slug}`);
        console.log(`  Status: ${market.status}`);
        console.log(`  Index 15m: ${market.index_15m}`);
        console.log(`  Start: ${startDate}`);
        console.log(`  End: ${endDate}`);
        console.log(`  Open Price: ${market.open_price}`);
        console.log(`  Close Price: ${market.close_price}`);
        console.log(`  Type Win: ${market.type_win}`);
        console.log(`  Created: ${market.created_at}`);
        console.log(`  Updated: ${market.updated_at}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dataSource.destroy();
    console.log('\n✅ Database connection closed');
  }
}

checkMarketRegistryIssues().catch(console.error);

