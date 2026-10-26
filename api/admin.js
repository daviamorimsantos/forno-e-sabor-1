import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'

const TOKEN_TTL_SECONDS = 12 * 60 * 60
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const failedLogins = new Map()
const CATALOG_PATH = 'catalog/products.json'
function send(res, status, body) { res.setHeader('Cache-Control', 'no-store, max-age=0'); return res.status(status).json(body) }
function config() {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH = 'main', ADMIN_PASSWORD } = process.env
  if (!GITHUB_TOKEN || !GITHUB_REPO || !ADMIN_PASSWORD) return { error: 'Configure ADMIN_PASSWORD, GITHUB_TOKEN e GITHUB_REPO nas variáveis da Vercel.' }
  return { token: GITHUB_TOKEN, repo: GITHUB_REPO, branch: GITHUB_BRANCH, password: ADMIN_PASSWORD }
}
function sign(payload, secret) { const body = Buffer.from(JSON.stringify(payload)).toString('base64url'); return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}` }
function verify(token, secret) {
  if (typeof token !== 'string' || token.length > 2000) return false
  const parts = token.split('.'); if (parts.length !== 2) return false
  const expected = createHmac('sha256', secret).update(parts[0]).digest(); let actual
  try { actual = Buffer.from(parts[1], 'base64url') } catch { return false }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false
  try { return Number(JSON.parse(Buffer.from(parts[0], 'base64url').toString()).exp) > Math.floor(Date.now() / 1000) } catch { return false }
}
function loginAllowed(ip) { const e = failedLogins.get(ip); if (!e || Date.now() - e.startedAt > 900000) { failedLogins.set(ip, {count:0,startedAt:Date.now()}); return true } return e.count < 8 }
function failed(ip) { let e=failedLogins.get(ip); if(!e||Date.now()-e.startedAt>900000)e={count:0,startedAt:Date.now()}; e.count++;failedLogins.set(ip,e) }
async function github(c, path = CATALOG_PATH) {
  const url = `https://api.github.com/repos/${c.repo}/contents/${path}?ref=${encodeURIComponent(c.branch)}`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } })
  if (r.status === 404) return { sha: null, content: null }
  const data = await r.json(); if (!r.ok) throw new Error(data.message || `GitHub respondeu ${r.status}`)
  return { sha: data.sha, content: Buffer.from(data.content.replace(/\n/g,''), 'base64').toString('utf8') }
}
async function putGithub(c, path, content, sha, message) {
  const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/${path}`, { method:'PUT', headers:{Authorization:`Bearer ${c.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'}, body:JSON.stringify({message,content:Buffer.from(content).toString('base64'),branch:c.branch,...(sha?{sha}:{})}) })
  const data=await r.json(); if(!r.ok) throw new Error(data.message || `Não foi possível salvar no GitHub (${r.status})`); return data
}
async function getProducts(c) { const file=await github(c); if(!file.content) throw new Error('O arquivo catalog/products.json não foi encontrado no repositório.'); const products=JSON.parse(file.content); return {products,sha:file.sha} }
export default async function handler(req,res) {
  if(req.method!=='POST') return send(res,405,{error:'Método não permitido.'})
  const c=config(); if(c.error) return send(res,503,{error:c.error})
  const body=req.body&&typeof req.body==='object'?req.body:{}; const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()
  if(body.action==='login') {
    if(!loginAllowed(ip)) return send(res,429,{error:'Muitas tentativas. Aguarde 15 minutos.'})
    if(String(body.password||'')!==c.password){failed(ip);return send(res,401,{error:'Senha incorreta.'})}
    failedLogins.delete(ip);const now=Math.floor(Date.now()/1000);return send(res,200,{token:sign({iat:now,exp:now+TOKEN_TTL_SECONDS,nonce:randomUUID()},c.password),expiresIn:TOKEN_TTL_SECONDS})
  }
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,''); if(!verify(token,c.password))return send(res,401,{error:'Sua sessão expirou. Entre novamente.'})
  try {
    if(body.action==='dashboardData'){const {products}=await getProducts(c);return send(res,200,{products,orders:[],orderItems:[]})}
    if(body.action==='uploadImage'){
      const type=String(body.contentType||''), base64=String(body.base64||'');if(!ALLOWED_IMAGE_TYPES.has(type))return send(res,400,{error:'Use PNG, JPG ou WebP.'})
      if(!base64||base64.length>3_600_000)return send(res,413,{error:'A imagem deve ter até 2,5 MB.'})
      const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg';const name=`public/product-images/${Date.now()}-${randomUUID()}.${ext}`
      await putGithub(c,name,Buffer.from(base64,'base64'),null,`Adiciona imagem de produto ${name.split('/').pop()}`)
      return send(res,200,{imageUrl:`https://raw.githubusercontent.com/${c.repo}/${c.branch}/${name}`})
    }
    const {products,sha}=await getProducts(c)
    if(body.action==='saveProduct'){
      const p=body.product||{},name=String(p.name||'').trim(),price=Number(p.price);if(!name||name.length>160||!Number.isFinite(price)||price<0)return send(res,400,{error:'Informe um nome e um preço válido.'})
      const payload={name,category:String(p.category||'Pizzas').slice(0,80),description:String(p.description||'').slice(0,2000),price,image_url:String(p.image_url||'').slice(0,2000),prices:p.prices&&typeof p.prices==='object'&&!Array.isArray(p.prices)?p.prices:null,popular:Boolean(p.popular),badge:p.badge?String(p.badge).slice(0,100):null,available:p.available!==false}
      let saved
      if(body.id){const index=products.findIndex(x=>Number(x.id)===Number(body.id));if(index<0)return send(res,404,{error:'Produto não encontrado.'});saved={...products[index],...payload,id:Number(body.id)};products[index]=saved}
      else {saved={...payload,id:Math.max(0,...products.map(x=>Number(x.id)||0))+1};products.push(saved)}
      await putGithub(c,CATALOG_PATH,JSON.stringify(products,null,2)+'\n',sha,`${body.id?'Atualiza':'Adiciona'} produto: ${name}`);return send(res,200,{product:saved})
    }
    if(body.action==='toggleAvailability'||body.action==='deleteProduct'){
      const id=Number(body.id),index=products.findIndex(x=>Number(x.id)===id);if(index<0)return send(res,404,{error:'Produto não encontrado.'})
      if(body.action==='deleteProduct')products.splice(index,1);else products[index].available=Boolean(body.available)
      await putGithub(c,CATALOG_PATH,JSON.stringify(products,null,2)+'\n',sha,body.action==='deleteProduct'?`Remove produto #${id}`:`Altera disponibilidade do produto #${id}`)
      return send(res,200,{success:true,product:products[index]||null})
    }
    return send(res,400,{error:'Ação desconhecida.'})
  } catch(e) { console.error('Admin API:',e?.message||e);return send(res,500,{error:e?.message||'Erro interno.'}) }
}
