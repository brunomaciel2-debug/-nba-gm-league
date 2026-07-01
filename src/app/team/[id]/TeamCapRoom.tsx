'use client'
import { useTranslation } from '@/components/I18nProvider'

export default function TeamCapRoom({ used, cap, space, capFmt, color }: {
  used: number, cap: number, space: number,
  capFmt: (n: number) => string, color: string
}) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  return (
    <div className="rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
      <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>
        💰 {isPT ? 'Margem Salarial' : 'Cap Room'}
      </h3>
      <div className="flex justify-between text-xs mb-1">
        <span style={{color:'#6b5f4e'}}>{isPT ? 'Utilizado' : 'Used'}</span>
        <span className="font-bold" style={{color:'#1a1612'}}>{capFmt(used)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden mb-1" style={{background:'#cec7bc'}}>
        <div className="h-full rounded-full" style={{
          width: Math.min(100, used/cap*100) + '%',
          background: space > 0 ? '#1d4ed8' : '#dc2626',
        }}/>
      </div>
      <div className="flex justify-between text-xs">
        <span style={{color:'#6b5f4e'}}>{isPT ? 'Tecto' : 'Cap'}: {capFmt(cap)}</span>
        <span className="font-bold" style={{color: space > 0 ? '#15803d' : '#dc2626'}}>
          {space > 0
            ? `${isPT ? 'Margem' : 'Space'}: +${capFmt(space)}`
            : `${isPT ? 'Excesso' : 'Over'}: ${capFmt(Math.abs(space))}`}
        </span>
      </div>
    </div>
  )
}
