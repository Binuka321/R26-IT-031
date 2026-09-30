import { useEffect, useState } from 'react'
const API_URL=import.meta.env.VITE_API_URL||'http://localhost:3001'
export default function Alerts(){
  const [data,setData]=useState(null)
  const [busy,setBusy]=useState('')
  const [message,setMessage]=useState('')
  async function refresh(){
    const response=await fetch(`${API_URL}/api/alerts`)
    if(!response.ok)throw new Error('Unable to load alert settings.')
    setData(await response.json())
  }
  useEffect(()=>{refresh().catch(error=>setMessage(error.message))},[])
  async function send(channel){
    setBusy(channel);setMessage('')
    try{
      const response=await fetch(`${API_URL}/api/alerts/send`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel})})
      const result=await response.json()
      if(!response.ok)throw new Error(result.message||'Alert request failed.')
      setMessage(result.message||`${channel==='email'?'Email':'SMS'}: ${result.status}. Provider acceptance does not confirm delivery.`)
      await refresh()
    }catch(error){setMessage(error.message)}finally{setBusy('')}
  }
  return <main className="mx-auto max-w-5xl space-y-6 p-6 text-slate-900">
    <header><h1 className="text-3xl font-bold">Email and SMS alerts</h1><p className="mt-2 text-slate-600">Notify the administrator contact configured in the backend. Messages contain no patient details.</p></header>
    {message&&<p role="status" className="rounded-lg border bg-slate-50 p-4">{message}</p>}
    <div className="grid gap-4 md:grid-cols-2">{['email','sms'].map(channel=>{
      const ready=data?.[`${channel}Configured`]
      const automatic=data?.[channel==='email'?'automaticEmail':'automaticSms']
      return <section key={channel} className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">{channel==='email'?'Email alerts':'SMS alerts'}</h2>
        <p>{data?(ready?'Provider configured':'Provider setup required'):'Loading configuration…'}</p>
        <p>Automatic High-label alerts: {automatic&&ready&&data?.recipientConfirmed?'Enabled':'Disabled or setup incomplete'}</p>
        <button type="button" disabled={!!busy||!ready||!data?.recipientConfirmed} onClick={()=>send(channel)} className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:bg-slate-300">{busy===channel?'Sending…':`Send ${channel==='email'?'email':'SMS'} alert`}</button>
      </section>
    })}</div>
    <p className="text-sm text-slate-600">Automatic alerts use the symptom model’s High label. This synthetic-data output is not a clinical emergency assessment. Provider settings and recipient consent are configured in the backend .env.</p>
    <section className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Recent alert attempts</h2><button type="button" onClick={()=>refresh().catch(error=>setMessage(error.message))} className="text-blue-700">Refresh</button></div>
      <p className="mt-2 text-sm text-slate-500">History covers this server session only. Accepted or queued does not mean delivered.</p>
      <ul className="mt-4 space-y-3">{data?.history?.map(item=><li key={item.id} className="border-t pt-3">{item.channel} · {item.source} · {item.status} · {new Date(item.createdAt).toLocaleString()}</li>)}</ul>
      {!data?.history?.length&&<p className="mt-4">No alert attempts this session.</p>}
    </section>
  </main>
}
