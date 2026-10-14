import { useEffect, useRef, useState } from 'react'
import { getDailyCapacity, updateDailyCapacity } from '../api'
import { requireDailyCapacity } from '../capacity.utils'
import PageHeader from '../components/PageHeader'
import CapacityPanel from '../components/CapacityPanel'

export default function Configuracion() {
  const [capacity, setCapacity] = useState(null)
  const [capacityLoading, setCapacityLoading] = useState(true)
  const [capacityError, setCapacityError] = useState('')
  const [capacitySaving, setCapacitySaving] = useState(false)
  const [capacityRetry, setCapacityRetry] = useState(0)
  const saveController = useRef(null)

  useEffect(() => () => saveController.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    async function loadCapacity() {
      setCapacityLoading(true)
      setCapacityError('')
      try {
        const result = requireDailyCapacity(await getDailyCapacity(controller.signal))
        if (!controller.signal.aborted) setCapacity(result)
      } catch (err) {
        if (!controller.signal.aborted && err.name !== 'AbortError') setCapacityError('No pudimos consultar tu capacidad.')
      } finally {
        if (!controller.signal.aborted) setCapacityLoading(false)
      }
    }
    loadCapacity()
    return () => controller.abort()
  }, [capacityRetry])

  async function saveCapacity(hours) {
    const controller = new AbortController()
    saveController.current = controller
    setCapacitySaving(true)
    try {
      const result = requireDailyCapacity(await updateDailyCapacity(hours, controller.signal))
      if (!controller.signal.aborted) setCapacity(result)
      return result
    } finally {
      if (!controller.signal.aborted) setCapacitySaving(false)
    }
  }

  return <ConfiguracionContent capacity={capacity} loading={capacityLoading} error={capacityError}
    saving={capacitySaving} onSave={saveCapacity} onRetry={() => setCapacityRetry(value => value + 1)} />
}

export function ConfiguracionContent({ capacity, loading, error, saving, onSave, onRetry }) {
  return <div className="page-container configuration-page">
    <PageHeader title="Configuración" description="Administra tu disponibilidad para planificar tus eventos." />
    <CapacityPanel capacity={capacity} loading={loading} error={error}
      saving={saving} onSave={onSave} onRetry={onRetry} />
  </div>
}
