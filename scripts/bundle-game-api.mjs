import {build} from 'esbuild';

await build({
 entryPoints:['scripts/game-api-router.ts'],
 bundle:true,
 platform:'node',
 format:'esm',
 target:'node22',
 packages:'external',
 outfile:'api/router.js',
});
