import { Clock3, MapPin, PackageCheck, Truck } from 'lucide-react'

const deliveries = [
  {
    id:'#2041',
    customer:'María García',
    address:'Barcelona · Gràcia',
    status:'En reparto',
    hour:'18:30',
  },
  {
    id:'#2042',
    customer:'Carlos Ruiz',
    address:'Barcelona · Eixample',
    status:'Preparando',
    hour:'19:00',
  },
  {
    id:'#2043',
    customer:'Laura Martín',
    address:'Barcelona · Sants',
    status:'Entregado',
    hour:'17:10',
  },
]

export function AdminDeliveryPanel(){
  return (
    <div className='space-y-6'>
      <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <div className='mb-2 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700'>Sistema reparto conectado</div>
            <h1 className='text-4xl font-black tracking-tight text-zinc-950'>Entregas Herencia</h1>
            <p className='mt-2 text-zinc-500'>Pedidos, repartidores y estados sincronizados.</p>
          </div>

          <div className='rounded-[2rem] border border-emerald-100 bg-emerald-50/40 px-6 py-5'>
            <p className='text-sm font-bold text-zinc-500'>Pedidos activos</p>
            <h3 className='text-5xl font-black text-emerald-700'>{deliveries.length}</h3>
          </div>
        </div>
      </section>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-[1fr_.8fr]'>
        <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
          <div className='mb-6 flex items-center justify-between'>
            <div>
              <h2 className='text-3xl font-black text-zinc-900'>Pedidos reparto</h2>
              <p className='text-sm font-semibold text-zinc-500'>Sincronizados con TPV y pedidos</p>
            </div>

            <Truck className='h-7 w-7 text-emerald-700' />
          </div>

          <div className='space-y-4'>
            {deliveries.map((delivery,index)=>(
              <div key={delivery.id} className='rounded-[1.8rem] border border-emerald-100 bg-emerald-50/30 p-5'>
                <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
                  <div className='flex items-center gap-4'>
                    <div className='grid h-16 w-16 place-items-center rounded-[1.6rem] bg-white text-3xl'>🌿</div>

                    <div>
                      <div className='mb-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700'>
                        Pedido {delivery.id}
                      </div>

                      <h3 className='text-2xl font-black text-zinc-950'>{delivery.customer}</h3>

                      <div className='mt-2 flex items-center gap-2 text-zinc-500'>
                        <MapPin className='h-4 w-4' />
                        <span className='font-semibold'>{delivery.address}</span>
                      </div>
                    </div>
                  </div>

                  <div className='flex flex-wrap gap-3'>
                    <Badge icon={<Clock3 className='h-4 w-4' />} text={delivery.hour} />
                    <Badge icon={<PackageCheck className='h-4 w-4' />} text={delivery.status} success={delivery.status==='Entregado'} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
          <div className='mb-6 flex items-center justify-between'>
            <div>
              <h2 className='text-3xl font-black text-zinc-900'>Mapa reparto</h2>
              <p className='text-sm font-semibold text-zinc-500'>Vista logística premium</p>
            </div>

            <MapPin className='h-6 w-6 text-emerald-700' />
          </div>

          <div className='relative overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-rose-50 p-8'>
            <div className='absolute left-10 top-10 h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl'></div>
            <div className='absolute right-10 bottom-10 h-24 w-24 rounded-full bg-rose-200/40 blur-2xl'></div>

            <div className='relative grid min-h-[420px] place-items-center rounded-[2rem] border border-dashed border-emerald-200 bg-white/50'>
              <div className='text-center'>
                <div className='mx-auto mb-6 grid h-28 w-28 place-items-center rounded-full bg-white text-6xl shadow-xl'>🚚</div>
                <h3 className='text-3xl font-black text-zinc-950'>Mapa de entregas</h3>
                <p className='mt-3 max-w-sm font-semibold text-zinc-500'>Preparado para conectar Google Maps y rutas inteligentes.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Badge({icon,text,success}:{icon:any,text:string,success?:boolean}){
  return(
    <div className={`flex items-center gap-2 rounded-full px-4 py-3 text-sm font-black shadow-sm ${success ? 'bg-emerald-100 text-emerald-700':'bg-white text-zinc-700'}`}>
      {icon}
      {text}
    </div>
  )
}
