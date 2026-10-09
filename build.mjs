// build.mjs — THE SERVED COPY (#build, oct 9). Reads index.src.html (the annotated master) and writes index.html
// with every comment and all dead whitespace stripped: inline scripts and styles through esbuild (whitespace and
// syntax only — NO identifier renaming, so function names in the alarms and stack traces stay readable), HTML
// comments removed. One pass in document order, so a "<style>" inside a script string is never mistaken for a
// style block. Nothing is reordered. Usage: node build.mjs [index.src.html] [index.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const [,, src='index.src.html', out='index.html'] = process.argv;
const html = readFileSync(src, 'utf8');
const stats = { js:[0,0], css:[0,0], htmlc:0, skipped:0 };
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>|<style\b([^>]*)>([\s\S]*?)<\/style>|<!--(?!\[if)[\s\S]*?-->/gi;
let outHtml = html.replace(re, (m, sAttr, sBody, cAttr, cBody) => {
  if (m.startsWith('<!--')) { stats.htmlc++; return ''; }
  if (sAttr !== undefined) {
    if (/\bsrc\s*=/i.test(sAttr) || !sBody.trim()) return m;
    if (/\btype\s*=\s*["']?(?!(text\/javascript|module|application\/javascript))/i.test(sAttr)) return m;
    try {
      const r = transformSync(sBody, { loader:'js', minifyWhitespace:true, minifySyntax:true, minifyIdentifiers:false, legalComments:'none', target:'es2020' });
      if (/<\/script/i.test(r.code)) { stats.skipped++; return m; }
      stats.js[0]+=sBody.length; stats.js[1]+=r.code.length;
      return '<script'+sAttr+'>\n'+r.code+'\n</script>';
    } catch(e){ stats.skipped++; console.error('script kept as-is:', String(e.message).slice(0,160)); return m; }
  }
  if (!cBody.trim()) return m;
  try {
    const r = transformSync(cBody, { loader:'css', minify:true, legalComments:'none' });
    if (/<\/style/i.test(r.code)) { stats.skipped++; return m; }
    stats.css[0]+=cBody.length; stats.css[1]+=r.code.length;
    return '<style'+cAttr+'>'+r.code+'</style>';
  } catch(e){ stats.skipped++; console.error('style kept as-is:', String(e.message).slice(0,160)); return m; }
});
outHtml = outHtml.replace(/\n{3,}/g, '\n\n');
writeFileSync(out, outHtml);
const kb = n => Math.round(n/1024)+'k';
console.log(`js ${kb(stats.js[0])} → ${kb(stats.js[1])} · css ${kb(stats.css[0])} → ${kb(stats.css[1])} · html comments ${stats.htmlc} · kept as-is ${stats.skipped} · out ${kb(outHtml.length)}`);
