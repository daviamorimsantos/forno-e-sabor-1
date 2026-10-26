export default async function handler(req,res) {
  res.setHeader('Cache-Control','s-maxage=30, stale-while-revalidate=120')
  const repo=process.env.GITHUB_REPO, token=process.env.GITHUB_TOKEN, branch=process.env.GITHUB_BRANCH||'main'
  if(!repo||!token)return res.status(503).json({error:'Catálogo não configurado.'})
  try {
    const r=await fetch(`https://api.github.com/repos/${repo}/contents/catalog/products.json?ref=${encodeURIComponent(branch)}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}})
    const data=await r.json();if(!r.ok)throw new Error(data.message||'Não foi possível carregar o catálogo.')
    const products=JSON.parse(Buffer.from(data.content.replace(/\n/g,''),'base64').toString('utf8'))
    return res.status(200).json({products:products.filter(p=>p.available!==false)})
  } catch(e) { return res.status(500).json({error:e.message||'Erro ao carregar catálogo.'}) }
}
