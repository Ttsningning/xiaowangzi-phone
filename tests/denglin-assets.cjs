const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '../games/denglin.html'), 'utf8');
const refs = [...html.matchAll(/denglin-assets\/[a-f0-9]+\.(?:webp|m4a)/g)].map(x => x[0]);
assert.equal(refs.length, 61);
for (const ref of refs) assert.ok(fs.statSync(path.join(__dirname, '../games', ref)).size > 0, ref);
assert.ok(!html.includes(';base64,'));
assert.ok(Buffer.byteLength(html) < 150000, 'game HTML stays small');

const errors = [], requests = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message));
const node = () => ({gain: {value: 0, setValueAtTime(){}, cancelScheduledValues(){}, linearRampToValueAtTime(){}}, connect(){}, start(){}, stop(){}});
const dom = new JSDOM(html, {
  url: 'https://example.org/xiaowangzi-phone/games/denglin.html',
  runScripts: 'dangerously', virtualConsole: vc,
  beforeParse(w) {
    w.matchMedia = () => ({matches: false});
    w.requestAnimationFrame = () => 1;
    w.scrollTo = () => {};
    w.fetch = async url => {
      requests.push(url);
      const bytes = fs.readFileSync(path.join(__dirname, '../games', url));
      return {ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)};
    };
    w.AudioContext = class {
      constructor(){ this.state = 'running'; this.currentTime = 0; }
      createGain(){ return node(); }
      createBufferSource(){ return node(); }
      decodeAudioData(bytes, resolve){ assert.ok(bytes.byteLength > 0); resolve({duration: 60}); }
    };
  }
});
(async () => {
  const d = dom.window.document;
  assert.ok(d.querySelector('.primary').textContent.includes('开卷'));
  assert.equal(requests.length, 0, 'title does not download audio');
  d.querySelector('.primary').click();
  assert.equal(requests.length, 0, 'muted story does not download audio');
  assert.ok(d.querySelector('#story').textContent.length > 100, 'story renders');
  d.querySelector('#snd').click();
  await new Promise(r => setImmediate(r));
  assert.equal(requests.length, 2, 'only current music and ambience requested');
  assert.ok(requests.every(x => x.endsWith('.m4a')));
  assert.equal(d.querySelector('#snd').getAttribute('aria-pressed'), 'true');
  d.querySelector('#snd').click();
  d.querySelector('#snd').click();
  await new Promise(r => setImmediate(r));
  assert.equal(requests.length, 2, 'decoded tracks reused');
  assert.deepEqual(errors, []);
  console.log('PASS Denglin assets, title, story, muted loading and on-demand audio');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => dom.window.close());
