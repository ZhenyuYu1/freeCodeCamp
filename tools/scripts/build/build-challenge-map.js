const fs = require('fs');
const path = require('path');

const metaDir = path.join(__dirname, '../../../curriculum/challenges/_meta');

const blockFolders = fs
  .readdirSync(metaDir)
  .filter(f => fs.statSync(path.join(metaDir, f)).isDirectory());

const challengeIdMap = {};

blockFolders.forEach(blockFolder => {
  const metaPath = path.join(metaDir, blockFolder, 'meta.json');
  if (!fs.existsSync(metaPath)) return; // skip if no meta.json

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const blockName = meta.name;
  const superBlock = meta.superBlock;

  // For each challenge in challengeOrder
  (meta.challengeOrder || []).forEach(challenge => {
    challengeIdMap[challenge.id] = {
      certification: superBlock,
      block: blockFolder,
      blockName: blockName,
      name: challenge.title
    };
  });
});

fs.writeFileSync(
  path.join(__dirname, '../../../challenge-id-map.json'),
  JSON.stringify(challengeIdMap, null, 2)
);
console.log('Challenge ID map generated successfully.');
