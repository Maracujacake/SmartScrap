import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, Building2, CalendarDays, Check, CheckCheck, ChevronDown, CircleHelp, LayoutDashboard, Leaf, LogOut, Menu, MessageSquare, Package, Plus, Search, Settings as SettingsIcon, Sprout, Truck, X } from 'lucide-react';
import { api, dateLabel, initials } from './api.js';
import { Brand, Button, ErrorMessage, ImpactArt, Loading, useData } from './components.jsx';
import Auth from './Auth.jsx';
import Dashboard from './Dashboard.jsx';
import Lots, { LotDetail, NewLot, Proposals } from './Lots.jsx';
import Organizations from './Organizations.jsx';
import Pickups from './Pickups.jsx';
import Settings from './Settings.jsx';

const navigation=[
  {id:'dashboard',label:'Dashboard',icon:LayoutDashboard},
  {id:'lots',label:'Meus lotes',icon:Package},
  {id:'market',label:'Postagens gerais',icon:LayoutDashboard},
  {id:'proposals',label:'Propostas',icon:MessageSquare},
  {id:'companies',label:'Empresas',icon:Building2},
  {id:'pickups',label:'Coletas e entregas',icon:Truck},
  {id:'ngos',label:'Órgãos e ONGs',icon:Sprout},
];
const validPages=[...navigation.map(n=>n.id),'settings'];
const getPage=()=>validPages.includes(location.hash.slice(1))?location.hash.slice(1):'dashboard';

function Notifications({revision,onOpenLot,onChanged,onClose}) {
  const state=useData('/notifications',revision);
  const [error,setError]=useState(null),[busy,setBusy]=useState(false);
  async function readAll() {
    setBusy(true);
    try {await api('/notifications/read',{method:'PATCH',body:{}});onChanged();}catch(err){setError(err);}finally{setBusy(false);}
  }
  return <><button className="popover-backdrop" aria-label="Fechar notificações" onClick={onClose}/><section className="notification-popover"><div className="notification-heading"><h3>Notificações</h3><button className="icon-button" aria-label="Fechar notificações" onClick={onClose}><X size={18}/></button></div><p>Novidades das negociações da sua organização.</p><ErrorMessage error={error}/>{state.loading?<Loading/>:state.error?<ErrorMessage error={state.error}/>:<><button className="mark-read" onClick={readAll} disabled={busy}><CheckCheck size={14}/>Marcar todas como lidas</button><div className="notification-list">{state.data.notifications.length?state.data.notifications.map(note=><button key={note.id} className={note.is_read?'read':''} onClick={()=>{if(note.lot_id){onClose();onOpenLot(note.lot_id);}}}><span className="notification-note-icon"><Bell size={17}/></span><span><strong>{note.title}</strong><p>{note.message}</p><small>{dateLabel(note.created_at)}</small></span>{!note.is_read&&<i/>}</button>):<div className="small-empty">Nenhuma notificação ainda.</div>}</div></>}</section></>;
}

