const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\ProTech247\\.gemini\\antigravity\\brain\\59fa29f4-3b71-41f1-9983-6a45869e606a\\icon_512x512_png_1778773826001.png';
const publicDir = 'd:\\odd-todo-app\\odd-note-app\\apps\\web\\public';

const icons = [
    'icon-72x72.png',
    'icon-96x96.png',
    'icon-128x128.png',
    'icon-144x144.png',
    'icon-152x152.png',
    'icon-192x192.png',
    'icon-384x384.png',
    'icon-512x512.png',
    'icon-192x192-maskable.png',
    'icon-512x512-maskable.png'
];

icons.forEach(icon => {
    const dest = path.join(publicDir, icon);
    fs.copyFileSync(src, dest);
    console.log(`Copied to ${dest}`);
});
