const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// mediaディレクトリのパス
const mediaDir = path.join(__dirname, 'media');

// SVGファイルを検索
const svgFiles = fs.readdirSync(mediaDir).filter(file => file.endsWith('.svg'));

if (svgFiles.length === 0) {
  console.log('SVGファイルが見つかりませんでした');
  process.exit(0);
}

console.log(`${svgFiles.length}個のSVGファイルを変換します...`);

// 各SVGファイルをPNGに変換
let completedCount = 0;
let errorCount = 0;

svgFiles.forEach(svgFile => {
  const svgPath = path.join(mediaDir, svgFile);
  const pngFile = svgFile.replace('.svg', '.png');
  const pngPath = path.join(mediaDir, pngFile);
  
  // SVGファイルを読み込む
  const svgBuffer = fs.readFileSync(svgPath);
  
  // SVGをPNGに変換
  let sharpInstance = sharp(svgBuffer);
  
  // overviewがつくファイル名はリサイズしない
  if (!svgFile.includes('overview')) {
    sharpInstance = sharpInstance.resize(128, 128); // アイコンサイズを128x128に設定
  }
  
  sharpInstance.png()
    .toFile(pngPath)
    .then(() => {
      console.log(`変換完了: ${svgFile} → ${pngFile}`);
      completedCount++;
      
      // すべての変換が完了したかチェック
      if (completedCount + errorCount === svgFiles.length) {
        console.log(`\n変換完了: ${completedCount}個成功, ${errorCount}個失敗`);
        
        // database.pngが生成された場合、package.jsonを更新
        if (svgFiles.includes('database.svg')) {
          updatePackageJson();
        }
        
        // database-icon.pngが生成された場合、package.jsonを更新
        if (svgFiles.includes('database-icon.svg')) {
          updatePackageJsonForIcon();
        }
      }
    })
    .catch(err => {
      console.error(`変換エラー (${svgFile}):`, err);
      errorCount++;
      
      // すべての変換が完了したかチェック
      if (completedCount + errorCount === svgFiles.length) {
        console.log(`\n変換完了: ${completedCount}個成功, ${errorCount}個失敗`);
      }
    });
});

// package.jsonのiconフィールドを更新（database.png用）
function updatePackageJson() {
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = require(packageJsonPath);
    
    // iconフィールドを更新
    packageJson.icon = 'media/database.png';
    
    // package.jsonに書き込む
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      'utf8'
    );
    
    console.log('package.jsonを更新しました (database.png)');
  } catch (err) {
    console.error('package.jsonの更新に失敗しました:', err);
  }
}

// package.jsonのiconフィールドを更新（database-icon.png用）
function updatePackageJsonForIcon() {
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = require(packageJsonPath);
    
    // iconフィールドを更新
    packageJson.icon = 'media/database-icon.png';
    
    // package.jsonに書き込む
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      'utf8'
    );
    
    console.log('package.jsonを更新しました (database-icon.png)');
  } catch (err) {
    console.error('package.jsonの更新に失敗しました:', err);
  }
}
