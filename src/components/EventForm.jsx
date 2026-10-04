export default function EventForm({ formData, fieldErrors, submitError, isSubmitting,
  onChange: handleChange, onSubmit: handleSubmit, referenceDate, submitLabel = 'Crear evento', onCancel }) {
  const errorProps = (name) => ({
    'aria-invalid': Boolean(fieldErrors[name]),
    'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined,
  })

  return (
      <div className="form-card-wrapper">
        <form
          onSubmit={handleSubmit}
          className="minimal-form"
          aria-busy={isSubmitting}
          noValidate
        >
          {submitError && (
            <div className="feedback-banner feedback-error" role="alert">
              {submitError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="title">Nombre del evento *</label>
            <input
              id="title"
              name="title"
              type="text"
              placeholder="Ej: Encuentro cultural"
              value={formData.title}
              onChange={handleChange}
              disabled={isSubmitting}
              required
              {...errorProps('title')}
            />
            {fieldErrors.title && (
              <span id="title-error" className="field-error">
                {fieldErrors.title}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="type">Tipo de evento *</label>
            <input
              id="type"
              name="type"
              type="text"
              placeholder="Ej: Cultural, académico, musical"
              value={formData.type}
              onChange={handleChange}
              disabled={isSubmitting}
              required
              {...errorProps('type')}
            />
            {fieldErrors.type && (
              <span id="type-error" className="field-error">
                {fieldErrors.type}
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Fecha *</label>
              <input
                id="date"
                name="date"
                type="date"
                min={referenceDate}
                value={formData.date}
                onChange={handleChange}
                disabled={isSubmitting}
                required
                {...errorProps('date')}
              />
              {fieldErrors.date && (
                <span id="date-error" className="field-error">
                  {fieldErrors.date}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="time">Hora</label>
              <input
                id="time"
                name="time"
                type="time"
                value={formData.time}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">Ubicación</label>
            <input
              id="location"
              name="location"
              type="text"
              placeholder="Ej: Auditorio principal"
              value={formData.location}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              name="description"
              rows="4"
              placeholder="Información útil para organizar el evento"
              value={formData.description}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="switch-field">
            <input
              id="isPriority"
              name="isPriority"
              type="checkbox"
              checked={formData.isPriority}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <label htmlFor="isPriority">
              <span>Evento prioritario</span>
              <small>Destácalo dentro de tu planificación.</small>
            </label>
          </div>

          <p className="required-note">* Campos obligatorios</p>

          <button
            type="submit"
            className="btn-primary btn-block"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando…' : submitLabel}
          </button>
          {onCancel && <button type="button" className="btn-secondary" disabled={isSubmitting} onClick={onCancel}>Cancelar</button>}
        </form>
      </div>
  )
}
