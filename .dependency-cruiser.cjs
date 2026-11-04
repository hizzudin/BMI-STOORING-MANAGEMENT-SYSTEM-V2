// Layer rules of PRD §8.3 and design.md §3: every practice that can be automated is a CI rule.
const DB_AND_QUEUE_DRIVERS = 'node_modules/(pg|drizzle-orm|ioredis|bullmq)/';

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
