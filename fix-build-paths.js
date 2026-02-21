const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '.next');

if (!fs.existsSync(targetDir)) {
  console.error('Error: .next folder not found. Please run "npm run build" first.');
  process.exit(1);
}

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

console.log('Fixing Windows path separators in .next folder...');

let count = 0;
walkDir(targetDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.endsWith('.html')) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Replace "next/dist\..." with "next/dist/..."
    // This handles the backslash issues found in require statements
    const fixedContent = content.replace(/(next\/dist|next\\dist)\\([^\s'"]+)/g, (match) => {
      const fixed = match.replace(/\\/g, '/');
      if (match !== fixed) {
        count++;
        return fixed;
      }
      return match;
    });

    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent, 'utf8');
    }
  }
});

console.log(`Done! Fixed ${count} path occurrences. You can now zip and upload .next to cPanel.`);
