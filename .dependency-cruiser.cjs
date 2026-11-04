// Layer rules of PRD §8.3 and design.md §3: every practice that can be automated is a CI rule.
const DB_AND_QUEUE_DRIVERS = 'node_modules/(@types/)?(pg|drizzle-orm|ioredis|bullmq)/';

module.exports = {
  forbidden: [
    {
      name: 'engine-never-imports-a-module',
      comment: 'PRD §8.3: the assignment engine may not import any module.',
      severity: 'error',
      from: { path: '^apps/api/src/engine/' },
      to: { path: '^apps/api/src/modules/' },
    },
    {
      name: 'business-logic-never-imports-a-driver',
      comment: 'CLAUDE.md: business logic depends on a gateway port, never on a database driver.',
      severity: 'error',
      from: { path: '^apps/api/src/(core|engine|modules|ports)/' },
      to: { path: DB_AND_QUEUE_DRIVERS },
    },
    {
      name: 'business-logic-never-imports-infra',
      comment: 'Design D-07: adapters stay behind the ports.',
      severity: 'error',
      from: { path: '^apps/api/src/(core|engine|modules|ports)/' },
      to: { path: '^apps/api/src/infra/' },
    },
    {
      name: 'module-never-imports-another-module',
      comment: 'design.md §3: a module reaches others only through the engine contract.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: { path: '^apps/api/src/modules/', pathNot: '^apps/api/src/modules/$1/' },
    },
    {
      name: 'http-never-imports-infra',
      comment: 'design.md §3: controllers call services; adapters stay behind the ports.',
      severity: 'error',
      from: { path: '^apps/api/src/http/' },
      to: { path: '^apps/api/src/infra/' },
    },
    {
      name: 'business-logic-never-imports-http-or-storage-sdk',
      comment: 'design.md §3: no Nest HTTP types and no S3 SDK in core, engine, modules or ports.',
      severity: 'error',
      from: { path: '^apps/api/src/(core|engine|modules|ports)/' },
      to: {
        path: [
          '^apps/api/src/http/',
          'node_modules/(@types/)?(express|@nestjs/platform-express|@aws-sdk/[^/]+)/',
        ],
      },
    },
    {
      name: 'clients-reach-the-database-only-through-the-api',
      comment: 'DEC-66: web and mobile reach the database only through the API.',
      severity: 'error',
      from: { path: '^apps/(web|mobile)/' },
      to: { path: ['^apps/api/', DB_AND_QUEUE_DRIVERS] },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: { path: '^(apps|packages)/' },
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|\\.next|\\.expo|coverage|test-results)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/api/tsconfig.json' },
    enhancedResolveOptions: {
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
