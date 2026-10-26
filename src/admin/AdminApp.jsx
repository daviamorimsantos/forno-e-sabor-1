import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownToLine, BarChart3, Check, ChefHat, ChevronDown, CircleDollarSign, Clock3, Eye, ImagePlus, LogOut, Package, Pencil, Plus, RefreshCw, Save, Search, ShoppingBag, Trash2, TrendingUp, X } from 'lucide-react'
import { adminRequest, fileToBase64, getAdminToken, setAdminToken } from '../lib/adminApi'
import './admin.css'

const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const statuses = { pending: 'Pendente', confirmed: 'Confirmado', preparing: 'Em preparo', delivered: 'Entregue', cancelled: 'Cancelado' }
const emptyProduct = { name: '', category: 'Pizzas', description: '', price: '0', image_url: '', pricesText: '', popular: false, badge: '', available: true }
const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AdminApp() {
  const [session, setSession] = useState(() => getAdminToken())
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [productModal, setProductModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState('7')

  const loadData = useCallback(async () => {
    if (!session) return
    setLoading(true); setError('')
    try {
      const data = await adminRequest('dashboardData', {}, session)
      setProducts((data.products || []).map(p => ({ ...p, image: p.image_url || p.image || '', price: Number(p.price || 0), prices: p.prices && typeof p.prices === 'object' ? p.prices : null, available: p.available !== false })))
      setOrders(data.orders || [])
      setOrderItems(data.orderItems || [])
    } catch (err) {
      if (/sessão expirou|não autorizado|unauthorized/i.test(err.message || '')) {
        setAdminToken('')
        setSession(null)
      }
      setError((err.message || 'Não foi possível carregar os dados.') + ' — confira as variáveis do GitHub na Vercel.')
    } finally { setLoading(false) }
  }, [session])
  useEffect(() => { loadData() }, [loadData])

  const signIn = async e => {
    e.preventDefault(); setLoginError(''); setLoginBusy(true)
    try {
      const result = await adminRequest('login', { password }, '')
      setAdminToken(result.token)
      setSession(result.token)
      setPassword('')
    } catch (err) {
      setLoginError(err.message || 'Não foi possível entrar. Confira a senha e a configuração da Vercel.')
    } finally { setLoginBusy(false) }
  }

  const openNewProduct = () => { setEditingId(null); setProductForm(emptyProduct); setImageFile(null); setProductModal(true) }
  const openEditProduct = p => { setEditingId(p.id); setProductForm({ name: p.name || '', category: p.category || 'Pizzas', description: p.description || '', price: String(p.price ?? 0), image_url: p.image_url || p.image || '', pricesText: p.prices ? JSON.stringify(p.prices, null, 2) : '', popular: Boolean(p.popular), badge: p.badge || '', available: p.available !== false }); setImageFile(null); setProductModal(true) }

  const saveProduct = async e => {
    e.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      let imageUrl = productForm.image_url.trim()
      if (imageFile) {
        const base64 = await fileToBase64(imageFile)
        const uploaded = await adminRequest('uploadImage', { name: imageFile.name, contentType: imageFile.type, base64 }, session)
        imageUrl = uploaded.imageUrl
      }
      let prices = null
      if (productForm.pricesText.trim()) { prices = JSON.parse(productForm.pricesText); if (!prices || typeof prices !== 'object' || Array.isArray(prices)) throw new Error('Preços por tamanho devem ser um objeto JSON, por exemplo: {"Média": 42.90, "Grande": 49.90}.') }
      const payload = { name: productForm.name.trim(), category: productForm.category, description: productForm.description.trim(), price: Number(productForm.price), image_url: imageUrl, prices, popular: productForm.popular, badge: productForm.badge.trim() || null, available: productForm.available }
      if (!payload.name || !Number.isFinite(payload.price) || payload.price < 0) throw new Error('Informe um nome e um preço válido.')
      await adminRequest('saveProduct', { id: editingId, product: payload }, session)
      setProductModal(false); setNotice('Produto salvo com sucesso.'); await loadData()
    } catch (err) { setError(err.message || 'Não foi possível salvar o produto.') }
    setSaving(false)
  }

  const deleteProduct = async p => {
    if (!window.confirm(`Excluir “${p.name}” do catálogo? Essa ação não pode ser desfeita.`)) return
    try { await adminRequest('deleteProduct', { id: p.id }, session); setNotice('Produto excluído.'); await loadData() }
    catch (err) { setError(err.message || 'Não foi possível excluir o produto.') }
  }
  const updateStatus = async (order, status) => {
    try { await adminRequest('updateOrderStatus', { id: order.id, status }, session); setNotice('Status do pedido atualizado.'); await loadData() }
    catch (err) { setError(err.message || 'Não foi possível atualizar o pedido.') }
  }

  const daysCutoff = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - Number(period) + 1); d.setHours(0,0,0,0); return d }, [period])
  const filteredOrders = useMemo(() => orders.filter(o => new Date(o.created_at) >= daysCutoff), [orders, daysCutoff])
  const completedOrders = filteredOrders.filter(o => o.status !== 'cancelled')
  const revenue = completedOrders.reduce((s,o) => s + Number(o.total || 0), 0)
  const average = completedOrders.length ? revenue / completedOrders.length : 0
  const dayBars = useMemo(() => days.map((label, day) => ({ label, value: completedOrders.filter(o => new Date(o.created_at).getDay() === day).reduce((s,o) => s + Number(o.total || 0), 0) })), [completedOrders])
  const hourBars = useMemo(() => Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2,'0')}h`, value: completedOrders.filter(o => new Date(o.created_at).getHours() === hour).length })), [completedOrders])
  const topProducts = useMemo(() => {
    const orderById = new Map(filteredOrders.filter(o => o.status !== 'cancelled').map(o => [o.id, o]))
    const totals = new Map()
    orderItems.filter(i => orderById.has(i.order_id)).forEach(i => { const k = i.product_name || 'Produto'; totals.set(k, (totals.get(k) || 0) + Number(i.quantity || 0)) })
    return [...totals.entries()].map(([name, qty]) => ({ name, qty })).sort((a,b) => b.qty-a.qty).slice(0,5)
  }, [orderItems, filteredOrders])
  const maxDay = Math.max(1, ...dayBars.map(x => x.value))
  const maxHour = Math.max(1, ...hourBars.map(x => x.value))
  const visibleProducts = products.filter(p => `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(query.toLowerCase()))

  if (!session) return <div className="admin-root"><form className="admin-login-card" onSubmit={signIn}><a className="admin-back-link" href="/">← Voltar à loja</a><div className="admin-brand-mark"><ChefHat/></div><p className="admin-eyebrow">ÁREA RESTRITA</p><h1>Bem-vindo de volta.</h1><p className="admin-subtitle">Digite a senha para gerenciar preços, produtos e disponibilidade.</p><label>Senha de acesso<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required inputMode="numeric" placeholder="Digite sua senha"/></label>{loginError && <p className="admin-error">{loginError}</p>}<button className="admin-primary" disabled={loginBusy}>{loginBusy ? 'Entrando…' : 'Entrar no painel'}</button><small className="admin-login-help">Área restrita do lojista.</small></form></div>

  return <div className="admin-root"><aside className="admin-sidebar"><a href="/" className="admin-logo"><span className="admin-brand-mark"><ChefHat/></span><span><b>FORNO & SABOR</b><small>PAINEL DA LOJA</small></span></a><div className="admin-nav-label">GERENCIAMENTO</div><button className={tab==='products'?'active':''} onClick={()=>setTab('products')}><Package/> Produtos</button><div className="admin-sidebar-bottom"><span className="admin-online-dot"/> Catálogo no GitHub<button onClick={()=>{setAdminToken('');setSession(null);setProducts([]);setOrders([]);setOrderItems([])}}><LogOut/> Sair</button></div></aside>
    <main className="admin-main"><header className="admin-topbar"><div><p className="admin-eyebrow">PAINEL ADMINISTRATIVO</p><h1>Catálogo de produtos</h1></div><div className="admin-top-actions"><button className="admin-icon-button" onClick={loadData} title="Atualizar"><RefreshCw size={17}/></button><a className="admin-view-store" href="/" target="_blank" rel="noreferrer"><Eye size={16}/> Ver loja</a></div></header>
      {error && <div className="admin-alert error"><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}{notice && <div className="admin-alert success"><Check size={17}/>{notice}<button onClick={()=>setNotice('')}><X size={16}/></button></div>}
      {loading && <div className="admin-loading"><RefreshCw className="spin" size={18}/> Atualizando dados…</div>}
      {tab==='products' && <><div className="admin-toolbar"><div><h2>Seu catálogo</h2><p>Alterações salvas aqui aparecem na loja pública.</p></div><button className="admin-primary compact" onClick={openNewProduct}><Plus size={17}/> Novo produto</button></div><div className="admin-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto ou categoria…"/></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Preço inicial</th><th>Disponibilidade</th><th>Ações</th></tr></thead><tbody>{visibleProducts.map(p=><tr key={p.id}><td><div className="admin-product-cell"><img src={p.image_url||p.image} alt=""/><span><b>{p.name}</b><small>{p.description}</small></span></div></td><td>{p.category}</td><td><b>{money(p.prices?Math.min(...Object.values(p.prices).map(Number)):p.price)}</b></td><td><span className={`availability ${p.available?'on':'off'}`}>{p.available?'Disponível':'Oculto'}</span></td><td><div className="admin-row-actions"><button title="Editar" onClick={()=>openEditProduct(p)}><Pencil size={16}/></button><button title={p.available?'Ocultar':'Reativar'} onClick={async()=>{try{await adminRequest('toggleAvailability',{id:p.id,available:!p.available},session);setNotice(p.available?'Produto ocultado da loja.':'Produto reativado.');loadData()}catch(err){setError(err.message||'Não foi possível alterar a disponibilidade.')}}}><Eye size={16}/></button><button title="Excluir" onClick={()=>deleteProduct(p)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!visibleProducts.length&&<div className="admin-empty">Nenhum produto encontrado.</div>}</div></>}
    </main>
    {productModal&&<div className="admin-modal-backdrop"><form className="admin-product-modal" onSubmit={saveProduct}><header><div><p className="admin-eyebrow">CATÁLOGO</p><h2>{editingId?'Editar produto':'Adicionar produto'}</h2></div><button type="button" className="admin-icon-button" onClick={()=>setProductModal(false)}><X/></button></header><label>Nome do produto<input required value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="Ex.: Pizza de calabresa"/></label><div className="admin-form-row"><label>Categoria<select value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}>{['Pizzas','Combos','Bebidas','Sobremesas','Adicionais'].map(c=><option key={c}>{c}</option>)}</select></label><label>Preço base (R$)<input type="number" min="0" step="0.01" required value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></label></div><label>Descrição<textarea rows="3" value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})} placeholder="Descreva o produto"/></label><label>Foto do produto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImageFile(e.target.files?.[0]||null)}/><small>A imagem será adicionada ao repositório do GitHub.</small></label><label>Ou cole o endereço da imagem<input type="url" value={productForm.image_url} onChange={e=>setProductForm({...productForm,image_url:e.target.value})} placeholder="https://..."/></label><label>Preços por tamanho (opcional)<textarea rows="3" value={productForm.pricesText} onChange={e=>setProductForm({...productForm,pricesText:e.target.value})} placeholder={'{"Média": 42.90, "Grande": 49.90, "Família": 59.90}'}/><small>Para pizzas, defina os preços de cada tamanho aqui. O campo “Preço base” é usado para produtos sem tamanhos.</small></label><label>Selo promocional (opcional)<input value={productForm.badge} onChange={e=>setProductForm({...productForm,badge:e.target.value})} placeholder="Ex.: QUERIDINHO"/></label><div className="admin-check-row"><label><input type="checkbox" checked={productForm.popular} onChange={e=>setProductForm({...productForm,popular:e.target.checked})}/> Mais pedido</label><label><input type="checkbox" checked={productForm.available} onChange={e=>setProductForm({...productForm,available:e.target.checked})}/> Disponível na loja</label></div>{error&&<p className="admin-error">{error}</p>}<footer><button type="button" className="admin-secondary" onClick={()=>setProductModal(false)}>Cancelar</button><button className="admin-primary" disabled={saving}><Save size={16}/>{saving?'Salvando…':'Salvar produto'}</button></footer></form></div>}
  </div>
}
