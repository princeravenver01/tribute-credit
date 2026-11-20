import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const suppliedFavicon = path.join(root, 'public/favicon.png');
const appIcon = path.join(root, 'src/app/icon.png');
const oldFavicon = path.join(root, 'src/app/favicon.ico');

test('the generated app head uses the supplied Tribute Credit favicon asset', () => {
  assert.ok(fs.existsSync(suppliedFavicon), 'The supplied public/favicon.png must exist');
  assert.ok(fs.existsSync(appIcon), 'Next.js must receive the supplied image through app/icon.png');
  assert.equal(fs.existsSync(oldFavicon), false, 'The previous favicon.ico must not override the new icon');
  assert.deepEqual(fs.readFileSync(appIcon), fs.readFileSync(suppliedFavicon));
});
