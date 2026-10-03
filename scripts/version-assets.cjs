const fs=require('node:fs'),crypto=require('node:crypto');
let html=fs.readFileSync('index.html','utf8');
for(const file of ['app.js','style.css','config.js']){
 const version=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0,12);
 const escaped=file.replace('.', '\\.');
 html=html.replace(new RegExp(`(["'])${escaped}(?:\\?v=[a-zA-Z0-9-]+)?\\1`,'g'),`"${file}?v=${version}"`);
}
html=html.replace(/MomentalConsole <span>/,'MomentalConsole · r3 <span>');
fs.writeFileSync('index.html',html);
