// Control: does an ADVERTISED plan actually work? Distinguishes "list enforced"
// from "route broken for every plan".
const BASE='http://localhost:3001';
const TOKEN='2705acd173a54b0cf751ddbe8b8ba788ad498a48446649f803a9879a85d87002';
const post = async (planId) => {
  const r = await fetch(`${BASE}/api/crm/financing/public/${TOKEN}/apply`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId})});
  return {status:r.status,text:(await r.text()).slice(0,300)};
};
for (const [label,id] of [
  ['OFFERED 12mo 0%   ','b27521fe-7ae1-4cf3-82e8-0517b15bf7f7'],
  ['OFFERED 24mo 4.99%','e2ed01d1-c459-47de-863d-7941be83d13f'],
  ['OFFERED 36mo 6.99%','90cd1dc1-934b-4c4a-8e72-459a4532672d'],
]) {
  const r = await post(id);
  console.log(label,'->',r.status,r.text);
}
