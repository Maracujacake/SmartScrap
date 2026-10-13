import { useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, Clock3, MapPin, PackageCheck, Truck } from 'lucide-react';
import { api, currency, dateLabel, lotCode, number } from './api.js';
import { Badge, Button, Empty, ErrorMessage, Field, LoadState, MaterialIcon, Modal, PageHeading, useData } from './components.jsx';

function UpdatePickup({pickup,onClose,onSuccess}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(null);
  const next={awaiting:'scheduled',scheduled:'transit',transit:'delivered'}[pickup.status];
  const titles={scheduled:'Agendar coleta',transit:'Iniciar transporte',delivered:'Confirmar entrega'};
  async function submit(event) {
    event.preventDefault();setBusy(true);setError(null);
    try {await api(`/pickups/${pickup.id}`,{method:'PATCH',body:{...Object.fromEntries(new FormData(event.currentTarget)),status:next}});onSuccess();}
    catch(err){setError(err);}finally{setBusy(false);}
  }
  return <Modal title={titles[next]} subtitle={`${lotCode(pickup.lot_id)} · ${pickup.title}`} onClose={onClose}><form onSubmit={submit} className="modal-form"><ErrorMessage error={error}/>{next==='scheduled'?<><Field label="Data da coleta"><input type="date" name="scheduledDate" min={new Date().toISOString().slice(0,10)} required/></Field><Field label="Transportadora / responsável"><input name="carrier" minLength={2} maxLength={120} placeholder="Nome da transportadora ou responsável" defaultValue={pickup.carrier} required/></Field></>:<div className="form-note"><Truck size={24}/><span>{next==='transit'?'Confirme que o material foi coletado e está a caminho da organização compradora.':'Confirme que o material foi entregue à organização compradora.'} As duas organizações serão notificadas.</span></div>}<div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Voltar</Button><Button type="submit" loading={busy}>{titles[next]}<Check size={16}/></Button></div></form></Modal>;
}
export default function Pickups({user,revision,onChanged,toast,onOpenLot}) {
  const state=useData('/pickups',revision);
  const [filter,setFilter]=useState('active'),[selected,setSelected]=useState(null);
  const steps=[{status:'awaiting',label:'Negociado',icon:Check},{status:'scheduled',label:'Agendado',icon:CalendarDays},{status:'transit',label:'Em transporte',icon:Truck},{status:'delivered',label:'Entregue',icon:PackageCheck}];
  return <><PageHeading eyebrow="ACOMPANHE CADA ETAPA DO NOVO CICLO" title="Coletas e entregas" description="Da negociação ao destino: tudo sob controle, em um só lugar."/><div className="tab-bar">{[['active','Em andamento'],['delivered','Concluídas'],['all','Todas']].map(([value,label])=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}</button>)}</div><LoadState state={state}>{({pickups})=>{
    const filtered=pickups.filter(p=>filter==='all'||(filter==='active'?p.status!=='delivered':p.status==='delivered'));
    return filtered.length?<div className="pickups-list">{filtered.map(p=>{
      const selling=p.seller_id===user.organization_id;
      const step=steps.findIndex(s=>s.status===p.status);
      return <article className="pickup-card panel" key={p.id}><div className="pickup-top"><div><span className={`trade-type ${selling?'selling':'buying'}`}>{selling?<ArrowUpRight size={14}/>:<ArrowDownLeft size={14}/>} {selling?'Venda · Coleta':'Compra · Entrega'}</span><button onClick={()=>onOpenLot(p.lot_id)}>{p.title}<ArrowUpRight size={14}/></button><small>{lotCode(p.lot_id)} · {p.material} · {number(p.weight)} toneladas</small></div><Badge status={p.status}/></div><div className="pickup-route"><div><span>ORIGEM</span><strong>{p.seller_name}</strong><small><MapPin size={12}/>{p.city}, {p.state}</small></div><span className="route-line"><i/><Truck size={21}/><i/></span><div><span>DESTINO</span><strong>{p.buyer_name}</strong><small>Organização compradora</small></div><div className="pickup-date"><span><CalendarDays size={13}/>DATA DE COLETA</span><strong>{p.scheduled_date?new Date(p.scheduled_date+'T12:00:00').toLocaleDateString('pt-BR'):'A definir'}</strong><small>{p.carrier || 'Responsável a definir'}</small></div></div><div className="pickup-bottom"><div className="pickup-steps">{steps.map((s,i)=><div key={s.status} className={i<=step?'complete':''}><span><s.icon size={13}/></span><small>{s.label}</small></div>)}</div>{p.status!=='delivered'?<Button variant="secondary" onClick={()=>setSelected(p)}>{{awaiting:'Agendar coleta',scheduled:'Iniciar transporte',transit:'Confirmar entrega'}[p.status]}<ArrowRight size={15}/></Button>:<span className="delivery-success"><CheckCheck size={17}/>Ciclo concluído</span>}</div></article>;
    })}</div>:<section className="panel"><Empty title={filter==='delivered'?'Nenhuma entrega concluída ainda':'Nenhuma coleta por aqui'} description="Após aceitar uma proposta, a coleta será criada automaticamente para as duas organizações."/></section>;
  }}</LoadState>{selected&&<UpdatePickup pickup={selected} onClose={()=>setSelected(null)} onSuccess={()=>{setSelected(null);onChanged();toast('Situação da coleta atualizada.');}}/>}</>;
}
