import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Program } from '../db/schema'
import { Header } from '../ui/Header'
import { Card, Chip, Label, PrimaryButton, SectionTitle } from '../ui/primitives'
import { BottomSheet, useToast } from '../ui/overlays'
import { VeyroLoader } from '../ui/brand'
import { seedPrograms } from '../db/seed-programs'

const order = new Map(seedPrograms.map((p, i) => [p.id, i]))

const levelLabel = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' } as const
const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

export default function Treinar() {
  const programs = useLiveQuery(async () => (await db.programs.toArray()).sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)))
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const [open, setOpen] = useState<Program | null>(null)
  const toast = useToast((s) => s.show)
  const exName = new Map(exercises?.map((e) => [e.id, e.name]))

  return (
    <>
      <Header title="Treinar" />
      <SectionTitle kicker="Programas prontos" title="Escolha um ponto de partida" />
      {!programs ? (
        <div className="py-16"><VeyroLoader label="Carregando" /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {programs.map((p) => (
            <Card key={p.id} onClick={() => setOpen(p)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{p.name}</div>
                  <div className="mt-1 text-sm text-muted">{p.forWho}</div>
                </div>
                <div className="num shrink-0 rounded-full bg-surface2 px-3 py-1 text-xs font-semibold">{p.daysPerWeek}x/sem</div>
              </div>
              <div className="mt-3 flex gap-2">
                <span className="label">{levelLabel[p.level]}</span>
                {p.phases && <span className="label text-lime">· com fase de retorno</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <BottomSheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name}
        footer={
          <>
            <PrimaryButton full onClick={() => toast('Ativar programa chega na próxima etapa')}>
              Usar este programa
            </PrimaryButton>
            <Label className="mt-2 text-center">Tudo editável depois</Label>
          </>
        }
      >
        {open && (
          <>
            <p className="mb-4 text-sm text-muted">{open.description}</p>
            {open.phases && (
              <div className="mb-4 flex flex-wrap gap-2">
                {open.phases[0].rules.map((r) => (
                  <Chip key={r.week}>Sem {r.week}: {Math.round(r.pct * 100)}%</Chip>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-3">
              {open.routines.map((r, i) => (
                <div key={i} className="rounded-btn border border-border bg-surface2 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    {r.weekday !== undefined && <span className="label text-lime">{weekdays[r.weekday]}</span>}
                    <span className="font-semibold">{r.name}</span>
                    {r.fromWeek && r.fromWeek > 1 && <span className="label">· semana {r.fromWeek}+</span>}
                  </div>
                  <ul className="space-y-1 text-sm text-muted">
                    {r.items.map((it, j) => (
                      <li key={j} className="flex justify-between gap-2">
                        <span>{exName.get(it.exerciseId) ?? it.exerciseId}</span>
                        <span className="num shrink-0">
                          {it.minutes ? `${it.minutes} min` : it.seconds ? `${it.sets}×${it.seconds}s` : `${it.sets}×${it.repMin === it.repMax ? it.repMin : `${it.repMin}–${it.repMax}`}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </BottomSheet>
    </>
  )
}
