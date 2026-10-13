const S = require(process.argv[2]);
for (let n = +process.argv[3]; n <= +process.argv[4]; n += +(process.argv[5] || 1)) {
  const t = n / 30; const A = S.active(t).filter(a => a.shot.clip === 'v7');
  for (const a of A) { const c = a.crop; console.log(n, t.toFixed(3), a.shot.id, 'src', a.src.toFixed(4), 'crop', JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k,v])=>typeof v==='number').map(([k,v])=>[k,+v.toFixed(1)])))); }
}
