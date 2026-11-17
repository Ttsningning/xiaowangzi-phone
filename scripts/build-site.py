from pathlib import Path
import shutil

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
if dist.exists():
    shutil.rmtree(dist)
dist.mkdir()
for name in ['index.html', 'world-market.js', 'world-market.css', 'market-trades.js', 'treasure.js', 'treasure.css', 'keepsakes.js', 'keepsakes.css', 'companion.js', 'star-library.js', 'star-library.css', 'visitors.js', 'visitors-city.js', 'visitors.css', 'model-picker.js', 'vertex-api.js', 'vertex-config.js', 'model-picker.css', 'chat-reset.js', 'companion.css', 'sw.js',
             'manifest.json', 'icon.png', 'icon-prince-moon.png',
             'icon-prince-planet.png', '.nojekyll', 'games', 'themes']:
    source = root / name
    target = dist / name
    if source.is_dir():
        shutil.copytree(source, target)
    else:
        shutil.copy2(source, target)
print('Built static phone in dist/')