export default function App() {
  const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[sessionError,setSessionError]=useState(null);
  const [page,setPage]=useState(getPage),[revision,setRevision]=useState(0),[days,setDays]=useState(30);
  const [newLot,setNewLot]=useState(false),[lotId,setLotId]=useState(null),[notice,setNotice]=useState(null);
  const [mobile,setMobile]=useState(false),[notifications,setNotifications]=useState(false),[profileMenu,setProfileMenu]=useState(false);
  const [search,setSearch]=useState(''),[globalSearch,setGlobalSearch]=useState(''),[companyFilter,setCompanyFilter]=useState('');
  const [unread,setUnread]=useState(0);
  const changed=useCallback(()=>setRevision(n=>n+1),[]);
  const toast=useCallback(message=>setNotice({message,id:Date.now()}),[]);
  const checkSession=useCallback(async()=>{
    setChecking(true);setSessionError(null);
    try {const data=await api('/auth/me');setUser(data.user);}catch(err){if(err.status!==401)setSessionError(err);}finally{setChecking(false);}
  },[]);
  useEffect(()=>{checkSession();},[checkSession]);
  useEffect(()=>{const handler=()=>{setPage(getPage());setMobile(false);};window.addEventListener('hashchange',handler);return()=>window.removeEventListener('hashchange',handler);},[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),4500);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{
    if(!user)return;
    const controller=new AbortController();
    api('/notifications',{signal:controller.signal}).then(data=>setUnread(data.notifications.filter(n=>!n.is_read).length)).catch(err=>{if(err.status===401){setUser(null);toast('Sua sessão expirou. Entre novamente.');}});
    return()=>controller.abort();
  },[user,revision,toast]);
  function navigate(next) {
    setMobile(false);setNotifications(false);setProfileMenu(false);
    if(next!==page){setPage(next);location.hash=next;}
    window.scrollTo({top:0,behavior:'smooth'});
  }
  async function logout() {
    try {await api('/auth/logout',{method:'POST',body:{}});setUser(null);setProfileMenu(false);setLotId(null);setNewLot(false);setPage('dashboard');location.hash='dashboard';}catch(err){toast(err.message);}
  }
  function explore(company) {setSearch('');setCompanyFilter(String(company));navigate(company===user.organization_id?'lots':'market');}
  function searchAll(event) {event.preventDefault();setCompanyFilter('');navigate('market');setSearch(globalSearch);}
  if(checking)return <div className="boot-screen"><Brand dark/><Loading/></div>;
  if(sessionError)return <div className="boot-screen"><Brand dark/><ErrorMessage error={sessionError}/><Button onClick={checkSession}>Tentar novamente</Button></div>;
  if(!user)return <Auth onLogin={logged=>{setUser(logged);changed();}}/>;
  return <div className="app-shell">{mobile&&<button className="sidebar-backdrop" aria-label="Fechar menu" onClick={()=>setMobile(false)}/>}<aside className={`sidebar ${mobile?'mobile-open':''}`}><div className="sidebar-brand"><Brand/><button className="icon-button mobile-close" aria-label="Fechar menu" onClick={()=>setMobile(false)}><X size={20}/></button></div><div className="workspace-card"><span className="workspace-avatar">{initials(user.organization_name)}</span><div><strong>{user.organization_name}</strong><span>{user.organization_type==='ngo'?'ONG / Cooperativa':'Espaço da empresa'}</span></div><Building2 size={15}/></div><span className="nav-section-label">PRINCIPAL</span><nav aria-label="Navegação principal">{navigation.map(item=><button key={item.id} onClick={()=>{if(item.id==='market'){setCompanyFilter('');setSearch('');}navigate(item.id);}} className={`nav-item ${page===item.id?'active':''}`} aria-current={page===item.id?'page':undefined}><item.icon size={19} strokeWidth={1.7}/><span>{item.label}</span>{item.id==='market'&&<span className="nav-new">NOVO</span>}{page===item.id&&<span className="nav-active-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-impact"><ImpactArt/><span className="sidebar-impact-tag"><Leaf size={12}/>CIRCULAR POR NATUREZA</span><h3>Mais valor.<br/>Menos resíduos.</h3><p>O futuro da indústria<br/>começa com um novo ciclo.</p><button onClick={()=>navigate('market')}>Vamos transformar<ArrowUpRight size={15}/></button></div><button className={`nav-item settings-nav ${page==='settings'?'active':''}`} onClick={()=>navigate('settings')}><SettingsIcon size={19} strokeWidth={1.7}/><span>Configurações</span></button><div className="sidebar-footer"><span className="live-dot"/>Conectados a um futuro melhor</div></div></aside><div className="main-shell"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={()=>setMobile(true)}><Menu size={23}/></button><div className="breadcrumb">Workspace<span>/</span><strong>{page==='settings'?'Configurações':navigation.find(n=>n.id===page)?.label}</strong></div><form className="global-search" onSubmit={searchAll}><Search size={17}/><input aria-label="Busca global" placeholder="Buscar lotes, empresas, materiais…" value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)}/><kbd>↵</kbd></form><div className="topbar-actions"><div className="period-picker"><CalendarDays size={16}/><div><span>Período</span><select aria-label="Período do dashboard" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option><option value={365}>Último ano</option></select></div><ChevronDown size={14}/></div><div className="notification-anchor"><button className={`notification-button icon-button ${notifications?'selected':''}`} aria-label={`Notificações, ${unread} não lidas`} aria-expanded={notifications} onClick={()=>{setNotifications(!notifications);setProfileMenu(false);}}><Bell size={21} strokeWidth={1.7}/>{unread>0&&<span>{unread>9?'9+':unread}</span>}</button>{notifications&&<Notifications revision={revision} onOpenLot={setLotId} onChanged={changed} onClose={()=>setNotifications(false)}/>}</div><span className="topbar-divider"/><div className="profile-anchor"><button className="profile-button" onClick={()=>{setProfileMenu(!profileMenu);setNotifications(false);}} aria-expanded={profileMenu}><span className="profile-avatar">{initials(user.name)}</span><span className="profile-button-text"><strong>{user.name}</strong><small>{user.organization_name}</small></span><ChevronDown size={14}/></button>{profileMenu&&<><button className="popover-backdrop" aria-label="Fechar menu do perfil" onClick={()=>setProfileMenu(false)}/><div className="profile-menu"><strong>{user.name}</strong><small>{user.email}</small><button onClick={()=>navigate('settings')}><SettingsIcon size={16}/>Meu perfil</button><button onClick={logout}><LogOut size={16}/>Sair da conta</button></div></>}</div></div></header><main className="main-content" key={page}>{page==='dashboard'&&<Dashboard user={user} days={days} revision={revision} navigate={navigate} onNewLot={()=>setNewLot(true)} onOpenLot={setLotId}/>} {(page==='lots'||page==='market')&&<Lots mine={page==='lots'} revision={revision} onNewLot={()=>setNewLot(true)} onOpenLot={setLotId} search={search} setSearch={setSearch} companyFilter={companyFilter} setCompanyFilter={setCompanyFilter}/>} {page==='proposals'&&<Proposals revision={revision} onOpenLot={setLotId}/>} {(page==='companies'||page==='ngos')&&<Organizations ngo={page==='ngos'} revision={revision} onExplore={explore}/>} {page==='pickups'&&<Pickups user={user} revision={revision} onChanged={changed} toast={toast} onOpenLot={setLotId}/>} {page==='settings'&&<Settings user={user} onUserChanged={setUser} revision={revision} toast={toast}/>}<footer className="page-footer"><span>SmartScrap Exchange<span>·</span>Um novo ciclo para a indústria.</span><span><Leaf size={12}/>Feito para transformar.</span></footer></main></div>{newLot&&<NewLot onClose={()=>setNewLot(false)} onSuccess={lot=>{setNewLot(false);changed();navigate('lots');toast('Lote publicado. Sua próxima conexão começa agora.');}}/>}{lotId&&<LotDetail id={lotId} user={user} revision={revision} onClose={()=>setLotId(null)} onChanged={changed} toast={toast}/>}<div className="toast-region" aria-live="polite" aria-atomic="true">{notice&&<div className="toast" key={notice.id}><span><Check size={17}/></span>{notice.message}<button className="icon-button" aria-label="Dispensar mensagem" onClick={()=>setNotice(null)}><X size={16}/></button></div>}</div></div>;
}
