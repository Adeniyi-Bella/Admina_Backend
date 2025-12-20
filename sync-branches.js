const { execSync } = require("child_process");

const run = (cmd) => {
  console.log(`▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

try {
  run('git checkout main');
  run('git pull origin main');
  run('git merge dev');
  run('git push origin main');
  run('git fetch origin');
  run('git checkout dev');

  console.log('✅ Branch sync complete');
} catch (err) {
  console.error('❌ Sync failed');
  process.exit(1);
}
