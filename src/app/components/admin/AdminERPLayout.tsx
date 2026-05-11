import { BarChart3, Boxes, BrainCircuit, CreditCard, LayoutDashboard, Package2, Receipt, Settings, ShoppingBag, Truck, Users, Wallet } from 'lucide-react'

const sections = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: CreditCard, label: 'TPV' },
  { icon: ShoppingBag, label: 'Pedidos' },
  { icon: Wallet, label: 'Finanzas' },
  { icon: Receipt, label: 'Caja' },
  { icon: Boxes, label: 'Stock' },
  { icon: Users, label: 'Clientes' },
  { icon: Package2, label: 'Mermas' },
  { icon: Truck, label: 'Repartos' },
  { icon: BarChart3, label: 'Facturación' },
  { icon: BrainCircuit, label: 'IA Herencia' },
  { icon: Settings, label: 'Configuración' },
]

export function AdminERPLayout(){
  return (
    <div className='min-h-screen bg-gradient-to-br from-emerald-50 via-white to-rose-50'>
      <div className='grid min-h-screen grid-cols-[290px_1fr]'>
        <aside className='border-r border-emerald-100 bg-white/80 p-6 backdrop-blur-xl'>
          <div className='mb-8 flex items-center gap-4 rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-lg'>
            <div className='grid h-16 w-16 place-items-center rounded-[1.7rem] bg-gradient-to-br from-emerald-100 to-emerald-50 text-3xl'>🌿</div>
            <div>
              <h1 className='text-2xl font-black tracking-tight text-zinc-950'>HERENCIA</h1>
              <p className='text-sm font-bold text-emerald-700'>ERP Floristería Premium</p>
            </div>
          </div>

          <nav className='space-y-2'>
            {sections.map(({icon:Icon,label},index)=>(
              <button
                key={label}
                className={`group flex w-full items-center gap-4 rounded-[1.4rem] px-5 py-4 text-left transition-all ${index===0 ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-xl':'bg-white text-zinc-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-100'}`}
              >
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${index===0 ? 'bg-white/20':'bg-emerald-50 group-hover:bg-white'}`}>
                  <Icon className='h-5 w-5' />
                </div>

                <div>
                  <p className='font-black'>{label}</p>
                  <p className={`text-xs ${index===0 ? 'text-emerald-50':'text-zinc-400'}`}>
                    Sistema conectado
                  </p>
                </div>
              </button>
            ))}
          </nav>

          <div className='mt-8 rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-500 to-green-600 p-6 text-white shadow-2xl'>
            <p className='text-sm font-bold text-emerald-50'>Sistema empresarial</p>
            <h3 className='mt-2 text-3xl font-black'>ERP + TPV + IA</h3>
            <p className='mt-3 text-sm text-emerald-50'>Todo conectado en el mismo ecosistema Herencia.</p>
          </div>

          <div className='mt-6 rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-lg'>
            <p className='text-xs font-black uppercase tracking-wider text-zinc-400'>Desarrollado por</p>
            <h3 className='mt-2 text-xl font-black text-zinc-950'>D.E.V.B</h3>
            <p className='mt-1 text-sm font-semibold text-zinc-500'>Propiedad de Herencia Floristería</p>
          </div>
        </aside>

        <main className='p-8'>
          <section className='rounded-[2.5rem] border border-emerald-100 bg-white/90 p-8 shadow-2xl backdrop-blur-xl'>
            <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
              <div>
                <div className='mb-3 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700'>HERENCIAPP-MARKET ERP</div>
                <h1 className='text-5xl font-black tracking-tight text-zinc-950'>Sistema empresarial conectado</h1>
                <p className='mt-4 max-w-3xl text-lg font-medium text-zinc-500'>TPV, stock, clientes, finanzas, tickets, facturación, caja, mermas y analíticas sincronizadas en tiempo real.</p>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <Metric title='Ventas hoy' value='LIVE' />
                <Metric title='TPV activo' value='OK' />
                <Metric title='Finanzas' value='SYNC' />
                <Metric title='Stock' value='REAL' />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function Metric({title,value}:{title:string,value:string}){
  return (
    <div className='rounded-[1.7rem] border border-emerald-100 bg-emerald-50/40 px-5 py-4'>
      <p className='text-sm font-bold text-zinc-500'>{title}</p>
      <h3 className='mt-2 text-3xl font-black text-emerald-700'>{value}</h3>
    </div>
  )
}
