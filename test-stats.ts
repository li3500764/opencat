import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const orgId = "dummy";
  try {
    const res = await db.$queryRaw`
        SELECT
          TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date,
          SUM(o."savedValue")::float as value,
          SUM(o."savedHours")::float as hours
        FROM "Outcome" o
        JOIN "Customer" c ON o."customerId" = c.id
        WHERE c."organizationId" = ${orgId}
          AND o."createdAt" >= NOW() - INTERVAL '14 days'
        GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')
        ORDER BY date ASC
      `;
    console.log(res);
  } catch (e) {
    console.error("SQL Error:", e);
  }
}

main().finally(() => db.$disconnect());
