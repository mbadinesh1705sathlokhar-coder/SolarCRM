const fs = require('fs');
const content = fs.readFileSync('client/src/app/components/project-master/project-master.component.html', 'utf8');
const lines = content.split('\n');

let depth = 0;
for (let i = 1408; i < 1741; i++) {
  const line = lines[i];
  const opens = (line.match(/<div\b/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - closes;
  if (depth < 0) {
    console.log(`NEGATIVE DEPTH at line ${i + 1}: depth=${depth}, line: ${line.trim()}`);
  }
}
console.log('Depth at line 1741 (end of details modal):', depth);
